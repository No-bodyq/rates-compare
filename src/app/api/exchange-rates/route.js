export async function GET(request) {
  try {
    console.log('🌐 Proxy: Received request');
    
    const token = request.headers.get('authorization');
    
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

    const response = await fetch('https://devs.pcxpay.com/v1/exchange-rates/all', {
      method: 'GET',
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });


    const responseData = await response.text();

    if (!response.ok) {
      console.error('❌ Proxy: PCX API error:', response.status, responseData);
      return Response.json({ 
        error: 'PCX API error',
        status: response.status,
        message: responseData || 'Unknown error'
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
    } catch (e) {
      data = { raw: responseData };
    }

    return Response.json(data, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    });
    
  } catch (error) {
    console.error('❌ Proxy: Internal error:', error);
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
