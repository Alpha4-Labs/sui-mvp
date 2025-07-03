// Simple request cache to avoid duplicate API calls
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  requests: number;
  size: number;
  lastFetchTime: number;
}

class RequestCache {
  private cache = new Map<string, CacheEntry<any>>();
  private stats = {
    hits: 0,
    misses: 0,
    requests: 0,
    lastFetchTime: 0,
  };

  set<T>(key: string, data: T, ttlMs: number = 5000): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlMs,
    });
  }

  get<T>(key: string): T | null {
    this.stats.requests++;
    
    const entry = this.cache.get(key);
    if (!entry) {
      this.stats.misses++;
      return null;
    }

    const isExpired = Date.now() - entry.timestamp > entry.ttl;
    if (isExpired) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    this.stats.hits++;
    return entry.data;
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
    this.stats = {
      hits: 0,
      misses: 0,
      requests: 0,
      lastFetchTime: 0,
    };
  }

  getStats(): CacheStats {
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      requests: this.stats.requests,
      size: this.cache.size,
      lastFetchTime: this.stats.lastFetchTime,
    };
  }

  async getOrFetch<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttlMs: number = 5000
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached) {
      return cached;
    }

    const fetchStart = Date.now();
    const data = await fetchFn();
    this.stats.lastFetchTime = Date.now() - fetchStart;
    
    this.set(key, data, ttlMs);
    return data;
  }
}

export const requestCache = new RequestCache(); 