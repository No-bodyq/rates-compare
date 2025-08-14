import { NextResponse } from 'next/server';
import NalaRateScraperService from '../../../lib/services/WebScraperAPIs';

let scraperInstance = null;
let isInitializing = false;

async function getScraperInstance() {
  if (isInitializing) {
    while (isInitializing) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return scraperInstance;
  }

  if (!scraperInstance) {
    isInitializing = true;
    try {
      
      const isServerless = !!(
        process.env.VERCEL || 
        process.env.AWS_LAMBDA_FUNCTION_NAME || 
        process.env.NETLIFY ||
        process.env.NODE_ENV === 'production'
      );
      
      scraperInstance = new NalaRateScraperService({
        maxRetries: 2,
        retryDelay: 3000,
        pageTimeout: 300000, // 5 minutes
        isServerless: isServerless
      });
      
      await scraperInstance.initialize();
    } catch (error) {
      scraperInstance = null;
      throw error;
    } finally {
      isInitializing = false;
    }
  }
  
  return scraperInstance;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const base = searchParams.get('base');
    const target = searchParams.get('target');
    const amount = parseFloat(searchParams.get('amount')) || 1000;
    const onlySendwave = searchParams.get('sendwave') === 'true';

    if (!base || !target) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Base and target currencies are required',
          example: '/api/scrape-rates?base=USD&target=KES&amount=1000'
        },
        { status: 400 }
      );
    }

    const scraper = await getScraperInstance();

    let result;
    if (onlySendwave) {
      result = await scraper.getSendwaveRateOnly(base, target, amount);
    } else {
      result = await scraper.scrapeAllRates(base, target, amount);
    }

    return NextResponse.json({
      success: result.status === 'success',
      data: {
        fromCurrency: result.fromCurrency,
        toCurrency: result.toCurrency,
        amount: result.amount,
        timestamp: result.timestamp,
        rates: result.rates || [],
        errors: result.errors || [],
        totalRates: result.rates?.length || 0
      },
      debug: process.env.NODE_ENV === 'development' ? result.debug : undefined
    });

  } catch (error) {
    
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to scrape rates',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { base, target, amount, sendwaveOnly } = body;


    // Validation
    if (!base || !target) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Base and target currencies are required in request body',
          example: { base: 'USD', target: 'KES', amount: 1000, sendwaveOnly: false }
        },
        { status: 400 }
      );
    }

    // scraper instance
    const scraper = await getScraperInstance();

    // Choose method based on request
    let result;
    if (sendwaveOnly) {
      result = await scraper.getSendwaveRateOnly(base, target, amount || 1000);
    } else {
      result = await scraper.scrapeAllRates(base, target, amount || 1000);
    }

    return NextResponse.json({
      success: result.status === 'success',
      data: {
        fromCurrency: result.fromCurrency,
        toCurrency: result.toCurrency,
        amount: result.amount,
        timestamp: result.timestamp,
        rates: result.rates || [],
        errors: result.errors || [],
        totalRates: result.rates?.length || 0
      },
      debug: process.env.NODE_ENV === 'development' ? result.debug : undefined
    });

  } catch (error) {    
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to scrape rates',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

// Health check endpoint
export async function HEAD(request) {
  try {
    if (scraperInstance) {
      const health = await scraperInstance.healthCheck();
      return new Response(null, { 
        status: health.status === 'healthy' ? 200 : 503,
        headers: { 'X-Health': health.status }
      });
    } else {
      return new Response(null, { 
        status: 503,
        headers: { 'X-Health': 'not-initialized' }
      });
    }
  } catch (error) {
    return new Response(null, { 
      status: 503,
      headers: { 'X-Health': 'error' }
    });
  }
}