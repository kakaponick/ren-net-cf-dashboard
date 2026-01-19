import { NextRequest, NextResponse } from 'next/server';
import { SocksProxyAgent } from 'socks-proxy-agent';

interface ProxyConfig {
	host: string;
	port: string;
	username?: string;
	password?: string;
}

function createProxyAgent(config: ProxyConfig): SocksProxyAgent {
	const proxyUrl = new URL(`socks5://${config.host}:${config.port}`);
	if (config.username) proxyUrl.username = config.username;
	if (config.password) proxyUrl.password = config.password;
	return new SocksProxyAgent(proxyUrl.toString());
}

function extractProxyHeaders(request: NextRequest) {
	const proxyHost = request.headers.get('x-proxy-host');
	const proxyPort = request.headers.get('x-proxy-port');
	const proxyUsername = request.headers.get('x-proxy-username');
	const proxyPassword = request.headers.get('x-proxy-password');

	if (!proxyHost) {
		return null;
	}

	return {
		proxyHost,
		proxyPort,
		proxyUsername,
		proxyPassword,
	};
}

async function testProxyConnection(proxyAgent: SocksProxyAgent) {
	try {
		// Try multiple IP detection services in case one fails
		const ipServices = [
			'https://api.ipify.org',
			'https://icanhazip.com',
			'https://httpbin.org/ip',
			'http://ifconfig.me/ip'
		];

		let lastError: Error | null = null;

		for (const serviceUrl of ipServices) {
			try {
				const response = await fetch(serviceUrl, {
					method: 'GET',
					headers: {
						'User-Agent': 'curl/7.68.0',
						'Accept': 'text/plain, */*'
					},
					agent: proxyAgent, // Always use the proxy agent
					timeout: 10000 // 10 second timeout
				} as RequestInit & { agent?: any; timeout?: number });

				if (!response.ok) {
					throw new Error(`HTTP ${response.status}: ${response.statusText}`);
				}

				let ip: string;
				const contentType = response.headers.get('content-type');

				if (contentType?.includes('application/json')) {
					const data = await response.json();
					ip = data.ip || data.origin || JSON.stringify(data);
				} else {
					ip = await response.text();
				}

				ip = ip.trim();

				// Validate that we got an IP address
				const ipRegex = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
				if (!ipRegex.test(ip)) {
					throw new Error(`Invalid IP format received: ${ip}`);
				}

				return { success: true, ip };
			} catch (error) {
				lastError = error instanceof Error ? error : new Error('Unknown error');
				continue;
			}
		}

		// If all services failed, return the last error
		return {
			success: false,
			error: lastError?.message || 'All IP detection services failed'
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Unknown error'
		};
	}
}

export async function GET(request: NextRequest) {
	try {
		const proxyHeaders = extractProxyHeaders(request);
		if (!proxyHeaders) {
			return NextResponse.json({
				success: false,
				error: 'Missing required header: x-proxy-host'
			}, { status: 400 });
		}

		const { proxyHost, proxyPort, proxyUsername, proxyPassword } = proxyHeaders;

		const proxyAgent = createProxyAgent({
			host: proxyHost,
			port: proxyPort || '1080',
			username: proxyUsername || undefined,
			password: proxyPassword || undefined
		});

		const result = await testProxyConnection(proxyAgent);

		return NextResponse.json(result);

	} catch (error) {
		return NextResponse.json({
			success: false,
			error: error instanceof Error ? error.message : 'Unknown error'
		}, { status: 500 });
	}
}