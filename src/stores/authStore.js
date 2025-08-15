import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

const defaultState = {
  token: null,
  accessToken: null,
  expiresAt: null,
  fetchedAt: null,
  isConfigured: false,
};

// Configure Amplify at module level - runs once when imported
let amplifyConfigured = false;
const configureAmplifyOnce = async () => {
  if (amplifyConfigured) return;
  
  console.log('🔍 Environment variables:');
  console.log('USER_POOL_ID:', process.env.NEXT_PUBLIC_USER_POOL_ID);
  console.log('USER_POOL_CLIENT_ID:', process.env.NEXT_PUBLIC_USER_POOL_CLIENT_ID);
  
  if (!process.env.NEXT_PUBLIC_USER_POOL_ID || !process.env.NEXT_PUBLIC_USER_POOL_CLIENT_ID) {
    console.error('❌ Missing required environment variables');
    return;
  }

  try {
    const { Amplify } = await import('aws-amplify');
    const config = {
      Auth: {
        Cognito: {
          userPoolId: process.env.NEXT_PUBLIC_USER_POOL_ID,
          userPoolClientId: process.env.NEXT_PUBLIC_USER_POOL_CLIENT_ID,
        },
      },
    };
    
    console.log('🔧 Configuring Amplify with:', config);
    Amplify.configure(config);
    amplifyConfigured = true;
    console.log('✅ Amplify configured at module level');
  } catch (error) {
    console.error('❌ Failed to configure Amplify:', error);
  }
};

// Initialize immediately
if (typeof window !== 'undefined') {
  configureAmplifyOnce();
}

const useAuthStore = create(
  persist(
    (set, get) => ({
      token: null,
      accessToken: null,
      expiresAt: null,
      fetchedAt: null,
      isConfigured: false,

      // Ensure Amplify is configured
      ensureAmplifyConfigured: async () => {
        if (!amplifyConfigured) {
          await configureAmplifyOnce();
        }
        if (!amplifyConfigured) {
          throw new Error('Failed to configure Amplify');
        }
      },

      // Set token data
      setToken: ({ token, accessToken, expiresAt, fetchedAt }) => {
        set({ token, accessToken, expiresAt, fetchedAt });
        console.log('✅ Token cached in store');
        console.log('🔑 Token expires at:', new Date(expiresAt * 1000).toISOString());
      },

      // Clear token data
      clearToken: () => {
        set({
          token: null,
          accessToken: null,
          expiresAt: null,
          fetchedAt: null,
        });
        console.log('🧹 Token cache cleared');
      },

      // Check if token is valid
      isTokenValid: () => {
        const { token, expiresAt } = get();
        if (!token || !expiresAt) {
          console.log('🔍 No cached token available');
          return false;
        }
        const now = Math.floor(Date.now() / 1000);
        const bufferTime = 300; // 5-minute buffer
        const isExpired = now >= expiresAt - bufferTime;
        if (isExpired) {
          console.log('>||< Cached token is expired or will expire soon');
          console.log(' Token expires at:', new Date(expiresAt * 1000).toISOString());
          console.log(' Current time:', new Date(now * 1000).toISOString());
          return false;
        }
        console.log('Cached token is still valid');
        console.log('Token expires at:', new Date(expiresAt * 1000).toISOString());
        console.log('Time remaining:', Math.floor((expiresAt - now) / 60), 'minutes');
        return true;
      },

      // Fetch new token
      fetchNewToken: async () => {
        console.log('Fetching new PCX auth token...');
        
        // Ensure Amplify is configured first
        await get().ensureAmplifyConfigured();
        
        const { signOut, signIn, fetchAuthSession } = await import('aws-amplify/auth');
        
        try {
          await signOut();
        } catch (error) {
          console.log('No existing session to clear>>>>>>');
        }

        await signIn({
          username: 'hehoh88289@ethsms.com',
          password: 'hehoh88289@ethsms.com',
        });

        const authSession = await fetchAuthSession();
        const accessToken = authSession.tokens?.accessToken?.toString();
        const idToken = authSession.tokens?.idToken?.toString();
        const expiresIn = authSession.tokens?.idToken?.payload?.exp;

        if (!idToken) {
          throw new Error('No ID token received');
        }

        const now = Math.floor(Date.now() / 1000);
        set({
          token: idToken,
          accessToken,
          expiresAt: expiresIn,
          fetchedAt: now,
        });

        console.log('✅ New PCX token fetched and cached');
        console.log('🔑 Token expires at:', new Date(expiresIn * 1000).toISOString());
        console.log('⏳ Token valid for:', Math.floor((expiresIn - now) / 60), 'minutes');

        return {
          success: true,
          token: idToken,
          accessToken,
          expiresIn,
          timestamp: new Date().toISOString(),
          fromCache: false,
        };
      },

      // Initialize token refresh interval
      initTokenRefresh: () => {
        const interval = setInterval(() => {
          const { isTokenValid, fetchNewToken, expiresAt } = get();
          if (expiresAt && !isTokenValid()) {
            console.log('🔄 Token nearing expiry, refreshing...');
            fetchNewToken().catch((error) => {
              console.error('❌ Failed to refresh token:', error);
            });
          }
        }, 60 * 1000); // Check every minute
        return () => clearInterval(interval);
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => (typeof window !== 'undefined' ? localStorage : null)),
      getServerSnapshot: () => defaultState, // Provide default state for SSR
    }
  )
);

export default useAuthStore;