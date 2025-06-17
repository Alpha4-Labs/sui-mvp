const COINGECKO_API = 'https://api.coingecko.com/api/v3';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

let priceCache: {
  price: number;
  timestamp: number;
} | null = null;

export async function getSuiPrice(): Promise<number> {
  // Return cached price if it's still valid
  if (priceCache && Date.now() - priceCache.timestamp < CACHE_DURATION) {
    return priceCache.price;
  }

  try {
    const response = await fetch(
      `${COINGECKO_API}/simple/price?ids=sui&vs_currencies=usd`
    );
    
    if (!response.ok) {
      throw new Error(`Failed to fetch SUI price: ${response.statusText}`);
    }

    const data = await response.json();
    const price = data.sui.usd;

    // Update cache
    priceCache = {
      price,
      timestamp: Date.now()
    };

    return price;
  } catch (error) {
    console.error('Error fetching SUI price:', error);
    
    // Return cached price if available, even if expired
    if (priceCache) {
      console.warn('Using expired cached price due to fetch error');
      return priceCache.price;
    }
    
    throw error;
  }
} 