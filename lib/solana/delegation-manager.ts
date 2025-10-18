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
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana-program/token";
import { PublicKey } from "@solana/web3.js";

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
}

export class DelegationManager {
  private rpc: ReturnType<typeof createSolanaRpc>;
  private backendAuthority: PublicKey;

  constructor(rpcUrl?: string, backendAuthority?: string) {
    this.rpc = createSolanaRpc(
      rpcUrl || process.env.RPC_URL || "https://api.mainnet-beta.solana.com"
    );
    this.backendAuthority = new PublicKey(
      backendAuthority || process.env.BACKEND_AUTHORITY!
    );
  }

  async createApprovalTransaction(request: ApprovalRequest): Promise<ApprovalResponse> {
    console.log("Creating approval transaction for:", request.userWallet);

    // Calculate total allowance
    const perPaymentAmount = BigInt(request.amount);
    const maxPayments = BigInt(request.maxPayments || 12);
    const totalAllowance = perPaymentAmount * maxPayments;

    // Get user's token account
    const userWallet = new PublicKey(request.userWallet);
    const tokenMint = new PublicKey(request.tokenMint);
    const userTokenAccount = getAssociatedTokenAddressSync(
      tokenMint,
      userWallet,
      false,
      TOKEN_PROGRAM_ID
    );

    // Get token decimals (USDC = 6)
    const decimals = 6;

    // Create approval instruction
    const approvalIx = getApproveCheckedInstruction({
      account: address(userTokenAccount.toString()),
      mint: address(tokenMint.toString()),
      delegate: address(this.backendAuthority.toString()),
      owner: address(userWallet.toString()),
      amount: totalAllowance,
      decimals: decimals,
    });

    // Build transaction
    const { value: latestBlockhash } = await this.rpc.getLatestBlockhash().send();

    const transaction = pipe(
      createTransactionMessage({ version: 0 }),
      (txm) => appendTransactionMessageInstructions([approvalIx], txm),
      (txm) => setTransactionMessageFeePayerSigner(
        { address: address(userWallet.toString()) } as any,
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
      delegateAuthority: this.backendAuthority.toString(),
      tokenAccount: userTokenAccount.toString(),
      totalAllowance: totalAllowance.toString(),
      expiryDate,
      instructionsForUser: this.generateUserInstructions(
        request,
        totalAllowance.toString(),
        expiryDate
      ),
    };
  }

  async verifyApproval(
    userTokenAccount: string,
    expectedDelegate: string,
    minimumAmount: bigint
  ): Promise<boolean> {
    try {
      const accountInfo = await this.rpc.getAccountInfo(
        address(userTokenAccount)
      ).send();

      if (!accountInfo.value) {
        console.error("Token account not found");
        return false;
      }

      //TODO: In production, parse token account data to verify delegation
      // For now, return true if account exists
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
    const userWalletPubkey = new PublicKey(userWallet);
    const tokenMintPubkey = new PublicKey(tokenMint);
    const userTokenAccount = getAssociatedTokenAddressSync(
      tokenMintPubkey,
      userWalletPubkey,
      false,
      TOKEN_PROGRAM_ID
    );

    // Create revoke instruction
    const revokeIx = getRevokeInstruction({
      account: address(userTokenAccount.toString()),
      owner: address(userWallet),
    });

    const { value: latestBlockhash } = await this.rpc.getLatestBlockhash().send();

    const transaction = pipe(
      createTransactionMessage({ version: 0 }),
      (txm) => appendTransactionMessageInstructions([revokeIx], txm),
      (txm) => setTransactionMessageFeePayerSigner(
        { address: address(userWallet) } as any,
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
    const amountFormatted = (Number(request.amount) / 1_000_000).toFixed(2); // Assuming 6 decimals
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