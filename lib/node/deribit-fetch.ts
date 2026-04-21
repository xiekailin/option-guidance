const PROXY_ENV_KEYS = ["HTTPS_PROXY", "HTTP_PROXY", "ALL_PROXY"] as const;

type UndiciDispatcher = object;

function resolveProxyUrl(): string | null {
  for (const key of PROXY_ENV_KEYS) {
    const value = process.env[key]?.trim();
    if (value) {
      return value;
    }
  }
  return null;
}

let cachedProxyUrl: string | null | undefined;
let cachedDispatcher: UndiciDispatcher | null | undefined;
let isGlobalDispatcherConfigured = false;
let originalFetch: typeof globalThis.fetch | null = null;

async function getProxyDispatcher(): Promise<UndiciDispatcher | null> {
  const proxyUrl = resolveProxyUrl();
  if (!proxyUrl) {
    cachedProxyUrl = null;
    cachedDispatcher = null;
    return null;
  }

  if (cachedProxyUrl === proxyUrl && cachedDispatcher !== undefined) {
    return cachedDispatcher;
  }

  const { ProxyAgent } = await import("undici");
  cachedProxyUrl = proxyUrl;
  cachedDispatcher = new ProxyAgent(proxyUrl) as UndiciDispatcher;
  return cachedDispatcher;
}

export async function configureDeribitNodeProxy(): Promise<void> {
  if (typeof window !== "undefined") {
    return;
  }

  if (!originalFetch) {
    originalFetch = globalThis.fetch.bind(globalThis);
  }

  const dispatcher = await getProxyDispatcher();
  if (!dispatcher) {
    globalThis.fetch = originalFetch;
    isGlobalDispatcherConfigured = false;
    return;
  }

  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    return originalFetch!(input, {
      ...init,
      dispatcher,
    } as RequestInit & { dispatcher: UndiciDispatcher });
  }) as typeof globalThis.fetch;

  isGlobalDispatcherConfigured = true;
}

export function isDeribitNodeProxyConfigured(): boolean {
  return isGlobalDispatcherConfigured;
}

export function resetDeribitNodeProxyForTest(): void {
  if (originalFetch) {
    globalThis.fetch = originalFetch;
  }
  cachedProxyUrl = undefined;
  cachedDispatcher = undefined;
  isGlobalDispatcherConfigured = false;
  originalFetch = null;
}
