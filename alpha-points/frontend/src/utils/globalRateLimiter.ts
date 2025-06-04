/**
 * Global Rate Limiter for All RPC Requests
 * 
 * This ensures that all components across the application
 * respect rate limits and don't overwhelm the RPC endpoint
 */

class GlobalRateLimiter {
  private static instance: GlobalRateLimiter;
  private lastRequestTime = 0;
  private requestQueue: Array<() => void> = [];
  private isProcessing = false;
  
  // Configuration
  private readonly MIN_INTERVAL = 100; // 100ms between requests (10 RPS max)
  private readonly BATCH_DELAY = 50; // 50ms delay for batched requests
  private readonly MAX_QUEUE_SIZE = 100; // Prevent memory issues
  
  private constructor() {}
  
  static getInstance(): GlobalRateLimiter {
    if (!GlobalRateLimiter.instance) {
      GlobalRateLimiter.instance = new GlobalRateLimiter();
    }
    return GlobalRateLimiter.instance;
  }
  
  /**
   * Throttle a single request
   */
  async throttle(): Promise<void> {
    return new Promise((resolve) => {
      // If queue is too full, reject older requests
      if (this.requestQueue.length >= this.MAX_QUEUE_SIZE) {
        console.warn('🚦 Rate limiter queue full, dropping oldest requests');
        this.requestQueue.splice(0, 10); // Remove 10 oldest requests
      }
      
      this.requestQueue.push(resolve);
      this.processQueue();
    });
  }
  
  /**
   * Process the request queue with proper timing
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.requestQueue.length === 0) {
      return;
    }
    
    this.isProcessing = true;
    
    while (this.requestQueue.length > 0) {
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;
      
      if (timeSinceLastRequest < this.MIN_INTERVAL) {
        const waitTime = this.MIN_INTERVAL - timeSinceLastRequest;
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
      
      const resolve = this.requestQueue.shift();
      if (resolve) {
        this.lastRequestTime = Date.now();
        resolve();
      }
      
      // Small delay between processing queue items
      if (this.requestQueue.length > 0) {
        await new Promise(resolve => setTimeout(resolve, this.BATCH_DELAY));
      }
    }
    
    this.isProcessing = false;
  }
  
  /**
   * Wrap any RPC function with rate limiting
   */
  async wrapRequest<T>(requestFn: () => Promise<T>): Promise<T> {
    await this.throttle();
    
    try {
      return await requestFn();
    } catch (error: any) {
      // Handle 429 errors with exponential backoff
      if (error.message?.includes('429') || error.message?.includes('Too Many Requests')) {
        console.warn('🚦 Got 429 error, implementing backoff...');
        const backoffTime = Math.min(2000, 200 * Math.pow(2, Math.random())); // 200ms to 2s
        await new Promise(resolve => setTimeout(resolve, backoffTime));
        
        // Retry once after backoff
        await this.throttle();
        return await requestFn();
      }
      
      throw error;
    }
  }
  
  /**
   * Get statistics about rate limiting
   */
  getStats() {
    return {
      queueLength: this.requestQueue.length,
      isProcessing: this.isProcessing,
      lastRequestTime: this.lastRequestTime,
      timeSinceLastRequest: Date.now() - this.lastRequestTime,
    };
  }
  
  /**
   * Clear the queue (for testing or emergency reset)
   */
  clearQueue(): void {
    this.requestQueue = [];
    this.isProcessing = false;
  }
}

// Export singleton instance
export const globalRateLimiter = GlobalRateLimiter.getInstance();

/**
 * Convenience wrapper for rate-limited RPC calls
 */
export async function rateLimitedRequest<T>(requestFn: () => Promise<T>): Promise<T> {
  return globalRateLimiter.wrapRequest(requestFn);
} 