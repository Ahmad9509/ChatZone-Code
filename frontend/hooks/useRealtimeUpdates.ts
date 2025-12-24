// Custom hook for real-time tier config and model updates via SSE
// Connects to /api/user/updates endpoint and listens for updates from admin panel
// When admin updates tier config or models, frontend automatically refreshes data

import { useEffect, useRef } from 'react';
import { auth, chat as chatApi } from '@/lib/api';

interface UseRealtimeUpdatesParams {
  // WHAT THIS DOES: Function to update user data in store
  // Called when tier_config_updated event is received
  setUser: (user: any) => void;
  
  // WHAT THIS DOES: Function to update models list in store
  // Called when models_updated event is received
  setModels: (models: any[]) => void;
  
  // WHAT THIS DOES: Current user object from store
  // Used to check if user is logged in before connecting
  user: any;
}

export function useRealtimeUpdates(params: UseRealtimeUpdatesParams) {
  const { setUser, setModels, user } = params;
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;
  const reconnectDelay = 3000; // 3 seconds
  // WHAT THIS DOES: Track if connection was intentionally closed due to auth error
  // Prevents logging errors and retrying when we closed it ourselves
  const intentionallyClosedRef = useRef(false);
  // WHAT THIS DOES: Track if connection was successfully established
  // Only log errors if connection was established and then closed unexpectedly
  const connectionEstablishedRef = useRef(false);

  useEffect(() => {
    // WHAT THIS DOES: Only connect if user is logged in
    // Prevents unnecessary connections when user is not authenticated
    if (!user || typeof window === 'undefined') {
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      return;
    }

    // WHAT THIS DOES: Create SSE connection to /api/user/updates endpoint
    // This connection stays open and receives real-time updates from admin panel
    const connect = () => {
      // WHAT THIS DOES: Reset flags for new connection
      // Each new connection starts fresh
      intentionallyClosedRef.current = false;
      connectionEstablishedRef.current = false;
      
      // Close existing connection if any
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://chatzone-api-b8h3g0c4hydccrcy.eastus-01.azurewebsites.net';
      const url = `${API_URL}/api/user/updates`;
      
      // WHAT THIS DOES: Create EventSource with authentication token
      // Token is sent via Authorization header (handled by axios interceptor in backend)
      // For EventSource, we need to pass token via URL query param or use a different approach
      // Since EventSource doesn't support custom headers, we'll use URL query param
      const eventSource = new EventSource(`${url}?token=${encodeURIComponent(token)}`, {
        withCredentials: true,
      });

      eventSourceRef.current = eventSource;

      // WHAT THIS DOES: Handle connection established event
      // Server sends 'connected' event when connection is ready
      eventSource.addEventListener('message', (event) => {
        try {
          const data = JSON.parse(event.data);
          
          switch (data.type) {
            case 'connected':
              // WHAT THIS DOES: Reset reconnect attempts on successful connection
              reconnectAttemptsRef.current = 0;
              intentionallyClosedRef.current = false; // Reset flag on successful connection
              connectionEstablishedRef.current = true; // Mark connection as successfully established
              console.log('✅ Real-time updates connected');
              break;
              
            case 'error':
              // WHAT THIS DOES: Handle errors sent from server in SSE format
              // Authentication errors mean we shouldn't retry - user needs to log in again
              console.error('❌ Real-time updates error:', data.error);
              
              // WHAT THIS DOES: Don't retry on authentication errors
              // These errors mean the token is invalid/expired, so retrying won't help
              if (data.error.includes('Authentication') || 
                  data.error.includes('Token') || 
                  data.error.includes('User not found')) {
                console.log('🔒 Authentication error - stopping reconnection attempts');
                // WHAT THIS DOES: Mark connection as intentionally closed
                // This prevents onerror handler from logging and retrying
                intentionallyClosedRef.current = true;
                eventSource.close();
                reconnectAttemptsRef.current = maxReconnectAttempts; // Prevent retries
                return;
              }
              
              // WHAT THIS DOES: For other errors, allow reconnection attempts
              // These might be temporary network issues
              break;
              
            case 'tier_config_updated':
              // WHAT THIS DOES: Refetch user data when tier config is updated
              // This updates user.tierConfig in store, which affects UI (buttons, features)
              // Past conversations are NOT affected - only future UI updates
              console.log('🔄 Tier config updated, refreshing user data...');
              auth.getMe()
                .then((res) => {
                  setUser(res.data.user);
                  console.log('✅ User data refreshed with new tier config');
                })
                .catch((error) => {
                  console.error('Failed to refresh user data:', error);
                });
              break;
              
            case 'models_updated':
              // WHAT THIS DOES: Refetch models list when admin adds/updates/deletes models
              // This updates models array in store, which affects model selector dropdown
              console.log('🔄 Models updated, refreshing models list...');
              chatApi.getModels()
                .then((res) => {
                  setModels(res.data.models || []);
                  console.log('✅ Models list refreshed');
                })
                .catch((error) => {
                  console.error('Failed to refresh models:', error);
                });
              break;
              
            case 'heartbeat':
              // WHAT THIS DOES: Ignore heartbeat messages (keep-alive from server)
              // No action needed, just confirms connection is alive
              break;
              
            default:
              console.warn('Unknown real-time update event type:', data.type);
          }
        } catch (error) {
          console.error('Failed to parse real-time update event:', error);
        }
      });

      // WHAT THIS DOES: Handle connection errors
      // Attempts to reconnect if connection fails, but not for authentication errors
      // Only logs errors if connection was successfully established and then closed unexpectedly
      eventSource.onerror = (error) => {
        // WHAT THIS DOES: Check if we intentionally closed the connection due to auth error
        // If so, don't log error or attempt to reconnect
        if (intentionallyClosedRef.current) {
          return; // We closed it ourselves, ignore this error event
        }
        
        // WHAT THIS DOES: Only log errors if connection was successfully established
        // If connection never established (network issues, server down), don't log error
        // Just retry silently - logging errors for failed connection attempts is noisy
        if (!connectionEstablishedRef.current) {
          // WHAT THIS DOES: Connection never established, just retry without logging error
          // This prevents error spam when server is starting up or network is flaky
          if (reconnectAttemptsRef.current < maxReconnectAttempts) {
            reconnectAttemptsRef.current++;
            reconnectTimeoutRef.current = setTimeout(() => {
              connect();
            }, reconnectDelay);
          }
          return;
        }
        
        // WHAT THIS DOES: Connection was established but then closed unexpectedly
        // This is worth logging since it means something went wrong after successful connection
        if (eventSource.readyState === EventSource.CLOSED) {
          console.error('Real-time updates connection closed');
          
          // WHAT THIS DOES: Attempt to reconnect if we haven't exceeded max attempts
          if (reconnectAttemptsRef.current < maxReconnectAttempts) {
            reconnectAttemptsRef.current++;
            console.log(`🔄 Reconnecting to real-time updates (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})...`);
            
            reconnectTimeoutRef.current = setTimeout(() => {
              connect();
            }, reconnectDelay);
          } else {
            console.error('❌ Max reconnection attempts reached. Real-time updates disabled.');
          }
        }
      };
    };

    // WHAT THIS DOES: Establish initial connection
    connect();

    // WHAT THIS DOES: Cleanup on unmount or when user changes
    // Closes SSE connection and clears reconnect timeout
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      reconnectAttemptsRef.current = 0;
      intentionallyClosedRef.current = false; // Reset flag on cleanup
      connectionEstablishedRef.current = false; // Reset flag on cleanup
    };
  }, [user, setUser, setModels]);
}

