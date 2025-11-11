# @redactpii/node

[![NPM Package](https://badge.fury.io/js/%40redactpii%2Fnode.svg)](https://www.npmjs.com/package/@redactpii/node)

> **⚡ Simple, local, offline-only PII redaction. Zero dependencies. Works completely standalone.**

A simple, local, offline PII redaction tool. Works perfectly without any API keys or external services.

## 🎯 Simple & Local First

**This tool works 100% offline, locally, with zero external dependencies.** No API keys required. No internet connection needed. Everything runs on your machine.

## ⚡ Zero Dependencies. Blazing Fast. Works Offline.

- **<1ms per operation** - Optimized regex engine
- **Zero external dependencies** - Pure TypeScript, no bloat
- **100% local & offline** - Works without internet or API keys
- **TypeScript first** - Full type safety and IDE support

### Requirements

- **Node.js 18+** (for native `fetch` support)
- **TypeScript 5.0+** (optional, but recommended)
- **Zero dependencies** (seriously, check your lockfile)

## 🚀 Installation & Usage

```bash
npm install @redactpii/node
# or
pnpm add @redactpii/node
# or
yarn add @redactpii/node
```

### 🔥 Basic Usage

```typescript
import { Redactor } from '@redactpii/node';

// Works completely offline - no API keys, no internet needed
const redactor = new Redactor();
const clean = redactor.redact('Hi David Johnson, call 555-555-5555');

// Result: "Hi PERSON_NAME, call PHONE_NUMBER"
```

That's it! Everything runs locally on your machine.

### 🎯 PII Detection

Built-in patterns for:

- **👤 Names** - Person identification (greeting-based detection)
- **📧 Emails** - Email addresses
- **📞 Phones** - US phone numbers (all formats)
- **💳 Credit Cards** - Visa, Mastercard, Amex, Diners Club
- **🆔 SSN** - US Social Security Numbers

### 🔍 Check for PII Without Redacting

```typescript
const redactor = new Redactor({ rules: { EMAIL: true } });

if (redactor.hasPII('Contact test@example.com for details')) {
  console.log('PII detected!');
  // Now redact it
  const clean = redactor.redact('Contact test@example.com for details');
}
```

### 📦 Redact Objects

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

### 🤖 Using with LLMs (OpenAI, LangChain)

Protect PII **before** it hits AI APIs.

<details>
<summary><b>Example: Using with OpenAI Client</b></summary>

```typescript
import { Redactor } from '@redactpii/node';
import OpenAI from 'openai';

const redactor = new Redactor({
  rules: { SSN: true, EMAIL: true },
});

const openai = new OpenAI();

// 1. Redact the prompt BEFORE you send it
const rawPrompt = 'My SSN is 123-45-6789 and my email is test@example.com';
const safePrompt = redactor.redact(rawPrompt);

// 2. Send the "safe" prompt to the LLM
const completion = await openai.chat.completions.create({
  messages: [{ role: 'user', content: safePrompt }],
  model: 'gpt-4o',
});
```

</details>

<details>
<summary><b>Example: Using with LangChain</b></summary>

```typescript
import { Redactor } from '@redactpii/node';
import { ChatOpenAI } from '@langchain/openai';

const redactor = new Redactor({ rules: { EMAIL: true } });
const model = new ChatOpenAI();

// Create a "runnable" middleware to redact input
const redactingMiddleware = (input: { query: string }) => {
  if (redactor.hasPII(input.query)) {
    const safeQuery = redactor.redact(input.query);
    return { ...input, query: safeQuery };
  }
  return input;
};

// Build your chain
const chain = redactingMiddleware.pipe(model);
// ... etc

// Run the chain with PII
const result = await chain.invoke({ query: 'My email is john@acme.com' });
```

</details>

### 🎨 Customization

#### Configure Rules

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

#### Custom Regex Patterns

```typescript
const redactor = new Redactor({
  rules: { EMAIL: true },
  customRules: [
    /\b\d{5}\b/g, // 5-digit codes
    /\bSECRET-\d+\b/g, // Secret codes
  ],
});
```

#### Global Replacement

```typescript
const redactor = new Redactor({
  rules: { EMAIL: true },
  globalReplaceWith: '[REDACTED]', // All PII types use this replacement
});

redactor.redact('test@example.com'); // "[REDACTED]"
```

#### Anonymization with Unique IDs

Replace the same PII value with the same token throughout the text. Perfect for preserving relationships while protecting privacy.

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

#### Aggressive Mode

More permissive patterns to catch obfuscated or unusual PII formatting.

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

### ❓ FAQ & Limitations

**Is this regex-based?**  
Yes, this library uses regex patterns for detection. It's fast and works offline, but has limitations.

**How does it handle misspellings or improperly formatted data?**  
It catches misspellings if the format is still valid (e.g., "jhon@example.com" would be detected because it's still a valid email format). However, it won't catch obfuscated or non-standard formats like "john at example dot com" or "john[at]example[dot]com" unless you enable `aggressive: true` mode, which uses more permissive patterns.

**What determines what counts as PII?**  
The built-in patterns cover common, obvious PII types (emails, SSNs, credit cards, phone numbers, names in greetings). These are based on standard formats, not a specific compliance framework. For your specific needs, use `customRules` to add domain-specific patterns.

**Anonymization vs Redaction?**  
By default, this library does **redaction** (replacement with labels like `EMAIL_ADDRESS`). However, you can enable **anonymization** by setting `anonymize: true`, which replaces the same PII value with the same unique token (e.g., `EMAIL_1`, `EMAIL_2`) throughout the text, preserving relationships while protecting privacy.

**When should I use this?**

- ✅ Quick redaction of well-formatted, standard PII
- ✅ Pre-processing before sending data to LLMs/APIs
- ✅ Simple compliance needs where redaction is sufficient
- ❌ Complex anonymization requirements
- ❌ Handling messy/unstructured data with misspellings
- ❌ Need for reversible anonymization

## 🧪 Quality Assurance

- **34 comprehensive tests** covering all APIs and edge cases
- **100% TypeScript** with strict mode
- **Zero unsafe operations** - full type safety
- **Pre-commit hooks** - automatic linting and type checking

### 🏃‍♂️ Development

```bash
# Install dependencies
pnpm install

# Run tests
pnpm test

# Run with coverage
pnpm run coverage

# Type checking
pnpm run typecheck

# Linting
pnpm run lint

# Full verification suite
pnpm run verify_all

# Build for production
pnpm run build
```

### 🤝 Contributing

We welcome contributions! This library powers PII redaction for thousands of applications.

---

**Simple, local, offline PII redaction. Works standalone.**
