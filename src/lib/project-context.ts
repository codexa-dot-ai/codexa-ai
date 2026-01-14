/**
 * Project Context Manager
 * 
 * Maintains project state, tracks relationships, and provides intelligent context
 * to the AI based on what it's working on.
 */

import { env } from "@/lib/env.js"
import { messageStorage } from "@/lib/storage.js"
import type { ProjectAnalysis, DependencyRelationship } from "@/lib/project-detector.js"
import { existsSync, statSync } from "node:fs"
import { join, relative } from "node:path"

const PROJECT_ANALYSIS_KEY = "/project-analysis"
const CONTEXT_STATE_KEY = "/project-context-state"

export type ContextState = {
  currentFocus?: string[] // Files currently being worked on
  recentFiles: string[] // Recently accessed files
  activeLayer?: "contract" | "backend" | "frontend" | "test" | "config" | null
  lastUpdated: number
}

export type ProjectContext = {
  analysis: ProjectAnalysis
  state: ContextState
  relatedFiles: string[] // Files related to current focus
}

/**
 * Gets cached project analysis
 */
export async function getProjectAnalysis(): Promise<ProjectAnalysis | null> {
  try {
    const cached = await messageStorage.getItem<ProjectAnalysis & { cachedAt: number }>(
      PROJECT_ANALYSIS_KEY,
    )
    if (!cached) {
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
 * Stores project analysis
 */
export async function storeProjectAnalysis(analysis: ProjectAnalysis): Promise<void> {
  try {
    await messageStorage.setItem(PROJECT_ANALYSIS_KEY, {
      ...analysis,
      cachedAt: Date.now(),
    })
  } catch {
    // Ignore cache errors
  }
}

/**
 * Gets current context state
 */
export async function getContextState(): Promise<ContextState> {
  try {
    const state = await messageStorage.getItem<ContextState>(CONTEXT_STATE_KEY)
    if (state) {
      return state
    }
  } catch {
    // Ignore errors
  }

  // Return default state
  return {
    recentFiles: [],
    lastUpdated: Date.now(),
  }
}

/**
 * Updates context state
 */
export async function updateContextState(updates: Partial<ContextState>): Promise<ContextState> {
  const current = await getContextState()
  const updated: ContextState = {
    ...current,
    ...updates,
    lastUpdated: Date.now(),
  }

  try {
    await messageStorage.setItem(CONTEXT_STATE_KEY, updated)
  } catch {
    // Ignore errors
  }

  return updated
}

/**
 * Adds a file to recent files (with limit)
 */
export async function addRecentFile(filePath: string): Promise<void> {
  const state = await getContextState()
  const normalized = normalizePath(filePath)

  // Remove if already exists
  const recentFiles = state.recentFiles.filter((f) => f !== normalized)

  // Add to front
  recentFiles.unshift(normalized)

  // Limit to 20 most recent
  const limited = recentFiles.slice(0, 20)

  await updateContextState({ recentFiles: limited })
}

/**
 * Sets the current focus (files being worked on)
 */
export async function setCurrentFocus(files: string[]): Promise<void> {
  const normalized = files.map(normalizePath)
  await updateContextState({ currentFocus: normalized })

  // Also add to recent files
  for (const file of normalized) {
    await addRecentFile(file)
  }
}

/**
 * Detects which layer a file belongs to
 */
export function detectLayer(filePath: string, analysis: ProjectAnalysis): ContextState["activeLayer"] {
  const normalized = normalizePath(filePath)

  if (analysis.structure.contracts.includes(normalized)) {
    return "contract"
  }
  if (analysis.structure.backend.includes(normalized)) {
    return "backend"
  }
  if (analysis.structure.frontend.includes(normalized)) {
    return "frontend"
  }
  if (analysis.structure.tests.includes(normalized)) {
    return "test"
  }
  if (analysis.structure.config.includes(normalized)) {
    return "config"
  }

  return null
}

/**
 * Gets files related to the current focus
 */
export async function getRelatedFiles(
  focusFiles?: string[],
  maxFiles: number = 10,
): Promise<string[]> {
  const analysis = await getProjectAnalysis()
  if (!analysis) {
    return []
  }

  const state = await getContextState()
  const filesToCheck = focusFiles || state.currentFocus || state.recentFiles.slice(0, 3)

  if (filesToCheck.length === 0) {
    return []
  }

  const related = new Set<string>()

  // Find files that import or are imported by focus files
  for (const focusFile of filesToCheck) {
    const normalized = normalizePath(focusFile)

    // Find relationships where this file is involved
    for (const rel of analysis.relationships) {
      if (rel.from === normalized || rel.to === normalized) {
        // Add the other file in the relationship
        if (rel.from === normalized) {
          related.add(rel.to)
        } else {
          related.add(rel.from)
        }
      }
    }

    // Add files in the same directory
    const dir = getDirectory(normalized)
    const sameDirFiles = [
      ...analysis.structure.contracts,
      ...analysis.structure.backend,
      ...analysis.structure.frontend,
      ...analysis.structure.tests,
    ].filter((f) => getDirectory(f) === dir && f !== normalized)

    sameDirFiles.slice(0, 3).forEach((f) => related.add(f))
  }

  // Convert to array and limit
  const result = Array.from(related).slice(0, maxFiles)

  // Filter out files that don't exist
  return result.filter((f) => {
    const fullPath = join(env.cwd!, f)
    return existsSync(fullPath)
  })
}

/**
 * Gets context for a specific file or set of files
 */
export async function getFileContext(files: string[]): Promise<ProjectContext | null> {
  const analysis = await getProjectAnalysis()
  if (!analysis) {
    return null
  }

  const state = await getContextState()
  const normalized = files.map(normalizePath)

  // Detect active layer from first file
  const activeLayer = normalized.length > 0 ? detectLayer(normalized[0], analysis) : null

  // Get related files
  const relatedFiles = await getRelatedFiles(normalized, 15)

  // Update state
  await updateContextState({
    currentFocus: normalized,
    activeLayer,
  })

  return {
    analysis,
    state: {
      ...state,
      currentFocus: normalized,
      activeLayer,
    },
    relatedFiles,
  }
}

/**
 * Gets context summary for system prompt
 */
export async function getContextSummary(maxLength: number = 500): Promise<string> {
  const analysis = await getProjectAnalysis()
  const state = await getContextState()

  if (!analysis) {
    return ""
  }

  const parts: string[] = []

  // Stack information
  if (analysis.stack.contractFramework || analysis.stack.backendFramework || analysis.stack.frontendFramework) {
    const stackParts: string[] = []
    if (analysis.stack.contractFramework) {
      stackParts.push(`Contracts: ${analysis.stack.contractFramework}`)
    }
    if (analysis.stack.backendFramework) {
      stackParts.push(`Backend: ${analysis.stack.backendFramework}`)
    }
    if (analysis.stack.frontendFramework) {
      stackParts.push(`Frontend: ${analysis.stack.frontendFramework}`)
    }
    parts.push(`Stack: ${stackParts.join(", ")}`)
  }

  // Active layer
  if (state.activeLayer) {
    parts.push(`Currently working on: ${state.activeLayer} layer`)
  }

  // Current focus
  if (state.currentFocus && state.currentFocus.length > 0) {
    const focusFiles = state.currentFocus.slice(0, 3).map((f) => relative(env.cwd!, f))
    parts.push(`Focus files: ${focusFiles.join(", ")}`)
  }

  // Project structure summary
  const structureParts: string[] = []
  if (analysis.structure.contracts.length > 0) {
    structureParts.push(`${analysis.structure.contracts.length} contracts`)
  }
  if (analysis.structure.backend.length > 0) {
    structureParts.push(`${analysis.structure.backend.length} backend files`)
  }
  if (analysis.structure.frontend.length > 0) {
    structureParts.push(`${analysis.structure.frontend.length} frontend files`)
  }
  if (structureParts.length > 0) {
    parts.push(`Structure: ${structureParts.join(", ")}`)
  }

  const summary = parts.join(". ")
  return summary.length > maxLength ? summary.slice(0, maxLength) + "..." : summary
}

/**
 * Gets files that should be auto-loaded based on context
 */
export async function getContextFilesToLoad(): Promise<string[]> {
  const context = await getFileContext([])
  if (!context) {
    return []
  }

  const files = new Set<string>()

  // Add current focus files
  if (context.state.currentFocus) {
    context.state.currentFocus.forEach((f) => files.add(f))
  }

  // Add related files (limit to avoid too many)
  context.relatedFiles.slice(0, 5).forEach((f) => files.add(f))

  // Add config files if working on a specific layer
  if (context.state.activeLayer) {
    const configFiles = context.analysis.structure.config.filter((f) => {
      if (context.state.activeLayer === "contract") {
        return f.includes("hardhat") || f.includes("foundry") || f.includes("Anchor")
      }
      if (context.state.activeLayer === "backend" || context.state.activeLayer === "frontend") {
        return f.includes("tsconfig") || f.includes("package.json")
      }
      return false
    })
    configFiles.slice(0, 2).forEach((f) => files.add(f))
  }

  // Filter to only existing files
  return Array.from(files).filter((f) => {
    const fullPath = join(env.cwd!, f)
    return existsSync(fullPath)
  })
}

/**
 * Normalizes a file path to be relative to project root
 */
function normalizePath(filePath: string): string {
  // If absolute, make relative
  if (filePath.startsWith("/") || /^[A-Z]:/.test(filePath)) {
    return relative(env.cwd!, filePath)
  }
  return filePath
}

/**
 * Gets the directory of a file path
 */
function getDirectory(filePath: string): string {
  const parts = filePath.split("/")
  parts.pop() // Remove filename
  return parts.join("/")
}

/**
 * Checks if project analysis is stale and needs refresh
 */
export async function isAnalysisStale(maxAgeMs: number = 5 * 60 * 1000): Promise<boolean> {
  try {
    const cached = await messageStorage.getItem<ProjectAnalysis & { cachedAt: number }>(
      PROJECT_ANALYSIS_KEY,
    )
    if (!cached || !cached.cachedAt) {
      return true
    }

    const age = Date.now() - cached.cachedAt
    return age > maxAgeMs
  } catch {
    return true
  }
}

/**
 * Invalidates context when files change
 */
export async function invalidateContextForFile(filePath: string): Promise<void> {
  const normalized = normalizePath(filePath)
  const state = await getContextState()

  // Remove from current focus if it's there
  if (state.currentFocus) {
    const updated = state.currentFocus.filter((f) => f !== normalized)
    if (updated.length !== state.currentFocus.length) {
      await updateContextState({ currentFocus: updated.length > 0 ? updated : undefined })
    }
  }

  // Note: We don't invalidate the analysis itself here
  // The analyze-project tool should be called to refresh it
}
