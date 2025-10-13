import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Generic pagination helper for Cloudflare API endpoints
 * @param makeRequest Function to make API requests
 * @param endpoint The API endpoint to paginate
 * @param perPage Number of items per page (max 100 for most endpoints)
 * @returns Promise resolving to all items from all pages
 */
export async function paginateCloudflareAPI(
  makeRequest: (url: string) => Promise<any>,
  endpoint: string,
  perPage: number = 50
): Promise<any[]> {
  const allItems: any[] = [];
  let page = 1;
  let hasMorePages = true;

  while (hasMorePages) {
    const url = `${endpoint}?page=${page}&per_page=${perPage}`;
    const response = await makeRequest(url);
    const items = response.result || [];
    
    if (items.length === 0) {
      hasMorePages = false;
    } else {
      allItems.push(...items);
      
      // Check if we have more pages
      const resultInfo = response.result_info;
      if (resultInfo && resultInfo.page < resultInfo.total_pages) {
        page++;
      } else {
        hasMorePages = false;
      }
    }
  }

  return allItems;
}
