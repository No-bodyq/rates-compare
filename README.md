# Rate Compare

A Next.js application for comparing exchange rates across different providers, featuring real-time rate data, currency conversion, and provider benchmarking.

## Features

- Real-time exchange rate comparison across multiple providers
- Interactive rate comparison charts
- Currency conversion calculator
- Provider benchmarking and analysis
- Live cryptocurrency rate tracking
- Web scraping for rate data collection

## Prerequisites

Before running this application, ensure you have:

- **Node.js** (v18 or higher)
- **npm** or **yarn** package manager
- **AWS Cognito** credentials for authentication
- **PCX API** access credentials
- **API authentication** credentials for exchange rate services

## Environment Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd rates-compare
```

### 2. Install Dependencies

```bash
npm install
# or
yarn install
```

The postinstall script will automatically install Chrome for Puppeteer web scraping.

### 3. Configure Environment Variables

Create a `.env` file in the project root with the following variables:

```env
# AWS Cognito Configuration (Required)
NEXT_PUBLIC_USER_POOL_ID=your_cognito_user_pool_id
NEXT_PUBLIC_USER_POOL_CLIENT_ID=your_cognito_client_id

# PCX API Configuration (Required)
PCX_API_URL=https://devs.pcxpay.com/v1

# Basic Auth for Exchange Rate APIs (Required)
AUTH_USERNAME=your_api_username
AUTH_PASSWORD=your_api_password

# Next.js Configuration (Optional)
NEXTAUTH_URL=http://localhost:3000
```

**Important:** You must configure these environment variables for the application to function properly.

### 4. Obtain Required Credentials

#### AWS Cognito Setup
1. Create an AWS Cognito User Pool
2. Create an App Client for your User Pool
3. Copy the User Pool ID and Client ID to your `.env` file

#### PCX API Access
1. Register for PCX API access at [PCX Developer Portal](https://devs.pcxpay.com)
2. Obtain your API credentials
3. The default API URL is provided, but you can customize if needed

#### Exchange Rate API Authentication
1. Obtain username and password for exchange rate API services
2. Add these credentials to your `.env` file

## Running the Application

### Development Mode

```bash
npm run dev
# or
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build

```bash
npm run build
npm run start
# or
yarn build
yarn start
```

### Code Quality

```bash
# Run ESLint
npm run lint
# or
yarn lint
```

## Project Structure

```
rates-compare/
├── src/
│   ├── app/                 # Next.js App Router pages
│   │   ├── api/            # API routes
│   │   │   ├── auth/       # Authentication endpoints
│   │   │   ├── convert/    # Currency conversion
│   │   │   ├── crypto/     # Cryptocurrency rates
│   │   │   ├── exchange-rates/ # Exchange rate data
│   │   │   └── scrape-rates/   # Web scraping endpoints
│   │   └── pages/          # Application pages
│   ├── components/         # React components
│   │   └── RateEngine/     # Rate comparison components
│   ├── lib/               # Utility libraries
│   │   └── services/      # API service modules
│   ├── services/          # Authentication services
│   └── stores/            # State management (Zustand)
├── public/                # Static assets
└── package.json
```

## Key Technologies

- **Next.js 15** - React framework with App Router
- **React 19** - UI library
- **Tailwind CSS 4** - Styling framework
- **Zustand** - State management
- **Puppeteer** - Web scraping
- **AWS Amplify** - Authentication integration
- **Recharts** - Data visualization
- **Lucide React** - Icons

## API Routes

- `/api/auth/pcx-token` - PCX authentication
- `/api/convert` - Currency conversion
- `/api/crypto` - Cryptocurrency rates
- `/api/exchange-rates` - Exchange rate data
- `/api/scrape-rates` - Web scraping for rates

## Troubleshooting

### Common Issues

1. **Chrome/Puppeteer Issues**
   - Run `npx puppeteer browsers install chrome` manually
   - Ensure sufficient system resources for browser automation

2. **Authentication Failures**
   - Verify AWS Cognito credentials in `.env`
   - Check PCX API access and credentials
   - Ensure AUTH_USERNAME and AUTH_PASSWORD are correct

3. **API Connection Issues**
   - Verify PCX_API_URL is accessible
   - Check network connectivity and firewall settings
   - Ensure API credentials have proper permissions

4. **Environment Variables Not Loading**
   - Verify `.env` file is in the project root
   - Restart the development server after changes
   - Check for typos in environment variable names

### Development Tips

- Use browser DevTools to monitor API requests
- Check server console for detailed error messages
- Enable debug mode by setting `NODE_ENV=development`

## Deployment

### Vercel (Recommended)

The easiest way to deploy is using the [Vercel Platform](https://vercel.com/new):

1. Connect your repository to Vercel
2. Add environment variables in Vercel dashboard
3. Deploy automatically on git push

### Other Platforms

Ensure the deployment platform supports:
- Node.js runtime
- Environment variable configuration
- Puppeteer/Chrome installation

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## License

This project is private and proprietary.
