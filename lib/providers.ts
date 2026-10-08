import "server-only";

// LLM provider chain. Each provider is tried in order until one answers; the first that works
// is reused for the rest of the request (retries included).
//   1. OpenRouter with the configured model (paid credits)
//   2. Google Gemini direct (GEMINI_API_KEY, free tier)
//   3. OpenRouter free models (":free", no credits needed)

export type Message = { role: "system" | "user" | "assistant"; content: string };

interface Provider {
  name: string;
  available: () => boolean;
  call: (messages: Message[], maxTokens: number) => Promise<string>;
}

const openRouterKey = () => process.env.OPENROUTER_API_KEY || process.env.api_openrouter_API_key;

async function openAiCompatible(
  url: string,
  key: string,
  body: Record<string, unknown>,
  label: string,
  extraHeaders: Record<string, string> = {}
): Promise<string> {
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...extraHeaders },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) throw Object.assign(new Error(`${label} ${res.status}: ${(await res.text()).slice(0, 240)}`), { status: res.status });
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) throw new Error(`${label} returned no content`);
  return content;
}

const openRouter: Provider = {
  name: "openrouter",
  available: () => !!openRouterKey(),
  async call(messages, maxTokens) {
    const body = {
      model: process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash",
      messages,
      temperature: 0.3,
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
    };
    try {
      return await openAiCompatible("https://openrouter.ai/api/v1/chat/completions", openRouterKey()!, body, "OpenRouter", {
        "X-Title": "Say What You Saw",
      });
    } catch (err) {
      // Low credit: OpenRouter says how many tokens are still affordable. Retry once within that.
      const affordable = Number((err as Error).message.match(/can only afford (\d+)/)?.[1]);
      if (affordable >= 1200 && affordable < maxTokens) return openRouter.call(messages, affordable - 100);
      throw err;
    }
  },
};

// Google retires specific Gemini versions for new keys, so use the always-current aliases.
const GEMINI_MODELS = () => [process.env.GEMINI_MODEL, "gemini-flash-latest", "gemini-flash-lite-latest"].filter(Boolean) as string[];

const gemini: Provider = {
  name: "gemini",
  available: () => !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY),
  async call(messages, maxTokens) {
    let lastError: unknown;
    for (const model of GEMINI_MODELS()) {
      try {
        return await openAiCompatible(
          "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
          (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY)!,
          { model, messages, temperature: 0.3, max_tokens: maxTokens, response_format: { type: "json_object" } },
          `Gemini (${model})`
        );
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError;
  },
};

// Free OpenRouter models change often, so pick them from the live model list (cached).
let freeModels: { ids: string[]; at: number } | null = null;
const FREE_PREFERENCE = [/gemini/i, /deepseek/i, /llama-3\.3-70b|llama-4/i, /qwen/i, /mistral/i, /gpt-oss/i];

async function pickFreeModels(): Promise<string[]> {
  if (freeModels && Date.now() - freeModels.at < 30 * 60_000) return freeModels.ids;
  const res = await fetch("https://openrouter.ai/api/v1/models", { signal: AbortSignal.timeout(10_000) });
  const data = await res.json();
  const free: string[] = (data?.data ?? [])
    .filter((m: { id: string; context_length?: number }) => m.id.endsWith(":free") && (m.context_length ?? 0) >= 32_000)
    .map((m: { id: string }) => m.id);
  const ranked = free.sort((a, b) => rank(a) - rank(b)).slice(0, 3);
  freeModels = { ids: ranked, at: Date.now() };
  return ranked;
}
const rank = (id: string) => {
  const i = FREE_PREFERENCE.findIndex((re) => re.test(id));
  return i === -1 ? FREE_PREFERENCE.length : i;
};

const openRouterFree: Provider = {
  name: "openrouter-free",
  available: () => !!openRouterKey(),
  async call(messages, maxTokens) {
    const models = await pickFreeModels();
    if (!models.length) throw new Error("No free OpenRouter models available");
    // OpenRouter tries each listed model in turn if the previous one is rate-limited or down.
    return openAiCompatible(
      "https://openrouter.ai/api/v1/chat/completions",
      openRouterKey()!,
      { models, messages, temperature: 0.3, max_tokens: Math.min(maxTokens, 8000) },
      "OpenRouter free",
      { "X-Title": "Say What You Saw" }
    );
  },
};

const CHAIN = [openRouter, gemini, openRouterFree];

// One request's view of the chain: remembers which provider answered so retries reuse it.
export class ProviderSession {
  private index = 0;
  used = "";
  errors: string[] = [];

  async call(messages: Message[], maxTokens: number): Promise<string> {
    const providers = CHAIN.filter((p) => p.available());
    if (!providers.length) throw new Error("No AI provider configured (set OPENROUTER_API_KEY or GEMINI_API_KEY)");
    for (; this.index < providers.length; this.index++) {
      const provider = providers[this.index];
      try {
        const text = await provider.call(messages, maxTokens);
        this.used = provider.name;
        return text;
      } catch (err) {
        this.errors.push(`${provider.name}: ${(err as Error).message.slice(0, 160)}`);
      }
    }
    throw new Error(`All AI providers failed. ${this.errors.join(" | ")}`);
  }
}
