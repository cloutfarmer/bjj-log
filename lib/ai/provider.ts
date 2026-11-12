import "server-only";

import type { Provider } from "./types";

const isCount = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0;

export function anthropicProvider(key: string): Provider {
  return {
    async complete({ model, system, input, maxOutputTokens }) {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        // On Claude Haiku 5.5 thinking is on by default and thinking tokens count toward
        // max_tokens, so a 30-token cap would be spent before any answer. Disabling thinking
        // (accepted at effort low/medium/high) makes max_tokens a true hard cap on output.
        // No temperature, top_p or top_k: non-default values return 400 on this model.
        body: JSON.stringify({
          model,
          max_tokens: maxOutputTokens,
          system,
          thinking: { type: "disabled" },
          output_config: { effort: "low" },
          messages: [{ role: "user", content: input }],
        }),
        signal: AbortSignal.timeout(20000),
        cache: "no-store",
      });
      // Status only: the body can echo journal text.
      if (!response.ok) throw new Error(`AI provider returned ${response.status}`);
      const data = (await response.json()) as {
        content?: { type?: unknown; text?: unknown }[];
        usage?: { input_tokens?: unknown; output_tokens?: unknown };
      };
      const inputTokens = data?.usage?.input_tokens;
      const outputTokens = data?.usage?.output_tokens;
      if (!Array.isArray(data.content) || !isCount(inputTokens) || !isCount(outputTokens)) {
        throw new Error("AI provider returned an unexpected response");
      }
      // Blocks are read by type, not position. A refusal or max_tokens stop can leave the
      // text empty or cut short; the job's parser rejects it and the tokens are still logged.
      const text = data.content
        .filter((block) => block?.type === "text" && typeof block.text === "string")
        .map((block) => block.text as string)
        .join("");
      return { text, inputTokens, outputTokens };
    },
  };
}
