import { signIn, signOut, fetchAuthSession } from 'aws-amplify/auth';

export async function POST(request) {
  try {
    await signOut();
  } catch (error) {
    console.log('No existing session to clear');
  }

  try {
    await signIn({
      username: process.env.AUTH_USERNAME,
      password: process.env.AUTH_PASSWORD,
    });
    const authSession = await fetchAuthSession();
    const idToken = authSession.tokens?.idToken?.toString();
    if (!idToken) {
      return Response.json({ error: 'No ID token received' }, { status: 401 });
    }
    return Response.json({ token: idToken }, { status: 200 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    console.log('🌐 Provider Proxy: Received request');
    
    const token = request.headers.get('authorization');
    const { searchParams } = new URL(request.url);
    const provider = searchParams.get('provider');
    
    if (!token) {
      return Response.json({ 
        error: 'Authorization header missing' 
      }, { 
        status: 401,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
      });
    }

    if (!provider) {
      return Response.json({ 
        error: 'Provider parameter missing' 
      }, { 
        status: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
      });
    }

    console.log(`📡 Provider Proxy: Fetching rates for provider: ${provider}`);

    const response = await fetch(`https://devs.pcxpay.com/v1/exchange-rates/provider?provider=${encodeURIComponent(provider)}`, {
      method: 'GET',
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    const responseData = await response.text();

    if (!response.ok) {
      console.error(`❌ Provider Proxy: PCX API error for ${provider}:`, response.status, responseData);
      return Response.json({ 
        error: 'PCX API error',
        status: response.status,
        message: responseData || 'Unknown error',
        provider: provider
      }, { 
        status: response.status,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
      });
    }

    // Try to parse as JSON
    let data;
    try {
      data = JSON.parse(responseData);
      console.log(`✅ Provider Proxy: Successfully fetched ${provider} rates`);
    } catch (e) {
      data = { raw: responseData };
      console.warn(`⚠️ Provider Proxy: Non-JSON response for ${provider}`);
    }

    return Response.json(data, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    });
    
  } catch (error) {
    console.error('❌ Provider Proxy: Internal error:', error);
    return Response.json({ 
      error: 'Internal proxy error',
      message: error.message 
    }, { 
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    });
  }
}

// Handle OPTIONS requests for CORS preflight
export async function OPTIONS(request) {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}