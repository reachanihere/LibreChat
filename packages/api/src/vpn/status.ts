import { fetch as undiciFetch } from 'undici';
import { logger } from '@librechat/data-schemas';
import type { TVpnStatusResponse } from 'librechat-data-provider';
import type { RequestInit } from 'undici';
import { getProxyDispatcher } from '~/utils/proxy';

const GEO_IP_PRIMARY = 'https://ipinfo.io/json';
const GEO_IP_FALLBACK = 'https://ifconfig.co/json';
const EGRESS_TIMEOUT_MS = 5000;

type GeoIpPayload = {
  ip?: string;
  country?: string;
  country_iso?: string;
};

function isProxyActive(): boolean {
  return Boolean(process.env.PROXY?.trim());
}

function buildFetchOptions(controller: AbortController): RequestInit {
  const options: RequestInit = {
    signal: controller.signal,
    headers: { accept: 'application/json' },
  };
  const dispatcher = getProxyDispatcher();
  if (dispatcher) {
    options.dispatcher = dispatcher;
  }
  return options;
}

async function fetchGeoIp(url: string): Promise<GeoIpPayload | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), EGRESS_TIMEOUT_MS);
  try {
    const res = await undiciFetch(url, buildFetchOptions(controller));
    if (!res.ok) {
      return null;
    }
    return (await res.json()) as GeoIpPayload;
  } catch (error) {
    logger.warn(`[getVpnStatus] egress lookup failed for ${url}`, error);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function resolveEgress(): Promise<GeoIpPayload | null> {
  const primary = await fetchGeoIp(GEO_IP_PRIMARY);
  if (primary?.ip) {
    return primary;
  }
  return fetchGeoIp(GEO_IP_FALLBACK);
}

export async function getVpnStatus(): Promise<TVpnStatusResponse> {
  const connected = isProxyActive();
  const egress = await resolveEgress();

  if (!egress?.ip) {
    return {
      connected,
      ip: null,
      country: null,
      message: connected ? 'nordvpn connected (egress IP unavailable)' : 'direct connection',
    };
  }

  return {
    connected,
    ip: egress.ip,
    country: egress.country ?? egress.country_iso ?? null,
    message: connected ? 'nordvpn connected' : 'direct connection',
  };
}
