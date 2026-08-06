# GKarting Backend

Production REST API for the GKarting karting booking platform.

## Stack

NestJS · PostgreSQL · Prisma ORM · JWT (access + rotating refresh tokens) ·
Nodemailer · Cloudinary · class-validator · bcrypt · Swagger · Docker.

## Build status

This is being delivered in layers. **Done so far:**

- ✅ Project scaffold, Docker Compose (Postgres + API), Dockerfile
- ✅ Full Prisma schema — users, roles, karts, bookings, booking-karts,
  pricing packages, coupons, reviews, contact messages, business hours,
  blocked dates, track status, notifications, audit logs, site settings
- ✅ Auth module: register, bcrypt hashing, strong-password + phone
  validation, email verification (JWT link + Nodemailer), login, JWT
  access/refresh with rotation and revocation, forgot/reset password,
  change password, role guards (`ADMIN` / `STAFF` / `USER`)
- ✅ Users module: profile get/update, avatar upload via Cloudinary,
  admin customer management (list/search/filter, deactivate, change role)
- ✅ Global guards (JWT auth + roles, bypassable with `@Public()`),
  global validation pipe, structured error filter, rate limiting,
  Helmet, Swagger docs at `/api/docs`
- ✅ Seed script: admin account, 12-kart fleet, 6 pricing packages,
  business hours, track status, site settings

**Coming in the next pass:** Karts admin CRUD, Pricing admin CRUD +
Coupons, Bookings (availability engine + confirmation/cancellation
emails), Track Status admin + Weather integration, Reviews (submit +
moderate), Contact messages, Notifications, Analytics, Google Maps
config endpoint, Admin dashboard frontend.

## Getting started

```bash
cp .env.example .env
# fill in real SMTP, Cloudinary, Google Maps, and Weather API credentials

docker compose up -d postgres
npm install
npm run prisma:migrate      # creates tables from schema.prisma
npm run seed                # admin account + starter data
npm run start:dev
```

API runs at `http://localhost:4000/api/v1`.
Swagger docs at `http://localhost:4000/api/docs`.

Default seeded admin login (change immediately):
`admin@gkarting.com` / whatever you set as `SEED_ADMIN_PASSWORD` in `.env`.

## Full stack via Docker

```bash
docker compose up --build
```

This builds the API image, waits for Postgres to be healthy, runs
`prisma migrate deploy`, then starts the server.

## Notes on production readiness

- Refresh tokens are stored **hashed** (SHA-256) and rotated on every
  use; a stolen refresh token is invalidated the moment the real user
  refreshes again.
- Login responses don't reveal whether an email exists (generic
  "invalid email or password"), and forgot-password always returns the
  same message regardless of whether the account exists.
- Every password-changing action revokes all existing refresh tokens
  for that user.
- Audit logging is wired as a global service — any module can call
  `AuditService.log()` without importing anything extra.
