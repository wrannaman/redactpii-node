// Redaction event structure for dashboard hook
export interface RedactionEvent {
  pii_type: string;
  action: 'REDACTED';
}

export interface RedactorOptions {
  // Dashboard integration
  apiKey?: string | null;
  apiUrl?: string;
  failSilent?: boolean;
  hookTimeout?: number;

  // Rule configuration
  rules?: {
    CREDIT_CARD?: boolean;
    EMAIL?: boolean;
    NAME?: boolean;
    PHONE?: boolean;
    SSN?: boolean;
  };

  // Custom regex rules
  customRules?: RegExp[];

  // Global replacement string (optional)
  globalReplaceWith?: string;

  // Anonymization: replace same values with same tokens (e.g., "anne@example.com" → "EMAIL_1" consistently)
  anonymize?: boolean;
}
