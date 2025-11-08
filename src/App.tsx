
import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { queryClient } from './lib/queryClient';
import { Layout } from './components/layout/Layout';
import { GlobalLoading } from './components/ui/GlobalLoading';
import { LoadingSpinner } from './components/ui/LoadingSpinner';
import { ErrorBoundary } from './components/error/ErrorBoundary';
import { DevMonitoringToggle } from './components/dev/MonitoringDashboard';
import './App.css';

// Lazy load pages for better performance
const Dashboard = React.lazy(() => import('./pages/Dashboard').then(module => ({ default: module.Dashboard })));
const Companies = React.lazy(() => import('./pages/Companies').then(module => ({ default: module.Companies })));
const Search = React.lazy(() => import('./pages/Search').then(module => ({ default: module.Search })));
const CompanyDetail = React.lazy(() => import('./pages/CompanyDetail').then(module => ({ default: module.CompanyDetail })));

function App() {
  return (
    <ErrorBoundary level="critical">
      <QueryClientProvider client={queryClient}>
        <GlobalLoading />
        <Router>
          <ErrorBoundary level="page">
            <Suspense fallback={<LoadingSpinner />}>
              <Routes>
                <Route path="/" element={<Layout />}>
                  <Route index element={<Dashboard />} />
                  <Route path="companies" element={<Companies />} />
                  <Route path="search" element={<Search />} />
                  <Route path="company/:ticker" element={<CompanyDetail />} />
                </Route>
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </Router>
        {/* React Query Devtools - only shows in development */}
        <ReactQueryDevtools initialIsOpen={false} />
        
        {/* Development monitoring dashboard */}
        <DevMonitoringToggle />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
