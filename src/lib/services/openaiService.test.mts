import assert from "node:assert/strict";
import test from "node:test";

test("uses chat completions for OpenAI-compatible base URLs", async () => {
  const servicePath = "./openaiService.ts";
  const { requestOpenAiStructuredOutput } = await import(servicePath);
  const previousApiKey = process.env.OPENAI_API_KEY;
  const previousBaseUrl = process.env.OPENAI_BASE_URL;
  const previousFetch = globalThis.fetch;
  const calls: Array<{ url: string; body: Record<string, unknown> }> = [];

  process.env.OPENAI_API_KEY = "test-key";
  process.env.OPENAI_BASE_URL = "https://api.deepseek.com";

  globalThis.fetch = (async (url, init) => {
    calls.push({
      url: String(url),
      body: JSON.parse(String(init?.body)),
    });

    return new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({ value: "ok" }),
            },
          },
        ],
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  }) as typeof fetch;

  try {
    const result = await requestOpenAiStructuredOutput({
      model: "deepseek-v4-flash",
      schemaName: "test_schema",
      schema: {
        type: "object",
        properties: {
          value: { type: "string" },
        },
        required: ["value"],
        additionalProperties: false,
      },
      prompt: "Return json only.",
    }) as { value: string } | null;

    assert.deepEqual(result, { value: "ok" });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://api.deepseek.com/chat/completions");
    assert.deepEqual(calls[0].body.response_format, { type: "json_object" });
    const messages = calls[0].body.messages as Array<{ role: string; content: string }>;
    assert.equal(messages[0].role, "user");
    assert.match(messages[0].content, /^Return json only\./);
    assert.match(messages[0].content, /JSON/);
  } finally {
    if (previousApiKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = previousApiKey;
    }

    if (previousBaseUrl === undefined) {
      delete process.env.OPENAI_BASE_URL;
    } else {
      process.env.OPENAI_BASE_URL = previousBaseUrl;
    }

    globalThis.fetch = previousFetch;
  }
});
