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