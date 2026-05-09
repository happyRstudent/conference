export function hasOpenAiApiKey(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

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

export async function requestOpenAiStructuredOutput<T>(
  options: OpenAiStructuredOutputOptions,
): Promise<T | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const response = await fetch("https://api.openai.com/v1/responses", {
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
  const outputText = extractOutputText(payload);
  if (!outputText) return null;

  try {
    return JSON.parse(outputText) as T;
  } catch {
    return null;
  }
}
