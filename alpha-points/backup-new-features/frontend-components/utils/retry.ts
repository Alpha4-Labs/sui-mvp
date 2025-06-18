// Utility function for retrying failed requests with exponential backoff
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      // Log error details for debugging
      console.warn(`Request failed (attempt ${attempt + 1}/${maxRetries + 1}):`, {
        message: error.message,
        status: error?.status,
        code: error?.code,
        type: error?.name,
      });
      
      // Don't retry on final attempt
      if (attempt === maxRetries) {
        break;
      }
      
      // Don't retry on certain error types
      if (error?.code === 'UNAUTHORIZED' || error?.status === 403) {
        console.warn('Authentication error, not retrying');
        break;
      }
      
      // Handle CORS errors (common in development)
      if (error?.message?.includes('CORS') || error?.message?.includes('Access-Control-Allow-Origin')) {
        console.warn('CORS error detected, retrying with longer delay');
        const corsDelay = baseDelay * 2;
        await new Promise(resolve => setTimeout(resolve, corsDelay));
        continue;
      }
      
      // Handle rate limiting (429)
      if (error?.status === 429 || error?.message?.includes('Too Many Requests')) {
        console.warn('Rate limiting detected, backing off');
        const rateLimitDelay = baseDelay * Math.pow(2, attempt + 1) + Math.random() * 2000;
        await new Promise(resolve => setTimeout(resolve, rateLimitDelay));
        continue;
      }
      
      // Calculate delay with exponential backoff for other errors
      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}

// Enhanced retry utility with specific handling for rate limits and RPC errors

export interface RetryOptions {
  maxAttempts?: number;
  baseDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
  shouldRetry?: (error: any) => boolean;
}

const defaultOptions: Required<RetryOptions> = {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  backoffFactor: 2,
  shouldRetry: (error: any) => {
    // Retry on rate limits and temporary network errors
    if (error?.status === 429 || error?.message?.includes('429')) return true;
    if (error?.status === 503 || error?.message?.includes('503')) return true;
    if (error?.message?.includes('ECONNRESET')) return true;
    if (error?.message?.includes('timeout')) return true;
    return false;
  }
};

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...defaultOptions, ...options };
  let lastError: any;
  
  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      // Don't retry if we shouldn't or if this is the last attempt
      if (!opts.shouldRetry(error) || attempt === opts.maxAttempts) {
        throw error;
      }
      
      // Calculate delay with exponential backoff
      const delay = Math.min(
        opts.baseDelay * Math.pow(opts.backoffFactor, attempt - 1),
        opts.maxDelay
      );
      
      console.log(`Attempt ${attempt} failed, retrying in ${delay}ms:`, error.message);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

// Specialized retry for RPC calls with rate limiting
export async function withRateLimitRetry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 5
): Promise<T> {
  return withRetry(fn, {
    maxAttempts,
    baseDelay: 500,
    maxDelay: 30000,
    backoffFactor: 2.5,
    shouldRetry: (error: any) => {
      // Be more aggressive about retrying RPC errors
      if (error?.status === 429) return true;
      if (error?.message?.includes('429')) return true;
      if (error?.message?.includes('Too Many Requests')) return true;
      if (error?.status === 503) return true;
      if (error?.message?.includes('Service Unavailable')) return true;
      if (error?.message?.includes('ECONNRESET')) return true;
      if (error?.message?.includes('timeout')) return true;
      if (error?.message?.includes('network')) return true;
      return false;
    }
  });
} 