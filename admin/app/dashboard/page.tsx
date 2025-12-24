// Admin Dashboard Main Page
// Overview with key metrics and navigation
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminStore } from '@/lib/store';
import { adminAuth, analytics } from '@/lib/api';

export default function AdminDashboard() {
  const router = useRouter();
  const { admin, setAdmin } = useAdminStore();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (!token) {
      router.push('/login');
      return;
    }

    // Load admin data
    adminAuth.getMe().then((res) => {
      setAdmin(res.data.admin);
    }).catch(() => {
      localStorage.removeItem('adminToken');
      router.push('/login');
    });

    // Load analytics
    analytics.overview().then((res) => {
      setStats(res.data);
      setLoading(false);
    }).catch((err) => {
      console.error('Failed to load analytics:', err);
      setLoading(false);
    });
  }, [router, setAdmin]);

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Navigation Bar */}
      <nav className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-white">ChatZone Admin</h1>
              <div className="ml-10 flex space-x-4">
                <a href="/dashboard" className="px-3 py-2 text-sm font-medium text-white bg-gray-900 rounded-md">
                  Dashboard
                </a>
                <a href="/dashboard/models" className="px-3 py-2 text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-700 rounded-md">
                  Models
                </a>
                <a href="/dashboard/users" className="px-3 py-2 text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-700 rounded-md">
                  Users
                </a>
                <a href="/dashboard/analytics" className="px-3 py-2 text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-700 rounded-md">
                  Analytics
                </a>
                <a href="/dashboard/prompts" className="px-3 py-2 text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-700 rounded-md">
                  Prompts
                </a>
                <a href="/dashboard/tiers" className="px-3 py-2 text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-700 rounded-md">
                  Tiers
                </a>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-300">
                {admin?.username || 'Admin'}
              </span>
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

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="text-sm font-medium text-gray-400 mb-2">Total Users</div>
            <div className="text-3xl font-bold text-white">{stats?.totalUsers || 0}</div>
            <div className="text-sm text-green-400 mt-2">+{stats?.newUsersToday || 0} today</div>
          </div>

          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="text-sm font-medium text-gray-400 mb-2">Active Subscriptions</div>
            <div className="text-3xl font-bold text-white">{stats?.activeSubscriptions || 0}</div>
            <div className="text-sm text-gray-400 mt-2">{stats?.conversionRate || 0}% conversion</div>
          </div>

          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="text-sm font-medium text-gray-400 mb-2">Monthly Revenue</div>
            <div className="text-3xl font-bold text-white">${stats?.mrr || 0}</div>
            <div className="text-sm text-green-400 mt-2">+{stats?.revenueGrowth || 0}% MoM</div>
          </div>

          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="text-sm font-medium text-gray-400 mb-2">Messages Today</div>
            <div className="text-3xl font-bold text-white">{stats?.messagesToday || 0}</div>
            <div className="text-sm text-gray-400 mt-2">{stats?.totalMessages || 0} total</div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 mb-8">
          <h2 className="text-lg font-bold text-white mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <a
              href="/dashboard/models/new"
              className="flex items-center justify-center px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
            >
              + Add AI Model
            </a>
            <a
              href="/dashboard/users"
              className="flex items-center justify-center px-4 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 font-medium"
            >
              View All Users
            </a>
            <a
              href="/dashboard/prompts"
              className="flex items-center justify-center px-4 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 font-medium"
            >
              Edit System Prompts
            </a>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h2 className="text-lg font-bold text-white mb-4">Recent Activity</h2>
          <div className="space-y-3">
            {stats?.recentActivity?.length > 0 ? (
              stats.recentActivity.map((activity: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between py-2 border-b border-gray-700 last:border-0">
                  <div>
                    <div className="text-sm text-white">{activity.description}</div>
                    <div className="text-xs text-gray-400">{new Date(activity.timestamp).toLocaleString()}</div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-400 text-sm">No recent activity</p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

