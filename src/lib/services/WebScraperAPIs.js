// WebScraperAPIs.js - Complete Enhanced Version: Extract All Providers
import puppeteer from "puppeteer";

class NalaRateScraperService {
  constructor(options = {}) {
    this.browser = null;
    this.maxRetries = options.maxRetries || 2;
    this.retryDelay = options.retryDelay || 3000;
    this.pageTimeout = options.pageTimeout || 300000; // 5 minutes
    this.isInitializing = false;
    
    this.services = {
      nala: {
        baseUrl: "https://www.nala.com",
        name: "Nala"
      }
    };
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
        headless: false, // Set to false to watch what happens
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
        this.browser = null;
        console.log('✅ Browser cleaned up');
      } catch (error) {
        console.error('⚠️ Error during cleanup:', error.message);
        this.browser = null;
      }
    }
  }

  async createPage() {
    if (!this.browser || this.browser.disconnected) {
      await this.initialize();
    }
    
    const page = await this.browser.newPage();
    
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1366, height: 768 });
    
    // Set the correct timeouts from constructor
    await page.setDefaultNavigationTimeout(this.pageTimeout);
    await page.setDefaultTimeout(this.pageTimeout);
    
    console.log(`🕐 Page timeouts set to: ${this.pageTimeout}ms (${this.pageTimeout/1000} seconds)`);
    
    return page;
  }

  // Main currency selection and rate extraction method
  async testCurrencySelection(fromCurrency, toCurrency, amount) {
    let page;
    
    try {
      console.log(`🧪 Enhanced currency selection: ${amount} ${fromCurrency} → ${toCurrency}`);
      
      page = await this.createPage();
      
      console.log('🌐 Navigating to Nala...');
      console.log(`🕐 Using timeout: ${this.pageTimeout}ms (${this.pageTimeout/1000} seconds)`);
      
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
      
      // Check if page actually loaded
      const pageTitle = await page.title();
      console.log(`📄 Page title: "${pageTitle}"`);
      
      if (!pageTitle || pageTitle.includes('Error')) {
        throw new Error('Page did not load properly - no title or error page');
      }
      
      // Step 1: Set the amount first
      console.log(`💰 Step 1: Setting amount to ${amount}...`);
      const amountSet = await page.evaluate((targetAmount) => {
        const inputs = Array.from(document.querySelectorAll('input'));
        
        for (const input of inputs) {
          const type = input.type || '';
          const placeholder = input.placeholder || '';
          const value = input.value || '';
          const name = input.name || '';
          
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
      
      // Step 2: Select FROM currency
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
      
      // Step 3: Select TO currency
      console.log(`💱 Step 3: Selecting TO currency (${toCurrency})...`);
      
      const toCurrencyResult = await page.evaluate(async (targetCurrency) => {
        const buttons = Array.from(document.querySelectorAll('button'));
        
        for (const button of buttons) {
          const text = button.textContent?.trim();
          if (text === 'NGN' || text === 'KES' || text === 'UGX' || text === 'TZS') {
            console.log('Clicking TO currency button:', text);
            button.click();
            
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            const options = Array.from(document.querySelectorAll('[role="option"], li, button'));
            
            for (const option of options) {
              const optionText = option.textContent?.trim();
              
              if (optionText && (optionText.includes(targetCurrency) || 
                               optionText.includes('KES') || 
                               optionText.includes('Kenyan Shilling') ||
                               optionText.includes('Nigerian Naira') ||
                               optionText.includes('Ugandan Shilling') ||
                               optionText.includes('Tanzanian Shilling'))) {
                console.log('Found and clicking target currency option:', optionText);
                option.click();
                return { buttonClicked: true, optionSelected: true, optionText: optionText };
              }
            }
            
            return { buttonClicked: true, optionSelected: false, options: options.map(o => o.textContent?.trim()).slice(0, 5) };
          }
        }
        return { buttonClicked: false, optionSelected: false };
      }, toCurrency);
      
      console.log(`🔧 TO currency result:`, toCurrencyResult);
      
      if (toCurrencyResult.buttonClicked) {
        console.log(`✅ TO currency button clicked`);
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      
      // Step 4: Take screenshot and check final state
      await page.screenshot({ path: 'step2-after-currency-selection.png', fullPage: true });
      console.log('📸 Screenshot saved: step2-after-currency-selection.png');
      
      // Step 5: Check what currencies are now selected
      console.log('🔍 Step 5: Checking final currency selection...');
      const finalState = await page.evaluate(() => {
        const currencyButtons = Array.from(document.querySelectorAll('button')).filter(b => {
          const text = b.textContent?.trim();
          return text && text.length === 3 && /^[A-Z]{3}$/.test(text);
        });
        
        return {
          selectedCurrencies: currencyButtons.map(b => b.textContent?.trim()),
          rateDisplay: document.body.textContent.match(/1\s+[A-Z]{3}\s*≈\s*[\d,.]+\s+[A-Z]{3}/g) || []
        };
      });
      
      console.log('📋 Final currency state:');
      console.log(`  Selected currencies: ${finalState.selectedCurrencies.join(' → ')}`);
      console.log(`  Rate displays: ${finalState.rateDisplay.join(', ')}`);
      
      // Step 6: Look for "Compare rates" tab and click it
      console.log('🔍 Step 6: Looking for Compare rates tab...');
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
        
        // Take final screenshot
        await page.screenshot({ path: 'step2-compare-rates.png', fullPage: true });
        console.log('📸 Final screenshot saved: step2-compare-rates.png');
        
        // Step 7: Enhanced rate extraction with multiple strategies
        console.log('🔍 Step 7: Enhanced rate extraction for all providers...');
        
        // Wait a bit more for the comparison view to fully load
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        const extractedRates = await page.evaluate((toCurrency) => {
          const rates = [];
          const debugInfo = [];
          
          debugInfo.push('🔍 Starting enhanced rate extraction from comparison view...');
          
          // Get fresh page content
          const pageText = document.body.textContent || '';
          debugInfo.push(`📝 Page text length: ${pageText.length} characters`);
          
          // Enhanced provider variants with more flexible matching
          const providerVariants = {
            'Sendwave': ['Sendwave', 'sendwave', 'SENDWAVE'],
            'Nala': ['Nala', 'nala', 'NALA'],
            'Remitly': ['Remitly', 'remitly', 'REMITLY']
          };
          
          // Strategy 1: Look for rates in currency format
          debugInfo.push('🔍 Strategy 1: Looking for rates in currency format...');
          
          // More flexible pattern to match different currency formats
          const currencyPattern = new RegExp(`([0-9]{1,3}(?:,[0-9]{3})*(?:\\.[0-9]{2})?)\\s*(?:${toCurrency}|KES|KSH)`, 'gi');
          const allCurrencyMatches = [...pageText.matchAll(currencyPattern)];
          
          debugInfo.push(`📊 Found ${allCurrencyMatches.length} currency rate matches:`);
          allCurrencyMatches.forEach((match, i) => {
            if (match && match[1]) {
              debugInfo.push(`   ${i + 1}. ${match[1]} ${toCurrency}`);
            }
          });
          
          // Strategy 2: Enhanced DOM-based extraction first
          debugInfo.push('🔍 Strategy 2: Enhanced DOM-based extraction...');
          
          // Look for rate containers and their structure
          const rateContainers = document.querySelectorAll('div, span, td, li');
          const providerRateMapping = {};
          
          rateContainers.forEach(container => {
            const containerText = container.textContent || '';
            
            // Check if this container has a provider name
            Object.keys(providerVariants).forEach(provider => {
              const variants = providerVariants[provider];
              
              variants.forEach(variant => {
                if (containerText.toLowerCase().includes(variant.toLowerCase()) && !providerRateMapping[provider]) {
                  // Found provider, now look for rate in this container or nearby containers
                  
                  // Strategy 2a: Look in the same container
                  const rateMatch = containerText.match(currencyPattern);
                  if (rateMatch && rateMatch[1]) {
                    const rateValue = parseFloat(rateMatch[1].replace(/,/g, ''));
                    if (!isNaN(rateValue) && rateValue >= 50000 && rateValue <= 500000) {
                      providerRateMapping[provider] = {
                        value: rateValue,
                        raw: rateMatch[1],
                        source: 'same container'
                      };
                      debugInfo.push(`✅ Found ${provider} rate in same container: ${rateValue}`);
                      return;
                    }
                  }
                  
                  // Strategy 2b: Look in parent container
                  if (container.parentElement) {
                    const parentText = container.parentElement.textContent || '';
                    const parentRateMatch = parentText.match(currencyPattern);
                    if (parentRateMatch && parentRateMatch[1]) {
                      const rateValue = parseFloat(parentRateMatch[1].replace(/,/g, ''));
                      if (!isNaN(rateValue) && rateValue >= 50000 && rateValue <= 500000) {
                        providerRateMapping[provider] = {
                          value: rateValue,
                          raw: parentRateMatch[1],
                          source: 'parent container'
                        };
                        debugInfo.push(`✅ Found ${provider} rate in parent container: ${rateValue}`);
                        return;
                      }
                    }
                  }
                  
                  // Strategy 2c: Look in sibling containers
                  if (container.parentElement) {
                    const siblings = Array.from(container.parentElement.children);
                    for (const sibling of siblings) {
                      if (sibling !== container) {
                        const siblingText = sibling.textContent || '';
                        const siblingRateMatch = siblingText.match(currencyPattern);
                        if (siblingRateMatch && siblingRateMatch[1]) {
                          const rateValue = parseFloat(siblingRateMatch[1].replace(/,/g, ''));
                          if (!isNaN(rateValue) && rateValue >= 50000 && rateValue <= 500000) {
                            providerRateMapping[provider] = {
                              value: rateValue,
                              raw: siblingRateMatch[1],
                              source: 'sibling container'
                            };
                            debugInfo.push(`✅ Found ${provider} rate in sibling container: ${rateValue}`);
                            return;
                          }
                        }
                      }
                    }
                  }
                }
              });
            });
          });
          
          debugInfo.push(`📊 DOM-based provider mapping found ${Object.keys(providerRateMapping).length} providers:`);
          Object.entries(providerRateMapping).forEach(([provider, data]) => {
            debugInfo.push(`   ${provider}: ${data.value} (${data.source})`);
          });
          
          // Convert provider mapping to rates array
          Object.entries(providerRateMapping).forEach(([provider, data]) => {
            rates.push({
              provider: provider,
              recipientReceives: data.value,
              rate: data.value,
              currency: toCurrency,
              timestamp: new Date().toISOString(),
              extractedFrom: `DOM-based extraction - ${data.source}`,
              rawValue: data.raw
            });
          });
          
          // Strategy 3: If we still don't have all providers, use positional assignment
          if (rates.length < 3 && allCurrencyMatches.length >= 3) {
            debugInfo.push('🔄 Strategy 3: Positional assignment for missing providers...');
            
            // Get all reasonable rates
            const reasonableRates = allCurrencyMatches
              .filter(match => match && match[1])
              .map(match => {
                const cleanValue = match[1].replace(/,/g, '');
                const numValue = parseFloat(cleanValue);
                return !isNaN(numValue) ? { value: numValue, raw: match[1] } : null;
              })
              .filter(rate => rate !== null && rate.value >= 50000 && rate.value <= 500000)
              .sort((a, b) => b.value - a.value);
            
            debugInfo.push(`📊 All reasonable rates: ${reasonableRates.map(r => r.value).join(', ')}`);
            
            // Get rates we haven't assigned yet
            const assignedRates = rates.map(r => r.recipientReceives);
            const unassignedRates = reasonableRates.filter(rate => !assignedRates.includes(rate.value));
            
            // Assign to remaining providers
            const allProviders = ['Sendwave', 'Nala', 'Remitly'];
            const assignedProviders = rates.map(r => r.provider);
            const remainingProviders = allProviders.filter(p => !assignedProviders.includes(p));
            
            debugInfo.push(`📋 Assigned providers: ${assignedProviders.join(', ')}`);
            debugInfo.push(`📋 Remaining providers: ${remainingProviders.join(', ')}`);
            debugInfo.push(`📋 Unassigned rates: ${unassignedRates.map(r => r.value).join(', ')}`);
            
            // Assign highest unassigned rates to remaining providers
            unassignedRates.slice(0, remainingProviders.length).forEach((rate, index) => {
              const provider = remainingProviders[index];
              rates.push({
                provider: provider,
                recipientReceives: rate.value,
                rate: rate.value,
                currency: toCurrency,
                timestamp: new Date().toISOString(),
                extractedFrom: 'positional assignment for remaining providers',
                rawValue: rate.raw
              });
              debugInfo.push(`✅ Assigned: ${provider} = ${rate.value} (${rate.raw})`);
            });
          }
          
          // Strategy 4: Text-based provider search as fallback
          if (rates.length === 0) {
            debugInfo.push('🔄 Strategy 4: Text-based provider search fallback...');
            
            Object.keys(providerVariants).forEach(mainProvider => {
              const variants = providerVariants[mainProvider];
              
              let found = false;
              for (const variant of variants) {
                if (found) break;
                
                const providerIndex = pageText.toLowerCase().indexOf(variant.toLowerCase());
                if (providerIndex !== -1) {
                  debugInfo.push(`✅ Found "${variant}" at position ${providerIndex}`);
                  
                  // Look for rate within 500 characters before and after provider name
                  const searchStart = Math.max(0, providerIndex - 500);
                  const searchEnd = Math.min(pageText.length, providerIndex + 500);
                  const searchText = pageText.substring(searchStart, searchEnd);
                  
                  const rateMatch = searchText.match(currencyPattern);
                  
                  if (rateMatch && rateMatch[1]) {
                    const rateValue = parseFloat(rateMatch[1].replace(/,/g, ''));
                    
                    if (!isNaN(rateValue) && rateValue >= 50000 && rateValue <= 500000) {
                      debugInfo.push(`✅ Found rate for ${mainProvider}: ${rateValue} (from "${rateMatch[1]}")`);
                      
                      rates.push({
                        provider: mainProvider,
                        recipientReceives: rateValue,
                        rate: rateValue,
                        currency: toCurrency,
                        timestamp: new Date().toISOString(),
                        extractedFrom: 'text-based provider search fallback',
                        rawValue: rateMatch[1]
                      });
                      found = true;
                    }
                  }
                }
              }
            });
          }
          
          debugInfo.push(`🏁 Final extraction result: ${rates.length} rates extracted`);
          
          // Remove duplicates and sort by highest rate first
          const uniqueRates = rates.filter((rate, index, self) => 
            index === self.findIndex(r => r.provider === rate.provider)
          );
          
          uniqueRates.sort((a, b) => b.recipientReceives - a.recipientReceives);
          
          return { rates: uniqueRates, debugInfo };
        }, toCurrency);
        
        console.log('🐛 Enhanced Rate Extraction Debug Info:');
        extractedRates.debugInfo.forEach(line => console.log(line));
        
        console.log('💰 Extracted Rates:');
        extractedRates.rates.forEach((rate, index) => {
          console.log(`  ${index + 1}. ${rate.provider}: ${rate.recipientReceives.toLocaleString()} ${rate.currency}`);
          console.log(`     Raw value: ${rate.rawValue}`);
          console.log(`     Method: ${rate.extractedFrom}`);
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
      console.error(`❌ Enhanced currency selection failed: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    } finally {
      if (page) {
        console.log('🔍 Page left open for inspection. Close manually when done.');
        // Keep page open for debugging
      }
    }
  }

  // Enhanced scraping method with retry logic
  async scrapeRatesWithRetry(fromCurrency, toCurrency, amount, maxRetries = 3) {
    let lastError = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 Attempt ${attempt}/${maxRetries}: Enhanced scraping for ${amount} ${fromCurrency} → ${toCurrency}`);
        
        const result = await this.testCurrencySelection(fromCurrency, toCurrency, amount);
        
        if (result.success && result.extractedRates && result.extractedRates.length > 0) {
          console.log(`✅ Successfully extracted ${result.extractedRates.length} rates on attempt ${attempt}`);
          return result;
        } else if (result.success) {
          console.log(`⚠️ Scraping succeeded but no rates extracted on attempt ${attempt}`);
          lastError = new Error('No rates extracted');
        } else {
          console.log(`❌ Scraping failed on attempt ${attempt}: ${result.error}`);
          lastError = new Error(result.error);
        }
        
        // Wait before retrying (except on last attempt)
        if (attempt < maxRetries) {
          const delay = this.retryDelay * attempt; // Exponential backoff
          console.log(`⏳ Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
      } catch (error) {
        console.error(`❌ Unexpected error on attempt ${attempt}:`, error.message);
        lastError = error;
        
        // Wait before retrying (except on last attempt)
        if (attempt < maxRetries) {
          const delay = this.retryDelay * attempt;
          console.log(`⏳ Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    console.error(`❌ All ${maxRetries} attempts failed. Last error:`, lastError?.message);
    return {
      success: false,
      error: lastError?.message || 'All retry attempts failed',
      extractedRates: []
    };
  }

  // Placeholder methods for full interface compatibility
  async testScraping(service, fromCurrency, toCurrency, amount) {
    return await this.testCurrencySelection(fromCurrency, toCurrency, amount);
  }

  async scrapeAllRates(fromCurrency, toCurrency, amount) {
    const result = await this.scrapeRatesWithRetry(fromCurrency, toCurrency, amount);
    
    // If we successfully extracted rates, format them properly
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
    
    return {
      status: result.success && rates.length > 0 ? 'success' : 'error',
      fromCurrency,
      toCurrency,
      amount,
      timestamp: new Date().toISOString(),
      rates: rates,
      errors: result.success ? [] : [{ service: 'nala', error: result.error || 'No rates extracted' }],
      debug: result
    };
  }

  // Get available currencies
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

  // Health check method
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

  // Get service information
  getServiceInfo() {
    return {
      name: 'NalaRateScraperService',
      version: '3.0.0',
      description: 'Enhanced web scraper for Nala money transfer rates with multi-provider extraction',
      supportedServices: Object.keys(this.services),
      features: [
        'Enhanced currency selection automation',
        'Multi-provider rate extraction (Sendwave, Nala, Remitly)',
        'DOM-based rate discovery',
        'Screenshot capture for debugging',
        'Retry logic with exponential backoff',
        'Multiple extraction strategies with fallbacks',
        'Enhanced error handling and validation',
        'Flexible currency pattern matching'
      ],
      configuration: {
        maxRetries: this.maxRetries,
        retryDelay: this.retryDelay,
        pageTimeout: this.pageTimeout
      },
      supportedProviders: ['Sendwave', 'Nala', 'Remitly'],
      extractionStrategies: [
        'DOM-based container analysis',
        'Provider-specific text search',
        'Positional rate assignment',
        'Text-based fallback search'
      ]
    };
  }

  // Additional utility method to get only Sendwave rates (as requested)
  async getSendwaveRateOnly(fromCurrency, toCurrency, amount) {
    console.log(`🎯 Extracting Sendwave rate only: ${amount} ${fromCurrency} → ${toCurrency}`);
    
    const result = await this.scrapeAllRates(fromCurrency, toCurrency, amount);
    
    if (result.status === 'success' && result.rates.length > 0) {
      // Filter for Sendwave only
      const sendwaveRates = result.rates.filter(rate => 
        rate.provider.toLowerCase() === 'sendwave'
      );
      
      if (sendwaveRates.length > 0) {
        return {
          status: 'success',
          fromCurrency,
          toCurrency,
          amount,
          timestamp: new Date().toISOString(),
          rates: sendwaveRates,
          errors: [],
          debug: {
            ...result.debug,
            filteredFor: 'Sendwave only',
            totalRatesFound: result.rates.length,
            sendwaveRatesFound: sendwaveRates.length
          }
        };
      } else {
        return {
          status: 'error',
          fromCurrency,
          toCurrency,
          amount,
          timestamp: new Date().toISOString(),
          rates: [],
          errors: [{ service: 'sendwave', error: 'Sendwave rate not found in extracted rates' }],
          debug: {
            ...result.debug,
            filteredFor: 'Sendwave only',
            totalRatesFound: result.rates.length,
            sendwaveRatesFound: 0
          }
        };
      }
    } else {
      return {
        status: 'error',
        fromCurrency,
        toCurrency,
        amount,
        timestamp: new Date().toISOString(),
        rates: [],
        errors: result.errors || [{ service: 'nala', error: 'Failed to extract any rates' }],
        debug: {
          ...result.debug,
          filteredFor: 'Sendwave only'
        }
      };
    }
  }

  // Method to verify rate extraction accuracy
  async verifyExtractedRates(extractedRates, screenshots = true) {
    if (screenshots) {
      console.log('📸 Screenshots available for manual verification:');
      console.log('  - step2-after-currency-selection.png');
      console.log('  - step2-compare-rates.png');
    }
    
    console.log('🔍 Rate extraction verification:');
    console.log(`  Total rates extracted: ${extractedRates.length}`);
    
    extractedRates.forEach((rate, index) => {
      console.log(`  ${index + 1}. ${rate.provider}:`);
      console.log(`     Rate: ${rate.recipientReceives.toLocaleString()} ${rate.currency}`);
      console.log(`     Extraction method: ${rate.extractedFrom}`);
      console.log(`     Raw value: ${rate.rawValue}`);
      console.log(`     Timestamp: ${rate.timestamp}`);
    });
    
    // Basic validation
    const validation = {
      hasMultipleProviders: extractedRates.length > 1,
      hasSendwave: extractedRates.some(r => r.provider === 'Sendwave'),
      hasNala: extractedRates.some(r => r.provider === 'Nala'),
      hasRemitly: extractedRates.some(r => r.provider === 'Remitly'),
      allRatesValid: extractedRates.every(r => 
        r.recipientReceives > 0 && 
        !isNaN(r.recipientReceives) && 
        r.provider && 
        r.currency
      ),
      rateRange: {
        min: Math.min(...extractedRates.map(r => r.recipientReceives)),
        max: Math.max(...extractedRates.map(r => r.recipientReceives))
      }
    };
    
    console.log('✅ Validation results:');
    console.log(`  Multiple providers: ${validation.hasMultipleProviders}`);
    console.log(`  Sendwave found: ${validation.hasSendwave}`);
    console.log(`  Nala found: ${validation.hasNala}`);
    console.log(`  Remitly found: ${validation.hasRemitly}`);
    console.log(`  All rates valid: ${validation.allRatesValid}`);
    console.log(`  Rate range: ${validation.rateRange.min.toLocaleString()} - ${validation.rateRange.max.toLocaleString()}`);
    
    return validation;
  }
}

export default NalaRateScraperService;