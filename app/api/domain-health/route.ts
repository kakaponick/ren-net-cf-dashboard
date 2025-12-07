import { NextRequest, NextResponse } from 'next/server';
import type { DomainHealthResult, DomainHTTPHealth, DomainWhoisHealth, HealthStatus } from '@/types/domain-health';
import { getDaysToExpiration, parseWhoisDate, validateDomain } from '@/lib/utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HTTP_TIMEOUT_MS = 7000;
const RDAP_TIMEOUT_MS = 7000;
const RDAP_MAX_RETRIES = 2;
const RETRY_BASE_MS = 1000;
const IANA_BOOTSTRAP_URL = 'https://data.iana.org/rdap/dns.json';
let cachedIanaBootstrap: Record<string, string[]> | null = null;
let cachedIanaFetchedAt = 0;
const BOOTSTRAP_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

export async function GET(request: NextRequest) {
		const domain = request.nextUrl.searchParams.get('domain')?.trim().toLowerCase();

		if (!domain || !validateDomain(domain)) {
				return NextResponse.json({ error: 'Please provide a valid domain' }, { status: 400 });
		}

		try {
				const health = await checkDomainHealth(domain);
				return NextResponse.json(health);
		} catch (error) {
				console.error('Domain health check failed:', error);
				const message = error instanceof Error ? error.message : 'Health check failed';
				return NextResponse.json({ error: message }, { status: 500 });
		}
}

async function checkDomainHealth(domain: string): Promise<DomainHealthResult> {
		const [httpHealth, whoisHealth] = await Promise.all([
				checkHTTP(domain),
				checkWhois(domain)
		]);

		const status = combineStatus([httpHealth.status, whoisHealth.status]);

		return {
				domain,
				status,
				checkedAt: new Date().toISOString(),
				http: httpHealth,
				whois: whoisHealth
		};
}

async function checkHTTP(domain: string): Promise<DomainHTTPHealth> {
		const httpsUrl = `https://${domain}`;
		const httpUrl = `http://${domain}`;

		let response: Response | null = null;
		let usedUrl = httpsUrl;
		let error: string | undefined;
		let latencyMs: number | undefined;

		try {
				const start = Date.now();
				response = await fetchWithTimeout(httpsUrl, HTTP_TIMEOUT_MS, { method: 'HEAD', redirect: 'follow' });
				latencyMs = Date.now() - start;
		} catch (err) {
				error = err instanceof Error ? err.message : 'HTTPS check failed';
		}

		if (!response) {
				try {
						const start = Date.now();
						response = await fetchWithTimeout(httpUrl, HTTP_TIMEOUT_MS, { method: 'HEAD', redirect: 'follow' });
						latencyMs = Date.now() - start;
						usedUrl = httpUrl;
						error = undefined;
				} catch (fallbackError) {
						error = fallbackError instanceof Error ? fallbackError.message : 'HTTP check failed';
				}
		}

		const reachable = Boolean(response);
		const statusCode = response?.status;

		let status: HealthStatus = 'healthy';
		if (!reachable) {
				status = 'error';
		} else if (statusCode && statusCode >= 400 && statusCode < 600) {
				status = 'warning';
		}

		return {
				status,
				reachable,
				statusCode,
				urlTried: usedUrl,
				latencyMs,
				error
		};
}

async function checkWhois(domain: string): Promise<DomainWhoisHealth> {
		try {
				const rdapResponse = await fetchRdap(domain);

				if (!rdapResponse.ok) {
						const statusText = rdapResponse.statusText || 'Unknown error';
						return {
								status: 'warning',
								message: `WHOIS service unavailable (${rdapResponse.status} ${statusText})`,
								error: statusText,
						};
				}

				const rawBody = await rdapResponse.text();

				let data: any = {};
				try {
						data = rawBody ? JSON.parse(rawBody) : {};
				} catch {
						return {
								status: 'warning',
								message: 'WHOIS data could not be parsed',
								error: 'WHOIS response was not JSON',
						};
				}

				const events = Array.isArray(data?.events) ? data.events : [];
				const expirationRaw = getEventDate(events, ['expiration', 'expiry']);
				const createdRaw = getEventDate(events, ['registration', 'registered']);
				const updatedRaw = getEventDate(events, ['last changed', 'last update', 'last updated', 'updated']);

				const expirationDate = parseWhoisDate(expirationRaw) || undefined;
				const createdDate = parseWhoisDate(createdRaw) || undefined;
				const updatedDate = parseWhoisDate(updatedRaw) || undefined;

				const daysToExpireValue = getDaysToExpiration(expirationDate);
				const daysToExpire = daysToExpireValue ?? undefined;

				const registrar = extractRegistrar(data);

				let status: HealthStatus = 'healthy';
				let message: string | undefined;

				if (!expirationDate) {
						status = 'warning';
						message = 'Expiration date unavailable';
				} else if (typeof daysToExpire === 'number') {
						if (daysToExpire < 0) {
								status = 'error';
								message = 'Domain appears expired';
						} else if (daysToExpire <= 30) {
								status = 'warning';
								message = `Expires in ${daysToExpire} day${daysToExpire === 1 ? '' : 's'}`;
						}
				}

				return {
						status,
						registrar,
						expirationDate,
						createdDate,
						updatedDate,
						daysToExpire,
						message
				};
		} catch (error) {
				const message = error instanceof Error ? error.message : 'WHOIS lookup failed';
				return {
						status: 'warning',
						message,
						error: message
				};
		}
}

async function fetchWithTimeout(url: string, timeoutMs: number, options: RequestInit = {}) {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), timeoutMs);

		try {
				const response = await fetch(url, {
						...options,
						signal: controller.signal,
						cache: 'no-store'
				});
				return response;
		} catch (error) {
				// Normalize AbortError into a timeout signal we can retry on
				if (error instanceof DOMException && error.name === 'AbortError') {
						const timeoutError = new Error('Request timed out');
						(timeoutError as any).isTimeout = true;
						throw timeoutError;
				}
				throw error;
		} finally {
				clearTimeout(timer);
		}
}

async function fetchWithRetries(
		url: string,
		{
				timeoutMs,
				retries = 0,
		}: { timeoutMs: number; retries?: number }
): Promise<Response> {
		let attempt = 0;
		let lastError: unknown;

		while (attempt <= retries) {
				try {
						const response = await fetchWithTimeout(url, timeoutMs);
						if (response.status === 429 && attempt < retries) {
								const retryAfterHeader = response.headers.get('retry-after');
								const retryAfterSeconds = retryAfterHeader ? parseInt(retryAfterHeader, 10) || 1 : 1;
								const backoff = RETRY_BASE_MS * Math.pow(2, attempt) + retryAfterSeconds * 1000;
								await new Promise((resolve) => setTimeout(resolve, backoff));
								attempt++;
								continue;
						}
						return response;
				} catch (error) {
						lastError = error;
						const isTimeout = (error as any)?.isTimeout;
						if (attempt >= retries || (!isTimeout && (error as any)?.status !== 429)) break;
						const backoff = RETRY_BASE_MS * Math.pow(2, attempt);
						await new Promise((resolve) => setTimeout(resolve, backoff));
						attempt++;
				}
		}

		const message =
				lastError instanceof Error
						? lastError.message
						: 'Request failed after retries';
		const finalError = new Error(message);
		(finalError as any).cause = lastError;
		throw finalError;
}

async function fetchRdap(domain: string): Promise<Response> {
		// Try rdap.org first with retries
		const rdapOrgUrl = `https://rdap.org/domain/${encodeURIComponent(domain)}`;
		let lastResponse: Response | null = null;
		try {
				const resp = await fetchWithRetries(rdapOrgUrl, { timeoutMs: RDAP_TIMEOUT_MS, retries: RDAP_MAX_RETRIES });
				if (resp.ok) return resp;
				lastResponse = resp;
		} catch (error) {
				console.warn('rdap.org lookup failed, trying bootstrap:', error);
		}

		// Bootstrap fallback: try all available servers for TLD
		const servers = await getBootstrapServers(domain);
		for (const server of servers) {
				const serverUrl = `${server.replace(/\/$/, '')}/domain/${encodeURIComponent(domain)}`;
				try {
						const resp = await fetchWithTimeout(serverUrl, RDAP_TIMEOUT_MS);
						if (resp.ok) return resp;
						lastResponse = resp;
				} catch (error) {
						console.warn(`Bootstrap RDAP lookup failed (${serverUrl}):`, error);
				}
		}

		// Final attempt: return the last response (may be error/404)
		if (lastResponse) return lastResponse;
		return await fetchWithTimeout(rdapOrgUrl, RDAP_TIMEOUT_MS);
}

async function getBootstrapServers(domain: string): Promise<string[]> {
		const tld = domain.split('.').pop();
		if (!tld) return [];

		const now = Date.now();
		if (!cachedIanaBootstrap || now - cachedIanaFetchedAt > BOOTSTRAP_TTL_MS) {
				try {
						const resp = await fetchWithTimeout(IANA_BOOTSTRAP_URL, 5000);
						const body = await resp.json();
						const services: Array<[string[], string[]]> = body?.services || [];
						const map: Record<string, string[]> = {};
						services.forEach(([tlds, servers]) => {
								tlds.forEach((code) => {
										map[code.toLowerCase()] = servers;
								});
						});
						cachedIanaBootstrap = map;
						cachedIanaFetchedAt = now;
				} catch (error) {
						console.warn('Failed to fetch IANA bootstrap data:', error);
						return [];
				}
		}

		return cachedIanaBootstrap?.[tld.toLowerCase()] || [];
}

function combineStatus(statuses: HealthStatus[]): HealthStatus {
		if (statuses.includes('error')) return 'error';
		if (statuses.includes('warning')) return 'warning';
		return 'healthy';
}

function getEventDate(events: any[], names: string[]): string | undefined {
		const lowerNames = names.map((name) => name.toLowerCase());
		const event = events.find(
				(evt: any) =>
						typeof evt?.eventAction === 'string' &&
						lowerNames.some((name) => evt.eventAction.toLowerCase().includes(name))
		);
		return event?.eventDate;
}

function extractRegistrar(data: any): string | undefined {
		const entities = Array.isArray(data?.entities) ? data.entities : [];
		const registrarEntity = entities.find(
				(entity: any) => Array.isArray(entity.roles) && entity.roles.some((role: string) => role.toLowerCase() === 'registrar')
		);

		// RDAP vCard extraction
		const vcard = registrarEntity?.vcardArray?.[1];
		if (Array.isArray(vcard)) {
				const fnEntry = vcard.find((entry: any) => entry?.[0] === 'fn');
				if (fnEntry && typeof fnEntry[3] === 'string') {
						return fnEntry[3];
				}
		}

		// Common registrar fields fallback
		if (typeof data?.registrar === 'string') {
				return data.registrar;
		}
		if (typeof data?.registrarName === 'string') {
				return data.registrarName;
		}

		return undefined;
}

