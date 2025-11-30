# @redactpii/node

[![NPM Package](https://badge.fury.io/js/%40redactpii%2Fnode.svg)](https://www.npmjs.com/package/@redactpii/node)

> **🔒 Simple PII redaction library for Node.js**

A fast, zero-dependency library that redacts PII from text using regex patterns. Works completely offline. No API keys, no setup, just install and use.

## 🚀 Installation

```bash
npm install @redactpii/node
# or
pnpm add @redactpii/node
# or
yarn add @redactpii/node
```

## 🔥 Quick Start

```typescript
import { Redactor } from '@redactpii/node';

const redactor = new Redactor();
const clean = redactor.redact('Hi David Johnson, call 555-555-5555');
// Result: "Hi PERSON_NAME, call PHONE_NUMBER"
```

## 🎯 Built-in PII Detection Patterns

The library includes regex patterns for:

- **👤 Names** - Person identification (greeting-based detection)
- **📧 Emails** - Email addresses
- **📞 Phones** - US phone numbers (all formats)
- **💳 Credit Cards** - Visa, Mastercard, Amex, Diners Club
- **🆔 SSN** - US Social Security Numbers

## 🔍 Check for PII Without Redacting

```typescript
const redactor = new Redactor({ rules: { EMAIL: true } });

if (redactor.hasPII('Contact test@example.com for details')) {
  console.log('PII detected!');
  const clean = redactor.redact('Contact test@example.com for details');
}
```

## 📦 Redact Objects

```typescript
const redactor = new Redactor({ rules: { EMAIL: true } });

const user = {
  name: 'John Doe',
  email: 'john@example.com',
  profile: {
    contact: 'contact@example.com',
  },
};

const clean = redactor.redactObject(user);
// {
//   name: 'John Doe',
//   email: 'EMAIL_ADDRESS',
//   profile: {
//     contact: 'EMAIL_ADDRESS',
//   },
// }
```

## 🎨 Customization

### Configure Rules

Enable or disable specific PII detection patterns:

```typescript
const redactor = new Redactor({
  rules: {
    CREDIT_CARD: true, // Enable credit card detection
    EMAIL: true, // Enable email detection
    NAME: false, // Disable name detection
    PHONE: true, // Enable phone detection
    SSN: false, // Disable SSN detection
  },
});
```

### Custom Regex Patterns

Add your own regex patterns for domain-specific PII:

```typescript
const redactor = new Redactor({
  rules: { EMAIL: true },
  customRules: [
    /\b\d{5}\b/g, // 5-digit codes
    /\bSECRET-\d+\b/g, // Secret codes
  ],
});
```

### Global Replacement

Use a single replacement string for all PII types:

```typescript
const redactor = new Redactor({
  rules: { EMAIL: true },
  globalReplaceWith: '[REDACTED]', // All PII types use this replacement
});

redactor.redact('test@example.com'); // "[REDACTED]"
```

### Anonymization with Unique IDs

Replace the same PII value with the same token throughout the text:

```typescript
const redactor = new Redactor({
  rules: { EMAIL: true, NAME: true },
  anonymize: true, // Enable anonymization
});

// Same email gets same token
const text = 'Contact anne@example.com. Anne also uses anne@example.com for work.';
const result = redactor.redact(text);
// Result: "Contact EMAIL_1. PERSON_1 also uses EMAIL_1 for work."

// Works across objects too
const user = {
  primary: 'anne@example.com',
  backup: 'anne@example.com', // Same value → same token
  contact: 'bob@example.com', // Different value → different token
};
const clean = redactor.redactObject(user);
// {
//   primary: 'EMAIL_1',
//   backup: 'EMAIL_1',    // Same as primary
//   contact: 'EMAIL_2'    // Different token
// }
```

### Aggressive Mode

Use more permissive regex patterns to catch obfuscated or unusual PII formatting:

```typescript
const redactor = new Redactor({
  rules: { EMAIL: true, CREDIT_CARD: true },
  aggressive: true, // Enable aggressive mode
});

// Catches obfuscated emails
redactor.redact('user [at] example [dot] com');
// Result: "EMAIL_ADDRESS"

// Catches partially masked credit cards
redactor.redact('Card ending in ****-****-****-1234');
// Result: "Card ending in CREDIT_CARD_NUMBER"

// Normal mode (aggressive: false) is more conservative
// and won't catch these variations
```

## ❓ FAQ

**Is this regex-based?**  
Yes, this library uses regex patterns for detection. It's fast and works offline, but has limitations.

**How does it handle misspellings or improperly formatted data?**  
It catches misspellings if the format is still valid (e.g., "jhon@example.com" would be detected because it's still a valid email format). However, it won't catch obfuscated or non-standard formats like "john at example dot com" or "john[at]example[dot]com" unless you enable `aggressive: true` mode, which uses more permissive patterns.

**What determines what counts as PII?**  
The built-in patterns cover common, obvious PII types (emails, SSNs, credit cards, phone numbers, names in greetings). These are based on standard formats, not a specific compliance framework. For your specific needs, use `customRules` to add domain-specific patterns.

**Anonymization vs Redaction?**  
By default, this library does **redaction** (replacement with labels like `EMAIL_ADDRESS`). However, you can enable **anonymization** by setting `anonymize: true`, which replaces the same PII value with the same unique token (e.g., `EMAIL_1`, `EMAIL_2`) throughout the text, preserving relationships while protecting privacy.
