import { CodeHighlight } from "@/components/code-highlight.js"
import { StructuredDiff } from "@/components/diff.js"
import { FileContentDiff } from "@/components/file-diff.js"
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
import type { Hunk } from "diff"
import { Box, Text } from "ink"
import { existsSync, mkdirSync, readFileSync } from "node:fs"
import { writeFile } from "node:fs/promises"
import { dirname, extname, isAbsolute, relative, resolve } from "node:path"
import React, { cache } from "react"
import { z } from "zod"

export const metadata = {
  needsPermissions: () => false,
} satisfies ToolMetadata

const MAX_LINES_TO_RENDER = 10
const MAX_LINES_TO_RENDER_FOR_ASSISTANT = 16000
const TRUNCATED_MESSAGE =
  "<response clipped><NOTE>To save on context only part of this file has been shown to you. You should retry this tool after you have searched inside the file with Grep in order to find the line numbers of what you are looking for.</NOTE>"

export const tool = defineTool({
  description: `Write a file to the local filesystem. Overwrites the existing file if there is one.

Before using this tool:

1. Use the ReadFile tool to understand the file's contents and context`,
  parameters: z.strictObject({
    filePath: z
      .string()
      .describe("The absolute path to the file to write (must be absolute, not relative)"),
    content: z.string().describe("The content to write to the file"),
  }),
  generate: async function* ({ filePath, content }: { filePath: string; content: string }) {
    try {
      const fullFilePath = isAbsolute(filePath) ? filePath : resolve(env.cwd!, filePath)
      const dir = dirname(fullFilePath)
      const oldFileExists = existsSync(fullFilePath)
      const oldContent = oldFileExists ? readFileSync(fullFilePath, "utf8") : null

      mkdirSync(dir, { recursive: true })
      await writeFile(fullFilePath, content, { encoding: "utf8", flush: true })

      // Update relationship tracker and context manager
      const relativePath = relative(env.cwd!, fullFilePath)
      await updateFileRelationships(relativePath).catch(() => {}) // Don't fail if tracker fails
      await addRecentFile(relativePath).catch(() => {})
      await setCurrentFocus([relativePath]).catch(() => {})

      const patch = getPatch({
        filePath: filePath,
        fileContents: oldContent || "",
        oldStr: oldContent || "",
        newStr: content,
      })

      if (patch.length === 0) {
        yield <Text>No changes to the file.</Text>
        return
      }

      const numLines = content.split("\n").length

      if (oldContent) {
        yield <FileContentDiff filePath={filePath} structuredPatch={patch} verbose={false} />
        yield `The file ${filePath} has been updated. Here's the result of running \`cat -n\` on a snippet of the edited file:
${addLineNumbers({
  content:
    content.split(/\r?\n/).length > MAX_LINES_TO_RENDER_FOR_ASSISTANT
      ? content.split(/\r?\n/).slice(0, MAX_LINES_TO_RENDER_FOR_ASSISTANT).join("\n") +
        TRUNCATED_MESSAGE
      : content,
  startLine: 1,
})}`
        return
      }

      yield (
        <Box flexDirection="column">
          <CodeHighlight
            code={(content || "(No content)")
              .split("\n")
              .slice(0, MAX_LINES_TO_RENDER)
              .filter((_) => _.trim() !== "")
              .join("\n")}
            language={extname(filePath).slice(1)}
          />
          {numLines > MAX_LINES_TO_RENDER && (
            <Text color={getTheme().secondaryText}>
              ... (+{numLines - MAX_LINES_TO_RENDER} lines)
            </Text>
          )}
        </Box>
      )
      yield `File created successfully at: ${filePath}`
    } catch (error: any) {
      yield <Text color="red">There was an error writing the file: {error.message}</Text>
      yield `Error: ${error.message}`
    }
  },
  render: ({ toolCallId, state, args: { filePath, content } }) => {
    if (state !== "partial-call" || !content) {
      return null
    }
    const fullFilePath = filePath
      ? isAbsolute(filePath)
        ? filePath
        : resolve(env.cwd!, filePath)
      : null
    const oldFileExists = fullFilePath ? existsSync(fullFilePath) : false
    const oldContent = oldFileExists ? readFileSync(fullFilePath!, "utf8") : null
    const patch = getPatch({
      filePath: filePath,
      fileContents: oldContent || "",
      oldStr: oldContent || "",
      newStr: content,
    })

    if (patch.length === 0) {
      return null
    }
    
    return <StructuredDiff patch={patch[0]!} dim={false} width={process.stdout.columns - 10} />
  },
  renderTitle: ({ args }) => (
    <Text backgroundColor="gray" color="red">
      Write File: {args.filePath ? relative(env.cwd!, args.filePath) : null}
    </Text>
  ),
})

export const renderRejectedMessage = DefaultRejectedMessage
