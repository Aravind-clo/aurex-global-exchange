# Meridian Markets / Aurex Global Firestore Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **Default-Deny Catch-All**: Unmatched paths deny all reads and writes.
2. **Owner & Verified-Email Gate**: All user profile, private PII, watchlist, alert, multi-chain wallet, withdrawal allowlist, and security audit mutations require `request.auth != null && request.auth.token.email_verified == true`.
3. **PII Isolation**: Verified email metadata resides strictly inside `/users/{userId}/private/info` and is readable/writable only by the owning UID or a verified admin.
4. **Master Gate & Immutability**: Subcollections `/users/{userId}/watchlists/{itemId}`, `/users/{userId}/alerts/{alertId}`, `/users/{userId}/wallets/{chainId}`, `/users/{userId}/allowlists/{entryId}`, and `/users/{userId}/securityAudits/{auditId}` require the parent `/users/{userId}` document to exist via `exists(...)`, enforce `ownerId == request.auth.uid`, enforce immutable `ownerId` and `createdAt`, and validate server timestamps (`request.time`).
5. **Terminal State & Threat Locking**: Once a `DeskAlert` transitions to `status == 'triggered'`, client updates are blocked unless performed by a verified admin. `WithdrawalAllowlistEntry` `chain`, `address`, and `threatStatus` are immutable on client updates, and `SecurityAuditSnapshot` records are append-only (client updates/deletes denied unless admin).
6. **Zero Query Delegation**: Every `allow list` rule evaluates `resource.data.ownerId == request.auth.uid || isAdmin()` without performing `get()`/`exists()` reads.

## 2. Adversarial Payloads (Expected: `PERMISSION_DENIED`)
1. **Unauthenticated Profile Read**: Unauthenticated client reads `/users/uid_123`.
2. **Cross-User PII Access**: Signed-in user `uid_attacker` gets `/users/uid_victim/private/info`.
3. **Unverified Email Spoofing**: Attacker sets custom claim or email matching admin with `email_verified: false` and writes `/admins/uid_attacker`.
4. **Shadow Field Injection on Create**: User creates `/users/uid_123` with extra ghost key `isAdmin: true`.
5. **Shadow Field Injection on Update**: User updates `/users/uid_123` modifying `uid` alongside `displayName`.
6. **ID Poisoning**: User attempts create on `/users/uid_123/watchlists/${'A'.repeat(500)}`.
7. **Text Flooding (Denial of Wallet)**: User creates watchlist item with `note` length `5000` characters (`> 240` maxLength).
8. **Backdated Timestamp Spoofing**: User sets `createdAt` to client timestamp `new Date('2020-01-01')` instead of `request.time`.
9. **Orphaned Subcollection Write**: User creates `/users/uid_missing/watchlists/NVDA` before parent `/users/uid_missing` exists.
10. **Cross-Owner Spoof in Watchlist**: `uid_attacker` creates `/users/uid_attacker/watchlists/NVDA` with `ownerId: 'uid_victim'`.
11. **Terminal Alert Mutation**: Non-admin user updates `/users/uid_123/alerts/a1` when existing `status == 'triggered'`.
12. **Unscoped List Query Scraping**: Signed-in user issues unfiltered `list` query on another user's `/users/uid_victim/watchlists` without `ownerId == request.auth.uid`.
13. **Cross-Tenant Allowlist Tampering**: `uid_attacker` writes or updates `/users/uid_victim/allowlists/entry_1`.
14. **Allowlist Threat Bypass**: Non-admin client mutates `threatStatus` or `address` on `/users/uid_123/allowlists/entry_1`.
15. **Security Audit History Tampering**: Non-admin client updates or deletes `/users/uid_123/securityAudits/audit_1` or supplies `overallScorePct: 999`.
16. **Invalid Chain Address Injection**: Client creates `/users/uid_123/wallets/DOGE` with unsupported chain or non-alphanumeric injection payload in `depositAddress`.
