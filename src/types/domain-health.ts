export type HealthStatus = 'healthy' | 'warning' | 'error';

export interface DomainHTTPHealth {
	status: HealthStatus;
	reachable: boolean;
	statusCode?: number;
	urlTried: string;
	latencyMs?: number;
	error?: string;
}

export interface DomainWhoisHealth {
	status: HealthStatus;
	registrar?: string;
	expirationDate?: string;
	createdDate?: string;
	updatedDate?: string;
	daysToExpire?: number;
	message?: string;
	error?: string;
}

export interface DomainHealthResult {
	domain: string;
	status: HealthStatus;
	checkedAt: string;
	http: DomainHTTPHealth;
	whois: DomainWhoisHealth;
}

