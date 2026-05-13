export function hasOpenAiApiKey(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";

interface OpenAiStructuredOutputOptions {
  model?: string;
  schemaName: string;
  schema: Record<string, unknown>;
  prompt: string;
}

interface OpenAiResponsesPayload {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      text?: string;
    }>;
  }>;
}

interface ChatCompletionsPayload {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
}

function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/^["“”']|["“”']$/g, "").replace(/\/+$/g, "");
}

function getBaseUrl(): string {
  return normalizeBaseUrl(process.env.OPENAI_BASE_URL || DEFAULT_OPENAI_BASE_URL);
}

function shouldUseChatCompletions(baseUrl: string): boolean {
  return !baseUrl.includes("api.openai.com");
}

function extractOutputText(payload: OpenAiResponsesPayload): string {
  return (
    payload.output_text ||
    payload.output
      ?.flatMap((item) => item.content || [])
      .map((item) => item.text || "")
      .join("\n") ||
    ""
  );
}

function extractChatCompletionText(payload: ChatCompletionsPayload): string {
  return payload.choices?.[0]?.message?.content || "";
}

function buildJsonPrompt(options: OpenAiStructuredOutputOptions): string {
  return `${options.prompt}

请只返回严格 JSON，不要包含 Markdown 或解释文字。JSON 根对象必须符合这个 schemaName：${options.schemaName}。
JSON Schema：${JSON.stringify(options.schema)}`;
}

async function requestOpenAiResponses(
  apiKey: string,
  baseUrl: string,
  options: OpenAiStructuredOutputOptions,
): Promise<string | null> {
  const response = await fetch(`${baseUrl}/responses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: options.model || process.env.OPENAI_MODEL || "gpt-4.1-mini",
      input: options.prompt,
      text: {
        format: {
          type: "json_schema",
          name: options.schemaName,
          schema: options.schema,
        },
      },
    }),
    cache: "no-store",
  });

  if (!response.ok) return null;

  const payload = (await response.json()) as OpenAiResponsesPayload;
  return extractOutputText(payload);
}

async function requestChatCompletions(
  apiKey: string,
  baseUrl: string,
  options: OpenAiStructuredOutputOptions,
): Promise<string | null> {
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: options.model || process.env.OPENAI_MODEL || "gpt-4.1-mini",
      messages: [
        {
          role: "user",
          content: buildJsonPrompt(options),
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 4000,
    }),
    cache: "no-store",
  });

  if (!response.ok) return null;

  const payload = (await response.json()) as ChatCompletionsPayload;
  return extractChatCompletionText(payload);
}

export async function requestOpenAiStructuredOutput<T>(
  options: OpenAiStructuredOutputOptions,
): Promise<T | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const baseUrl = getBaseUrl();

  const outputText = shouldUseChatCompletions(baseUrl)
    ? await requestChatCompletions(apiKey, baseUrl, options)
    : await requestOpenAiResponses(apiKey, baseUrl, options);
  if (!outputText) return null;

  try {
    return JSON.parse(outputText) as T;
  } catch {
    return null;
  }
}
