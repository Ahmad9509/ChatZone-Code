// Zustand store for admin state management
import { create } from 'zustand';

interface AdminUser {
  username: string;
  role: string;
}

interface AdminState {
  admin: AdminUser | null;
  isLoading: boolean;
  
  setAdmin: (admin: AdminUser | null) => void;
  setLoading: (loading: boolean) => void;
}

export const useAdminStore = create<AdminState>((set) => ({
  admin: null,
  isLoading: false,
  
  setAdmin: (admin) => set({ admin }),
  setLoading: (loading) => set({ isLoading: loading }),
}));

