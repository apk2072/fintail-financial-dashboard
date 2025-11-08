import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import * as serviceWorker from './utils/serviceWorker';
import { 
  preloadCriticalResources, 
  optimizeBundleLoading, 
  initPerformanceObserver,
  addResourceHints 
} from './utils/performance';
import { lazyLoadImages } from './utils/imageOptimization';

// Initialize performance optimizations
preloadCriticalResources();
addResourceHints();
initPerformanceObserver();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Post-render optimizations
window.addEventListener('load', () => {
  // Optimize bundle loading after initial load
  optimizeBundleLoading();
  
  // Initialize lazy loading for images
  lazyLoadImages();
});

// Register service worker for offline caching
serviceWorker.register({
  onSuccess: () => {
    console.log('App is ready for offline use');
  },
  onUpdate: () => {
    console.log('New content available, please refresh');
  },
});
