import { defineTool } from "@/tools/ai.js"
import { type ToolMetadata } from "@/tools/tools.js"
import { formatSolanaAddress, formatLamportsToSol, getNetworkBadge, getExplorerUrl } from "@/lib/crypto-utils.js"
import { Box, Text } from "ink"
import React from "react"
import { z } from "zod"
import {
  Connection,
  PublicKey,
} from "@solana/web3.js"

export const metadata = {
  needsPermissions: () => false,
} satisfies ToolMetadata

function getRpcUrl(network: string): string {
  const envVar = process.env[`SOLANA_RPC_URL_${network.toUpperCase()}`] || process.env.SOLANA_RPC_URL
  if (envVar) {
    return envVar
  }

  // Default public RPC endpoints (rate limited, but work for read operations)
  const publicRpcs: Record<string, string> = {
    mainnet: "https://api.mainnet-beta.solana.com",
    devnet: "https://api.devnet.solana.com",
    testnet: "https://api.testnet.solana.com",
  }

  return publicRpcs[network.toLowerCase()] || publicRpcs.mainnet
}

function createConnection(network: string): Connection {
  const rpcUrl = getRpcUrl(network)
  return new Connection(rpcUrl, "confirmed")
}

export const tool = defineTool({
  description: `Reads account data from a Solana program account. This is a read-only operation that does not require signing or cost SOL. You can read any account on Solana, including program accounts, token accounts, and system accounts.

Common use cases:
- Read token account data (balance, owner, mint)
- Read program state accounts
- Read account data size and lamports
- Check if account exists

The accountAddress must be a valid Solana public key (Base58 string). The network determines which cluster to query (mainnet, devnet, testnet).`,
  parameters: z.strictObject({
    accountAddress: z
      .string()
      .describe("The Solana account address (must be a valid Base58 public key)"),
    network: z
      .string()
      .default("mainnet")
      .describe("The network to query (mainnet, devnet, testnet). Defaults to mainnet."),
    decode: z
      .boolean()
      .optional()
      .default(true)
      .describe("Whether to decode the account data as text/JSON if possible. Defaults to true."),
  }),
  execute: async ({ accountAddress, network = "mainnet", decode = true }) => {
    try {
      // Validate public key format
      let publicKey: PublicKey
      try {
        publicKey = new PublicKey(accountAddress)
      } catch (error: any) {
        return {
          result: false,
          message: `Invalid Solana public key format: ${accountAddress}. Must be a valid Base58 public key.`,
        }
      }

      const connection = createConnection(network)
      const networkName = network.charAt(0).toUpperCase() + network.slice(1)

      // Get account info
      const accountInfo = await connection.getAccountInfo(publicKey)

      if (!accountInfo) {
        return {
          result: false,
          message: `Account ${accountAddress} does not exist on ${networkName}`,
        }
      }

      const result: {
        accountAddress: string
        network: string
        owner: string
        lamports: string
        executable: boolean
        rentEpoch: number
        dataLength: number
        data?: string
        dataHex?: string
      } = {
        accountAddress,
        network: networkName,
        owner: accountInfo.owner.toBase58(),
        lamports: accountInfo.lamports.toString(),
        executable: accountInfo.executable,
        rentEpoch: accountInfo.rentEpoch || 0,
        dataLength: accountInfo.data.length,
      }

      // Try to decode data
      if (decode && accountInfo.data.length > 0) {
        try {
          // Try UTF-8 text decode
          const textDecoder = new TextDecoder("utf-8", { fatal: false })
          const decoded = textDecoder.decode(accountInfo.data)
          if (decoded && decoded.length > 0 && /^[\x20-\x7E\s]*$/.test(decoded)) {
            result.data = decoded.trim()
          }
        } catch {
          // Ignore decode errors
        }

        // Always include hex representation
        result.dataHex = Buffer.from(accountInfo.data).toString("hex")
      }

      // Format lamports as SOL
      const sol = accountInfo.lamports / 1_000_000_000

      return {
        data: result,
        message: `Account ${accountAddress} on ${networkName}:
Owner: ${accountInfo.owner.toBase58()}
Balance: ${accountInfo.lamports} lamports (${sol} SOL)
Executable: ${accountInfo.executable}
Data length: ${accountInfo.data.length} bytes
Rent epoch: ${accountInfo.rentEpoch || 0}
${result.data ? `Data (text): ${result.data.substring(0, 200)}${result.data.length > 200 ? "..." : ""}` : ""}`,
      }
    } catch (error: any) {
      const errorMsg = error.message || "Unknown error"
      // Provide helpful error messages for common issues
      if (errorMsg.includes("network") || errorMsg.includes("fetch") || errorMsg.includes("ECONNREFUSED")) {
        return {
          result: false,
          message: `Network error: Could not connect to ${networkName} RPC. Check your SOLANA_RPC_URL or try again later. Error: ${errorMsg}`,
        }
      }
      if (errorMsg.includes("Invalid") || errorMsg.includes("public key")) {
        return {
          result: false,
          message: `Invalid Solana address. Make sure it's a valid Base58 public key. Error: ${errorMsg}`,
        }
      }
      return {
        result: false,
        message: `Error reading account: ${errorMsg}`,
      }
    }
  },
  render: (part) => {
    const { args, state, result } = part
    if (state === "partial-call") {
      return (
        <Box flexDirection="column" gap={0}>
          <Text color="cyan">
            {getNetworkBadge(args?.network || "mainnet")} Reading account{" "}
            {formatSolanaAddress(args?.accountAddress || "")}...
          </Text>
        </Box>
      )
    }
    if (state === "result" && result && typeof result === "object" && "data" in result) {
      const data = (result as any).data
      const explorerUrl = getExplorerUrl("address", args?.accountAddress || "", args?.network || "mainnet", "solana")
      const sol = formatLamportsToSol(data?.lamports || "0")
      
      return (
        <Box flexDirection="column" gap={1} paddingX={1}>
          <Box flexDirection="row" gap={1}>
            <Text color="magenta">{getNetworkBadge(args?.network || "mainnet")}</Text>
            <Text color="dim">•</Text>
            <Text color="cyan">Account: {formatSolanaAddress(args?.accountAddress || "")}</Text>
          </Box>
          <Box flexDirection="column" gap={0} paddingLeft={2}>
            <Text color="green">Balance: {sol}</Text>
            <Text color="dim">  ({data?.lamports || "0"} lamports)</Text>
            <Text color="white">Owner: {formatSolanaAddress(data?.owner || "")}</Text>
            <Text color="yellow">Data: {data?.dataLength || 0} bytes</Text>
            {data?.executable && (
              <Text color="red">⚠️ Executable account</Text>
            )}
            {data?.data && (
              <Box flexDirection="column" gap={0} paddingTop={1}>
                <Text color="dim">Data preview:</Text>
                <Text color="white">  {data.data.substring(0, 100)}{data.data.length > 100 ? "..." : ""}</Text>
              </Box>
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
      ◎ Account: {formatSolanaAddress(part.args?.accountAddress || "")} • {getNetworkBadge(part.args?.network || "mainnet")}
    </Text>
  ),
})

export const renderRejectedMessage = () => {
  return <Text>Read Program Account</Text>
}
