// Admin Authentication Hook
// Centralized authentication logic for admin pages
// WHAT THIS HOOK DOES:
// - Checks if admin token exists in localStorage
// - Redirects to login if not authenticated
// - Fetches admin profile info
// - Single source of truth for auth logic (reusable in all admin pages)

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminStore } from '@/lib/store';
import adminApi from '@/lib/api';

export function useAdminAuth() {
  const router = useRouter();
  const { setAdmin } = useAdminStore();

  useEffect(() => {
    // WHAT THIS DOES:
    // Check if admin token exists in localStorage
    // If no token, redirect to login page
    const token = localStorage.getItem('adminToken');
    if (!token) {
      router.push('/login');
      return;
    }

    // WHAT THIS DOES:
    // Fetch admin profile info from backend
    // Store admin data in Zustand store for use in navbar
    const loadAdminProfile = async () => {
      try {
        const res = await adminApi.get('/api/admin/me');
        setAdmin(res.data.admin);
      } catch (error) {
        console.error('Failed to load admin profile:', error);
        // If profile fetch fails, also redirect to login
        localStorage.removeItem('adminToken');
        router.push('/login');
      }
    };

    loadAdminProfile();
  }, [router, setAdmin]);
}

