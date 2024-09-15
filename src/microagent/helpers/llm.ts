import dedent from "dedent";
import { getConfig } from "./config";
import OpenAI from "openai";
import { createOpenAiCompletion, safeAwait, getOpenAi } from "./helpers";

// const defaultModel = "gpt-4o";
// const assistantIdentifierMetadataKey = "_id";
// const assistantIdentifierMetadataValue = "@boringtutor/micro-agent";

export async function getSimpleCompletion(options: {
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[];
  onChunk?: (chunk: string) => void;
}) {
  const {
    MODEL: model, // rename to model
    MOCK_LLM_RECORD_FILE: mockLlmRecordFile, // rename to mockLlmRecordFile
    USE_MOCK_LLM: useMockLlm,
  } = await getConfig();

  if (useMockLlm) {
    console.warn("useMockLlm", useMockLlm);
    console.log("about to return mocked response");
    return "mocked response";
  }
  console.log("about to get the openai");
  const openai = await getOpenAi();

  console.log("about to call the openai");
  const [completion, error] = await safeAwait(
    createOpenAiCompletion(openai, model, options.messages)
  );
  console.log("got the completion");
  if (error) {
    console.log("got error in completion");
    throw error;
  }
  if (!completion) {
    throw new Error(
      "No completion from OPENAI while getting simple completion"
    );
  }
  let output = "";
  console.log("about to loop through the completion");
  for await (const chunk of completion) {
    const str = chunk.choices[0]?.delta.content;
    if (str) {
      output += str;
      if (options.onChunk) {
        options.onChunk(str);
      }
    }
  }
  //Record the llm call
  //   captureLlmRecord(options.messages, output, mockLlmRecordFile);

  return output;
}
