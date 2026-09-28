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
// Result: "PERSON_NAME, call PHONE_NUMBER"
```

## 🎯 Built-in PII Detection Patterns

The library includes regex patterns for:

- **👤 Names** - Full names that follow a greeting ("Hi Jane Doe", "Dear Jane Doe"). Names elsewhere in text are not detected.
- **📧 Emails** - Email addresses, including plus-addressing (`jane+news@example.com`) and non-ASCII addresses (`müller@example.de`)
- **📞 Phones** - US phone numbers (`555-123-4567`, `(555) 123-4567`, `+1 555 123 4567`)
- **💳 Credit Cards** - Visa, Mastercard, Amex, Diners Club
- **🆔 SSN** - US Social Security Numbers

## 🤖 Use with AI APIs

Redact user data before sending it to OpenAI, Anthropic, or any other LLM provider:

```typescript
import { Redactor } from '@redactpii/node';
import OpenAI from 'openai';

const redactor = new Redactor();
const openai = new OpenAI();

// Redact before sending to OpenAI
const userMessage = 'Hi, my email is john@example.com and my phone is 555-123-4567';
const cleanMessage = redactor.redact(userMessage);
// "Hi, my email is EMAIL_ADDRESS and my phone is PHONE_NUMBER"

const response = await openai.responses.create({
  model: 'gpt-5.6',
  input: cleanMessage,
});
```

Works with any API that accepts JSON:

```typescript
// Redact entire request payloads
const apiRequest = {
  user: {
    name: 'John Doe',
    email: 'john@example.com',
    notes: 'Call me at 555-123-4567',
  },
};

const cleanRequest = redactor.redactObject(apiRequest);
// { user: { name: 'John Doe', email: 'EMAIL_ADDRESS', notes: 'Call me at PHONE_NUMBER' } }
// Only string values are redacted; keys are left as-is. `name` is not redacted
// because name detection only looks for names after a greeting.
```

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

Add your own regex patterns for domain-specific PII. Every match is redacted, whether or not the pattern has the `g` flag; custom matches are replaced with `DIGITS`:

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

// Same value gets same token
const text = 'Hi Anne Smith, your login is anne@example.com and your backup is bob@example.com. Hi Anne Smith again.';
const result = redactor.redact(text);
// Result: "PERSON_1, your login is EMAIL_1 and your backup is EMAIL_2. PERSON_1 again."

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

**What doesn't it catch?**  
International phone numbers, SSNs without separators (`123456789`), names outside a greeting, addresses, and dates of birth. Use `customRules` for these, or pair this library with an ML-based detector if you need recall beyond fixed formats.

**Is it safe on untrusted input?**  
Yes. Every built-in pattern runs in linear time. Long tokens, JWTs, and log lines don't cause catastrophic backtracking. Your own `customRules` are not checked for this, so write them carefully.

**What determines what counts as PII?**  
The built-in patterns cover common, obvious PII types (emails, SSNs, credit cards, phone numbers, names in greetings). These are based on standard formats, not a specific compliance framework. For your specific needs, use `customRules` to add domain-specific patterns.

**Anonymization vs Redaction?**  
By default, this library does **redaction** (replacement with labels like `EMAIL_ADDRESS`). With `anonymize: true`, the same value gets the same token (`EMAIL_1`, `EMAIL_2`) within one `redact()` or `redactObject()` call. Token numbering restarts on each call, so `EMAIL_1` in two different calls can refer to different addresses.
