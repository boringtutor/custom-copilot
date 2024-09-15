import dedent from "dedent";
import { getSimpleCompletion } from "./helpers/llm";
import { getCodeBlock, safeAwait } from "./helpers/helpers";
import { AgentInputType } from "./types/misc";
import { readFile } from "fs/promises";
import { glob } from "glob";

import "dotenv/config";

/**
 * @param param0
 * prompt: function that user want us to generate
 * fileContent: content to pass the context to openai
 * fileUri: location of the file we want to update
 *
 *
 * TODO: we still need to implement the functionality of letting user see if the tests are good
 * if no file uri us provided user glob to grab all the files except node_modules
 */
export default async function MyAgent({
  prompt, // function that user want us to generate
  fileContent, // content to pass the context to openai
  fileUri, // location of the file we want to update
}: AgentInputType) {
  // TODO 1. generate test for the prompt that user asked
  if (prompt === null) {
    throw new Error("Prompt is null");
  }

  return `import { test, expect } from 'vitest';
  import { test as generatedTest } from './generatedFunction';
  
  test('generatedTest logs the correct message', () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    
    generatedTest();
    
    expect(consoleLogSpy).toHaveBeenCalledWith('i am testing the fule ');
    
    consoleLogSpy.mockRestore();
  });`;
  // return await generateTest(prompt, fileContent);
  //TODO 2 .  IF NO FILE PATH IS GIVEN GENERATE THE ASCII TREE FOR ALL THE FILES.
  //generateAsciiTree()
  //   if (!filePath) {
  //     const files = await glob('*/*/*', { ignore: ['node_modules/**'] });
  //     const fileString = generateAsciiTree(files.slice(0, 200));
  //   }
  //   getFileSuggestion(prompt,fileString)
}

export async function generateTest(prompt: string, fileContent: string) {
  // TODO 1. generate test for the prompt that user asked
  const packageJsonContents = await readFile("package.json", "utf8").catch(
    () => ""
  );
  const [twoTestFiles, twoTests] = await getExampleTests();
  const filePath = "src/generatedFunction.ts";
  const testFilePath = filePath.replace(/.(\w+)$/, ".test.$1");

  let test = "";

  let [output, error] = await safeAwait(
    getSimpleCompletion({
      onChunk: (chunk) => {
        test += chunk;
      },
      messages: [
        {
          role: "system",
          content: dedent`
          You are an AI assistant that given a user prompt, returns a markdown for a unit test.
          1. Think step by step before emiting any code. Think about the shape of the input and output, the behavior and special situations that are relevant to the algorithm.
  
          2. After planning, return a code block with the test code.
            - Start with the most basic test case and progress to more complex ones.
            - Start with the happy path, then edge cases.
            - Inputs that are invalid, and likely to break the algorithm.
            - Keep the individual tests small and focused.
            - Focus in behavior, not implementation.
  
            Stop emitting after the code block.`,
        },
        {
          role: "user",
          content: dedent`
          Please prepare a unit test file (can be multiple tests) for the following prompt:
          <prompt>
          ${prompt}
          </prompt>
  
          The test will be located at \`${testFilePath}\` and the code to test will be located at
          \`${filePath}\`.
          ${
            fileContent
              ? dedent`
              Here's the existing content of the file where we want to generate the code:
              <file-content>
              ${fileContent}
              </file-content>
              Please consider this existing content when generating the test. Ensure that the new test is compatible with and complements the existing code.`
              : ""
          }
          ${
            twoTests.length > 0
              ? dedent`Here is a copy of a couple example tests in the repo:
            <tests>
            ${twoTestFiles.join("\n") || "No tests found"}
            </tests>`
              : packageJsonContents
              ? dedent`
                Here is the package.json file to help you know what testing library to use (if any, otherwise vitest is a good option):
                <package-json>
                ${packageJsonContents}
                </package-json>
              `
              : ""
          }
  
          Only output the test code. No other words, just the code.
          `,
        },
      ],
    })
  );

  if (error) {
    console.log("error in the test generation");
    console.error(error);
    return;
  }
  if (!output) {
    console.error("No output from the LLM");
    return;
  }
  console.log("got the test");
  console.log("generating code block from the output");
  let testContent = getCodeBlock(output);
  console.log("got the test content", testContent);
  return testContent;
}

export async function getExampleTests() {
  const exampleTests = await glob("**/*.{test,spec}.*", {
    ignore: ["node_modules/**"],
  });
  const twoTests = exampleTests.slice(0, 2);
  const twoTestFiles = await Promise.all(
    twoTests.map(async (test: any) => {
      const content = await readFile(test, "utf8");
      return content;
    })
  );
  return [twoTestFiles, twoTests];
}
