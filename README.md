# @redactpii/node

[![NPM Package](https://badge.fury.io/js/%40redactpii%2Fnode.svg)](https://www.npmjs.com/package/@redactpii/node)

> **🔒 Enterprise-grade PII redaction with SOC 2 & HIPAA-compliant audit logging. Free SDK + paid dashboard.**

A production-ready PII redaction SDK with optional compliance dashboard integration. The SDK works completely offline, but when configured with an API key, automatically sends audit logs to your RedactPII dashboard for SOC 2, HIPAA, and compliance reporting.

## 🎯 Built for Compliance Teams

**This is a "Picks and Shovels" tool for CTOs and compliance officers who need audit logs**

- **Free SDK** - Works 100% offline, zero dependencies, blazing fast
- **Paid Dashboard** - SOC 2 & HIPAA-compliant audit logging, compliance reports, and analytics
- **Zero Trust** - SDK works offline; dashboard is optional but required for compliance

### The Model (Like Snyk/Sentry)

1. **Free SDK** - Install and use locally, works offline
2. **Optional Dashboard** - Add your `apiKey` to enable audit logging
3. **Compliance Reports** - View all redaction events in your dashboard for audits

## ⚡ Zero Dependencies. Blazing Fast. Works Offline.

- **<1ms per operation** - Optimized regex engine
- **Zero external dependencies** - Pure TypeScript, no bloat
- **100% local & offline** - SDK works without internet or API keys
- **TypeScript first** - Full type safety and IDE support
- **Optional dashboard** - Add `apiKey` to enable compliance audit logging

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

### 🔥 Basic Usage (Offline Mode)

The SDK works completely offline. No API key required for local redaction:

```typescript
import { Redactor } from '@redactpii/node';

// Works completely offline - no API keys, no internet needed
const redactor = new Redactor();
const clean = redactor.redact('Hi David Johnson, call 555-555-5555');

// Result: "Hi PERSON_NAME, call PHONE_NUMBER"
```

### 🔒 Dashboard Integration (Compliance Mode)

Add your `apiKey` to enable automatic audit logging to your RedactPII dashboard:

```typescript
import { Redactor } from '@redactpii/node';

// Configure with API key for compliance audit logging
const redactor = new Redactor({
  apiKey: process.env.REDACTPII_API_KEY, // Get from https://redactpii.com/dashboard
  // Optional: custom dashboard endpoint
  // apiUrl: 'https://api.redactpii.com/v1/events',
});

// All redaction events are automatically logged to your dashboard
const clean = redactor.redact('Contact john@example.com for details');
// → Redacts locally AND sends audit log to dashboard
```

**Why Dashboard Integration?**

- **SOC 2 Compliance** - Complete audit trail of all PII redaction events
- **HIPAA Compliance** - Track access and redaction of protected health information
- **Compliance Reports** - Generate reports for auditors
- **Analytics** - Understand PII patterns in your data
- **Security** - Monitor redaction activity across your organization

**Get Your API Key:** [https://redactpii.com/dashboard](https://redactpii.com/dashboard)

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
  apiKey: process.env.REDACTPII_API_KEY, // Optional: enable audit logging
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

const redactor = new Redactor({
  apiKey: process.env.REDACTPII_API_KEY, // Optional: enable audit logging
  rules: { EMAIL: true },
});
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
  apiKey: process.env.REDACTPII_API_KEY, // Optional
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
  apiKey: process.env.REDACTPII_API_KEY, // Optional
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
  apiKey: process.env.REDACTPII_API_KEY, // Optional
  rules: { EMAIL: true },
  globalReplaceWith: '[REDACTED]', // All PII types use this replacement
});

redactor.redact('test@example.com'); // "[REDACTED]"
```

#### Anonymization with Unique IDs (Pro Feature)

Replace the same PII value with the same token throughout the text. Perfect for preserving relationships while protecting privacy.

**Note:** This is a premium feature. For production use with anonymization, upgrade to a paid plan.

```typescript
const redactor = new Redactor({
  apiKey: process.env.REDACTPII_API_KEY, // Required for Pro features
  rules: { EMAIL: true, NAME: true },
  anonymize: true, // Enable anonymization (Pro feature)
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
  apiKey: process.env.REDACTPII_API_KEY, // Optional
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

### 🔧 Dashboard Configuration Options

```typescript
const redactor = new Redactor({
  // Required for dashboard integration
  apiKey: process.env.REDACTPII_API_KEY,

  // Optional: custom dashboard endpoint
  apiUrl: 'https://api.redactpii.com/v1/events',

  // Optional: fail silently if dashboard is unavailable (default: true)
  failSilent: true,

  // Optional: timeout for dashboard requests in ms (default: 500)
  hookTimeout: 500,
});
```

**Dashboard Behavior:**

- **Fire-and-forget** - Dashboard calls are asynchronous and non-blocking
- **Fail silently by default** - SDK continues working even if dashboard is down
- **Fast timeout** - 500ms default timeout ensures no performance impact
- **Zero impact on SDK** - Dashboard failures never affect local redaction

### ❓ FAQ & Limitations

**Is this regex-based?**  
Yes, this library uses regex patterns for detection. It's fast and works offline, but has limitations.

**How does it handle misspellings or improperly formatted data?**  
It catches misspellings if the format is still valid (e.g., "jhon@example.com" would be detected because it's still a valid email format). However, it won't catch obfuscated or non-standard formats like "john at example dot com" or "john[at]example[dot]com" unless you enable `aggressive: true` mode, which uses more permissive patterns.

**What determines what counts as PII?**  
The built-in patterns cover common, obvious PII types (emails, SSNs, credit cards, phone numbers, names in greetings). These are based on standard formats, not a specific compliance framework. For your specific needs, use `customRules` to add domain-specific patterns.

**Anonymization vs Redaction?**  
By default, this library does **redaction** (replacement with labels like `EMAIL_ADDRESS`). However, you can enable **anonymization** by setting `anonymize: true`, which replaces the same PII value with the same unique token (e.g., `EMAIL_1`, `EMAIL_2`) throughout the text, preserving relationships while protecting privacy. Anonymization is a Pro feature.

**Do I need the dashboard?**  
No! The SDK works 100% offline. The dashboard is optional but **required for compliance** (SOC 2, HIPAA). If you need audit logs for compliance, add your `apiKey`. If you're just doing local redaction, you don't need it.

**What data is sent to the dashboard?**  
Only metadata about redaction events (PII type, action, timestamp). **No actual PII data is ever sent to the dashboard.** The SDK redacts locally and only sends event metadata.

**When should I use this?**

- ✅ Quick redaction of well-formatted, standard PII
- ✅ Pre-processing before sending data to LLMs/APIs
- ✅ Compliance needs requiring audit logs (with dashboard)
- ✅ SOC 2 & HIPAA compliance (requires dashboard)
- ❌ Complex anonymization requirements (requires Pro plan)
- ❌ Handling messy/unstructured data with misspellings
- ❌ Need for reversible anonymization

## 🧪 Quality Assurance

- **34+ comprehensive tests** covering all APIs and edge cases
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

## 💼 Business Model

**Free SDK + Paid Dashboard** (Like Snyk/Sentry)

- **SDK is free** - Use it offline, no restrictions
- **Dashboard is paid** - Required for compliance audit logs
- **Pro features** - Anonymization and advanced features require paid plan

**Get Started:** <https://redactpii.com/dashboard>

**Enterprise-grade PII redaction with SOC 2 & HIPAA-compliant audit logging.**
