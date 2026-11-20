# Hitayu — Full-Stack React + Node.js E-Commerce, Multi-Author Blog & AI Agent Platform

A complete, security-hardened **React 18 + Vite** frontend and **zero-dependency Node.js** backend for **Hitayu Organic Wellness**.

## Complete Feature Matrix

1. **Full E-Commerce Storefront & Admin Catalog**
   - **6 Unique Product Formulations with 6 Distinct Studio Images** (zero placeholder reuse).
   - **Admin Item Adding & Inventory Management** (`POST /api/admin/products`, `PATCH /api/admin/products/:id`) with SKU, category, price, MRP, stock, image upload, ingredients, and usage ritual.
   - **Shop Profile Creation & Configuration** (`GET /api/shop/profile`, `PUT /api/admin/shop/profile`): Shop name, tagline, GSTIN, support contact, warehouse address, GST %, free-shipping threshold, COD fee, and return policy.
2. **User Accounts, Profile & Address Book**
   - Registration & login (`scrypt` salted password hashing + HMAC-SHA256 JWT).
   - **Profile Management** (`PUT /api/profile`), password updates, **Wishlist** (`POST /api/profile/wishlist/:productId`), and **Multiple Saved Shipping Addresses** (`POST/DELETE /api/profile/addresses`).
3. **Cart, Payment Processing & Live Order Tracking**
   - Persistent bag with coupon codes (`HITAYU10`, `WELLNESS15`), automatic GST & shipping calculation, and **UPI / Card / COD payment validation** generating a transaction reference (`PAY_HT_...`).
   - Atomic stock deduction on checkout, **6-stage Visual Order Tracking Timeline** (`placed → confirmed → packed → shipped → out_for_delivery → delivered`), courier & tracking ID, and order cancellation with automatic stock restoration.
4. **Multi-Author Blog CMS & AI Agent Publishing API**
   - Admin member management (`POST /api/admin/members`), author-scoped blog CRUD, and magic-byte validated **photo/video uploads** (`.jpg`, `.png`, `.webp`, `.mp4`, `.webm`).
   - Scoped **AI Agent Bearer API Keys** (`ht_agent_...`, SHA-256 hashed at rest) for direct media uploads (`POST /api/agent/media`) and blog publishing (`POST /api/agent/blogs`).
5. **8 Indian Languages** — English, Hindi, Odia, Bengali, Marathi, Tamil, Telugu, and Gujarati.

## Quick Start

### 1. Start the Node.js Backend (zero `npm install` needed!)
```bash
cd backend
node server.js
# Listening at http://127.0.0.1:5000
```

### 2. Start the React + Vite Frontend
```bash
cd frontend
npm install
npm run dev
# Open http://localhost:5173
```

*(For production, run `cd frontend && npm run build`, and `node backend/server.js` automatically serves the built React app from `frontend/dist`!)*

## Pre-Seeded Demo Accounts

| Role | Email | Password |
| :--- | :--- | :--- |
| **Admin (Shop Owner)** | `admin@hitayu.in` | `Admin@Hitayu2026` |
| **Blog Author** | `writer@hitayu.in` | `Writer@Hitayu2026` |
| **Customer** | `customer@hitayu.in` | `Customer@2026` |

## Architecture & Security References
- E-Commerce Requirements: [Elogic Commerce](https://elogic.co/blog/functional-and-non-functional-requirements-for-ecommerce-websites/), [DigitalSuits](https://digitalsuits.co/blog/10-major-requirements-for-e-commerce-website/), [Commerce Engine](https://www.commercengine.io/blog/ecommerce-website-requirements)
- Indian Checkout & COD/UPI Patterns: [Razorpay COD Docs](https://razorpay.com/docs/payments/payment-methods/cod), [TheCodeArt India Payment Guide](https://thecodeart.in/blog/razorpay-upi-payment-integration-guide-india)
- Node.js & OWASP Security: [LogRocket Node.js Architecture](https://blog.logrocket.com/node-js-project-architecture-best-practices/), [OWASP API Security Top 10 (2023)](https://api-security.owasp.org/editions/2023/en/0x11-t10/)
