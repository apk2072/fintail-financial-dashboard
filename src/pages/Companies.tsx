import React from 'react';

export const Companies: React.FC = () => {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">All Companies</h1>
        <p className="text-gray-600 mb-8">
          Browse our comprehensive list of public companies with quarterly financial data.
        </p>
        
        <div className="text-center py-12">
          <div className="bg-blue-50 rounded-lg p-8 max-w-md mx-auto">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Coming Soon</h3>
            <p className="text-gray-600">
              The companies listing page will be implemented in the next task iteration.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};