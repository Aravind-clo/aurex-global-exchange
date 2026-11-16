let cachedFingerprint: string | null = null;
let pendingPromise: Promise<string> | null = null;

function fallbackHash(input: string): string {
  let h1 = 0xdeadbeef ^ input.length;
  let h2 = 0x41c6ce57 ^ input.length;
  for (let i = 0; i < input.length; i += 1) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return ((4294967296 * (2097151 & h2) + (h1 >>> 0))).toString(16).padStart(16, '0');
}

export function getDeviceLabel(): string {
  if (typeof navigator === 'undefined') return 'API Client';
  const ua = navigator.userAgent || '';
  const platform = navigator.platform || 'Web';
  const browser = ua.includes('Edg/')
    ? 'Edge'
    : ua.includes('Chrome/')
    ? 'Chrome'
    : ua.includes('Firefox/')
    ? 'Firefox'
    : ua.includes('Safari/')
    ? 'Safari'
    : 'Browser';
  return `${browser} · ${platform}`.slice(0, 48);
}

export function getCachedDeviceFingerprint(): string {
  if (cachedFingerprint) return cachedFingerprint;
  if (typeof window === 'undefined') return 'srv-runtime';
  try {
    const stored = window.sessionStorage.getItem('aurex_device_fp');
    if (stored) {
      cachedFingerprint = stored;
      return stored;
    }
  } catch {
    // ignore storage restriction
  }
  const seed = [
    navigator.userAgent,
    navigator.language,
    navigator.platform,
    Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC',
    `${window.screen?.width ?? 0}x${window.screen?.height ?? 0}x${window.screen?.colorDepth ?? 24}`,
    String(navigator.hardwareConcurrency ?? 0),
    String(navigator.maxTouchPoints ?? 0),
  ].join('|');
  cachedFingerprint = `fp-${fallbackHash(seed)}`;
  try {
    window.sessionStorage.setItem('aurex_device_fp', cachedFingerprint);
  } catch {
    // ignore
  }
  return cachedFingerprint;
}

export async function ensureCryptographicDeviceFingerprint(): Promise<string> {
  if (cachedFingerprint && cachedFingerprint.startsWith('fp-sha-')) return cachedFingerprint;
  if (pendingPromise) return pendingPromise;

  pendingPromise = (async () => {
    if (typeof window === 'undefined' || !window.crypto?.subtle) {
      return getCachedDeviceFingerprint();
    }
    try {
      const seed = [
        navigator.userAgent,
        navigator.language,
        navigator.platform,
        Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC',
        `${window.screen?.width ?? 0}x${window.screen?.height ?? 0}x${window.screen?.colorDepth ?? 24}`,
        String(navigator.hardwareConcurrency ?? 0),
        String(navigator.maxTouchPoints ?? 0),
      ].join('|');
      const digest = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(seed));
      const hex = Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
        .slice(0, 20);
      cachedFingerprint = `fp-sha-${hex}`;
      try {
        window.sessionStorage.setItem('aurex_device_fp', cachedFingerprint);
      } catch {
        // ignore
      }
      return cachedFingerprint;
    } catch {
      return getCachedDeviceFingerprint();
    }
  })();

  return pendingPromise;
}
