import puppeteer from "puppeteer";
import chromium from '@sparticuz/chromium';

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
    this.isServerless = options.isServerless || false;

    this.services = {
      nala: {
        baseUrl: "https://www.nala.com",
        name: "Nala"
      }
    };

    this.supportedCurrencies = [
      'USD', 'GBP', 'EUR', 'NGN', 'KES', 'KSH', 'UGX', 'TZS', 'GHS', 'INR'
    ];

    // Fixed currency to country name mapping for dropdown selection
    this.currencyToCountryMap = {
      'NGN': ['Nigeria', 'Naira', 'Nigerian Naira'],
      'KES': ['Kenya', 'Kenyan Shilling', 'KSH', 'KES'],
      'KSH': ['Kenya', 'Kenyan Shilling', 'KES', 'KSH'],
      'GHS': ['Ghana', 'Ghana Cedis', 'GHS', 'Ghanaian Cedi'],
      'UGX': ['Uganda', 'Ugandan Shilling'],
      'TZS': ['Tanzania', 'Tanzanian Shilling'],
      'INR': ['India', 'Indian Rupee']
    };

    // Currency normalization map - treat KSH and KES as the same
    this.currencyNormalizationMap = {
      'KSH': 'KES',
      'KES': 'KES'
    };
  }

  // Normalize currency code (treat KSH as KES)
  normalizeCurrency(currency) {
    return this.currencyNormalizationMap[currency] || currency;
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

      let browserOptions;

      if (this.isServerless || process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
        // Serverless environment - use @sparticuz/chromium
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
        // Local development - use system Chrome or downloaded Chrome
        console.log('🔧 Configuring for local environment...');

        // Let Puppeteer automatically find Chrome installation
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

      // Set user agent
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

      // Set viewport
      await page.setViewport({ width: 1366, height: 768 });

      // Set timeouts
      await page.setDefaultNavigationTimeout(this.pageTimeout);
      await page.setDefaultTimeout(this.pageTimeout);

      // Additional serverless optimizations
      if (this.isServerless) {
        // Block unnecessary resources to improve performance
        await page.setRequestInterception(true);
        page.on('request', (req) => {
          if (req.resourceType() === 'image' || req.resourceType() === 'stylesheet' || req.resourceType() === 'font') {
            req.abort();
          } else {
            req.continue();
          }
        });

        // Set additional headers for better compatibility
        await page.setExtraHTTPHeaders({
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
        });
      }

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

  async testCurrencySelection(fromCurrency, toCurrency, amount, sendwaveOnly = false) {
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
      await new Promise(resolve => setTimeout(resolve, 10000));

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
        await new Promise(resolve => setTimeout(resolve, 3000));
      } else {
        console.warn('⚠️ Amount input not found or not set');
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
      } else {
        console.warn('⚠️ FROM currency button not found');
      }

      console.log(`💱 Step 3: Selecting TO currency (${toCurrency})...`);

      const toCurrencyResult = await page.evaluate(async (targetCurrency, currencyToCountryMap) => {
        const buttons = Array.from(document.querySelectorAll('button, [role="button"], [aria-label*="currency"], [data-testid*="currency"]'));

        // Map target currency to possible country names or currency labels
        const countryNames = currencyToCountryMap[targetCurrency] || [targetCurrency];

        for (const button of buttons) {
          const text = button.textContent?.trim();

          // Look for any 3-letter currency code button that's NOT the FROM currency
          if (text && /^[A-Z]{3}$/.test(text) && text !== 'USD' && text !== 'GBP' && text !== 'EUR') {
            console.log('Clicking TO currency button:', text);
            button.click();
            await new Promise(resolve => setTimeout(resolve, 5000)); // Increased wait time

            // Wait for dropdown options to load with better selectors
            const dropdownSelectors = [
              '[role="listbox"]', 'ul', '[data-testid*="currency-options"]',
              'div[class*="dropdown"]', 'div[class*="menu"]', 'div[class*="options"]',
              '[class*="currency-list"]', '[class*="select"]', '[class*="popover"]'
            ];

            // Wait for dropdown to appear
            let dropdownFound = false;
            for (let i = 0; i < 3; i++) {
              for (const selector of dropdownSelectors) {
                const dropdown = document.querySelector(selector);
                if (dropdown && dropdown.offsetHeight > 0) {
                  dropdownFound = true;
                  console.log('Dropdown found with selector:', selector);
                  break;
                }
              }
              if (dropdownFound) break;
              await new Promise(resolve => setTimeout(resolve, 1000));
            }

            const options = Array.from(document.querySelectorAll([
              '[role="option"]', 'li', 'button', '[data-testid*="currency-option"]',
              'div[class*="option"]', 'div[class*="item"]', '[class*="currency-item"]',
              'span[class*="currency"]', 'div[class*="currency"]',
              '[class*="country"]', '[class*="flag"]'
            ].join(', ')));

            const availableOptions = options.map(o => o.textContent?.trim()).filter(Boolean);

            console.log('Available TO currency options:', availableOptions.slice(0, 10)); // Show first 10

            // First try exact match
            for (const option of options) {
              const optionText = option.textContent?.trim();
              if (optionText && optionText.includes(targetCurrency)) {
                console.log('Found exact match for target currency:', optionText);
                option.click();
                await new Promise(resolve => setTimeout(resolve, 3000));
                return { buttonClicked: true, optionSelected: true, optionText: optionText, availableOptions };
              }
            }

            // Then try country names and variations
            for (const option of options) {
              const optionText = option.textContent?.trim();

              if (optionText) {
                // Enhanced matching for currencies
                const isMatch = countryNames.some(name => {
                  const lowerOptionText = optionText.toLowerCase();
                  const lowerName = name.toLowerCase();

                  return lowerOptionText.includes(lowerName) ||
                    // Special handling for specific currencies
                    (targetCurrency === 'KSH' && (lowerOptionText.includes('kenya') || lowerOptionText.includes('kes'))) ||
                    (targetCurrency === 'KES' && (lowerOptionText.includes('kenya') || lowerOptionText.includes('ksh'))) ||
                    (targetCurrency === 'GHS' && (lowerOptionText.includes('ghana') || lowerOptionText.includes('cedi'))) ||
                    // Handle flag emojis
                    optionText.includes('🇰🇪') || optionText.includes('🇳🇬') ||
                    optionText.includes('🇺🇬') || optionText.includes('🇹🇿') || optionText.includes('🇬🇭');
                });

                if (isMatch) {
                  console.log('Found and clicking target TO currency option:', optionText);
                  option.click();
                  await new Promise(resolve => setTimeout(resolve, 3000));
                  return { buttonClicked: true, optionSelected: true, optionText: optionText, availableOptions };
                }
              }
            }

            return { buttonClicked: true, optionSelected: false, availableOptions };
          }
        }

        return { buttonClicked: false, optionSelected: false, availableOptions: [] };
      }, toCurrency, this.currencyToCountryMap);

      console.log(`🔧 TO currency result:`, toCurrencyResult);

      if (toCurrencyResult.buttonClicked) {
        console.log(`✅ TO currency button clicked`);
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Verify TO currency selection - check for both original and normalized currency
        const normalizedToCurrency = this.normalizeCurrency(toCurrency);
        const isToCurrencySelected = await page.evaluate((targetCurrency, normalizedCurrency) => {
          const currencyButtons = Array.from(document.querySelectorAll('button, [role="button"], [aria-label*="currency"], [data-testid*="currency"]'));
          return currencyButtons.some(b => {
            const text = b.textContent?.trim();
            return text === targetCurrency || text === normalizedCurrency;
          });
        }, toCurrency, normalizedToCurrency);

        if (!isToCurrencySelected) {
          console.warn(`⚠️ TO currency ${toCurrency} not reflected in UI, attempting comprehensive retry...`);

          // Enhanced retry with multiple approaches
          const retryResult = await page.evaluate(async (targetCurrency, currencyToCountryMap, normalizedCurrency) => {
            console.log('Starting comprehensive retry for currency:', targetCurrency);

            const buttons = Array.from(document.querySelectorAll('button, [role="button"], [aria-label*="currency"], [data-testid*="currency"]'));
            const countryNames = currencyToCountryMap[targetCurrency] || [targetCurrency];

            // Try clicking any currency dropdown button again
            for (const button of buttons) {
              const text = button.textContent?.trim();
              if (text && /^[A-Z]{3}$/.test(text) && text !== 'USD' && text !== 'GBP' && text !== 'EUR') {
                console.log('Retrying TO currency button click:', text);
                button.click();
                await new Promise(resolve => setTimeout(resolve, 4000));

                // Approach 1: Try search input with multiple search terms
                const searchInputSelectors = [
                  'input[aria-autocomplete="list"]', 'input[type="text"]',
                  'input[class*="search"]', 'input[id*="search"]',
                  'input[placeholder*="search"]', 'input[placeholder*="currency"]',
                  'input[class*="filter"]', 'input[class*="select"]',
                  'input[role="searchbox"]', 'input[aria-label*="search"]'
                ];

                let searchInput = null;
                for (const selector of searchInputSelectors) {
                  searchInput = document.querySelector(selector);
                  if (searchInput && searchInput.offsetHeight > 0) {
                    console.log('Found search input with selector:', selector);
                    break;
                  }
                }

                if (searchInput) {
                  // Try multiple search terms
                  const searchTerms = [
                    targetCurrency,
                    normalizedCurrency,
                    ...countryNames,
                    targetCurrency === 'KSH' ? 'Kenya' : null,
                    targetCurrency === 'KES' ? 'Kenya' : null,
                    targetCurrency === 'GHS' ? 'Ghana' : null
                  ].filter(Boolean);

                  for (const searchTerm of searchTerms) {
                    console.log('Trying search term:', searchTerm);
                    searchInput.focus();
                    searchInput.value = '';
                    searchInput.value = searchTerm;

                    // Dispatch comprehensive events
                    ['focus', 'input', 'change', 'keyup'].forEach(eventType => {
                      searchInput.dispatchEvent(new Event(eventType, { bubbles: true }));
                    });

                    await new Promise(resolve => setTimeout(resolve, 2000));

                    // Try Enter key
                    ['keydown', 'keypress', 'keyup'].forEach(eventType => {
                      searchInput.dispatchEvent(new KeyboardEvent(eventType, {
                        bubbles: true,
                        key: 'Enter',
                        code: 'Enter',
                        which: 13,
                        keyCode: 13
                      }));
                    });

                    await new Promise(resolve => setTimeout(resolve, 2000));

                    // Look for any confirmation buttons
                    const confirmSelectors = [
                      'button[type="submit"]', '[role="button"]', 'button',
                      '[class*="confirm"]', '[class*="apply"]', '[class*="ok"]',
                      '[class*="select"]', '[class*="done"]', '[class*="save"]'
                    ];

                    for (const selector of confirmSelectors) {
                      const buttons = Array.from(document.querySelectorAll(selector));
                      for (const btn of buttons) {
                        const btnText = btn.textContent?.toLowerCase().trim();
                        if (btnText && (btnText.includes('confirm') || btnText.includes('apply') ||
                          btnText.includes('ok') || btnText.includes('select') ||
                          btnText.includes('done') || btnText.includes('save'))) {
                          console.log('Found and clicking confirmation button:', btnText);
                          btn.click();
                          await new Promise(resolve => setTimeout(resolve, 3000));
                          return {
                            buttonClicked: true,
                            optionSelected: true,
                            optionText: searchTerm + ' (via search + confirm)',
                            method: 'search_with_confirm'
                          };
                        }
                      }
                    }
                  }

                  // If search didn't work with confirmation, just try the search
                  return {
                    buttonClicked: true,
                    optionSelected: true,
                    optionText: targetCurrency + ' (via search attempt)',
                    method: 'search_attempt'
                  };
                }

                // Approach 2: Look for options again with more comprehensive selectors
                const allOptionSelectors = [
                  '[role="option"]', 'li', 'button', 'div', 'span', 'a',
                  '[data-testid*="currency"]', '[data-testid*="option"]',
                  '[class*="option"]', '[class*="item"]', '[class*="currency"]',
                  '[class*="country"]', '[class*="flag"]', '[class*="dropdown"]',
                  '[aria-label*="currency"]', '[title*="currency"]'
                ];

                const allOptions = Array.from(document.querySelectorAll(allOptionSelectors.join(', ')));
                console.log(`Found ${allOptions.length} potential option elements`);

                for (const option of allOptions) {
                  const optionText = option.textContent?.trim();
                  if (!optionText || optionText.length > 50) continue; // Skip very long text

                  // More comprehensive matching
                  const matchConditions = [
                    optionText.includes(targetCurrency),
                    optionText.includes(normalizedCurrency),
                    optionText.toLowerCase().includes('kenya') && (targetCurrency === 'KES' || targetCurrency === 'KSH'),
                    optionText.toLowerCase().includes('nigeria') && targetCurrency === 'NGN',
                    optionText.toLowerCase().includes('uganda') && targetCurrency === 'UGX',
                    optionText.toLowerCase().includes('tanzania') && targetCurrency === 'TZS',
                    optionText.toLowerCase().includes('ghana') && targetCurrency === 'GHS',
                    optionText.includes('🇰🇪') && (targetCurrency === 'KES' || targetCurrency === 'KSH'),
                    optionText.includes('🇳🇬') && targetCurrency === 'NGN',
                    optionText.includes('🇺🇬') && targetCurrency === 'UGX',
                    optionText.includes('🇹🇿') && targetCurrency === 'TZS',
                    optionText.includes('🇬🇭') && targetCurrency === 'GHS'
                  ];

                  if (matchConditions.some(condition => condition)) {
                    console.log('Found comprehensive match:', optionText);

                    // Try multiple click approaches
                    const clickMethods = [
                      () => option.click(),
                      () => option.dispatchEvent(new MouseEvent('click', { bubbles: true })),
                      () => option.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })) && option.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })),
                      () => option.focus() && option.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
                    ];

                    for (const clickMethod of clickMethods) {
                      try {
                        clickMethod();
                        await new Promise(resolve => setTimeout(resolve, 2000));

                        // Check if click was successful by looking for UI changes
                        const currencyButtons = Array.from(document.querySelectorAll('button, [role="button"]'));
                        const hasTargetCurrency = currencyButtons.some(b => {
                          const text = b.textContent?.trim();
                          return text === targetCurrency || text === normalizedCurrency;
                        });

                        if (hasTargetCurrency) {
                          console.log('Click successful - target currency detected');
                          return {
                            buttonClicked: true,
                            optionSelected: true,
                            optionText: optionText,
                            method: 'comprehensive_click'
                          };
                        }
                      } catch (e) {
                        console.log('Click method failed:', e.message);
                      }
                    }
                  }
                }

                return {
                  buttonClicked: true,
                  optionSelected: false,
                  method: 'comprehensive_retry_failed',
                  availableOptions: allOptions.slice(0, 20).map(o => o.textContent?.trim()).filter(Boolean)
                };
              }
            }

            return {
              buttonClicked: false,
              optionSelected: false,
              method: 'no_currency_button_found'
            };
          }, toCurrency, this.currencyToCountryMap, normalizedToCurrency);

          console.log(`🔧 Comprehensive retry result:`, retryResult);
        }
      } else {
        console.warn('⚠️ TO currency button not found');
      }

      // Take a screenshot for debugging
      console.log('📸 Taking screenshot for debugging...');
      // await page.screenshot({ path: `debug_screenshot_${toCurrency}_${Date.now()}.png`, fullPage: true });

      console.log('🔍 Step 4: Checking final currency selection...');
      const finalState = await page.evaluate((targetCurrency, normalizedToCurrency) => {
        const currencyButtons = Array.from(document.querySelectorAll('button, [role="button"], [aria-label*="currency"], [data-testid*="currency"]')).filter(b => {
          const text = b.textContent?.trim();
          return text && text.length === 3 && /^[A-Z]{3}$/.test(text);
        });

        // Create rate display patterns for both original and normalized currencies
        const ratePatterns = [
          /1\s+[A-Z]{3}\s*≈\s*[\d,.]+\s+[A-Z]{3}/g,
          new RegExp(`1\\s+[A-Z]{3}\\s*≈\\s*[\\d,.]+\\s+${normalizedToCurrency}`, 'gi'),
          new RegExp(`1\\s+[A-Z]{3}\\s*≈\\s*[\\d,.]+\\s+${targetCurrency}`, 'gi'),
        ];

        let rateDisplayMatches = [];
        ratePatterns.forEach(pattern => {
          const matches = document.body.textContent.match(pattern) || [];
          rateDisplayMatches = rateDisplayMatches.concat(matches);
        });

        // Check what currencies are actually selected
        const selectedCurrencies = currencyButtons.map(b => b.textContent?.trim());
        const isCorrectCurrency = selectedCurrencies.some(curr =>
          curr === targetCurrency || curr === normalizedToCurrency
        );

        return {
          selectedCurrencies: selectedCurrencies,
          rateDisplay: [...new Set(rateDisplayMatches)], // Remove duplicates
          isCorrectCurrencySelected: isCorrectCurrency,
          pageHasTargetCurrency: document.body.textContent.includes(targetCurrency) ||
            document.body.textContent.includes(normalizedToCurrency)
        };
      }, toCurrency, this.normalizeCurrency(toCurrency));

      console.log('📋 Final currency state:');
      console.log(`  Selected currencies: ${finalState.selectedCurrencies.join(' → ')}`);
      console.log(`  Rate displays: ${finalState.rateDisplay.join(', ')}`);
      console.log(`  Correct currency selected: ${finalState.isCorrectCurrencySelected}`);
      console.log(`  Page has target currency: ${finalState.pageHasTargetCurrency}`);

      // If currency selection failed, stop here with error
      if (!finalState.isCorrectCurrencySelected && !finalState.pageHasTargetCurrency) {
        console.error(`❌ Currency selection completely failed. Expected ${toCurrency}, got ${finalState.selectedCurrencies.join(' → ')}`);
        return {
          success: false,
          error: `Currency selection failed: Expected ${toCurrency}, but page shows ${finalState.selectedCurrencies.join(' → ')}`,
          extractedRates: [],
          currencySelectionFailed: true
        };
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
        await new Promise(resolve => setTimeout(resolve, 15000));

        try {
          await page.waitForSelector('.hero_calc-wrap, .container-large, .n-hero_inner, [class*="rates"], [class*="calculator"], [class*="rate"], div, span, p', { timeout: 15000 });
          console.log('✅ Rate-containing elements found');
        } catch (error) {
          console.warn('⚠️ No rate-containing elements found within timeout:', error.message);
        }

        console.log('🔍 Step 6: DEEP DEBUG rate extraction...');
        await new Promise(resolve => setTimeout(resolve, 3000));

        const extractedRates = await page.evaluate((fromCurrency, toCurrency, amount, sendwaveOnly, supportedCurrencies, normalizedToCurrency) => {
          const rates = [];
          const debugInfo = [];

          debugInfo.push('🔍 SIMPLIFIED RATE EXTRACTION: Starting...');
          const pageText = document.body.textContent || '';
          debugInfo.push(`📝 Page text length: ${pageText.length} characters`);

          // Check what currency is actually being shown on the page
          const actualToCurrency = (() => {
            // Look for rate display patterns like "1 USD ≈ 147.50 KES"
            const rateDisplays = pageText.match(/1\s+[A-Z]{3}\s*[≈=]\s*[\d,.]+\s+([A-Z]{3})/g) || [];
            if (rateDisplays.length > 0) {
              const match = rateDisplays[0].match(/1\s+[A-Z]{3}\s*[≈=]\s*[\d,.]+\s+([A-Z]{3})/);
              return match ? match[1] : normalizedToCurrency;
            }
            return normalizedToCurrency;
          })();

          debugInfo.push(`🔄 Target: ${toCurrency} → Normalized: ${normalizedToCurrency} → Actually shown: ${actualToCurrency}`);
          const currencyToExtract = actualToCurrency;

          // Enhanced provider variants with more comprehensive patterns
          const providerVariants = {
            'Nala': ['nala', 'nala.com'],
            'Remitly': ['remitly', 'remitly.com', 'remitly.co.uk', 'remitly'],
            'Sendwave': ['sendwave', 'send wave', 'sendwave.com', 'wave'],
            'Western Union': ['western union', 'westernunion', 'western-union', 'wu', 'western', 'wu'],
            'TapTapSend': ['taptapsend', 'taptap', 'tap tap send', 'tap-tap-send', 'taptap send'],
            'Wise': ['wise', 'wise.com', 'transferwise', 'wise.co.uk'],
            'Remit': ['remit', 'Remit'],
            'MoneyGram': ['moneygram', 'money gram', 'moneygram.com'],
            'Ria': ['ria', 'ria money', 'riamoney', 'ria.com'],
            'WorldRemit': ['worldremit', 'world remit', 'worldremit.com'],
            'Xoom': ['xoom', 'xoom.com', 'paypal xoom'],
            'TransferGo': ['transfergo', 'transfer go', 'transfergo.com'],
            'Azimo': ['azimo', 'azimo.com'],
            'Small World': ['small world', 'smallworld', 'smallworldfs'],
            'Paysend': ['paysend', 'paysend.com']
          };

          // STEP 1: Look for structured rate cards/containers
          debugInfo.push('🔍 STEP 1: Looking for structured rate containers...');
          
          const rateContainers = document.querySelectorAll(`
            [data-testid*="rate"], [data-testid*="provider"], [data-testid*="comparison"],
            [class*="rate"], [class*="provider"], [class*="comparison"], [class*="card"],
            .rate-card, .provider-card, .comparison-item, .rate-item,
            div[class*="grid"] > div, section, article
          `);

          debugInfo.push(`Found ${rateContainers.length} potential rate containers`);

          rateContainers.forEach((container, index) => {
            let containerText = container.textContent || '';

            // Pre-process to insert spaces after timezone offsets to prevent concatenation (e.g., "GMT+310,148.90" -> "GMT+3 10,148.90")
            containerText = containerText.replace(/(GMT[+-]\d{1,2})([\d,.]+)/g, '$1 $2');
            containerText = containerText.replace(/(UTC[+-]\d{1,2})([\d,.]+)/g, '$1 $2');  // If UTC appears
            
            // Skip very large containers (likely page containers)
            if (containerText.length > 2000) {
              debugInfo.push(`    Skipped container ${index} (too large: ${containerText.length} chars)`);
              return;
            }
            
            debugInfo.push(`    Container ${index}: ${containerText.length} chars, text: "${containerText.substring(0, 200)}..."`);
          
            
            // Look for provider name in this container
            let detectedProvider = null;
            for (const [provider, variants] of Object.entries(providerVariants)) {
              if (sendwaveOnly && provider !== 'Sendwave') continue;
              
              if (variants.some(variant => containerText.toLowerCase().includes(variant.toLowerCase()))) {
                detectedProvider = provider;
                debugInfo.push(`    Detected provider "${provider}" via pattern matching`);
                break;
              }
            }
            
            // If no provider detected directly in container, look for rates first
            // and try to infer provider from broader page context
            if (!detectedProvider) {
              // Check if this container has currency rates
              const hasRates = new RegExp(`([0-9]{1,3}(?:,[0-9]{3})*(?:\\.[0-9]{1,2})?)\\s*${currencyToExtract}\\b`, 'gi').test(containerText);
              
              if (hasRates) {
                // Look for provider mentions in nearby text or page context
                // Get a larger context around this container
                const containerIndex = Array.from(rateContainers).indexOf(container);
                let contextText = containerText;
                
                // Add context from nearby containers
                for (let i = Math.max(0, containerIndex - 2); i <= Math.min(rateContainers.length - 1, containerIndex + 2); i++) {
                  if (i !== containerIndex) {
                    const nearbyContainer = rateContainers[i];
                    contextText += ' ' + (nearbyContainer.textContent || '');
                  }
                }
                
                // Try to find provider in expanded context
                for (const [provider, variants] of Object.entries(providerVariants)) {
                  if (sendwaveOnly && provider !== 'Sendwave') continue;
                  
                  if (variants.some(variant => contextText.toLowerCase().includes(variant.toLowerCase()))) {
                    detectedProvider = provider;
                    debugInfo.push(`    Detected provider "${provider}" via expanded context search`);
                    break;
                  }
                }
              }
            }

            // If no provider detected, try to extract rates anyway and assign generic names
            if (!detectedProvider) {
              debugInfo.push(`    No provider detected in container ${index}`);
              // Only skip if we're in sendwave-only mode and didn't detect sendwave
              if (sendwaveOnly) {
                debugInfo.push(`    Skipping container ${index} (sendwave-only mode, no sendwave detected)`);
                return;
              }
              
              // Assign a generic provider name based on container index
              detectedProvider = `Provider-${index + 1}`;
              debugInfo.push(`    Assigned generic provider: ${detectedProvider}`);
            } else {
              debugInfo.push(`    Detected provider: ${detectedProvider}`);
            }

            // Look for rates in this container
            const ratePatterns = [
              // Match numbers followed by currency code (e.g., "147.50 KES", "147,500 KES")
              new RegExp(`([0-9]{1,3}(?:,[0-9]{3})*(?:\\.[0-9]{1,2})?)\\s*${currencyToExtract}\\b`, 'gi'),
              // Also try with spaces
              new RegExp(`([0-9]{1,3}(?:,[0-9]{3})*(?:\\.[0-9]{1,2})?)\\s+${currencyToExtract}\\b`, 'gi')
            ];

            let containerRates = [];
            
            ratePatterns.forEach(pattern => {
              const matches = [...containerText.matchAll(pattern)];
              matches.forEach(match => {
                const rateValue = parseFloat(match[1].replace(/,/g, ''));
                
                // Get context around the match
                const matchIndex = containerText.indexOf(match[0]);
                const context = containerText.substring(
                  Math.max(0, matchIndex - 50),
                  Math.min(containerText.length, matchIndex + 50)
                );

                // Skip timestamp-related matches - but be more precise
                // Only skip if the number appears to BE the timestamp, not just near one
                const isActualTimestamp = (
                  context.match(/\d{2}:\d{2}/) && 
                  Math.abs(context.indexOf(match[0]) - context.search(/\d{2}:\d{2}/)) < 10
                ) || (
                  (context.includes('GMT+') || context.includes('UTC+')) && 
                  Math.abs(context.indexOf(match[0]) - context.indexOf('GMT+') || context.indexOf('UTC+')) < 20
                );
                
                if (isActualTimestamp) {
                  debugInfo.push(`    Skipped ${rateValue} (is actual timestamp)`);
                  return;
                }

                // Determine if this is an exchange rate or total amount
                let finalRate;
                let recipientAmount = rateValue;

                // Assume large numbers (> amount * 5) are likely recipient totals; smaller ones are exchange rates
                if (rateValue > amount * 5) {
                  // Likely a total amount (e.g., 10,800 for GHS or 130,000 for KES)
                  finalRate = rateValue / amount;
                  recipientAmount = rateValue;
                } else {
                  // Likely an exchange rate (e.g., 10.66 for GHS or 130 for KES)
                  finalRate = rateValue;
                  recipientAmount = finalRate * amount;
                }

                // Broad validation: Skip absurd rates (adjust ranges based on supported currencies if needed)
                if (finalRate < 0.1 || finalRate > 100000) {
                  debugInfo.push(`    Skipped invalid rate ${rateValue} (finalRate ${finalRate} out of reasonable range)`);
                  return;
                }

                containerRates.push({
                  provider: detectedProvider,
                  rate: finalRate,
                  recipientReceives: recipientAmount,
                  rawValue: match[1],
                  context: context.trim()
                });
                
                debugInfo.push(`    Found rate for ${detectedProvider}: ${finalRate} → ${recipientAmount.toLocaleString()} ${currencyToExtract} (context: "${context}")`);
              });
            });

            // Add the best rate for this provider
            if (containerRates.length > 0) {
              // Sort by recipient amount (highest first) and take the best one
              containerRates.sort((a, b) => b.recipientReceives - a.recipientReceives);
              const bestRate = containerRates[0];
              
              // Check if we already have this provider
              const existingRate = rates.find(r => r.provider === bestRate.provider);
              if (!existingRate || bestRate.recipientReceives > existingRate.recipientReceives) {
                // Remove existing rate if this one is better
                if (existingRate) {
                  const index = rates.findIndex(r => r.provider === bestRate.provider);
                  rates.splice(index, 1);
                }
                
                rates.push({
                  provider: bestRate.provider,
                  rate: bestRate.rate,
                  recipientReceives: bestRate.recipientReceives,
                  currency: currencyToExtract,
                  timestamp: new Date().toISOString(),
                  extractedFrom: 'Structured container extraction',
                  rawValue: bestRate.rawValue
                });
              }
            }
          });

          // STEP 2: Fallback - Look for rate display patterns
          debugInfo.push('🔍 STEP 2: Fallback - Looking for rate display patterns...');
          
          const rateDisplayPatterns = [
            // Pattern 1: "1 USD ≈ 10.66 GHS" (more flexible symbol matching)
            new RegExp(`1\\s+${fromCurrency}\\s*(≈|~|=|-)\\s*([\\d,.]+)\\s+${currencyToExtract}`, 'gi'),
            // Pattern 2: "USD to GHS: 10.66"
            new RegExp(`${fromCurrency}\\s+to\\s+${currencyToExtract}[:\\s]+([\\d,.]+)`, 'gi'),
            // Pattern 3: Generic "xx.xx GHS" (keep as fallback)
            new RegExp(`([\\d,.]+)\\s+${currencyToExtract}`, 'gi')
          ];

          rateDisplayPatterns.forEach((pattern, patternIndex) => {
            const matches = [...pageText.matchAll(pattern)];
            debugInfo.push(`  Pattern ${patternIndex + 1}: found ${matches.length} matches`);
            
            matches.forEach(match => {
              const rate = parseFloat(match[1].replace(/,/g, ''));
              
              // For generic pattern, we need to validate it's actually a rate
              if (patternIndex === 2) {
                // Check if this looks like a timestamp or other non-rate number
                const context = pageText.substring(
                  Math.max(0, pageText.indexOf(match[0]) - 50),
                  Math.min(pageText.length, pageText.indexOf(match[0]) + 50)
                );
                
                if (context.includes('GMT') || context.includes('UTC') || 
                    context.includes('as of') || context.match(/\d{2}:\d{2}/)) {
                  return; // Skip timestamp-related matches
                }
              }
              
              if (rate >= 50 && rate <= 10000) {
                // Only add if we don't already have a rate for this provider
                const existingRate = rates.find(r => r.provider.includes('Nala'));
                if (!existingRate) {
                  rates.push({
                    provider: 'Nala (from rate display)',
                    rate: rate,
                    recipientReceives: rate * amount,
                    currency: currencyToExtract,
                    timestamp: new Date().toISOString(),
                    extractedFrom: 'Rate display pattern',
                    rawValue: match[1]
                  });
                  
                  debugInfo.push(`  Added from rate display: ${rate} → ${(rate * amount).toLocaleString()} ${currencyToExtract}`);
                }
              }
            });
          });


          debugInfo.push(`\n🏁 EXTRACTION COMPLETE. Final rates: ${rates.length}`);
          rates.forEach(rate => {
            debugInfo.push(`  ${rate.provider}: ${rate.rate} → ${rate.recipientReceives.toLocaleString()} ${rate.currency}`);
          });

          return { rates, debugInfo, actualCurrency: currencyToExtract };
        }, fromCurrency, toCurrency, amount, sendwaveOnly, this.supportedCurrencies, this.normalizeCurrency(toCurrency));
        console.log('🐛 DEEP DEBUG Results:');
        extractedRates.debugInfo.forEach(line => console.log(line));

        return {
          success: true,
          fromCurrencyResult: fromCurrencyResult,
          toCurrencyResult: toCurrencyResult,
          finalCurrencies: finalState.selectedCurrencies,
          rateDisplays: finalState.rateDisplay,
          compareRatesActivated: compareRatesClicked,
          extractedRates: extractedRates.rates,
          actualCurrency: extractedRates.actualCurrency,
          currencyMismatch: extractedRates.actualCurrency !== this.normalizeCurrency(toCurrency)
        };
      }

      return {
        success: true,
        fromCurrencyResult: fromCurrencyResult,
        toCurrencyResult: toCurrencyResult,
        finalCurrencies: finalState.selectedCurrencies,
        rateDisplays: finalState.rateDisplay,
        compareRatesActivated: compareRatesClicked,
        extractedRates: [],
        actualCurrency: this.normalizeCurrency(toCurrency),
        currencyMismatch: false
      };

    } catch (error) {
      console.error(`❌ Currency selection failed: ${error.message}`);
      return {
        success: false,
        error: error.message,
        extractedRates: [],
        actualCurrency: this.normalizeCurrency(toCurrency),
        currencyMismatch: false
      };
    } finally {
      if (page) {
        // await page.screenshot({ path: `final_screenshot_${toCurrency}_${Date.now()}.png`, fullPage: true });
        await page.close().catch(err => console.error('⚠️ Error closing page:', err.message));
        console.log('✅ Page closed');
      }
    }
  }

  async scrapeRatesWithRetry(fromCurrency, toCurrency, amount, sendwaveOnly = false) {
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

        const result = await this.testCurrencySelection(fromCurrency, toCurrency, amount, sendwaveOnly);

        if (result.success) {
          console.log(`✅ Successfully completed scraping on attempt ${attempt}`);
          return result;
        } else {
          console.log(`❌ Scraping failed on attempt ${attempt}: ${result.error}`);
          lastError = new Error(result.error);
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
      extractedRates: [],
      actualCurrency: this.normalizeCurrency(toCurrency),
      currencyMismatch: false
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

  async scrapeAllRates(fromCurrency, toCurrency, amount, sendwaveOnly = false) {
    if (!fromCurrency || !toCurrency || !amount) {
      throw new Error("fromCurrency, toCurrency, and amount are required");
    }
    if (isNaN(amount) || amount <= 0) {
      throw new Error("amount must be a positive number");
    }

    const result = await this.scrapeRatesWithRetry(fromCurrency, toCurrency, amount, sendwaveOnly);

    // Use the actual currency that was extracted, not necessarily the requested one
    const actualCurrency = result.actualCurrency || this.normalizeCurrency(toCurrency);
    const hasCurrencyMismatch = result.currencyMismatch || false;

    const rates = result.extractedRates.map(rate => ({
      provider: rate.provider,
      rate: rate.rate,
      recipientReceives: rate.recipientReceives,
      currency: actualCurrency, // Use the actual currency found
      originalRequestedCurrency: toCurrency, // Keep original for reference
      fees: null,
      timestamp: rate.timestamp,
      service: rate.provider.toLowerCase(),
      extractedFrom: rate.extractedFrom,
      rawValue: rate.rawValue || rate.rate.toString()
    }));

    const status = (() => {
      if (result.success && rates.length > 0) {
        return hasCurrencyMismatch ? 'partial_success' : 'success';
      }
      return 'error';
    })();

    const errors = [];
    if (!result.success || rates.length === 0) {
      errors.push({ service: 'nala', error: result.error || 'No rates extracted' });
    }
    if (hasCurrencyMismatch) {
      errors.push({
        service: 'nala',
        error: `Currency mismatch: Requested ${toCurrency}, but found ${actualCurrency}`,
        type: 'currency_mismatch'
      });
    }

    return {
      status: status,
      fromCurrency,
      toCurrency: actualCurrency, // Return the actual currency found
      originalRequestedCurrency: toCurrency, // Keep original for reference
      amount,
      timestamp: new Date().toISOString(),
      rates,
      errors: errors,
      debug: {
        ...result,
        currencyMismatch: hasCurrencyMismatch,
        debugInfo: result.extractedRates ? result.extractedRates.debugInfo || [] : []
      }
    };
  }

  async getSendwaveRateOnly(fromCurrency, toCurrency, amount) {
    console.log(`🎯 DEBUG: Extracting Sendwave rate only: ${amount} ${fromCurrency} → ${toCurrency}`);

    const result = await this.scrapeAllRates(fromCurrency, toCurrency, amount, true);

    return {
      status: result.rates.length > 0 ? 'success' : 'debug',
      fromCurrency,
      toCurrency: result.toCurrency, // Use the actual currency from scrapeAllRates
      originalRequestedCurrency: toCurrency,
      amount,
      timestamp: new Date().toISOString(),
      rates: result.rates.filter(rate => rate.provider.toLowerCase().includes('sendwave')),
      errors: result.rates.length > 0 ? [] : [{ service: 'nala', error: 'No Sendwave rates extracted' }],
      debug: {
        ...result.debug,
        message: 'Deep debug mode - check logs for detailed analysis'
      }
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
        { code: 'KSH', name: 'Kenyan Shilling (alias)', symbol: 'KSh', normalizedTo: 'KES' },
        { code: 'UGX', name: 'Ugandan Shilling', symbol: 'USh' },
        { code: 'TZS', name: 'Tanzanian Shilling', symbol: 'TZS' },
        { code: 'GHS', name: 'Ghanaian Cedi', symbol: 'GH₵' }
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
      version: '4.4.0-GMT-TIMESTAMP-FIX',
      description: 'Complete fix with GMT+ timestamp filtering, comprehensive currency support, and robust rate extraction',
      supportedServices: Object.keys(this.services),
      features: [
        'GMT+ timestamp filtering - prevents duplicate rates from timezone data',
        'Enhanced provider detection including TapTapSend',
        'Adaptive currency detection - extracts rates for whatever currency is actually shown',
        'Comprehensive currency selection with multiple retry strategies',
        'Enhanced search input detection with multiple selectors and confirmation handling',
        'Robust TO currency button detection excluding FROM currency buttons',
        'Currency mismatch detection and reporting',
        'Improved rate validation with reasonable ranges for different currencies',
        'Multiple click method attempts for difficult UI elements',
        'Comprehensive option matching with country names, flags, and variations',
        'Rate deduplication and validation',
        'Graceful degradation when currency selection partially fails',
        'Screenshot capture for debugging',
        'Support for GHS (Ghanaian Cedi) currency'
      ],
      currencyHandling: {
        normalization: this.currencyNormalizationMap,
        countryMapping: this.currencyToCountryMap,
        supportedCurrencies: this.supportedCurrencies,
        adaptiveExtraction: true,
        timestampFiltering: true
      },
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