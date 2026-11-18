/**
 * Security rules verification harness covering the adversarial payloads
 * documented in security_spec.md against firestore.rules.
 */
export const DIRTY_DOZEN_CASES = [
  { id: 1, name: 'Unauthenticated Profile Read', path: '/users/uid_123', expected: 'PERMISSION_DENIED' },
  { id: 2, name: 'Cross-User PII Access', path: '/users/uid_victim/private/info', expected: 'PERMISSION_DENIED' },
  { id: 3, name: 'Unverified Email Admin Spoofing', path: '/admins/uid_attacker', expected: 'PERMISSION_DENIED' },
  { id: 4, name: 'Shadow Field Injection on Create', path: '/users/uid_123', expected: 'PERMISSION_DENIED' },
  { id: 5, name: 'Immutable UID Mutation on Update', path: '/users/uid_123', expected: 'PERMISSION_DENIED' },
  { id: 6, name: 'ID Poisoning (>128 chars)', path: '/users/uid_123/watchlists/' + 'A'.repeat(200), expected: 'PERMISSION_DENIED' },
  { id: 7, name: 'Watchlist Note Text Flooding (>240 chars)', path: '/users/uid_123/watchlists/NVDA', expected: 'PERMISSION_DENIED' },
  { id: 8, name: 'Backdated Client Timestamp Spoofing', path: '/users/uid_123', expected: 'PERMISSION_DENIED' },
  { id: 9, name: 'Orphaned Subcollection Write (No Parent Doc)', path: '/users/uid_missing/watchlists/NVDA', expected: 'PERMISSION_DENIED' },
  { id: 10, name: 'Cross-Owner Spoof in Watchlist', path: '/users/uid_attacker/watchlists/NVDA', expected: 'PERMISSION_DENIED' },
  { id: 11, name: 'Terminal Triggered Alert Mutation', path: '/users/uid_123/alerts/a1', expected: 'PERMISSION_DENIED' },
  { id: 12, name: 'Unscoped Cross-Tenant List Query', path: '/users/uid_victim/watchlists', expected: 'PERMISSION_DENIED' },
  { id: 13, name: 'Cross-Tenant Allowlist Tampering', path: '/users/uid_victim/allowlists/al_1', expected: 'PERMISSION_DENIED' },
  { id: 14, name: 'Allowlist Threat Status Spoofing on Update', path: '/users/uid_123/allowlists/al_1', expected: 'PERMISSION_DENIED' },
  { id: 15, name: 'Security Audit Score Tampering (>100 or Update)', path: '/users/uid_123/securityAudits/au_1', expected: 'PERMISSION_DENIED' },
  { id: 16, name: 'Unsupported Chain or Injection Wallet Deposit Address', path: '/users/uid_123/wallets/DOGE', expected: 'PERMISSION_DENIED' },
] as const;
