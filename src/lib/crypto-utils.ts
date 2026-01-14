/**
 * Crypto utility functions for formatting and displaying blockchain data
 */

export function formatAddress(address: string, startChars = 6, endChars = 4): string {
  if (!address || address.length < startChars + endChars) {
    return address
  }
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`
}

export function formatEthereumAddress(address: string): string {
  // Basic checksum validation (simplified - full EIP-55 would require more logic)
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return address
  }
  return address
}

export function formatSolanaAddress(address: string): string {
  // Solana addresses are Base58, typically 32-44 characters
  if (address.length < 8) {
    return address
  }
  return formatAddress(address, 8, 8)
}

export function formatTokenAmount(
  amount: string | bigint | number,
  decimals: number = 18,
  symbol?: string,
): string {
  const num = typeof amount === "bigint" ? Number(amount) : Number(amount)
  const divisor = Math.pow(10, decimals)
  const formatted = (num / divisor).toLocaleString("en-US", {
    maximumFractionDigits: decimals,
    minimumFractionDigits: 0,
  })
  return symbol ? `${formatted} ${symbol}` : formatted
}

export function formatWeiToEth(wei: string | bigint): string {
  return formatTokenAmount(wei, 18, "ETH")
}

export function formatLamportsToSol(lamports: string | bigint | number): string {
  return formatTokenAmount(lamports, 9, "SOL")
}

export function getNetworkBadge(network: string): string {
  const badges: Record<string, string> = {
    mainnet: "🟢 Mainnet",
    sepolia: "🟡 Sepolia",
    goerli: "🟠 Goerli",
    holesky: "🔵 Holesky",
    devnet: "🟣 Devnet",
    testnet: "🔴 Testnet",
  }
  return badges[network.toLowerCase()] || network
}

export function getExplorerUrl(
  type: "address" | "tx" | "block",
  value: string,
  network: string,
  chain: "ethereum" | "solana" = "ethereum",
): string {
  if (chain === "ethereum") {
    const baseUrls: Record<string, string> = {
      mainnet: "https://etherscan.io",
      sepolia: "https://sepolia.etherscan.io",
      goerli: "https://goerli.etherscan.io",
      holesky: "https://holesky.etherscan.io",
    }
    const base = baseUrls[network.toLowerCase()] || baseUrls.mainnet
    return `${base}/${type}/${value}`
  } else {
    // Solana
    const baseUrls: Record<string, string> = {
      mainnet: "https://solscan.io",
      devnet: "https://solscan.io?cluster=devnet",
      testnet: "https://solscan.io?cluster=testnet",
    }
    const base = baseUrls[network.toLowerCase()] || baseUrls.mainnet
    if (type === "address") {
      return `${base}/account/${value}`
    } else if (type === "tx") {
      return `${base}/tx/${value}`
    } else {
      return `${base}/block/${value}`
    }
  }
}

export function validateEthereumAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address)
}

export function validateSolanaAddress(address: string): boolean {
  // Solana addresses are Base58, typically 32-44 characters
  // Basic validation - full validation would require Base58 decoding
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)
}
