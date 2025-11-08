import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  MagnifyingGlassIcon, 
  ChartBarIcon, 
  Bars3Icon, 
  XMarkIcon 
} from '@heroicons/react/24/outline';

interface HeaderProps {
  onSearchFocus?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onSearchFocus }) => {
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const query = formData.get('search') as string;
    if (query.trim()) {
      navigate(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <header className="bg-gradient-to-r from-blue-600 to-purple-700 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
          {/* Logo and Brand */}
          <Link to="/" className="flex items-center space-x-3 group" onClick={closeMobileMenu}>
            <div className="bg-white/10 p-2 rounded-lg group-hover:bg-white/20 transition-colors">
              <ChartBarIcon className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-xl sm:text-2xl font-bold text-white">Fintail</h1>
              <p className="text-blue-100 text-xs sm:text-sm">Financial Dashboard</p>
            </div>
            <div className="sm:hidden">
              <h1 className="text-lg font-bold text-white">Fintail</h1>
            </div>
          </Link>

          {/* Desktop Search Bar */}
          <div className="hidden md:flex flex-1 max-w-lg mx-8">
            <form onSubmit={handleSearchSubmit} className="relative w-full">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  name="search"
                  placeholder="Search companies by name or ticker..."
                  onFocus={onSearchFocus}
                  className="w-full pl-10 pr-4 py-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg text-white placeholder-blue-200 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-white/30 transition-all"
                />
              </div>
            </form>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-6">
            <Link
              to="/"
              className="text-blue-100 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors"
            >
              Dashboard
            </Link>
            <Link
              to="/companies"
              className="text-blue-100 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors"
            >
              Companies
            </Link>
            <Link
              to="/search"
              className="text-blue-100 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors"
            >
              Search
            </Link>
          </nav>

          {/* Mobile menu button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden bg-white/10 p-2 rounded-lg hover:bg-white/20 transition-colors"
            aria-label="Toggle mobile menu"
          >
            {isMobileMenuOpen ? (
              <XMarkIcon className="h-6 w-6 text-white" />
            ) : (
              <Bars3Icon className="h-6 w-6 text-white" />
            )}
          </button>
        </div>

        {/* Mobile Search Bar */}
        <div className="md:hidden pb-4">
          <form onSubmit={handleSearchSubmit} className="relative">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                name="search"
                placeholder="Search companies..."
                onFocus={onSearchFocus}
                className="w-full pl-10 pr-4 py-2.5 bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg text-white placeholder-blue-200 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-white/30 transition-all text-sm"
              />
            </div>
          </form>
        </div>

        {/* Mobile Navigation Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-white/20 pt-4 pb-4">
            <nav className="flex flex-col space-y-2">
              <Link
                to="/"
                onClick={closeMobileMenu}
                className="text-blue-100 hover:text-white hover:bg-white/10 px-3 py-3 rounded-md text-base font-medium transition-colors"
              >
                Dashboard
              </Link>
              <Link
                to="/companies"
                onClick={closeMobileMenu}
                className="text-blue-100 hover:text-white hover:bg-white/10 px-3 py-3 rounded-md text-base font-medium transition-colors"
              >
                Companies
              </Link>
              <Link
                to="/search"
                onClick={closeMobileMenu}
                className="text-blue-100 hover:text-white hover:bg-white/10 px-3 py-3 rounded-md text-base font-medium transition-colors"
              >
                Search
              </Link>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
};