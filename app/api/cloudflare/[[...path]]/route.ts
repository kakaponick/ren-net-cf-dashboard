import { NextRequest, NextResponse } from 'next/server';

export async function GET(
		request: NextRequest,
		{ params }: { params: Promise<{ path?: string[] }> }
) {
		return handleCloudflareProxy(request, await params);
}

export async function POST(
		request: NextRequest,
		{ params }: { params: Promise<{ path?: string[] }> }
) {
		return handleCloudflareProxy(request, await params);
}

export async function PATCH(
		request: NextRequest,
		{ params }: { params: Promise<{ path?: string[] }> }
) {
		return handleCloudflareProxy(request, await params);
}

export async function PUT(
		request: NextRequest,
		{ params }: { params: Promise<{ path?: string[] }> }
) {
		return handleCloudflareProxy(request, await params);
}

export async function DELETE(
		request: NextRequest,
		{ params }: { params: Promise<{ path?: string[] }> }
) {
		return handleCloudflareProxy(request, await params);
}

async function handleCloudflareProxy(
		request: NextRequest,
		params: { path?: string[] }
) {
		try {
				const cloudflareApiPath = params.path ? `/${params.path.join('/')}` : '';
				
				// Build URL with query parameters
				const url = new URL(`https://api.cloudflare.com/client/v4${cloudflareApiPath}`);
				request.nextUrl.searchParams.forEach((value, key) => {
						url.searchParams.append(key, value);
				});
				
				const cloudflareUrl = url.toString();
				const method = request.method;
				const authHeader = request.headers.get('authorization');

				const fetchOptions: RequestInit = {
						method,
						headers: {
								'Content-Type': 'application/json',
								'Authorization': authHeader || '',
						},
				};

				if (['POST', 'PATCH', 'PUT'].includes(method)) {
						const body = await request.json();
						fetchOptions.body = JSON.stringify(body);
				}

				const response = await fetch(cloudflareUrl, fetchOptions);
				const data = await response.json();

				if (response.ok) {
						console.log(`✅ Success: ${response.status}`);
				} else {
						console.log(`❌ Error: ${response.status}`, data.errors?.[0]?.message || '');
				}

				return NextResponse.json(data, { status: response.status });
		} catch (error) {
				console.error('Proxy error:', error);
				return NextResponse.json(
						{
								success: false,
								errors: [{ message: 'Internal server error' }],
						},
						{ status: 500 }
				);
		}
}

