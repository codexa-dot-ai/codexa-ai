import { defineTool } from "@/tools/ai.js"
import { type ToolMetadata } from "@/tools/tools.js"
import { formatAddress, formatWeiToEth, getNetworkBadge, getExplorerUrl } from "@/lib/crypto-utils.js"
import { Box, Text } from "ink"
import React from "react"
import { z } from "zod"
import { createPublicClient, http, formatUnits, type Address, type PublicClient } from "viem"
import { mainnet, sepolia, goerli, holesky } from "viem/chains"

export const metadata = {
  needsPermissions: () => false,
} satisfies ToolMetadata

type ChainConfig = {
  id: number
  name: string
  rpcUrl?: string
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
  description: `Reads state from an Ethereum smart contract by calling view functions or reading storage. This is a read-only operation that does not require signing or cost gas. You can call any view/pure function on a contract or read storage slots.

Common use cases:
- Check token balances (ERC-20: balanceOf(address))
- Read contract configuration (owner, totalSupply, etc.)
- Query contract state (getters, mappings, arrays)
- Read storage slots directly

The contractAddress must be a valid Ethereum address (0x...). The functionName should match a function in the contract's ABI. For ERC-20 tokens, common functions are: balanceOf, totalSupply, decimals, symbol, name.`,
  parameters: z.strictObject({
    contractAddress: z
      .string()
      .describe("The Ethereum contract address (must be a valid 0x address)"),
    functionName: z
      .string()
      .optional()
      .describe(
        "The function name to call (e.g., 'balanceOf', 'totalSupply'). If not provided, will read raw storage slot.",
      ),
    args: z
      .array(z.union([z.string(), z.number(), z.boolean()]))
      .optional()
      .describe("Arguments to pass to the function (for function calls)"),
    storageSlot: z
      .number()
      .optional()
      .describe("Storage slot to read directly (for raw storage reads, hex format as number)"),
    network: z
      .string()
      .default("mainnet")
      .describe("The network to query (mainnet, sepolia, goerli, holesky). Defaults to mainnet."),
  }),
  execute: async ({ contractAddress, functionName, args = [], storageSlot, network = "mainnet" }) => {
    try {
      // Validate address format
      if (!/^0x[a-fA-F0-9]{40}$/.test(contractAddress)) {
        return {
          result: false,
          message: `Invalid Ethereum address format: ${contractAddress}. Must be a valid 0x address.`,
        }
      }

      const client = createClient(network)
      const address = contractAddress as Address
      const chainConfig = getChainConfig(network)

      // Read storage slot directly
      if (storageSlot !== undefined) {
        const slot = `0x${storageSlot.toString(16).padStart(64, "0")}`
        const storage = await client.getStorageAt({
          address,
          slot: slot as `0x${string}`,
        })

        return {
          data: {
            contractAddress,
            network: chainConfig.name,
            storageSlot: slot,
            value: storage,
          },
          message: `Storage slot ${slot} = ${storage}`,
        }
      }

      // Call view function
      if (functionName) {
        // For common ERC-20 functions, we can handle them directly
        // Otherwise, this is a simplified version - full ABI support would require ABI parameter
        if (functionName === "balanceOf" && args.length === 1) {
          // ERC-20 balanceOf(address)
          const balance = await client.readContract({
            address,
            abi: [
              {
                inputs: [{ name: "account", type: "address" }],
                name: "balanceOf",
                outputs: [{ name: "", type: "uint256" }],
                stateMutability: "view",
                type: "function",
              },
            ],
            functionName: "balanceOf",
            args: [args[0] as Address],
          })

          return {
            data: {
              contractAddress,
              network: chainConfig.name,
              function: "balanceOf",
              args: { account: args[0] },
              result: balance.toString(),
              formatted: formatUnits(balance as bigint, 18), // Assume 18 decimals, should be configurable
            },
            message: `Balance of ${args[0]}: ${balance.toString()} wei (${formatUnits(balance as bigint, 18)} ETH/tokens)`,
          }
        }

        return {
          result: false,
          message: `Function call requires full ABI definition. For now, use storageSlot for direct storage reads, or common ERC-20 functions (balanceOf). Full ABI support coming soon.`,
        }
      }

      return {
        result: false,
        message: "Either functionName or storageSlot must be provided",
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
      if (errorMsg.includes("invalid address") || errorMsg.includes("address")) {
        return {
          result: false,
          message: `Invalid contract address. Make sure it's a valid Ethereum address (0x...). Error: ${errorMsg}`,
        }
      }
      return {
        result: false,
        message: `Error reading contract state: ${errorMsg}`,
      }
    }
  },
  render: (part) => {
    const { args, state, result } = part
    if (state === "partial-call") {
      return (
        <Box flexDirection="column" gap={0}>
          <Text color="cyan">
            {getNetworkBadge(args?.network || "mainnet")} Reading contract{" "}
            {formatAddress(args?.contractAddress || "")}...
          </Text>
        </Box>
      )
    }
    if (state === "result" && result && typeof result === "object" && "data" in result) {
      const data = (result as any).data
      const explorerUrl = getExplorerUrl("address", args?.contractAddress || "", args?.network || "mainnet", "ethereum")
      
      return (
        <Box flexDirection="column" gap={1} paddingX={1}>
          <Box flexDirection="row" gap={1}>
            <Text color="magenta">{getNetworkBadge(args?.network || "mainnet")}</Text>
            <Text color="dim">•</Text>
            <Text color="cyan">Contract: {formatAddress(args?.contractAddress || "")}</Text>
          </Box>
          {data?.function && (
            <Box flexDirection="column" gap={0} paddingLeft={2}>
              <Text color="green">Function: {data.function}</Text>
              {data.args && (
                <Text color="dim">  Args: {JSON.stringify(data.args)}</Text>
              )}
            </Box>
          )}
          {data?.result && (
            <Box flexDirection="column" gap={0} paddingLeft={2}>
              <Text color="green">Result:</Text>
              <Text color="white">  {data.result}</Text>
              {data.formatted && (
                <Text color="dim">  ({data.formatted})</Text>
              )}
            </Box>
          )}
          {data?.storageSlot && (
            <Box flexDirection="column" gap={0} paddingLeft={2}>
              <Text color="green">Storage Slot: {data.storageSlot}</Text>
              <Text color="white">  Value: {data.value}</Text>
            </Box>
          )}
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
      📄 Contract: {formatAddress(part.args?.contractAddress || "")} • {getNetworkBadge(part.args?.network || "mainnet")}
    </Text>
  ),
})

export const renderRejectedMessage = () => {
  return <Text>Read Contract State</Text>
}
