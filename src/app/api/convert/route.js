import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const amount = parseFloat(searchParams.get('amount'));

    if (!from || !to || !amount) {
      return NextResponse.json(
        { 
          success: false,
          error: "Missing 'from', 'to', or 'amount' parameters",
          example: '/api/convert?from=USD&to=EUR&amount=100'
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

    // Get API key from environment
    const API_KEY = process.env.FASTFOREX_API_KEY;
    
    if (!API_KEY) {
      return NextResponse.json(
        { 
          success: false,
          error: 'FastForex API key not configured'
        },
        { status: 500 }
      );
    }

    // Call FastForex API
    const url = `https://api.fastforex.io/convert?from=${from}&to=${to}&amount=${amount}&api_key=${API_KEY}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`FastForex API error: ${response.status}`);
    }
    
    const data = await response.json();
    const rate = data?.result?.rate;
    
    console.log('FastForex conversion rate:', rate);
    
    if (!rate) {
      return NextResponse.json(
        {
          success: false,
          error: "Failed to retrieve rate from FastForex",
          details: data
        },
        { status: 500 }
      );
    }
    
    const converted = parseFloat(amount) * rate;
    
    return NextResponse.json({
      success: true,
      from,
      to,
      amount: parseFloat(amount),
      rate,
      result: converted,
      provider: 'FastForex',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ FastForex conversion error:', error);
    
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

    // Get API key from environment
    const API_KEY = process.env.FASTFOREX_API_KEY;
    
    if (!API_KEY) {
      return NextResponse.json(
        { 
          success: false,
          error: 'FastForex API key not configured'
        },
        { status: 500 }
      );
    }

    const url = `https://api.fastforex.io/convert?from=${from}&to=${to}&amount=${amount}&api_key=${API_KEY}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`FastForex API error: ${response.status}`);
    }
    
    const data = await response.json();
    const rate = data?.result?.rate;
        
    if (!rate) {
      return NextResponse.json(
        {
          success: false,
          error: "Failed to retrieve rate from FastForex",
          details: data
        },
        { status: 500 }
      );
    }
    
    const converted = parseFloat(amount) * rate;
    
    return NextResponse.json({
      success: true,
      from,
      to,
      amount: parseFloat(amount),
      rate,
      result: converted,
      provider: 'FastForex',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ FastForex conversion error:', error);
    
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