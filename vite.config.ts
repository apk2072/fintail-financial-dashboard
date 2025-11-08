import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    plugins: [react()],
    
    // Build configuration
    build: {
      // Generate source maps for production debugging
      sourcemap: mode === 'production' ? false : true,
      
      // Optimize bundle size
      rollupOptions: {
        output: {
          // Manual chunk splitting for better caching
          manualChunks: {
            // Vendor chunks
            react: ['react', 'react-dom'],
            router: ['react-router-dom'],
            query: ['@tanstack/react-query'],
            charts: ['chart.js', 'react-chartjs-2'],
            icons: ['@heroicons/react'],
            
            // Utility chunks
            utils: ['zod'],
          },
        },
      },
      
      // Increase chunk size warning limit
      chunkSizeWarningLimit: 1000,
      
      // Target modern browsers for better optimization
      target: 'es2020',
    },
    
    // Development server configuration
    server: {
      port: 3000,
      host: true, // Allow external connections
      proxy: {
        // Proxy API calls to backend during development
        '/api': {
          target: env.VITE_API_BASE_URL || 'http://localhost:8000',
          changeOrigin: true,
          secure: false,
        },
      },
    },
    
    // Preview server configuration
    preview: {
      port: 3000,
      host: true,
    },
    
    // Path resolution
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
        '@components': resolve(__dirname, 'src/components'),
        '@pages': resolve(__dirname, 'src/pages'),
        '@utils': resolve(__dirname, 'src/utils'),
        '@services': resolve(__dirname, 'src/services'),
        '@hooks': resolve(__dirname, 'src/hooks'),
        '@types': resolve(__dirname, 'src/types'),
      },
    },
    
    // Environment variables
    define: {
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
      __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    },
    
    // Optimize dependencies
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-router-dom',
        '@tanstack/react-query',
        'chart.js',
        'react-chartjs-2',
      ],
    },
  };
});
