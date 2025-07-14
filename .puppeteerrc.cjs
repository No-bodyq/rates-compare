const {join} = require('path');
const os = require('os');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  // Use the user's cache directory where Chrome is actually installed
  cacheDirectory: join(os.homedir(), '.cache', 'puppeteer'),
  
  // Skip download if we're using @sparticuz/chromium in production
  skipDownload: process.env.NODE_ENV === 'production',
};