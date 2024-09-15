import OpenAI from "openai";

export async function safeAwait<T, E = Error>(
  promise: Promise<T>
): Promise<[T | null, E | null]> {
  try {
    const result = await promise;
    return [result, null];
  } catch (error) {
    return [null, error as E];
  }
}

export async function createOpenAiCompletion(
  openai: OpenAI,
  model: string,
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]
) {
  return await openai.chat.completions.create({
    model: model,
    messages: messages,
    temperature: 0,
    seed: 42,
    stream: true,
  });
}

export function getCodeBlock(output: string) {
  const foundCode = output.indexOf("```");
  if (foundCode === -1) {
    return output;
  }
  const start = output.indexOf("\n", foundCode);
  if (start === -1) {
    return output.slice(foundCode);
  }
  const end = output.indexOf("```", start);
  if (end === -1) {
    console.error("Code block end not found");
  }
  return output.slice(start, end === -1 ? undefined : end).trim();
}

export const getOpenAi = async function () {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set in the environment variables");
  }

  return new OpenAI({ apiKey });
};
