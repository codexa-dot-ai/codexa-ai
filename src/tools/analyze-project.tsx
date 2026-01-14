import { defineTool } from "@/tools/ai.js"
import { type ToolMetadata } from "@/tools/tools.js"
import { analyzeProject, type ProjectAnalysis } from "@/lib/project-detector.js"
import { messageStorage } from "@/lib/storage.js"
import { storeProjectAnalysis } from "@/lib/project-context.js"
import { Box, Text } from "ink"
import React from "react"
import { z } from "zod"
import { relative } from "node:path"

export const metadata = {
  needsPermissions: () => false,
} satisfies ToolMetadata

const CACHE_KEY = "/project-analysis"
const CACHE_DURATION_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Gets cached project analysis if still valid
 */
async function getCachedAnalysis(): Promise<ProjectAnalysis | null> {
  try {
    const cached = await messageStorage.getItem<ProjectAnalysis & { cachedAt: number }>(CACHE_KEY)
    if (!cached) {
      return null
    }

    const age = Date.now() - cached.cachedAt
    if (age > CACHE_DURATION_MS) {
      return null
    }

    // Remove cachedAt before returning
    const { cachedAt, ...analysis } = cached
    return analysis
  } catch {
    return null
  }
}

/**
 * Caches project analysis
 */
async function cacheAnalysis(analysis: ProjectAnalysis): Promise<void> {
  try {
    await messageStorage.setItem(CACHE_KEY, {
      ...analysis,
      cachedAt: Date.now(),
    })
  } catch {
    // Ignore cache errors
  }
}

export const tool = defineTool({
  description: `Analyzes the project structure to understand:
- What frameworks are being used (Hardhat, Foundry, Next.js, React, etc.)
- Project structure (contracts, backend, frontend, tests)
- File relationships and dependencies
- Monorepo detection

This tool helps the AI understand your project context so it can provide better assistance. The analysis is cached for 5 minutes to avoid repeated work.

Use this tool when:
- Starting work on a new project
- The AI needs to understand project structure
- You want to see what frameworks are detected`,
  parameters: z.strictObject({
    force: z
      .boolean()
      .optional()
      .default(false)
      .describe("Force a fresh analysis even if cached data exists. Defaults to false."),
  }),
  execute: async ({ force = false }) => {
    try {
      // Check cache first
      if (!force) {
        const cached = await getCachedAnalysis()
        if (cached) {
          return {
            data: cached,
            message: `Project analysis (cached):\n${formatAnalysis(cached)}`,
            cached: true,
          }
        }
      }

      // Perform fresh analysis
      const analysis = await analyzeProject()

      // Cache the results
      await cacheAnalysis(analysis)
      
      // Also store in context manager
      await storeProjectAnalysis(analysis)

      return {
        data: analysis,
        message: `Project analysis complete:\n${formatAnalysis(analysis)}`,
        cached: false,
      }
    } catch (error: any) {
      return {
        result: false,
        message: `Error analyzing project: ${error.message}`,
      }
    }
  },
  render: ({ args, state, result }) => {
    if (state === "partial-call") {
      return (
        <Box flexDirection="column" gap={0}>
          <Text color="cyan">Analyzing project structure...</Text>
          {args.force && <Text color="dim">  (forcing fresh analysis)</Text>}
        </Box>
      )
    }

    if (state === "result" && result && typeof result === "object" && "data" in result) {
      const analysis = result.data as ProjectAnalysis
      const cached = (result as any).cached === true

      return (
        <Box flexDirection="column" gap={1} paddingX={1}>
          <Box flexDirection="row" gap={1}>
            <Text color="magenta">📊 Project Analysis</Text>
            {cached && <Text color="dim">(cached)</Text>}
          </Box>

          <Box flexDirection="column" gap={0} paddingLeft={2}>
            <Text color="cyan" bold>
              Stack Detection:
            </Text>
            <Text color="white">
              {"  "}
              Contract: {analysis.stack.contractFramework || "none"}
            </Text>
            <Text color="white">
              {"  "}
              Backend: {analysis.stack.backendFramework || "none"}
            </Text>
            <Text color="white">
              {"  "}
              Frontend: {analysis.stack.frontendFramework || "none"}
            </Text>
            <Text color="white">
              {"  "}
              Language: {analysis.stack.language || "unknown"}
            </Text>
            <Text color="white">
              {"  "}
              Package Manager: {analysis.stack.packageManager || "unknown"}
            </Text>
            {analysis.stack.monorepo && (
              <Text color="yellow">
                {"  "}
                ⚠️ Monorepo detected
              </Text>
            )}
          </Box>

          <Box flexDirection="column" gap={0} paddingLeft={2} paddingTop={1}>
            <Text color="cyan" bold>
              Project Structure:
            </Text>
            <Text color="white">
              {"  "}
              Contracts: {analysis.structure.contracts.length} files
            </Text>
            <Text color="white">
              {"  "}
              Backend: {analysis.structure.backend.length} files
            </Text>
            <Text color="white">
              {"  "}
              Frontend: {analysis.structure.frontend.length} files
            </Text>
            <Text color="white">
              {"  "}
              Tests: {analysis.structure.tests.length} files
            </Text>
            <Text color="white">
              {"  "}
              Config: {analysis.structure.config.length} files
            </Text>
            <Text color="white">
              {"  "}
              Scripts: {analysis.structure.scripts.length} files
            </Text>
            <Text color="dim">
              {"  "}
              Other: {analysis.structure.other.length} files
            </Text>
          </Box>

          <Box flexDirection="column" gap={0} paddingLeft={2} paddingTop={1}>
            <Text color="cyan" bold>
              Relationships:
            </Text>
            <Text color="dim">
              {"  "}
              {analysis.relationships.length} dependencies tracked
            </Text>
          </Box>

          <Box flexDirection="column" gap={0} paddingLeft={2} paddingTop={1}>
            <Text color="dim">Root: {relative(process.cwd(), analysis.rootPath)}</Text>
          </Box>
        </Box>
      )
    }

    return null
  },
  renderTitle: ({ args }) => (
    <Text color="magenta">📊 Analyze Project{args?.force ? " (force)" : ""}</Text>
  ),
})

export const renderRejectedMessage = () => {
  return <Text>Analyze Project</Text>
}

/**
 * Formats analysis for text output
 */
function formatAnalysis(analysis: ProjectAnalysis): string {
  const lines: string[] = []

  lines.push("Stack Detection:")
  lines.push(`  Contract Framework: ${analysis.stack.contractFramework || "none"}`)
  lines.push(`  Backend Framework: ${analysis.stack.backendFramework || "none"}`)
  lines.push(`  Frontend Framework: ${analysis.stack.frontendFramework || "none"}`)
  lines.push(`  Language: ${analysis.stack.language || "unknown"}`)
  lines.push(`  Package Manager: ${analysis.stack.packageManager || "unknown"}`)
  if (analysis.stack.monorepo) {
    lines.push("  Monorepo: yes")
  }

  lines.push("\nProject Structure:")
  lines.push(`  Contracts: ${analysis.structure.contracts.length} files`)
  lines.push(`  Backend: ${analysis.structure.backend.length} files`)
  lines.push(`  Frontend: ${analysis.structure.frontend.length} files`)
  lines.push(`  Tests: ${analysis.structure.tests.length} files`)
  lines.push(`  Config: ${analysis.structure.config.length} files`)
  lines.push(`  Scripts: ${analysis.structure.scripts.length} files`)
  lines.push(`  Other: ${analysis.structure.other.length} files`)

  lines.push(`\nRelationships: ${analysis.relationships.length} dependencies tracked`)

  return lines.join("\n")
}
