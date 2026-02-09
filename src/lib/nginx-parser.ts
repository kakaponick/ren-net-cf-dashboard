import type { NPMRedirectListResponse, ParsedNginxLocation } from '@/types/npm';

export interface DomainDuplicates {
    domain: string;
    duplicates: string[]; // array of duplicate location paths
}

export interface ParseResult {
    locations: ParsedNginxLocation[];
    domainDuplicates: DomainDuplicates[]; // duplicates per domain
}

/**
 * Parse nginx location redirects from advanced_config
 * Example: location = /QEUFzx { return 301 https://gammbly.com/b?f=zerkalos_apks_slotys_casinose&t=lex; }
 * Checks for duplicate locations WITHIN each domain individually
 * Now includes ALL locations (including duplicates) with isDuplicate flag
 */
export function parseNginxLocations(redirects: NPMRedirectListResponse[]): ParseResult {
    const allLocations: ParsedNginxLocation[] = [];
    const domainDuplicates: DomainDuplicates[] = [];

    redirects.forEach((redirect) => {
        if (!redirect.advanced_config) return;

        // Extract all domains for this redirect
        const sourceDomains = redirect.domain_names;
        if (sourceDomains.length === 0) return;

        // For each domain in this redirect, check for duplicates within that domain
        sourceDomains.forEach((domain) => {
            const locationsInThisDomain = new Map<string, number>(); // location -> count
            const parsedForDomain: ParsedNginxLocation[] = [];

            // Regex to match: location = /path { return 301 https://destination; }
            // Capture groups: 1=location path, 2=status code, 3=destination URL
            const locationRegex = /location\s*=\s*(\/[^\s{]+)\s*{\s*return\s+(\d+)\s+(https?:\/\/[^;]+);/g;

            // Reset regex lastIndex for each domain
            locationRegex.lastIndex = 0;

            let match;
            while ((match = locationRegex.exec(redirect.advanced_config!)) !== null) {
                const location = match[1]; // e.g., "/QEUFzx"
                const destination = match[3]; // e.g., "https://gammbly.com/b?f=..."

                // Track all occurrences
                const count = locationsInThisDomain.get(location) || 0;
                locationsInThisDomain.set(location, count + 1);

                // Add ALL locations to the parsed list (including duplicates)
                parsedForDomain.push({
                    location,
                    destination,
                    sourceDomain: domain,
                    isDuplicate: false, // Will be set to true after counting
                });
            }

            // Now mark duplicates and track them
            const duplicatesInThisDomain: string[] = [];

            parsedForDomain.forEach((loc) => {
                const count = locationsInThisDomain.get(loc.location) || 0;
                if (count > 1) {
                    loc.isDuplicate = true;
                    if (!duplicatesInThisDomain.includes(loc.location)) {
                        duplicatesInThisDomain.push(loc.location);
                    }
                }
            });

            // Add all locations (including duplicates) to global list
            allLocations.push(...parsedForDomain);

            // If this domain has duplicates, record them
            if (duplicatesInThisDomain.length > 0) {
                domainDuplicates.push({
                    domain,
                    duplicates: duplicatesInThisDomain,
                });
            }
        });
    });

    // Sort locations by location path
    const sortedLocations = allLocations.sort((a, b) =>
        a.location.localeCompare(b.location)
    );

    return {
        locations: sortedLocations,
        domainDuplicates,
    };
}
