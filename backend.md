# Backend Documentation

This document describes the backend API for the Business Management Backend.
It covers environment variables, authentication, error/response formats, and detailed route documentation with example responses.

# Backend baseUrl

baseUrl = "https://script-backend-ojlh.onrender.com"

## Project overview

- Node.js + Express REST API.
- Routes mounted in `src/app.js` under `/api`:
  - `/api/auth`
  - `/api/users`
  - `/api/clients`
  - `/api/invoices`
  - `/api/inventory`
  - `/api/payments`
  - `/api/analytics`

## Environment variables (high-level)

The repository includes a `.env` (example provided). Important keys used by the app:

- SERVER

  - NODE_ENV (development|production)
  - PORT (e.g. 5000)
  - API_VERSION (e.g. v1)

- DATABASE

  - MONGODB_URI

- JWT

  - JWT_SECRET
  - JWT_EXPIRES_IN
  - JWT_REFRESH_SECRET
  - JWT_REFRESH_EXPIRES_IN

- FLUTTERWAVE (payment)

  - FLUTTERWAVE_PUBLIC_KEY
  - FLUTTERWAVE_SECRET_KEY
  - FLUTTERWAVE_ENCRYPTION_KEY
  - FLUTTERWAVE_WEBHOOK_HASH
  - FLUTTERWAVE_BASE_URL

- EMAIL

  - EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASSWORD, EMAIL_FROM

- RATE LIMITING

  - RATE_LIMIT_WINDOW_MS
  - RATE_LIMIT_MAX_REQUESTS
  - RATE_LIMIT_AUTH_WINDOW_MS
  - RATE_LIMIT_AUTH_MAX_REQUESTS

- OTHER
  - BCRYPT_SALT_ROUNDS, MAX_FILE_SIZE, ALLOWED_FILE_TYPES
  - INVOICE_PREFIX, CURRENCY, TAX_RATE, etc.

Refer to `.env` in repository root for the complete list.

## Authentication & security

- JWT-based authentication. Tokens expected in `Authorization: Bearer <token>` header.
- Protected routes use an `authenticate` middleware.
- Some admin-only routes use `requireAdmin` middleware (e.g., user management).
- Rate limiters are applied per-route groups (authLimiter, paymentLimiter, invoiceLimiter, analyticsLimiter, generalLimiter).
- Helmet and CORS middleware are enabled in `src/app.js`.

## Error & success response formats

Most controllers return a JSON object in the following shape:

Success (generic):
{
"success": true,
"message": "A short message",
"data": { ... }
}

Error (generic):
{
"success": false,
"message": "Error message",
"error": "Detailed error message or empty"
}

Pagination response (lists):
{
"success": true,
"data": {
"items": [ ... ],
"pagination": {
"page": 1,
"limit": 10,
"total": 100,
"pages": 10
}
}
}

Validation errors typically return HTTP 400 with `success: false` and `message` describing the issue.

## Routes documentation

Notes:

- All routes below are prefixed by `/api` in `src/app.js`.
- When `authenticate` is listed under middleware the endpoint requires a valid JWT.
- `validatePagination`, `validateDateRange`, `validateObjectId` and `sanitizeInput` are used for request validation/sanitization.

---

### Auth: `/api/auth`

Public routes:

- POST /api/auth/register

  - Middleware: authLimiter
  - Description: Register a new user.
  - Body (typical):
    {
    "name": "Full Name",
    "email": "user@example.com",
    "password": "password123",
    "businessInfo": { ... }
    }
  - Success response (201):
    {
    "success": true,
    "message": "User registered successfully",
    "data": { "user": { /_ user object without password _/ }, "token": "<jwt>" }
    }
  - Errors: 400 validation errors, 409 if email exists.

- POST /api/auth/login

  - Middleware: authLimiter
  - Description: Login user with email/password.
  - Body:
    { "email": "user@example.com", "password": "password" }
  - Success response (200):
    {
    "success": true,
    "message": "Login successful",
    "data": { "user": { /_ user _/ }, "token": "<jwt>", "refreshToken": "<token>" }
    }

- POST /api/auth/refresh

  - Description: Exchange refresh token for a new access token.
  - Body: { "refreshToken": "<token>" }
  - Success: 200 with new tokens.

- POST /api/auth/forgot-password

  - Middleware: authLimiter
  - Description: Request password reset email (token generation)
  - Body: { "email": "user@example.com" }
  - Success: 200 with message describing email sent.

- POST /api/auth/reset-password

  - Middleware: authLimiter
  - Description: Reset password with a reset token
  - Body: { "token": "<token>", "password": "newpass" }

- POST /api/auth/verify-email
  - Middleware: none
  - Description: Verify user's email via token
  - Body: { "token": "<token>" }

Protected routes (require authenticate):

- POST /api/auth/logout

  - Middleware: authenticate
  - Description: Logout the user (invalidate tokens or server-side cleanup)
  - Success: 200 { success: true, message: "Logged out" }

- GET /api/auth/me

  - Middleware: authenticate
  - Description: Get current user profile
  - Success: 200 { success: true, data: { user } }

- PUT /api/auth/profile

  - Middleware: authenticate
  - Description: Update profile fields
  - Body: partial fields to update

- PUT /api/auth/change-password
  - Middleware: authenticate
  - Body: { "oldPassword": "..", "newPassword": ".." }

---

### Users: `/api/users`

These routes are defined in `src/routes/userRoutes.js`.

- GET /api/users

  - Middleware: authenticate, requireAdmin, validatePagination
  - Description: Admin-only: list users with pagination
  - Query: page, limit, status, role, plan, search
  - Success: 200 { success: true, data: { users: [...], pagination: { page, limit, total, pages } } }

- GET /api/users/stats

  - Middleware: authenticate, requireAdmin
  - Description: Admin-only user statistics
  - Success: 200 with stats object

- PUT /api/users/:id/plan

  - Middleware: authenticate, requireAdmin, validateObjectId("id")
  - Body: { "plan": "pro", ... }
  - Description: Update subscription for a user

- DELETE /api/users/:id

  - Middleware: authenticate, requireAdmin, validateObjectId("id")
  - Description: Soft-delete user (set inactive)

- GET /api/users/:id

  - Middleware: authenticate, validateObjectId("id")
  - Description: Get profile by id (user or admin)

- PUT /api/users/:id
  - Middleware: authenticate, validateObjectId("id")
  - Description: Update user fields (name, phone, businessInfo, settings). Admins may update role/status/isAdmin.

Common responses: success boolean, message and `data.user` or `data.users`.

---

### Clients: `/api/clients`

Defined in `src/routes/clientRoutes.js`.

- GET /api/clients/search

  - Middleware: authenticate
  - Description: Search clients by name/email/phone
  - Query: q (search string), page, limit

- GET /api/clients/active

  - Middleware: authenticate
  - Description: Return active clients only

- POST /api/clients

  - Middleware: authenticate, sanitizeInput
  - Body: client fields (name, email, phone, address, type, notes)
  - Success (201): { success: true, message: "Client created successfully", data: { client } }

- GET /api/clients

  - Middleware: authenticate, validatePagination
  - Query: page, limit, status, clientType, city, search, sortBy, sortOrder
  - Success: paginated client list

- GET /api/clients/:id

  - Middleware: authenticate, validateObjectId("id")
  - Success: 200 { success: true, data: { client } }

- PUT /api/clients/:id

  - Middleware: authenticate, validateObjectId("id"), sanitizeInput
  - Description: Update client

- DELETE /api/clients/:id

  - Middleware: authenticate, validateObjectId("id")
  - Description: Delete client (likely soft or hard depending on implementation)

- GET /api/clients/:id/stats
  - Middleware: authenticate, validateObjectId("id")
  - Description: Per-client statistics (invoices, payments, outstanding)

Example error: 404 if client not found: { success: false, message: "Client not found" }

---

### Invoices: `/api/invoices`

Defined in `src/routes/invoiceRoutes.js`.

- GET /api/invoices/overdue

  - Middleware: authenticate
  - Description: List overdue invoices

- GET /api/invoices/stats

  - Middleware: authenticate, validateDateRange
  - Description: Invoice statistics for date range

- POST /api/invoices

  - Middleware: authenticate, invoiceLimiter, sanitizeInput
  - Body: {
    client: "<clientId>",
    items: [{ inventoryItemId?, description, quantity, unitPrice, tax?, discount? }],
    taxRate, discount, discountType, shippingFee, dueDate, notes, termsAndConditions
    }
  - Success (201): { success: true, message: "Invoice created successfully", data: { invoice } }

- GET /api/invoices

  - Middleware: authenticate, validatePagination, validateDateRange
  - Query: page, limit, status, client, startDate, endDate, minAmount, maxAmount, search, sortBy, sortOrder
  - Success: paginated list of invoices including totals

- GET /api/invoices/:id

  - Middleware: authenticate, validateObjectId("id")
  - Success: { success: true, data: { invoice } } (invoice with items and client populated)

- PUT /api/invoices/:id

  - Middleware: authenticate, validateObjectId("id"), sanitizeInput
  - Description: Update invoice and items

- DELETE /api/invoices/:id

  - Middleware: authenticate, validateObjectId("id")

- POST /api/invoices/:id/send
  - Middleware: authenticate, validateObjectId("id")
  - Description: Mark invoice as sent and (optionally) trigger email

Common invoice success responses include `invoiceNumber`, `subtotal`, `total`, `amountPaid`, `amountDue`, and populated `items` and `client` objects.

---

### Inventory: `/api/inventory`

Defined in `src/routes/inventoryRoutes.js`.

- GET /api/inventory/search

  - Middleware: authenticate
  - Description: Search inventory items

- GET /api/inventory/low-stock

  - Middleware: authenticate
  - Description: Return items at or below reorder point

- GET /api/inventory/reorder

  - Middleware: authenticate
  - Description: Items that need reordering

- GET /api/inventory/categories

  - Middleware: authenticate
  - Description: List categories

- GET /api/inventory/stats

  - Middleware: authenticate
  - Description: Inventory stats (total items, inventory value, low stock count)

- POST /api/inventory

  - Middleware: authenticate, sanitizeInput
  - Body: {
    name, sku, description, category, quantity, costPrice, sellPrice, trackInventory (boolean), reorderPoint, user: (auto from req)
    }
  - Success (201): { success: true, message: "Inventory item created successfully", data: { item } }

- GET /api/inventory

  - Middleware: authenticate, validatePagination
  - Query: page, limit, category, status, lowStock, search, sortBy, sortOrder

- GET /api/inventory/:id

  - Middleware: authenticate, validateObjectId("id")

- PUT /api/inventory/:id

  - Middleware: authenticate, validateObjectId("id"), sanitizeInput

- DELETE /api/inventory/:id

  - Middleware: authenticate, validateObjectId("id")

- POST /api/inventory/:id/stock/add

  - Middleware: authenticate, validateObjectId("id")
  - Body: { quantity: number, note?: string }
  - Description: Add stock; returns updated item and stock movement record if implemented.

- POST /api/inventory/:id/stock/reduce

  - Middleware: authenticate, validateObjectId("id")
  - Body: { quantity: number, reason?: string }

- POST /api/inventory/:id/stock/adjust
  - Middleware: authenticate, validateObjectId("id")
  - Description: Manual stock correction

Inventory sample success (single item):
{
"success": true,
"message": "Inventory item created successfully",
"data": { "item": { "\_id": "...", "name": "..., "quantity": 10, "reorderPoint": 5 } }
}

---

### Payments: `/api/payments`

Defined in `src/routes/paymentRoutes.js`.

- POST /api/payments/flutterwave/initialize

  - Middleware: authenticate, paymentLimiter
  - Body: { invoice: "<id>", amount, email, phone, name }
  - Description: Initialize a Flutterwave payment flow and return payment link / data.
  - Success: 200 { success: true, data: { paymentLink or flutterwave response } }

- POST /api/payments/flutterwave/verify

  - Middleware: authenticate
  - Body: { transactionRef or flutterwave payload }
  - Description: Verify payment after user completes payment at Flutterwave.

- GET /api/payments/stats

  - Middleware: authenticate, validateDateRange
  - Description: Payment statistics (revenue, transactions)

- POST /api/payments

  - Middleware: authenticate, paymentLimiter, sanitizeInput
  - Body: {
    invoice (optional), client, amount, method (cash|card|bank|cheque|mobile_money),
    bankDetails?, chequeDetails?, cardDetails?, mobileMoneyDetails?, notes?
    }
  - Behavior: Creates a Payment document, sets `status: pending`. If method is cash, it may auto-complete.
  - Success (201): { success: true, message: "Payment created successfully", data: { payment } }

- GET /api/payments

  - Middleware: authenticate, validatePagination, validateDateRange
  - Query: page, limit, startDate, endDate, status, client, invoice, search
  - Success: paginated payments list

- GET /api/payments/:id

  - Middleware: authenticate, validateObjectId("id")

- PUT /api/payments/:id/status

  - Middleware: authenticate, validateObjectId("id")
  - Body: { status: "completed" | "failed" | "refunded" }
  - Description: Update payment record and reconcile invoice amounts if linked.

- POST /api/payments/:id/refund
  - Middleware: authenticate, validateObjectId("id")
  - Description: Trigger refund flow (may call payment gateway)

Payment sample success (create):
{
"success": true,
"message": "Payment created successfully",
"data": { "payment": { "\_id": "...", "amount": 5000, "status": "pending", "transactionRef": "TRX-..." } }
}

---

### Analytics: `/api/analytics`

Defined in `src/routes/analyticsRoutes.js`.

All analytics routes require authentication and are rate-limited by `analyticsLimiter`. Some endpoints accept date ranges.

- GET /api/analytics/dashboard

  - Middleware: authenticate, analyticsLimiter, validateDateRange
  - Description: Dashboard overview for user, includes revenue, invoice stats, clients, inventory value, top clients, overdue counts.
  - Query: startDate, endDate
  - Success: 200 { success: true, data: { revenueStats, invoiceStats, clientCounts, inventoryValue, lowStock, overdueInvoices, topClients } }

- GET /api/analytics/revenue

  - Middleware: authenticate, analyticsLimiter, validateDateRange
  - Description: Detailed revenue analytics (time series, averages, transactions)

- GET /api/analytics/clients

  - Middleware: authenticate, analyticsLimiter
  - Description: Client analytics (new clients, top clients, client activity)

- GET /api/analytics/invoices

  - Middleware: authenticate, analyticsLimiter, validateDateRange
  - Description: Invoice analytics (by status, aging buckets, totals)

- GET /api/analytics/inventory
  - Middleware: authenticate, analyticsLimiter
  - Description: Inventory analytics (value, low stock trends, turnover)

Example dashboard response shape (trimmed):
{
"success": true,
"data": {
"revenueStats": { "totalRevenue": 45000, "totalTransactions": 25, "averageTransaction": 1800 },
"invoiceStats": { "totalInvoices": 40, "totalAmount": 75000, "totalPaid": 45000, "totalDue": 30000 },
"clientCounts": { "totalClients": 120, "newClients": 4 },
"inventoryValue": 35000,
"lowStockCount": 5,
"overdueInvoices": 3,
"topClients": [ { "clientId":"...", "revenue": 15000 }, ... ]
}
}

---

## Models (high-level)

The app uses Mongoose models located in `src/models`.
Important models include:

- User
- Client
- Inventory
- Invoice (+ InvoiceItem)
- Payment

Each model typically includes `user` reference (owner), timestamps, and fields relevant to the entity (e.g., invoice stores subtotal, total, amountPaid, items array).

## Validation middleware

`src/middlewares/validationMiddleware.js` provides helpers used across routes:

- `validateObjectId(paramName)` — ensures :id is valid Mongo ObjectId
- `validatePagination` — ensures page/limit defaults and types
- `validateDateRange` — normalizes startDate/endDate queries
- `sanitizeInput` — strips unwanted fields from body

## Rate limiting

Rate limiters are configured in `src/config/rateLimiter.js` and used per-area:

- `generalLimiter` — applied globally
- `authLimiter`, `paymentLimiter`, `invoiceLimiter`, `analyticsLimiter` — used per-route

## How to run (local)

1. Copy `.env.example` to `.env` and fill in values.
2. Install dependencies:

```powershell
npm install
```

3. Start server:

```powershell
npm start
```

4. For development with auto-reload (if configured):

```powershell
npm run dev
```

## Notes and next steps

- The controllers return consistent `success/message/data` JSON payloads. Use those shapes when writing clients or tests.
- The `auth` endpoints implement registration/login/refresh/logout flows; tokens must be used on protected routes.
- For payment flows using Flutterwave, follow Flutterwave's API docs and use the `FLUTTERWAVE_*` env vars.

If you'd like, I can:

- Add example cURL/Postman collection or OpenAPI (Swagger) spec generated from these routes.
- Generate example request/response JSON files for tests.

---

Generated by scanning `src/routes/*.js` and controller patterns in the repository.

## Frontend-ready API Reference (request & response examples)

This section gives concrete examples a frontend developer can rely on: HTTP method, URL, required headers, query parameters, example request body, example success response and common error responses.

General headers (for protected routes):

- Authorization: Bearer <access_token>
- Content-Type: application/json

Note: replace `<id>` with the resource id (Mongo ObjectId), `<token>` with actual tokens.

---

### Authentication

- POST /api/auth/register

  - Description: Create a new user account with minimal required fields (business name, email, phone, password)
  - Body example:
    {
    "businessName": "Jane Co",
    "email": "jane@example.com",
    "phone": "+2348012345678",
    "password": "SecureP@ss123"
    }
  - Success (201):
    {
    "success": true,
    "message": "User registered successfully",
    "data": {
    "user": { "\_id": "...", "businessName": "Jane Co", "email": "jane@example.com", "phone": "+2348012345678" },
    "tokens": { "token": "<access_token>", "refreshToken": "<refresh_token>" }
    }
    }
  - Errors: 400 validation error, 409 if email exists.

- POST /api/auth/login

  - Body example: { "email": "jane@example.com", "password": "P@ssw0rd" }
  - Success (200):
    {
    "success": true,
    "message": "Login successful",
    "data": {
    "user": { "\_id": "...", "name": "Jane Doe", "email": "jane@example.com" },
    "token": "<access_token>",
    "refreshToken": "<refresh_token>"
    }
    }

- POST /api/auth/refresh

  - Body: { "refreshToken": "<refresh_token>" }
  - Success (200): { "success": true, "data": { "token": "<access_token>", "refreshToken": "<refresh_token>" } }

- GET /api/auth/me

  - Headers: Authorization
  - Success (200): { "success": true, "data": { "user": { "\_id": "..", "businessName": "..", "email": ".." } } }

- PUT /api/auth/profile
  - Update fields example: { "businessName": "Jane's Company", "phone": "+234...", "businessInfo": { "industry": "retail" } }
  - Success (200): updated user in data.user

---

### Users (admin & profile)

- GET /api/users

  - Admin-only
  - Query: page, limit, status, role, plan, search
  - Success (200):
    {
    "success": true,
    "data": {
    "users": [ { "\_id": "...", "businessName": "...", "email": "..." } ],
    "pagination": { "page": 1, "limit": 10, "total": 100, "pages": 10 }
    }
    }

- GET /api/users/:id

  - Success (200): { "success": true, "data": { "user": { /_ user object without password _/ } } }

- PUT /api/users/:id

  - Body: partial user fields
  - Success (200): updated user

- DELETE /api/users/:id
  - Admin-only; soft delete
  - Success (200): { "success": true, "message": "User deleted" }

---

### Clients

- POST /api/clients

  - Body example:
    {
    "name": "Acme Ltd",
    "email": "acct@acme.com",
    "phone": "+2348012345678",
    "address": "Lagos, Nigeria",
    "type": "company",
    "notes": "Important client"
    }
  - Success (201): { "success": true, "message": "Client created successfully", "data": { "client": { "\_id": "..." } } }

- GET /api/clients

  - Query: page, limit, status, clientType, city, search
  - Success: paginated list of clients (see Users for pagination format)

- GET /api/clients/:id

  - Success (200): { "success": true, "data": { "client": { /_ client fields _/ } } }

- PUT /api/clients/:id

  - Body: partial client fields to update
  - Success: updated client

- DELETE /api/clients/:id

  - Success: { "success": true, "message": "Client deleted" }

- GET /api/clients/search?q=Acme
  - Returns list matching query

---

### Invoices

- POST /api/invoices

  - Body example:
    {
    "client": "<clientId>",
    "items": [ { "description": "Service A", "quantity": 2, "unitPrice": 5000 } ],
    "taxRate": 7.5,
    "discount": 0,
    "shippingFee": 0,
    "dueDate": "2025-12-01",
    "notes": "Thanks for your business"
    }
  - Success (201):
    {
    "success": true,
    "message": "Invoice created successfully",
    "data": { "invoice": { "\_id": "..", "invoiceNumber": "INV1001", "subtotal": 10000, "total": 10750 } }
    }

- GET /api/invoices

  - Query: page, limit, status, client, startDate, endDate, minAmount, maxAmount, search
  - Success: paginated invoices with totals and status

- GET /api/invoices/:id

  - Success: invoice with populated items and client

- PUT /api/invoices/:id

  - Update invoice fields and items

- DELETE /api/invoices/:id

  - Success: { "success": true, "message": "Invoice deleted" }

- POST /api/invoices/:id/send

  - Marks as sent; may trigger email
  - Success: 200 with updated invoice

- GET /api/invoices/overdue
  - Returns overdue invoices

---

### Inventory

- POST /api/inventory

  - Body example:
    {
    "name": "Widget A",
    "sku": "WIDGET-A-001",
    "description": "A useful widget",
    "category": "Widgets",
    "quantity": 50,
    "costPrice": 1000,
    "sellPrice": 1500,
    "trackInventory": true,
    "reorderPoint": 10
    }
  - Success (201): created item in data.item

- GET /api/inventory

  - Query: page, limit, category, status, lowStock, search, sortBy, sortOrder
  - Success: paginated items

- GET /api/inventory/:id

  - Success: single item

- PUT /api/inventory/:id

  - Update item

- DELETE /api/inventory/:id

- POST /api/inventory/:id/stock/add

  - Body: { "quantity": 10, "note": "Restock" }
  - Success: updated item quantity and stock movement in response if implemented

- POST /api/inventory/:id/stock/reduce

  - Body: { "quantity": 5, "reason": "Sold" }

- GET /api/inventory/low-stock
  - Returns items for which quantity <= reorderPoint

---

### Payments

- POST /api/payments

  - Create a payment (cash/bank/card/mobile)
  - Body example:
    {
    "invoice": "<invoiceId>",
    "client": "<clientId>",
    "amount": 10750,
    "method": "cash",
    "notes": "Payment received at POS"
    }
  - Success (201): created payment object, may auto-complete cash payments

- POST /api/payments/flutterwave/initialize

  - Body: { "invoice": "<id>", "amount": 10750, "email": "client@example.com", "phone": "+234...", "name": "Client" }
  - Success: data contains Flutterwave initialization response (link or payload)

- POST /api/payments/flutterwave/verify

  - Verify payment with gateway

- GET /api/payments

  - Query: page, limit, startDate, endDate, status, client, invoice
  - Success: paginated payments

- GET /api/payments/:id

- PUT /api/payments/:id/status

  - Body: { "status": "completed" }
  - Success: updated payment and reconciled invoice

- POST /api/payments/:id/refund
  - Trigger refund; gateway interaction

---

### Analytics

- GET /api/analytics/dashboard
  - Query: startDate, endDate
  - Success (200):
    {
    "success": true,
    "data": {
    "revenueStats": { "totalRevenue": 45000, "totalTransactions": 25, "averageTransaction": 1800 },
    "invoiceStats": { "totalInvoices": 40, "totalAmount": 75000, "totalPaid": 45000, "totalDue": 30000 },
    "clientCounts": { "totalClients": 120, "newClients": 4 },
    "inventoryValue": 35000,
    "lowStockCount": 5,
    "overdueInvoices": 3,
    "topClients": [ { "clientId":"...", "revenue": 15000 } ]
    }
    }

---

## Common error responses (examples)

- Validation error (400):
  {
  "success": false,
  "message": "Validation failed",
  "error": "Missing required field: client"
  }

- Unauthorized (401):
  {
  "success": false,
  "message": "Authentication required"
  }

- Forbidden (403):
  {
  "success": false,
  "message": "Admin access required"
  }

- Not found (404):
  {
  "success": false,
  "message": "Invoice not found"
  }

- Server error (500):
  {
  "success": false,
  "message": "Internal server error",
  "error": "Detailed error message (development only)"
  }

---

If you'd like, I can now generate one of these artifacts (pick one):

- OpenAPI (Swagger) JSON/YAML specification for the whole API
- Postman collection with sample requests and the example responses above
- A small set of JSON example files under `docs/examples/` for frontend mocking

Tell me which one to produce and I will create it next.
