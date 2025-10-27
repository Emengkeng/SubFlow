import {
  createSolanaRpc,
  address,
  type Instruction,
  signature,
  getBase64EncodedWireTransaction,
  getTransactionEncoder,
  getTransactionDecoder,
  pipe,
  appendTransactionMessageInstructions,
  compileTransaction,
  createTransactionMessage,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  blockhash,
} from "@solana/kit";
import { getBase64Encoder } from "@solana/codecs-strings";

const CONFIG = {
  GATEWAY_URL: process.env.NODE_ENV == "development" 
    ? `https://tpg.sanctum.so/v1/devnet?apiKey=${process.env.GATEWAY_API_KEY}` 
    : `https://tpg.sanctum.so/v1/mainnet?apiKey=${process.env.GATEWAY_API_KEY}`,
  RPC_URL: process.env.NODE_ENV == "development" 
    ? "https://api.devnet.solana.com" 
    : "https://api.mainnet-beta.solana.com",
  JITO_TIP_RANGE: "medium" as const,
  CU_PRICE_MULTIPLIER: 1.2,
};

export class SanctumGatewayClient {
  private gatewayUrl: string;
  private rpc: ReturnType<typeof createSolanaRpc>;
  private rpcUrl: string;

  constructor(gatewayUrl?: string, rpcUrl?: string) {
    this.gatewayUrl = gatewayUrl || CONFIG.GATEWAY_URL;
    this.rpc = createSolanaRpc(rpcUrl || CONFIG.RPC_URL);
    this.rpcUrl = rpcUrl || CONFIG.RPC_URL;
  }

  get _rpc() {
    return this.rpc;
  }

  get getrpcUrl() {
    return this.rpcUrl;
  }

  async getTipInstructions(feePayer: string): Promise<Instruction[]> {
    const tipId = `tip-${Date.now()}`;
    const dataToSend = {
      id: tipId,
      jsonrpc: "2.0",
      method: "getTipInstructions",
      params: [
        {
          feePayer: feePayer,
          deliveryMethodType: "rpc",
        },
      ],
    };
    
    console.log("🎯 Fetching tip instructions from Sanctum Gateway...");
    console.log("   Fee Payer:", feePayer);
    
    const response = await fetch(this.gatewayUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dataToSend),
    });

    if (!response.ok) {
      throw new Error(`Failed to get tip instructions: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.error) {
      throw new Error(`Gateway error: ${JSON.stringify(data.error)}`);
    }

    const tipIxs = data.result.map((ix: any) => ({
      ...ix,
      data: new Uint8Array(Object.values(ix.data)),
    }));

    console.log("✅ Tip instructions received:", tipIxs.length, "instructions");
    return tipIxs;
  }

  /**
   * Build a Gateway-optimized transaction
   * This uses Sanctum's buildGatewayTransaction to:
   * - Simulate and set optimal CU limits
   * - Fetch and apply real-time priority fees
   * - Add Jito tip instructions
   * - Set appropriate blockhash
   */
  async buildGatewayTransaction(
    unsignedTransaction: any,
    options?: {
      skipSimulation?: boolean;
      skipPriorityFee?: boolean;
      cuPriceRange?: "low" | "medium" | "high";
      jitoTipRange?: "low" | "medium" | "high" | "max";
      expireInSlots?: number;
      deliveryMethodType?: "rpc" | "jito" | "sanctum-sender" | "helius-sender";
    }
  ): Promise<{
    transaction: any;
    latestBlockhash: {
      blockhash: string;
      lastValidBlockHeight: string;
    };
  }> {
    const buildId = `build-${Date.now()}`;
    const dataToSend = {
      id: buildId,
      jsonrpc: "2.0",
      method: "buildGatewayTransaction",
      params: [
        getBase64EncodedWireTransaction(unsignedTransaction),
        {
        // encoding: "base64" | "base58", default is "base64"
        // skipSimulation: boolean, if true, you need to set the CU limit yourself since simulation allows to find out cu consumed.
        // skipPriorityFee: boolean, if true, you need to set the CU price yourself. Use Triton Priority Fee API
        // cuPriceRange: "low" | "medium" | "high", defaults to project parameters
        // jitoTipRange: "low" | "medium" | "high" | "max", defaults to project parameters
        // expireInSlots: number, defaults to project parameters
          deliveryMethodType: "rpc"
        },
      ],
    };

    console.log("🔧 Building transaction via Sanctum Gateway...");
    console.log("   Options:", JSON.stringify(options, null, 2));
    
    const response = await fetch(this.gatewayUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dataToSend),
    });

    if (!response.ok) {
      throw new Error(`Failed to build gateway transaction: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(`Gateway error: ${JSON.stringify(data.error)}`);
    }

    const { transaction: encodedTransaction, latestBlockhash } = data.result;
    
    // Decode the optimized transaction
    const transaction = getTransactionDecoder().decode(
      getBase64Encoder().encode(encodedTransaction)
    );

    console.log("✅ Gateway-optimized transaction built:");
    console.log("   Blockhash:", latestBlockhash.blockhash.slice(0, 8) + "...");
    console.log("   Last Valid Block Height:", latestBlockhash.lastValidBlockHeight);

    return {
      transaction,
      latestBlockhash,
    };
  }

  /**
   * Send a signed transaction through Sanctum Gateway
   * Gateway will deliver through multiple methods (RPC + Jito bundles)
   * and return the first successful result
   */
  async sendTransaction(signedTransactionBytes: Uint8Array): Promise<{
    signature: string;
    deliveryMethod: string;
    slot?: number;
  }> {
    const sendId = `send-${Date.now()}`;
    
    // Convert Uint8Array to base64 string
    const base64Transaction = Buffer.from(signedTransactionBytes).toString('base64');
    
    const dataToSend = {
      id: sendId,
      jsonrpc: "2.0",
      method: "sendTransaction",
      params: [base64Transaction],
    };

    console.log("🚀 Sending transaction via Sanctum Gateway...");
    
    const response = await fetch(this.gatewayUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dataToSend),
    });

    if (!response.ok) {
      throw new Error(`Failed to send transaction: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(`Gateway error: ${data.error.message}`);
    }

    console.log("📊 Gateway delivery results:", data.result);

    // Gateway returns results from multiple delivery methods
    // Find the first successful delivery
    const deliveryResults = data.result;
    for (const [method, results] of Object.entries(deliveryResults)) {
      const resultArray = results as any[];
      if (resultArray[0]?.result) {
        console.log(`✅ Transaction delivered via: ${method}`);
        console.log(`   Signature: ${resultArray[0].result}`);
        console.log(`   Slot: ${resultArray[0].slot || 'N/A'}`);
        
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
    
    console.log(`⏳ Confirming transaction: ${signatureString.slice(0, 8)}...`);
    
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const result = await this.rpc.getSignatureStatuses([sig]).send();
        const status = result.value[0];
        
        if (status?.confirmationStatus === "confirmed" || 
            status?.confirmationStatus === "finalized") {
          console.log(`✅ Transaction confirmed (attempt ${i + 1}/${maxAttempts})`);
          return true;
        }
      } catch (error) {
        console.warn(`⚠️  Confirmation check ${i + 1} failed:`, error);
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.error(`❌ Transaction confirmation timeout after ${maxAttempts} attempts`);
    return false;
  }
}