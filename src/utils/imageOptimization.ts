// Image optimization utilities

/**
 * Lazy load images with intersection observer
 */
export function lazyLoadImages() {
  if ('IntersectionObserver' in window) {
    const imageObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const img = entry.target as HTMLImageElement;
          img.src = img.dataset.src || '';
          img.classList.remove('lazy');
          observer.unobserve(img);
        }
      });
    });

    const lazyImages = document.querySelectorAll('img[data-src]');
    lazyImages.forEach((img) => imageObserver.observe(img));
  }
}

/**
 * Preload critical images
 */
export function preloadCriticalImages(urls: string[]) {
  urls.forEach((url) => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = url;
    document.head.appendChild(link);
  });
}

/**
 * Generate responsive image srcSet
 */
export function generateSrcSet(baseUrl: string, sizes: number[]): string {
  return sizes
    .map((size) => `${baseUrl}?w=${size} ${size}w`)
    .join(', ');
}

/**
 * Get optimal image size based on device pixel ratio and container width
 */
export function getOptimalImageSize(containerWidth: number): number {
  const devicePixelRatio = window.devicePixelRatio || 1;
  const optimalWidth = containerWidth * devicePixelRatio;
  
  // Round up to nearest common size
  const commonSizes = [320, 640, 768, 1024, 1280, 1536, 1920];
  return commonSizes.find(size => size >= optimalWidth) || 1920;
}

/**
 * Compress image using canvas (client-side)
 */
export function compressImage(
  file: File, 
  maxWidth: number = 1920, 
  quality: number = 0.8
): Promise<Blob> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const img = new Image();

    img.onload = () => {
      // Calculate new dimensions
      const ratio = Math.min(maxWidth / img.width, maxWidth / img.height);
      canvas.width = img.width * ratio;
      canvas.height = img.height * ratio;

      // Draw and compress
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
      }, 'image/jpeg', quality);
    };

    img.src = URL.createObjectURL(file);
  });
}

/**
 * WebP support detection
 */
export function supportsWebP(): Promise<boolean> {
  return new Promise((resolve) => {
    const webP = new Image();
    webP.onload = webP.onerror = () => {
      resolve(webP.height === 2);
    };
    webP.src = 'data:image/webp;base64,UklGRjoAAABXRUJQVlA4IC4AAACyAgCdASoCAAIALmk0mk0iIiIiIgBoSygABc6WWgAA/veff/0PP8bA//LwYAAA';
  });
}

/**
 * Get image format based on browser support
 */
export async function getOptimalImageFormat(): Promise<'webp' | 'jpeg'> {
  const webpSupported = await supportsWebP();
  return webpSupported ? 'webp' : 'jpeg';
}