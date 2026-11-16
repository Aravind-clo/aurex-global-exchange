import type { EncryptedEnvelopeProof } from '../types/market';

async function sha256Hex(input: string): Promise<string> {
  if (typeof window !== 'undefined' && window.crypto?.subtle) {
    const bytes = new TextEncoder().encode(input);
    const digest = await window.crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  // Fallback deterministic 64-char hex fingerprint if WebCrypto unavailable
  let acc = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    acc ^= input.charCodeAt(i);
    acc = Math.imul(acc, 16777619);
  }
  return Math.abs(acc).toString(16).padStart(64, '0').slice(0, 64);
}

let cachedKeyId = 'ax-mesh-handshake';

export function setActiveMeshKeyId(keyId: string) {
  if (keyId && keyId.trim()) {
    cachedKeyId = keyId.trim();
  }
}

export async function createEncryptedEnvelopeHeader(
  channel: string,
  payload: unknown
): Promise<string> {
  const bytes = new Uint8Array(12);
  if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
    window.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  const nonce = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  const payloadHashSha256 = await sha256Hex(JSON.stringify(payload ?? {}));
  const proof: EncryptedEnvelopeProof = {
    keyId: cachedKeyId,
    nonce,
    timestamp: Date.now(),
    channel,
    payloadHashSha256,
  };
  return JSON.stringify(proof);
}
