/**
 * Project detection utilities for analyzing project structure and frameworks
 */

import { env } from "@/lib/env.js"
import { existsSync, readFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { globby } from "globby"

export type ProjectStack = {
  contractFramework?: "hardhat" | "foundry" | "anchor" | "truffle" | "brownie" | null
  backendFramework?: "express" | "nextjs" | "fastify" | "nest" | "fastapi" | "django" | "flask" | null
  frontendFramework?: "nextjs" | "react" | "vue" | "svelte" | "solid" | null
  language?: "typescript" | "javascript" | "python" | "rust" | "solidity" | null
  packageManager?: "npm" | "yarn" | "pnpm" | "bun" | null
  monorepo?: boolean
}

export type ProjectStructure = {
  contracts: string[]
  backend: string[]
  frontend: string[]
  tests: string[]
  config: string[]
  scripts: string[]
  other: string[]
}

export type DependencyRelationship = {
  from: string
  to: string
  type: "import" | "contract" | "config" | "test" | "unknown"
}

export type ProjectAnalysis = {
  stack: ProjectStack
  structure: ProjectStructure
  relationships: DependencyRelationship[]
  rootPath: string
  analyzedAt: number
}

/**
 * Detects the contract framework being used
 */
export async function detectContractFramework(): Promise<ProjectStack["contractFramework"]> {
  const cwd = env.cwd!

  // Check for Hardhat
  if (existsSync(join(cwd, "hardhat.config.ts")) || existsSync(join(cwd, "hardhat.config.js"))) {
    return "hardhat"
  }

  // Check for Foundry
  if (existsSync(join(cwd, "foundry.toml"))) {
    return "foundry"
  }

  // Check for Anchor (Solana)
  if (existsSync(join(cwd, "Anchor.toml"))) {
    return "anchor"
  }

  // Check for Truffle
  if (existsSync(join(cwd, "truffle-config.js")) || existsSync(join(cwd, "truffle.js"))) {
    return "truffle"
  }

  // Check package.json for dependencies
  const packageJsonPath = join(cwd, "package.json")
  if (existsSync(packageJsonPath)) {
    try {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"))
      const deps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      }

      if (deps.hardhat || deps["@nomicfoundation/hardhat-toolbox"]) {
        return "hardhat"
      }
      if (deps["@anchor-lang/anchor"]) {
        return "anchor"
      }
      if (deps["truffle"]) {
        return "truffle"
      }
    } catch {
      // Ignore parsing errors
    }
  }

  // Check for Brownie (Python-based)
  if (existsSync(join(cwd, "brownie-config.yaml")) || existsSync(join(cwd, "brownie-config.yml"))) {
    return "brownie"
  }

  // Check for contract directories (common patterns)
  const contractDirs = await globby(["contracts/**/*.sol", "src/**/*.sol", "scripts/**/*.sol"], {
    cwd,
    gitignore: true,
  })

  if (contractDirs.length > 0) {
    // If we have Solidity files but no framework detected, return null
    // This indicates contracts exist but framework is unclear
    return null
  }

  return null
}

/**
 * Detects the backend framework
 */
export async function detectBackendFramework(): Promise<ProjectStack["backendFramework"]> {
  const cwd = env.cwd!

  // Check for Next.js (could be full-stack)
  if (
    existsSync(join(cwd, "next.config.js")) ||
    existsSync(join(cwd, "next.config.ts")) ||
    existsSync(join(cwd, "next.config.mjs"))
  ) {
    return "nextjs"
  }

  // Check for Express
  const expressFiles = await globby(["**/server.js", "**/server.ts", "**/app.js", "**/app.ts"], {
    cwd,
    gitignore: true,
    ignore: ["**/node_modules/**"],
  })

  // Check package.json
  const packageJsonPath = join(cwd, "package.json")
  if (existsSync(packageJsonPath)) {
    try {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"))
      const deps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      }

      if (deps.next || deps["next"]) {
        return "nextjs"
      }
      if (deps.express) {
        return "express"
      }
      if (deps.fastify) {
        return "fastify"
      }
      if (deps["@nestjs/core"]) {
        return "nest"
      }
      if (deps["fastapi"] || deps["uvicorn"]) {
        return "fastapi"
      }
      if (deps["django"]) {
        return "django"
      }
      if (deps["flask"]) {
        return "flask"
      }
    } catch {
      // Ignore parsing errors
    }
  }

  // Check for Python backend files
  const pythonBackend = await globby(
    ["**/app.py", "**/main.py", "**/manage.py", "**/wsgi.py", "**/asgi.py"],
    {
      cwd,
      gitignore: true,
      ignore: ["**/node_modules/**", "**/venv/**", "**/env/**"],
    },
  )

  if (pythonBackend.length > 0) {
    // Try to determine which Python framework
    const hasDjango = pythonBackend.some((f) => f.includes("manage.py") || f.includes("wsgi.py"))
    const hasFastAPI = pythonBackend.some((f) => f.includes("asgi.py"))

    if (hasDjango) {
      return "django"
    }
    if (hasFastAPI) {
      return "fastapi"
    }
    return "flask" // Default guess for Python backend
  }

  if (expressFiles.length > 0) {
    return "express"
  }

  return null
}

/**
 * Detects the frontend framework
 */
export async function detectFrontendFramework(): Promise<ProjectStack["frontendFramework"]> {
  const cwd = env.cwd!

  // Check for Next.js
  if (
    existsSync(join(cwd, "next.config.js")) ||
    existsSync(join(cwd, "next.config.ts")) ||
    existsSync(join(cwd, "next.config.mjs"))
  ) {
    return "nextjs"
  }

  // Check package.json
  const packageJsonPath = join(cwd, "package.json")
  if (existsSync(packageJsonPath)) {
    try {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"))
      const deps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      }

      if (deps.next || deps["next"]) {
        return "nextjs"
      }
      if (deps.react || deps["react-dom"]) {
        return "react"
      }
      if (deps.vue || deps["vue3"]) {
        return "vue"
      }
      if (deps["svelte"]) {
        return "svelte"
      }
      if (deps["solid-js"]) {
        return "solid"
      }
    } catch {
      // Ignore parsing errors
    }
  }

  // Check for React files (components, pages)
  const reactFiles = await globby(
    ["**/*.jsx", "**/*.tsx", "**/components/**", "**/pages/**", "**/src/App.jsx", "**/src/App.tsx"],
    {
      cwd,
      gitignore: true,
      ignore: ["**/node_modules/**"],
    },
  )

  if (reactFiles.length > 0) {
    // Check if it's Next.js or plain React
    const hasNextPages = reactFiles.some((f) => f.includes("pages/") || f.includes("app/"))
    return hasNextPages ? "nextjs" : "react"
  }

  // Check for Vue files
  const vueFiles = await globby(["**/*.vue", "**/src/App.vue"], {
    cwd,
    gitignore: true,
    ignore: ["**/node_modules/**"],
  })

  if (vueFiles.length > 0) {
    return "vue"
  }

  return null
}

/**
 * Detects the primary language
 */
export async function detectLanguage(): Promise<ProjectStack["language"]> {
  const cwd = env.cwd!

  // Count files by extension
  const tsFiles = await globby(["**/*.ts", "**/*.tsx"], {
    cwd,
    gitignore: true,
    ignore: ["**/node_modules/**"],
  })

  const jsFiles = await globby(["**/*.js", "**/*.jsx", "**/*.mjs", "**/*.cjs"], {
    cwd,
    gitignore: true,
    ignore: ["**/node_modules/**"],
  })

  const solFiles = await globby(["**/*.sol"], {
    cwd,
    gitignore: true,
    ignore: ["**/node_modules/**"],
  })

  const rsFiles = await globby(["**/*.rs"], {
    cwd,
    gitignore: true,
    ignore: ["**/node_modules/**"],
  })

  const pyFiles = await globby(["**/*.py"], {
    cwd,
    gitignore: true,
    ignore: ["**/node_modules/**", "**/venv/**", "**/env/**"],
  })

  // Check for TypeScript config
  if (existsSync(join(cwd, "tsconfig.json"))) {
    if (tsFiles.length > 0) {
      return "typescript"
    }
  }

  // Prioritize by count
  const counts = [
    { lang: "typescript" as const, count: tsFiles.length },
    { lang: "javascript" as const, count: jsFiles.length },
    { lang: "solidity" as const, count: solFiles.length },
    { lang: "rust" as const, count: rsFiles.length },
    { lang: "python" as const, count: pyFiles.length },
  ]

  const maxCount = Math.max(...counts.map((c) => c.count))
  if (maxCount > 0) {
    return counts.find((c) => c.count === maxCount)?.lang || null
  }

  return null
}

/**
 * Detects package manager
 */
export async function detectPackageManager(): Promise<ProjectStack["packageManager"]> {
  const cwd = env.cwd!

  if (existsSync(join(cwd, "pnpm-lock.yaml"))) {
    return "pnpm"
  }
  if (existsSync(join(cwd, "yarn.lock"))) {
    return "yarn"
  }
  if (existsSync(join(cwd, "bun.lockb")) || existsSync(join(cwd, "bun.lock"))) {
    return "bun"
  }
  if (existsSync(join(cwd, "package-lock.json"))) {
    return "npm"
  }

  // Check for workspace files
  const packageJsonPath = join(cwd, "package.json")
  if (existsSync(packageJsonPath)) {
    try {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"))
      if (packageJson.workspaces || packageJson.workspaces?.length > 0) {
        // Default to npm for workspaces if no lock file found
        return "npm"
      }
    } catch {
      // Ignore parsing errors
    }
  }

  return null
}

/**
 * Checks if project is a monorepo
 */
export async function detectMonorepo(): Promise<boolean> {
  const cwd = env.cwd!

  // Check for workspace configuration
  const packageJsonPath = join(cwd, "package.json")
  if (existsSync(packageJsonPath)) {
    try {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"))
      if (packageJson.workspaces && Array.isArray(packageJson.workspaces) && packageJson.workspaces.length > 0) {
        return true
      }
    } catch {
      // Ignore parsing errors
    }
  }

  // Check for common monorepo patterns
  const monorepoIndicators = [
    "apps/",
    "packages/",
    "workspaces/",
    "lerna.json",
    "pnpm-workspace.yaml",
    "rush.json",
  ]

  for (const indicator of monorepoIndicators) {
    if (existsSync(join(cwd, indicator))) {
      return true
    }
  }

  // Check for multiple package.json files
  const packageJsonFiles = await globby(["**/package.json"], {
    cwd,
    gitignore: true,
    ignore: ["**/node_modules/**"],
  })

  return packageJsonFiles.length > 1
}

/**
 * Maps project structure into categories
 */
export async function mapProjectStructure(): Promise<ProjectStructure> {
  const cwd = env.cwd!
  const defaultIgnore = [
    "**/node_modules/**",
    "**/dist/**",
    "**/build/**",
    "**/out/**",
    "**/.next/**",
    "**/.git/**",
    "**/.coder/**",
  ]

  // Find contract files
  const contracts = await globby(
    ["contracts/**/*.{sol,rs}", "src/**/*.{sol,rs}", "scripts/**/*.sol", "programs/**/*.rs"],
    {
      cwd,
      gitignore: true,
      ignore: defaultIgnore,
      absolute: false,
    },
  )

  // Find backend files
  const backend = await globby(
    [
      "backend/**/*.{ts,js,tsx,jsx,py}",
      "server/**/*.{ts,js,tsx,jsx,py}",
      "api/**/*.{ts,js,tsx,jsx,py}",
      "src/api/**/*.{ts,js,tsx,jsx}",
      "src/server/**/*.{ts,js,tsx,jsx}",
      "src/backend/**/*.{ts,js,tsx,jsx}",
      "app/api/**/*.{ts,js,tsx,jsx}",
    ],
    {
      cwd,
      gitignore: true,
      ignore: defaultIgnore,
      absolute: false,
    },
  )

  // Find frontend files
  const frontend = await globby(
    [
      "frontend/**/*.{ts,js,tsx,jsx,vue,svelte}",
      "client/**/*.{ts,js,tsx,jsx,vue,svelte}",
      "web/**/*.{ts,js,tsx,jsx,vue,svelte}",
      "src/components/**/*.{ts,js,tsx,jsx,vue,svelte}",
      "src/pages/**/*.{ts,js,tsx,jsx,vue,svelte}",
      "src/app/**/*.{ts,js,tsx,jsx,vue,svelte}",
      "app/**/*.{ts,js,tsx,jsx,vue,svelte}",
      "pages/**/*.{ts,js,tsx,jsx,vue,svelte}",
      "components/**/*.{ts,js,tsx,jsx,vue,svelte}",
    ],
    {
      cwd,
      gitignore: true,
      ignore: defaultIgnore,
      absolute: false,
    },
  )

  // Find test files
  const tests = await globby(
    [
      "**/*.test.{ts,js,tsx,jsx,sol,rs,py}",
      "**/*.spec.{ts,js,tsx,jsx,sol,rs,py}",
      "test/**/*.{ts,js,tsx,jsx,sol,rs,py}",
      "tests/**/*.{ts,js,tsx,jsx,sol,rs,py}",
      "__tests__/**/*.{ts,js,tsx,jsx,py}",
    ],
    {
      cwd,
      gitignore: true,
      ignore: defaultIgnore,
      absolute: false,
    },
  )

  // Find config files
  const config = await globby(
    [
      "**/*.config.{ts,js,json}",
      "**/*config.{ts,js,json}",
      "**/tsconfig.json",
      "**/package.json",
      "**/hardhat.config.*",
      "**/foundry.toml",
      "**/Anchor.toml",
      "**/next.config.*",
    ],
    {
      cwd,
      gitignore: true,
      ignore: defaultIgnore,
      absolute: false,
    },
  )

  // Find script files
  const scripts = await globby(
    ["scripts/**/*.{ts,js,py,sh}", "**/deploy.*", "**/migrate.*", "**/seed.*"],
    {
      cwd,
      gitignore: true,
      ignore: defaultIgnore,
      absolute: false,
    },
  )

  // Get all other relevant source files
  const allSourceFiles = await globby(
    ["**/*.{ts,js,tsx,jsx,py,rs,sol}"],
    {
      cwd,
      gitignore: true,
      ignore: defaultIgnore,
      absolute: false,
    },
  )

  // Filter out files already categorized
  const categorized = new Set([
    ...contracts,
    ...backend,
    ...frontend,
    ...tests,
    ...config,
    ...scripts,
  ])

  const other = allSourceFiles.filter((f) => !categorized.has(f))

  return {
    contracts,
    backend,
    frontend,
    tests,
    config,
    scripts,
    other,
  }
}

/**
 * Builds a dependency graph by analyzing imports and references
 * This is a simplified version - full implementation would parse AST
 */
export async function buildDependencyGraph(structure: ProjectStructure): Promise<DependencyRelationship[]> {
  const cwd = env.cwd!
  const relationships: DependencyRelationship[] = []
  const allFiles = new Set([
    ...structure.contracts,
    ...structure.backend,
    ...structure.frontend,
    ...structure.tests,
    ...structure.scripts,
    ...structure.other,
  ])

  // Analyze imports in TypeScript/JavaScript files
  const tsJsFiles = [...structure.backend, ...structure.frontend, ...structure.other].filter((f) =>
    /\.(ts|tsx|js|jsx)$/.test(f),
  )

  // Limit to first 100 files to avoid performance issues
  const filesToAnalyze = tsJsFiles.slice(0, 100)

  for (const file of filesToAnalyze) {
    try {
      const fullPath = join(cwd, file)
      if (!existsSync(fullPath)) {
        continue
      }

      const content = readFileSync(fullPath, "utf-8")
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
            // Try to resolve the import path
            const fileDir = dirname(file)
            const resolvedBase = importPath.startsWith("/")
              ? importPath.slice(1) // Remove leading slash
              : join(fileDir, importPath)

            // Normalize path separators
            const normalized = resolvedBase.split(/[/\\]/).filter(Boolean).join("/")

            // Try to find matching file (with or without extension)
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

            // Find if any of these paths exist in our file set
            const matchedPath = possiblePaths.find((p) => allFiles.has(p))

            if (matchedPath) {
              relationships.push({
                from: file,
                to: matchedPath,
                type: "import",
              })
            }
          } catch {
            // Ignore resolution errors
          }
        } else {
          // Internal package reference (might be a monorepo package)
          // Only track if it looks like an internal reference
          if (!importPath.includes(".") && !importPath.includes("/")) {
            relationships.push({
              from: file,
              to: importPath,
              type: "import",
            })
          }
        }
      }
    } catch {
      // Ignore errors for individual files
    }
  }

  // Analyze contract relationships (contract → test, contract → script)
  for (const contract of structure.contracts) {
    // Extract contract name (handle both .sol and .rs files)
    const contractName = contract
      .replace(/^.*[\\/]/, "") // Get filename
      .replace(/\.(sol|rs)$/, "") // Remove extension
      .replace(/[^a-zA-Z0-9]/g, "") // Normalize name

    if (!contractName) {
      continue
    }

    // Find tests that might test this contract
    for (const test of structure.tests) {
      const testName = test
        .replace(/^.*[\\/]/, "")
        .replace(/\.(test|spec)\.(ts|js|tsx|jsx|sol|rs)$/, "")
        .replace(/[^a-zA-Z0-9]/g, "")

      // Check if test name contains contract name (case-insensitive)
      if (testName.toLowerCase().includes(contractName.toLowerCase())) {
        relationships.push({
          from: test,
          to: contract,
          type: "test",
        })
      }
    }

    // Check for scripts that might deploy or interact with this contract
    for (const script of structure.scripts) {
      try {
        const scriptPath = join(cwd, script)
        if (existsSync(scriptPath)) {
          const scriptContent = readFileSync(scriptPath, "utf-8")
          // Check if script references the contract
          if (scriptContent.includes(contractName) || scriptContent.includes(contract)) {
            relationships.push({
              from: script,
              to: contract,
              type: "config", // Using config type for script→contract relationship
            })
          }
        }
      } catch {
        // Ignore errors for individual scripts
      }
    }
  }

  // Analyze config relationships (only add direct relationships, not all files)
  // Only add relationships for tsconfig.json files to TypeScript files in same directory or subdirectories
  for (const configFile of structure.config) {
    if (configFile.includes("tsconfig.json")) {
      const configDir = dirname(configFile)
      // Find TypeScript files in the same directory or subdirectories
      const relatedFiles = [...structure.backend, ...structure.frontend].filter((f) => {
        if (!/\.tsx?$/.test(f)) {
          return false
        }
        const fileDir = dirname(f)
        return fileDir === configDir || fileDir.startsWith(configDir + "/")
      })

      // Limit to prevent too many relationships
      for (const file of relatedFiles.slice(0, 20)) {
        relationships.push({
          from: file,
          to: configFile,
          type: "config",
        })
      }
    }
  }

  return relationships
}

/**
 * Performs a complete project analysis
 */
export async function analyzeProject(): Promise<ProjectAnalysis> {
  const stack: ProjectStack = {
    contractFramework: await detectContractFramework(),
    backendFramework: await detectBackendFramework(),
    frontendFramework: await detectFrontendFramework(),
    language: await detectLanguage(),
    packageManager: await detectPackageManager(),
    monorepo: await detectMonorepo(),
  }

  const structure = await mapProjectStructure()
  const relationships = await buildDependencyGraph(structure)

  return {
    stack,
    structure,
    relationships,
    rootPath: env.cwd!,
    analyzedAt: Date.now(),
  }
}
