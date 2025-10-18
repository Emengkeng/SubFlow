# ⚡ SubFlow — Powered by Sanctum Gateway

> **Revolutionizing subscription automation and payments on Solana, built on the rock-solid foundation of [Sanctum Gateway](https://gateway.sanctum.so/docs).**

SubFlow is a **multi-subscription and webhook automation platform** that enables organizations to handle recurring payments, automate subscription renewals, and deliver verified webhook events — **all through the blazing-fast, censorship-resistant Sanctum network**.  

Where Sanctum handles *execution*, *delivery*, and *reliability on Solana*, SubFlow builds the **intelligence and automation layer** on top — managing billing cycles, retries, webhooks, and analytics for any application or merchant.

---

## 🌟 Why Sanctum Matters

The **Sanctum Gateway** is the heartbeat of this project.  
Without it, real-time, reliable blockchain payments would require direct node orchestration, rate-limit management, and custom retry logic.

Sanctum changes that by providing:
- ⚙️ **Universal RPC abstraction** — faster and safer than direct RPC calls  
- 🚀 **Multi-route delivery system** — ensures every transaction *lands*, even under congestion  
- 🔁 **Auto-tipping & compute unit management** — boosting transaction priority dynamically  
- 💡 **Developer-first JSON-RPC API** — simple, consistent, and production-ready  

By integrating Sanctum Gateway directly into our payment executor, SubFlow guarantees that **every recurring payment and webhook event reaches finality** — fast, reliable, and on-chain.

---

## 🧩 Architecture Overview

### 🔧 How SubFlow Uses Sanctum
- Fetches latest blockhash and compute unit configurations via Sanctum  
- Builds and signs complex multi-instruction transactions  
- Sends transactions using multiple delivery methods for maximum reliability  
- Confirms finality using Sanctum’s confirmation endpoints  
- Fetches real-time tip instructions via Jito integration for optimal performance  

### Core Integration Example
```ts
const gateway = new SanctumGatewayClient();

// Fetch dynamic tip instructions
const tips = await gateway.getTipInstructions(feePayer);

// Send transaction through Sanctum network
const result = await gateway.sendTransaction(signedTransaction);

// Confirm transaction finality
await gateway.confirmTransaction(result.signature);
````

---

## 🚀 Features

### 💳 Multi-Subscription Management

* Unlimited subscriptions per user
* Individual billing cycles and retries
* Real-time plan search and unified dashboard
* Bulk cancellation and reactivation support

### 🔔 Webhook Delivery System

* HMAC-SHA256 signature verification
* Exponential backoff retries (5 attempts)
* Secure HTTPS webhook delivery
* Test and verify endpoints for developers
* Dead letter queue for failed events

### 🧠 Smart Payment Executor

* Dual-transfer logic (merchant + platform fee)
* Dynamic priority fees using Sanctum
* Auto-handling of congestion, timeouts, and RPC errors
* Full classification and retry management

---

## 📊 Cron & Scheduling

| Task                    | Endpoint                          | Interval        |
| ----------------------- | --------------------------------- | --------------- |
| Process subscriptions   | `/api/cron/process-subscriptions` | Every 5 minutes |
| Deliver queued webhooks | `/api/cron/process-webhooks`      | Every 1 minute  |

---

## 📡 API Endpoints

### User-Facing

| Endpoint                              | Method | Description                |
| ------------------------------------- | ------ | -------------------------- |
| `/api/subscriptions/initiate`         | POST   | Start checkout             |
| `/api/subscriptions/confirm`          | POST   | Confirm subscription       |
| `/api/subscriptions/user/[wallet]`    | GET    | List user subscriptions    |
| `/api/user/dashboard`                 | GET    | Unified dashboard          |
| `/api/user/subscriptions/bulk-cancel` | POST   | Bulk cancellation          |
| `/api/plans/search`                   | GET    | Search all available plans |

### Merchant-Facing

| Endpoint                        | Method | Description         |
| ------------------------------- | ------ | ------------------- |
| `/api/organizations`            | POST   | Create organization |
| `/api/organizations/[id]/plans` | POST   | Create plan         |
| `/api/webhooks/test`            | POST   | Send test webhook   |
| `/api/webhooks/verify`          | POST   | Verify signatures   |

### Admin & Cron

| Endpoint                          | Method | Description               | Frequency   |
| --------------------------------- | ------ | ------------------------- | ----------- |
| `/api/cron/process-subscriptions` | POST   | Process due subscriptions | Every 5 min |
| `/api/cron/process-webhooks`      | POST   | Deliver queued webhooks   | Every 1 min |
| `/api/admin/metrics`              | GET    | System metrics            |             |
| `/api/admin/payments/[id]/retry`  | POST   | Retry failed payments     |             |

---

## 🔐 Security Highlights

* HMAC-SHA256 signature verification with timestamp validation
* Role-based admin control
* HTTPS enforcement
* Cron job authentication via `CRON_SECRET`
* Automatic error classification and DLQ backup

---

## ⚙️ Environment Setup

### Required Environment Variables

### Prerequisites

Ensure you have the following installed on your local machine:

- **Node.js** (v18 or higher)
- **Postgres** (for database)
- **Stripe CLI** (for handling webhooks)

### Environment Variables

You'll need to set up the following environment variables for the application to run properly:

```bash
POSTGRES_URL="postgres://"
# For Stripe Test mode
STRIPE_WEBHOOK_SECRET=""
STRIPE_SECRET_KEY=""
BASE_URL="http://localhost:3000"
```

You can set these in a `.env.local` file in the root directory of the project.

### Installation

1. Clone the repository:

```bash
DATABASE_URL=
RPC_URL=https://api.mainnet-beta.solana.com
GATEWAY_API_KEY=your_sanctum_gateway_api_key
BACKEND_KEYPAIR=base58_private_key
CRON_SECRET=your_cron_secret
WEBHOOK_SECRET=your_webhook_secret
```

### Database Indexes

```sql
CREATE INDEX idx_subscriptions_user ON subscriptions(user_wallet);
CREATE INDEX idx_subscriptions_due ON subscriptions(next_billing_date, status)
  WHERE status = 'active';
CREATE UNIQUE INDEX unique_active_subscription
  ON subscriptions(plan_id, user_wallet, status)
  WHERE status IN ('active', 'pending_approval');
```

### Cron Jobs

```bash
Subscriptions Processor: Every 5 minutes
Webhook Dispatcher: Every 1 minute
```

---

## 🧠 Tech Stack

* **Next.js (App Router)**
* **TypeScript**
* **PostgreSQL**
* **Sanctum Gateway**
* **CRON API Jobs**
* **Serverless Architecture**

---

## 📈 Performance & Scalability

* Efficient grouped processing by organization
* Fully indexed queries for `user_wallet` and `next_billing_date`
* Parallelized processing for thousands of subscriptions
* Dead letter queue for resilient recovery

---

## 💡 Future Improvements

* Add webhook event replay UI
* Integrate subscription analytics dashboard
* Add multi-chain payment support
* Enable merchant-level custom webhook endpoints
* Introduce real-time transaction monitoring via Sanctum WebSocket

---

## 🧠 Setup & Local Development

```bash
# 1. Clone repository
git clone https://github.com/Emengkeng/subflow.git
cd subflow

# 2. Install dependencies
bun install

# 3. Set environment variables
cp .env.example .env

# 4. Run development server
bun dev

# 5. Run scheduled jobs (optional)
bun run cron:subscriptions
bun run cron:webhooks
```

---

## 💬 Credits & Acknowledgements

### 🪄 Sanctum Gateway

**This project wouldn’t exist without [Sanctum Gateway](https://gateway.sanctum.so/docs).**

SubFlow is deeply integrated with Sanctum — it powers transaction execution, blockhash validation, tip management, and confirmation reliability.
We extend our full appreciation to the **Sanctum team** for enabling developers to build next-generation decentralized payment infrastructure with simplicity and confidence.

> *SubFlow was originally scaffolded using a Next.js + Sanctum starter template, then extended into a full production-grade automation system.*

---

### ✨ Author

**Emengkeng Juslen Kenmini**
Building decentralized automation tools for Africa and beyond 🌍

---

### ❤️ Built on Sanctum. Trusted by Developers. Made for Builders.
