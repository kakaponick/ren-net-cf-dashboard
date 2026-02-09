/**
 * Generate a random slug for redirect locations
 * Format: 6 characters, alphanumeric (case-sensitive)
 */
export function generateSlug(length: number = 6): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let slug = '';
    for (let i = 0; i < length; i++) {
        slug += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return slug;
}

/**
 * Check if a slug is unique among existing locations
 */
export function isSlugUnique(slug: string, existingLocations: string[]): boolean {
    return !existingLocations.includes(`/${slug}`);
}

/**
 * Generate a unique slug that doesn't conflict with existing locations
 */
export function generateUniqueSlug(existingLocations: string[], length: number = 6): string {
    let slug = generateSlug(length);
    let attempts = 0;
    const maxAttempts = 100;

    while (!isSlugUnique(slug, existingLocations) && attempts < maxAttempts) {
        slug = generateSlug(length);
        attempts++;
    }

    if (attempts >= maxAttempts) {
        // If we can't find a unique slug, increase length
        return generateUniqueSlug(existingLocations, length + 1);
    }

    return slug;
}
