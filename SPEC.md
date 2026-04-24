# SplitEasy — Complete Product Specification

**Version:** 1.1  
**Date:** 2026-04-24  
**Status:** Approved for Implementation

---

## 1. Product Overview

SplitEasy is a production-grade bill-splitting web app for any group of people sharing expenses — coworkers, housemates, travelers, or ad-hoc groups. It tracks who owes whom, supports flexible split types, generates payment links for settlement, and maintains a full audit trail. No money moves through the platform; it is a ledger and coordination tool.

**Target market:** India-first (INR, UPI), designed for global expansion in v2.

---

## 2. User Roles & Authentication

### 2.1 Auth Methods (all supported at launch)
| Method | Notes |
|---|---|
| Google OAuth | One-click sign-in via Google |
| Email + Password | bcrypt hash, salt rounds ≥ 12 |
| Magic Link (email OTP) | Passwordless — 6-digit OTP valid 15 min |
| Phone / SMS OTP | Mobile number + SMS OTP via Twilio/AWS SNS |

### 2.2 Session Management
- JWT access tokens (15 min TTL)
- Refresh tokens (7 days TTL), stored in httpOnly cookies only
- Token rotation on every refresh
- All protected routes use `authenticateToken` middleware

### 2.3 User Profile Fields
```
id            UUID (PK)
email         string (unique, nullable for phone-only users)
phone         string (unique, nullable for email-only users)
display_name  string
avatar_url    string (nullable)
locale        string (default: "en-IN")
currency      string (default: "INR")
created_at    timestamp
updated_at    timestamp
```

### 2.4 Account Deletion Rules

A user cannot delete their account if they have any unsettled debts (as payer or receiver) in any active group.

- `DELETE /users/me` returns `409 Conflict` if unsettled debts exist; the response body includes the list of group IDs and names blocking deletion
- If no debts exist, the user record is **anonymised** (not hard-deleted):
  - `display_name` set to `"Deleted User"`
  - `email` and `phone` set to `null`
  - `avatar_url` removed
  - All active refresh tokens are immediately revoked
- Expenses, settlements, and audit log entries retain the `user_id` FK but display the anonymised name in the UI
- The user cannot log in after deletion; any tokens in flight are rejected on next refresh

---

## 3. Core Concepts

### 3.1 Groups
A **Group** is the unit of shared expense tracking. All expenses, balances, and settlements belong to a group.

- Any registered user can create a group
- Creator becomes the group **Owner**
- Members are invited via email or shareable invite link
- Any member (including Owner) can add, edit, or delete expenses
- Group currency is set at creation and cannot be changed after the first expense is added
- Groups persist forever — data is never auto-deleted

### 3.2 Expense
An expense records that one or more people paid for something that others also benefited from.

**Paid by:** One or multiple members (split payer support)  
**Split among:** A subset or all group members  
**Split type:** Equal | Exact amounts | Percentage  
**Line items:** Base amount + optional tax + optional tip (each split independently)

### 3.3 Settlement
A settlement records that Person A paid Person B to clear a debt.  
Two-party confirmation: payer marks as paid → receiver confirms receipt → debt cleared.  
Unconfirmed settlements are shown as "pending" and do not affect live balances.

### 3.4 Balance Calculation
Two modes, user selects per group:
- **Direct debts:** Show exact pairwise balances (A owes B ₹X, B owes C ₹Y)
- **Simplified debts:** Minimize transaction count (A pays C ₹X directly, eliminating the chain)

The underlying ledger stores direct debts. Simplification is a view-time computation only.

---

## 4. Feature Specifications

### 4.1 Group Management

#### Create Group
- Fields: name, description (optional), currency (default INR), color/icon (for display)
- Creator becomes Owner automatically
- Set balance mode: Direct | Simplified (can be changed by Owner any time)

#### Invite Members
- Via email: send invitation email with a join link (expires in 7 days)
- Via shareable link: generate a single-use or multi-use invite link
- Invitee must register (or already have an account) to become a full member
- **Guest users** (no account): generate a per-person guest link (see §4.6)

#### Invite Link Limits

- Multi-use invite links have a configurable `max_uses` (default: 100, maximum: 500)
- Multi-use links are rate-limited to **10 joins per hour per link** (Upstash Redis)
- Single-use links are invalidated immediately after the first successful join
- All invite links expire after 7 days regardless of remaining uses
- `POST /groups/:id/invite` returns `422 Unprocessable Entity` if the group already has 50 members

#### Roles within a Group
| Role | Permissions |
|---|---|
| Owner | All permissions + delete group + transfer ownership |
| Member | Add expenses, edit own expenses, propose edits to others' expenses, mark debts as paid |

Note: Editing another member's expense triggers the **dispute/approval flow** (§4.9).

#### Group Deletion
- Owner can delete a group
- All expense and settlement history is archived (`status = ARCHIVED`)
- Archived group data is read-only — it cannot be recovered into an active group
- Archived group debts are **excluded from all balance calculations** across the app
- Deleted groups appear in an "Archived" section of the user's profile, viewable but not interactive

---

### 4.2 Expenses

#### Expense Fields
```
id              UUID
group_id        UUID (FK)
title           string
category_id     UUID (FK, nullable)
payer_splits    array — who paid and how much each (in paise)
participant_splits  array — who owes and how much each (in paise)
base_amount     integer (paise)
tax_amount      integer (paise, default 0)
tip_amount      integer (paise, default 0)
total_amount    integer (paise) — must equal sum of participant_splits exactly
split_type      ENUM: EQUAL | EXACT | PERCENTAGE
tax_split_type  ENUM: EQUAL | EXACT | PERCENTAGE (independent of main split)
tip_split_type  ENUM: EQUAL | EXACT | PERCENTAGE (independent of main split)
receipt_url     string (nullable) — Supabase Storage URL
ocr_data        jsonb (nullable) — raw OCR output
notes           string (nullable)
date            date — when the expense occurred (not created_at)
status          ENUM: ACTIVE | PENDING_APPROVAL | DELETED
recurring_id    UUID (FK, nullable) — link to recurring template
created_by      UUID (FK)
created_at      timestamp
updated_at      timestamp
```

#### Split Types
| Type | Behavior |
|---|---|
| **Equal** | Total divided evenly. If indivisible (e.g. ₹100 / 3), largest remainder assigned to first payer. Remainder must be ≤ 1 paise. |
| **Exact amounts** | Each participant's share entered manually. Validation: sum must equal `total_amount` exactly (enforced server-side with Zod). |
| **Percentage** | Each participant's percentage entered. Must sum to exactly 100%. Amounts computed as `floor(total × pct)` with remainder assigned to reduce rounding. |

#### Tax & Tip
- Entered as separate fields on the expense form
- Each can use a different split strategy from the base amount
- Example: base split by exact amounts (by consumption), tip split equally
- Stored separately in paise; combined into `total_amount` on save
- If tax or tip are zero, their split type is ignored

#### Multiple Payers
- An expense can have multiple payers (e.g. Alice paid ₹300, Bob paid ₹200 for a ₹500 bill)
- `payer_splits` is an array of `{user_id, amount_paise}`
- Sum of payer_splits must equal `total_amount`

#### Expense Amount Bounds

- Minimum expense total: **1 paise** (₹0.01)
- Maximum expense total: **10,00,00,000 paise** (₹10,00,000)
- Server rejects any expense outside this range with `422 Unprocessable Entity`

#### Same-Date Expense Ordering

When multiple expenses share the same `date`, the tiebreaker ordering is `created_at DESC` (most recently created first).

---

### 4.3 Recurring Expenses

#### Template Fields
```
id              UUID
group_id        UUID
title           string
category_id     UUID (nullable)
amount_paise    integer
split_type      ENUM
participant_config  jsonb — stores the split configuration
tax_amount_paise   integer
tip_amount_paise   integer
frequency       ENUM: DAILY | WEEKLY | BIWEEKLY | MONTHLY | YEARLY
next_run_date   date
end_date        date (nullable)
is_active       boolean
created_by      UUID
```

#### Behavior
- On `next_run_date`, a background job (cron) creates a new expense from the template
- If group membership changed since last run, expense is created with current members and flagged as `auto_generated`
- All members notified when a recurring expense is auto-added
- Owner can pause, edit, or delete a recurring template at any time
- Deleting a template does not delete past expenses it generated

---

### 4.4 Categories

- System-level defaults: `Food`, `Travel`, `Accommodation`, `Utilities`, `Entertainment`, `Other`
- Each group can add custom categories (name + color + emoji)
- Custom categories are scoped to the group — not visible in other groups
- Expenses can have one category or none
- Categories are used for filtering and export grouping

---

### 4.5 Settlement

#### Flow
1. **Payer** opens "You owe X" view → taps "Mark as Paid"
2. System creates a settlement record with `status = PENDING_CONFIRMATION`
3. **Receiver** gets an in-app + push notification: "X says they paid you ₹Y — confirm?"
4. Receiver taps "Confirm" → settlement `status = CONFIRMED`
5. Debt is cleared from the balance sheet
6. If receiver taps "Dispute" → settlement is rejected, payer notified, debt remains

#### Settlement Fields
```
id              UUID
group_id        UUID
payer_id        UUID
receiver_id     UUID
amount_paise    integer
payment_method  ENUM: CASH | UPI | RAZORPAY | STRIPE | OTHER
payment_ref     string (nullable) — transaction ID from external payment
status          ENUM: PENDING_CONFIRMATION | CONFIRMED | DISPUTED | CANCELLED
created_at      timestamp
confirmed_at    timestamp (nullable)
```

#### Balance Modes
- **Direct:** compute net between each pair: Σ(expenses where A paid for B) − Σ(settlements from B to A)
- **Simplified:** apply the minimum-cost-flow algorithm on the net matrix to reduce transaction count
- Both modes are read-time computations; underlying data is always the full direct ledger

#### Razorpay / Stripe Webhook Behavior

On receiving a successful payment webhook from Razorpay or Stripe, the system automatically advances the linked settlement status to `PENDING_CONFIRMATION` — **not** `CONFIRMED`. Two-party confirmation is still required before the debt is cleared.

- Webhook endpoints:
  - `POST /api/v1/webhooks/razorpay`
  - `POST /api/v1/webhooks/stripe`
- Both endpoints **must** verify the webhook signature before processing (Razorpay `X-Razorpay-Signature` header; Stripe `Stripe-Signature` header)
- Requests with invalid or missing signatures are rejected with `400 Bad Request` and logged
- Webhook handlers are idempotent — processing the same event ID twice is a no-op

---

### 4.6 Guest Users (No Account Required)

When adding a group member, the inviter can choose "Add as Guest":
- Enter guest's name and (optionally) email or phone
- System creates a `ghost_member` record linked to the group
- A unique, unguessable guest link is generated: `/guest/{token}`
- The guest link shows:
  - Their name and total balance in the group
  - Itemized list of what they owe and to whom
  - A "Mark as Settled" button (no authentication required)
  - Payment links (UPI / Razorpay) to settle
- Clicking "Mark as Settled" on the guest link creates a settlement `PENDING_CONFIRMATION` on the receiver side
- Guest links expire after the group is archived
- Guests can never see other members' balances or edit expenses

#### Ghost Member → Real Account Conversion

When a ghost member later registers with a matching email or phone number, the system must merge their `ghost_member` record into their new `users` record. This is a single atomic database transaction:

1. Identify all `expense_participants` rows where `user_id` references the `ghost_member.id`
2. Re-point all matched rows to the new `users.id`
3. Re-point all `settlements` rows (payer or receiver) referencing the `ghost_member.id`
4. Mark the `ghost_member` record as `merged` (soft-delete, retain for audit)
5. Invalidate the guest token immediately

If the merge transaction fails for any reason, the registration is rolled back and the user is prompted to contact support. No partial state is committed.

---

### 4.7 Payment Links

Generated in the settlement flow, per debt pair. All links open externally.

| Type | Format | When available |
|---|---|---|
| **UPI Deep Link** | `upi://pay?pa={vpa}&pn={name}&am={amount}&cu=INR&tn={note}` | Always (India) |
| **Razorpay Payment Link** | Created via Razorpay API; hosted page with card/UPI/netbanking | When Razorpay keys configured |
| **Stripe Payment Link** | Created via Stripe API; hosted checkout page | When Stripe keys configured |

- Payment links are generated lazily (on demand), not stored
- UPI deep links are generated client-side; Razorpay/Stripe links are created server-side via API
- Clicking a payment link does NOT auto-confirm a settlement — user must still do two-party confirmation

---

### 4.8 Receipts & OCR

- Users can upload a receipt image (JPEG, PNG, WebP, PDF — max 10 MB)
- Image stored in Supabase Storage under `receipts/{group_id}/{expense_id}`
- OCR via **Google Cloud Vision API** (or Tesseract fallback for cost control):
  - Extracts: total amount, tax amount, merchant name, date
  - Pre-fills the expense form — user reviews before saving
  - Raw OCR JSON stored in `ocr_data` column for debugging
- If OCR fails or confidence is low, fields are left blank and user fills manually

#### OCR Timeout & Image Pre-Processing

- Google Vision API call has a hard **10-second timeout**; on timeout or any error, the expense form is returned with blank pre-fill fields and a user-facing message: *"OCR unavailable — please fill in the amount manually"*
- Before storage and before sending to Vision API, receipt images are processed server-side:
  - Resized to a maximum of **2048 px** on the longest edge (aspect ratio preserved)
  - Converted to **WebP** format
  - The original uploaded file is discarded; only the processed WebP is stored
- Processing is performed in-memory using `sharp` — no temp files written to disk
- PDFs are passed to Vision API directly without pre-processing (10 MB limit still applies)

---

### 4.9 Dispute Resolution (Expense Editing)

**Case 1: Editing your own expense**
- Any member can edit an expense they created
- The edit is applied immediately
- All group members receive a notification: "Alice edited 'Team Lunch' — ₹1,200 → ₹1,350"

**Case 2: Editing another member's expense**
- Edit is submitted as a **proposal** (`status = PENDING_APPROVAL`)
- Original expense remains unchanged during voting
- All group members (except proposer) are notified to vote: Approve / Reject
- Voting rules:
  - Passes if **strictly more than 50%** of members (excluding proposer) approve
  - Rejected if majority votes No or voting window (48 hours) expires with no majority
  - Owner vote counts the same as any member — no veto
- On pass: expense updated, all members notified of the change + diff
- On rejection: proposal discarded, original expense unchanged, proposer notified

**Case 3: Deleting an expense**
- Follows the same approval flow as editing another member's expense
- If the deleter is the creator, deletion is immediate (no vote)

#### Concurrent Proposal Limit

Only **one active proposal** (`status = PENDING_APPROVAL`) is permitted per expense at a time. Attempting to submit a second proposal while one is active returns `409 Conflict`. The existing proposal must be cancelled, approved, or expired before a new one can be submitted.

#### Tied Vote Resolution

If the 48-hour voting window expires with an **exact tie** (equal Approve and Reject votes), the proposal is **rejected**. Ties always favour the status quo — the original expense is preserved unchanged and the proposer is notified.

---

### 4.10 Notifications

#### Channels
| Channel | Use |
|---|---|
| **In-app** | All events — persistent notification feed with bell icon |
| **Push (web)** | High-priority events: expense added, settlement pending confirmation, approval vote required |
| **WhatsApp / SMS** | Settlement reminders (opt-in only) — sent via WhatsApp Business API or Twilio SMS |

Note: Email notifications were not selected. Email is used only for auth (magic link, invite emails).

#### Notification Events
| Event | In-app | Push | WhatsApp/SMS |
|---|---|---|---|
| Expense added to group | ✓ | ✓ | — |
| Expense edited | ✓ | ✓ | — |
| Expense edit proposal (needs your vote) | ✓ | ✓ | ✓ |
| Settlement pending your confirmation | ✓ | ✓ | ✓ |
| Settlement confirmed | ✓ | ✓ | — |
| Settlement disputed | ✓ | ✓ | — |
| Recurring expense auto-added | ✓ | — | — |
| Group invite received | ✓ | ✓ | ✓ |
| Membership changed | ✓ | — | — |

- Users can configure notification preferences per-channel in their profile settings
- WhatsApp/SMS is opt-in only; enabled per user, not per group

---

### 4.11 Audit Log

Every mutation to an expense or settlement is logged. The log is visible to all group members.

#### Audit Entry Fields
```
id          UUID
group_id    UUID
actor_id    UUID (who performed the action)
entity_type ENUM: EXPENSE | SETTLEMENT | MEMBER | GROUP | CATEGORY | RECURRING
entity_id   UUID
action      ENUM: CREATED | UPDATED | DELETED | APPROVED | REJECTED | CONFIRMED | DISPUTED
old_value   jsonb (nullable) — full snapshot before change
new_value   jsonb (nullable) — full snapshot after change
diff        jsonb (nullable) — computed field diff for UPDATED actions
ip_address  inet (for auth events)
created_at  timestamp
```

- Audit log entries are **immutable** — no update or delete operations
- Old/new value snapshots store the full entity at the time of change
- UI shows a human-readable diff: "Amount changed from ₹1,200 to ₹1,350 by Alice"
- Audit log is paginated (20 entries per page), filterable by entity type and actor

---

### 4.12 Dashboard

The home screen after login shows:

**Header summary:**
- Net balance across all active groups: "You are owed ₹3,400" or "You owe ₹1,200"
- If balanced: "You're all settled up"

**Groups list:**
- Card per group showing: group name, member count, your net balance in that group, last activity date
- Visual indicator: green (owed money), red (owe money), grey (settled)
- Sorted by last activity (most recent first)

**Pending actions banner (if any):**
- Count of unsettled debts awaiting your confirmation
- Count of pending expense edit votes

**Quick actions:**
- Create new group
- Add expense (jumps to group selector)

---

### 4.13 Export

Available per group by any member.

| Format | Contents |
|---|---|
| **PDF** | Group name, currency, date range, member list, expense table (date, title, category, payer, amount, split type), settlement summary, net balances |
| **CSV** | One row per expense: all fields including individual participant share amounts |

- Exports are generated server-side and streamed as file downloads
- No data retention for exports — generated on demand each time
- Date range filter available before export

---

### 4.14 Search & Filters

Within a group, expenses can be filtered by:
- Date range
- Category
- Paid by (member)
- Involves (member owes in this expense)
- Amount range
- Keyword (title/notes search)

---

## 5. Data Models (Schema Summary)

```sql
-- Core tables (paise for all money columns)

users               (id, email, phone, display_name, avatar_url, locale, currency, created_at)
groups              (id, name, description, currency, color, icon, balance_mode, owner_id, status, created_at)
group_members       (id, group_id, user_id, role, joined_at)
ghost_members       (id, group_id, display_name, email, phone, guest_token, created_at)
categories          (id, group_id, name, color, emoji, is_system, created_at)
expenses            (id, group_id, title, category_id, base_amount, tax_amount, tip_amount,
                     total_amount, split_type, tax_split_type, tip_split_type,
                     receipt_url, ocr_data, notes, date, status, recurring_id,
                     created_by, created_at, updated_at)
expense_payers      (id, expense_id, user_id, amount_paise)  -- who paid
expense_participants (id, expense_id, user_id, amount_paise) -- who owes
expense_proposals   (id, expense_id, proposed_by, proposed_changes jsonb, status, expires_at, created_at)
proposal_votes      (id, proposal_id, voter_id, vote ENUM(APPROVE,REJECT), created_at)
recurring_templates (id, group_id, title, category_id, amount_paise, split_type,
                     participant_config jsonb, tax_amount_paise, tip_amount_paise,
                     frequency, next_run_date, end_date, is_active, created_by)
settlements         (id, group_id, payer_id, receiver_id, amount_paise,
                     payment_method, payment_ref, status, created_at, confirmed_at)
audit_logs          (id, group_id, actor_id, entity_type, entity_id, action,
                     old_value jsonb, new_value jsonb, diff jsonb, ip_address, created_at)
notifications       (id, user_id, type, title, body, entity_type, entity_id,
                     is_read, created_at)
notification_prefs  (id, user_id, event_type, in_app, push, whatsapp_sms)
push_subscriptions  (id, user_id, endpoint, keys jsonb, created_at)
refresh_tokens      (id, user_id, token_hash, expires_at, revoked_at)
```

### 5.1 Database Index Strategy

Required PostgreSQL indexes for query performance:

```sql
-- Expense queries (group feed, paginated)
CREATE INDEX idx_expenses_group_date      ON expenses(group_id, date DESC);

-- Balance computation joins
CREATE INDEX idx_expense_participants_user ON expense_participants(user_id);
CREATE INDEX idx_expense_payers_user       ON expense_payers(user_id);

-- Settlement lookups
CREATE INDEX idx_settlements_pair_status   ON settlements(payer_id, receiver_id, status);
CREATE INDEX idx_settlements_group_status  ON settlements(group_id, status);

-- Audit log feed
CREATE INDEX idx_audit_logs_group_time     ON audit_logs(group_id, created_at DESC);

-- Notification inbox
CREATE INDEX idx_notifications_user_read   ON notifications(user_id, is_read);

-- Full-text expense search (keyword filter in §4.14)
CREATE INDEX idx_expenses_fts ON expenses USING GIN (
  to_tsvector('english', coalesce(title, '') || ' ' || coalesce(notes, ''))
);
```

All foreign key columns are indexed by default via Prisma's implicit FK index generation. The composite indexes above are additive.

---

## 6. API Design

All endpoints under `/api/v1/`. All responses JSON. Auth via `Authorization: Bearer <access_token>` header.

### 6.0 Standard Error Response Format

Every API error response — regardless of status code — must conform to:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable description of the error",
    "details": [
      { "path": ["amount"], "message": "Amount must be a positive integer" }
    ]
  },
  "requestId": "req_abc123xyz"
}
```

- `code` — machine-readable string constant (e.g. `VALIDATION_ERROR`, `NOT_FOUND`, `UNAUTHORIZED`, `FORBIDDEN`, `CONFLICT`, `INTERNAL_ERROR`)
- `message` — safe-to-display human message; never exposes stack traces or internal state
- `details` — present only on `422 Unprocessable Entity`; array of Zod `ZodIssue` objects identifying which fields failed validation
- `requestId` — UUID generated per request, injected by middleware, included in server logs for tracing

### Auth
```
POST   /auth/register
POST   /auth/login
POST   /auth/logout
POST   /auth/refresh
POST   /auth/magic-link/send
POST   /auth/magic-link/verify
POST   /auth/otp/send
POST   /auth/otp/verify
GET    /auth/google          (OAuth redirect)
GET    /auth/google/callback
```

### Users
```
GET    /users/me
PATCH  /users/me
DELETE /users/me
GET    /users/me/notifications
PATCH  /users/me/notifications/:id   (mark read)
PATCH  /users/me/notification-prefs
POST   /users/me/push-subscription
```

### Groups
```
GET    /groups                       (all groups for current user)
GET    /groups/archived              (read-only list of current user's archived groups)
POST   /groups
GET    /groups/:id
PATCH  /groups/:id
DELETE /groups/:id                   (archives the group — sets status = ARCHIVED)
GET    /groups/:id/members
POST   /groups/:id/invite
DELETE /groups/:id/members/:userId
POST   /groups/:id/invite-link       (generate shareable link)
GET    /groups/:id/balances          (computed, includes mode param)
GET    /groups/:id/audit-log
GET    /groups/:id/export/pdf
GET    /groups/:id/export/csv
```

### Expenses
```
GET    /groups/:id/expenses          (paginated, filterable)
POST   /groups/:id/expenses
GET    /groups/:id/expenses/:expId
PATCH  /groups/:id/expenses/:expId
DELETE /groups/:id/expenses/:expId
POST   /groups/:id/expenses/:expId/receipt   (upload)
```

### Expense Proposals
```
POST   /groups/:id/expenses/:expId/proposals
GET    /groups/:id/expenses/:expId/proposals/:propId
POST   /groups/:id/expenses/:expId/proposals/:propId/vote
DELETE /groups/:id/expenses/:expId/proposals/:propId   (cancel own proposal)
```

### Settlements
```
GET    /groups/:id/settlements
POST   /groups/:id/settlements
PATCH  /groups/:id/settlements/:sId   (confirm / dispute)
GET    /groups/:id/settlements/:sId/payment-link/:type  (upi|razorpay|stripe)
```

### Recurring
```
GET    /groups/:id/recurring
POST   /groups/:id/recurring
PATCH  /groups/:id/recurring/:rId
DELETE /groups/:id/recurring/:rId
```

### Categories
```
GET    /groups/:id/categories
POST   /groups/:id/categories
PATCH  /groups/:id/categories/:cId
DELETE /groups/:id/categories/:cId
```

### Guest
```
GET    /guest/:token                 (public — no auth)
POST   /guest/:token/settle          (public — create settlement from guest side)
```

---

## 7. Technical Architecture

### Frontend (Phase 1)
- **Framework:** Next.js 14 (App Router, TypeScript strict)
- **Styling:** Tailwind CSS, mobile-first
- **State:** React Server Components where possible; Zustand for client state
- **Forms:** React Hook Form + Zod validation
- **Data fetching:** SWR for client-side, RSC for initial loads
- **PWA:** `next-pwa` — service worker, manifest, offline shell, installable on mobile

### Backend
- **API routes:** Next.js Route Handlers (`/app/api/`)
- **ORM:** Prisma with PostgreSQL (Supabase)
- **Auth:** NextAuth.js (Google, Credentials, Email providers)
- **File storage:** Supabase Storage (receipt images)
- **Background jobs:** Vercel Cron Jobs — call internal authenticated Route Handlers at `POST /api/v1/internal/cron/recurring-expenses` and `POST /api/v1/internal/cron/expire-proposals`. Both routes are protected by a `CRON_SECRET` header (env var, never committed). This keeps all business logic in Node.js `/server/` as required by §13.
- **OCR:** Google Cloud Vision API (server-side, never client-side)
- **Push:** Web Push (VAPID keys) via `web-push` library
- **SMS/WhatsApp:** Twilio (SMS) + WhatsApp Business API (or Twilio WhatsApp sandbox)
- **Payment links:** UPI — client-side string construction; Razorpay/Stripe — server-side API

### Infrastructure
- **Database:** Supabase PostgreSQL (RLS policies mirror API-level auth checks)
- **Hosting:** Vercel (Next.js)
- **Storage:** Supabase Storage
- **Secrets:** Vercel environment variables (never committed)

---

## 8. Security Requirements

| Rule | Implementation |
|---|---|
| All money as integers | Paise (₹1 = 100 paise). No float arithmetic. Use integer division + remainder. |
| Input validation | Zod schema on every API route — both body and query params |
| Parameterized queries | Prisma ORM only — no raw SQL string interpolation |
| Rate limiting | All auth endpoints: 5 req/min per IP. Upstash Redis sliding window. |
| CORS | Whitelist only — `NEXTAUTH_URL` and production domain. Never `*`. |
| Secrets | Environment variables only. `printenv` not logged. |
| Sensitive data in logs | Never log passwords, tokens, card info, OTPs |
| Multi-tenancy isolation | Users can only see/edit groups they are members of. Enforced at DB query level, not just UI. |
| Guest token entropy | 32-byte cryptographically random token (crypto.randomBytes) |
| Receipt URLs | Signed, time-limited Supabase Storage URLs (never public bucket URLs) |
| Refresh token storage | Hashed in DB (SHA-256). Plain token only in httpOnly cookie. |

---

## 9. Non-Functional Requirements

| Property | Target |
|---|---|
| Group size | Up to 50 members |
| Expense list | Paginated at 25/page; cursor-based pagination |
| API response time | p95 < 300ms for read endpoints |
| Availability | 99.5% uptime (Vercel + Supabase SLA) |
| Accessibility | WCAG 2.1 AA — aria labels, keyboard navigation, contrast ≥ 4.5:1 |
| TypeScript | Strict mode, no `any` types |
| Test coverage | Jest unit tests for every utility function and API handler |
| File size limit | Max 10 MB per receipt upload |
| Audit log retention | Forever (immutable, no TTL) |

---

## 10. Rounding & Precision Rules

1. All monetary values stored and computed in paise (integer)
2. When splitting ₹X equally among N people: each person pays `floor(X / N)` paise; the remainder `X mod N` paise is added to the first participant's share (deterministic, avoids ₹0.01 discrepancies)
3. Percentage splits: each person pays `floor(total × pct / 100)` paise; remainders distributed one-paise-at-a-time to participants in order until reconciled
4. Server always validates: `sum(participant_splits.amount) === expense.total_amount` — rejects with 422 if not
5. Display format: divide by 100, format with `Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })`

---

## 11. Localization

**Phase 1 — India:**
- Default currency: INR (₹)
- Default locale: `en-IN`
- Payment: UPI deep-links as primary method
- Phone format: E.164, default `+91` prefix

**Phase 2 — Global (v2):**
- Currency selected per user at onboarding
- Single currency per group (set at group creation)
- No live FX rates — currency is informational only, no cross-currency conversion
- `Intl.NumberFormat` used throughout — adding a currency is a config change, not a code change

---

## 12. PWA Specification

- `manifest.json`: name, short_name, icons (192×192, 512×512), theme_color, background_color, display: standalone
- Service worker (via `next-pwa`):
  - Cache strategy: StaleWhileRevalidate for API reads, CacheFirst for static assets
  - Offline shell: show cached group list; disable add/edit actions with "You're offline" banner
- Add-to-homescreen prompt: shown after 2nd visit to the dashboard
- Push notification subscription managed via Web Push API (VAPID)

---

## 13. Phase 2 — React Native (Out of Scope for v1)

The following are explicitly **not** in v1 but the architecture must not block them:
- React Native + Expo mobile app
- Native push notifications (APNs, FCM)
- Offline-first with local SQLite + sync
- Biometric auth (Face ID / fingerprint)
- Native share sheet integration
- App Store / Play Store distribution

**Architecture constraint for v1:** All business logic must live in `/server/` (pure TypeScript functions, no Next.js dependencies) so it can be called from both Route Handlers and a future REST/GraphQL layer serving the mobile app.

---

## 14. Out of Scope (v1)

- In-app payments (money moving through the platform)
- Multi-currency within a single group
- AI expense categorization
- Receipt line-item splitting (OCR extracts total only, not itemized rows)
- Social features (friends list, feed, emojis on expenses)
- Webhooks / API keys for third-party integrations
- Sub-groups or nested groups
- Expense approval before adding (not just editing)
- Budget tracking / spending analytics
- Admin dashboard / ops tooling
