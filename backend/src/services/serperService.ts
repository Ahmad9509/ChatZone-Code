// Serper.dev Web Search Service
// Used for Pro Replies feature
import axios from 'axios';

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

/**
 * Perform web search using Serper.dev
 * @param query - Search query string
 * @param numResults - Number of results to fetch (minimum 5, maximum 100)
 */
export const searchWeb = async (query: string, numResults: number = 5): Promise<SearchResult[]> => {
  try {
    // Ensure minimum 5 results, cap at 100 (Serper API limit)
    const num = Math.max(5, Math.min(100, numResults));
    
    const response = await axios.post(
      'https://google.serper.dev/search',
      {
        q: query,
        num,
      },
      {
        headers: {
          'X-API-KEY': process.env.SERPER_API_KEY!,
          'Content-Type': 'application/json',
        },
      }
    );

    const results: SearchResult[] = response.data.organic?.map((result: any) => ({
      title: result.title,
      url: result.link,
      snippet: result.snippet || '',
    })) || [];

    return results;
  } catch (error) {
    throw new Error(`Serper search failed: ${error}`);
  }
};

