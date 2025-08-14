import { NextResponse } from 'next/server';

async function getAuthToken() {
  try {
    const response = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/auth/pcx-login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Authentication failed: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.success || !data.token) {
      throw new Error('Failed to get authentication token');
    }

    return data.token;
  } catch (error) {
    console.error('❌ Failed to get auth token:', error);
    throw error;
  }
}

export async function GET(request) {
  console.log('🚀 Convert API route called');
  
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const amount = parseFloat(searchParams.get('amount'));

    console.log('📥 Request params:', { from, to, amount });

    if (!from || !to || isNaN(amount)) {
      console.log('❌ Missing or invalid parameters');
      return NextResponse.json(
        { 
          success: false,
          error: "Missing 'from', 'to', or 'amount' parameters",
          received: { from, to, amount },
          example: '/api/convert?from=USD&to=EUR&amount=100'
        },
        { status: 400 }
      );
    }

    if (amount <= 0) {
      console.log('❌ Invalid amount:', amount);
      return NextResponse.json(
        { 
          success: false,
          error: "Amount must be greater than 0"
        },
        { status: 400 }
      );
    }

    // Get JWT token by authenticating
    console.log('🔐 Getting authentication token...');
    let jwtToken;
    try {
      jwtToken = await getAuthToken();
      console.log('✅ Authentication token obtained');
    } catch (authError) {
      console.error('❌ Authentication failed:', authError);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to authenticate with PCX API",
          details: authError.message
        },
        { status: 401 }
      );
    }

    const PCX_URL = process.env.PCX_API_URL || 'https://devs.pcxpay.com/v1';
    
    // Try to get all exchange rates first
    const allRatesUrl = `${PCX_URL}/exchange-rates/all`;
    console.log('🔗 Making request to PCX URL:', allRatesUrl);
    
    const response = await fetch(allRatesUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwtToken}`,
      },
    });
    
    console.log('📡 PCX response status:', response.status);
    
    let data;
    const responseText = await response.text();
    console.log('📄 PCX raw response:', responseText.substring(0, 500));
    
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('❌ Failed to parse PCX response as JSON:', parseError);
      return NextResponse.json(
        {
          success: false,
          error: "Invalid JSON response from PCX API",
          rawResponse: responseText.substring(0, 500),
          parseError: parseError.message
        },
        { status: 500 }
      );
    }
    
    if (!response.ok) {
      
      // If unauthorized, provide specific error message
      if (response.status === 401) {
        return NextResponse.json(
          {
            success: false,
            error: "Authentication failed with PCX API. Please check credentials.",
            details: data
          },
          { status: 401 }
        );
      }
      
      return NextResponse.json(
        {
          success: false,
          error: `PCX API error: ${response.status} - ${response.statusText}`,
          details: data
        },
        { status: response.status }
      );
    }
    
    // Process the response to find the specific exchange rate
    let rate = null;
    console.log('🔍 Looking for rate from', from, 'to', to);
    
    // Handle different response structures
    if (Array.isArray(data)) {
      // Direct array of rates
      const foundRate = data.find(r => 
        (r.fromCurrency === from || r.from === from || r.base === from) && 
        (r.toCurrency === to || r.to === to || r.target === to)
      );
      rate = foundRate?.rate || foundRate?.exchangeRate || foundRate?.value;
      console.log('📊 Found rate in array:', foundRate);
    } else if (data && data.rates && Array.isArray(data.rates)) {
      // Rates in data.rates array
      const foundRate = data.rates.find(r => 
        (r.fromCurrency === from || r.from === from || r.base === from) && 
        (r.toCurrency === to || r.to === to || r.target === to)
      );
      rate = foundRate?.rate || foundRate?.exchangeRate || foundRate?.value;
      console.log('📊 Found rate in data.rates:', foundRate);
    } else if (data && data.data && Array.isArray(data.data)) {
      // Rates in data.data array
      const foundRate = data.data.find(r => 
        (r.fromCurrency === from || r.from === from || r.base === from) && 
        (r.toCurrency === to || r.to === to || r.target === to)
      );
      rate = foundRate?.rate || foundRate?.exchangeRate || foundRate?.value;
      console.log('📊 Found rate in data.data:', foundRate);
    } else {
      // Try direct property access
      rate = data?.result?.rate || 
             data?.rate || 
             data?.exchangeRate || 
             data?.data?.rate ||
             data?.data?.exchangeRate;
      console.log('📊 Found rate via direct access:', rate);
    }
    
    console.log('💱 Final extracted rate:', rate);
    
    if (!rate || isNaN(parseFloat(rate))) {
      console.log('❌ No valid rate found in response');
      
      // Log available rates for debugging
      const availableRates = [];
      if (Array.isArray(data)) {
        availableRates.push(...data.map(r => `${r.fromCurrency || r.from || r.base} → ${r.toCurrency || r.to || r.target}`));
      } else if (data?.rates) {
        availableRates.push(...data.rates.map(r => `${r.fromCurrency || r.from || r.base} → ${r.toCurrency || r.to || r.target}`));
      } else if (data?.data?.rates) {
        availableRates.push(...data.data.rates.map(r => `${r.fromCurrency || r.from || r.base} → ${r.toCurrency || r.to || r.target}`));
      }
      
      console.log('📋 Available rates:', availableRates);
      
      return NextResponse.json(
        {
          success: false,
          error: `No exchange rate found for ${from} to ${to}`,
          availableRates: availableRates.length > 0 ? availableRates : 'Unable to determine available rates',
          requestedPair: `${from} → ${to}`,
          dataStructure: Object.keys(data || {})
        },
        { status: 404 }
      );
    }
    
    const converted = parseFloat(amount) * parseFloat(rate);
    console.log('✅ Conversion successful:', { amount, rate, converted });
    
    return NextResponse.json({
      success: true,
      from,
      to,
      amount: parseFloat(amount),
      rate: parseFloat(rate),
      result: converted,
      provider: 'PCX',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ PCX conversion error (full):', error);
    console.error('❌ Error stack:', error.stack);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to convert currency',
        errorType: error.name,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { from, to, amount } = body;

    if (!from || !to || !amount) {
      return NextResponse.json(
        { 
          success: false,
          error: "Missing 'from', 'to', or 'amount' in request body",
          example: { from: 'USD', to: 'EUR', amount: 100 }
        },
        { status: 400 }
      );
    }

    if (amount <= 0) {
      return NextResponse.json(
        { 
          success: false,
          error: "Amount must be greater than 0"
        },
        { status: 400 }
      );
    }

    // Get JWT token by authenticating
    let jwtToken;
    try {
      jwtToken = await getAuthToken();
    } catch (authError) {
      return NextResponse.json(
        {
          success: false,
          error: "Failed to authenticate with PCX API",
          details: authError.message
        },
        { status: 401 }
      );
    }

    const PCX_URL = process.env.PCX_API_URL || 'https://devs.pcxpay.com/v1';
    const url = `${PCX_URL}/exchange-rates/all`;
    
    console.log('Making POST request to PCX URL:', url);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwtToken}`,
      },
    });
    
    console.log('PCX POST response status:', response.status);
    
    if (!response.ok) {
      if (response.status === 401) {
        return NextResponse.json(
          {
            success: false,
            error: "Authentication failed with PCX API."
          },
          { status: 401 }
        );
      }
      throw new Error(`PCX API error: ${response.status} - ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('PCX POST response data keys:', Object.keys(data || {}));
    
    // Find the specific rate from all rates
    let rate = null;
    
    if (Array.isArray(data)) {
      const foundRate = data.find(r => 
        (r.fromCurrency === from || r.from === from) && 
        (r.toCurrency === to || r.to === to)
      );
      rate = foundRate?.rate || foundRate?.exchangeRate;
    } else if (data && data.rates && Array.isArray(data.rates)) {
      const foundRate = data.rates.find(r => 
        (r.fromCurrency === from || r.from === from) && 
        (r.toCurrency === to || r.to === to)
      );
      rate = foundRate?.rate || foundRate?.exchangeRate;
    }
        
    if (!rate) {
      return NextResponse.json(
        {
          success: false,
          error: `No exchange rate found for ${from} to ${to}`,
          details: data
        },
        { status: 404 }
      );
    }
    
    const converted = parseFloat(amount) * parseFloat(rate);
    
    return NextResponse.json({
      success: true,
      from,
      to,
      amount: parseFloat(amount),
      rate: parseFloat(rate),
      result: converted,
      provider: 'PCX',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ PCX POST conversion error:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to convert currency',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}