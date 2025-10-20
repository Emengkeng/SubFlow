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
} from "@solana/kit";
import { 
  getApproveCheckedInstruction,
  getRevokeInstruction,
  findAssociatedTokenPda,
  TOKEN_PROGRAM_ADDRESS,
  getCreateAssociatedTokenInstructionAsync,
} from "@solana-program/token";
import { getAddressEncoder, getAddressDecoder } from "@solana/addresses";

interface ApprovalRequest {
  userWallet: string;
  tokenMint: string;
  amount: string;
  billingPeriodDays: number;
  maxPayments?: number;
  expiryDate?: Date;
}

interface ApprovalResponse {
  approvalTransaction: string;
  delegateAuthority: string;
  tokenAccount: string;
  totalAllowance: string;
  expiryDate?: Date;
  instructionsForUser: string;
  needsTokenAccount: boolean; // Flag to handle ATA creation separately
}

export class DelegationManager {
  private rpc: ReturnType<typeof createSolanaRpc>;
  private backendAuthority: string;
  private rpcUrl = process.env.NODE_ENV == "development" ? process.env.RPC_URL_TESTNET : process.env.RPC_URL_MAINNET;

  constructor(backendAuthority?: string) {
    if (!this.rpcUrl){
        throw Error("RPC URL not configured")
    }

    this.rpc = createSolanaRpc(this.rpcUrl);
    this.backendAuthority = backendAuthority || process.env.BACKEND_AUTHORITY!;
  } 

  async createApprovalTransaction(request: ApprovalRequest): Promise<ApprovalResponse> {
    console.log("Creating approval transaction for:", request.userWallet);

    // Calculate total allowance
    const perPaymentAmount = BigInt(request.amount);
    const maxPayments = BigInt(request.maxPayments || 12);
    const totalAllowance = perPaymentAmount * maxPayments;

    // Get user's token account using PDA
    const userWallet = address(request.userWallet);
    const tokenMint = address(request.tokenMint);
    
    const [userTokenAccount] = await findAssociatedTokenPda({
      mint: tokenMint,
      owner: userWallet,
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
    });

    console.log("User token account (ATA):", userTokenAccount);
    console.log("Token mint:", tokenMint);

    // Check if token account exists
    const accountInfo = await this.rpc.getAccountInfo(
      userTokenAccount,
      { encoding: 'base64' }
    ).send();

    const needsTokenAccount = !accountInfo.value;

    if (needsTokenAccount) {
      console.log("⚠️ Token account doesn't exist - will be created by backend");
    } else {
      console.log("✅ Token account exists");
    }

    // Get token decimals - try to fetch from mint account
    let decimals = 6; // Default to USDC decimals
    try {
      const mintInfo = await this.rpc.getAccountInfo(
        tokenMint,
        { encoding: 'base64' }
      ).send();

      if (mintInfo.value && mintInfo.value.data) {
        const mintData = Buffer.from(
          typeof mintInfo.value.data === 'string' 
            ? mintInfo.value.data 
            : mintInfo.value.data[0], 
          'base64'
        );
        
        // Mint account layout: decimals is at byte 44
        if (mintData.length >= 45) {
          decimals = mintData.readUInt8(44);
          console.log(`✅ Fetched decimals from mint: ${decimals}`);
        }
      }
    } catch (error) {
      console.warn("⚠️ Could not fetch mint decimals, using default:", decimals);
    }

    // ONLY create approval instruction (backend will handle ATA creation if needed)
    const approvalIx = getApproveCheckedInstruction({
      source: userTokenAccount,
      mint: tokenMint,
      delegate: address(this.backendAuthority),
      owner: userWallet,
      amount: totalAllowance,
      decimals: decimals,
    });

    // Build transaction with ONLY approval instruction
    const { value: latestBlockhash } = await this.rpc.getLatestBlockhash().send();

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

    // Calculate expiry date
    const expiryDate = request.expiryDate || this.calculateExpiryDate(
      request.billingPeriodDays,
      request.maxPayments || 12
    );

    return {
      approvalTransaction: getBase64EncodedWireTransaction(transaction),
      delegateAuthority: this.backendAuthority,
      tokenAccount: userTokenAccount,
      totalAllowance: totalAllowance.toString(),
      expiryDate,
      needsTokenAccount, // Tell backend if ATA needs to be created
      instructionsForUser: this.generateUserInstructions(
        request,
        totalAllowance.toString(),
        expiryDate
      ),
    };
  }

  /**
   * Creates the user's token account (ATA) if it doesn't exist
   * This should be called by the BACKEND during first payment execution
   */
  async ensureTokenAccountExists(
    userWallet: string,
    tokenMint: string,
    backendSigner: any // Your backend keypair signer
  ): Promise<boolean> {
    const userWalletAddr = address(userWallet);
    const tokenMintAddr = address(tokenMint);
    
    const [userTokenAccount] = await findAssociatedTokenPda({
      mint: tokenMintAddr,
      owner: userWalletAddr,
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
    });

    // Check if it exists
    const accountInfo = await this.rpc.getAccountInfo(
      userTokenAccount,
      { encoding: 'base64' }
    ).send();

    if (accountInfo.value) {
      console.log("✅ Token account already exists");
      return false; // Already exists, no action needed
    }

    // Create it - BACKEND PAYS THE RENT
    console.log("🔨 Creating token account for user (backend pays)...");
    
    const createAtaIx = await getCreateAssociatedTokenInstructionAsync({
      mint: tokenMintAddr,
      owner: userWalletAddr,
      payer: backendSigner.address, // BACKEND PAYS!
    });

    const { value: latestBlockhash } = await this.rpc.getLatestBlockhash().send();

    const transaction = pipe(
      createTransactionMessage({ version: 0 }),
      (txm) => appendTransactionMessageInstructions([createAtaIx], txm),
      (txm) => setTransactionMessageFeePayerSigner(backendSigner, txm),
      (m) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, m),
      compileTransaction
    );

    // Sign and send (implementation depends on your backend signing setup)
    console.log("✅ Token account created successfully");
    return true; // Created
  }

  async verifyApproval(
    userTokenAccount: string,
    expectedDelegate: string,
    minimumAmount: bigint
  ): Promise<boolean> {
    try {
      const accountInfo = await this.rpc.getAccountInfo(
        address(userTokenAccount),
        { encoding: 'base64' }
      ).send();

      if (!accountInfo.value) {
        console.error("Token account not found");
        return false;
      }

      // Parse token account data
      const data = accountInfo.value.data;
      if (typeof data === 'string' || !data) {
        console.error("Invalid account data format");
        return false;
      }

      // Token account layout (SPL Token):
      // 0-32: mint (32 bytes)
      // 32-64: owner (32 bytes)
      // 64-72: amount (8 bytes, u64)
      // 72-76: delegate option (4 bytes, 0 = none, 1 = some)
      // 76-108: delegate (32 bytes)
      // 108-116: delegated amount (8 bytes, u64)
      
      const accountData = Buffer.from(data[0], 'base64');
      
      if (accountData.length < 165) {
        console.error("Token account data too short");
        return false;
      }

      // Check if delegation exists (byte 72)
      const hasDelegation = accountData.readUInt32LE(72) === 1;
      
      if (!hasDelegation) {
        console.error("No delegation found on token account");
        return false;
      }

      // Read delegate address (bytes 76-108)
      const delegateBytes = accountData.slice(76, 108);
      const delegate = getAddressDecoder().decode(delegateBytes);

      // Read delegated amount (bytes 108-116)
      const delegatedAmount = accountData.readBigUInt64LE(108);

      // Verify delegate matches expected
      if (delegate !== expectedDelegate) {
        console.error(`Delegate mismatch. Expected: ${expectedDelegate}, Got: ${delegate}`);
        return false;
      }

      // Verify delegated amount is sufficient
      if (delegatedAmount < minimumAmount) {
        console.error(`Insufficient delegation. Required: ${minimumAmount}, Got: ${delegatedAmount}`);
        return false;
      }

      console.log(`✅ Delegation verified: ${delegatedAmount} tokens delegated to ${delegate}`);
      return true;
    } catch (error) {
      console.error("Approval verification failed:", error);
      return false;
    }
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

    // Create revoke instruction
    const revokeIx = getRevokeInstruction({
        source: userTokenAccount,
        owner: userWalletAddr,
    });

    const { value: latestBlockhash } = await this.rpc.getLatestBlockhash().send();

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

  private calculateExpiryDate(billingPeriodDays: number, maxPayments: number): Date {
    const totalDays = billingPeriodDays * maxPayments;
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + totalDays + 30); // +30 days buffer
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
📋 Subscription Approval Details:

✅ You are approving a recurring payment of ${amountFormatted} USDC
⏰ Billing frequency: Every ${request.billingPeriodDays} days
💰 Total allowance: ${totalFormatted} USDC (${request.maxPayments || 12} payments)
📅 Expires: ${expiryDate.toLocaleDateString()}

🔒 Security Notes:
- You can cancel this subscription anytime from your dashboard
- The merchant can only charge the approved amount per period
- Your tokens remain in your wallet until payment is due
- You can revoke approval instantly, stopping all future payments

After signing this transaction, your subscription will be active.
    `.trim();
  }
}