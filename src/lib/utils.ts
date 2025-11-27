import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { toast } from "sonner"

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