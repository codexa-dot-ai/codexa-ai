import { Box, Text } from "ink"
import React from "react"

export function Onboarding() {
  return (
    <Box flexDirection="column" gap={1} paddingX={2} paddingY={1}>
      <Text color="magenta" bold>
        🚀 Welcome to Codexa AI - Your Crypto Development Terminal
      </Text>
      <Text color="dim">━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</Text>
      
      <Box flexDirection="column" gap={1} paddingTop={1}>
        <Text color="cyan" bold>📋 Quick Start Guide</Text>
        
        <Box flexDirection="column" gap={0} paddingLeft={2}>
          <Text color="white">1. Configure RPC Endpoints (Optional)</Text>
          <Text color="dim">   Set ETH_RPC_URL or SOLANA_RPC_URL in .env for better performance</Text>
          <Text color="dim">   Default: Uses public RPC endpoints (rate limited)</Text>
        </Box>

        <Box flexDirection="column" gap={0} paddingLeft={2} paddingTop={1}>
          <Text color="white">2. Try Crypto Commands</Text>
          <Text color="green">   /balance &lt;address&gt; - Check Ethereum or Solana balance</Text>
          <Text color="green">   /gas - View current Ethereum gas prices</Text>
          <Text color="green">   /network - Show network configuration</Text>
          <Text color="green">   /explorer &lt;address|tx&gt; - Generate explorer links</Text>
        </Box>

        <Box flexDirection="column" gap={0} paddingLeft={2} paddingTop={1}>
          <Text color="white">3. Use Built-in Crypto Tools</Text>
          <Text color="yellow">   • read-contract-state - Read Ethereum contract state</Text>
          <Text color="yellow">   • read-program-account - Read Solana account data</Text>
          <Text color="yellow">   • read-transaction - Decode Ethereum transactions</Text>
          <Text color="yellow">   • analyze-project - Understand your project structure</Text>
        </Box>

        <Box flexDirection="column" gap={0} paddingLeft={2} paddingTop={1}>
          <Text color="white">4. Full-Stack Development</Text>
          <Text color="dim">   Codexa AI understands your full stack:</Text>
          <Text color="dim">   • Contracts → Backend APIs → Frontend hooks</Text>
          <Text color="dim">   • Auto-suggests cross-layer updates</Text>
          <Text color="dim">   • Framework-aware (Hardhat, Foundry, Next.js, etc.)</Text>
        </Box>

        <Box flexDirection="column" gap={0} paddingLeft={2} paddingTop={1}>
          <Text color="white">5. Example Queries</Text>
          <Text color="dim">   • "Check balance of 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"</Text>
          <Text color="dim">   • "Read Solana account: 9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM"</Text>
          <Text color="dim">   • "Create an ERC-20 token" (AI will suggest full stack)</Text>
          <Text color="dim">   • "Analyze this project" (understand structure & relationships)</Text>
        </Box>
      </Box>

      <Box flexDirection="column" gap={1} paddingTop={1}>
        <Text color="cyan" bold>💡 Supported Networks</Text>
        <Box flexDirection="column" gap={0} paddingLeft={2}>
          <Text color="white">Ethereum: Mainnet, Sepolia, Goerli, Holesky</Text>
          <Text color="white">Solana: Mainnet, Devnet, Testnet</Text>
        </Box>
      </Box>

      <Box flexDirection="column" gap={1} paddingTop={1}>
        <Text color="cyan" bold>🔗 Resources</Text>
        <Box flexDirection="column" gap={0} paddingLeft={2}>
          <Text color="blue">Ethereum: https://ethereum.org/developers</Text>
          <Text color="blue">Solana: https://solana.com/developers</Text>
          <Text color="blue">Codexa AI: Type /help for more commands</Text>
        </Box>
      </Box>

      <Text color="dim" paddingTop={1}>
        Ready to build? Start typing your question or use /help for more commands!
      </Text>
    </Box>
  )
}
