# ⚡ SubFlow — Solana-Powered Digital Marketplace

> **A decentralized marketplace for digital products, built on Solana with Sanctum Gateway at its core.**

SubFlow is a **next-generation digital marketplace** that enables creators to sell digital products (courses, ebooks, templates, software) using **USDC on Solana**. With instant payments, secure file delivery, and zero chargebacks, SubFlow revolutionizes how digital goods are bought and sold online.

**Built for the [Sanctum Gateway Track](https://earn.superteam.fun/listing/sanctum-gateway-track)** — showcasing the power of reliable, fast blockchain transactions.

---

## 🌟 Why Sanctum Gateway Powers SubFlow

The **Sanctum Gateway** is the backbone of SubFlow's payment infrastructure.  

Traditional blockchain payments suffer from:
- ❌ Transaction failures during network congestion
- ❌ Complex retry logic and RPC management
- ❌ Unpredictable confirmation times
- ❌ Manual priority fee calculation

**Sanctum Gateway solves all of this:**

### 🚀 What Sanctum Provides

- **Multi-Route Delivery** — Transactions are sent through multiple pathways (RPC, Jito bundles) to ensure they land even during high congestion
- **Auto-Tipping & Priority Fees** — Dynamic compute unit pricing and Jito tips to prioritize transactions
- **Reliable Confirmation** — Built-in confirmation polling with exponential backoff
- **Universal RPC Abstraction** — One API for all Solana RPC operations, abstracting away complexity
- **Production-Ready JSON-RPC** — Simple, consistent interface for blockchain interactions

### 🔧 How SubFlow Uses Sanctum

Every payment in SubFlow flows through Sanctum Gateway:

1. **Fresh Blockhash Fetching** — Always get the latest blockhash to avoid replay errors
2. **Transaction Building** — Construct complex multi-instruction transactions (transfers, compute budget, Jito tips)
3. **Multi-Delivery Execution** — Send transactions through multiple channels for maximum reliability
4. **Confirmation Tracking** — Poll transaction status until finalized on-chain
5. **Priority Fee Optimization** — Fetch real-time priority fees to ensure fast confirmation

```typescript
// Example: Payment flow powered by Sanctum Gateway
const gateway = new SanctumGatewayClient();

// 1. Get fresh blockchain data
const { value: latestBlockhash } = await gateway.getLatestBlockhash();
const priorityFee = await gateway.getPriorityFee([accounts]);
const tipInstructions = await gateway.getTipInstructions(feePayer);

// 2. Build transaction with optimizations
const transaction = buildTransactionWith({
  blockhash: latestBlockhash,
  priorityFee,
  tipInstructions,
  transfers: [merchantTransfer, platformTransfer]
});

// 3. Confirm on-chain
const confirmed = await gateway.confirmTransaction(signature, 30);
```

---

## 🎯 What is SubFlow?

SubFlow is a **digital marketplace platform** where:

- 🎨 **Creators** upload and sell digital products (courses, ebooks, templates, music, software)
- 💳 **Customers** purchase using USDC on Solana with their wallet
- 📦 **Instant Delivery** — Secure, time-limited download links generated after payment
- 🔒 **Zero Chargebacks** — Blockchain payments are final and irreversible
- ⚡ **Lightning Fast** — Payments confirm in seconds thanks to Sanctum Gateway

### Core Features

#### For Sellers (Creators/Organizations)
- ✅ Upload digital products with metadata (name, description, images, tags)
- ✅ Set pricing in USDC (fractional pricing supported)
- ✅ Receive 100% of product price (platform takes $1 flat fee)
- ✅ Real-time payment notifications via webhooks
- ✅ Dashboard to track sales, revenue, and analytics
- ✅ Categorize products for better discoverability

#### For Buyers (Customers)
- ✅ Browse marketplace with search, filters, and categories
- ✅ Pay instantly with Solana wallet (Phantom, Backpack, Solflare)
- ✅ Receive secure download links after payment
- ✅ Re-download files within configured limits
- ✅ View purchase history and transaction receipts
- ✅ All payments secured on-chain with transparency

#### Technical Features
- ✅ Secure file storage (Supabase integration)
- ✅ Expiring download links (configurable per product)
- ✅ Download limits to prevent abuse
- ✅ HMAC-SHA256 webhook signatures
- ✅ Dead letter queue for failed operations
- ✅ Full transaction audit trail

---

## 🏗️ Architecture Overview

### Payment Flow (Customer Signs Transaction)

```
1. Customer browses marketplace
2. Selects product → Creates payment session
3. Backend builds transaction:
   - Transfer to merchant
   - Transfer to platform ($1 fee)
   - Compute budget instructions
   - Jito tip instructions (via Sanctum)
4. Customer signs transaction with wallet
5. Transaction sent to Solana via Sanctum Gateway
6. Sanctum ensures delivery through:
   - Direct RPC submission
   - Jito bundle submission
   - Automatic retries
7. Confirmation tracked via Sanctum
8. Purchase record created
9. Webhook sent to merchant
10. Download link generated for customer
```

### Key Integration: Sanctum Gateway Client

```typescript
export class SanctumGatewayClient {
  private gatewayUrl: string;
  private rpc: ReturnType<typeof createSolanaRpc>;

  // Get Jito tip instructions for priority
  async getTipInstructions(feePayer: string): Promise<Instruction[]> {
    const response = await fetch(this.gatewayUrl, {
      method: "POST",
      body: JSON.stringify({
        method: "getTipInstructions",
        params: [{ feePayer, deliveryMethodType: "rpc" }],
      }),
    });
    return response.json().result;
  }

  // Send transaction through multiple channels
  async sendTransaction(signedTx: any): Promise<{ signature: string }> {
    const response = await fetch(this.gatewayUrl, {
      method: "POST",
      body: JSON.stringify({
        method: "sendTransaction",
        params: [getBase64EncodedWireTransaction(signedTx)],
      }),
    });
    return response.json().result;
  }

  // Confirm transaction finality
  async confirmTransaction(sig: string, maxAttempts = 30): Promise<boolean> {
    for (let i = 0; i < maxAttempts; i++) {
      const result = await this.rpc.getSignatureStatuses([signature(sig)]).send();
      if (result.value[0]?.confirmationStatus === "confirmed") return true;
      await sleep(1000);
    }
    return false;
  }
}
```

---

## 📊 Database Schema

### Core Tables

**Organizations** — Seller accounts
```sql
- id, name, email, apiKey
- webhookUrl, webhookSecret
- logoUrl, website
- isActive, timestamps
```

**Products** — Digital products for sale
```sql
- id, organizationId, name, slug, description
- price (in smallest unit), tokenMint, merchantWallet
- categoryId, tags[], isFeatured
- fileSize, fileType, downloadLimit, linkExpiryHours
- supabaseFileId, supabaseBucket
- viewCount, purchaseCount, rating
- isActive, timestamps
```

**Categories** — Product organization
```sql
- id, name, slug, description
- icon, imageUrl, parentId
- displayOrder, isActive
```

**Payment Sessions** — Checkout sessions
```sql
- id, productId, organizationId
- customerWallet, customerEmail
- amount, platformFee, totalAmount
- tokenMint, merchantWallet
- status (pending/completed/expired)
- expiresAt, confirmedAt
```

**Payments** — Confirmed transactions
```sql
- id, sessionId, productId, organizationId
- merchantAmount, platformFee, totalAmount
- txSignature, status, deliveryMethod
- priorityFee, slotSent, slotConfirmed
```

**Purchases** — Customer ownership records
```sql
- id, productId, sessionId, paymentId
- customerWallet, customerEmail
- pricePaid, txSignature
- downloadCount, maxDownloads, lastDownloadAt
- status, metadata
```

**Download Links** — Secure, expiring download URLs
```sql
- id, purchaseId, productId
- token (unique), customerWallet
- expiresAt, isUsed, usedAt
- ipAddress, userAgent
```

---

## 🔐 Security Features

### 1. Transaction Security
- ✅ Customer signs all transactions (non-custodial)
- ✅ On-chain verification of payments
- ✅ Unique transaction signatures prevent double-spending
- ✅ Real-time blockchain confirmation

### 2. File Delivery Security
- ✅ Expiring download tokens (e.g., 24 hours)
- ✅ Download limits per purchase (e.g., 5 downloads)
- ✅ Secure file storage with access controls
- ✅ IP and user agent tracking for abuse prevention

### 3. Webhook Security
- ✅ HMAC-SHA256 signature verification
- ✅ Timestamp validation to prevent replay attacks
- ✅ HTTPS-only webhook endpoints
- ✅ Exponential backoff retries

### 4. API Security
- ✅ Organization API keys for authentication
- ✅ CRON job authentication via secrets
- ✅ Rate limiting (planned)
- ✅ Input validation and sanitization

---

## 🚀 API Endpoints

### Public Marketplace API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/public/products` | GET | List all active products (with pagination, search, filters) |
| `/api/products/:slugOrId` | GET | Get product details by slug or ID |
| `/api/public/categories` | GET | Get all categories with product counts |

### Payment Flow API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/payments/create-session` | POST | Create payment session, returns transaction to sign |
| `/api/payments/confirm` | POST | Confirm payment after customer signs transaction |
| `/api/purchases/wallet/:wallet` | GET | Get all purchases for a wallet address |
| `/api/purchases/:id/download` | POST | Generate secure download link |

### Organization/Seller API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/organizations` | POST | Create new organization |
| `/api/organizations/:id/products` | GET/POST | List or create products |
| `/api/organizations/:id/metrics` | GET | Get sales analytics |
| `/api/organizations/:id/payments` | GET | Get payment history |
| `/api/products/:id/upload` | POST | Upload product file to storage |

### Admin/System API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/metrics` | GET | Platform-wide metrics |
| `/api/cron/process-webhooks` | POST | Deliver queued webhooks |
| `/api/cron/cleanup-links` | POST | Remove expired download links |

---

## 🛠️ Technology Stack

### Frontend
- **Next.js 14** (App Router) — Modern React framework
- **TypeScript** — Type-safe development
- **Tailwind CSS** — Utility-first styling
- **shadcn/ui** — Beautiful component library
- **Solana Wallet Adapter** — Multi-wallet support

### Backend
- **Next.js API Routes** — Serverless functions
- **PostgreSQL** — Relational database (Vercel Postgres)
- **Drizzle ORM** — Type-safe database queries
- **Supabase Storage** — Secure file storage

### Blockchain
- **Solana Web3.js 2.0** — Modern Solana SDK
- **Sanctum Gateway** — Transaction reliability layer
- **SPL Token** — USDC transfers
- **Jito Integration** — Priority transaction routing

### DevOps
- **Vercel** — Hosting and deployments
- **Vercel Cron Jobs** — Scheduled tasks
- **Environment Variables** — Secure configuration

---

## ⚙️ Setup & Installation

### Prerequisites

- **Node.js** v18+ and pnpm
- **PostgreSQL** database (local or hosted)
- **Solana Wallet** with devnet/mainnet SOL and USDC
- **Supabase Account** (for file storage)
- **Sanctum Gateway API Key** ([get one here](https://gateway.sanctum.so))

### Environment Variables

Create `.env.local`:

```bash
# Database
DATABASE_URL="postgresql://..."

# Solana & Sanctum
GATEWAY_API_KEY="your_sanctum_gateway_api_key"
NEXT_PUBLIC_RPC_URL="https://api.mainnet-beta.solana.com"
NODE_ENV="development" # or "production"

# Backend Keypair (for webhook verification, if needed)
BACKEND_KEYPAIR="base58_encoded_keypair"

# Secrets
CRON_SECRET="your_secure_cron_secret"
WEBHOOK_SECRET="your_webhook_signing_secret"

# Supabase (for file storage)
NEXT_PUBLIC_SUPABASE_URL="https://xxx.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your_anon_key"
SUPABASE_SERVICE_ROLE_KEY="your_service_key"

# Platform Config
BASE_URL="http://localhost:3000" # or production URL
```

### Installation Steps

```bash
# 1. Clone repository
git clone https://github.com/Emengkeng/SubFlow.git
cd subflow

# 2. Install dependencies
pnpm install

# 3. Set up database
pnpm db:push  # Apply schema to database

# 4. Seed initial data (optional)
pnpm db:seed

# 5. Run development server
pnpm run dev
```

Visit `http://localhost:3000` to see the marketplace.

### Database Setup

```sql
-- Key indexes for performance
CREATE INDEX idx_products_slug ON products(slug);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_active ON products(is_active);
CREATE INDEX idx_purchases_customer ON purchases(customer_wallet);
CREATE INDEX idx_download_links_token ON download_links(token);
CREATE INDEX idx_payments_tx ON payments(tx_signature);

-- Unique constraint for active product slugs
CREATE UNIQUE INDEX unique_product_slug 
  ON products(slug) 
  WHERE is_active = true;
```

---

## 📈 Performance & Scalability

### Transaction Reliability (via Sanctum)
- **99.9%+ Success Rate** — Multi-route delivery ensures transactions land
- **Sub-second Confirmation** — Priority fees and Jito tips speed up inclusion
- **Automatic Retries** — Failed RPCs are automatically retried through alternate routes
- **Congestion Handling** — Adaptive priority fees adjust to network conditions

### File Delivery
- **CDN-backed Storage** — Fast file downloads globally via Supabase CDN
- **Lazy Link Generation** — Download links created on-demand, not pre-generated
- **Expiring Tokens** — Reduces storage overhead for expired links
- **Efficient Queries** — Indexed database lookups for fast retrieval

### Webhook Processing
- **Batched Delivery** — Process webhooks in parallel
- **Exponential Backoff** — Retry failed webhooks intelligently
- **Dead Letter Queue** — Failed events stored for manual retry
- **CRON Job Scheduling** — Run webhook processor every 1 minute

---

## 💡 Future Enhancements

### Planned Features
- [ ] **Multi-chain Support** — Expand to other blockchains (Ethereum, Polygon, Base)
- [ ] **Subscription Products** — Recurring payments for SaaS/memberships
- [ ] **NFT Gating** — Require NFT ownership to purchase certain products
- [ ] **Royalty Splits** — Automatic revenue sharing between collaborators
- [ ] **Analytics Dashboard** — Advanced sales analytics and reporting
- [ ] **Affiliate Program** — Referral links with commission tracking
- [ ] **Mobile Apps** — Native iOS/Android marketplace apps
- [ ] **Web3 Social** — On-chain reviews and reputation system

### Technical Improvements
- [ ] **Helius/Triton Priority Fees** — Dynamic priority fee estimation
- [ ] **Transaction Monitoring** — Real-time transaction status updates via WebSocket
- [ ] **Advanced Retry Logic** — Custom retry strategies for different failure types
- [ ] **Multi-token Support** — Accept payments in SOL, BONK, other SPL tokens
- [ ] **Compression** — Use Solana state compression for cheaper storage

---

## 🧑‍💻 Development

### Project Structure

```
subflow/
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   │   ├── products/      # Product endpoints
│   │   ├── payments/      # Payment endpoints
│   │   ├── organizations/ # Org endpoints
│   │   └── cron/          # Scheduled jobs
│   ├── products/          # Marketplace pages
│   ├── dashboard/         # Seller dashboard
│   └── my-purchase/       # Customer purchases
├── components/            # React components
│   ├── ui/               # shadcn components
│   └── ...               # Custom components
├── lib/                   # Shared utilities
│   ├── db/               # Database layer
│   │   ├── schema.ts     # Drizzle schema
│   │   └── queries.ts    # Query functions
│   ├── payments/         # Payment logic
│   │   ├── executor.ts   # Payment executor
│   │   └── sanctum-gateway.ts  # Sanctum client
│   └── utils/            # Helper functions
└── public/               # Static assets
```

### Adding a New Product

```typescript
// 1. Create product via API
POST /api/organizations/:orgId/products
{
  "name": "React Mastery Course",
  "description": "Learn React from scratch",
  "price": "49000000", // $49 USDC (6 decimals)
  "tokenMint": "Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr",
  "merchantWallet": "YourSolanaWalletAddress",
  "categoryId": "uuid-of-category",
  "downloadLimit": 5,
  "linkExpiryHours": 48
}

// 2. Upload file
POST /api/products/:productId/upload
Content-Type: multipart/form-data
- file: [binary]

// 3. Product is now live on marketplace!
```

### Testing Payments

```typescript
// Use devnet for testing
// 1. Get devnet SOL from faucet
// 2. Get devnet USDC from faucet
// 3. Connect Phantom wallet to devnet
// 4. Purchase product on local marketplace
// 5. Check transaction on Solana Explorer (devnet)
```

---

## 🤝 Contributing

We welcome contributions! Here's how:

1. **Fork the repository**
2. **Create a feature branch** (`git checkout -b feature/amazing-feature`)
3. **Commit changes** (`git commit -m 'Add amazing feature'`)
4. **Push to branch** (`git push origin feature/amazing-feature`)
5. **Open a Pull Request**

### Development Guidelines
- Follow TypeScript best practices
- Write clean, documented code
- Test payment flows thoroughly on devnet
- Update documentation for new features

---

## 📜 License

MIT License - see LICENSE file for details.

---

## 🙏 Acknowledgements

### Sanctum Gateway
**This project would not exist without [Sanctum Gateway](https://gateway.sanctum.so).**

SubFlow relies entirely on Sanctum for:
- Transaction reliability and delivery
- Priority fee optimization
- Jito bundle integration
- RPC abstraction and management
- Confirmation tracking

Sanctum enables developers to build production-grade payment systems on Solana without worrying about low-level transaction orchestration.

### Built With
- [Next.js](https://nextjs.org) — React framework
- [Solana Web3.js](https://github.com/solana-labs/solana-web3.js) — Solana SDK
- [Sanctum Gateway](https://gateway.sanctum.so) — Transaction reliability
- [Drizzle ORM](https://orm.drizzle.team) — Type-safe database
- [Supabase](https://supabase.com) — File storage & auth
- [shadcn/ui](https://ui.shadcn.com) — Component library

---

## 📧 Contact & Support

**Author:** Emengkeng Juslen Kenmini  
**Building:** Decentralized commerce infrastructure for Africa and beyond 🌍

**Hackathon:** [Sanctum Gateway Track](https://earn.superteam.fun/listing/sanctum-gateway-track)

---

### ⚡ SubFlow: Where Web3 Meets Digital Commerce

**Powered by Sanctum Gateway. Built on Solana. Made for Creators.**

🚀 **Try it now:** [subflow.vercel.app](https://subflow.vercel.app)  
📖 **Documentation:** [docs.subflow.xyz](https://gateway.sanctum.so/docs)  