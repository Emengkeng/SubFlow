export const CONFIG = {
  GATEWAY_URL: process.env.NODE_ENV == "development" 
    ? `https://tpg.sanctum.so/v1/devnet?apiKey=${process.env.GATEWAY_API_KEY}` 
    : `https://tpg.sanctum.so/v1/mainnet?apiKey=${process.env.GATEWAY_API_KEY}`,
  RPC_URL: process.env.NODE_ENV == "development" 
    ? "https://api.devnet.solana.com" 
    : "https://api.mainnet-beta.solana.com",
  USDC_ADDRESS: (process.env.NODE_ENV == "development" 
    ? process.env.USDC_ADDRESS_TESTNET 
    : process.env.USDC_ADDRESS_MAINNET) || 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // Fallback to mainnet USDC
  JITO_TIP_RANGE: "medium" as const,
  CU_PRICE_MULTIPLIER: 1.2,
} as const;