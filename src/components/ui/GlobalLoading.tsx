import React from 'react';
import { useGlobalLoading } from '../../services/interceptors';

interface GlobalLoadingProps {
  className?: string;
}

export const GlobalLoading: React.FC<GlobalLoadingProps> = ({ className = '' }) => {
  const isLoading = useGlobalLoading();

  if (!isLoading) return null;

  return (
    <div className={`fixed top-0 left-0 right-0 z-50 ${className}`}>
      <div className="h-1 bg-blue-200">
        <div className="h-full bg-blue-600 animate-pulse" style={{ width: '100%' }}>
          <div className="h-full bg-gradient-to-r from-blue-600 via-blue-500 to-blue-600 animate-loading-bar"></div>
        </div>
      </div>
    </div>
  );
};

// Add custom CSS for the loading bar animation
const style = document.createElement('style');
style.textContent = `
  @keyframes loading-bar {
    0% {
      transform: translateX(-100%);
    }
    50% {
      transform: translateX(0%);
    }
    100% {
      transform: translateX(100%);
    }
  }
  
  .animate-loading-bar {
    animation: loading-bar 2s ease-in-out infinite;
  }
`;
document.head.appendChild(style);