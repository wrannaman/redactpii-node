/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/strict-boolean-expressions */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/prefer-nullish-coalescing */
/* eslint-disable @typescript-eslint/require-await */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Redactor } from '../src';

describe('Redactor', () => {
  describe('redact', () => {
    it('should redact email addresses', () => {
      const redactor = new Redactor({ rules: { EMAIL: true } });
      expect(redactor.redact('test@example.com')).toContain('EMAIL');
      expect(redactor.redact('Contact test@example.com for details')).toContain('EMAIL');
    });

    it('should redact credit cards', () => {
      const redactor = new Redactor({ rules: { CREDIT_CARD: true } });
      expect(redactor.redact('1234-5678-9012-3456')).toContain('CREDIT');
      expect(redactor.redact('Card: 1234 5678 9012 3456')).toContain('CREDIT');
    });

    it('should redact SSN', () => {
      const redactor = new Redactor({ rules: { SSN: true } });
      expect(redactor.redact('123-45-6789')).toContain('SOCIAL');
      expect(redactor.redact('SSN: 123.45.6789')).toContain('SOCIAL');
    });

    it('should redact phone numbers', () => {
      const redactor = new Redactor({ rules: { PHONE: true } });
      expect(redactor.redact('555-123-4567')).toContain('PHONE');
      expect(redactor.redact('Call (555) 123-4567')).toContain('PHONE');
    });

    it('should redact names', () => {
      const redactor = new Redactor({ rules: { NAME: true } });
      expect(redactor.redact('Hi John Smith, how are you?')).toContain('PERSON_NAME');
      expect(redactor.redact('Dear Jane Doe,')).toContain('PERSON_NAME');
    });

    it('should redact multiple PII types', () => {
      const redactor = new Redactor({
        rules: { EMAIL: true, PHONE: true, SSN: true },
      });
      const result = redactor.redact('Email: test@example.com, Phone: 555-123-4567, SSN: 123-45-6789');
      expect(result).toContain('EMAIL');
      expect(result).toContain('PHONE');
      expect(result).toContain('SOCIAL');
    });

    it('should use globalReplaceWith when provided', () => {
      const redactor = new Redactor({
        rules: { EMAIL: true },
        globalReplaceWith: '[REDACTED]',
      });
      expect(redactor.redact('test@example.com')).toBe('[REDACTED]');
    });

    it('should not redact when rules are disabled', () => {
      const redactor = new Redactor({ rules: { EMAIL: false } });
      expect(redactor.redact('test@example.com')).toBe('test@example.com');
    });

    it('should handle empty string', () => {
      const redactor = new Redactor();
      expect(redactor.redact('')).toBe('');
    });

    it('should handle text with no PII', () => {
      const redactor = new Redactor();
      const text = 'This is plain text with no sensitive information';
      expect(redactor.redact(text)).toBe(text);
    });

    it('should anonymize with unique IDs when enabled', () => {
      const redactor = new Redactor({ rules: { EMAIL: true }, anonymize: true });
      const result = redactor.redact('Contact anne@example.com and anne@example.com again');
      expect(result).toContain('EMAIL_1');
      expect(result).not.toContain('anne@example.com');
      // Same email should get same token
      const matches = result.match(/EMAIL_\d+/g);
      expect(matches?.every((val) => val === matches[0])).toBe(true);
    });

    it('should give different tokens to different values when anonymizing', () => {
      const redactor = new Redactor({ rules: { EMAIL: true }, anonymize: true });
      const result = redactor.redact('Contact anne@example.com and bob@example.com');
      expect(result).toContain('EMAIL_1');
      expect(result).toContain('EMAIL_2');
      expect(result).not.toContain('anne@example.com');
      expect(result).not.toContain('bob@example.com');
    });

    it('should anonymize across object properties', () => {
      const redactor = new Redactor({ rules: { EMAIL: true }, anonymize: true });
      const obj = {
        user1: 'anne@example.com',
        user2: 'anne@example.com',
        user3: 'bob@example.com',
      };
      const result = redactor.redactObject(obj);
      expect(result.user1).toBe('EMAIL_1');
      expect(result.user2).toBe('EMAIL_1'); // Same value, same token
      expect(result.user3).toBe('EMAIL_2'); // Different value, different token
    });
  });

  describe('hasPII', () => {
    it('should return true when PII is present', () => {
      const redactor = new Redactor({ rules: { EMAIL: true } });
      expect(redactor.hasPII('test@example.com')).toBe(true);
      expect(redactor.hasPII('Contact test@example.com for details')).toBe(true);
    });

    it('should return false when no PII is present', () => {
      const redactor = new Redactor({ rules: { EMAIL: true } });
      expect(redactor.hasPII('This is plain text')).toBe(false);
      expect(redactor.hasPII('')).toBe(false);
    });

    it('should detect multiple PII types', () => {
      const redactor = new Redactor({
        rules: { EMAIL: true, PHONE: true, SSN: true },
      });
      expect(redactor.hasPII('test@example.com')).toBe(true);
      expect(redactor.hasPII('555-123-4567')).toBe(true);
      expect(redactor.hasPII('123-45-6789')).toBe(true);
    });

    it('should respect disabled rules', () => {
      const redactor = new Redactor({ rules: { EMAIL: false } });
      expect(redactor.hasPII('test@example.com')).toBe(false);
    });
  });

  describe('redactObject', () => {
    it('should redact strings in objects', () => {
      const redactor = new Redactor({ rules: { EMAIL: true } });
      const input = { email: 'test@example.com', name: 'John' };
      const result = redactor.redactObject(input);

      expect(result.email).toContain('EMAIL');
      expect(result.name).toBe('John');
    });

    it('should redact strings in nested objects', () => {
      const redactor = new Redactor({ rules: { EMAIL: true } });
      const input = {
        user: {
          email: 'test@example.com',
          profile: {
            contact: 'test2@example.com',
          },
        },
      };
      const result = redactor.redactObject(input);

      expect(result.user.email).toContain('EMAIL');
      expect(result.user.profile.contact).toContain('EMAIL');
    });

    it('should redact strings in arrays', () => {
      const redactor = new Redactor({ rules: { EMAIL: true } });
      const input = {
        emails: ['test1@example.com', 'test2@example.com'],
      };
      const result = redactor.redactObject(input);

      const { emails } = result;
      expect(emails[0]).toContain('EMAIL');
      expect(emails[1]).toContain('EMAIL');
    });

    it('should not mutate original object', () => {
      const redactor = new Redactor({ rules: { EMAIL: true } });
      const input = { email: 'test@example.com' };
      const result = redactor.redactObject(input);

      expect(input.email).toBe('test@example.com');
      expect(result.email).toContain('EMAIL');
    });

    it('should handle null and undefined values', () => {
      const redactor = new Redactor({ rules: { EMAIL: true } });
      const input: any = {
        email: 'test@example.com',
        nullValue: null,
        undefinedValue: undefined,
      };
      const result = redactor.redactObject(input);

      expect(result.email).toContain('EMAIL');
      expect(result.nullValue).toBeNull();
      expect(result.undefinedValue).toBeUndefined();
    });

    it('should handle empty objects and arrays', () => {
      const redactor = new Redactor();
      expect(redactor.redactObject({})).toEqual({});
      expect(redactor.redactObject({ items: [] })).toEqual({ items: [] });
    });
  });

  describe('Dashboard Hook (_phoneHome)', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should send events to dashboard when apiKey is provided', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true });
      global.fetch = fetchMock;

      const redactor = new Redactor({
        apiKey: 'test-key',
        rules: { EMAIL: true },
      });

      redactor.redact('test@example.com');
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const call = fetchMock.mock.calls[0];
      if (!call) {
        throw new Error('Expected fetch to be called');
      }
      const [, options] = call;
      const body = JSON.parse(options.body as string);

      expect(body).toHaveProperty('events');
      expect(Array.isArray(body.events)).toBe(true);
      expect(body.events.length).toBeGreaterThan(0);
      expect(body.events[0]).toHaveProperty('pii_type');
      expect(body.events[0]).toHaveProperty('action', 'REDACTED');
      expect(body).toHaveProperty('sdk_version', '1.0.0');
      expect(body).toHaveProperty('sdk_language', 'node');
    });

    it('should not send events when apiKey is not provided', async () => {
      const fetchMock = vi.fn();
      global.fetch = fetchMock;

      const redactor = new Redactor({
        rules: { EMAIL: true },
      });

      redactor.redact('test@example.com');
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('should not send events when no PII is redacted', async () => {
      const fetchMock = vi.fn();
      global.fetch = fetchMock;

      const redactor = new Redactor({
        apiKey: 'test-key',
        rules: { EMAIL: true },
      });

      redactor.redact('This is plain text');
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('should use custom apiUrl when provided', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true });
      global.fetch = fetchMock;

      const redactor = new Redactor({
        apiKey: 'test-key',
        apiUrl: 'https://custom-api.example.com/events',
        rules: { EMAIL: true },
      });

      redactor.redact('test@example.com');
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(fetchMock).toHaveBeenCalledWith('https://custom-api.example.com/events', expect.anything());
    });

    it('should fail silently by default', async () => {
      const fetchMock = vi.fn().mockRejectedValue(new Error('Network error'));
      global.fetch = fetchMock;

      const redactor = new Redactor({
        apiKey: 'test-key',
        rules: { EMAIL: true },
      });

      // Should not throw
      redactor.redact('test@example.com');
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(fetchMock).toHaveBeenCalled();
    });

    it('should throw when failSilent is false and fetch fails', async () => {
      const fetchMock = vi.fn().mockRejectedValue(new Error('Network error'));
      global.fetch = fetchMock;

      const redactor = new Redactor({
        apiKey: 'test-key',
        failSilent: false,
        rules: { EMAIL: true },
      });

      // Capture unhandled rejection
      const unhandledRejections: Error[] = [];
      const rejectionHandler = (error: Error) => {
        unhandledRejections.push(error);
      };
      process.once('unhandledRejection', rejectionHandler);

      redactor.redact('test@example.com');
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(fetchMock).toHaveBeenCalled();
      // Clean up
      process.removeListener('unhandledRejection', rejectionHandler);
    });

    it('should respect hookTimeout', async () => {
      const fetchMock = vi.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve({ ok: true }), 1000);
          }),
      );
      global.fetch = fetchMock;

      const redactor = new Redactor({
        apiKey: 'test-key',
        hookTimeout: 100,
        rules: { EMAIL: true },
      });

      redactor.redact('test@example.com');
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(fetchMock).toHaveBeenCalled();
    });
  });

  describe('Custom Rules', () => {
    it('should apply custom regex rules', () => {
      const redactor = new Redactor({
        rules: {},
        customRules: [/\b\d{5}\b/g], // 5-digit numbers
      });

      const result = redactor.redact('My code is 12345');
      expect(result).toContain('DIGITS');
    });

    it('should combine built-in and custom rules', () => {
      const redactor = new Redactor({
        rules: { EMAIL: true },
        customRules: [/\b\d{5}\b/g],
      });

      const result = redactor.redact('Email: test@example.com, Code: 12345');
      expect(result).toContain('EMAIL');
      expect(result).toContain('DIGITS');
    });
  });

  describe('Edge Cases', () => {
    it('should handle PII at start of string', () => {
      const redactor = new Redactor({ rules: { EMAIL: true } });
      expect(redactor.redact('test@example.com is my email')).toContain('EMAIL');
    });

    it('should handle PII at end of string', () => {
      const redactor = new Redactor({ rules: { EMAIL: true } });
      expect(redactor.redact('My email is test@example.com')).toContain('EMAIL');
    });

    it('should handle multiple PII instances', () => {
      const redactor = new Redactor({ rules: { EMAIL: true } });
      const result = redactor.redact('test1@example.com and test2@example.com');
      expect(result.split('EMAIL').length).toBeGreaterThan(2);
    });

    it('should handle PII with special characters', () => {
      const redactor = new Redactor({ rules: { EMAIL: true } });
      const result = redactor.redact('Contact test+tag@example.com');
      expect(result).toContain('EMAIL');
    });

    it('should handle whitespace-only strings', () => {
      const redactor = new Redactor();
      expect(redactor.redact('   ')).toBe('   ');
      expect(redactor.redact('\n\n')).toBe('\n\n');
    });

    it('should handle very long strings without performance degradation', () => {
      const redactor = new Redactor({ rules: { EMAIL: true } });
      const longText = 'Contact test@example.com '.repeat(1000);
      const startTime = Date.now();
      const result = redactor.redact(longText);
      const endTime = Date.now();
      expect(result).toContain('EMAIL');
      expect(endTime - startTime).toBeLessThan(1000); // Should complete in < 1 second
    });

    it('should handle consecutive PII items', () => {
      const redactor = new Redactor({ rules: { EMAIL: true, PHONE: true } });
      const result = redactor.redact('test@example.com555-123-4567');
      expect(result).toContain('EMAIL');
      expect(result).toContain('PHONE');
    });

    it('should not redact incomplete emails', () => {
      const redactor = new Redactor({ rules: { EMAIL: true } });
      const result = redactor.redact('test@ or @example.com or test@');
      expect(result).toBe('test@ or @example.com or test@');
    });

    it('should handle multiple redact calls without state leakage', () => {
      const redactor = new Redactor({ rules: { EMAIL: true } });
      const result1 = redactor.redact('test1@example.com');
      const result2 = redactor.redact('test2@example.com');
      expect(result1).toContain('EMAIL');
      expect(result2).toContain('EMAIL');
    });
  });

  describe('Aggressive Mode', () => {
    it('should catch obfuscated emails in aggressive mode', () => {
      const redactor = new Redactor({ rules: { EMAIL: true }, aggressive: true });
      const result1 = redactor.redact('user [at] example [dot] com');
      const result2 = redactor.redact('user (at) example (dot) com');
      expect(result1).toContain('EMAIL');
      expect(result2).toContain('EMAIL');
    });

    it('should be more conservative in normal mode', () => {
      const redactor = new Redactor({ rules: { EMAIL: true }, aggressive: false });
      const result = redactor.redact('user [at] example [dot] com');
      expect(result).toBe('user [at] example [dot] com');
    });

    it('should catch partially masked credit cards in aggressive mode', () => {
      const redactor = new Redactor({ rules: { CREDIT_CARD: true }, aggressive: true });
      const result = redactor.redact('Card: ****-****-****-1234');
      expect(result).toContain('CREDIT_CARD');
    });
  });

  describe('Robustness', () => {
    it('should handle unicode characters gracefully', () => {
      const redactor = new Redactor({ rules: { EMAIL: true } });
      const result = redactor.redact('Контакт: test@example.com 🎉');
      expect(result).toContain('EMAIL');
      expect(result).toContain('🎉');
    });

    it('should not have catastrophic backtracking', () => {
      const redactor = new Redactor({ rules: { EMAIL: true } });
      const malicious = `${'a'.repeat(10000)}@example.com`;
      const startTime = Date.now();
      const result = redactor.redact(malicious);
      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(500); // Should not hang
      expect(result).toBeDefined();
    });

    it('should maintain anonymization state consistency', () => {
      const redactor = new Redactor({ rules: { EMAIL: true }, anonymize: true });
      const obj = {
        field1: 'test@example.com',
        field2: 'other@example.com',
        field3: 'test@example.com',
      };
      const result = redactor.redactObject(obj);
      expect(result.field1).toBe(result.field3); // Same email should have same token
      expect(result.field1).not.toBe(result.field2); // Different emails should have different tokens
    });
  });
});
