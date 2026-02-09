/**
 * Extract and format nginx configuration errors
 */
export function extractNginxError(error: unknown): string | null {
    if (!error) return null;

    // Check if error object has nginxError property directly (from our API wrapper)
    if (typeof error === 'object' && 'nginxError' in error) {
        return (error as any).nginxError as string;
    }

    // Check if error response has nginx_err in meta
    if (typeof error === 'object' && 'meta' in error) {
        const meta = (error as any).meta;
        if (meta && typeof meta === 'object' && 'nginx_err' in meta) {
            return meta.nginx_err as string;
        }
    }

    // Check if error message contains nginx error
    if (error instanceof Error && error.message) {
        try {
            const parsed = JSON.parse(error.message);
            if (parsed.meta?.nginx_err) {
                return parsed.meta.nginx_err;
            }
        } catch {
            // Not JSON, ignore
        }
    }

    return null;
}

/**
 * Format nginx error for display
 */
export function formatNginxError(nginxErr: unknown): { title: string; description: string } {
    if (typeof nginxErr !== 'string' || !nginxErr) {
        return {
            title: 'Nginx Error',
            description: 'An unknown Nginx configuration error occurred.',
        };
    }

    const lines = nginxErr.split('\n').filter(line => line.trim());

    // Try to parse the first line for the main error
    const firstLine = lines[0] || '';

    // Extract error type (emerg, crit, alert, etc.)
    const typeMatch = firstLine.match(/\[(emerg|crit|alert|error|warn)\]/i);
    const errorType = typeMatch ? typeMatch[1].toUpperCase() : 'ERROR';

    // Extract the error message
    let errorMessage = firstLine.replace(/nginx:\s*\[.*?\]\s*/, '').trim();

    // Extract file and line number if present
    const fileMatch = firstLine.match(/in (.+?):(\d+)/);
    let location = '';
    if (fileMatch) {
        const filename = fileMatch[1].split('/').pop(); // Get just the filename
        location = ` (${filename}:${fileMatch[2]})`;
        // Remove file path from error message
        errorMessage = errorMessage.replace(/\s+in\s+.+?:\d+/, '');
    }

    // Check for common error patterns to provide user-friendly messages
    if (errorMessage.includes('duplicate location')) {
        const match = errorMessage.match(/duplicate location "(.+?)"/);
        const locationPath = match ? match[1] : null;

        return {
            title: 'Duplicate Location Path',
            description: locationPath
                ? `The path "${locationPath}" already exists in this host configuration. Please use a unique path.`
                : 'A duplicate location path was detected. Please ensure all locations are unique.',
        };
    }

    if (errorMessage.includes('directive') && errorMessage.includes('is not allowed here')) {
        const match = errorMessage.match(/directive "(.+?)"/);
        const directive = match ? match[1] : 'unknown';
        return {
            title: 'Invalid Configuration',
            description: `The directive "${directive}" is not allowed in this context.`,
        };
    }

    // Default formatting for other errors
    return {
        title: `Nginx Configuration Error`,
        description: errorMessage || nginxErr,
    };
}
