import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    console.log('Validating PCX token...');
    
    const body = await request.json();
    const { token, idToken, expiresIn } = body;

    if (!token) {
      console.error('❌ No token provided in request');
      return NextResponse.json(
        { success: false, error: 'No token provided' },
        { status: 400 }
      );
    }

    // Validate the token by calling the exchange rates endpoint
    const apiUrl = process.env.PCX_API_URL || 'https://devs.pcxpay.com/v1';
    const testEndpoint = `${apiUrl}/exchange-rates/all`;
    console.log('🔗 Validating token with endpoint:', testEndpoint);

    try {
      const testResponse = await fetch(testEndpoint, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!testResponse.ok) {
        const errorText = await testResponse.text();
        console.error('❌ Token validation failed:', testResponse.status, errorText);
        throw new Error(`Token validation failed: ${testResponse.status} - ${errorText}`);
      }

      console.log('✅ Token validation successful');
    } catch (validationError) {
      console.error('❌ Token validation failed:', validationError);
      return NextResponse.json(
        { success: false, error: 'Invalid token', details: validationError.message },
        { status: 401 }
      );
    }

    console.log('✅ PCX token validated successfully');

    return NextResponse.json({
      success: true,
      token,
      idToken,
      expiresIn,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ Token validation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to validate PCX token',
        details: error.message,
      },
      { status: 500 }
    );
  }
}