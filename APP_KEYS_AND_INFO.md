# Meridian Markets — Server Keys, Global Markets & Architecture Reference

> **Security Notice:** Never commit real API secrets, OAuth client secrets, or raw master keys into source control. Configure environment secrets in **AI Studio → Settings → Secrets** (or `.env` on private servers).

---

## 1. Runtime & Deployment Endpoints

- **Server Entrypoint:** `server.ts` (Express + `ws` WebSocket Server + Vite middleware in dev / static `dist/` in prod)
- **Server Port:** `3000` (`PORT=3000`, bound to `0.0.0.0`)
- **Development App URL:** `https://ais-dev-oflylzjaqpdildgxmya3t6-515194886913.asia-east1.run.app`
- **Shared App URL:** `https://ais-pre-oflylzjaqpdildgxmya3t6-515194886913.asia-east1.run.app`
- **WebSocket Stream Path:** `/ws` (dual authentication via HttpOnly `meridian_sid` cookie AND `sessionStorage` `?token=` Bearer fallback for Safari/iOS/iframe resilience)
- **Cross-Platform PWA App:** Installable standalone on **Android (Chrome/Edge)**, **iPhone & iPad (Safari Add to Home Screen)**, **Windows 11/10 (Chrome/Edge)**, and **MacBook macOS (Chrome/Safari Dock Web App)** via `/manifest.webmanifest` + Workbox Service Worker.

### Persistent Atomic Disk Stores (`data/*.json`, `.tmp → renameSync`)
1. `data/meridian-admin-store.json` — User accounts, Scrypt credentials, TOTP/Passkey metadata, and HMAC-chained `AuthAuditEvent` telemetry.
2. `data/meridian-workspaces.json` — Isolated per-user balances, orders, positions, alerts, AES-256-GCM encrypted bank rails, vault transfers, social posts, and API keys.
3. `data/meridian-market-state.json` — Checkpointed 116-instrument live prices, candles, order book depth, and news feed for instant cold-boot warm start.

---

## 2. Global Multi-Market Coverage (116+ Ordered Instruments)

- **Crypto Coins (30):** `BTC-USD`, `ETH-USD`, `SOL-USD`, `BNB-USD`, `XRP-USD`, `ADA-USD`, `DOGE-USD`, `AVAX-USD`, `LINK-USD`, `DOT-USD`, `TON-USD`, `TRX-USD`, `SHIB-USD`, `LTC-USD`, `BCH-USD`, `UNI-USD`, `NEAR-USD`, `APT-USD`, `SUI-USD`, `PEPE-USD`, `POL-USD`, `ICP-USD`, `ATOM-USD`, `ARB-USD`, `OP-USD`, `RNDR-USD`, `INJ-USD`, `AAVE-USD`, `ALGO-USD`, `XLM-USD`.
- **India NSE & BSE (26):** `NIFTY50.NS`, `SENSEX.BO`, `RELIANCE.NS`, `TCS.NS`, `HDFCBANK.NS`, `INFY.NS`, `ICICIBANK.NS`, `SBIN.NS`, `BHARTIARTL.NS`, `ITC.NS`, `LT.NS`, `AXISBANK.NS`, `KOTAKBANK.NS`, `BAJFINANCE.NS`, `WIPRO.NS`, `HCLTECH.NS`, `TATAMOTORS.NS`, `TATASTEEL.NS`, `SUNPHARMA.NS`, `MARUTI.NS`, `ASIANPAINT.NS`, `ADANIENT.NS`, `TITAN.NS`, `ULTRACEMCO.NS`, `ONGC.NS`, `NTPC.NS`.
- **US Equities & ETFs (20):** `NVDA`, `AAPL`, `MSFT`, `GOOGL`, `AMZN`, `META`, `TSLA`, `BRK-B`, `AVGO`, `JPM`, `V`, `WMT`, `LLY`, `NFLX`, `AMD`, `PLTR`, `COIN`, `SPY`, `QQQ`, `DIA`.
- **Europe & UK (12):** `ASML.AS`, `LVMH.PA`, `SAP.DE`, `SIE.DE`, `NVO`, `SHEL.L`, `AZN.L`, `HSBA.L`, `BP.L`, `ULVR.L`, `NESN.SW`, `ROG.SW`.
- **Asia-Pacific (HK/JP/TW/AU) (4):** `7203.T`, `9988.HK`, `0700.HK`, `TSM`.
- **Global Forex (21):** `USD-INR`, `EUR-INR`, `GBP-INR`, `JPY-INR`, `AED-INR`, `EUR-USD`, `GBP-USD`, `USD-JPY`, `USD-CHF`, `AUD-USD`, `NZD-USD`, `USD-CAD`, `EUR-GBP`, `EUR-JPY`, `GBP-JPY`, `EUR-CHF`, `AUD-JPY`, `USD-SGD`, `USD-HKD`, `USD-CNH`, `USD-MXN`.
- **Commodities & Macro Rates (3):** `XAU-USD`, `WTI-USD`, `DXY`.

---

## 3. Solving `Error 401: invalid_client` (`flowName=GeneralOAuthFlow`)

Meridian Markets includes a dedicated modular **OAuth Controller (`server/oauthController.ts`)** with pre-flight credential sanitization & `.apps.googleusercontent.com` / `GOCSPX-` swap detection:
1. Quotes or accidental trailing spaces around `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GITHUB_CLIENT_ID`, or `GITHUB_CLIENT_SECRET` are trimmed automatically, and invalid/swapped credentials are blocked **pre-flight** with HTTP `503` diagnostic JSON instead of opening a broken Google OAuth popup.
2. In **Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client IDs**, add **BOTH** authorized redirect URIs below so federated sign-in works seamlessly across both Development preview and Shared preview deployments:
   - **Dev Callback URI:** `https://ais-dev-oflylzjaqpdildgxmya3t6-515194886913.asia-east1.run.app/api/v1/auth/oauth/google/callback`
   - **Shared Callback URI:** `https://ais-pre-oflylzjaqpdildgxmya3t6-515194886913.asia-east1.run.app/api/v1/auth/oauth/google/callback`
3. For **GitHub OAuth Apps**:
   - **Dev Callback URI:** `https://ais-dev-oflylzjaqpdildgxmya3t6-515194886913.asia-east1.run.app/api/v1/auth/oauth/github/callback`
   - **Shared Callback URI:** `https://ais-pre-oflylzjaqpdildgxmya3t6-515194886913.asia-east1.run.app/api/v1/auth/oauth/github/callback`

---

## 4. Default Seeded Accounts

| Role | Email | Initial Password | Default Mode | Admin Access |
| :--- | :--- | :--- | :--- | :--- |
| **Platform Admin / Owner** | `vemulavankeswararao@gmail.com` | `Meridian#2026` | Pro Quant | `isAdmin: true` (Full Admin & Auth Telemetry Console) |
| **Guided Investor Demo** | `demo@meridianmarkets.ai` | `DemoDesk#2026` | Beginner (`Guide On`) | `isAdmin: false` |

> **Recommendation:** After signing in as Platform Admin (`vemulavankeswararao@gmail.com`), open **Security & Vault** to enroll both **RFC-6238 Authenticator App (TOTP)** and a **FIDO2 Hardware Passkey** to satisfy the 2-factor Real-Money Security Checklist.

---

## 5. Environment Variable Keys (`.env.example` / Settings → Secrets)

| Key Name | Scope | Required? | Purpose |
| :--- | :--- | :--- | :--- |
| `GEMINI_API_KEY` | Server-only (`process.env.GEMINI_API_KEY`) | Recommended | Powers server-side **Gemini 4 Hydrogen** (`@google/genai`) AI Assistant (`/api/v1/ai/assistant`) & AI Investment Thesis (`/api/v1/ai/brief`). Falls back to quantitative telemetry engine if unset. |
| `VAULT_MASTER_KEY` | Server-only (`32+` chars) | Recommended for Prod | Derives `VAULT_AES_KEY` (AES-256-GCM banking rails), `LEDGER_HMAC_KEY` (vault & auth log chains), and `SESSION_SIGNING_KEY` (HMAC-SHA256 session tokens) via `scrypt`. If unset, an ephemeral 256-bit CSPRNG secret is generated on boot. |
| `APP_URL` | Server Origin | Auto-set in Cloud Run | Base URL used for OAuth 2.0 callback generation and WebAuthn Relying Party (`rpId`) resolution. |
| `GOOGLE_CLIENT_ID` | Google OAuth 2.0 | Optional | Must end in `.apps.googleusercontent.com`. Enables federated Google popup sign-in (`/api/v1/auth/oauth/google/url`). |
| `GOOGLE_CLIENT_SECRET` | Google OAuth 2.0 | Optional | Server-side token exchange secret for Google OAuth. |
| `GITHUB_CLIENT_ID` | GitHub OAuth | Optional | Enables federated GitHub popup sign-in (`/api/v1/auth/oauth/github/url`). |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth | Optional | Server-side token exchange secret for GitHub OAuth. |
| `GITHUB_SERVER_BASE_URL` | Private GitHub / GHE | Optional | Custom GitHub Enterprise Server web base URL (defaults to `https://github.com`). |
| `GITHUB_API_BASE_URL` | Private GitHub / GHE | Optional | Custom GitHub Enterprise REST API base URL (defaults to `https://api.github.com` or `${GITHUB_SERVER_BASE_URL}/api/v3`). |
| `GITHUB_PRIVATE_SERVER_TOKEN` | Private GitHub Token | Optional | Server-side PAT used for private GitHub identity verification & one-click operator sign-in (`/api/v1/auth/github/private-signin`). |
| `GITHUB_ALLOWED_ORG` | Organization Lock | Optional | Restricts GitHub OAuth & Private Server sign-in strictly to verified members of this GitHub organization. |
| `PORT` / `NODE_ENV` | Runtime | Auto-managed | Defaults to `PORT=3000`, `NODE_ENV=production` during deployed `npm start`. |

---

## 6. Server Module Map (`/server/*`)

| File | Responsibility |
| :--- | :--- |
| `server.ts` | Unified Express HTTP server, REST APIs, `ws` WebSocket fan-out server, 34-asset rotating tick broadcast, atomic flush hooks (`SIGINT`/`SIGTERM`), and Vite/dist static serving. |
| `server/marketCatalog.ts` | 116-instrument ordered global multi-market catalog across Crypto (30), India NSE/BSE (26), US (20), Europe (12), Asia-Pacific (4), Forex (21), and Commodities/Rates (3). |
| `server/workspacePersistence.ts` | Atomic `.tmp → renameSync` JSON disk persistence for isolated user workspaces and live market state + storage diagnostics telemetry. |
| `server/oauthController.ts` | Modular Express OAuth 2.0 router (`/api/v1/auth/oauth/*`) with pre-flight `401 invalid_client` prevention, `/diagnostics` endpoint, and dual Bearer + HttpOnly Cookie popup postMessage issuance. |
| `server/authServer.ts` | Dedicated Authentication & Private GitHub Server diagnostics router (`/server-health`, `/github/server-status`, `/github/private-signin`). |
| `server/githubServerAuth.ts` | GitHub Enterprise / Private GitHub Server probe, `read:org` membership enforcement, and PAT operator verification. |
| `server/skillsEngine.ts` | Executable Quantitative, Risk, FX, Security, and Cross-Platform Skills Engine (`/api/v1/skills`, `/api/v1/skills/:id/run`). |
| `server/authEngine.ts` | Scrypt password hashing (`N=16384, r=8, p=1`), HMAC-SHA256 session tokens (Cookie + `Authorization: Bearer`), brute-force lockout (5 attempts / 120s), dual-MFA Real-Money gate, isolated per-user workspaces, and Admin directory operations. |
| `server/adminTelemetryStore.ts` | Atomic persistent storage (`data/meridian-admin-store.json`), HMAC-chained `AuthAuditEvent` log, real-time admin WebSocket push hook, and safe environment key readiness reporter. |
| `server/mfaAuthEngine.ts` | RFC-6238 6-digit TOTP generation/verification (`±1` step drift), single-use SHA-256 recovery backup codes, W3C WebAuthn FIDO2 ECDSA P-256 (`-7`) / RSA (`-257`) SPKI cryptographic verification, and OAuth credential validators/exchange. |
| `server/securityFirewall.ts` | Zero-Trust WAF payload inspection (SQLi, XSS, Prototype Pollution, Path Traversal, Shell Injection), proxy-aware CSRF Origin guard, IP-hashed sliding-window rate limiter, `AES-256-GCM` banking encryption, `HMAC-SHA256` transfer chain, and 120s Step-Up OTP challenges. |
| `server/aiAssistantEngine.ts` | Server-side Gemini 4 Hydrogen (`@google/genai`) conversational assistant grounded in live prices, ML forecasts, 24-agent reports, news headlines, and user portfolio/MFA posture. |
| `server/nexusAgents.ts` | 24-agent multi-department intelligence engine (`A01–A23` + deterministic independent Risk & Audit Gate `A24`). |
| `server/mlEngine.ts` | Short-term regression/EWMA volatility forecasting, RSI(14), candlestick pattern detection, and opportunity scoring. |
| `server/feeds.ts` | Live Coinbase crypto WebSocket stream + Coinbase Exchange multi-crypto ticker + Yahoo Finance rotating equity batches + full 12-currency Frankfurter FX matrix + RSS sentiment scorer. |
| `server/performanceEngine.ts` | O(1) symbol room fan-out, per-user WebSocket routing, `monitorEventLoopDelay` p99 lag telemetry, 250ms market snapshot coalescing cache, and storage ledger monitoring. |

---

## 7. Complete Server API Reference

### Authentication, MFA, OAuth Controller & Real-Money Custody
- `GET /api/v1/auth/me` — Verify active session (Cookie or `Bearer`), user profile, sessions, passkeys
- `POST /api/v1/auth/register` — Create isolated user account + persist to Admin & Workspace ledgers + return session token
- `POST /api/v1/auth/login` — Email/password verification + brute-force shield + MFA challenge detection + return session token
- `POST /api/v1/auth/mfa/verify` — Complete 2nd-factor TOTP or single-use recovery code sign-in
- `POST /api/v1/auth/mfa/totp/setup` & `/verify` & `/disable` — RFC-6238 Authenticator App enrollment
- `GET /api/v1/auth/passkeys`, `POST /api/v1/auth/passkeys/register/options`, `/register/verify`, `DELETE /api/v1/auth/passkeys/:id` — FIDO2 Passkey lifecycle
- `POST /api/v1/auth/passkeys/login/options`, `/login/verify` — Passwordless or 2FA FIDO2 assertion
- `GET /api/v1/auth/oauth/providers`, `/oauth/diagnostics`, `/oauth/:provider/url`, `/oauth/:provider/callback` — Dedicated OAuth 2.0 Controller (`server/oauthController.ts`)
- `GET /api/v1/auth/server-health`, `GET /api/v1/auth/github/server-status`, `POST /api/v1/auth/github/private-signin` — Dedicated Auth Server health & Private GitHub Enterprise / Org authentication
- `POST /api/v1/auth/real-money` — Toggle Real-Money Custody Mode (strictly gated by `TOTP + FIDO2 Passkey`, unlocked vault, and linked bank rail)
- `POST /api/v1/auth/logout`, `GET /api/v1/auth/sessions`, `POST /api/v1/auth/sessions/revoke-others`, `PATCH /api/v1/auth/preferences`
- `GET /api/v1/skills`, `POST /api/v1/skills/:id/run` — Execute Platform Quantitative, FX, Risk, Security, and Cross-Platform Sync Skills

### Admin-Only Telemetry & Directory (`isAdmin: true` required)
- `GET /api/v1/admin/overview` — Server overview, safe key status, full user directory, and HMAC auth telemetry feed
- `GET /api/v1/admin/auth-logs` — Paginated authentication & registration audit stream
- `POST /api/v1/admin/users/:id/revoke-sessions` — Force-terminate all active sessions for a user
- `POST /api/v1/admin/users/:id/admin-role` — Grant or revoke secondary Admin access
- `GET /api/v1/admin/export/app-guide` — Download `APP_KEYS_AND_INFO.md`

### Performance Engine & Persistent Storage
- `GET /api/v1/engine/metrics` — Event-loop lag, broadcast latency, throughput, and atomic disk store diagnostics
- `POST /api/v1/engine/stress-test` — Run concurrent `100 / 250 / 500 / 1000`-op matching engine benchmark
- `POST /api/v1/engine/flush-storage` — Synchronously flush Admin, Workspace, and 116-Market State ledgers to disk

### AI Assistant, 24-Agent Intelligence, Vault & Market Data
- `POST /api/v1/ai/assistant`, `POST /api/v1/ai/brief` — Gemini 4 Hydrogen AI Assistant & investment thesis
- `POST /api/v1/nexus/evaluate`, `POST /api/v1/nexus/execute` — 24-agent consensus + deterministic `A24` risk gate
- `GET /api/v1/security/status`, `POST /api/v1/security/lockdown`, `/verify-chain`, `/test-probe`
- `POST /api/v1/vault/challenge`, `/vault/bank-accounts`, `/vault/transfer`
- `GET /api/health`, `/api/v1/market/snapshot`, `/candles/:symbol`, `/book/:symbol`, `/quote/:symbol`
- `GET /api/v1/keys`, `POST /api/v1/keys`, `DELETE /api/v1/keys/:id`

---

## 8. Keyboard Shortcuts
- `B` — Jump to Market Terminal and focus the **Buy** order entry field (automatically opens Order Ticket on mobile)
- `S` — Jump to Market Terminal and focus the **Sell** order entry field (automatically opens Order Ticket on mobile)
- `Esc` — Close open modals, mobile navigation, or the AI Assistant drawer and clear active selections
