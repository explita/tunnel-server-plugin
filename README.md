# Explita Tunnel Server Plugin

Modular authentication, token issuance, and zero-log telemetry plugin for [Explita Tunnel Server](https://github.com/explita/tunnel-server).

[**Documentation**](https://infra.explita.ng/docs/tunnel/plugin) • [**Tunnel Server**](https://github.com/explita/tunnel-server) • [**Explita Infra**](https://infra.explita.ng)

---

## ⚡ Features

- **Developer Authentication**: Passwordless 6-digit email OTP login (`POST /_api/token/request-otp` and `verify-otp`).
- **Instant Token Issuance**: Zero-friction token issuance for headless servers, CI/CD, and Explita Deploy (`POST /_api/token/issue`).
- **Token Management**: Persistent developer accounts and API tokens stored in PostgreSQL via Prisma with Redis caching.
- **Cluster Telemetry**: High-level throughput, request counters, and active connection metrics (`GET /_api/stats`) with zero payload logging.

---

## 🚀 Quick Setup

### 1. Installation

In your tunnel gateway project:

```bash
pnpm add @explita/tunnel-server-plugin
```

### 2. Enable in `tunnel.config.js`

Copy the configuration template into your gateway:

```bash
cp tunnel.config.example.js tunnel.config.js
```

### 3. Sync Database Schema

Set `DATABASE_URL` in your `.env`, then apply the bundled Prisma schema:

```bash
pnpm db:push

# Or without installing dependencies locally:
npx @explita/tunnel-server-plugin db:push
```

---

## 📖 Documentation

Full architectural breakdowns, endpoint schemas, SMTP options, and telemetry configurations live on our official docs site:

👉 **[infra.explita.ng/docs/tunnel/plugin](https://infra.explita.ng/docs/tunnel/plugin)**

- [Self-Hosting Guide](https://infra.explita.ng/docs/tunnel/setup)
- [Security & Zero-Knowledge Cryptography](https://infra.explita.ng/docs/tunnel/security)
- [Explita Tunnel Overview](https://infra.explita.ng/docs/tunnel)

---

## 📄 License

MIT © [Explita](https://explita.ng)

