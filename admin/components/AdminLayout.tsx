// Admin Layout Component
// Navigation and layout wrapper for all admin pages
// WHAT THIS COMPONENT DOES:
// - Provides consistent navbar for all admin pages
// - Extracts duplicated navigation code (was repeated in 5+ files)
// - Handles logout functionality
// - Maintains consistent styling across admin panel
// - Accepts activeTab prop to highlight current page

'use client';

import { useRouter } from 'next/navigation';
import { useAdminStore } from '@/lib/store';
import { ReactNode } from 'react';

interface AdminLayoutProps {
  children: ReactNode;
  activeTab?: 'dashboard' | 'providers' | 'models' | 'users' | 'tiers' | 'prompts';
}

export function AdminLayout({ children, activeTab = 'dashboard' }: AdminLayoutProps) {
  const router = useRouter();
  const { admin } = useAdminStore();

  // WHAT THIS DOES:
  // Handles logout: Remove token from storage and redirect to login page
  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    router.push('/login');
  };

  // WHAT THIS DOES:
  // Returns className for active/inactive nav links
  // Highlights current page with different styling
  const getNavLinkClass = (tab: string) => {
    const isActive = activeTab === tab;
    return isActive
      ? 'px-3 py-2 text-sm font-medium text-white bg-gray-900 rounded-md'
      : 'px-3 py-2 text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-700 rounded-md';
  };

  return (
    <div className="min-h-screen bg-gray-900">
      {/* ========== NAVIGATION BAR ========== */}
      {/* 
        WHAT THIS DOES:
        - Displays navbar at top of page
        - Shows ChatZone Admin branding
        - Navigation links to all admin sections
        - User menu with logout button
      */}
      <nav className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            {/* LEFT SIDE: Logo + Navigation Links */}
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-white">ChatZone Admin</h1>
              <div className="ml-10 flex space-x-4">
                <a href="/dashboard" className={getNavLinkClass('dashboard')}>
                  Dashboard
                </a>
                <a href="/dashboard/providers" className={getNavLinkClass('providers')}>
                  Providers
                </a>
                <a href="/dashboard/models" className={getNavLinkClass('models')}>
                  Models & Tiers
                </a>
                <a href="/dashboard/users" className={getNavLinkClass('users')}>
                  Users
                </a>
                <a href="/dashboard/tiers" className={getNavLinkClass('tiers')}>
                  Tiers
                </a>
                <a href="/dashboard/prompts" className={getNavLinkClass('prompts')}>
                  Prompts
                </a>
              </div>
            </div>

            {/* RIGHT SIDE: User Info + Logout Button */}
            <div className="flex items-center space-x-4">
              {/* Display admin username */}
              <span className="text-sm text-gray-300">{admin?.username || 'Admin'}</span>

              {/* Logout button */}
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-sm font-medium text-white bg-gray-700 hover:bg-gray-600 rounded-md"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* ========== MAIN CONTENT ========== */}
      {/* 
        WHAT THIS DOES:
        - Renders page content passed as children
        - Applies consistent padding and max-width
        - Content is centered on page
      */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">{children}</main>
    </div>
  );
}

