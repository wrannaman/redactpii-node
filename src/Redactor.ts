import { type RedactorOptions, type RedactionEvent } from './types';

/**
 * Main Redactor class that provides PII redaction with optional dashboard integration.
 * Zero dependencies, blazing fast regex-based redaction.
 */
export class Redactor {
  private apiKey: string | null;
  private apiUrl: string;
  private failSilent: boolean;
  private hookTimeout: number;
  private activeRules: Array<{ pattern: RegExp; name: string }> = [];
  private globalReplaceWith: string | undefined;

  constructor(options: RedactorOptions = {}) {
    const {
      apiKey,
      apiUrl,
      failSilent = true,
      hookTimeout = 500,
      rules,
      customRules = [],
      globalReplaceWith,
    } = options;

    this.apiUrl = apiUrl ?? 'https://api.redactpii.com/v1/events';
    this.apiKey = apiKey ?? null;
    this.failSilent = failSilent;
    this.hookTimeout = hookTimeout;
    this.globalReplaceWith = globalReplaceWith;

    // Build active rule set - all rules enabled by default
    const defaultRules = { CREDIT_CARD: true, EMAIL: true, NAME: true, PHONE: true, SSN: true };
    this.activeRules = this.buildRuleSet(rules ?? defaultRules, customRules);
  }

  /**
   * Build active rule set from simplified configuration
   */
  private buildRuleSet(
    rules: NonNullable<RedactorOptions['rules']>,
    customRules: RegExp[],
  ): Array<{ pattern: RegExp; name: string }> {
    const rulePatterns: Record<string, { pattern: RegExp; name: string }> = {
      CREDIT_CARD: {
        pattern: /\d{4}[ -]?\d{4}[ -]?\d{4}[ -]?\d{4}|\d{4}[ -]?\d{6}[ -]?\d{4}\d?/g,
        name: 'CREDIT_CARD',
      },
      EMAIL: {
        pattern: /([a-z0-9_\-.+]+)@\w+(\.\w+)*/gi,
        name: 'EMAIL',
      },
      NAME: {
        pattern: /(?:^|\.\s+)(?:dear|hi|hello|greetings|hey|hey there)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/gi,
        name: 'PERSON_NAME',
      },
      PHONE: {
        pattern:
          /(\(?\+?[0-9]{1,2}\)?[-. ]?)?(\(?[0-9]{3}\)?[-. ]?[0-9]{3,4}[-. ]?[0-9]{4}|[0-9]{3}[-. ]?[0-9]{4}|[0-9]{4}[-. ]?[0-9]{4}|\b[A-Z0-9]{7}\b)/g,
        name: 'PHONE_NUMBER',
      },
      SSN: {
        pattern: /\b\d{3}[ -.]\d{2}[ -.]\d{4}\b/g,
        name: 'US_SOCIAL_SECURITY_NUMBER',
      },
    };

    const activeRules: Array<{ pattern: RegExp; name: string }> = [];

    // Add enabled built-in rules
    for (const [ruleName, enabled] of Object.entries(rules)) {
      if (enabled === true && rulePatterns[ruleName] !== undefined) {
        activeRules.push(rulePatterns[ruleName]);
      }
    }

    // Add custom rules (use DIGITS as default name)
    for (const customRule of customRules) {
      activeRules.push({ pattern: customRule, name: 'DIGITS' });
    }

    return activeRules;
  }

  /**
   * Checks if text contains any PII patterns without redacting.
   * Returns true if PII is detected, false otherwise.
   */
  hasPII(text: string): boolean {
    for (const { pattern } of this.activeRules) {
      // Reset regex lastIndex to ensure consistent behavior
      pattern.lastIndex = 0;
      if (pattern.test(text)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Redacts PII from JSON objects recursively
   */
  redactObject<T extends object>(obj: T): T {
    // Deep clone using JSON serialization
    const redacted: unknown = JSON.parse(JSON.stringify(obj));

    const redactString = (str: string): string => {
      return this.redact(str);
    };

    const processValue = (value: unknown): unknown => {
      if (typeof value === 'string') {
        return redactString(value);
      }
      if (Array.isArray(value)) {
        return value.map(processValue);
      }
      if (value !== null && typeof value === 'object') {
        const result: Record<string, unknown> = {};
        for (const [key, val] of Object.entries(value)) {
          result[key] = processValue(val);
        }
        return result;
      }
      return value;
    };

    // Type assertion needed here because JSON.parse loses type information
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return processValue(redacted) as T;
  }

  /**
   * Redacts PII from the input text using regex-based patterns.
   * If an apiKey is configured, asynchronously sends metadata to the dashboard.
   */
  redact(text: string): string {
    const events: RedactionEvent[] = [];
    let redactedText = text;

    // Apply each rule and collect events during redaction
    for (const { pattern, name } of this.activeRules) {
      redactedText = redactedText.replace(pattern, () => {
        const piiType = name;
        events.push({ pii_type: piiType, action: 'REDACTED' });

        // Use globalReplaceWith if provided, otherwise use type-specific replacements
        if (this.globalReplaceWith !== undefined) {
          return this.globalReplaceWith;
        }

        // Return appropriate replacement based on PII type
        switch (piiType) {
          case 'CREDIT_CARD':
            return 'CREDIT_CARD_NUMBER';
          case 'EMAIL':
            return 'EMAIL_ADDRESS';
          case 'PERSON_NAME':
            return 'PERSON_NAME';
          case 'PHONE_NUMBER':
            return 'PHONE_NUMBER';
          case 'US_SOCIAL_SECURITY_NUMBER':
            return 'US_SOCIAL_SECURITY_NUMBER';
          default:
            return 'DIGITS';
        }
      });
    }

    // Send events to dashboard if configured
    const hasValidApiKey = this.apiKey !== null && this.apiKey !== '';
    if (hasValidApiKey && events.length > 0) {
      // Fire and forget - intentionally not awaiting
      this._phoneHome(events).catch(() => {
        if (this.failSilent === false) {
          throw new Error('Dashboard hook failed');
        }
        // Fail silently by default
      });
    }

    return redactedText;
  }

  /**
   * Spec-compliant dashboard hook - sends redaction events to dashboard
   */
  private async _phoneHome(events: RedactionEvent[]): Promise<void> {
    if (this.apiKey === null || this.apiKey === '') {
      return;
    }

    try {
      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.hookTimeout);

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${String(this.apiKey)}`,
        },
        body: JSON.stringify({
          sdk_version: '1.0.0',
          sdk_language: 'node',
          events, // Array of redaction events
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok === false) {
        throw new Error(`Dashboard API returned ${response.status}`);
      }
    } catch (error) {
      if (this.failSilent === false) {
        throw error;
      }
      // Fail silently by default
    }
  }
}
