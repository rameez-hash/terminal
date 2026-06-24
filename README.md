# SalesPortal

Enterprise-grade SaaS Sales Management & Payment Tracking Portal with Admin Dashboard.

## Tech Stack

- **Next.js 15** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **PostgreSQL** + **Prisma ORM**
- **NextAuth.js** (Credentials + JWT)
- **Stripe** & **PayPal** payment integrations
- **Recharts** for analytics
- **Pusher** for real-time updates
- Role-Based Access Control (Super Admin, Seller)

## Features

### Authentication
- Secure login with credentials
- Password reset flow
- Role-based access control
- JWT session management

### Admin Dashboard
- Create, edit, suspend, delete sellers
- Assign monthly sales targets
- View all sellers' activities, payment links, clients
- Real-time sales reports and analytics
- Stripe & PayPal transaction monitoring
- Target completion tracking
- Export reports to Excel/PDF

### Seller Dashboard
- Profile management
- Client creation and management
- Stripe & PayPal payment link creation
- Target progress tracking
- Sales analytics and transaction history

### Payment Processing
- Stripe Checkout Sessions with webhooks
- PayPal Orders with webhook validation
- Automatic target progress updates on payment success
- Multi-currency support (USD, EUR, GBP)

### Additional
- Activity audit logs
- In-app notifications
- Dark/light mode
- Responsive design
- Search, filters, and pagination

## Getting Started

### Prerequisites

- Node.js 18+
- No database server required (uses local SQLite file)

### Installation

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Generate Prisma client & create local SQLite DB
npm run db:generate
npm run db:migrate
npm run db:seed

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Super Admin | admin@salesportal.com | admin123 |
| Seller | john@salesportal.com | seller123 |
| Seller | jane@salesportal.com | seller123 |

## Environment Variables

See `.env.example` for all required variables:

- `DATABASE_URL` - SQLite file path (default: `file:./prisma/dev.db`)
- `NEXTAUTH_SECRET` - Random secret for JWT signing
- `STRIPE_*` - Stripe API keys and webhook secret
- `PAYPAL_*` - PayPal credentials and webhook ID
- `PUSHER_*` - Pusher credentials for real-time updates

## Webhook Setup

### Stripe
Point your Stripe webhook to:
```
POST /api/webhooks/stripe
```
Events: `checkout.session.completed`, `payment_intent.succeeded`

### PayPal
Point your PayPal webhook to:
```
POST /api/webhooks/paypal
```
Events: `CHECKOUT.ORDER.APPROVED`, `PAYMENT.CAPTURE.COMPLETED`

## Project Structure

```
src/
├── app/
│   ├── admin/          # Admin dashboard pages
│   ├── seller/         # Seller dashboard pages
│   ├── api/            # REST API routes
│   └── login/          # Auth pages
├── components/
│   ├── charts/         # Recharts components
│   ├── layout/         # Dashboard layout, sidebar
│   ├── pages/          # Feature page components
│   └── ui/             # Reusable UI components
├── lib/
│   ├── auth.ts         # NextAuth configuration
│   ├── prisma.ts       # Database client
│   ├── stripe.ts       # Stripe integration
│   ├── paypal.ts       # PayPal integration
│   ├── targets.ts      # Target progress logic
│   └── ...
└── generated/prisma/   # Prisma client output
```

## Scripts

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run start        # Start production server
npm run lint         # Run ESLint
npx prisma studio    # Open database GUI
npx prisma migrate dev  # Run migrations
npx prisma db seed   # Seed demo data
```

## License

MIT
