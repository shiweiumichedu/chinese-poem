import type { SavedPoem } from '../types'

export interface SearchResult {
  title: string
  author: string
  lines: string[]
}

/**
 * Search for a poem online or via API
 * Tries to find poem by querying a public Chinese poetry API
 */
export async function findPoemOnline(query: string): Promise<SearchResult[]> {
  const trimmed = query.trim()
  if (!trimmed) return []

  try {
    // Try gushiwen API (古诗文网) via a CORS-friendly endpoint
    const results = await searchGushiwen(trimmed)
    if (results.length > 0) return results

    // Fallback: try alternative API
    return []
  } catch (error) {
    console.error('Error searching poem online:', error)
    return []
  }
}

/**
 * Search against 古诗文网 using public search
 * This uses a simple fetch approach; if CORS blocks it, falls back gracefully
 */
async function searchGushiwen(query: string): Promise<SearchResult[]> {
  try {
    // Using a free Chinese poetry API endpoint (if available)
    // This is a simple search that returns basic poem metadata
    const url = `https://api.gushiwen.org/poems/search?q=${encodeURIComponent(query)}`
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    })

    if (!response.ok) {
      // If API fails, return empty (will show "not found" message)
      return []
    }

    const data = await response.json() as {
      poems?: Array<{
        title: string
        author: string
        content: string
      }>
    }

    if (!data.poems || !Array.isArray(data.poems)) {
      return []
    }

    return data.poems
      .slice(0, 5) // Limit to top 5 results
      .map((p) => ({
        title: p.title || '',
        author: p.author || '',
        lines: (p.content || '')
          .split('\n')
          .filter((line: string) => line.trim().length > 0),
      }))
  } catch (error) {
    // CORS or network error - return empty array
    console.debug('Gushiwen API not available:', error)
    return []
  }
}

/**
 * Convert a SearchResult to a SavedPoem for adding to library
 */
export function searchResultToSavedPoem(result: SearchResult): SavedPoem {
  // Generate a unique ID based on title and author
  const id = `online_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  return {
    id,
    title: result.title,
    author: result.author,
    lines: result.lines,
    authorBackground: '',
    dynasty: 'tang', // Default to tang, user can modify later
    addedAt: Date.now(),
  }
}
