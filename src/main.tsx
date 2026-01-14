import { QueryClientProvider } from "@tanstack/react-query"
import { render, Text } from "ink"
import type { Instance } from "ink"
import { join } from "node:path"
import { config } from "@/lib/config.js"
import { env } from "@/lib/env.js"
import { ensureGitIgnore, initConfig } from "@/lib/init.js"
import { queryClient } from "@/lib/query.js"
import { anthropic } from "@ai-sdk/anthropic"
import boxen from "boxen"
import chalk from "chalk"
import dotenv from "dotenv"
import { createStore, Provider } from "jotai"
import pkg from "../package.json" with { type: "json" }
import { App } from "./app.js"
import { AppProvider } from "./app/context.js"
import "source-map-support/register"
import React from "react"
import { tools } from "./tools/tools.js"
import { setTimeout } from "node:timers/promises"
import { createCoder } from "@/core.js"
import { resolve } from "node:path"

// Load .env file from project root (use env.cwd which finds the nearest package.json)
dotenv.config({ path: resolve(env.cwd || process.cwd(), ".env") })

/* class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  // eslint-disable-next-line node/handle-callback-err
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ hasError: true })
  }

  render() {
    if (this.state.hasError) {
      return <Text>Bad request...</Text>
    }
    return this.props.children
  }
} */

// FIXME
// if (import.meta.hot) {
//   import.meta.hot.accept(["./app.js"], () => {
//     setTimeout(() => {
//       console.clear()
//     }, 0)
//   })
// }

ensureGitIgnore()

const [command] = process.argv.slice(2)
if (command === "init") {
  await initConfig()

  process.exit(0)
}

if (import.meta.env.PROD) {
  const modelName = config.model?.modelId || "claude-haiku-4-5-20251001"
  console.log(
    boxen(
      `${chalk.bold.magenta("🚀 Welcome to Codexa AI")} ${chalk.dim(`v${pkg.version}`)}

${chalk.bold("Your AI Terminal for Crypto Development")}
${chalk.dim("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")}

${chalk.bold("📋 Session Info:")}
  ${chalk.magenta("•")} Model: ${chalk.cyan(modelName)}
  ${chalk.magenta("•")} Working directory: ${chalk.cyan(env.cwd)}

${chalk.bold("💎 Built-in Crypto Tools:")}
  ${chalk.magenta("•")} ${chalk.cyan("read-contract-state")} - Read Ethereum contract state & view functions
  ${chalk.magenta("•")} ${chalk.cyan("read-program-account")} - Read Solana program accounts & data  
  ${chalk.magenta("•")} ${chalk.cyan("read-transaction")} - Decode & analyze Ethereum transactions

${chalk.bold("⌨️  Quick Commands:")}
  ${chalk.magenta("/")}${chalk.cyan("help")} - Get help with Codexa AI
  ${chalk.magenta("/")}${chalk.cyan("clear")} - Clear chat history
  ${chalk.magenta("/")}${chalk.cyan("sync")} - Sync codebase to embeddings index

${chalk.bold("💡 Getting Started:")}
  ${chalk.dim("•")} Ask about Ethereum or Solana development
  ${chalk.dim("•")} Use tools to interact with blockchain data
  ${chalk.dim("•")} Example: "Check balance of 0x..." or "Read Solana account: ..."

${chalk.dim("Ready to build? Start typing your question below!")}`,
      {
        padding: { top: 1, bottom: 1, left: 2, right: 2 },
        borderColor: "magenta",
        borderStyle: "round",
        title: chalk.bold.magenta("Codexa AI"),
        titleAlignment: "center",
      },
    ),
  )
}

createCoder(config, command)
