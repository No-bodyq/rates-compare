import puppeteer from "puppeteer";
import chromium from '@sparticuz/chromium';

class CoinbaseRateScraperService {
  constructor(options) {
    // Validate constructor options
    if (!options || typeof options !== 'object') {
      throw new Error("options object is required");
    }
    if (!Number.isInteger(options.maxRetries) || options.maxRetries < 1) {
      throw new Error("maxRetries is required and must be a positive integer");
    }
    if (!Number.isInteger(options.retryDelay) || options.retryDelay < 0) {
      throw new Error("retryDelay is required and must be a non-negative integer");
    }
    if (!Number.isInteger(options.pageTimeout) || options.pageTimeout < 1000) {
      throw new Error("pageTimeout is required and must be at least 1000ms");
    }

    this.browser = null;
    this.maxRetries = options.maxRetries;
    this.retryDelay = options.retryDelay;
    this.pageTimeout = options.pageTimeout;
    this.isInitializing = false;
    this.isServerless = options.isServerless || false;

    this.services = {
      coinbase: {
        baseUrl: "https://www.coinbase.com/converter",
        name: "Coinbase"
      }
    };

    // Coinbase supported currencies (focusing on crypto and major fiat)
    this.supportedCurrencies = [
      // Fiat currencies
      'USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF', 'SEK', 'NOK', 'DKK',
      'NGN', 'KES', 'ZAR', 'GHS', 'UGX', 'TZS', 'INR', 'BRL', 'MXN',
      // Cryptocurrencies
      'BTC', 'ETH', 'USDC', 'USDT', 'LTC', 'BCH', 'XRP', 'ADA', 'DOT', 'LINK',
      'UNI', 'AAVE', 'COMP', 'MKR', 'SNX', 'YFI', 'SUSHI', 'CRV', 'BAL'
    ];

    // Currency normalization map
    this.currencyNormalizationMap = {
      'KSH': 'KES',
      'KES': 'KES'
    };
  }

  // Normalize currency code
  normalizeCurrency(currency) {
    return this.currencyNormalizationMap[currency] || currency.toUpperCase();
  }

  async initialize() {
    if (this.browser && !this.browser.disconnected) {
      return;
    }

    if (this.isInitializing) {
      while (this.isInitializing) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return;
    }

    this.isInitializing = true;

    try {
      console.log('🔧 Initializing Coinbase scraper browser...');

      let browserOptions;

      if (this.isServerless || process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
        console.log('🔧 Configuring for serverless environment...');
        browserOptions = {
          args: [
            ...chromium.args,
            '--hide-scrollbars',
            '--disable-web-security',
            '--no-first-run',
            '--no-default-browser-check',
            '--disable-default-apps',
            '--disable-popup-blocking',
            '--disable-translate',
            '--disable-background-timer-throttling',
            '--disable-renderer-backgrounding',
            '--disable-backgrounding-occluded-windows',
            '--disable-ipc-flooding-protection',
          ],
          defaultViewport: chromium.defaultViewport,
          executablePath: await chromium.executablePath(),
          headless: chromium.headless,
          ignoreHTTPSErrors: true,
          timeout: 30000
        };
      } else {
        console.log('🔧 Configuring for local environment...');
        browserOptions = {
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
            '--disable-background-timer-throttling',
            '--disable-renderer-backgrounding',
            '--disable-backgrounding-occluded-windows'
          ],
          timeout: 30000
        };
      }

      this.browser = await puppeteer.launch(browserOptions);
      console.log('✅ Coinbase scraper browser initialized successfully');

    } catch (error) {
      console.error('❌ Failed to initialize browser:', error);
      throw error;
    } finally {
      this.isInitializing = false;
    }
  }

  async cleanup() {
    if (this.browser && !this.browser.disconnected) {
      try {
        console.log('🧹 Cleaning up Coinbase scraper browser...');
        await this.browser.close();
        console.log('✅ Coinbase scraper browser cleaned up');
      } catch (error) {
        console.error('⚠️ Error during cleanup:', error.message);
      } finally {
        this.browser = null;
      }
    }
  }

  async createPage() {
    if (!this.browser || this.browser.disconnected) {
      await this.initialize();
    }

    let page;
    try {
      page = await this.browser.newPage();

      // Set user agent
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

      // Set viewport
      await page.setViewport({ width: 1366, height: 768 });

      // Set timeouts
      await page.setDefaultNavigationTimeout(this.pageTimeout);
      await page.setDefaultTimeout(this.pageTimeout);

      // Block unnecessary resources for better performance
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        const resourceType = req.resourceType();
        if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
          req.abort();
        } else {
          req.continue();
        }
      });

      // Set additional headers
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      });

      console.log(`🕐 Page timeouts set to: ${this.pageTimeout}ms (${this.pageTimeout / 1000} seconds)`);

      return page;
    } catch (error) {
      console.error('❌ Failed to create page:', error.message);
      if (page) {
        await page.close().catch(err => console.error('⚠️ Error closing page:', err.message));
      }
      throw error;
    }
  }

  // Build the conversion URL based on from and to currencies
  buildConversionUrl(fromCurrency, toCurrency) {
    const normalizedFrom = this.normalizeCurrency(fromCurrency);
    const normalizedTo = this.normalizeCurrency(toCurrency);
    return `${this.services.coinbase.baseUrl}/${normalizedFrom.toLowerCase()}/${normalizedTo.toLowerCase()}`;
  }

  async scrapeConversionRate(fromCurrency, toCurrency, amount = 1) {
    if (!fromCurrency || !toCurrency) {
      throw new Error("fromCurrency and toCurrency are required");
    }
    if (isNaN(amount) || amount <= 0) {
      throw new Error("amount must be a positive number");
    }

    const normalizedFrom = this.normalizeCurrency(fromCurrency);
    const normalizedTo = this.normalizeCurrency(toCurrency);

    if (!this.supportedCurrencies.includes(normalizedFrom) || !this.supportedCurrencies.includes(normalizedTo)) {
      throw new Error(`Unsupported currency. Supported: ${this.supportedCurrencies.join(', ')}`);
    }

    let page;

    try {
      console.log(`🔄 Scraping Coinbase: ${amount} ${normalizedFrom} → ${normalizedTo}`);

      page = await this.createPage();

      const conversionUrl = this.buildConversionUrl(normalizedFrom, normalizedTo);
      console.log(`🌐 Navigating to: ${conversionUrl}`);

      try {
        await page.goto(conversionUrl, {
          waitUntil: 'networkidle2',
          timeout: this.pageTimeout
        });
        console.log('✅ Navigation successful!');
      } catch (navError) {
        console.log(`⚠️ networkidle2 failed, trying domcontentloaded: ${navError.message}`);
        await page.goto(conversionUrl, {
          waitUntil: 'domcontentloaded',
          timeout: this.pageTimeout
        });
        console.log('✅ Navigation successful with domcontentloaded!');
      }

      // Wait for page to load
      console.log('⏳ Waiting for page to load...');
      await new Promise(resolve => setTimeout(resolve, 5000));

      const pageTitle = await page.title();
      console.log(`📄 Page title: "${pageTitle}"`);

      if (!pageTitle || pageTitle.includes('Error') || pageTitle.includes('404')) {
        throw new Error('Page did not load properly - error page detected');
      }

      // Check if we need to handle cookie consent
      console.log('🍪 Checking for cookie consent...');
      const cookieConsentHandled = await page.evaluate(() => {
        const acceptButtons = Array.from(document.querySelectorAll('button, [role="button"], a'));
        for (const button of acceptButtons) {
          const text = button.textContent?.toLowerCase() || '';
          if (text.includes('accept') && (text.includes('all') || text.includes('cookie'))) {
            console.log('Found cookie consent button:', text);
            button.click();
            return true;
          }
        }
        return false;
      });

      if (cookieConsentHandled) {
        console.log('✅ Cookie consent handled');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // Update amount if different from 1
      if (amount !== 1) {
        console.log(`💰 Setting amount to ${amount}...`);
        const amountUpdated = await page.evaluate((targetAmount, fromCurr) => {
          // Look for input fields that contain the from currency or have value "1"
          const inputs = Array.from(document.querySelectorAll('input[type="text"], input[type="number"], input[inputmode="decimal"]'));
          
          for (const input of inputs) {
            const value = input.value || '';
            const placeholder = input.placeholder || '';
            const ariaLabel = input.getAttribute('aria-label') || '';
            
            // Check if this looks like the amount input
            if (value === '1' || 
                placeholder.toLowerCase().includes(fromCurr.toLowerCase()) ||
                ariaLabel.toLowerCase().includes('amount') ||
                input.name?.toLowerCase().includes('amount')) {
              
              console.log('Found amount input, updating value');
              input.focus();
              input.select();
              input.value = targetAmount.toString();
              
              // Trigger events
              input.dispatchEvent(new Event('input', { bubbles: true }));
              input.dispatchEvent(new Event('change', { bubbles: true }));
              input.dispatchEvent(new Event('blur', { bubbles: true }));
              
              return true;
            }
          }
          return false;
        }, amount, normalizedFrom);

        if (amountUpdated) {
          console.log(`✅ Amount updated to ${amount}`);
          await new Promise(resolve => setTimeout(resolve, 3000));
        } else {
          console.warn('⚠️ Could not find amount input to update');
        }
      }

      // Extract conversion rate and information
      console.log('🔍 Extracting conversion data...');
      const extractedData = await page.evaluate((fromCurr, toCurr, inputAmount) => {
        const data = {
          rates: [],
          debugInfo: [],
          success: false
        };

        data.debugInfo.push('🔍 Starting Coinbase rate extraction...');

        // Get page text for analysis
        const pageText = document.body.textContent || '';
        data.debugInfo.push(`📝 Page text length: ${pageText.length} characters`);

        // Look for the conversion rate display
        // Coinbase typically shows: "1 NGN converts to 0.000652 USDC as of August 19 at 11:28 PM"
        const conversionPatterns = [
          // Pattern 1: "1 NGN converts to X USDC"
          new RegExp(`1\\s+${fromCurr}\\s+converts?\\s+to\\s+([\\d,.]+)\\s+${toCurr}`, 'gi'),
          // Pattern 2: "X.XXXXX USDC" in conversion result
          new RegExp(`([\\d,.]+)\\s+${toCurr}`, 'gi'),
          // Pattern 3: Direct rate pattern "NGN to USDC: X"
          new RegExp(`${fromCurr}\\s+to\\s+${toCurr}[:\\s]+([\\d,.]+)`, 'gi')
        ];

        let conversionRate = null;
        let resultAmount = null;

        // Try to extract from conversion display text
        for (let i = 0; i < conversionPatterns.length; i++) {
          const pattern = conversionPatterns[i];
          const matches = [...pageText.matchAll(pattern)];
          
          data.debugInfo.push(`Pattern ${i + 1}: found ${matches.length} matches`);
          
          if (matches.length > 0) {
            const rate = parseFloat(matches[0][1].replace(/,/g, ''));
            if (rate > 0 && !isNaN(rate)) {
              conversionRate = rate;
              data.debugInfo.push(`Found conversion rate: ${rate} via pattern ${i + 1}`);
              break;
            }
          }
        }

        // Look for the result amount in input fields or display elements
        const resultSelectors = [
          'input[type="text"]',
          'input[type="number"]',
          'input[inputmode="decimal"]',
          '[data-testid*="result"]',
          '[class*="result"]',
          '[class*="output"]',
          'span',
          'div'
        ];

        for (const selector of resultSelectors) {
          const elements = document.querySelectorAll(selector);
          for (const element of elements) {
            let elementValue = '';
            
            if (element.tagName === 'INPUT') {
              elementValue = element.value || '';
            } else {
              elementValue = element.textContent || '';
            }

            // Check if this contains our target currency and a number
            if (elementValue.includes(toCurr) || 
                (element.placeholder && element.placeholder.includes(toCurr))) {
              
              const numberMatch = elementValue.match(/([\\d,.]+)/);
              if (numberMatch) {
                const amount = parseFloat(numberMatch[1].replace(/,/g, ''));
                if (amount > 0 && !isNaN(amount)) {
                  resultAmount = amount;
                  data.debugInfo.push(`Found result amount: ${amount} from ${element.tagName}`);
                  
                  // Calculate rate if we don't have it yet
                  if (!conversionRate && inputAmount) {
                    conversionRate = amount / inputAmount;
                    data.debugInfo.push(`Calculated rate: ${conversionRate} (${amount}/${inputAmount})`);
                  }
                  break;
                }
              }
            }
          }
          if (resultAmount) break;
        }

        // If we have a rate, create the rate object
        if (conversionRate && conversionRate > 0) {
          const finalResultAmount = resultAmount || (conversionRate * inputAmount);
          
          data.rates.push({
            provider: 'Coinbase',
            rate: conversionRate,
            recipientReceives: finalResultAmount,
            currency: toCurr,
            timestamp: new Date().toISOString(),
            extractedFrom: 'Coinbase converter page',
            rawValue: conversionRate.toString()
          });
          
          data.success = true;
          data.debugInfo.push(`✅ Successfully extracted: ${conversionRate} → ${finalResultAmount} ${toCurr}`);
        } else {
          data.debugInfo.push('❌ No valid conversion rate found');
          
          // Additional debugging - log some sample content
          const sampleInputs = Array.from(document.querySelectorAll('input')).slice(0, 5);
          data.debugInfo.push(`Sample inputs: ${sampleInputs.map(i => `${i.type}="${i.value}" placeholder="${i.placeholder}"`).join(', ')}`);
          
          const sampleText = pageText.substring(0, 500);
          data.debugInfo.push(`Sample page text: "${sampleText}..."`);
        }

        return data;
      }, normalizedFrom, normalizedTo, amount);

      // Log debug information
      console.log('🐛 Extraction Debug Info:');
      extractedData.debugInfo.forEach(line => console.log(line));

      return {
        success: extractedData.success,
        fromCurrency: normalizedFrom,
        toCurrency: normalizedTo,
        amount: amount,
        extractedRates: extractedData.rates,
        url: conversionUrl,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error(`❌ Coinbase scraping failed: ${error.message}`);
      return {
        success: false,
        error: error.message,
        fromCurrency: normalizedFrom,
        toCurrency: normalizedTo,
        amount: amount,
        extractedRates: [],
        url: this.buildConversionUrl(normalizedFrom, normalizedTo),
        timestamp: new Date().toISOString()
      };
    } finally {
      if (page) {
        await page.close().catch(err => console.error('⚠️ Error closing page:', err.message));
        console.log('✅ Page closed');
      }
    }
  }

  async scrapeRatesWithRetry(fromCurrency, toCurrency, amount = 1) {
    let lastError = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        console.log(`🔄 Coinbase Attempt ${attempt}/${this.maxRetries}: ${amount} ${fromCurrency} → ${toCurrency}`);

        const result = await this.scrapeConversionRate(fromCurrency, toCurrency, amount);

        if (result.success) {
          console.log(`✅ Coinbase scraping successful on attempt ${attempt}`);
          return result;
        } else {
          console.log(`❌ Coinbase scraping failed on attempt ${attempt}: ${result.error}`);
          lastError = new Error(result.error || 'Unknown error');
        }

        if (attempt < this.maxRetries) {
          const delay = this.retryDelay * attempt;
          console.log(`⏳ Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } catch (error) {
        console.error(`❌ Unexpected error on attempt ${attempt}:`, error.message);
        lastError = error;

        if (attempt < this.maxRetries) {
          const delay = this.retryDelay * attempt;
          console.log(`⏳ Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    console.error(`❌ All ${this.maxRetries} Coinbase attempts failed. Last error:`, lastError?.message);
    return {
      success: false,
      error: lastError?.message || 'All retry attempts failed',
      fromCurrency: this.normalizeCurrency(fromCurrency),
      toCurrency: this.normalizeCurrency(toCurrency),
      amount: amount,
      extractedRates: [],
      timestamp: new Date().toISOString()
    };
  }

  async getAllRates(fromCurrency, toCurrency, amount = 1) {
    const result = await this.scrapeRatesWithRetry(fromCurrency, toCurrency, amount);

    const rates = result.extractedRates.map(rate => ({
      provider: rate.provider,
      rate: rate.rate,
      recipientReceives: rate.recipientReceives,
      currency: rate.currency,
      fees: null, // Coinbase fees are typically included in the rate
      timestamp: rate.timestamp,
      service: 'coinbase',
      extractedFrom: rate.extractedFrom,
      rawValue: rate.rawValue
    }));

    const status = result.success && rates.length > 0 ? 'success' : 'error';
    const errors = [];
    
    if (!result.success || rates.length === 0) {
      errors.push({ 
        service: 'coinbase', 
        error: result.error || 'No rates extracted' 
      });
    }

    return {
      status: status,
      fromCurrency: result.fromCurrency,
      toCurrency: result.toCurrency,
      amount: result.amount,
      timestamp: new Date().toISOString(),
      rates: rates,
      errors: errors,
      debug: {
        url: result.url,
        success: result.success,
        error: result.error
      }
    };
  }

  async getAvailableCurrencies() {
    return {
      success: true,
      currencies: [
        // Fiat currencies
        { code: 'USD', name: 'US Dollar', symbol: '$', type: 'fiat' },
        { code: 'EUR', name: 'Euro', symbol: '€', type: 'fiat' },
        { code: 'GBP', name: 'British Pound', symbol: '£', type: 'fiat' },
        { code: 'NGN', name: 'Nigerian Naira', symbol: '₦', type: 'fiat' },
        { code: 'KES', name: 'Kenyan Shilling', symbol: 'KSh', type: 'fiat' },
        { code: 'GHS', name: 'Ghanaian Cedi', symbol: 'GH₵', type: 'fiat' },
        { code: 'UGX', name: 'Ugandan Shilling', symbol: 'USh', type: 'fiat' },
        { code: 'TZS', name: 'Tanzanian Shilling', symbol: 'TZS', type: 'fiat' },
        { code: 'ZAR', name: 'South African Rand', symbol: 'R', type: 'fiat' },
        { code: 'INR', name: 'Indian Rupee', symbol: '₹', type: 'fiat' },
        
        // Cryptocurrencies
        { code: 'BTC', name: 'Bitcoin', symbol: '₿', type: 'crypto' },
        { code: 'ETH', name: 'Ethereum', symbol: 'Ξ', type: 'crypto' },
        { code: 'USDC', name: 'USD Coin', symbol: 'USDC', type: 'crypto' },
        { code: 'USDT', name: 'Tether', symbol: 'USDT', type: 'crypto' },
        { code: 'LTC', name: 'Litecoin', symbol: 'Ł', type: 'crypto' },
        { code: 'BCH', name: 'Bitcoin Cash', symbol: 'BCH', type: 'crypto' },
        { code: 'XRP', name: 'Ripple', symbol: 'XRP', type: 'crypto' },
        { code: 'ADA', name: 'Cardano', symbol: 'ADA', type: 'crypto' },
      ],
      supportedPairs: [
        'Any fiat to crypto',
        'Any crypto to fiat', 
        'Any crypto to crypto',
        'Limited fiat to fiat (major currencies)'
      ]
    };
  }

  async healthCheck() {
    try {
      if (this.browser && !this.browser.disconnected) {
        return {
          status: 'healthy',
          browser: 'connected',
          service: 'coinbase',
          timestamp: new Date().toISOString()
        };
      } else {
        return {
          status: 'degraded',
          browser: 'disconnected',
          service: 'coinbase',
          message: 'Browser not initialized',
          timestamp: new Date().toISOString()
        };
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        service: 'coinbase',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  getServiceInfo() {
    return {
      name: 'CoinbaseRateScraperService',
      version: '1.0.0',
      description: 'Scrapes cryptocurrency and fiat conversion rates from Coinbase',
      supportedServices: ['coinbase'],
      features: [
        'Direct URL-based conversion scraping',
        'Support for both fiat and cryptocurrency conversions',
        'Automatic cookie consent handling',
        'Amount input modification for custom conversion amounts',
        'Comprehensive rate extraction with multiple fallback patterns',
        'Resource blocking for improved performance',
        'Retry mechanism with exponential backoff',
        'Detailed debug information and logging'
      ],
      currencyHandling: {
        normalization: this.currencyNormalizationMap,
        supportedCurrencies: this.supportedCurrencies,
        specialties: [
          'Cryptocurrency conversions',
          'African fiat currencies',
          'Major global fiat currencies'
        ]
      },
      configuration: {
        maxRetries: this.maxRetries,
        retryDelay: this.retryDelay,
        pageTimeout: this.pageTimeout,
        headless: true,
        resourceBlocking: true
      }
    };
  }
}

export default CoinbaseRateScraperService;