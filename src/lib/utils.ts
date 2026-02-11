import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { toast } from "sonner"
import { differenceInCalendarDays, format, formatISO, isValid, parse, parseISO } from "date-fns"
import type { DNSRecord } from "@/types/cloudflare"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Copy text to clipboard with toast notification
 * @param text - Text to copy
 * @param successMessage - Optional custom success message (defaults to "Copied {text} to clipboard")
 * @param errorMessage - Optional custom error message (defaults to "Failed to copy to clipboard")
 */
export async function copyToClipboard(
  text: string,
  successMessage?: string,
  errorMessage: string = "Failed to copy to clipboard"
): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(successMessage || `Copied ${text} to clipboard`);
  } catch (error) {
    console.error("Failed to copy to clipboard:", error);
    toast.error(errorMessage);
  }
}

/**
 * Validates a domain name format
 * @param domain - Domain name to validate
 * @returns true if domain is valid, false otherwise
 */
export function validateDomain(domain: string): boolean {
  const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?(\.[a-zA-Z]{2,})+$/;
  return domainRegex.test(domain.trim());
}

/**
 * Validates an IP address format (IPv4)
 * @param ip - IP address to validate
 * @returns true if IP is valid, false otherwise
 */
export function validateIPAddress(ip: string): boolean {
  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
  return ipRegex.test(ip.trim());
}

/**
 * Parses bulk domain input (one per line) and returns valid domains
 * @param input - Multi-line string containing domain names
 * @returns Array of valid domain names
 */
export function parseBulkDomains(input: string): string[] {
  return input
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .filter(validateDomain);
}

/**
 * Returns all root-level A records for the provided domain.
 */
export function getRootARecordsFromDNS(records: DNSRecord[], domainName: string): DNSRecord[] {
  if (!records || records.length === 0) return [];
  return records.filter(
    (record) =>
      record.type === 'A' &&
      (record.name === domainName || record.name === '@' || record.name === '')
  );
}

/**
 * Processes items in parallel with controlled concurrency
 * @param items - Array of items to process
 * @param processor - Async function to process each item
 * @param concurrency - Maximum number of concurrent operations (default: 10)
 * @returns Promise that resolves when all items are processed
 */
export async function processInParallel<T, R>(
  items: T[],
  processor: (item: T, index: number) => Promise<R>,
  concurrency: number = 10
): Promise<R[]> {
  const results: (R | Error)[] = new Array(items.length);
  let index = 0;

  const executeNext = async (): Promise<void> => {
    while (index < items.length) {
      const currentIndex = index++;
      const item = items[currentIndex];

      try {
        const result = await processor(item, currentIndex);
        results[currentIndex] = result;
      } catch (error) {
        // Store error in results array
        results[currentIndex] = error as Error;
      }
    }
  };

  // Start concurrent workers
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => executeNext());

  // Wait for all workers to complete
  await Promise.all(workers);

  return results as R[];
}

type RateLimiterQueueItem = {
  task: () => Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
};

export type RateLimiterOptions = {
  capacity: number;
  refillIntervalMs: number;
  refillAmount?: number;
};

export type RateLimiter = {
  schedule<T>(task: () => Promise<T>): Promise<T>;
  pending: () => number;
};

/**
 * Token bucket rate limiter for paced async work (e.g., WHOIS/RDAP).
 * Allows an initial burst up to `capacity` and then refills tokens on the configured interval.
 */
export function createRateLimiter({
  capacity,
  refillIntervalMs,
  refillAmount = 1,
}: RateLimiterOptions): RateLimiter {
  const maxTokens = Math.max(1, capacity);
  const interval = Math.max(1, refillIntervalMs);
  const refill = Math.max(1, refillAmount);

  let tokens = maxTokens;
  let lastRefill = Date.now();
  const queue: RateLimiterQueueItem[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;

  const refillTokens = () => {
    const now = Date.now();
    const elapsed = now - lastRefill;
    if (elapsed < interval) return;

    const cycles = Math.floor(elapsed / interval);
    if (cycles <= 0) return;

    tokens = Math.min(maxTokens, tokens + cycles * refill);
    lastRefill += cycles * interval;
  };

  const processQueue = () => {
    refillTokens();

    while (tokens > 0 && queue.length > 0) {
      tokens -= 1;
      const entry = queue.shift();
      if (!entry) break;

      Promise.resolve()
        .then(entry.task)
        .then(entry.resolve, entry.reject)
        .finally(() => {
          if (queue.length > 0) {
            processQueue();
          }
        });
    }

    if (queue.length > 0 && !timer) {
      const elapsed = Date.now() - lastRefill;
      const delay = Math.max(interval - elapsed, 0) || interval;
      timer = setTimeout(() => {
        timer = null;
        processQueue();
      }, delay);
    }
  };

  const schedule = <T>(task: () => Promise<T>): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      queue.push({ task, resolve: resolve as (value: unknown) => void, reject });
      processQueue();
    });

  return {
    schedule,
    pending: () => queue.length,
  };
}

/**
 * Formats Cloudflare API errors into user-friendly messages
 * @param error - Error object from Cloudflare API
 * @returns User-friendly error message
 */
export function formatCloudflareError(error: unknown): string {
  // Check for rate limit errors first (highest priority)
  if (error && typeof error === 'object') {
    const errorObj = error as any;

    // Check if it's a rate limit error with retry-after information
    if (errorObj.isRateLimit || errorObj.status === 429) {
      if (errorObj.retryAfter) {
        const minutes = Math.ceil(errorObj.retryAfter / 60);
        return `Rate limit exceeded. Please try again in ${errorObj.retryAfter} seconds (${minutes} minute${minutes !== 1 ? 's' : ''})`;
      }
      return 'Rate limit exceeded. Please try again in a moment';
    }
  }

  // Handle Error objects with errorData property
  if (error && typeof error === 'object' && 'errorData' in error) {
    const errorData = (error as any).errorData;

    // Check if errorData has Cloudflare error structure
    if (errorData && typeof errorData === 'object') {
      // Handle Cloudflare API error format: {success: false, errors: [{code, message}]}
      if (Array.isArray(errorData.errors) && errorData.errors.length > 0) {
        const messages = errorData.errors
          .map((err: any) => err.message || err.code)
          .filter(Boolean);
        if (messages.length > 0) {
          return messages.join('. ');
        }
      }

      // Try to extract message from errorData directly
      if (errorData.message) {
        return errorData.message;
      }
    }
  }

  // Handle Error objects with message containing JSON
  if (error instanceof Error) {
    const message = error.message;

    // Try to parse JSON from error message
    const jsonMatch = message.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.errors && Array.isArray(parsed.errors) && parsed.errors.length > 0) {
          const messages = parsed.errors
            .map((err: any) => err.message || `Error code ${err.code}`)
            .filter(Boolean);
          if (messages.length > 0) {
            return messages.join('. ');
          }
        }
        if (parsed.message) {
          return parsed.message;
        }
      } catch {
        // If JSON parsing fails, continue to default handling
      }
    }

    // Check for common error patterns
    if (message.includes('already exists')) {
      return 'This domain already exists in Cloudflare';
    }
    if (message.includes('invalid') || message.includes('Invalid')) {
      return 'Invalid domain or configuration';
    }
    if (message.includes('authentication') || message.includes('unauthorized') || message.includes('401') || message.includes('403')) {
      return 'Authentication failed. Please check your API token';
    }
    if (message.includes('rate limit') || message.includes('429')) {
      // Check if error has retry-after information
      const errorObj = error as any;
      if (errorObj?.retryAfter) {
        const minutes = Math.ceil(errorObj.retryAfter / 60);
        return `Rate limit exceeded. Please try again in ${errorObj.retryAfter} seconds (${minutes} minute${minutes !== 1 ? 's' : ''})`;
      }
      return 'Rate limit exceeded. Please try again in a moment';
    }

    // Return the error message if it's not a raw API response
    if (!message.includes('API request failed') || !message.includes('JSON.stringify')) {
      return message;
    }
  }

  // Default fallback
  return 'An unexpected error occurred. Please try again';
}

const WHOIS_DATE_FORMATS = [
  "yyyy-MM-dd",
  "yyyy-MM-dd'T'HH:mm:ssXXX",
  "yyyy-MM-dd'T'HH:mm:ss'Z'",
  "yyyy/MM/dd",
  "yyyy.MM.dd",
  "dd-MMM-yyyy",
  "dd MMM yyyy",
  "MMM dd yyyy",
  "MMM dd, yyyy",
  "dd/MM/yyyy",
  "yyyyMMdd",
  "EEE MMM dd HH:mm:ss O yyyy",
];

/**
 * Normalize a WHOIS date string into an ISO 8601 string when possible.
 * Returns null if no valid date can be parsed.
 */
export function parseWhoisDate(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const value = raw.trim();
  if (!value) return null;

  // Try ISO parsing first
  const direct = parseISO(value);
  if (isValid(direct)) {
    return formatISO(direct);
  }

  // Try known WHOIS date formats
  for (const format of WHOIS_DATE_FORMATS) {
    const parsed = parse(value, format, new Date());
    if (isValid(parsed)) {
      return formatISO(parsed);
    }
  }

  // Fallback: Date constructor (best-effort)
  const fallback = new Date(value);
  if (isValid(fallback)) {
    return formatISO(fallback);
  }

  return null;
}

const EXPIRATION_DATE_FORMAT = "dd-MM-yyyy";

/**
 * Parse expiration date string (DD-MM-YYYY or YYYY-MM-DD) to Date.
 */
export function parseExpirationDate(str: string | undefined | null): Date | undefined {
  if (!str?.trim()) return undefined;
  const value = str.trim();
  const ddmmyyyy = parse(value, EXPIRATION_DATE_FORMAT, new Date());
  if (isValid(ddmmyyyy)) return ddmmyyyy;
  const iso = parseISO(value);
  return isValid(iso) ? iso : undefined;
}

/**
 * Format date as DD-MM-YYYY for expiration date storage.
 */
export function formatExpirationDate(date: Date): string {
  return format(date, EXPIRATION_DATE_FORMAT);
}

/**
 * Calculate days from now until the provided ISO date.
 * Returns null when the date is invalid.
 */

/**
 * Get consistent color classes for account categories
 * Used across badges, dropdowns, and other UI elements
 */
export function getCategoryColorClasses(category: string): {
  badge: string;
  text: string;
  icon: string;
} {
  switch (category) {
    case 'cloudflare':
      return {
        badge: 'bg-orange-100 text-orange-800 hover:bg-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:hover:bg-orange-900',
        text: 'text-orange-800 dark:text-orange-400',
        icon: 'text-orange-600 dark:text-orange-400',
      };
    case 'registrar':
      return {
        badge: 'bg-purple-100 text-purple-800 hover:bg-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:hover:bg-purple-900',
        text: 'text-purple-800 dark:text-purple-400',
        icon: 'text-purple-600 dark:text-purple-400',
      };
    case 'proxy':
      return {
        badge: 'bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-950 dark:text-green-300 dark:hover:bg-green-900',
        text: 'text-green-800 dark:text-green-400',
        icon: 'text-green-600 dark:text-green-400',
      };
    case 'ssh':
      return {
        badge: 'bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:hover:bg-blue-900',
        text: 'text-blue-800 dark:text-blue-400',
        icon: 'text-blue-600 dark:text-blue-400',
      };
    case 'vps':
      return {
        badge: 'bg-indigo-100 text-indigo-800 hover:bg-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:hover:bg-indigo-900',
        text: 'text-indigo-800 dark:text-indigo-400',
        icon: 'text-indigo-600 dark:text-indigo-400',
      };
    case 'npm':
      return {
        badge: 'bg-cyan-100 text-cyan-800 hover:bg-cyan-200 dark:bg-cyan-950 dark:text-cyan-300 dark:hover:bg-cyan-900',
        text: 'text-cyan-800 dark:text-cyan-400',
        icon: 'text-cyan-600 dark:text-cyan-400',
      };
    default:
      return {
        badge: 'bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700',
        text: 'text-gray-800 dark:text-gray-400',
        icon: 'text-gray-600 dark:text-gray-400',
      };
  }
}

/**
 * Get consistent display label for account categories
 * Used across tables, modals, and badges
 */
export function getCategoryLabel(category: string, registrarName?: string): string {
  // Special case for registrar with specific provider name
  if (category === 'registrar' && registrarName) {
    return registrarName.charAt(0).toUpperCase() + registrarName.slice(1);
  }

  const labels: Record<string, string> = {
    cloudflare: 'Cloudflare',
    registrar: 'Registrar',
    proxy: 'Proxy',
    ssh: 'SSH Monitoring',
    vps: 'Server Registrars',
    npm: 'NPM',
  };

  return labels[category] || category.charAt(0).toUpperCase() + category.slice(1);
}