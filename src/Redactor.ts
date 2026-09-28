import { type RedactorOptions, type RedactionEvent } from './types.js';

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
  private anonymize: boolean;
  private aggressive: boolean;
  private anonymizationMap: Map<string, string> = new Map();
  private anonymizationCounters: Map<string, number> = new Map();

  constructor(options: RedactorOptions = {}) {
    const {
      apiKey,
      apiUrl,
      failSilent = true,
      hookTimeout = 500,
      rules,
      customRules = [],
      globalReplaceWith,
      anonymize = false,
      aggressive = false,
    } = options;

    // Only set apiUrl if apiKey is provided (dashboard is being used)
    // If apiKey is provided but apiUrl is not, use the default endpoint
    const hasApiKey = apiKey !== null && apiKey !== undefined && apiKey !== '';
    this.apiUrl = hasApiKey ? (apiUrl ?? 'https://api.redactpii.com/v1/events') : (apiUrl ?? '');
    this.apiKey = apiKey ?? null;
    this.failSilent = failSilent;
    this.hookTimeout = hookTimeout;
    this.globalReplaceWith = globalReplaceWith;
    this.anonymize = anonymize;
    this.aggressive = aggressive;

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
    // Normal mode patterns - balanced precision
    const normalPatterns: Record<string, { pattern: RegExp; name: string }> = {
      CREDIT_CARD: {
        // Matches common credit card formats (16 digits)
        pattern: /\b\d{4}[ -]?\d{4}[ -]?\d{4}[ -]?\d{4}\b|\b\d{4}[ -]?\d{6}[ -]?\d{4,5}\b/g,
        name: 'CREDIT_CARD',
      },
      EMAIL: {
        // Improved email pattern - requires valid TLD
        // No \b at end to handle cases like "email@example.com555"
        // Lookbehind (not \b) anchors to the start of the local-part run so a long
        // @-less token is scanned once instead of from every word boundary (O(n^2)).
        // \p{L}/\p{N} so non-ASCII addresses (müller@, josé@) are caught whole.
        pattern:
          /(?<![\p{L}\p{N}._%+-]|[\p{L}\p{N}]')[\p{L}\p{N}][\p{L}\p{N}._%+'-]*@[\p{L}\p{N}][\p{L}\p{N}_.-]*\.\p{L}{2,}/giu,
        name: 'EMAIL',
      },
      NAME: {
        // Case-sensitive on purpose: with the `i` flag [A-Z] also matched lowercase words.
        // The leading lookahead keeps the variable-length lookbehind off every position.
        pattern:
          /(?=[DdHhGg])(?<=(?:^|[.!?\n])\s*)(?:[Dd]ear|[Hh]i|[Hh]ello|[Gg]reetings|[Hh]ey(?:\s+[Tt]here)?)\s+\p{Lu}[\p{L}'’-]*\p{Ll}(?:[ \t]+\p{Lu}[\p{L}'’-]*\p{Ll})+/gu,
        name: 'PERSON_NAME',
      },
      PHONE: {
        // US phone numbers with various formats
        // (?<!\w) rather than \b so a leading "(" or "+" is redacted with the number
        pattern: /(?<!\w)(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}\b/g,
        name: 'PHONE_NUMBER',
      },
      SSN: {
        pattern: /\b\d{3}[ -.]\d{2}[ -.]\d{4}\b/g,
        name: 'US_SOCIAL_SECURITY_NUMBER',
      },
    };

    // Aggressive mode patterns - more permissive, catches obfuscation
    const aggressivePatterns: Record<string, { pattern: RegExp; name: string }> = {
      CREDIT_CARD: {
        // Catches more variations including partial masking
        pattern: /\b(?:\d[ -]?){13,19}\b|\*{4}[ -]?\*{4}[ -]?\*{4}[ -]?\d{4}/g,
        name: 'CREDIT_CARD',
      },
      EMAIL: {
        // Catches obfuscated emails like "user [at] domain [dot] com"
        pattern:
          /(?<![\p{L}\p{N}._%+-]|[\p{L}\p{N}]')[\p{L}\p{N}][\p{L}\p{N}._%+'-]*\s*(?:@|\[at\]|\(at\))\s*[\p{L}\p{N}][\p{L}\p{N}_.-]*\s*(?:\.|\[dot\]|\(dot\))\s*\p{L}{2,}(?![\p{L}\p{N}_])/giu,
        name: 'EMAIL',
      },
      NAME: {
        // More permissive name detection
        pattern:
          /(?=[DdHhGgMmPp])(?<=(?:^|[.!?\n,])\s*)(?:[Dd]ear|[Hh]i|[Hh]ello|[Gg]reetings|[Hh]ey(?:\s+[Tt]here)?|[Mm][Rr][Ss]?\.?|[Mm][Ss]\.?|[Dd][Rr]\.?|[Pp]rof\.?)\s+\p{Lu}[\p{L}'’-]*\p{Ll}(?:[ \t]+\p{Lu}[\p{L}'’-]*\p{Ll})*/gu,
        name: 'PERSON_NAME',
      },
      PHONE: {
        // More permissive phone matching
        pattern: /(?<!\w)(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}\b|\b\d{3}[-.\s]\d{4}\b/g,
        name: 'PHONE_NUMBER',
      },
      SSN: {
        // Catches SSN with various separators or no separators
        pattern: /\b\d{3}[ -.]?\d{2}[ -.]?\d{4}\b/g,
        name: 'US_SOCIAL_SECURITY_NUMBER',
      },
    };

    const rulePatterns = this.aggressive ? aggressivePatterns : normalPatterns;
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
   * Clone a regex pattern to avoid lastIndex state issues. Always global (a custom rule
   * without /g would otherwise redact only its first match) and never sticky.
   */
  private _clonePattern(pattern: RegExp): RegExp {
    const flags = pattern.flags.replace('y', '');
    return new RegExp(pattern.source, flags.includes('g') ? flags : `${flags}g`);
  }

  /**
   * Checks if text contains any PII patterns without redacting.
   * Returns true if PII is detected, false otherwise.
   */
  hasPII(text: string): boolean {
    for (const { pattern } of this.activeRules) {
      // Clone pattern to avoid state issues
      const clonedPattern = this._clonePattern(pattern);
      if (clonedPattern.test(text)) {
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

    // Reset anonymization state once for the entire object
    if (this.anonymize) {
      this.anonymizationMap.clear();
      this.anonymizationCounters.clear();
    }

    const redactString = (str: string): string => {
      // Use internal redaction logic without resetting state
      return this._redactString(str, false);
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
   * Internal redaction logic that can optionally reset anonymization state
   */
  private _redactString(text: string, resetState: boolean): string {
    const events: RedactionEvent[] = [];

    // Reset anonymization tracking if requested
    if (resetState && this.anonymize) {
      this.anonymizationMap.clear();
      this.anonymizationCounters.clear();
    }

    // Match every rule against the original text, then merge overlapping matches. Applying
    // rules one after another let a later rule split an earlier match (leaking the rest of a
    // card number) or match inside an earlier replacement token.
    const spans: Array<{ start: number; end: number; name: string; length: number }> = [];
    for (const { pattern, name } of this.activeRules) {
      for (const match of text.matchAll(this._clonePattern(pattern))) {
        if (match[0] === '') {
          continue;
        }
        const start = match.index;
        spans.push({ start, end: start + match[0].length, name, length: match[0].length });
      }
    }
    // Stable sort keeps rule order as the tiebreak for identical spans
    spans.sort((a, b) => (a.start === b.start ? b.end - a.end : a.start - b.start));

    const merged: typeof spans = [];
    for (const span of spans) {
      const last = merged[merged.length - 1];
      if (last !== undefined && span.start < last.end) {
        last.end = Math.max(last.end, span.end);
        // The merged span is labelled by its longest member match
        if (span.length > last.length) {
          last.name = span.name;
          last.length = span.length;
        }
      } else {
        merged.push({ ...span });
      }
    }

    let redactedText = '';
    let cursor = 0;
    for (const { start, end, name } of merged) {
      events.push({ pii_type: name, action: 'REDACTED' });
      redactedText += text.slice(cursor, start) + this._replacementFor(name, text.slice(start, end));
      cursor = end;
    }
    redactedText += text.slice(cursor);

    // Send events to dashboard if configured (only for top-level redact calls)
    if (resetState) {
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
    }

    return redactedText;
  }

  /**
   * Replacement token for a matched PII value
   */
  private _replacementFor(piiType: string, match: string): string {
    // Anonymization: same value gets same token
    if (this.anonymize) {
      const normalizedMatch = match.toLowerCase();
      const key = `${piiType}:${normalizedMatch}`;

      if (this.anonymizationMap.has(key)) {
        return this.anonymizationMap.get(key) ?? match;
      }

      // Generate new token
      const counter = (this.anonymizationCounters.get(piiType) ?? 0) + 1;
      this.anonymizationCounters.set(piiType, counter);

      // Map PII type to token prefix
      const tokenPrefix = this._getTokenPrefix(piiType);
      const token = `${tokenPrefix}_${counter}`;
      this.anonymizationMap.set(key, token);

      return token;
    }

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
  }

  /**
   * Redacts PII from the input text using regex-based patterns.
   * If an apiKey is configured, asynchronously sends metadata to the dashboard.
   */
  redact(text: string): string {
    return this._redactString(text, true);
  }

  /**
   * Maps PII type to token prefix for anonymization
   */
  private _getTokenPrefix(piiType: string): string {
    switch (piiType) {
      case 'CREDIT_CARD':
        return 'CREDIT_CARD';
      case 'EMAIL':
        return 'EMAIL';
      case 'PERSON_NAME':
        return 'PERSON';
      case 'PHONE_NUMBER':
        return 'PHONE';
      case 'US_SOCIAL_SECURITY_NUMBER':
        return 'SSN';
      default:
        return 'PII';
    }
  }

  /**
   * Spec-compliant dashboard hook - sends redaction events to dashboard
   */
  private async _phoneHome(events: RedactionEvent[]): Promise<void> {
    if (this.apiKey === null || this.apiKey === '' || this.apiUrl === '') {
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
