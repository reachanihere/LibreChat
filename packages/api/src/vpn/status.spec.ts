jest.mock('@librechat/data-schemas', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('~/utils/proxy', () => ({
  getProxyDispatcher: jest.fn(),
}));

jest.mock('undici', () => ({
  fetch: jest.fn(),
}));

import { fetch as undiciFetch } from 'undici';
import { getProxyDispatcher } from '~/utils/proxy';
import { getVpnStatus } from './status';

const mockFetch = undiciFetch as jest.Mock;
const mockGetProxyDispatcher = getProxyDispatcher as jest.Mock;

type GeoIpBody = { ip?: string; country?: string; country_iso?: string };

function jsonResponse(body: GeoIpBody, ok = true) {
  return { ok, json: jest.fn().mockResolvedValue(body) };
}

describe('getVpnStatus', () => {
  const originalProxy = process.env.PROXY;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetProxyDispatcher.mockReturnValue(undefined);
    delete process.env.PROXY;
  });

  afterAll(() => {
    if (originalProxy === undefined) {
      delete process.env.PROXY;
    } else {
      process.env.PROXY = originalProxy;
    }
  });

  it('reports connected with the egress IP and country when PROXY is set', async () => {
    process.env.PROXY = 'http://gluetun:8888';
    mockFetch.mockResolvedValueOnce(jsonResponse({ ip: '203.0.113.7', country: 'NL' }));

    const result = await getVpnStatus();

    expect(result).toEqual({
      connected: true,
      ip: '203.0.113.7',
      country: 'NL',
      message: 'nordvpn connected',
    });
  });

  it('reports a direct connection when PROXY is unset', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ ip: '20.25.12.137', country: 'US' }));

    const result = await getVpnStatus();

    expect(result).toEqual({
      connected: false,
      ip: '20.25.12.137',
      country: 'US',
      message: 'direct connection',
    });
  });

  it('attaches the proxy dispatcher to the egress fetch when one is available', async () => {
    process.env.PROXY = 'http://gluetun:8888';
    const dispatcher = { dispatch: jest.fn() };
    mockGetProxyDispatcher.mockReturnValue(dispatcher);
    mockFetch.mockResolvedValueOnce(jsonResponse({ ip: '203.0.113.7', country: 'NL' }));

    await getVpnStatus();

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ dispatcher }),
    );
  });

  it('falls back to the secondary geo-IP service when the primary fails', async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse({}, false))
      .mockResolvedValueOnce(jsonResponse({ ip: '198.51.100.4', country_iso: 'DE' }));

    const result = await getVpnStatus();

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      connected: false,
      ip: '198.51.100.4',
      country: 'DE',
      message: 'direct connection',
    });
  });

  it('returns a null egress with the connected message when both lookups fail', async () => {
    process.env.PROXY = 'http://gluetun:8888';
    mockFetch.mockRejectedValue(new Error('network down'));

    const result = await getVpnStatus();

    expect(result).toEqual({
      connected: true,
      ip: null,
      country: null,
      message: 'nordvpn connected (egress IP unavailable)',
    });
  });

  it('returns a null egress with the direct message when disconnected and lookups fail', async () => {
    mockFetch.mockRejectedValue(new Error('network down'));

    const result = await getVpnStatus();

    expect(result).toEqual({
      connected: false,
      ip: null,
      country: null,
      message: 'direct connection',
    });
  });
});
