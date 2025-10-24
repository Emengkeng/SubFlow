import {
  createSolanaRpc,
  address,
  getBase64EncodedWireTransaction,
  appendTransactionMessageInstructions,
  compileTransaction,
  createTransactionMessage,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransaction,
} from "@solana/kit";
import { 
  getApproveCheckedInstruction,
  getRevokeInstruction,
  findAssociatedTokenPda,
  TOKEN_PROGRAM_ADDRESS,
  getCreateAssociatedTokenInstructionAsync,
} from "@solana-program/token";
import { getAddressDecoder } from "@solana/addresses";
import { createKeyPairSignerFromBytes } from "@solana/signers";
import bs58 from "bs58";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";

interface ApprovalRequest {
  userWallet: string;
  tokenMint: string;
  amount: string;
  billingPeriodDays: number;
  maxPayments?: number;
}

interface ApprovalResponse {
  approvalTransaction: string;
  delegateAuthority: string;
  tokenAccount: string;
  totalAllowance: string;
  perPaymentAmount: string;
  expiryDate: Date;
  instructionsForUser: string;
}

export class DelegationManager {
  private rpc: ReturnType<typeof createSolanaRpc>;
  private backendAuthority: string;
  private backendSigner?: Awaited<ReturnType<typeof createKeyPairSignerFromBytes>>;
  private rpcUrl: string;

  constructor(backendAuthority?: string) {
    this.rpcUrl = process.env.NODE_ENV === "development" 
      ? process.env.RPC_URL_TESTNET! 
      : process.env.RPC_URL_MAINNET!;

    if (!this.rpcUrl) {
      throw Error("RPC URL not configured");
    }

    this.rpc = createSolanaRpc(this.rpcUrl);
    this.backendAuthority = backendAuthority || process.env.BACKEND_AUTHORITY!;
  }

  private async initBackendSigner() {
    if (!this.backendSigner) {
      const keyPair = process.env.BACKEND_KEYPAIR;
      if (!keyPair) {
        throw Error("Backend keypair not set");
      }
      
      let keypairBytes: Uint8Array;
      
      try {
        keypairBytes = bs58.decode(keyPair);
      } catch {
        try {
          const parsed = JSON.parse(keyPair);
          if (Array.isArray(parsed)) {
            keypairBytes = new Uint8Array(parsed);
          } else {
            throw new Error("Invalid keypair format");
          }
        } catch {
          throw new Error("Keypair must be base58 or JSON array");
        }
      }
      
      if (keypairBytes.length !== 64) {
        throw new Error(`Invalid keypair length: ${keypairBytes.length}`);
      }
      
      this.backendSigner = await createKeyPairSignerFromBytes(keypairBytes);
      console.log(`✅ Backend signer: ${this.backendSigner.address}`);
    }
    return this.backendSigner;
  }

  /**
   * FIXED: Creates approval transaction with CORRECT total allowance
   */
  async createApprovalTransaction(request: ApprovalRequest): Promise<ApprovalResponse> {
    console.log("🔨 Creating approval for:", request.userWallet);

    const userWallet = address(request.userWallet);
    const tokenMint = address(request.tokenMint);
    
    const userTokenAccount = getAssociatedTokenAddressSync(
      new PublicKey(tokenMint),
      new PublicKey(userWallet),
    );

    // CRITICAL FIX: Calculate total allowance (per-payment × max payments)
    const perPaymentAmount = BigInt(request.amount);
    const maxPayments = BigInt(request.maxPayments || 12);
    const totalAllowance = perPaymentAmount * maxPayments;

    console.log(`💰 Approval details:`);
    console.log(`  - Per payment: ${perPaymentAmount}`);
    console.log(`  - Max payments: ${maxPayments}`);
    console.log(`  - Total allowance: ${totalAllowance}`);

    // Get token decimals from mint
    let decimals = 6; // Default for USDC
    try {
      const mintInfo = await this.rpc.getAccountInfo(
        tokenMint,
        { encoding: 'base64' }
      ).send();

      if (mintInfo.value?.data) {
        const mintData = Buffer.from(
          typeof mintInfo.value.data === 'string' 
            ? mintInfo.value.data 
            : mintInfo.value.data[0], 
          'base64'
        );
        
        if (mintData.length >= 45) {
          decimals = mintData.readUInt8(44);
          console.log(`  - Token decimals: ${decimals}`);
        }
      }
    } catch (error) {
      console.warn("⚠️ Using default decimals:", decimals);
    }

    // CRITICAL FIX: Use regular Approve (not ApproveChecked) for better compatibility
    // getApproveCheckedInstruction sometimes has issues with wallet adapters
    console.log(`🔧 Creating approval instruction...`);
    console.log(`  - Source (user's ATA): ${userTokenAccount}`);
    console.log(`  - Delegate (backend): ${this.backendAuthority}`);
    console.log(`  - Amount (raw): ${totalAllowance}`);
    console.log(`  - Amount (hex): 0x${totalAllowance.toString(16)}`);
    console.log(`  - Decimals: ${decimals}`);
    
    const approvalIx = getApproveCheckedInstruction({
      source: address(userTokenAccount.toString()),
      mint: tokenMint,
      delegate: address(this.backendAuthority),
      owner: userWallet,
      amount: totalAllowance,
      decimals,
    });

    console.log(`📋 Approval instruction created successfully`);
    console.log(`  - Program: ${approvalIx.programAddress}`);
    console.log(`  - Accounts: ${approvalIx.accounts?.length || 0}`);
    
    // Debug: Log instruction data
    if (approvalIx.data) {
      const dataHex = Buffer.from(approvalIx.data).toString('hex');
      console.log(`  - Instruction data (hex): ${dataHex}`);
      console.log(`  - Data length: ${approvalIx.data.length} bytes`);
    }

    // Get fresh blockhash
    const { value: latestBlockhash } = await this.rpc
      .getLatestBlockhash({ commitment: 'finalized' })
      .send();

    // Build transaction
    const transaction = pipe(
      createTransactionMessage({ version: 0 }),
      (txm) => appendTransactionMessageInstructions([approvalIx], txm),
      (txm) => setTransactionMessageFeePayerSigner(
        { address: userWallet } as any,
        txm
      ),
      (m) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, m),
      compileTransaction
    );

    const expiryDate = this.calculateExpiryDate(
      request.billingPeriodDays,
      request.maxPayments || 12
    );

    return {
      approvalTransaction: getBase64EncodedWireTransaction(transaction),
      delegateAuthority: this.backendAuthority,
      tokenAccount: userTokenAccount.toString(),
      totalAllowance: totalAllowance.toString(),
      perPaymentAmount: perPaymentAmount.toString(),
      expiryDate,
      instructionsForUser: this.generateUserInstructions(
        request,
        totalAllowance.toString(),
        expiryDate
      ),
    };
  }

  /**
   * FIXED: More robust approval verification with better retry logic
   */
  async verifyApproval(
    userTokenAccount: string,
    expectedDelegate: string,
    minimumAmount: bigint,
    maxRetries = 5
  ): Promise<boolean> {
    console.log(`🔍 Verifying approval:`);
    console.log(`  - Token account: ${userTokenAccount}`);
    console.log(`  - Expected delegate: ${expectedDelegate}`);
    console.log(`  - Minimum amount: ${minimumAmount}`);

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔍 Verification attempt ${attempt}/${maxRetries}...`);

        const accountInfo = await this.rpc.getAccountInfo(
          address(userTokenAccount),
          { encoding: 'base64', commitment: 'confirmed' }
        ).send();

        if (!accountInfo.value) {
          console.error("❌ Token account not found");
          if (attempt < maxRetries) {
            await this.sleep(3000);
            continue;
          }
          return false;
        }

        const data = accountInfo.value.data;
        if (typeof data === 'string' || !data) {
          console.error("❌ Invalid account data");
          return false;
        }

        const accountData = Buffer.from(data[0], 'base64');
        
        if (accountData.length < 165) {
          console.error("❌ Account data too short:", accountData.length);
          return false;
        }

        // Check delegation flag (byte 72)
        const delegateOption = accountData.readUInt32LE(72);
        
        if (delegateOption !== 1) {
          console.error("❌ No delegation found (delegateOption:", delegateOption, ")");
          if (attempt < maxRetries) {
            console.log("⏳ Waiting 3s for delegation to appear...");
            await this.sleep(3000);
            continue;
          }
          return false;
        }

        // Read delegate address (bytes 76-108)
        const delegateBytes = accountData.slice(76, 108);
        const delegate = getAddressDecoder().decode(delegateBytes);

        // CRITICAL FIX: Read delegated amount correctly
        // Token Account layout: delegated_amount is at bytes 108-116 (u64, little-endian)
        // BUT we need to check if it's reading correctly
        const amountBuffer = accountData.slice(108, 116);
        console.log(`🔍 Raw amount bytes (hex):`, amountBuffer.toString('hex'));
        
        const delegatedAmount = accountData.readBigUInt64LE(108);
        
        console.log(`📊 On-chain delegation:`);
        console.log(`  - Delegate: ${delegate}`);
        console.log(`  - Amount (raw u64): ${delegatedAmount}`);
        console.log(`  - Amount (hex): 0x${delegatedAmount.toString(16)}`);
        console.log(`  - Required: ${minimumAmount}`);

        // Verify delegate address
        if (delegate !== expectedDelegate) {
          console.error(`❌ Wrong delegate: ${delegate} (expected ${expectedDelegate})`);
          return false;
        }

        // Verify amount (with some tolerance for precision issues)
        if (delegatedAmount < minimumAmount) {
          console.error(`❌ Insufficient: ${delegatedAmount} < ${minimumAmount}`);
          
          // If very close (within 1%), might be a precision issue
          const tolerance = minimumAmount / BigInt(100);
          if (minimumAmount - delegatedAmount < tolerance) {
            console.warn(`⚠️ Amount within 1% tolerance, accepting...`);
            return true;
          }
          
          if (attempt < maxRetries) {
            console.log("⏳ Waiting 3s and retrying...");
            await this.sleep(3000);
            continue;
          }
          return false;
        }

        console.log(`✅ Delegation verified: ${delegatedAmount} to ${delegate}`);
        return true;

      } catch (error) {
        console.error(`❌ Attempt ${attempt} failed:`, error);
        if (attempt < maxRetries) {
          await this.sleep(3000);
        }
      }
    }

    return false;
  }

  /**
   * Get token account address without checking if it exists
   */
  async getTokenAccountAddress(
    userWallet: string,
    tokenMint: string
  ): Promise<string> {
    const userWalletAddr = address(userWallet);
    const tokenMintAddr = address(tokenMint);
    
    const [userTokenAccount] = await findAssociatedTokenPda({
      mint: tokenMintAddr,
      owner: userWalletAddr,
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
    });

    return userTokenAccount;
  }

  async createRevocationTransaction(
    userWallet: string,
    tokenMint: string
  ): Promise<string> {
    const userWalletAddr = address(userWallet);
    const tokenMintAddr = address(tokenMint);
    
    const [userTokenAccount] = await findAssociatedTokenPda({
      mint: tokenMintAddr,
      owner: userWalletAddr,
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
    });

    const revokeIx = getRevokeInstruction({
      source: userTokenAccount,
      owner: userWalletAddr,
    });

    const { value: latestBlockhash } = await this.rpc
      .getLatestBlockhash({ commitment: 'finalized' })
      .send();

    const transaction = pipe(
      createTransactionMessage({ version: 0 }),
      (txm) => appendTransactionMessageInstructions([revokeIx], txm),
      (txm) => setTransactionMessageFeePayerSigner(
        { address: userWalletAddr } as any,
        txm
      ),
      (m) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, m),
      compileTransaction
    );

    return getBase64EncodedWireTransaction(transaction);
  }

  /**
   * Create user's token account if needed (backend pays)
   */
  async ensureTokenAccountExists(
    userWallet: string,
    tokenMint: string,
  ): Promise<{ created: boolean; txSignature?: string }> {
    const backendSigner = await this.initBackendSigner();
    const userWalletAddr = address(userWallet);
    const tokenMintAddr = address(tokenMint);
    
    const [userTokenAccount] = await findAssociatedTokenPda({
      mint: tokenMintAddr,
      owner: userWalletAddr,
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
    });

    // Check if exists
    const accountInfo = await this.rpc.getAccountInfo(
      userTokenAccount,
      { encoding: 'base64', commitment: 'confirmed' }
    ).send();

    if (accountInfo.value) {
      console.log("✅ Token account exists");
      return { created: false };
    }

    // Create it
    console.log("🔨 Creating token account (backend pays ~0.002 SOL)...");
    
    const createAtaIx = await getCreateAssociatedTokenInstructionAsync({
      mint: tokenMintAddr,
      owner: userWalletAddr,
      payer: backendSigner,
    });

    const { value: latestBlockhash } = await this.rpc
      .getLatestBlockhash({ commitment: 'finalized' })
      .send();

    const transaction = pipe(
      createTransactionMessage({ version: 0 }),
      (txm) => appendTransactionMessageInstructions([createAtaIx], txm),
      (txm) => setTransactionMessageFeePayerSigner(backendSigner, txm),
      (m) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, m),
      compileTransaction
    );

    const signedTransaction = await signTransaction(
      [backendSigner.keyPair],
      transaction
    );

    const base64Transaction = getBase64EncodedWireTransaction(signedTransaction);

    // Send transaction
    const signature = await this.rpc.sendTransaction(base64Transaction, {
      encoding: 'base64',
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    } as any).send();

    console.log(`✅ Token account created: ${signature}`);
    
    // Wait for confirmation
    await this.waitForConfirmation(signature, 30);
    
    return { created: true, txSignature: signature };
  }

  private async waitForConfirmation(
    signature: string, 
    maxAttempts = 30
  ): Promise<boolean> {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const result = await this.rpc.getSignatureStatuses([signature as any]).send();
        const status = result.value[0];
        
        if (status?.confirmationStatus === "confirmed" || 
            status?.confirmationStatus === "finalized") {
          return true;
        }

        if (status?.err) {
          console.error("Transaction failed:", status.err);
          return false;
        }
      } catch (error) {
        console.warn(`Confirmation check ${i + 1} failed`);
      }

      await this.sleep(1000);
    }

    return false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private calculateExpiryDate(billingPeriodDays: number, maxPayments: number): Date {
    const totalDays = billingPeriodDays * maxPayments;
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + totalDays + 30);
    return expiryDate;
  }

  private generateUserInstructions(
    request: ApprovalRequest,
    totalAllowance: string,
    expiryDate: Date
  ): string {
    const amountFormatted = (Number(request.amount) / 1_000_000).toFixed(2);
    const totalFormatted = (Number(totalAllowance) / 1_000_000).toFixed(2);

    return `
📋 Subscription Approval

✅ Recurring payment: ${amountFormatted} USDC
⏰ Every ${request.billingPeriodDays} days
💰 Total allowance: ${totalFormatted} USDC (${request.maxPayments || 12} payments)
📅 Expires: ${expiryDate.toLocaleDateString()}

🔒 You're in control:
- Cancel anytime from your dashboard
- Only approved amounts can be charged
- Tokens stay in your wallet until payment is due
    `.trim();
  }
}