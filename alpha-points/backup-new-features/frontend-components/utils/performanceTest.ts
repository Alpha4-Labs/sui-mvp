/**
 * Performance testing utility for perk data fetching
 * 
 * This utility helps measure the impact of our optimizations:
 * 1. Parallel vs Sequential package processing
 * 2. Batch vs Individual object fetching
 * 3. Cache hit rates and effectiveness
 * 4. Overall load time improvements
 */

export interface PerformanceTest {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  metadata?: Record<string, any>;
}

class PerformanceTracker {
  private tests: Map<string, PerformanceTest> = new Map();
  
  start(testName: string, metadata?: Record<string, any>): void {
    this.tests.set(testName, {
      name: testName,
      startTime: Date.now(),
      metadata,
    });
    console.log(`⏱️ Started: ${testName}`, metadata);
  }
  
  end(testName: string): number {
    const test = this.tests.get(testName);
    if (!test) {
      console.warn(`⚠️ No test found: ${testName}`);
      return 0;
    }
    
    const endTime = Date.now();
    const duration = endTime - test.startTime;
    
    test.endTime = endTime;
    test.duration = duration;
    
    console.log(`✅ Completed: ${testName} in ${duration}ms`, test.metadata);
    return duration;
  }
  
  getResults(): PerformanceTest[] {
    return Array.from(this.tests.values()).filter(test => test.duration !== undefined);
  }
  
  clear(): void {
    this.tests.clear();
  }
  
  /**
   * Compare optimization results
   */
  generateReport(): string {
    const results = this.getResults();
    
    if (results.length === 0) {
      return 'No performance data available';
    }
    
    const report = [
      '📊 PERK LOADING OPTIMIZATION REPORT',
      '═══════════════════════════════════',
      '',
    ];
    
    results.forEach(test => {
      const status = test.duration! < 2000 ? '🟢 FAST' : 
                    test.duration! < 5000 ? '🟡 MODERATE' : '🔴 SLOW';
      
      report.push(`${status} ${test.name}: ${test.duration}ms`);
      
      if (test.metadata) {
        Object.entries(test.metadata).forEach(([key, value]) => {
          report.push(`   └─ ${key}: ${value}`);
        });
      }
      report.push('');
    });
    
    // Add optimization summary
    const avgTime = results.reduce((sum, test) => sum + test.duration!, 0) / results.length;
    report.push('SUMMARY:');
    report.push(`Average load time: ${avgTime.toFixed(0)}ms`);
    report.push(`Target: <2000ms for good UX`);
    report.push(`Status: ${avgTime < 2000 ? '✅ OPTIMIZED' : '⚠️ NEEDS IMPROVEMENT'}`);
    
    return report.join('\n');
  }
}

export const performanceTracker = new PerformanceTracker();

/**
 * Decorator for measuring function performance
 */
export function measurePerformance(testName: string, metadata?: Record<string, any>) {
  return function <T extends (...args: any[]) => Promise<any>>(
    target: any,
    propertyName: string,
    descriptor: TypedPropertyDescriptor<T>
  ) {
    const method = descriptor.value!;
    
    descriptor.value = (async function (this: any, ...args: any[]) {
      performanceTracker.start(testName, metadata);
      try {
        const result = await method.apply(this, args);
        performanceTracker.end(testName);
        return result;
      } catch (error) {
        performanceTracker.end(testName);
        throw error;
      }
    }) as T;
    
    return descriptor;
  };
}

/**
 * Manual performance measurement utility
 */
export async function measureAsync<T>(
  testName: string,
  fn: () => Promise<T>,
  metadata?: Record<string, any>
): Promise<T> {
  performanceTracker.start(testName, metadata);
  try {
    const result = await fn();
    performanceTracker.end(testName);
    return result;
  } catch (error) {
    performanceTracker.end(testName);
    throw error;
  }
}

/**
 * Performance expectations for different scenarios
 */
export const PERFORMANCE_TARGETS = {
  PARTNER_PERKS_LOAD: 2000, // 2 seconds for partner perks
  MARKETPLACE_LOAD: 5000,   // 5 seconds for full marketplace
  SINGLE_PERK_UPDATE: 500,  // 500ms for single perk operations
  CACHE_HIT: 50,           // 50ms for cache hits
} as const; 