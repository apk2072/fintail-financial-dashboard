// Error logging and monitoring service

export interface ErrorLog {
  id: string;
  timestamp: string;
  level: 'error' | 'warning' | 'info';
  message: string;
  stack?: string;
  context?: Record<string, any>;
  userAgent: string;
  url: string;
  userId?: string;
}

class ErrorLoggingService {
  private logs: ErrorLog[] = [];
  private maxLogs = 100;
  private endpoint = import.meta.env.VITE_ERROR_LOGGING_ENDPOINT;

  /**
   * Log an error
   */
  logError(error: Error, context?: Record<string, any>) {
    const errorLog: ErrorLog = {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      level: 'error',
      message: error.message,
      stack: error.stack,
      context,
      userAgent: navigator.userAgent,
      url: window.location.href,
    };

    this.addLog(errorLog);
    this.sendToServer(errorLog);

    if (import.meta.env.DEV) {
      console.error('[ErrorLogging]', errorLog);
    }
  }

  /**
   * Log a warning
   */
  logWarning(message: string, context?: Record<string, any>) {
    const warningLog: ErrorLog = {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      level: 'warning',
      message,
      context,
      userAgent: navigator.userAgent,
      url: window.location.href,
    };

    this.addLog(warningLog);

    if (import.meta.env.DEV) {
      console.warn('[ErrorLogging]', warningLog);
    }
  }

  /**
   * Log info
   */
  logInfo(message: string, context?: Record<string, any>) {
    const infoLog: ErrorLog = {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      level: 'info',
      message,
      context,
      userAgent: navigator.userAgent,
      url: window.location.href,
    };

    this.addLog(infoLog);

    if (import.meta.env.DEV) {
      console.info('[ErrorLogging]', infoLog);
    }
  }

  /**
   * Log API error
   */
  logAPIError(
    endpoint: string,
    status: number,
    message: string,
    context?: Record<string, any>
  ) {
    this.logError(new Error(`API Error: ${endpoint} - ${status} - ${message}`), {
      ...context,
      endpoint,
      status,
      type: 'api_error',
    });
  }

  /**
   * Log network error
   */
  logNetworkError(message: string, context?: Record<string, any>) {
    this.logError(new Error(`Network Error: ${message}`), {
      ...context,
      type: 'network_error',
    });
  }

  /**
   * Get all logs
   */
  getLogs(): ErrorLog[] {
    return [...this.logs];
  }

  /**
   * Get logs by level
   */
  getLogsByLevel(level: ErrorLog['level']): ErrorLog[] {
    return this.logs.filter(log => log.level === level);
  }

  /**
   * Clear all logs
   */
  clearLogs() {
    this.logs = [];
  }

  /**
   * Export logs as JSON
   */
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  /**
   * Add log to memory
   */
  private addLog(log: ErrorLog) {
    this.logs.unshift(log);
    
    // Keep only the most recent logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs);
    }

    // Store in localStorage for persistence
    try {
      localStorage.setItem('error-logs', JSON.stringify(this.logs.slice(0, 20)));
    } catch (e) {
      // Handle localStorage errors
    }
  }

  /**
   * Send error to server
   */
  private async sendToServer(log: ErrorLog) {
    if (!this.endpoint || import.meta.env.DEV) {
      return; // Don't send in development
    }

    try {
      await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(log),
      });
    } catch (error) {
      // Silently fail - don't want error logging to cause more errors
      console.error('Failed to send error log to server:', error);
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Initialize error logging
   */
  initialize() {
    // Load persisted logs
    try {
      const stored = localStorage.getItem('error-logs');
      if (stored) {
        this.logs = JSON.parse(stored);
      }
    } catch (e) {
      // Handle localStorage errors
    }

    // Set up global error handlers
    window.addEventListener('error', (event) => {
      this.logError(event.error || new Error(event.message), {
        type: 'uncaught_error',
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
    });

    window.addEventListener('unhandledrejection', (event) => {
      this.logError(
        event.reason instanceof Error 
          ? event.reason 
          : new Error(String(event.reason)),
        {
          type: 'unhandled_promise_rejection',
        }
      );
    });

    // Log page visibility changes
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.logInfo('Page hidden');
      } else {
        this.logInfo('Page visible');
      }
    });
  }
}

// Create singleton instance
export const errorLogger = new ErrorLoggingService();

// Initialize on module load
if (typeof window !== 'undefined') {
  errorLogger.initialize();
}

// Export for use in error boundaries and components
export default errorLogger;