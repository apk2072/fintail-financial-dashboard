import { useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { analytics } from '../services/analytics';

/**
 * Hook for tracking analytics events
 */
export function useAnalytics() {
  const location = useLocation();

  // Track page views automatically
  useEffect(() => {
    analytics.trackPageView(location.pathname);
  }, [location.pathname]);

  // Memoized tracking functions
  const trackEvent = useCallback((eventName: string, properties?: Record<string, any>) => {
    analytics.track(eventName, properties);
  }, []);

  const trackInteraction = useCallback((element: string, action: string, properties?: Record<string, any>) => {
    analytics.trackInteraction(element, action, properties);
  }, []);

  const trackSearch = useCallback((query: string, results: number, filters?: Record<string, any>) => {
    analytics.trackSearch(query, results, filters);
  }, []);

  const trackCompanyView = useCallback((ticker: string, companyName: string) => {
    analytics.trackCompanyView(ticker, companyName);
  }, []);

  const trackPerformance = useCallback((name: string, value: number, unit: string, context?: Record<string, any>) => {
    analytics.trackPerformance(name, value, unit, context);
  }, []);

  return {
    trackEvent,
    trackInteraction,
    trackSearch,
    trackCompanyView,
    trackPerformance,
  };
}

/**
 * Hook for tracking component performance
 */
export function usePerformanceTracking(componentName: string) {
  useEffect(() => {
    const startTime = performance.now();

    return () => {
      const endTime = performance.now();
      const renderTime = endTime - startTime;
      analytics.trackPerformance(`${componentName}_render_time`, renderTime, 'ms');
    };
  }, [componentName]);
}

/**
 * Hook for tracking user interactions with elements
 */
export function useInteractionTracking() {
  const trackClick = useCallback((elementName: string, properties?: Record<string, any>) => {
    analytics.trackInteraction(elementName, 'click', properties);
  }, []);

  const trackHover = useCallback((elementName: string, properties?: Record<string, any>) => {
    analytics.trackInteraction(elementName, 'hover', properties);
  }, []);

  const trackFocus = useCallback((elementName: string, properties?: Record<string, any>) => {
    analytics.trackInteraction(elementName, 'focus', properties);
  }, []);

  const trackScroll = useCallback((elementName: string, scrollPosition: number) => {
    analytics.trackInteraction(elementName, 'scroll', { scrollPosition });
  }, []);

  return {
    trackClick,
    trackHover,
    trackFocus,
    trackScroll,
  };
}

/**
 * Hook for tracking form interactions
 */
export function useFormTracking(formName: string) {
  const trackFormStart = useCallback(() => {
    analytics.track('form_start', { formName });
  }, [formName]);

  const trackFormSubmit = useCallback((success: boolean, errors?: string[]) => {
    analytics.track('form_submit', { 
      formName, 
      success, 
      errors: errors?.length || 0,
      errorMessages: errors 
    });
  }, [formName]);

  const trackFieldInteraction = useCallback((fieldName: string, action: string) => {
    analytics.trackInteraction(`${formName}_${fieldName}`, action);
  }, [formName]);

  return {
    trackFormStart,
    trackFormSubmit,
    trackFieldInteraction,
  };
}

/**
 * Hook for tracking API call performance
 */
export function useAPITracking() {
  const trackAPICall = useCallback((
    endpoint: string, 
    method: string, 
    duration: number, 
    status: number,
    success: boolean
  ) => {
    analytics.trackPerformance('api_call', duration, 'ms', {
      endpoint,
      method,
      status,
      success,
    });

    analytics.track('api_call', {
      endpoint,
      method,
      status,
      success,
      duration,
    });
  }, []);

  return { trackAPICall };
}