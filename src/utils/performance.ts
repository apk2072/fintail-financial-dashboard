// Performance monitoring and optimization utilities

/**
 * Measure and log Core Web Vitals
 */
export function measureWebVitals() {
  if ('web-vital' in window) {
    // This would integrate with web-vitals library in a real app
    console.log('Web Vitals measurement would be implemented here');
  }
}

/**
 * Debounce function to limit function calls
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: number;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Throttle function to limit function calls
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Measure component render time
 */
export function measureRenderTime(componentName: string) {
  const startTime = performance.now();
  
  return () => {
    const endTime = performance.now();
    const renderTime = endTime - startTime;
    
    if (import.meta.env.DEV) {
      console.log(`${componentName} render time: ${renderTime.toFixed(2)}ms`);
    }
    
    // In production, you might send this to analytics
    return renderTime;
  };
}

/**
 * Memory usage monitoring
 */
export function getMemoryUsage() {
  if ('memory' in performance) {
    const memory = (performance as any).memory;
    return {
      used: Math.round(memory.usedJSHeapSize / 1048576), // MB
      total: Math.round(memory.totalJSHeapSize / 1048576), // MB
      limit: Math.round(memory.jsHeapSizeLimit / 1048576), // MB
    };
  }
  return null;
}

/**
 * Network information
 */
export function getNetworkInfo() {
  if ('connection' in navigator) {
    const connection = (navigator as any).connection;
    return {
      effectiveType: connection.effectiveType,
      downlink: connection.downlink,
      rtt: connection.rtt,
      saveData: connection.saveData,
    };
  }
  return null;
}

/**
 * Preload critical resources
 */
export function preloadCriticalResources() {
  // Preload critical CSS
  const criticalCSS = document.createElement('link');
  criticalCSS.rel = 'preload';
  criticalCSS.as = 'style';
  criticalCSS.href = '/src/index.css';
  document.head.appendChild(criticalCSS);

  // Preload critical fonts
  const font = document.createElement('link');
  font.rel = 'preload';
  font.as = 'font';
  font.type = 'font/woff2';
  font.crossOrigin = 'anonymous';
  font.href = '/fonts/inter-var.woff2';
  document.head.appendChild(font);
}

/**
 * Optimize bundle loading
 */
export function optimizeBundleLoading() {
  // Prefetch non-critical chunks
  const prefetchChunks = [
    '/assets/companies-chunk.js',
    '/assets/search-chunk.js',
  ];

  prefetchChunks.forEach((chunk) => {
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = chunk;
    document.head.appendChild(link);
  });
}

/**
 * Performance observer for monitoring
 */
export function initPerformanceObserver() {
  if ('PerformanceObserver' in window) {
    // Monitor Long Tasks
    const longTaskObserver = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        if (entry.duration > 50) {
          console.warn(`Long task detected: ${entry.duration}ms`);
        }
      });
    });

    try {
      longTaskObserver.observe({ entryTypes: ['longtask'] });
    } catch (e) {
      // Long task API not supported
    }

    // Monitor Layout Shifts
    const layoutShiftObserver = new PerformanceObserver((list) => {
      let cumulativeScore = 0;
      list.getEntries().forEach((entry) => {
        if (!(entry as any).hadRecentInput) {
          cumulativeScore += (entry as any).value;
        }
      });
      
      if (cumulativeScore > 0.1) {
        console.warn(`High cumulative layout shift: ${cumulativeScore}`);
      }
    });

    try {
      layoutShiftObserver.observe({ entryTypes: ['layout-shift'] });
    } catch (e) {
      // Layout shift API not supported
    }
  }
}

/**
 * Adaptive loading based on network conditions
 */
export function shouldLoadHighQualityAssets(): boolean {
  const networkInfo = getNetworkInfo();
  
  if (!networkInfo) return true; // Default to high quality if unknown
  
  // Load high quality on fast connections
  return networkInfo.effectiveType === '4g' && 
         networkInfo.downlink > 1.5 && 
         !networkInfo.saveData;
}

/**
 * Resource hints for better loading
 */
export function addResourceHints() {
  // DNS prefetch for external domains
  const dnsPrefetch = document.createElement('link');
  dnsPrefetch.rel = 'dns-prefetch';
  dnsPrefetch.href = '//api.fintail.me';
  document.head.appendChild(dnsPrefetch);

  // Preconnect to API domain
  const preconnect = document.createElement('link');
  preconnect.rel = 'preconnect';
  preconnect.href = 'https://api.fintail.me';
  document.head.appendChild(preconnect);
}