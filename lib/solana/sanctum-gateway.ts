import {
  createSolanaRpc,
  address,
  type Instruction,
  signature,
} from "@solana/kit";
import { getBase64Encoder, getBase64Decoder } from "@solana/codecs-strings";

const CONFIG = {
  GATEWAY_URL: process.env.NODE_ENV == "development" ? `https://tpg.sanctum.so/v1/devnet?apiKey=${process.env.GATEWAY_API_KEY}` : `https://tpg.sanctum.so/v1/mainnet?apiKey=${process.env.GATEWAY_API_KEY}`,
  RPC_URL: process.env.NODE_ENV == "development" ? "https://api.devnet.solana.com" : "https://api.mainnet-beta.solana.com",
  JITO_TIP_RANGE: "medium" as const,
  CU_PRICE_MULTIPLIER: 1.2,
};

export class SanctumGatewayClient {
  private gatewayUrl: string;
  private rpc: ReturnType<typeof createSolanaRpc>;

  constructor(gatewayUrl?: string, rpcUrl?: string) {
    this.gatewayUrl = gatewayUrl || CONFIG.GATEWAY_URL;
    this.rpc = createSolanaRpc(rpcUrl || CONFIG.RPC_URL);
  }

  get _rpc() {
    return this.rpc;
  }

  async getTipInstructions(feePayer: string): Promise<Instruction[]> {
    const response = await fetch(this.gatewayUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: `tip-${Date.now()}`,
        jsonrpc: "2.0",
        method: "getTipInstructions",
        params: [
          {
            feePayer,
            jitoTipRange: CONFIG.JITO_TIP_RANGE,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to get tip instructions: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.error) {
      throw new Error(`Gateway error: ${data.error.message}`);
    }

    return data.result.map((ix: any) => ({
      ...ix,
      data: new Uint8Array(Object.values(ix.data)),
    }));
  }

  async sendTransaction(signedTransactionBytes: Uint8Array): Promise<{
    signature: string;
    deliveryMethod: string;
    slot?: number;
  }> {
    // Convert Uint8Array to base64 string
    const base64Transaction = getBase64Decoder().decode(signedTransactionBytes);

    const response = await fetch(this.gatewayUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: `send-${Date.now()}`,
        jsonrpc: "2.0",
        method: "sendTransaction",
        params: [base64Transaction],
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to send transaction: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(`Gateway error: ${data.error.message}`);
    }

    const deliveryResults = data.result;
    for (const [method, results] of Object.entries(deliveryResults)) {
      const resultArray = results as any[];
      if (resultArray[0]?.result) {
        return {
          signature: resultArray[0].result,
          deliveryMethod: method,
          slot: resultArray[0].slot,
        };
      }
    }

    throw new Error("No successful delivery method");
  }

  async getLatestBlockhash() {
    return await this.rpc.getLatestBlockhash().send();
  }

  async getPriorityFee(accounts: string[]): Promise<bigint> {
    // Default priority fee - integrate with Helius/Triton for dynamic fees
    return BigInt(10000);
  }

  async confirmTransaction(signatureString: string, maxAttempts = 30): Promise<boolean> {
    // Convert string to Signature type
    const sig = signature(signatureString);
    
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const result = await this.rpc.getSignatureStatuses([sig]).send();
        const status = result.value[0];
        
        if (status?.confirmationStatus === "confirmed" || 
            status?.confirmationStatus === "finalized") {
          return true;
        }
      } catch (error) {
        console.warn(`Confirmation check ${i + 1} failed:`, error);
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return false;
  }
}