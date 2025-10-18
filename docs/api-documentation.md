# Subscription Payment System - Complete API Documentation

## 📋 Table of Contents
- [Authentication](#authentication)
- [User Subscription APIs](#user-subscription-apis)
- [User Dashboard APIs](#user-dashboard-apis)
- [Organization & Plan Management](#organization--plan-management)
- [Admin APIs](#admin-apis)
- [Webhook APIs](#webhook-apis)
- [Cron Jobs](#cron-jobs)
- [Error Responses](#error-responses)

---

## Authentication

Most endpoints require authentication via:
- **User Auth**: Session cookie (uses your existing `getUser()` system)
- **API Key**: `X-API-Key` header for organization endpoints
- **Cron Auth**: `Authorization: Bearer {CRON_SECRET}` for cron endpoints

---

## User Subscription APIs

### 1. Initiate Subscription Checkout

**Endpoint:** `POST /api/subscriptions/initiate`

**Description:** Starts the subscription process and generates a token delegation approval transaction for the user to sign.

**Request Body:**
```json
{
  "planId": "uuid",
  "userWallet": "solana_wallet_address",
  "email": "user@example.com" // optional
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "subscriptionId": "uuid",
  "plan": {
    "name": "Pro Monthly Plan",
    "description": "Access to all premium features",
    "amount": "10000000",
    "billingPeriod": "Every 30 days",
    "merchant": "SaaS Company"
  },
  "approval": {
    "transaction": "base64_encoded_transaction",
    "delegateAuthority": "backend_wallet_address",
    "totalAllowance": "120000000",
    "expiryDate": "2025-12-31T00:00:00.000Z",
    "instructions": "📋 Subscription Approval Details:\n..."
  },
  "notice": "You will be charged immediately upon approval, then every billing period thereafter."
}
```

**Errors:**
- `400` - Missing required fields or duplicate subscription
- `404` - Plan not found

---

### 2. Confirm Subscription

**Endpoint:** `POST /api/subscriptions/confirm`

**Description:** Activates the subscription after user signs the delegation transaction. Processes the first payment immediately.

**Request Body:**
```json
{
  "subscriptionId": "uuid",
  "signature": "solana_transaction_signature"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Subscription activated and first payment processed! 🎉",
  "subscription": {
    "id": "uuid",
    "status": "active",
    "planName": "Pro Monthly Plan",
    "nextBillingDate": "2025-02-15T10:30:00.000Z",
    "amount": "10000000"
  },
  "firstPayment": {
    "id": "payment_uuid",
    "txSignature": "solana_signature",
    "amount": "10000000"
  }
}
```

**Errors:**
- `400` - Missing fields, verification failed, or payment failed
- `404` - Subscription not found

**Notes:**
- First payment is charged immediately
- Subscription is only activated if payment succeeds
- Webhooks are sent to merchant

---

### 3. Get User Subscriptions

**Endpoint:** `GET /api/subscriptions/user/:wallet`

**Description:** Retrieves all subscriptions for a specific wallet address.

**Parameters:**
- `wallet` (path): Solana wallet address

**Response:** `200 OK`
```json
{
  "success": true,
  "subscriptions": [
    {
      "id": "uuid",
      "status": "active",
      "nextBillingDate": "2025-02-15T10:30:00.000Z",
      "createdAt": "2025-01-15T10:30:00.000Z",
      "amount": "10000000",
      "planName": "Pro Monthly Plan",
      "planDescription": "Access to all features",
      "billingPeriodDays": 30,
      "merchantName": "SaaS Company",
      "merchantLogo": "https://...",
      "totalPayments": 5,
      "totalSpent": "50000000"
    }
  ]
}
```

---

### 4. Cancel Subscription

**Endpoint:** `POST /api/subscriptions/:id/cancel`

**Description:** Cancels an active subscription and generates a revocation transaction.

**Parameters:**
- `id` (path): Subscription UUID

**Request Body:**
```json
{
  "userWallet": "solana_wallet_address"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Subscription cancelled",
  "revokeTransaction": "base64_encoded_transaction",
  "instructions": "Sign and submit this transaction to complete cancellation"
}
```

**Errors:**
- `404` - Subscription not found or already cancelled
- `400` - Invalid request

**Notes:**
- User must sign the revocation transaction to complete cancellation
- No further payments will be charged

---

### 5. Get Subscription Payment History

**Endpoint:** `GET /api/subscriptions/:id/payments`

**Description:** Retrieves payment history for a specific subscription.

**Parameters:**
- `id` (path): Subscription UUID

**Response:** `200 OK`
```json
{
  "success": true,
  "payments": [
    {
      "id": "uuid",
      "amount": "10000000",
      "status": "confirmed",
      "txSignature": "solana_signature",
      "deliveryMethod": "jito",
      "priorityFee": "5000",
      "retryCount": 0,
      "createdAt": "2025-01-15T10:30:00.000Z",
      "updatedAt": "2025-01-15T10:30:05.000Z"
    }
  ]
}
```

---

## User Dashboard APIs

### 6. Get User Dashboard

**Endpoint:** `GET /api/user/dashboard`

**Description:** Comprehensive dashboard with all subscription data, stats, and upcoming payments.

**Query Parameters:**
- `wallet` (required): User's wallet address

**Response:** `200 OK`
```json
{
  "success": true,
  "dashboard": {
    "subscriptions": [
      {
        "id": "uuid",
        "status": "active",
        "plan": {
          "name": "Pro Plan",
          "organization": {
            "name": "SaaS Company",
            "logoUrl": "https://..."
          }
        },
        "payments": []
      }
    ],
    "stats": {
      "subscriptionsByStatus": [
        { "status": "active", "count": 5 },
        { "status": "cancelled", "count": 2 }
      ],
      "totalSpent": "150000000",
      "totalPayments": 15
    },
    "upcomingPayments": [
      {
        "subscriptionId": "uuid",
        "organizationName": "SaaS Company",
        "planName": "Pro Plan",
        "amount": "10000000",
        "dueDate": "2025-02-01T10:30:00.000Z",
        "daysUntilDue": 5
      }
    ],
    "monthlyRecurring": {
      "monthlyTotal": "90000000",
      "subscriptionCount": 3
    },
    "organizations": [
      {
        "id": "uuid",
        "name": "SaaS Company",
        "logoUrl": "https://...",
        "activeSubscriptions": 2
      }
    ]
  }
}
```

**Errors:**
- `400` - Missing wallet parameter

---

### 7. Get Upcoming Payments

**Endpoint:** `GET /api/user/upcoming-payments`

**Description:** Get detailed view of payments due in the next 30 days.

**Query Parameters:**
- `wallet` (required): User's wallet address

**Response:** `200 OK`
```json
{
  "success": true,
  "upcomingPayments": [
    {
      "subscriptionId": "uuid",
      "organizationName": "Netflix",
      "organizationLogo": "https://...",
      "planName": "Premium Plan",
      "amount": "15990000",
      "dueDate": "2025-02-01T10:30:00.000Z",
      "daysUntilDue": 5
    }
  ],
  "totalUpcoming": "45990000",
  "groupedByWeek": {
    "Week 1": [],
    "Week 2": [],
    "Week 3": [],
    "Week 4": []
  },
  "count": 3
}
```

---

### 8. Get User Organizations

**Endpoint:** `GET /api/user/organizations`

**Description:** Get all organizations the user is subscribed to.

**Query Parameters:**
- `wallet` (required): User's wallet address

**Response:** `200 OK`
```json
{
  "success": true,
  "organizations": [
    {
      "id": "uuid",
      "name": "Netflix",
      "logoUrl": "https://...",
      "activeSubscriptions": 2
    }
  ],
  "count": 3
}
```

---

### 9. Bulk Cancel Subscriptions

**Endpoint:** `POST /api/user/subscriptions/bulk-cancel`

**Description:** Cancel multiple subscriptions at once.

**Request Body:**
```json
{
  "subscriptionIds": ["uuid1", "uuid2", "uuid3"],
  "userWallet": "solana_wallet_address"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "3 subscriptions cancelled",
  "cancelledCount": 3,
  "revokeTransaction": "base64_encoded_transaction",
  "instructions": "Sign this transaction to revoke all delegations"
}
```

**Errors:**
- `400` - Invalid subscription IDs or missing wallet

---

## Organization & Plan Management

### 10. Create Organization

**Endpoint:** `POST /api/organizations`

**Description:** Create a new merchant organization (admin only).

**Authentication:** Requires admin user (role: 'owner')

**Request Body:**
```json
{
  "name": "SaaS Company",
  "email": "billing@saas.com",
  "webhookUrl": "https://saas.com/webhooks"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "organization": {
    "id": "uuid",
    "name": "SaaS Company",
    "email": "billing@saas.com",
    "apiKey": "sk_live_abc123...",
    "webhookSecret": "whsec_xyz789..."
  },
  "message": "Organization created successfully"
}
```

**Errors:**
- `403` - Unauthorized (not admin)
- `400` - Missing required fields

**Important:** Save the `apiKey` and `webhookSecret` securely!

---

### 11. Create Subscription Plan

**Endpoint:** `POST /api/organizations/:orgId/plans`

**Description:** Create a new subscription plan for an organization.

**Parameters:**
- `orgId` (path): Organization UUID

**Request Body:**
```json
{
  "name": "Pro Monthly Plan",
  "description": "Access to all premium features",
  "tokenMint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "amountPerBilling": "10000000",
  "billingPeriodDays": 30,
  "merchantTokenAccount": "merchant_wallet_address",
  "tokenDecimals": 6
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "plan": {
    "id": "uuid",
    "organizationId": "org_uuid",
    "name": "Pro Monthly Plan",
    "description": "Access to all premium features",
    "tokenMint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    "amountPerBilling": "10000000",
    "billingPeriodDays": 30,
    "merchantTokenAccount": "merchant_wallet_address",
    "isActive": true
  }
}
```

**Token Amounts:**
- USDC (6 decimals): `10000000` = 10 USDC
- SOL (9 decimals): `1000000000` = 1 SOL

---

### 12. Get Organization Plans

**Endpoint:** `GET /api/organizations/:orgId/plans`

**Description:** List all plans for an organization.

**Parameters:**
- `orgId` (path): Organization UUID

**Response:** `200 OK`
```json
{
  "success": true,
  "plans": [
    {
      "id": "uuid",
      "name": "Pro Monthly Plan",
      "description": "...",
      "amountPerBilling": "10000000",
      "billingPeriodDays": 30,
      "isActive": true,
      "createdAt": "2025-01-15T10:30:00.000Z"
    }
  ]
}
```

---

### 13. Search Plans

**Endpoint:** `GET /api/plans/search`

**Description:** Search and filter subscription plans across all organizations.

**Query Parameters:**
- `search` (optional): Search in plan name/description
- `orgId` (optional): Filter by organization ID
- `minAmount` (optional): Minimum price
- `maxAmount` (optional): Maximum price
- `billingPeriod` (optional): Billing period in days (e.g., 30)

**Example:**
```
GET /api/plans/search?search=premium&minAmount=5000000&maxAmount=20000000
```

**Response:** `200 OK`
```json
{
  "success": true,
  "plans": [
    {
      "id": "uuid",
      "name": "Premium Plan",
      "description": "...",
      "amountPerBilling": "10000000",
      "billingPeriodDays": 30,
      "organization": {
        "id": "org_uuid",
        "name": "SaaS Company",
        "logoUrl": "https://..."
      }
    }
  ],
  "count": 15
}
```

---

## Admin APIs

### 14. Get System Metrics

**Endpoint:** `GET /api/admin/metrics`

**Description:** Get system-wide metrics and statistics.

**Authentication:** Requires admin user (role: 'owner')

**Response:** `200 OK`
```json
{
  "success": true,
  "timestamp": "2025-01-15T10:30:00.000Z",
  "metrics": {
    "subscriptions": [
      { "status": "active", "count": 150 },
      { "status": "paused", "count": 10 },
      { "status": "cancelled", "count": 25 }
    ],
    "payments24h": [
      { "status": "confirmed", "count": 45, "totalAmount": "450000000" },
      { "status": "failed", "count": 2, "totalAmount": "20000000" }
    ]
  }
}
```

**Errors:**
- `403` - Unauthorized (not admin)

---

### 15. Get Failed Payments

**Endpoint:** `GET /api/admin/failed-payments`

**Description:** List all failed payments that need attention.

**Authentication:** Requires admin user (role: 'owner')

**Response:** `200 OK`
```json
{
  "success": true,
  "failedPayments": [
    {
      "id": "payment_uuid",
      "subscriptionId": "sub_uuid",
      "amount": "10000000",
      "status": "failed",
      "errorMessage": "Insufficient balance",
      "retryCount": 3,
      "userWallet": "wallet_address",
      "planName": "Pro Plan",
      "merchantName": "SaaS Company"
    }
  ]
}
```

---

### 16. Retry Failed Payment

**Endpoint:** `POST /api/admin/payments/:id/retry`

**Description:** Manually retry a failed payment.

**Authentication:** Requires admin user (role: 'owner')

**Parameters:**
- `id` (path): Payment UUID

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Payment queued for retry"
}
```

**Notes:**
- Resets payment status to 'pending'
- Will be picked up by next scheduler run

---

## Webhook APIs

### 17. Test Webhook

**Endpoint:** `POST /api/webhooks/test`

**Description:** Send a test webhook to your configured URL.

**Authentication:** `X-API-Key` header with organization API key

**Request Headers:**
```
X-API-Key: sk_live_abc123...
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Test webhook sent to your configured URL"
}
```

**Errors:**
- `401` - Missing or invalid API key

**Notes:**
- Sends a `test.webhook` event to your webhook URL
- Use this to verify your webhook endpoint is working

---

### 18. Verify Webhook (Example)

**Endpoint:** `POST /api/webhooks/verify`

**Description:** Example endpoint showing how merchants should verify webhooks.

**Request Headers:**
```
X-Webhook-Signature: hmac_sha256_signature
```

**Request Body:** Any webhook payload

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Webhook verified and processed"
}
```

**Errors:**
- `400` - Missing signature
- `403` - Invalid signature

**Merchant Implementation:**
```typescript
const signature = request.headers.get('x-webhook-signature');
const body = await request.text();

const expectedSignature = crypto
  .createHmac('sha256', webhookSecret)
  .update(body)
  .digest('hex');

if (signature !== expectedSignature) {
  return Response.json({ error: 'Invalid signature' }, { status: 403 });
}
```

---

## Cron Jobs

### 19. Process Subscriptions

**Endpoint:** `POST /api/cron/process-subscriptions`

**Description:** Processes all subscriptions due for payment. Should be called every 5 minutes.

**Authentication:** `Authorization: Bearer {CRON_SECRET}`

**Request Headers:**
```
Authorization: Bearer your_cron_secret
```

**Response:** `200 OK`
```json
{
  "success": true,
  "metrics": {
    "totalProcessed": 50,
    "successful": 48,
    "failed": 1,
    "skipped": 1
  },
  "duration": 15600,
  "successRate": 96.00
}
```

**Setup:**
```yaml
# .github/workflows/cron.yml
on:
  schedule:
    - cron: '*/5 * * * *'  # Every 5 minutes

jobs:
  process:
    runs-on: ubuntu-latest
    steps:
      - name: Process Subscriptions
        run: |
          curl -X POST \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
            https://your-app.com/api/cron/process-subscriptions
```

---

### 20. Process Webhooks

**Endpoint:** `POST /api/cron/process-webhooks`

**Description:** Delivers queued webhooks to merchants. Should be called every 1 minute.

**Authentication:** `Authorization: Bearer {CRON_SECRET}`

**Request Headers:**
```
Authorization: Bearer your_cron_secret
```

**Response:** `200 OK`
```json
{
  "success": true,
  "results": {
    "processed": 25,
    "successful": 24,
    "failed": 1
  }
}
```

**Setup:**
```yaml
on:
  schedule:
    - cron: '* * * * *'  # Every minute
```

---

## Error Responses

All endpoints follow a consistent error format:

### 400 Bad Request
```json
{
  "error": "Missing required fields: planId, userWallet"
}
```

### 401 Unauthorized
```json
{
  "error": "Unauthorized"
}
```

### 403 Forbidden
```json
{
  "error": "Unauthorized",
  "details": "Admin access required"
}
```

### 404 Not Found
```json
{
  "error": "Plan not found or inactive"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal server error message"
}
```

---

## Rate Limits

Currently no rate limits enforced. Recommended implementation:

- Public endpoints: 60 requests/minute per IP
- Authenticated endpoints: 300 requests/minute per user
- Cron endpoints: Protected by secret, no limit

---

## Webhook Events Reference

Merchants receive these events at their configured webhook URL:

| Event | Description | When Fired |
|-------|-------------|------------|
| `subscription.created` | New subscription activated | After first payment succeeds |
| `payment.succeeded` | Recurring payment succeeded | Every billing cycle |
| `payment.failed` | Payment failed after retries | When all retries exhausted |
| `subscription.paused` | Subscription auto-paused | Payment failure, cap reached |
| `subscription.cancelled` | User cancelled subscription | User cancels |
| `test.webhook` | Test event | Manual test trigger |

**Webhook Payload Structure:**
```json
{
  "event": "payment.succeeded",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "data": {
    // Event-specific data
  }
}
```

**Webhook Headers:**
```
X-Webhook-Signature: hmac_sha256_signature
X-Webhook-Event: payment.succeeded
X-Webhook-ID: unique_webhook_id
X-Webhook-Timestamp: 2025-01-15T10:30:00.000Z
Content-Type: application/json
```

---

## Testing Guide

### 1. Development Mode

```bash
# Set environment
NODE_ENV=development

# Test endpoints with GET (auto-converts to POST)
curl http://localhost:3000/api/cron/process-subscriptions
curl http://localhost:3000/api/cron/process-webhooks
```

### 2. Postman Collection

Import these examples into Postman:

**Base URL:** `http://localhost:3000` or `https://your-app.com`

**Environment Variables:**
- `base_url`
- `api_key`
- `cron_secret`
- `wallet_address`

### 3. Test Flow

```bash
# 1. Create organization (admin)
POST /api/organizations
{
  "name": "Test Company",
  "email": "test@example.com",
  "webhookUrl": "https://webhook.site/..."
}

# 2. Create plan
POST /api/organizations/{orgId}/plans
{
  "name": "Test Plan",
  "tokenMint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "amountPerBilling": "1000000",
  "billingPeriodDays": 30,
  "merchantTokenAccount": "your_wallet"
}

# 3. User subscribes
POST /api/subscriptions/initiate
{
  "planId": "{planId}",
  "userWallet": "user_wallet_address"
}

# 4. Confirm (after user signs)
POST /api/subscriptions/confirm
{
  "subscriptionId": "{subscriptionId}",
  "signature": "transaction_signature"
}

# 5. Check webhook delivery
GET https://webhook.site (check your test URL)
```

---

## SDK Examples

### JavaScript/TypeScript

```typescript
class SubscriptionClient {
  constructor(private baseUrl: string) {}

  async initiateSubscription(planId: string, userWallet: string) {
    const response = await fetch(`${this.baseUrl}/api/subscriptions/initiate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planId, userWallet }),
    });
    return response.json();
  }

  async confirmSubscription(subscriptionId: string, signature: string) {
    const response = await fetch(`${this.baseUrl}/api/subscriptions/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscriptionId, signature }),
    });
    return response.json();
  }

  async getUserSubscriptions(walletAddress: string) {
    const response = await fetch(
      `${this.baseUrl}/api/subscriptions/user/${walletAddress}`
    );
    return response.json();
  }
}

// Usage
const client = new SubscriptionClient('https://your-app.com');
const result = await client.getUserSubscriptions('wallet_address');
```

---

## Support

For API support:
- Check error messages for details
- Review logs in admin dashboard
- Test with development endpoints first
- Use webhook.site for webhook testing

**Common Issues:**
- Signature verification: Ensure using raw body
- Token amounts: Remember decimals (USDC = 6)
- Cron secret: Match exactly, no extra spaces
- Webhook URL: Must be publicly accessible HTTPS

---

## Changelog

### v1.0.0 (Current)
- ✅ Complete subscription lifecycle
- ✅ HMAC webhook signatures
- ✅ Multiple subscriptions support
- ✅ Bulk operations
- ✅ Comprehensive dashboard
- ✅ Admin management
- ✅ Search and filtering

---

**API Version:** 1.0.0  
**Last Updated:** January 2025  
**Base URL:** `https://your-app.vercel.app`