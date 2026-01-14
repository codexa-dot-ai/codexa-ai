import { StructuredDiff } from "@/components/diff.js"
import { FileContentDiff } from "@/components/file-diff.js"
import { applyEdit } from "@/lib/apply-edit.js"
import { getPatch } from "@/lib/diff.js"
import { env } from "@/lib/env.js"
import { addLineNumbers } from "@/lib/file.js"
import { messageStorage } from "@/lib/storage.js"
import { getTheme } from "@/lib/theme.js"
import { defineTool } from "@/tools/ai.js"
import { DefaultRejectedMessage } from "@/tools/shared/fallback-rejected-message.js"
import { type ToolMetadata } from "@/tools/tools.js"
import { updateFileRelationships } from "@/lib/relationship-tracker.js"
import { addRecentFile, setCurrentFocus } from "@/lib/project-context.js"
import { Box, Text } from "ink"
import { existsSync, mkdirSync, readFileSync } from "node:fs"
import { writeFile } from "node:fs/promises"
import { dirname, isAbsolute, relative, resolve } from "node:path"
import React from "react"
import { z } from "zod"

export const metadata = {
  needsPermissions: () => false,
} satisfies ToolMetadata

export const tool = defineTool({
  description: `This is a tool for editing files. For moving or renaming files, you should generally use the Bash tool with the 'mv' command instead. For larger edits, use the Write tool to overwrite files.

To make a file edit, provide the following:
1. filePath: The absolute path to the file to modify (must be absolute, not relative)
2. oldString: The text to replace (must be unique within the file, and must match the file contents exactly, including all whitespace and indentation)
3. newString: The edited text to replace the oldString

The tool will replace ONE occurrence of oldString with newString in the specified file.

CRITICAL REQUIREMENTS FOR USING THIS TOOL:

1. UNIQUENESS: The oldString MUST uniquely identify the specific instance you want to change. This means:
   - Include AT LEAST 3-5 lines of context BEFORE the change point
   - Include AT LEAST 3-5 lines of context AFTER the change point
   - Include all whitespace, indentation, and surrounding code exactly as it appears in the file

2. SINGLE INSTANCE: This tool can only change ONE instance at a time. If you need to change multiple instances:
   - Make separate calls to this tool for each instance
   - Each call must uniquely identify its specific instance using extensive context

3. VERIFICATION: Before using this tool:
   - Check how many instances of the target text exist in the file
   - If multiple instances exist, gather enough context to uniquely identify each one
   - Plan separate tool calls for each instance

WARNING: If you do not follow these requirements:
   - The tool will fail if oldString matches multiple locations
   - The tool will fail if oldString doesn't match exactly (including whitespace)
   - You may change the wrong instance if you don't include enough context

When making edits:
   - Ensure the edit results in idiomatic, correct code
   - Do not leave the code in a broken state
   - Always use absolute file paths (starting with /)

If you want to create a new file, use:
   - A new file path, including dir name if needed
   - An empty oldString
   - The new file's contents as newString

Remember: when making multiple file edits in a row to the same file, you should prefer to send all edits in a single message with multiple calls to this tool, rather than multiple messages with a single call each.`,
  parameters: z.strictObject({
    filePath: z.string().describe("The absolute path to the file to modify"),
    oldString: z.string().describe("The text to replace"),
    newString: z.string().describe("The text to replace it with"),
  }),
  generate: async function* ({ filePath, oldString, newString }) {
    try {
      const fullFilePath = isAbsolute(filePath) ? filePath : resolve(env.cwd!, filePath)
      const dir = dirname(fullFilePath)
      const originalFile = existsSync(fullFilePath) ? readFileSync(fullFilePath, "utf8") : ""

      mkdirSync(dir, { recursive: true })
      const { patch, updatedFile } = applyEdit(filePath, oldString, newString)

      await writeFile(fullFilePath, updatedFile, { encoding: "utf8", flush: true })

      // Update relationship tracker and context manager
      const relativePath = relative(env.cwd!, fullFilePath)
      await updateFileRelationships(relativePath).catch(() => {}) // Don't fail if tracker fails
      await addRecentFile(relativePath).catch(() => {})
      await setCurrentFocus([relativePath]).catch(() => {})

      yield <FileContentDiff filePath={filePath} structuredPatch={patch} verbose={false} />
      const { snippet, startLine } = getSnippet(originalFile || "", oldString, newString)
      yield `The file ${filePath} has been updated. Here's the result of running \`cat -n\` on a snippet of the edited file:
${addLineNumbers({
  content: snippet,
  startLine,
})}`
    } catch (error: any) {
      yield <Text color="red">There was an error writing the file: {error.message}</Text>
      yield `Error: ${error.message}`
    }
  },
  render: ({ toolCallId, state, args: { filePath, oldString, newString } }) => {
    try {
      if (
        state !== "partial-call" ||
        !filePath ||
        !oldString ||
        !newString ||
        oldString.trim() === newString.trim()
      ) {
        return null
      }
      const { patch } = applyEdit(filePath, oldString, newString)

      return <FileContentDiff filePath={filePath} structuredPatch={patch} verbose={false} />
    } catch (error: any) {
      return null
    }
  },
  renderTitle: ({ args }) => (
    <Text backgroundColor="gray" color="red">
      Edit File: {args.filePath ? relative(env.cwd!, args.filePath) : null}
    </Text>
  ),
})

export const renderRejectedMessage = DefaultRejectedMessage

const N_LINES_SNIPPET = 4
function getSnippet(
  initialText: string,
  oldStr: string,
  newStr: string,
): { snippet: string; startLine: number } {
  const before = initialText.split(oldStr)[0] ?? ""
  const replacementLine = before.split(/\r?\n/).length - 1
  const newFileLines = initialText.replace(oldStr, newStr).split(/\r?\n/)
  // Calculate the start and end line numbers for the snippet
  const startLine = Math.max(0, replacementLine - N_LINES_SNIPPET)
  const endLine = replacementLine + N_LINES_SNIPPET + newStr.split(/\r?\n/).length
  // Get snippet
  const snippetLines = newFileLines.slice(startLine, endLine + 1)
  const snippet = snippetLines.join("\n")
  return { snippet, startLine: startLine + 1 }
}
