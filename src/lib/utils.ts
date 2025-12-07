import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { toast } from "sonner"
import { differenceInCalendarDays, formatISO, isValid, parse, parseISO } from "date-fns"

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
      queue.push({ task, resolve, reject });
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

/**
 * Calculate days from now until the provided ISO date.
 * Returns null when the date is invalid.
 */
export function getDaysToExpiration(dateIso: string | undefined | null): number | null {
  if (!dateIso) return null;
  const target = parseISO(dateIso);
  if (!isValid(target)) return null;
  return differenceInCalendarDays(target, new Date());
}