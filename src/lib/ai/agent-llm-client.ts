import "server-only";
import type { ZodType } from "zod";

export type ProviderName = "gemini" | "groq" | "qwen" | "openrouter";

type ProviderDef = {
  baseUrl: string;
  keysEnv: string;
  modelEnv: string;
  defaultModel: string;
};

// All four providers expose an OpenAI-compatible /chat/completions endpoint,
// so one generic adapter serves all of them — no per-vendor SDKs needed.
// Model IDs and free-tier limits change often; override via the *_MODEL env
// vars below rather than editing this file.
const PROVIDER_DEFS: Record<ProviderName, ProviderDef> = {
  gemini: {
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    keysEnv: "GEMINI_API_KEYS",
    modelEnv: "GEMINI_MODEL",
    // "gemini-2.0-flash" has zero free-tier quota for new accounts as of
    // this build (verified live) — "-latest" aliases track whatever's
    // current, so prefer those over pinned version numbers here.
    defaultModel: "gemini-flash-latest",
  },
  groq: {
    baseUrl: "https://api.groq.com/openai/v1",
    keysEnv: "GROQ_API_KEYS",
    modelEnv: "GROQ_MODEL",
    defaultModel: "llama-3.3-70b-versatile",
  },
  qwen: {
    baseUrl: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
    keysEnv: "QWEN_API_KEYS",
    modelEnv: "QWEN_MODEL",
    defaultModel: "qwen-plus",
  },
  openrouter: {
    baseUrl: "https://openrouter.ai/api/v1",
    keysEnv: "OPENROUTER_API_KEYS",
    modelEnv: "OPENROUTER_MODEL",
    defaultModel: "meta-llama/llama-3.3-70b-instruct:free",
  },
};

type ProviderConfig = {
  name: ProviderName;
  baseUrl: string;
  model: string;
  keys: string[];
};

function loadProviders(env: NodeJS.ProcessEnv = process.env): ProviderConfig[] {
  const order = (env.AI_PROVIDERS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean) as ProviderName[];

  const configs: ProviderConfig[] = [];
  for (const name of order) {
    const def = PROVIDER_DEFS[name];
    if (!def) continue;
    const keys = (env[def.keysEnv] ?? "")
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);
    if (keys.length === 0) continue;
    configs.push({
      name,
      baseUrl: def.baseUrl,
      model: env[def.modelEnv] || def.defaultModel,
      keys,
    });
  }
  return configs;
}

/** Every (provider, key index) pair across all configured providers, in fallback order. */
function flattenAttempts(providers: ProviderConfig[]) {
  return providers.flatMap((p) => p.keys.map((key, keyIndex) => ({ provider: p, key, keyIndex })));
}

type RetryableReason = "rate_limited" | "unauthorized" | "server_error" | "network_error";

class RetryableError extends Error {
  constructor(public reason: RetryableReason) {
    super(reason);
  }
}

function classifyStatus(status: number): RetryableReason | null {
  if (status === 429) return "rate_limited";
  if (status === 401 || status === 403) return "unauthorized";
  if (status >= 500) return "server_error";
  return null;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function backoffMs(attemptIndex: number) {
  return Math.min(250 * 2 ** attemptIndex, 2000);
}

/** Failover events, for server-side observability. Never includes key material — only the key's position in its provider's list. */
export type FailoverEvent = {
  provider: ProviderName;
  keyIndex: number;
  reason: string;
};

function logFailover(event: FailoverEvent) {
  console.warn(
    `[agent-llm-client] failover: provider=${event.provider} keyIndex=${event.keyIndex} reason=${event.reason}`,
  );
}

async function callChatCompletion(
  provider: ProviderConfig,
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
) {
  const res = await fetch(`${provider.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: provider.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    const reason = classifyStatus(res.status);
    if (reason) throw new RetryableError(reason);
    const body = await res.text().catch(() => "");
    throw new Error(`Non-retryable error from ${provider.name}: ${res.status} ${body.slice(0, 200)}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error(`Unexpected response shape from ${provider.name}`);
  }
  return content;
}

function extractJson(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    const match = content.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error("Response was not valid JSON");
  }
}

const MAX_TOTAL_ATTEMPTS = 6;
const MAX_MALFORMED_RETRIES = 2;

/**
 * Runs a structured-JSON completion against the configured provider/key
 * fallback chain. On 429/401/403/5xx, advances to the next key (then the
 * next provider) with capped exponential backoff, up to MAX_TOTAL_ATTEMPTS.
 * On a successful-but-malformed response, retries the same (provider, key)
 * up to MAX_MALFORMED_RETRIES times with a stricter instruction before
 * counting it as a failed attempt and moving on.
 */
export async function runScreeningCompletion<T>({
  systemPrompt,
  userPrompt,
  responseSchema,
  env,
}: {
  systemPrompt: string;
  userPrompt: string;
  responseSchema: ZodType<T>;
  env?: NodeJS.ProcessEnv;
}): Promise<T> {
  const providers = loadProviders(env);
  if (providers.length === 0) {
    throw new Error("No AI providers configured (check AI_PROVIDERS and *_API_KEYS env vars)");
  }

  const attempts = flattenAttempts(providers).slice(0, MAX_TOTAL_ATTEMPTS);
  let lastError: unknown;

  for (let i = 0; i < attempts.length; i++) {
    const { provider, key, keyIndex } = attempts[i];
    let prompt = userPrompt;

    for (let malformedRetry = 0; malformedRetry <= MAX_MALFORMED_RETRIES; malformedRetry++) {
      try {
        const content = await callChatCompletion(provider, key, systemPrompt, prompt);
        const json = extractJson(content);
        const parsed = responseSchema.safeParse(json);
        if (parsed.success) return parsed.data;

        lastError = new Error(`Schema validation failed: ${parsed.error.message}`);
        if (malformedRetry === MAX_MALFORMED_RETRIES) {
          logFailover({ provider: provider.name, keyIndex, reason: "malformed_output_exhausted" });
          break;
        }
        prompt = `${userPrompt}\n\nYour previous response did not match the required JSON shape exactly. Return ONLY a single valid JSON object matching the schema — no prose, no markdown fences.`;
        continue;
      } catch (err) {
        if (err instanceof RetryableError) {
          lastError = err;
          logFailover({ provider: provider.name, keyIndex, reason: err.reason });
          break;
        }
        // Malformed JSON that couldn't even be parsed — same retry-then-advance path.
        lastError = err;
        if (malformedRetry === MAX_MALFORMED_RETRIES) {
          logFailover({ provider: provider.name, keyIndex, reason: "malformed_output_exhausted" });
          break;
        }
        prompt = `${userPrompt}\n\nYour previous response was not valid JSON. Return ONLY a single valid JSON object — no prose, no markdown fences.`;
      }
    }

    if (i < attempts.length - 1) await sleep(backoffMs(i));
  }

  throw new Error(
    `All AI provider attempts exhausted (${attempts.length} tried). Last error: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`,
  );
}
