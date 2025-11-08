import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-gray-900 text-gray-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Company Info */}
          <div className="col-span-1 md:col-span-2">
            <h3 className="text-white text-lg font-semibold mb-4">Fintail Financial Dashboard</h3>
            <p className="text-gray-400 mb-4">
              Your comprehensive source for quarterly financial highlights and company insights. 
              Track performance, analyze trends, and make informed decisions.
            </p>
            <div className="flex space-x-4">
              <span className="text-sm text-gray-500">
                Data sources: Alpha Vantage, Financial Modeling Prep, Yahoo Finance
              </span>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-white font-medium mb-4">Quick Links</h4>
            <ul className="space-y-2">
              <li>
                <a href="/" className="text-gray-400 hover:text-white transition-colors">
                  Dashboard
                </a>
              </li>
              <li>
                <a href="/companies" className="text-gray-400 hover:text-white transition-colors">
                  All Companies
                </a>
              </li>
              <li>
                <a href="/search" className="text-gray-400 hover:text-white transition-colors">
                  Search
                </a>
              </li>
            </ul>
          </div>

          {/* Sectors */}
          <div>
            <h4 className="text-white font-medium mb-4">Popular Sectors</h4>
            <ul className="space-y-2">
              <li>
                <a href="/companies?sector=Technology" className="text-gray-400 hover:text-white transition-colors">
                  Technology
                </a>
              </li>
              <li>
                <a href="/companies?sector=Healthcare" className="text-gray-400 hover:text-white transition-colors">
                  Healthcare
                </a>
              </li>
              <li>
                <a href="/companies?sector=Financial Services" className="text-gray-400 hover:text-white transition-colors">
                  Financial Services
                </a>
              </li>
              <li>
                <a href="/companies?sector=Consumer Discretionary" className="text-gray-400 hover:text-white transition-colors">
                  Consumer Discretionary
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-8 pt-8 flex flex-col md:flex-row justify-between items-center">
          <p className="text-gray-500 text-sm">
            © 2025 Fintail Financial Dashboard. Built with React, TypeScript, and AWS.
          </p>
          <div className="flex space-x-6 mt-4 md:mt-0">
            <span className="text-gray-500 text-sm">
              Data updated daily at 6 AM EST
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};