/**
 * Parse URL query parameters from destination URLs
 */
export interface URLParameterValues {
    paramName: string;
    values: string[];
}

/**
 * Extract all unique query parameter values from an array of URLs
 */
export function extractURLParameters(urls: string[]): URLParameterValues[] {
    const paramMap = new Map<string, Set<string>>();

    urls.forEach(url => {
        try {
            const urlObj = new URL(url);
            urlObj.searchParams.forEach((value, key) => {
                if (!paramMap.has(key)) {
                    paramMap.set(key, new Set());
                }
                paramMap.get(key)!.add(value);
            });
        } catch {
            // Invalid URL, skip
        }
    });

    // Convert to array format
    const result: URLParameterValues[] = [];
    paramMap.forEach((values, paramName) => {
        result.push({
            paramName,
            values: Array.from(values).sort(),
        });
    });

    // Sort by parameter name
    return result.sort((a, b) => a.paramName.localeCompare(b.paramName));
}

/**
 * Check if URL matches the given parameter filters
 */
export function matchesURLFilters(
    url: string,
    filters: Record<string, string>
): boolean {
    try {
        const urlObj = new URL(url);

        for (const [param, value] of Object.entries(filters)) {
            if (value === 'all') continue;

            const urlValue = urlObj.searchParams.get(param);
            if (urlValue !== value) {
                return false;
            }
        }

        return true;
    } catch {
        return false;
    }
}
