/**
 * Relationship Tracker
 * 
 * Tracks file dependencies, updates graph on changes, and detects broken relationships.
 * Integrates with the Context Manager to maintain an up-to-date dependency graph.
 */

import { env } from "@/lib/env.js"
import { getProjectAnalysis, storeProjectAnalysis } from "@/lib/project-context.js"
import type { ProjectAnalysis, DependencyRelationship } from "@/lib/project-detector.js"
import { buildDependencyGraph } from "@/lib/project-detector.js"
import { existsSync, readFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { globby } from "globby"

export type BrokenRelationship = {
  from: string
  to: string
  type: DependencyRelationship["type"]
  reason: "file_missing" | "import_not_found" | "circular_dependency"
}

/**
 * Validates all relationships in the project analysis
 */
export async function validateRelationships(
  analysis?: ProjectAnalysis | null,
): Promise<BrokenRelationship[]> {
  const projectAnalysis = analysis || (await getProjectAnalysis())
  if (!projectAnalysis) {
    return []
  }

  const broken: BrokenRelationship[] = []
  const allFiles = new Set([
    ...projectAnalysis.structure.contracts,
    ...projectAnalysis.structure.backend,
    ...projectAnalysis.structure.frontend,
    ...projectAnalysis.structure.tests,
    ...projectAnalysis.structure.scripts,
    ...projectAnalysis.structure.other,
  ])

  for (const rel of projectAnalysis.relationships) {
    // Check if source file exists
    const fromPath = join(env.cwd!, rel.from)
    if (!existsSync(fromPath)) {
      broken.push({
        from: rel.from,
        to: rel.to,
        type: rel.type,
        reason: "file_missing",
      })
      continue
    }

    // Check if target file exists (for import relationships)
    if (rel.type === "import") {
      const toPath = join(env.cwd!, rel.to)
      if (!existsSync(toPath)) {
        // Try to find the file with different extensions
        const possiblePaths = [
          `${rel.to}.ts`,
          `${rel.to}.tsx`,
          `${rel.to}.js`,
          `${rel.to}.jsx`,
          `${rel.to}/index.ts`,
          `${rel.to}/index.tsx`,
          `${rel.to}/index.js`,
          `${rel.to}/index.jsx`,
        ]

        const found = possiblePaths.find((p) => {
          const fullPath = join(env.cwd!, p)
          return existsSync(fullPath) && allFiles.has(p)
        })

        if (!found) {
          broken.push({
            from: rel.from,
            to: rel.to,
            type: rel.type,
            reason: "import_not_found",
          })
        }
      }
    }

    // Check for circular dependencies (simple check - A -> B -> A)
    if (rel.type === "import") {
      const circular = projectAnalysis.relationships.find(
        (r) => r.from === rel.to && r.to === rel.from && r.type === "import",
      )
      if (circular) {
        broken.push({
          from: rel.from,
          to: rel.to,
          type: rel.type,
          reason: "circular_dependency",
        })
      }
    }
  }

  return broken
}

/**
 * Updates relationships for a specific file
 */
export async function updateFileRelationships(filePath: string): Promise<void> {
  const analysis = await getProjectAnalysis()
  if (!analysis) {
    return
  }

  // Remove old relationships involving this file
  const updatedRelationships = analysis.relationships.filter(
    (rel) => rel.from !== filePath && rel.to !== filePath,
  )

  // Rebuild relationships for this file
  try {
    if (!existsSync(join(env.cwd!, filePath))) {
      // File was deleted, relationships already removed
      await storeProjectAnalysis({
        ...analysis,
        relationships: updatedRelationships,
        analyzedAt: Date.now(),
      })
      return
    }

    // Get file content
    const content = readFileSync(join(env.cwd!, filePath), "utf-8")

    // Check if it's a TypeScript/JavaScript file
    if (/\.(ts|tsx|js|jsx)$/.test(filePath)) {
      const newRelationships = extractImportsFromFile(filePath, content, analysis)
      updatedRelationships.push(...newRelationships)
    }

    // Update analysis
    await storeProjectAnalysis({
      ...analysis,
      relationships: updatedRelationships,
      analyzedAt: Date.now(),
    })
  } catch {
    // Ignore errors - file might not exist or be unreadable
  }
}

/**
 * Extracts import relationships from a single file
 */
function extractImportsFromFile(
  filePath: string,
  content: string,
  analysis: ProjectAnalysis,
): DependencyRelationship[] {
  const relationships: DependencyRelationship[] = []
  const allFiles = new Set([
    ...analysis.structure.contracts,
    ...analysis.structure.backend,
    ...analysis.structure.frontend,
    ...analysis.structure.tests,
    ...analysis.structure.scripts,
    ...analysis.structure.other,
  ])

  // Match ES6 imports and CommonJS requires
  const importRegex =
    /import\s+(?:.*\s+from\s+)?["']([^"']+)["']|require\s*\(\s*["']([^"']+)["']\s*\)|from\s+["']([^"']+)["']/g
  let match

  while ((match = importRegex.exec(content)) !== null) {
    const importPath = match[1] || match[2] || match[3]
    if (!importPath) {
      continue
    }

    // Skip node_modules and external packages
    if (importPath.includes("node_modules") || importPath.startsWith("@types/")) {
      continue
    }

    // Handle relative imports
    if (importPath.startsWith(".") || importPath.startsWith("/")) {
      try {
        const fileDir = dirname(filePath)
        const resolvedBase = importPath.startsWith("/")
          ? importPath.slice(1)
          : join(fileDir, importPath)

        // Normalize path separators
        const normalized = resolvedBase.split(/[/\\]/).filter(Boolean).join("/")

        // Try to find matching file
        const possiblePaths = [
          normalized,
          `${normalized}.ts`,
          `${normalized}.tsx`,
          `${normalized}.js`,
          `${normalized}.jsx`,
          `${normalized}/index.ts`,
          `${normalized}/index.tsx`,
          `${normalized}/index.js`,
          `${normalized}/index.jsx`,
        ]

        const matchedPath = possiblePaths.find((p) => allFiles.has(p))

        if (matchedPath) {
          relationships.push({
            from: filePath,
            to: matchedPath,
            type: "import",
          })
        }
      } catch {
        // Ignore resolution errors
      }
    }
  }

  return relationships
}

/**
 * Refreshes relationships for all files (useful after major changes)
 */
export async function refreshAllRelationships(): Promise<void> {
  const analysis = await getProjectAnalysis()
  if (!analysis) {
    return
  }

  // Rebuild the entire dependency graph
  const newRelationships = await buildDependencyGraph(analysis.structure)

  // Update analysis
  await storeProjectAnalysis({
    ...analysis,
    relationships: newRelationships,
    analyzedAt: Date.now(),
  })
}

/**
 * Gets relationships for a specific file
 */
export async function getFileRelationships(filePath: string): Promise<{
  imports: string[] // Files this file imports
  importedBy: string[] // Files that import this file
}> {
  const analysis = await getProjectAnalysis()
  if (!analysis) {
    return { imports: [], importedBy: [] }
  }

  const imports = analysis.relationships
    .filter((rel) => rel.from === filePath && rel.type === "import")
    .map((rel) => rel.to)

  const importedBy = analysis.relationships
    .filter((rel) => rel.to === filePath && rel.type === "import")
    .map((rel) => rel.from)

  return { imports, importedBy }
}

/**
 * Finds all files that depend on a given file (transitive)
 */
export async function findDependentFiles(filePath: string): Promise<string[]> {
  const analysis = await getProjectAnalysis()
  if (!analysis) {
    return []
  }

  const dependents = new Set<string>()
  const visited = new Set<string>()

  function traverse(currentFile: string) {
    if (visited.has(currentFile)) {
      return
    }
    visited.add(currentFile)

    // Find files that import currentFile
    const importing = analysis.relationships
      .filter((rel) => rel.to === currentFile && rel.type === "import")
      .map((rel) => rel.from)

    for (const importer of importing) {
      dependents.add(importer)
      traverse(importer) // Recursively find dependents of dependents
    }
  }

  traverse(filePath)
  return Array.from(dependents)
}

/**
 * Checks if relationships need refresh (based on file modification times)
 */
export async function shouldRefreshRelationships(maxAgeMs: number = 5 * 60 * 1000): Promise<boolean> {
  const analysis = await getProjectAnalysis()
  if (!analysis) {
    return true
  }

  const age = Date.now() - analysis.analyzedAt
  return age > maxAgeMs
}
