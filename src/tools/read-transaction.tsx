import { defineTool } from "@/tools/ai.js"
import { type ToolMetadata } from "@/tools/tools.js"
import { formatAddress, formatWeiToEth, getNetworkBadge, getExplorerUrl } from "@/lib/crypto-utils.js"
import { Box, Text } from "ink"
import React from "react"
import { z } from "zod"
import {
  createPublicClient,
  http,
  formatEther,
  type PublicClient,
  type Hash,
} from "viem"
import { mainnet, sepolia, goerli, holesky } from "viem/chains"

export const metadata = {
  needsPermissions: () => false,
} satisfies ToolMetadata

type ChainConfig = {
  id: number
  name: string
}

const CHAIN_CONFIGS: Record<string, ChainConfig> = {
  mainnet: { id: 1, name: "Ethereum Mainnet" },
  sepolia: { id: 11155111, name: "Sepolia Testnet" },
  goerli: { id: 5, name: "Goerli Testnet" },
  holesky: { id: 17000, name: "Holesky Testnet" },
}

function getChainConfig(network: string): ChainConfig {
  const config = CHAIN_CONFIGS[network.toLowerCase()]
  if (!config) {
    throw new Error(
      `Unsupported network: ${network}. Supported networks: ${Object.keys(CHAIN_CONFIGS).join(", ")}`,
    )
  }
  return config
}

function getRpcUrl(network: string): string {
  const envVar = process.env[`ETH_RPC_URL_${network.toUpperCase()}`] || process.env.ETH_RPC_URL
  if (envVar) {
    return envVar
  }

  // Default public RPC endpoints (rate limited, but work for read operations)
  const publicRpcs: Record<string, string> = {
    mainnet: "https://eth.llamarpc.com",
    sepolia: "https://rpc.sepolia.org",
    goerli: "https://rpc.ankr.com/eth_goerli",
    holesky: "https://rpc.ankr.com/eth_holesky",
  }

  return publicRpcs[network.toLowerCase()] || publicRpcs.mainnet
}

function createClient(network: string): PublicClient {
  const chainConfig = getChainConfig(network)
  const rpcUrl = getRpcUrl(network)

  // Select the correct chain based on chain ID
  let chain
  if (chainConfig.id === 1) {
    chain = mainnet
  } else if (chainConfig.id === 11155111) {
    chain = sepolia
  } else if (chainConfig.id === 5) {
    chain = goerli
  } else if (chainConfig.id === 17000) {
    chain = holesky
  } else {
    chain = mainnet // Default fallback
  }

  return createPublicClient({
    chain,
    transport: http(rpcUrl),
  })
}

export const tool = defineTool({
  description: `Fetches and decodes transaction data from the Ethereum blockchain. This is a read-only operation that retrieves transaction details including sender, receiver, value, gas, logs, and events. Useful for debugging, verification, and understanding transaction execution.

Common use cases:
- View transaction details (sender, receiver, value, gas)
- Decode transaction logs and events
- Check transaction status (success/failure)
- Analyze gas usage
- View contract interactions

The transactionHash must be a valid transaction hash (0x...). The network determines which chain to query.`,
  parameters: z.strictObject({
    transactionHash: z
      .string()
      .describe("The Ethereum transaction hash (must be a valid 0x transaction hash)"),
    network: z
      .string()
      .default("mainnet")
      .describe("The network to query (mainnet, sepolia, goerli, holesky). Defaults to mainnet."),
    includeLogs: z
      .boolean()
      .optional()
      .default(true)
      .describe("Whether to include transaction logs/events. Defaults to true."),
  }),
  execute: async ({ transactionHash, network = "mainnet", includeLogs = true }) => {
    try {
      // Validate hash format
      if (!/^0x[a-fA-F0-9]{64}$/.test(transactionHash)) {
        return {
          result: false,
          message: `Invalid transaction hash format: ${transactionHash}. Must be a valid 0x transaction hash (64 hex characters).`,
        }
      }

      const client = createClient(network)
      const hash = transactionHash as Hash
      const chainConfig = getChainConfig(network)

      // Get transaction receipt first (includes status and logs)
      const receipt = await client.getTransactionReceipt({ hash })

      // Get full transaction details
      const tx = await client.getTransaction({ hash })

      const result: {
        transactionHash: string
        network: string
        status: string
        blockNumber: string
        blockHash: string
        from: string
        to: string | null
        value: string
        valueEth: string
        gasUsed: string
        gasPrice: string
        effectiveGasPrice?: string
        gasLimit: string
        nonce: number
        transactionIndex: number
        logs?: Array<{
          address: string
          topics: string[]
          data: string
          index: number
        }>
      } = {
        transactionHash,
        network: chainConfig.name,
        status: receipt.status === "success" ? "success" : "reverted",
        blockNumber: receipt.blockNumber.toString(),
        blockHash: receipt.blockHash,
        from: tx.from,
        to: tx.to || null,
        value: tx.value.toString(),
        valueEth: formatEther(tx.value),
        gasUsed: receipt.gasUsed.toString(),
        gasPrice: tx.gasPrice ? tx.gasPrice.toString() : "0",
        gasLimit: tx.gas.toString(),
        nonce: tx.nonce,
        transactionIndex: receipt.transactionIndex,
      }

      if (receipt.effectiveGasPrice) {
        result.effectiveGasPrice = receipt.effectiveGasPrice.toString()
      }

      if (includeLogs && receipt.logs.length > 0) {
        result.logs = receipt.logs.map((log, index) => ({
          address: log.address,
          topics: log.topics as string[],
          data: log.data,
          index,
        }))
      }

      // Build message
      let message = `Transaction ${transactionHash} on ${chainConfig.name}:
Status: ${result.status === "success" ? "✓ Success" : "✗ Reverted"}
Block: ${result.blockNumber} (${result.blockHash.slice(0, 10)}...)
From: ${result.from}
${result.to ? `To: ${result.to}` : "To: Contract Creation"}
Value: ${result.valueEth} ETH (${result.value} wei)
Gas used: ${result.gasUsed} / ${result.gasLimit}
${result.effectiveGasPrice ? `Effective gas price: ${result.effectiveGasPrice} wei` : ""}
Transaction index: ${result.transactionIndex}
Nonce: ${result.nonce}
`

      if (includeLogs && result.logs && result.logs.length > 0) {
        message += `\nLogs (${result.logs.length}):\n`
        result.logs.slice(0, 10).forEach((log, i) => {
          message += `  [${i}] ${log.address}: ${log.topics.length} topics, ${log.data.length} bytes data\n`
        })
        if (result.logs.length > 10) {
          message += `  ... and ${result.logs.length - 10} more logs\n`
        }
      }

      return {
        data: result,
        message,
      }
    } catch (error: any) {
      const errorMsg = error.message || "Unknown error"
      // Provide helpful error messages for common issues
      if (errorMsg.includes("network") || errorMsg.includes("fetch") || errorMsg.includes("ECONNREFUSED")) {
        return {
          result: false,
          message: `Network error: Could not connect to ${network} RPC. Check your ETH_RPC_URL or try again later. Error: ${errorMsg}`,
        }
      }
      if (errorMsg.includes("not found") || errorMsg.includes("Transaction")) {
        return {
          result: false,
          message: `Transaction ${transactionHash} not found on ${network}. It may not exist or not be indexed yet.`,
        }
      }
      if (errorMsg.includes("invalid") || errorMsg.includes("hash")) {
        return {
          result: false,
          message: `Invalid transaction hash. Make sure it's a valid Ethereum transaction hash (0x...). Error: ${errorMsg}`,
        }
      }
      return {
        result: false,
        message: `Error reading transaction: ${errorMsg}`,
      }
    }
  },
  render: (part) => {
    const { args, state, result } = part
    if (state === "partial-call") {
      return (
        <Box flexDirection="column" gap={0}>
          <Text color="cyan">
            {getNetworkBadge(args?.network || "mainnet")} Reading transaction{" "}
            {formatAddress(args?.transactionHash || "", 10, 8)}...
          </Text>
        </Box>
      )
    }
    if (state === "result" && result && typeof result === "object" && "data" in result) {
      const data = (result as any).data
      const explorerUrl = getExplorerUrl("tx", args?.transactionHash || "", args?.network || "mainnet", "ethereum")
      
      return (
        <Box flexDirection="column" gap={1} paddingX={1}>
          <Box flexDirection="row" gap={1}>
            <Text color="magenta">{getNetworkBadge(args?.network || "mainnet")}</Text>
            <Text color="dim">•</Text>
            <Text color={data?.status === "success" ? "green" : "red"}>
              {data?.status === "success" ? "✓ Success" : "✗ Reverted"}
            </Text>
          </Box>
          <Box flexDirection="column" gap={0} paddingLeft={2}>
            <Text color="cyan">Block: #{data?.blockNumber}</Text>
            <Text color="white">From: {formatAddress(data?.from || "")}</Text>
            {data?.to && (
              <Text color="white">To: {formatAddress(data.to)}</Text>
            )}
            <Text color="green">Value: {data?.valueEth || "0"} ETH</Text>
            <Text color="yellow">Gas: {data?.gasUsed || "0"} / {data?.gasLimit || "0"}</Text>
            {data?.logs && data.logs.length > 0 && (
              <Text color="dim">Logs: {data.logs.length} events</Text>
            )}
          </Box>
          <Box flexDirection="row" gap={1} paddingTop={1}>
            <Text color="dim">Explorer:</Text>
            <Text color="blue">{explorerUrl}</Text>
          </Box>
        </Box>
      )
    }
    return null
  },
  renderTitle: (part) => (
    <Text color="magenta">
      🔗 Transaction: {formatAddress(part.args?.transactionHash || "", 10, 8)} • {getNetworkBadge(part.args?.network || "mainnet")}
    </Text>
  ),
})

export const renderRejectedMessage = () => {
  return <Text>Read Transaction</Text>
}
