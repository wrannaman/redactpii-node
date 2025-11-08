# @redactpii/node

[![NPM Package](https://badge.fury.io/js/%40redactpii%2Fnode.svg)](https://www.npmjs.com/package/@redactpii/node)

> **⚡ Zero-dependency, blazing-fast regex-based PII redaction with optional compliance dashboard integration.**

Built for the modern AI stack. Protect PII **before** it hits OpenAI, Anthropic, or LangChain with **optional dashboard integration** for SOC 2 & HIPAA audit trails.

## ⚡ Zero Dependencies. Blazing Fast. Enterprise Ready.

- **<1ms per operation** - Optimized regex engine
- **Zero external dependencies** - Pure TypeScript, no bloat
- **Dashboard integration** - SOC 2/HIPAA audit trails (optional)
- **Zero-trust security** - Never sends PII, only metadata
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

const redactor = new Redactor();
const clean = redactor.redact('Hi David Johnson, call 555-555-5555');

// Result: "Hi PERSON_NAME, call PHONE_NUMBER"
```

### 🛡️ Enterprise Compliance (SOC 2/HIPAA Ready)

Enable **optional dashboard integration** for audit trails:

```typescript
import { Redactor } from '@redactpii/node';

const redactor = new Redactor({
  apiKey: process.env.REDACTPII_API_KEY, // Enables compliance dashboard
  apiUrl: 'https://api.redactpii.com/v1/events', // Your audit endpoint (optional)
  rules: {
    CREDIT_CARD: true,
    EMAIL: true,
    NAME: true,
    PHONE: true,
    SSN: true,
  },
});

const clean = redactor.redact('CEO john@acme.com called from 555-123-4567 with SSN 123-45-6789');

// Result: "CEO EMAIL_ADDRESS called from PHONE_NUMBER with SSN US_SOCIAL_SECURITY_NUMBER"

// 🔒 Zero-trust: Only metadata sent to dashboard
// 📊 Audit log: { "sdk_version": "1.0.0", "pii_type": "EMAIL", "action": "REDACTED" }
```

> **🔐 Zero-Trust Guarantee**: Never sends actual PII data. Only anonymized metadata for compliance reporting. Non-blocking requests with 500ms timeout - never impacts your app performance.

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

Protect PII **before** it hits AI APIs. This is your compliance safety net.

<details>
<summary><b>Example: Using with OpenAI Client</b></summary>

```typescript
import { Redactor } from '@redactpii/node';
import OpenAI from 'openai';

const redactor = new Redactor({
  apiKey: process.env.REDACTPII_API_KEY,
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

// 3. Your audit log on redactpii.com now has proof
//    of the redaction *before* it hit OpenAI.
```

</details>

<details>
<summary><b>Example: Using with LangChain</b></summary>

```typescript
import { Redactor } from '@redactpii/node';
import { ChatOpenAI } from '@langchain/openai';

// 1. Init the redactor with your dashboard API key
const redactor = new Redactor({ apiKey: process.env.REDACTPII_API_KEY });
const model = new ChatOpenAI();

// 2. Create a "runnable" middleware to redact input
const redactingMiddleware = (input: { query: string }) => {
  if (redactor.hasPII(input.query)) {
    // Redact the input and log it to your dashboard
    const safeQuery = redactor.redact(input.query);
    return { ...input, query: safeQuery };
  }
  return input;
};

// 3. Build your chain
const chain = redactingMiddleware.pipe(model);
// ... etc

// 4. Run the chain with PII
const result = await chain.invoke({ query: 'My email is john@acme.com' });

// Your prompt was safely redacted before hitting the LLM.
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

### 🛡️ Dashboard Hook Configuration

```typescript
const redactor = new Redactor({
  apiKey: 'your-api-key',
  apiUrl: 'https://api.redactpii.com/v1/events', // Optional, defaults to this
  failSilent: true, // Default: true (fail silently if dashboard is down)
  hookTimeout: 500, // Default: 500ms timeout for dashboard requests
  rules: { EMAIL: true },
});
```

**Dashboard Payload:**

```json
{
  "sdk_version": "1.0.0",
  "sdk_language": "node",
  "events": [
    { "pii_type": "EMAIL", "action": "REDACTED" },
    { "pii_type": "PHONE_NUMBER", "action": "REDACTED" }
  ]
}
```

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

We welcome contributions! This library powers compliance for thousands of applications.

---

**Built for the modern AI stack with optional SOC 2/HIPAA audit logs.**
