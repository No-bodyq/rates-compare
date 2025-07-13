import { NextResponse } from 'next/server';

async function getWiseRate(base, target, amount) {
  // Replace with actual Wise API integration
  try {
    // Example API call - replace with real Wise API
    const response = await fetch('https://api.wise.com/v1/rates', {
      method: 'POST',
      headers: {
        // 'Authorization': `Bearer ${process.env.WISE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        source: base,
        target: target,
        sourceAmount: amount
      })
    });
    
    const data = await response.json();
    return {
      provider: 'Wise',
      rate: data.rate,
      fee: data.fee,
      amountReceived: data.targetAmount
    };
  } catch (error) {
    console.error('Wise API error:', error);
    return null;
  }
}

async function getXERate(base, target, amount) {
  // Replace with actual XE API integration
  try {
    const response = await fetch(`https://xecdapi.xe.com/v1/convert_from?from=${base}&to=${target}&amount=${amount}`, {
      headers: {
        'Authorization': `Basic ${Buffer.from(process.env.XE_ACCOUNT_ID + ':' + process.env.XE_API_KEY).toString('base64')}`
      }
    });
    
    const data = await response.json();
    return {
      provider: 'XE',
      rate: data.to[0].mid,
      fee: 0,
      amountReceived: data.to[0].mid * amount
    };
  } catch (error) {
    console.error('XE API error:', error);
    return null;
  }
}

async function getRemitlyRate(base, target, amount) {
  // Replace with actual Remitly API integration
  try {
    const response = await fetch('https://api.remitly.com/v1/rates', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.REMITLY_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from_currency: base,
        to_currency: target,
        send_amount: amount
      })
    });
    
    const data = await response.json();
    return {
      provider: 'Remitly',
      rate: data.exchange_rate,
      fee: data.fee,
      amountReceived: data.receive_amount
    };
  } catch (error) {
    console.error('Remitly API error:', error);
    return null;
  }
}

async function getFallbackRate(base, target, amount) {
  // Fallback to free API
  try {
    const response = await fetch(`https://api.exchangerate-api.com/v4/latest/${base}`);
    const data = await response.json();
    
    if (data.rates && data.rates[target]) {
      const rate = data.rates[target];
      return {
        provider: 'Market Rate',
        rate: rate,
        fee: 0,
        amountReceived: rate * amount
      };
    }
    return null;
  } catch (error) {
    console.error('Fallback API error:', error);
    return null;
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const base = searchParams.get('base');
    const target = searchParams.get('target');
    const amount = parseFloat(searchParams.get('amount')) || 1000;
    
    if (!base || !target) {
      return NextResponse.json(
        { error: 'Base and target currencies are required' },
        { status: 400 }
      );
    }
    
    // Fetch rates from multiple providers in parallel
    const ratePromises = [
      getWiseRate(base, target, amount),
      getXERate(base, target, amount),
      getRemitlyRate(base, target, amount),
      getFallbackRate(base, target, amount)
    ];
    
    const results = await Promise.allSettled(ratePromises);
    
    const rates = results
      .filter(result => result.status === 'fulfilled' && result.value !== null)
      .map(result => ({
        ...result.value,
        timestamp: new Date().toISOString(),
        base,
        target,
        amount
      }));
    
    // Find best rate (highest amount received)
    const bestRate = rates.length > 0 
      ? rates.reduce((best, current) => 
          current.amountReceived > best.amountReceived ? current : best
        )
      : null;
    
    return NextResponse.json({
      success: true,
      rates,
      bestRate,
      base,
      target,
      amount,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to fetch comparison rates' 
      },
      { status: 500 }
    );
  }
}