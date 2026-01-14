import { Text } from "ink"
import { isAbsolute } from "node:path"
import { config } from "@/lib/config.js"
import { env } from "@/lib/env.js"
import { defineTool } from "@/tools/ai.js"
import { DefaultRejectedMessage } from "@/tools/shared/fallback-rejected-message.js"
import type { ToolMetadata } from "@/tools/tools.js"
import { anthropic } from "@ai-sdk/anthropic"
import { streamText, type Tool } from "ai"
import dedent from "dedent"
import React from "react"
import { z } from "zod"
import { tool as globTool } from "./glob.js"
import { tool as readFileTool } from "./read-file.js"
import { globby } from "globby"

export const metadata = {
  needsPermissions: () => false,
} satisfies ToolMetadata

export const tool = defineTool({
  description: `Launch a new agent that has access to the following tools: read-file and glob. When you are doing a task and are not confident the result, use the evaluate tool to evaluate your result. For example:

- You are in final step of a task for creating a website and want to expert assessment of your work, the Evaluate tool is appropriate
- In a complex task and need someone who smarter than you to roast, Evaluate tool is for you
- If you want to read a specific file path, use the file-read or glob tool instead of the Evaluate tool, to find the match more quickly

Usage notes:
1. When the evaluation is done, it will return a single message back to you. The result returned by this tool is not visible to the user. To show the user the result, you should send a text message back to the user with a concise summary of the result.
2. Each evaluate invocation is stateless. You will not be able to send additional messages to the agent, nor will the agent be able to communicate with you outside of its final report. Therefore, your prompt should contain a highly detailed task description for the agent to perform autonomously and you should specify exactly what information the agent should return back to you in its final and only message to you.
3. The agent's outputs should generally be trusted
4. IMPORTANT: The agent can not use bash tool, file-edit tool, file-write tool, so can not modify files. If you want to use these tools, use them directly instead of going through the agent.
5. Choose model to use, depends on the complexity and its description, here are available models: ${[
    ...Object.keys(config.experimental?.modelRegistry || {}).map(
      (key) => `${key} (${config.experimental?.modelRegistry?.[key]?.description})`,
    ),
    "default",
  ].join(", ")}
`,
  parameters: z.object({
    prompt: z.string().describe("The task for the agent to perform"),
    context: z.string().describe(
      dedent`The context for this evaluation, it can be anything that valuable for the task, for examples:
      <context>
        <overview>I've edited 2 files and use 5 tools for the goal "make a website for ecommerce</overview>
        <files>
          <file-path "src/app/page.tsx" description="This is the file that landing page component" />
          <file-path "src/app/cart/page.tsx" description="This is the file cart component" />
        </files>
      </context>`,
    ),
    model: z.string().default("default").describe("The"),
  }),
  // TODO handle persistent shell session (for example npm run dev)
  async *generate({ prompt, context, model }, { abortSignal }) {
    const { textStream } = streamText({
      maxSteps: 10,
      model:
        config.experimental?.modelRegistry?.[model]?.model ||
        config.model ||
        anthropic("claude-3-7-sonnet-20250219"),
      system:
        typeof config.evaluateSystem === "function"
          ? config.evaluateSystem(context)
          : `You are an agent for Codexa AI, a CLI for coding. Given the user's prompt, you should evaluate user's tasks with the help of the tools available.

Notes:
1. IMPORTANT: You should be concise, direct, and to the point, since your responses will be displayed on a command line interface. Answer the user's question directly, without elaboration, explanation, or details. One word answers are best. Avoid introductions, conclusions, and explanations. You MUST avoid text before/after your response, such as "The answer is <answer>.", "Here is the content of the file..." or "Based on the information provided, the answer is..." or "Here is what I will do next...".
2. When relevant, share file names and code snippets relevant to the query
3. Any file paths you return in your final response MUST be absolute. DO NOT use relative paths.

Here is the context for the task: ${context}
`,
      prompt,
      abortSignal,
      tools: {
        readFileTool: readFileTool as Tool,
        glob: {
          ...globTool,
          async execute({ pattern, path }) {
            try {
              const absolutePath = path && isAbsolute(path) ? path : env.cwd

              const files = await globby(pattern, { cwd: absolutePath, gitignore: true })

              if (files.length === 0) {
                return "No fields found"
              }
              return files.join("\n")
            } catch (error: any) {
              return `There was an error search the pattern: ${error.message}`
            }
          },
        } as Tool,
      },
    })
    let fullText = ""
    for await (const chunk of textStream) {
      fullText += chunk
      yield (
        <span>Evaluating: {`${fullText.length > 350 ? "..." : ""}${fullText.slice(-300)}`}</span>
      )
    }
    yield <span>Evaluate done</span>
    yield `Here is my evaluation: ${fullText}`
  },
  renderTitle: ({ state, ...others }) => {
    return <Text>Evalulate</Text>
  },
})

export function render() {
  return <Text>Run Command</Text>
}

export const renderRejectedMessage = DefaultRejectedMessage
