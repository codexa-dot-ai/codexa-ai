# Codexa AI

Claude Code for crypto development.

```bash
npx opencoder@latest
```

## What is this?

Codexa AI is Claude Code, but built for crypto. Same terminal interface, same workflow, but with blockchain-native context and tools that actually understand on-chain state.

Crypto devs shouldn't have to context-switch between terminals, RPCs, explorers, and dashboards. Codexa AI brings it all into one place where the AI can read contracts, trace transactions, simulate mainnet, and help you build complete products—contracts, backends, and frontends—all in the same session.

## What's different?

**Right now:**
- Built-in tools to read Ethereum contracts and Solana accounts
- Transaction analysis and decoding
- Crypto-specific commands (`/balance`, `/gas`, `/network`)
- Project analysis that detects frameworks, maps structure, and builds dependency graphs
- System prompts optimized for Solidity, Rust, and blockchain patterns

**Coming next:**
- Full-stack product development: build contracts, APIs, and frontends together
- Project-aware AI that understands how your code connects across layers
- Simulation and testing on mainnet forks
- Deployment workflows that handle the entire stack
- MCP-based crypto tools for extensibility

## How it works

Built on [OpenCoder](https://github.com/ducan-ne/opencoder), which gives us the Claude Code foundation. Same core functionality, same tools, same workflow—but specialized for crypto development.

We've added:
- **Crypto-specific tools** for reading contracts, accounts, and transactions
- **Project context awareness** that understands how your contracts, backends, and frontends connect
- **Incremental development** workflows where you build step-by-step, not all at once
- **Cross-layer intelligence** that keeps everything in sync as you build

The AI tracks relationships between files, understands your stack, and helps you build complete products incrementally—contracts, APIs, and frontends together, with the AI maintaining consistency across layers.

## Quick start

```bash
npx opencoder@latest
```

Create a `coder.config.ts`:

```typescript
import { anthropic } from '@ai-sdk/anthropic'
import type { Config } from 'opencoder'

export default {
  model: anthropic('claude-haiku-4-5-20251001'),
} satisfies Config
```

Ask it to check a balance, read a contract, or help you build something. It understands Ethereum and Solana out of the box.

**Example:** Try "Create an ERC-20 token" and watch it suggest the full stack—contract, deployment script, backend API, and frontend hooks.

## MCP Integration

Extend Codexa AI with MCP tools:

```typescript
import { createMcp } from 'opencoder/mcp'

export default {
  mcp: [
    createMcp({
      name: 'etherscan',
      command: 'npx',
      args: ['@your-org/etherscan-mcp@latest'],
    }),
  ],
} satisfies Config
```

We're building crypto-specific MCP tools for Etherscan, DeFi protocols, and more. The ecosystem is extensible—build your own or use community tools.

## What's supported

**Networks:**
- Ethereum: Mainnet, Sepolia, Goerli, Holesky
- Solana: Mainnet, Devnet, Testnet

**Tools:**
- Read contract state and call view functions
- Read Solana program accounts
- Decode and analyze transactions
- All the standard Claude Code tools (file operations, grep, diagnostics, etc.)

**Note:** The CLI command is `opencoder` for backward compatibility, but the product is Codexa AI.

## Technical Architecture

Codexa AI uses a three-layer architecture:

**Core Tools (Built-in)**
Essential functionality that ships with Codexa AI: project analysis, code generation, testing, deployment, and relationship tracking. These are the foundation that makes incremental full-stack development possible.

**Context System**
A project-aware layer that maintains understanding of your codebase structure, tracks relationships between contracts and frontends, and provides intelligent context to the AI. When you work on a contract, it knows which backend APIs and frontend components use it.

**MCP/Plugins (Extensibility)**
External tools and services integrated via Model Context Protocol. Crypto-specific MCP tools for Etherscan, DeFi protocols, security analysis, and more. The ecosystem is extensible—use community tools or build your own.

This architecture lets you build complete crypto products step-by-step. The AI understands your project, suggests updates across layers when you make changes, and keeps everything consistent.

## Roadmap

**Phase 1: Foundation** (Current)
- ✅ Basic crypto tools (read contracts, accounts, transactions)
- ✅ Crypto-specific commands
- ✅ Project context awareness (analyzer detects frameworks, maps structure, builds dependency graph)
- ✅ Context manager (tracks relationships, provides intelligent context, auto-loads related files)
- ✅ Relationship tracker (updates dependencies on file changes, detects broken relationships)

**Phase 2: Full-Stack Development**
- Incremental code generation
- Cross-layer update suggestions
- Full-stack testing workflows
- Deployment orchestration

**Phase 3: Advanced Capabilities**
- Mainnet simulation and forking
- Transaction debugging and tracing
- Security analysis integration
- Crypto MCP tool ecosystem

Contributions welcome. This is early—help us shape it.
