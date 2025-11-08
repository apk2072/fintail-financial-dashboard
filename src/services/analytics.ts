// Analytics and monitoring service

export interface AnalyticsEvent {
  name: string;
  properties?: Record<string, any>;
  timestamp: string;
  sessionId: string;
  userId?: string;
}

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: string;
  context?: Record<string, any>;
}

class AnalyticsService {
  private sessionId: string;
  private userId?: string;
  private events: AnalyticsEvent[] = [];
  private metrics: PerformanceMetric[] = [];
  private endpoint = import.meta.env.VITE_ANALYTICS_ENDPOINT;

  constructor() {
    this.sessionId = this.generateSessionId();
    this.initializeSession();
  }

  /**
   * Track an event
   */
  track(eventName: string, properties?: Record<string, any>) {
    const event: AnalyticsEvent = {
      name: eventName,
      properties,
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      userId: this.userId,
    };

    this.events.push(event);
    this.sendEvent(event);

    if (import.meta.env.DEV) {
      console.log('[Analytics]', event);
    }
  }

  /**
   * Track page view
   */
  trackPageView(path: string, title?: string) {
    this.track('page_view', {
      path,
      title: title || document.title,
      referrer: document.referrer,
      userAgent: navigator.userAgent,
    });
  }

  /**
   * Track user interaction
   */
  trackInteraction(element: string, action: string, properties?: Record<string, any>) {
    this.track('user_interaction', {
      element,
      action,
      ...properties,
    });
  }

  /**
   * Track search
   */
  trackSearch(query: string, results: number, filters?: Record<string, any>) {
    this.track('search', {
      query,
      results,
      filters,
    });
  }

  /**
   * Track company view
   */
  trackCompanyView(ticker: string, companyName: string) {
    this.track('company_view', {
      ticker,
      companyName,
    });
  }

  /**
   * Track performance metric
   */
  trackPerformance(name: string, value: number, unit: string, context?: Record<string, any>) {
    const metric: PerformanceMetric = {
      name,
      value,
      unit,
      timestamp: new Date().toISOString(),
      context,
    };

    this.metrics.push(metric);
    this.sendMetric(metric);

    if (import.meta.env.DEV) {
      console.log('[Performance]', metric);
    }
  }

  /**
   * Track Core Web Vitals
   */
  trackWebVitals() {
    // First Contentful Paint
    this.observePerformanceEntry('first-contentful-paint', (entry) => {
      this.trackPerformance('fcp', entry.startTime, 'ms');
    });

    // Largest Contentful Paint
    this.observePerformanceEntry('largest-contentful-paint', (entry) => {
      this.trackPerformance('lcp', entry.startTime, 'ms');
    });

    // First Input Delay
    this.observePerformanceEntry('first-input', (entry) => {
      this.trackPerformance('fid', (entry as any).processingStart - entry.startTime, 'ms');
    });

    // Cumulative Layout Shift
    let clsValue = 0;
    this.observePerformanceEntry('layout-shift', (entry) => {
      if (!(entry as any).hadRecentInput) {
        clsValue += (entry as any).value;
        this.trackPerformance('cls', clsValue, 'score');
      }
    });
  }

  /**
   * Track API performance
   */
  trackAPICall(endpoint: string, method: string, duration: number, status: number) {
    this.trackPerformance('api_call', duration, 'ms', {
      endpoint,
      method,
      status,
    });
  }

  /**
   * Track user engagement
   */
  trackEngagement() {
    let startTime = Date.now();
    let isActive = true;

    // Track time on page
    const trackTimeOnPage = () => {
      if (isActive) {
        const timeSpent = Date.now() - startTime;
        this.trackPerformance('time_on_page', timeSpent, 'ms', {
          path: window.location.pathname,
        });
      }
    };

    // Track when user becomes inactive
    const handleVisibilityChange = () => {
      if (document.hidden) {
        isActive = false;
        trackTimeOnPage();
      } else {
        isActive = true;
        startTime = Date.now();
      }
    };

    // Track before page unload
    const handleBeforeUnload = () => {
      trackTimeOnPage();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Cleanup function
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      trackTimeOnPage();
    };
  }

  /**
   * Set user ID
   */
  setUserId(userId: string) {
    this.userId = userId;
  }

  /**
   * Get session data
   */
  getSessionData() {
    return {
      sessionId: this.sessionId,
      userId: this.userId,
      events: this.events.length,
      metrics: this.metrics.length,
      startTime: this.events[0]?.timestamp,
    };
  }

  /**
   * Export analytics data
   */
  exportData() {
    return {
      events: this.events,
      metrics: this.metrics,
      session: this.getSessionData(),
    };
  }

  /**
   * Initialize session
   */
  private initializeSession() {
    // Track session start
    this.track('session_start', {
      userAgent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform,
      cookieEnabled: navigator.cookieEnabled,
      onLine: navigator.onLine,
      screen: {
        width: screen.width,
        height: screen.height,
        colorDepth: screen.colorDepth,
      },
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
    });

    // Track initial page view
    this.trackPageView(window.location.pathname);

    // Start engagement tracking
    this.trackEngagement();

    // Start web vitals tracking
    this.trackWebVitals();
  }

  /**
   * Generate session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Send event to server
   */
  private async sendEvent(event: AnalyticsEvent) {
    if (!this.endpoint || import.meta.env.DEV) {
      return; // Don't send in development
    }

    try {
      await fetch(`${this.endpoint}/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      });
    } catch (error) {
      // Silently fail
      console.error('Failed to send analytics event:', error);
    }
  }

  /**
   * Send metric to server
   */
  private async sendMetric(metric: PerformanceMetric) {
    if (!this.endpoint || import.meta.env.DEV) {
      return; // Don't send in development
    }

    try {
      await fetch(`${this.endpoint}/metrics`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(metric),
      });
    } catch (error) {
      // Silently fail
      console.error('Failed to send performance metric:', error);
    }
  }

  /**
   * Observe performance entries
   */
  private observePerformanceEntry(
    entryType: string,
    callback: (entry: PerformanceEntry) => void
  ) {
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          list.getEntries().forEach(callback);
        });
        observer.observe({ entryTypes: [entryType] });
      } catch (e) {
        // Performance API not supported
      }
    }
  }
}

// Create singleton instance
export const analytics = new AnalyticsService();

// Export for use throughout the app
export default analytics;