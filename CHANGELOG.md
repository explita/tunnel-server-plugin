# Changelog

All notable changes to the **Explita Tunnel Server Plugin** (`@explita/tunnel-server-plugin`) will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-10-24

Initial release of **Explita Tunnel Server Plugin**, providing pluggable database authentication, token issuance, and zero-log telemetry persistence for Explita Tunnel gateways.

### Added

#### 🔐 Authentication & Token Engine

- **Passwordless Email OTP Authentication**:
  - `POST /_api/token/request-otp`: Issues cryptographically secure 6-digit OTP codes with 10-minute expiration.
  - Multi-transport delivery: Sends rich HTML emails via Nodemailer when SMTP is configured, or logs codes to stdout in non-production.
  - `POST /_api/token/verify-otp`: Validates OTP codes, rate limits verification attempts, provisions or retrieves developer profiles, and returns an active developer token (`exp_live_...`).
- **Instant Headless Token Issuance**:
  - `POST /_api/token/issue`: Enables non-interactive token issuance for CI/CD runners and Explita Deploy servers keyed by IP and machine ID without requiring email verification.
- **Multi-Device Token Validation**:
  - `validateToken`: Multi-tier token validation engine with Redis caching (5-minute TTL) and PostgreSQL fallback.

#### 🗄️ Database & Persistence Layer

- **Bundled Zero-Config Prisma Engine**:
  - Pre-generated Prisma Client and PostgreSQL adapter (`@prisma/adapter-pg`) with automatic connection pooling.
  - Database schema models:
    - `Developer`: Tracks developer identities, email addresses, and last login timestamps.
    - `ApiToken`: Stores hashed and revocable access tokens with device labels and last-used metadata.
    - `DailyMetric`: Aggregates daily tunnel connections, routed requests, transferred bytes, and unique developer counts.
    - `SystemMetric`: Tracks all-time cluster throughput and total tunnels created.
  - Automatic graceful degradation: Operates in in-memory mode if `DATABASE_URL` is omitted.
- **Database Push CLI (`tunnel-plugin`)**:
  - Bundled executable `tunnel-plugin db:push` (also runnable via `npx @explita/tunnel-server-plugin db:push`) allowing operators to apply schema migrations directly from `.env` without installing Prisma in their gateway project.

#### 📊 Telemetry & Metrics Persistence

- **Zero-Log Cluster Telemetry**:
  - Pluggable persister implementation (`flushMetrics`) executing atomic upsert transactions into `DailyMetric` and `SystemMetric`.
  - Zero-payload logging guarantees: Strictly records anonymous counts, request volumes, and byte totals.
- **Internal Stats API**:
  - `GET /_api/stats`: Protected internal endpoint requiring `x-internal-secret` header to inspect active tunnel counts, daily activity, and lifetime cluster totals.
