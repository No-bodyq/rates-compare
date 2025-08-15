import useAuthStore from '../stores/authStore';

export const getPCXAuthToken = async () => {
  const { isTokenValid, fetchNewToken, clearToken, token, accessToken, expiresAt, fetchedAt } =
    useAuthStore.getState();

  try {
    if (isTokenValid()) {
      console.log('🎯 Using cached PCX token');
      return {
        success: true,
        token,
        accessToken,
        expiresIn: expiresAt,
        timestamp: new Date(fetchedAt * 1000).toISOString(),
        fromCache: true,
      };
    }

    console.log('Cached token invalid/expired, fetching new token...');
    return await fetchNewToken();
  } catch (error) {
    console.error('PCX authentication error:', error);
    clearToken();
    throw error;
  }
};

export const refreshPCXAuthToken = async () => {
  const { clearToken, fetchNewToken } = useAuthStore.getState();
  try {
    console.log('🔄 Force refreshing PCX auth token...');
    clearToken();
    return await fetchNewToken();
  } catch (error) {
    console.error('PCX token refresh error:', error);
    clearToken();
    throw error;
  }
};

export const getTokenInfo = () => {
  const { token, expiresAt, fetchedAt, isTokenValid } = useAuthStore.getState();
  if (!token) {
    return { cached: false, message: 'No token cached' };
  }

  const now = Math.floor(Date.now() / 1000);
  const timeRemaining = expiresAt - now;

  return {
    cached: true,
    expiresAt: new Date(expiresAt * 1000).toISOString(),
    fetchedAt: new Date(fetchedAt * 1000).toISOString(),
    timeRemainingMinutes: Math.floor(timeRemaining / 60),
    isValid: isTokenValid(),
  };
};

export const getExchangeRates = async (providedToken = null) => {
  try {
    let token = providedToken;
    
    if (!token) {
      console.log('🔍 No token provided, checking Zustand store...');
      const authResult = await getPCXAuthToken();
      token = authResult.token;
      
      if (authResult.fromCache) {
        console.log('✅ Using cached token from Zustand store');
      } else {
        console.log('🔑 Used fresh token (cache was invalid/expired)');
      }
    } else {
      console.log('🔑 Using provided token');
    }

    if (!token) {
      throw new Error('No authentication token available');
    }

    console.log('🔑 Token length:', token.length);
    console.log('🔑 Token preview:', token.substring(0, 30) + '...');

    const apiUrl = '/api/exchange-rates';
    console.log('📡 Making request to:', apiUrl);

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });

    console.log('📡 Response status:', response.status);
    console.log('📡 Response ok:', response.ok);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Error response body:', errorText);
      
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText };
      }

      if (response.status === 401) {
        console.log('🔄 Got 401, token might be expired. Clearing cache and will retry...');
        useAuthStore.getState().clearToken();
        throw new Error(`Authentication failed: ${errorData.message || 'Token expired, please try again'}`);
      } else if (response.status === 403) {
        throw new Error(`Access denied: ${errorData.message || 'Insufficient permissions'}`);
      }

      throw new Error(`Request failed (${response.status}): ${errorData.message || response.statusText}`);
    }

    const data = await response.json();
    console.log('✅ Exchange rates received successfully');
    console.log('📊 Total rates received:', data.data?.length || 0);
    
    if (data.data && data.data.length > 0) {
      const uniqueProviders = [...new Set(data.data.map(rate => rate.provider))];
      console.log('📊 Available providers:', uniqueProviders);
      
      const uniquePairs = [...new Set(data.data.map(rate => `${rate.from_currency}-${rate.to_currency}`))];
      console.log('📊 Available currency pairs:', uniquePairs.slice(0, 10));
    }

    console.log('data', data);

    return data;
  } catch (error) {
    console.error('❌ Exchange rate fetch error:', error);
    
    if (error.message.includes('Authentication failed') && !providedToken) {
      console.log('🔄 Authentication failed, trying once more with fresh token...');
      try {
        const authResult = await getPCXAuthToken();
        if (!authResult.fromCache) {
          console.log('🔄 Retrying with fresh token...');
          return await getExchangeRates(authResult.token);
        }
      } catch (retryError) {
        console.error('❌ Retry with fresh token also failed:', retryError);
        throw retryError;
      }
    }
    
    throw error;
  }
};

export const getProviderExchangeRates = async (token, provider) => {
  const { getPCXAuthToken, clearToken } = useAuthStore.getState();
  try {
    console.log(`🔄 Using proxy route to fetch ${provider} exchange rates...`);
    if (!token) {
      console.log('⚠️ No token provided, attempting to get auth token...');
      const authResult = await getPCXAuthToken();
      token = authResult.token;
    }

    if (!provider) {
      throw new Error('Provider parameter is required');
    }

    console.log(`>>>>>>Fetching rates for provider: ${provider}<<<<<`);

    const response = await fetch(`/api/exchange-rates/provider?provider=${encodeURIComponent(provider)}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });

    console.log(`📡 Provider proxy response status for ${provider}:`, response.status);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error(`❌ Provider proxy error for ${provider}:`, errorData);

      if (response.status === 401) {
        console.log('🔄 Got 401 for provider request, token might be expired. Clearing cache...');
        clearToken();
        throw new Error(`Authentication failed: ${errorData.message || 'Token may be invalid or expired'}`);
      } else if (response.status === 403) {
        throw new Error(`Access denied: ${errorData.message || 'Insufficient permissions'}`);
      } else if (response.status === 404) {
        throw new Error(`Provider '${provider}' not found or has no available rates`);
      }

      throw new Error(`Failed to fetch ${provider} rates (${response.status}): ${errorData.message || response.statusText}`);
    }

    const data = await response.json();
    console.log(`✅ ${provider} exchange rates received via proxy`);
    console.log(`${provider} data preview:`, data?.data?.length || 0, 'rates');

    return data;
  } catch (error) {
    console.error(`${provider} exchange rate fetch error:`, error);
    if (error.message.includes('Authentication failed')) {
      console.log('💡 Consider calling refreshPCXAuthToken() to get a fresh token');
    }
    throw error;
  }
};

export const getOrganizations = async (providedToken = null) => {
  try {
    let token = providedToken;
    
    if (!token) {
      console.log('🔍 No token provided, checking Zustand store...');
      const authResult = await getPCXAuthToken();
      token = authResult.token;
      
      if (authResult.fromCache) {
        console.log('✅ Using cached token from Zustand store');
      } else {
        console.log('🔑 Used fresh token (cache was invalid/expired)');
      }
    } else {
      console.log('🔑 Using provided token');
    }

    if (!token) {
      throw new Error('No authentication token available');
    }

    console.log('🔑 Token length:', token.length);
    console.log('🔑 Token preview:', token.substring(0, 30) + '...');

    const response = await fetch(`/api/exchange-rates/orginizations`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });

    console.log('📡 Response status:', response.status);
    console.log('📡 Response ok:', response.ok);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Error response body:', errorText);
      
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText };
      }

      if (response.status === 401) {
        console.log('🔄 Got 401, token might be expired. Clearing cache...');
        useAuthStore.getState().clearToken();
        throw new Error(`Authentication failed: ${errorData.message || 'Token may be invalid or expired'}`);
      } else if (response.status === 403) {
        throw new Error(`Access denied: ${errorData.message || 'Insufficient permissions'}`);
      }

      throw new Error(`Failed to fetch organizations (${response.status}): ${errorData.message || response.statusText}`);
    }

    const data = await response.json();
    console.log('✅ Organizations received successfully');
    console.log('📊 Total organizations:', data.data?.organizations?.length || 0);
    return data;
  } catch (error) {
    console.error('❌ Organization fetch error:', error);
    
    if (error.message.includes('Authentication failed') && !providedToken) {
      console.log('🔄 Authentication failed, trying once more with fresh token...');
      try {
        const authResult = await getPCXAuthToken();
        if (!authResult.fromCache) {
          console.log('🔄 Retrying with fresh token...');
          return await getOrganizations(authResult.token);
        }
      } catch (retryError) {
        console.error('❌ Retry with fresh token also failed:', retryError);
        throw retryError;
      }
    }
    
    throw error;
  }
};

export const getExchangeRatesByOrg = async (providedToken = null, orgId) => {
  try {
    let token = providedToken;
    
    if (!token) {
      console.log('🔍 No token provided, checking Zustand store...');
      const authResult = await getPCXAuthToken();
      token = authResult.token;
      
      if (authResult.fromCache) {
        console.log('✅ Using cached token from Zustand store');
      } else {
        console.log('🔑 Used fresh token (cache was invalid/expired)');
      }
    } else {
      console.log('🔑 Using provided token');
    }

    if (!token) {
      throw new Error('No authentication token available');
    }

    console.log('🔑 Token length:', token.length);
    console.log('🔑 Token preview:', token.substring(0, 30) + '...');
    console.log('📡 Fetching rates for orgId:', orgId);

    const response = await fetch(`/api/exchange-rates/orgByid?orgId=${encodeURIComponent(orgId)}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });

    console.log('📡 Response status:', response.status);
    console.log('📡 Response ok:', response.ok);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Error response body:', errorText);
      
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText };
      }

      if (response.status === 401) {
        console.log('🔄 Got 401, token might be expired. Clearing cache...');
        useAuthStore.getState().clearToken();
        throw new Error(`Authentication failed: ${errorData.message || 'Token may be invalid or expired'}`);
      } else if (response.status === 403) {
        throw new Error(`Access denied: ${errorData.message || 'Insufficient permissions'}`);
      }

      throw new Error(`Failed to fetch rates for org ${orgId} (${response.status}): ${errorData.message || response.statusText}`);
    }

    const data = await response.json();
    console.log('✅ Org rates received successfully');
    console.log('📊 Total rates for org:', data.data?.length || 0);
    return data;
  } catch (error) {
    console.error('❌ Org rates fetch error:', error);
    
    if (error.message.includes('Authentication failed') && !providedToken) {
      console.log('🔄 Authentication failed, trying once more with fresh token...');
      try {
        const authResult = await getPCXAuthToken();
        if (!authResult.fromCache) {
          console.log('🔄 Retrying with fresh token...');
          return await getExchangeRatesByOrg(authResult.token, orgId);
        }
      } catch (retryError) {
        console.error('❌ Retry with fresh token also failed:', retryError);
        throw retryError;
      }
    }
    
    throw error;
  }
};