# Codexa AI Development Plan

## Vision

Claude Code for crypto development. Same UX, same workflow, but with blockchain-native context and tools that let the AI actually operate on-chain state, simulate mainnet, debug transactions, and help build complete products—contracts, backends, and frontends—all in one place.

## Current State

**What we have:**
- ✅ Built-in crypto tools: read contract state, read Solana accounts, decode transactions
- ✅ Crypto-specific commands: `/balance`, `/gas`, `/network`, `/verify`, `/explorer`
- ✅ Enhanced UI for blockchain data (network badges, formatted addresses, explorer links)
- ✅ Crypto-focused system prompts optimized for Solidity, Rust, and blockchain patterns
- ✅ All core Claude Code functionality (file operations, grep, diagnostics, etc.)

**What's missing:**
- Project context awareness (AI doesn't understand project structure)
- Incremental full-stack development (can't build contracts + backend + frontend together)
- Cross-layer intelligence (changes to contracts don't update related files)
- Simulation capabilities (can't test on mainnet forks)
- Deployment workflows (manual deployment process)

## Architecture

### Three-Layer System

#### Layer 1: Core Tools (Built-in)

Essential functionality that ships with Codexa AI:

**Project Awareness:**
- `analyze-project` - Scans project structure, detects stack, maps relationships
- `load-project-context` - Intelligently loads relevant files for current task
- `track-relationships` - Maintains dependency graph (contract → backend → frontend)

**Development:**
- `generate-code` - Incremental code generation that understands existing structure
- `update-related-files` - Suggests/updates related files when changes are made
- Enhanced file operations that maintain consistency

**Testing:**
- `run-tests` - Detects framework (Hardhat, Foundry, Anchor), runs tests, shows results
- `debug-test` - Analyzes failures, traces through code, suggests fixes

**Deployment:**
- `deploy-contract` - Compiles, deploys, verifies, updates configs
- `deploy-backend` - Deploys backend, updates environment
- `deploy-frontend` - Builds and deploys frontend

**Why built-in:** These are core to the experience. Users expect them to work out of the box.

#### Layer 2: Context System

The intelligence layer that makes everything work together:

**Project Context Manager:**
```typescript
type ProjectContext = {
  structure: {
    contracts: string[]
    backend: string[]
    frontend: string[]
    tests: string[]
  }
  relationships: {
    contractToBackend: Map<string, string[]>
    backendToFrontend: Map<string, string[]>
    contractToTests: Map<string, string[]>
  }
  stack: {
    contractFramework: 'hardhat' | 'foundry' | 'anchor'
    backendFramework: 'express' | 'nextjs' | 'fastapi'
    frontendFramework: 'react' | 'nextjs' | 'vue'
  }
  abis: Map<string, any>
  types: Map<string, string>
}
```

**Smart Context Loading:**
- When working on contract → auto-loads related tests, backend APIs, frontend components
- When working on backend → auto-loads contract ABIs, frontend hooks
- When working on frontend → auto-loads API types, contract interfaces

**Relationship Tracker:**
- Tracks when files change
- Updates relationship graph
- Detects broken relationships
- Suggests fixes

**Why separate system:** Complex logic that needs to be reusable across tools and maintainable.

#### Layer 3: MCP/Plugins (Extensibility)

External tools and services integrated via Model Context Protocol:

**Crypto MCP Tools:**
- Etherscan MCP - Contract verification, ABI fetching, event monitoring
- Solscan MCP - Solana explorer integration
- DeFi MCP - Price feeds, DEX data, yield analytics
- NFT MCP - Collection data, metadata, pricing
- Security MCP - Contract analysis, vulnerability detection

**Why MCP:**
- External services change frequently
- Community can build their own
- Keeps core lean
- Easy to add/remove

## Implementation Plan

### Phase 1: Foundation (Current → Next 2-3 weeks)

**Goal:** Enable project awareness and incremental development

**Tasks:**

1. **Project Analyzer Tool**
   - Scans project structure on startup
   - Detects stack (Hardhat, Foundry, Next.js, etc.)
   - Maps file relationships
   - Creates initial project graph
   - **File:** `src/tools/analyze-project.tsx`

2. **Context Manager**
   - Maintains project state
   - Tracks relationships
   - Provides context to AI
   - Updates on file changes
   - **File:** `src/lib/project-context.ts`

3. **Smart Context Loading**
   - Enhances system prompt with project context
   - Auto-loads related files
   - Understands dependencies
   - **File:** Enhance `src/lib/prompts.ts`

4. **Relationship Tracker**
   - Tracks file dependencies
   - Updates graph on changes
   - Detects broken relationships
   - **File:** `src/lib/relationship-tracker.ts`

**Success Criteria:**
- AI understands project structure
- AI knows which files relate to which
- AI can work incrementally on existing projects

### Phase 2: Incremental Development (Weeks 4-6)

**Goal:** Enable step-by-step full-stack development

**Tasks:**

1. **Incremental Code Generation**
   - Generate code that integrates with existing files
   - Understand existing structure
   - Maintain consistency
   - **File:** `src/tools/generate-code.tsx`

2. **Cross-Layer Update Tool**
   - Detects when contracts change
   - Suggests backend/frontend updates
   - Maintains type consistency
   - **File:** `src/tools/update-related.tsx`

3. **Test Runner Integration**
   - Detects test framework
   - Runs tests automatically
   - Shows results clearly
   - Parses failures
   - **File:** `src/tools/run-tests.tsx`

4. **Type Consistency System**
   - Generate TypeScript types from ABIs
   - Keep types in sync across layers
   - Auto-update when contracts change
   - **File:** `src/lib/type-generator.ts`

**Success Criteria:**
- Users can build contracts step-by-step
- Changes to contracts suggest backend/frontend updates
- Tests run automatically
- Types stay consistent

### Phase 3: Full-Stack Workflows (Weeks 7-9)

**Goal:** Complete product development workflows

**Tasks:**

1. **Deployment Orchestration**
   - Deploy contracts first
   - Update backend config with addresses
   - Deploy backend
   - Update frontend config
   - Deploy frontend
   - **File:** `src/tools/deploy-product.tsx`

2. **Frontend Integration Helpers**
   - Generate React hooks from ABIs
   - Generate API integration code
   - Generate TypeScript types
   - **File:** `src/tools/generate-frontend.tsx`

3. **Backend Integration Helpers**
   - Generate API endpoints from contracts
   - Generate Web3 integration code
   - Generate event listeners
   - **File:** `src/tools/generate-backend.tsx`

4. **Full-Stack Testing**
   - Run tests across all layers
   - Show unified results
   - Debug cross-layer issues
   - **File:** Enhance `src/tools/run-tests.tsx`

**Success Criteria:**
- Users can deploy complete products with one command
- Frontend and backend code generated from contracts
- Tests run across entire stack
- Everything stays in sync

### Phase 4: Advanced Capabilities (Weeks 10-12)

**Goal:** Simulation, debugging, and security

**Tasks:**

1. **Simulation Integration**
   - Fork mainnet with Anvil (Ethereum)
   - Fork mainnet with local validator (Solana)
   - Simulate transactions
   - **File:** `src/tools/simulate-transaction.tsx`

2. **Transaction Debugging**
   - Trace execution step-by-step
   - Show revert reasons
   - Analyze gas usage
   - **File:** `src/tools/debug-transaction.tsx`

3. **Security Analysis**
   - Integrate Slither (Ethereum)
   - Run security checks
   - Show vulnerabilities
   - **File:** `src/tools/analyze-security.tsx`

4. **First Crypto MCP Tool**
   - Etherscan MCP as proof of concept
   - Document MCP pattern
   - Create examples
   - **File:** `src/mcp/etherscan.ts`

**Success Criteria:**
- Users can simulate transactions on mainnet forks
- Users can debug failed transactions
- Security analysis runs automatically
- MCP ecosystem is established

## Technical Decisions

### 1. Project Analysis

**Approach:** Cached with smart invalidation
- Cache project structure on startup
- Update when files change
- Refresh on demand
- **Rationale:** Fast and efficient, avoids repeated analysis

### 2. Relationship Tracking

**Approach:** Hybrid (pattern matching + static analysis)
- Pattern matching for common cases (imports, ABIs)
- Static analysis for complex cases
- User can override
- **Rationale:** Balances accuracy with simplicity

### 3. Context Loading

**Approach:** Hybrid (basic in prompt + detailed via tool)
- Basic project context always in system prompt
- Detailed context fetched via tool when needed
- **Rationale:** Efficient token usage, detailed when needed

### 4. Code Generation

**Approach:** Incremental, not one-shot
- Add to existing files
- Understand existing structure
- Maintain consistency
- **Rationale:** Users stay in control, builds step-by-step

### 5. MCP vs Built-in

**Built-in:**
- Project analysis
- Code generation
- Testing
- Deployment
- Relationship tracking

**MCP:**
- External APIs (Etherscan, Solscan)
- Specialized services (DeFi, NFT)
- Community tools
- Third-party integrations

**Rationale:** Core functionality built-in, extensibility via MCP

## File Structure

```
src/
  lib/
    project-context.ts          # Project context manager
    relationship-tracker.ts     # Tracks file relationships
    context-loader.ts            # Smart context loading
    type-generator.ts            # Type generation from ABIs
    
  tools/
    analyze-project.tsx          # Project analysis tool
    generate-code.tsx            # Incremental code generation
    update-related.tsx           # Cross-layer updates
    run-tests.tsx                # Test runner
    deploy-contract.tsx          # Contract deployment (enhanced)
    deploy-backend.tsx           # Backend deployment
    deploy-frontend.tsx           # Frontend deployment
    deploy-product.tsx           # Full-stack deployment
    simulate-transaction.tsx     # Transaction simulation
    debug-transaction.tsx        # Transaction debugging
    analyze-security.tsx         # Security analysis
    generate-frontend.tsx        # Frontend code generation
    generate-backend.tsx         # Backend code generation
    
  mcp/
    etherscan.ts                 # Etherscan MCP (example)
    # More MCP tools...
```

## Success Metrics

**Phase 1:**
- AI understands project structure
- AI can work incrementally on existing projects
- Related files are automatically loaded

**Phase 2:**
- Users can build contracts step-by-step
- Changes suggest updates across layers
- Tests run automatically

**Phase 3:**
- Users can deploy complete products
- Frontend/backend code generated from contracts
- Everything stays in sync

**Phase 4:**
- Users can simulate and debug transactions
- Security analysis runs automatically
- MCP ecosystem is established

## Risks & Mitigations

**Risk:** Project analysis might be slow
- **Mitigation:** Cache aggressively, update incrementally

**Risk:** Relationship tracking might miss some connections
- **Mitigation:** Hybrid approach, user can override

**Risk:** Code generation might break existing code
- **Mitigation:** Incremental approach, user reviews changes

**Risk:** MCP tools might be unreliable
- **Mitigation:** Built-in tools for core functionality, MCP for extensibility

## Next Steps

1. Implement project analyzer
2. Build context manager
3. Add smart context loading
4. Test with real projects
5. Iterate based on feedback

This plan is a living document. We'll update it as we learn and build.
