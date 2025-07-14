import puppeteer from "puppeteer";

class NalaRateScraperService {
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

    this.services = {
      nala: {
        baseUrl: "https://www.nala.com",
        name: "Nala"
      }
    };

    this.supportedCurrencies = [
      'USD', 'GBP', 'EUR', 'NGN', 'KES', 'KSH', 'UGX', 'TZS'
    ];
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
      console.log('🔧 Initializing browser...');
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage'
        ],
        timeout: 30000
      });
      console.log('✅ Browser initialized successfully');
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
        console.log('🧹 Cleaning up browser...');
        await this.browser.close();
        console.log('✅ Browser cleaned up');
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

      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      await page.setViewport({ width: 1366, height: 768 });

      await page.setDefaultNavigationTimeout(this.pageTimeout);
      await page.setDefaultTimeout(this.pageTimeout);

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

  async testCurrencySelection(fromCurrency, toCurrency, amount) {
    if (!fromCurrency || !toCurrency || !amount) {
      throw new Error("fromCurrency, toCurrency, and amount are required");
    }
    if (isNaN(amount) || amount <= 0) {
      throw new Error("amount must be a positive number");
    }
    if (!this.supportedCurrencies.includes(fromCurrency) || !this.supportedCurrencies.includes(toCurrency)) {
      throw new Error(`Unsupported currency. Supported: ${this.supportedCurrencies.join(', ')}`);
    }

    let page;

    try {
      console.log(`🧪 Currency selection: ${amount} ${fromCurrency} → ${toCurrency}`);

      page = await this.createPage();

      console.log('🌐 Navigating to Nala...');
      try {
        await page.goto(this.services.nala.baseUrl, {
          waitUntil: 'networkidle2',
          timeout: this.pageTimeout
        });
        console.log('✅ Navigation successful!');
      } catch (navError) {
        console.log(`⚠️ networkidle2 failed, trying domcontentloaded: ${navError.message}`);
        await page.goto(this.services.nala.baseUrl, {
          waitUntil: 'domcontentloaded',
          timeout: this.pageTimeout
        });
        console.log('✅ Navigation successful with domcontentloaded!');
      }

      console.log('⏳ Waiting for page to load completely...');
      await new Promise(resolve => setTimeout(resolve, 8000));

      const pageTitle = await page.title();
      console.log(`📄 Page title: "${pageTitle}"`);

      if (!pageTitle || pageTitle.includes('Error')) {
        throw new Error('Page did not load properly - no title or error page');
      }

      console.log(`💰 Step 1: Setting amount to ${amount}...`);
      const amountSet = await page.evaluate((targetAmount) => {
        const inputs = Array.from(document.querySelectorAll('input'));

        for (const input of inputs) {
          const type = input.type || '';
          const value = input.value || '';

          if (type === 'text' && value.includes('1,000')) {
            console.log('Setting amount in input:', input);

            input.focus();
            input.select();
            input.value = '';
            input.value = targetAmount.toString();

            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            input.dispatchEvent(new Event('blur', { bubbles: true }));

            return true;
          }
        }
        return false;
      }, amount);

      if (amountSet) {
        console.log(`✅ Amount set to ${amount}`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      console.log(`💱 Step 2: Selecting FROM currency (${fromCurrency})...`);

      const fromCurrencyResult = await page.evaluate(async (targetCurrency) => {
        const buttons = Array.from(document.querySelectorAll('button'));

        for (const button of buttons) {
          const text = button.textContent?.trim();
          if (text === 'USD' || text === 'GBP' || text === 'EUR') {
            console.log('Clicking FROM currency button:', text);
            button.click();

            await new Promise(resolve => setTimeout(resolve, 2000));

            const options = Array.from(document.querySelectorAll('[role="option"], li, button'));

            for (const option of options) {
              const optionText = option.textContent?.trim();

              if (optionText && (optionText.includes(targetCurrency) ||
                (targetCurrency === 'GBP' && optionText.includes('British Pound')) ||
                (targetCurrency === 'EUR' && optionText.includes('Euro')) ||
                (targetCurrency === 'USD' && optionText.includes('US Dollar')))) {
                console.log('Found and clicking target currency option:', optionText);
                option.click();
                return { buttonClicked: true, optionSelected: true, optionText: optionText };
              }
            }

            return { buttonClicked: true, optionSelected: false, options: options.map(o => o.textContent?.trim()).slice(0, 5) };
          }
        }
        return { buttonClicked: false, optionSelected: false };
      }, fromCurrency);

      console.log(`🔧 FROM currency result:`, fromCurrencyResult);

      if (fromCurrencyResult.buttonClicked) {
        console.log(`✅ FROM currency button clicked`);
        await new Promise(resolve => setTimeout(resolve, 3000));
      }

      console.log(`💱 Step 3: Selecting TO currency (${toCurrency})...`);

      const toCurrencyResult = await page.evaluate(async (targetCurrency) => {
        const buttons = Array.from(document.querySelectorAll('button'));
        
        // Find the TO currency button (usually the second currency button or one that's not USD/GBP/EUR)
        const toCurrencyButtons = buttons.filter(button => {
          const text = button.textContent?.trim();
          return text && /^[A-Z]{3}$/.test(text) && !['USD', 'GBP', 'EUR'].includes(text);
        });

        console.log('TO currency buttons found:', toCurrencyButtons.map(b => b.textContent?.trim()));

        // Try the most likely TO currency button first
        for (const button of toCurrencyButtons) {
          const text = button.textContent?.trim();
          console.log('Clicking TO currency button:', text);
          button.click();
          await new Promise(resolve => setTimeout(resolve, 3000));

          // Look for options in dropdown/modal
          const selectors = [
            '[role="option"]',
            'li',
            'button',
            '.option',
            '[data-option]',
            'div[role="menuitem"]'
          ];

          let options = [];
          for (const selector of selectors) {
            const elements = Array.from(document.querySelectorAll(selector));
            options = options.concat(elements);
          }

          console.log(`Found ${options.length} potential options`);

          // Enhanced currency matching
          const currencyMatches = {
            'NGN': ['NGN', 'naira', 'nigeria', 'nigerian'],
            'KES': ['KES', 'KSH', 'kenyan', 'kenya', 'shilling'],
            'UGX': ['UGX', 'ugandan', 'uganda'],
            'TZS': ['TZS', 'tanzanian', 'tanzania']
          };

          const searchTerms = currencyMatches[targetCurrency] || [targetCurrency];

          for (const option of options) {
            const optionText = option.textContent?.trim().toLowerCase();

            if (optionText && searchTerms.some(term => optionText.includes(term.toLowerCase()))) {
              console.log('Found and clicking target TO currency option:', optionText);
              option.click();
              await new Promise(resolve => setTimeout(resolve, 2000));
              return { buttonClicked: true, optionSelected: true, optionText: optionText };
            }
          }

          // If no match found, log available options for debugging
          console.log('Available options:', options.slice(0, 10).map(o => o.textContent?.trim()));
          
          // Try clicking elsewhere to close dropdown and try next button
          document.body.click();
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        return { buttonClicked: toCurrencyButtons.length > 0, optionSelected: false };
      }, toCurrency);

      console.log(`🔧 TO currency result:`, toCurrencyResult);

      if (toCurrencyResult.buttonClicked) {
        console.log(`✅ TO currency button clicked`);
        await new Promise(resolve => setTimeout(resolve, 3000));
      }

      console.log('🔍 Step 4: Checking final currency selection...');
      const finalState = await page.evaluate(() => {
        const currencyButtons = Array.from(document.querySelectorAll('button')).filter(b => {
          const text = b.textContent?.trim();
          return text && text.length === 3 && /^[A-Z]{3}$/.test(text);
        });

        const rateDisplays = document.body.textContent.match(/1\s+[A-Z]{3}\s*≈\s*[\d,.]+\s+[A-Z]{3}/g) || [];
        
        // Also check what currencies are actually being displayed
        const displayedCurrencies = [];
        const currencyPattern = /\b[A-Z]{3}\b/g;
        const currencyMatches = [...document.body.textContent.matchAll(currencyPattern)];
        const uniqueCurrencies = [...new Set(currencyMatches.map(m => m[0]))].filter(c => 
          ['USD', 'GBP', 'EUR', 'NGN', 'KES', 'UGX', 'TZS'].includes(c)
        );

        return {
          selectedCurrencies: currencyButtons.map(b => b.textContent?.trim()),
          rateDisplay: rateDisplays,
          allCurrenciesFound: uniqueCurrencies
        };
      });

      console.log('📋 Final currency state:');
      console.log(`  Selected currencies: ${finalState.selectedCurrencies.join(' → ')}`);
      console.log(`  Rate displays: ${finalState.rateDisplay.join(', ')}`);
      console.log(`  All currencies detected: ${finalState.allCurrenciesFound.join(', ')}`);

      // Validate that we have the correct target currency
      if (!finalState.allCurrenciesFound.includes(toCurrency)) {
        console.log(`⚠️ Warning: Target currency ${toCurrency} not found on page, found: ${finalState.allCurrenciesFound.join(', ')}`);
        console.log('🔄 Attempting to retry currency selection...');
        
        // Try one more time with more aggressive selection
        await page.evaluate(async (targetCurrency) => {
          // Look for any element containing the target currency
          const allElements = Array.from(document.querySelectorAll('*'));
          const currencyElements = allElements.filter(el => {
            const text = el.textContent || '';
            return text.includes(targetCurrency) || 
                   (targetCurrency === 'KES' && text.toLowerCase().includes('kenya')) ||
                   (targetCurrency === 'UGX' && text.toLowerCase().includes('uganda')) ||
                   (targetCurrency === 'TZS' && text.toLowerCase().includes('tanzania'));
          });
          
          console.log(`Found ${currencyElements.length} elements containing ${targetCurrency}`);
          
          for (const el of currencyElements.slice(0, 3)) {
            if (el.tagName === 'BUTTON' || el.onclick || el.style.cursor === 'pointer') {
              console.log('Clicking currency element:', el.textContent?.trim());
              el.click();
              await new Promise(resolve => setTimeout(resolve, 2000));
              break;
            }
          }
        }, toCurrency);
        
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      console.log('🔍 Step 5: Looking for Compare rates tab...');
      const compareRatesClicked = await page.evaluate(() => {
        const allElements = Array.from(document.querySelectorAll('*'));
        const compareElements = allElements.filter(el => {
          const text = (el.textContent || '').toLowerCase();
          return text.includes('compare') && text.includes('rate');
        });

        if (compareElements.length > 0) {
          for (const el of compareElements) {
            if (el.tagName === 'BUTTON' ||
              el.onclick ||
              el.style.cursor === 'pointer' ||
              el.getAttribute('role') === 'button' ||
              el.className.includes('button') ||
              el.className.includes('tab')) {

              console.log('Clicking compare rates element:', el.textContent.trim());
              el.click();
              return true;
            }
          }
        }
        return false;
      });

      if (compareRatesClicked) {
        console.log('✅ Compare rates tab clicked');
        await new Promise(resolve => setTimeout(resolve, 5000));

        console.log('🔍 Step 6: Enhanced rate extraction for all providers...');

        await new Promise(resolve => setTimeout(resolve, 3000));

        const extractedRates = await page.evaluate((toCurrency) => {
          const rates = [];
          const debugInfo = [];

          debugInfo.push('🔍 FIXED: Starting rate extraction (Dynamic GMT approach)...');

          const pageText = document.body.textContent || '';
          debugInfo.push(`📝 Page text length: ${pageText.length} characters`);

          debugInfo.push('🔍 DYNAMIC Strategy: Extract rates with any GMT offset...');

          // DYNAMIC APPROACH: Look for any GMT offset pattern, not just GMT+3
          // Pattern variations:
          // GMT+1, GMT+2, GMT+3, GMT+4, GMT+5, GMT+0, GMT-X, etc.
          // Then capture the rate that follows
          
          const dynamicGmtPattern = new RegExp(`GMT[+-]?[0-9]{1,2}([0-9]{1,3}(?:,[0-9]{3})*(?:\\.[0-9]{2})?)\\s*${toCurrency}`, 'g');
          const gmtMatches = [...pageText.matchAll(dynamicGmtPattern)];
          
          debugInfo.push(`🎯 Found ${gmtMatches.length} dynamic GMT rates to process`);

          // Process GMT matches to extract clean rates
          gmtMatches.forEach((match, index) => {
            const fullMatch = match[0]; // e.g., "GMT+31,540,100.00 NGN" or "GMT+0128,450.50 KES"
            const capturedPart = match[1]; // e.g., "1,540,100.00" or "128,450.50"
            
            debugInfo.push(`📊 Processing GMT match ${index + 1}: "${fullMatch}"`);
            debugInfo.push(`   Captured rate part: "${capturedPart}"`);
            
            // Clean rate extraction
            const cleanRate = parseFloat(capturedPart.replace(/,/g, ''));
            
            // Dynamic validation based on currency
            const validationRules = {
              'NGN': { min: 1000000, max: 2000000 },    // 1M-2M for 1000 USD
              'KES': { min: 100000, max: 200000 },      // 100K-200K for 1000 USD  
              'UGX': { min: 3000000, max: 5000000 },    // 3M-5M for 1000 USD
              'TZS': { min: 2000000, max: 4000000 }     // 2M-4M for 1000 USD
            };
            
            const validation = validationRules[toCurrency] || { min: 50000, max: 10000000 };
            
            if (cleanRate && cleanRate >= validation.min && cleanRate <= validation.max) {
              // Find provider context
              const matchPosition = pageText.indexOf(fullMatch);
              const contextStart = Math.max(0, matchPosition - 300);
              const contextEnd = Math.min(pageText.length, matchPosition + 100);
              const context = pageText.substring(contextStart, contextEnd).toLowerCase();
              
              // Provider identification from context
              let provider = 'Unknown';
              const providerPatterns = {
                'Remitly': /remitly/i,
                'Sendwave': /sendwave/i,
                'Nala': /\bnala\b/i,
                'WorldRemit': /worldremit/i,
                'Wise': /wise/i,
                'MoneyGram': /moneygram/i,
                'Western Union': /western\s*union/i
              };
              
              for (const [providerName, pattern] of Object.entries(providerPatterns)) {
                if (pattern.test(context)) {
                  provider = providerName;
                  break;
                }
              }
              
              debugInfo.push(`   ✅ Validated ${provider}: ${cleanRate.toLocaleString()} ${toCurrency}`);
              
              rates.push({
                provider: provider,
                rate: cleanRate,
                recipientReceives: cleanRate,
                rawValue: capturedPart,
                extractedFrom: fullMatch,
                timestamp: new Date().toISOString(),
                contextPreview: context.substring(0, 100)
              });
            } else {
              debugInfo.push(`   ❌ Rate ${cleanRate} failed validation (outside range ${validation.min.toLocaleString()}-${validation.max.toLocaleString()})`);
            }
          });

          // Fallback 1: Look for rates without GMT prefix but with proper format
          if (rates.length === 0) {
            debugInfo.push('🔍 Fallback 1: Looking for non-GMT formatted rates...');
            
            const regularPattern = new RegExp(`\\b([1-9][0-9]{4,7}(?:,[0-9]{3})*(?:\\.[0-9]{2})?)\\s*${toCurrency}\\b`, 'g');
            const regularMatches = [...pageText.matchAll(regularPattern)];
            
            const nonGmtMatches = regularMatches.filter(match => {
              const matchPosition = pageText.indexOf(match[0]);
              const beforeText = pageText.substring(Math.max(0, matchPosition - 20), matchPosition);
              return !beforeText.includes('GMT');
            });
            
            debugInfo.push(`📊 Found ${nonGmtMatches.length} non-GMT rates`);
            
            const validationRules2 = {
              'NGN': { min: 1000000, max: 2000000 },    
              'KES': { min: 100000, max: 200000 },      
              'UGX': { min: 3000000, max: 5000000 },    
              'TZS': { min: 2000000, max: 4000000 }     
            };
            const validation2 = validationRules2[toCurrency] || { min: 50000, max: 10000000 };
            
            nonGmtMatches.slice(0, 5).forEach((match, index) => {
              const rate = parseFloat(match[1].replace(/,/g, ''));
              if (rate >= validation2.min && rate <= validation2.max) {
                rates.push({
                  provider: `Provider${index + 1}`,
                  rate: rate,
                  recipientReceives: rate,
                  rawValue: match[1],
                  extractedFrom: match[0],
                  timestamp: new Date().toISOString(),
                  contextPreview: 'Fallback extraction'
                });
                debugInfo.push(`   ✅ Fallback rate: ${rate.toLocaleString()} ${toCurrency}`);
              }
            });
          }

          // Fallback 2: More aggressive pattern matching
          if (rates.length === 0) {
            debugInfo.push('🔍 Fallback 2: Aggressive pattern search...');
            
            // Look for any number followed by currency, regardless of format
            const aggressivePattern = new RegExp(`([0-9]{1,3}(?:,[0-9]{3})+(?:\\.[0-9]{2})?)\\s*${toCurrency}`, 'gi');
            const aggressiveMatches = [...pageText.matchAll(aggressivePattern)];
            
            debugInfo.push(`📊 Found ${aggressiveMatches.length} aggressive matches`);
            
            aggressiveMatches.slice(0, 3).forEach((match, index) => {
              debugInfo.push(`   Raw match ${index + 1}: "${match[0]}" -> "${match[1]}"`);
              
              const rate = parseFloat(match[1].replace(/,/g, ''));
              const validationRules3 = {
                'NGN': { min: 1000000, max: 2000000 },    
                'KES': { min: 100000, max: 200000 },      
                'UGX': { min: 3000000, max: 5000000 },    
                'TZS': { min: 2000000, max: 4000000 }     
              };
              const validation3 = validationRules3[toCurrency] || { min: 10000, max: 10000000 };
              
              if (rate >= validation3.min) {
                rates.push({
                  provider: `Aggressive${index + 1}`,
                  rate: rate,
                  recipientReceives: rate,
                  rawValue: match[1],
                  extractedFrom: match[0],
                  timestamp: new Date().toISOString(),
                  contextPreview: 'Aggressive extraction'
                });
                debugInfo.push(`   ✅ Aggressive rate: ${rate.toLocaleString()} ${toCurrency}`);
              }
            });
          }

          if (rates.length === 0) {
            debugInfo.push('❌ No valid rates found with any approach');
            
            // Debug: Show what currency-related text we can find
            const currencyText = pageText.match(new RegExp(`.{0,50}${toCurrency}.{0,50}`, 'gi')) || [];
            debugInfo.push(`🔍 All ${toCurrency} text snippets found: ${currencyText.length}`);
            currencyText.slice(0, 5).forEach((snippet, i) => {
              debugInfo.push(`   ${i + 1}. "${snippet.trim()}"`);
            });
            
            // Show any GMT patterns we can find
            const allGmtText = pageText.match(/GMT[+-]?[0-9]{1,2}[^a-zA-Z]{0,50}/gi) || [];
            debugInfo.push(`🔍 All GMT patterns found: ${allGmtText.length}`);
            allGmtText.slice(0, 3).forEach((snippet, i) => {
              debugInfo.push(`   ${i + 1}. "${snippet}"`);
            });
          }

          debugInfo.push(`🏁 Final result: ${rates.length} rates extracted with dynamic GMT handling`);

          return { rates, debugInfo };
        }, toCurrency);

        console.log('🐛 Enhanced Rate Extraction Debug Info:');
        extractedRates.debugInfo.forEach(line => console.log(line));

        console.log('💰 Extracted Rates:');
        extractedRates.rates.forEach((rate, index) => {
          console.log(`  ${index + 1}. ${rate.provider}: ${rate.rate.toLocaleString()} ${toCurrency}`);
        });

        return {
          success: true,
          fromCurrencyResult: fromCurrencyResult,
          toCurrencyResult: toCurrencyResult,
          finalCurrencies: finalState.selectedCurrencies,
          rateDisplays: finalState.rateDisplay,
          compareRatesActivated: compareRatesClicked,
          extractedRates: extractedRates.rates
        };
      }

      return {
        success: true,
        fromCurrencyResult: fromCurrencyResult,
        toCurrencyResult: toCurrencyResult,
        finalCurrencies: finalState.selectedCurrencies,
        rateDisplays: finalState.rateDisplay,
        compareRatesActivated: compareRatesClicked,
        extractedRates: []
      };

    } catch (error) {
      console.error(`❌ Currency selection failed: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    } finally {
      if (page) {
        await page.close().catch(err => console.error('⚠️ Error closing page:', err.message));
        console.log('✅ Page closed');
      }
    }
  }

  async scrapeRatesWithRetry(fromCurrency, toCurrency, amount) {
    if (!fromCurrency || !toCurrency || !amount) {
      throw new Error("fromCurrency, toCurrency, and amount are required");
    }
    if (isNaN(amount) || amount <= 0) {
      throw new Error("amount must be a positive number");
    }

    let lastError = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        console.log(`🔄 Attempt ${attempt}/${this.maxRetries}: Scraping for ${amount} ${fromCurrency} → ${toCurrency}`);

        const result = await this.testCurrencySelection(fromCurrency, toCurrency, amount);

        if (result.success && result.extractedRates && result.extractedRates.length > 0) {
          console.log(`✅ Successfully completed scraping on attempt ${attempt}`);
          return result;
        } else {
          const message = result.success ? 'No rates extracted' : result.error;
          console.log(`⚠️ Scraping succeeded but no rates extracted on attempt ${attempt}`);
          lastError = new Error(message);
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

    console.error(`❌ All ${this.maxRetries} attempts failed. Last error:`, lastError?.message);
    return {
      success: false,
      error: lastError?.message || 'All retry attempts failed',
      extractedRates: []
    };
  }

  async testScraping(service, fromCurrency, toCurrency, amount) {
    if (!service || !fromCurrency || !toCurrency || !amount) {
      throw new Error("service, fromCurrency, toCurrency, and amount are required");
    }
    if (!this.services[service]) {
      throw new Error(`Unsupported service: ${service}`);
    }
    return await this.testCurrencySelection(fromCurrency, toCurrency, amount);
  }

  async scrapeAllRates(fromCurrency, toCurrency, amount) {
    if (!fromCurrency || !toCurrency || !amount) {
      throw new Error("fromCurrency, toCurrency, and amount are required");
    }
    if (isNaN(amount) || amount <= 0) {
      throw new Error("amount must be a positive number");
    }

    console.log('📊 Getting all rates...');
    const result = await this.scrapeRatesWithRetry(fromCurrency, toCurrency, amount);

    const rates = result.extractedRates ? result.extractedRates.map(rate => ({
      provider: rate.provider,
      rate: rate.rate,
      recipientReceives: rate.recipientReceives,
      currency: toCurrency,
      fees: null,
      timestamp: rate.timestamp,
      service: rate.provider.toLowerCase(),
      extractedFrom: rate.extractedFrom,
      rawValue: rate.rawValue
    })) : [];

    const status = result.success && rates.length > 0 ? 'success' : 'error';
    
    console.log(`✅ Scraping completed: ${status}`);
    console.log(`📊 Rates found: ${rates.length}`);

    return {
      status: status,
      fromCurrency,
      toCurrency,
      amount,
      timestamp: new Date().toISOString(),
      rates: rates,
      errors: result.success && rates.length > 0 ? [] : [{ service: 'nala', error: result.error || 'No rates extracted' }],
      debug: result
    };
  }

  async getSendwaveRateOnly(fromCurrency, toCurrency, amount) {
    console.log(`🎯 Getting Sendwave rate only...`);
    console.log(`🎯 DEBUG: Extracting Sendwave rate only: ${amount} ${fromCurrency} → ${toCurrency}`);

    const result = await this.scrapeAllRates(fromCurrency, toCurrency, amount);
    
    // Filter for Sendwave only
    const sendwaveRates = result.rates.filter(rate => 
      rate.provider.toLowerCase().includes('sendwave')
    );

    return {
      status: sendwaveRates.length > 0 ? 'success' : 'error',
      fromCurrency,
      toCurrency,
      amount,
      timestamp: new Date().toISOString(),
      rates: sendwaveRates,
      errors: sendwaveRates.length === 0 ? [{ service: 'sendwave', error: 'Sendwave rate not found' }] : [],
      debug: result.debug
    };
  }

  async getAvailableCurrencies() {
    return {
      success: true,
      currencies: [
        { code: 'USD', name: 'US Dollar', symbol: '$' },
        { code: 'GBP', name: 'British Pound', symbol: '£' },
        { code: 'EUR', name: 'Euro', symbol: '€' },
        { code: 'NGN', name: 'Nigerian Naira', symbol: '₦' },
        { code: 'KES', name: 'Kenyan Shilling', symbol: 'KSh' },
        { code: 'KSH', name: 'Kenyan Shilling', symbol: 'KSh' },
        { code: 'UGX', name: 'Ugandan Shilling', symbol: 'USh' },
        { code: 'TZS', name: 'Tanzanian Shilling', symbol: 'TSh' }
      ]
    };
  }

  async healthCheck() {
    try {
      if (this.browser && !this.browser.disconnected) {
        return {
          status: 'healthy',
          browser: 'connected',
          timestamp: new Date().toISOString()
        };
      } else {
        return {
          status: 'degraded',
          browser: 'disconnected',
          message: 'Browser not initialized',
          timestamp: new Date().toISOString()
        };
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  getServiceInfo() {
    return {
      name: 'NalaRateScraperService',
      version: '5.0.0-FIXED',
      description: 'Fixed version with proper GMT timestamp filtering',
      supportedServices: Object.keys(this.services),
      features: [
        'GMT timestamp exclusion',
        'Enhanced rate extraction',
        'Provider identification', 
        'Currency validation',
        'Retry mechanism with exponential backoff'
      ],
      configuration: {
        maxRetries: this.maxRetries,
        retryDelay: this.retryDelay,
        pageTimeout: this.pageTimeout,
        headless: true
      }
    };
  }
}

export default NalaRateScraperService;