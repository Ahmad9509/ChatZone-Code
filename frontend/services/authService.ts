// Service for authentication-related operations
import { useRouter } from 'next/navigation';

// WHAT THIS DOES: Handle user logout by clearing localStorage and store state
// clearUserData: Function to clear all user-related data from Zustand store
export function handleLogout(
  router: ReturnType<typeof useRouter>,
  clearUserData?: () => void
): void {
  if (typeof window !== 'undefined') {
    // WHAT THIS DOES: Clear authentication token from localStorage
    localStorage.removeItem('token');
    // WHAT THIS DOES: Clear saved conversation ID from localStorage
    localStorage.removeItem('cz.currentConversationId');
  }
  
  // WHAT THIS DOES: Clear all user-related data from Zustand store
  // This prevents old user's conversations and data from showing when new user logs in
  if (clearUserData) {
    clearUserData();
  }
  
  router.push('/');
}

