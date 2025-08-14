import { Amplify } from 'aws-amplify';
import { signIn, signOut, fetchAuthSession } from 'aws-amplify/auth';

let isConfigured = false;

// Configure Amplify (run this once in your app initialization)
export const configureAmplify = () => {
  if (isConfigured) return;
  
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: process.env.NEXT_PUBLIC_USER_POOL_ID || 'eu-west-2_rLl0hTRkX',
        userPoolClientId: process.env.NEXT_PUBLIC_USER_POOL_CLIENT_ID || '20u7eufiv369ctq8sdgka8dshi',
      }
    }
  });
  
  isConfigured = true;
};

export const getPCXAuthToken = async () => {
  try {
    console.log('Getting PCX auth token from frontend...');
    
    configureAmplify();
    
    try {
      await signOut();
    } catch (error) {
      console.log('No existing session to clear');
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

    console.log('✅ PCX authentication successful from frontend');
    console.log('🔑 Using ID token for authentication');

    return {
      success: true,
      token: idToken, 
      accessToken: accessToken,
      expiresIn: expiresIn,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('❌ Frontend PCX authentication error:', error);
    throw error;
  }
};

export const getExchangeRates = async (token) => {
  try {
    console.log('🔄 Using proxy route to fetch exchange rates...');
    
    if (!token) {
      throw new Error('No token provided');
    }

    console.log('🔑 Token length:', token.length);
    console.log('🔑 Token preview:', token.substring(0, 30) + '...');

    // Use your Next.js API route
    const response = await fetch('/api/exchange-rates', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    console.log('📡 Proxy response status:', response.status);
    console.log('📡 Proxy response ok:', response.ok);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('❌ Proxy error response:', errorData);
      
      if (response.status === 401) {
        throw new Error(`Authentication failed: ${errorData.message || 'Token may be invalid or expired'}`);
      } else if (response.status === 403) {
        throw new Error(`Access denied: ${errorData.message || 'Insufficient permissions'}`);
      }
      
      throw new Error(`Request failed (${response.status}): ${errorData.message || response.statusText}`);
    }

    const data = await response.json();
    console.log('✅ Exchange rates received via proxy');
    console.log('📊 Data preview:', Object.keys(data).length, 'items');
    
    return data;
    
  } catch (error) {
    console.error('❌ Exchange rate fetch error:', error);
    throw error;
  }
};

// Debug function to decode JWT tokens
export const debugToken = (token) => {
  try {
    console.log('🔍 === TOKEN DEBUGGING ===');
    console.log('🔑 Full token length:', token.length);
    console.log('🔑 Token preview:', token.substring(0, 50) + '...' + token.slice(-20));
    
    const parts = token.split('.');
    if (parts.length !== 3) {
      console.error('❌ Invalid JWT format - expected 3 parts, got', parts.length);
      return;
    }
    
    // Decode header
    const header = JSON.parse(atob(parts[0].replace(/-/g, '+').replace(/_/g, '/')));
    console.log('📋 JWT Header:', header);
    
    // Decode payload
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    console.log('📋 JWT Payload:', payload);
    
    // Check important fields
    console.log('🏢 Issuer (iss):', payload.iss);
    console.log('👤 Subject (sub):', payload.sub);
    console.log('🎯 Audience (aud):', payload.aud || 'Not set');
    console.log('📅 Issued at (iat):', new Date(payload.iat * 1000).toISOString());
    console.log('📅 Expires at (exp):', new Date(payload.exp * 1000).toISOString());
    console.log('🔐 Token use:', payload.token_use);
    console.log('👤 Custom type:', payload['custom:type']);
    
    // Check if token is expired
    const now = Date.now() / 1000;
    const isExpired = payload.exp < now;
    console.log('⏰ Token expired:', isExpired ? '❌ YES' : '✅ NO');
    
    if (isExpired) {
      console.log('⚠️ Token expired', Math.floor((now - payload.exp) / 60), 'minutes ago');
    } else {
      console.log('⏳ Token expires in', Math.floor((payload.exp - now) / 60), 'minutes');
    }
    
    console.log('🔍 === END TOKEN DEBUG ===');
    
    return {
      header,
      payload,
      isExpired,
      tokenUse: payload.token_use,
      customType: payload['custom:type']
    };
    
  } catch (error) {
    console.error('❌ Token debugging failed:', error);
  }
};