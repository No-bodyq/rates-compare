# User Stories - Rate Compare Application

## Overview

The Rate Compare application serves three primary user personas:
1. **End Users/Customers** - Comparing rates to find best transfer options
2. **PCX Rate Managers** - Managing organizational rates and spreads to stay competitive  
3. **Analysts/Admins** - Deep analysis of market positioning and rate optimization

## Epic 1: Rate Comparison & Analysis

### Story 1.1: Multi-Provider Rate Comparison
**As a user, I want to compare exchange rates across multiple providers so I can find the best rates for money transfers**

**Acceptance Criteria:**
- Display rates from PCX organizations, external competitors, and crypto providers
- Show rates in a sortable table format ranked by competitiveness
- Include provider name, rate, and recipient amount for easy comparison
- Support both fiat-to-fiat and crypto-to-fiat conversions
- Update rates automatically when currency pair or amount changes

**Implementation Notes:**
- Uses BenchmarkTable component for tabular display
- Integrates with PCX API and external scraping services
- Supports deduplication of rates by provider

### Story 1.2: Real-Time Rate Display
**As a user, I want to view real-time rates from different providers so I have current market information**

**Acceptance Criteria:**
- Fetch fresh rates from all available providers on demand
- Display timestamp of last rate update for each provider
- Show loading indicators during rate fetching
- Handle rate fetch failures gracefully with error messages
- Automatically filter out stale rates (older than 24 hours for competitive data)

**Implementation Notes:**
- LiveProviderRates component displays real-time data
- Uses both `/api/scrape-rates` and `/api/crypto` endpoints
- Implements rate freshness validation

### Story 1.3: Visual Rate Comparison Charts
**As a user, I want to see visual charts comparing rates so I can quickly identify the best options**

**Acceptance Criteria:**
- Display rates in an interactive bar chart format
- Color-code different provider types (PCX, competitors, crypto)
- Show tooltips with detailed rate information on hover
- Include statistical summary (best rate, average, spread)
- Adapt chart precision for crypto vs fiat currencies

**Implementation Notes:**
- ComparisonChart component uses Recharts library
- Supports both 8-decimal crypto precision and 4-decimal fiat precision
- Color coding: #8B5CF6 for PCX, #10B981 for fiat providers, #F59E0B for crypto

### Story 1.4: PCX Competitive Benchmarking
**As a user, I want to benchmark PCX rates against competitors so I can assess market competitiveness**

**Acceptance Criteria:**
- Show PCX organization rates alongside competitor rates
- Calculate and display market position ranking
- Highlight spread required to achieve #1 position
- Show percentage difference from best available rate
- Support comparison across multiple PCX organizations

**Implementation Notes:**
- Enhanced rate data processing in RateEngine component
- Calculates spreads and final rates including adjustments
- Supports multiple PCX organizations with org-specific rate configs

### Story 1.5: Market Position Ranking
**As a user, I want to see my organization's position in the market ranking so I understand where we stand competitively**

**Acceptance Criteria:**
- Display current market position (e.g., "#3 out of 8 providers")
- Show gap to #1 position in both absolute and percentage terms
- Update position dynamically as spreads are adjusted
- Highlight when organization achieves #1 position
- Show reliability scores and last update timestamps

**Implementation Notes:**
- getPositionForRate function calculates real-time rankings
- Supports spread simulation to see position changes
- Integrates with Simulator component for what-if analysis

## Epic 2: Currency & Transaction Management

### Story 2.1: Multi-Currency Support
**As a user, I want to select from both fiat and cryptocurrency pairs so I can compare rates for different types of transfers**

**Acceptance Criteria:**
- Support major fiat currencies (USD, EUR, GBP, NGN, GHS, etc.)
- Include popular cryptocurrencies (BTC, ETH, USDC, USDT, etc.)
- Automatically detect crypto vs fiat corridors
- Route to appropriate API endpoints based on currency types
- Display currency symbols and proper formatting

**Implementation Notes:**
- Currency detection logic in RateEngine:33-50
- CRYPTOCURRENCIES and FIAT_CURRENCIES arrays define supported currencies
- shouldUseCryptoAPI function determines routing logic

### Story 2.2: Transfer Amount Input
**As a user, I want to input a specific transfer amount so I can see exact amounts the recipient will receive**

**Acceptance Criteria:**
- Allow numeric input with decimal precision
- Validate input format and show error for invalid entries
- Update all calculations dynamically as amount changes
- Support large amounts with proper formatting
- Default to reasonable amount (e.g., $1000) for initial display

**Implementation Notes:**
- InputSection component handles amount input with validation
- handleAmountChange function sanitizes input
- Uses regex validation: /^\d*\.?\d*$/

### Story 2.3: Recipient Amount Calculation
**As a user, I want to see calculated recipient amounts for each provider so I can compare what recipients actually get**

**Acceptance Criteria:**
- Calculate exact recipient amount after fees and rate application
- Handle rate direction detection (multiply vs divide)
- Show amounts in recipient currency with proper formatting
- Account for provider-specific rate methodologies
- Display calculation debugging for transparency

**Implementation Notes:**
- calculateRecipientAmount function with comprehensive rate direction logic
- Provider-specific rate handling with debugging capabilities
- Expected rate ranges for common currency pairs for validation

### Story 2.4: Automatic Currency Type Detection
**As a user, I want the system to detect crypto vs fiat corridors automatically so rates are fetched from appropriate sources**

**Acceptance Criteria:**
- Automatically identify when crypto currencies are involved
- Route crypto requests to Coinbase API endpoint
- Route fiat requests to web scraping endpoints
- Display appropriate precision (8 decimals for crypto, 4 for fiat)
- Show visual indicators for currency types

**Implementation Notes:**
- isCryptocurrency and isFiatCurrency helper functions
- Conditional routing to /api/crypto vs /api/scrape-rates
- Adaptive number formatting based on corridor type

## Epic 3: PCX Organization Management

### Story 3.1: Organization Selection
**As a PCX user, I want to select from available organizations so I can view rates specific to my org**

**Acceptance Criteria:**
- Display dropdown with all available PCX organizations
- Show organization name and ID for identification
- Update rates automatically when organization changes
- Support default organization selection
- Handle organization not found scenarios gracefully

**Implementation Notes:**
- Fetches organizations via getOrganizations API call
- InputSection component provides organization selector
- Supports both API-fetched and configured default organizations

### Story 3.2: Default Organization Configuration
**As a PCX user, I want to set a default organization so I don't have to select it repeatedly**

**Acceptance Criteria:**
- Allow setting custom default organization name and ID
- Validate default organization against available orgs
- Persist default organization settings locally
- Show validation status for configured defaults
- Auto-select default organization on application load

**Implementation Notes:**
- SettingsPanel component for configuration management
- defaultOrg state with name and ID properties
- isDefaultOrgValid validation state

### Story 3.3: Organization-Specific Rate Fetching
**As a PCX user, I want to fetch rates for specific organizations so I can see org-specific pricing**

**Acceptance Criteria:**
- Fetch rates using organization ID from PCX API
- Display org-specific spreads and configurations
- Handle organizations with no rate configurations
- Show last update timestamp for org rates
- Support multiple organizations simultaneously

**Implementation Notes:**
- getExchangeRatesByOrg API integration
- fetchOrgRates function with error handling
- Organization-specific rate storage in fetchedOrgRates state

### Story 3.4: Organization Settings Management
**As a PCX admin, I want to configure organization settings so I can manage default preferences**

**Acceptance Criteria:**
- Input fields for organization name and UUID
- Dropdown selector from existing organizations
- Validate organization exists in API response
- Reset to original defaults functionality
- Apply settings with immediate feedback

**Implementation Notes:**
- SettingsPanel component with form validation
- Organization validation against fetchedOrgs data
- Settings persistence and reset functionality

## Epic 4: Rate Optimization & Simulation

### Story 4.1: Spread Adjustment
**As a rate manager, I want to adjust spreads for my organization so I can test different pricing strategies**

**Acceptance Criteria:**
- Allow fine-grained spread adjustment with +/- controls
- Support direct numeric input for precise values
- Update final rates and recipient amounts in real-time
- Show impact on market position immediately
- Persist spread adjustments during session

**Implementation Notes:**
- Spread adjustment controls in InputSection component
- adjustSpread function with high precision (8 decimal places)
- Real-time calculation updates via useMemo hooks

### Story 4.2: Scenario Simulation
**As a rate manager, I want to simulate different spread scenarios so I can see impact on competitiveness**

**Acceptance Criteria:**
- Provide predefined scenario buttons (e.g., +0.1%, +0.5%, +1.0%)
- Show before/after market position for each scenario
- Calculate profitability impact of spread changes
- Display competitive analysis for each scenario
- Allow quick application of tested scenarios

**Implementation Notes:**
- Simulator component with scenario testing capabilities
- Predefined spread adjustment buttons
- Position recalculation for each scenario test

### Story 4.3: Competitive Positioning Analysis
**As a rate manager, I want to see what spread is needed to rank #1 so I can optimize pricing**

**Acceptance Criteria:**
- Calculate exact spread needed to beat current #1 provider
- Show margin required to maintain #1 position
- Display profit impact of achieving #1 position
- Update calculations dynamically as market rates change
- Highlight when organization is already #1

**Implementation Notes:**
- getPositionForRate function calculates ranking
- Spread-to-position calculation logic
- Real-time competitive gap analysis

### Story 4.4: Optimization Targets
**As a rate manager, I want to test predefined spread adjustments so I can quickly evaluate common scenarios**

**Acceptance Criteria:**
- Preset buttons for common spread adjustments (+/- 0.1%, 0.5%, 1.0%)
- Quick reset to base rate functionality
- Show immediate impact on recipient amounts
- Display position changes for each preset
- Support custom spread input alongside presets

**Implementation Notes:**
- Preset spread adjustment buttons in InputSection
- Quick application with immediate visual feedback
- Custom input validation and application

## Epic 5: Data Sources & Scraping

### Story 5.1: External Provider Rate Scraping
**As a user, I want to scrape live rates from external providers so I have current market data**

**Acceptance Criteria:**
- Scrape rates from major providers (Wise, Flutterwave, Western Union, etc.)
- Handle rate scraping failures gracefully
- Show scraping progress with loading indicators
- Deduplicate rates by provider (keep most recent)
- Support both manual and automatic scraping triggers

**Implementation Notes:**
- ScrapeRates function with provider-specific handling
- Uses Puppeteer for web scraping via /api/scrape-rates
- Deduplication logic in rate processing

### Story 5.2: Cryptocurrency Rate Integration
**As a user, I want to fetch crypto rates from Coinbase so I have accurate cryptocurrency pricing**

**Acceptance Criteria:**
- Integrate with Coinbase API for crypto rates
- Support major crypto-to-fiat pairs
- Handle crypto-specific precision requirements (8 decimals)
- Show crypto rates with appropriate formatting
- Fallback handling when crypto APIs are unavailable

**Implementation Notes:**
- Dedicated /api/crypto endpoint for cryptocurrency rates
- Conditional routing based on currency pair detection
- Crypto-specific number formatting throughout UI

### Story 5.3: Multi-Source Data Aggregation
**As a user, I want to combine rates from multiple data sources so I have comprehensive market coverage**

**Acceptance Criteria:**
- Aggregate rates from PCX API, external scraping, and crypto APIs
- Merge data sources without duplication
- Maintain source attribution for each rate
- Handle different data formats from various sources
- Show data source indicators in UI

**Implementation Notes:**
- combinedRates useMemo hook aggregates all sources
- Source tracking with apiSource field
- Color coding by data source type

### Story 5.4: Rate Deduplication
**As a user, I want the system to deduplicate rates by provider so I see only the most recent rate per provider**

**Acceptance Criteria:**
- Keep only the most recent rate per provider
- Use updatedAt timestamp for recency comparison
- Handle missing timestamps gracefully
- Maintain rate uniqueness across data refreshes
- Show deduplication status in logs

**Implementation Notes:**
- Map-based deduplication in rate processing
- Timestamp comparison logic for recency
- Deduplication applied across all data sources

## Epic 6: Authentication & Security

### Story 6.1: AWS Cognito Authentication
**As a user, I want to authenticate using AWS Cognito so my access is secure and managed**

**Acceptance Criteria:**
- Integrate with AWS Cognito User Pools
- Handle sign-in with username/password
- Manage ID tokens and access tokens securely
- Configure Amplify for Cognito integration
- Show authentication status in UI

**Implementation Notes:**
- useAuthStore with AWS Amplify integration
- Cognito configuration via environment variables
- Token management with Zustand persistence

### Story 6.2: Automatic Token Refresh
**As a user, I want automatic token refresh so I don't get logged out during active sessions**

**Acceptance Criteria:**
- Monitor token expiration automatically
- Refresh tokens before they expire (5-minute buffer)
- Handle refresh failures with graceful degradation
- Show token status and remaining time
- Continue background refresh during active use

**Implementation Notes:**
- Token refresh interval in useAuthStore
- Automatic refresh every minute with expiration checking
- Token validation with buffer time logic

### Story 6.3: Manual Authentication Refresh
**As a user, I want to manually refresh authentication so I can resolve auth issues myself**

**Acceptance Criteria:**
- Provide manual login/refresh button
- Clear existing tokens before refresh
- Show refresh progress with loading indicators
- Handle refresh errors with clear messaging
- Trigger data refetch after successful refresh

**Implementation Notes:**
- handleManualLogin function in RateEngine
- refreshPCXAuthToken service function
- Manual refresh button in Header component

### Story 6.4: API Access Token Validation
**As an admin, I want token validation for PCX API access so only authorized users access rate data**

**Acceptance Criteria:**
- Validate tokens against PCX API endpoints
- Handle 401 unauthorized responses appropriately
- Show token validation errors clearly
- Support token validation testing
- Maintain security for sensitive rate data

**Implementation Notes:**
- Token validation in /api/auth/pcx-token route
- Authorization header validation
- Error handling for invalid/expired tokens

## Epic 7: Data Display & Formatting

### Story 7.1: Currency-Appropriate Formatting
**As a user, I want to see rates formatted appropriately for currency type so crypto shows 8 decimals and fiat shows 2-4**

**Acceptance Criteria:**
- Show 8 decimal places for cryptocurrency rates
- Show 2-4 decimal places for fiat currency rates
- Apply proper currency symbols where appropriate
- Handle very large and very small numbers appropriately
- Maintain formatting consistency across all components

**Implementation Notes:**
- formatNumber and formatCurrency functions with adaptive precision
- isCurrentCorridorCrypto state drives formatting decisions
- Intl.NumberFormat with dynamic decimal places

### Story 7.2: Update Timestamp Display
**As a user, I want to see last update timestamps so I know how fresh the rate data is**

**Acceptance Criteria:**
- Show last update time for each rate
- Format timestamps in user-friendly format
- Highlight stale rates (older than threshold)
- Show update time in local timezone
- Update timestamps when rates refresh

**Implementation Notes:**
- updatedAt field processing in rate data
- toLocaleString() formatting for timestamps
- Rate freshness validation with configurable thresholds

### Story 7.3: Provider Type Visual Indicators
**As a user, I want visual indicators for different provider types so I can distinguish between PCX, competitors, and crypto sources**

**Acceptance Criteria:**
- Color-code provider types consistently
- Use distinct colors for PCX (#8B5CF6), competitors (#10B981), and crypto (#F59E0B)
- Show provider type labels or icons
- Maintain color consistency across all views
- Support accessibility with non-color indicators

**Implementation Notes:**
- Color coding in enhancedRateData processing
- apiSource field tracking for source attribution
- Consistent color application across components

### Story 7.4: Provider Status Indicators
**As a user, I want to see provider status indicators so I know which providers are active/available**

**Acceptance Criteria:**
- Show active/inactive status for each provider
- Display availability indicators
- Handle provider errors gracefully
- Show rate fetch success/failure status
- Provide status explanations on hover/click

**Implementation Notes:**
- Status field in rate data with active/inactive/unavailable states
- Error handling in rate fetching with status updates
- Visual status indicators in UI components

## Epic 8: Market Intelligence

### Story 8.1: Market Statistics
**As a user, I want to see rate statistics (best, average, spread) so I understand market dynamics**

**Acceptance Criteria:**
- Calculate and display best available rate
- Show market average rate
- Display rate spread (difference between best and worst)
- Show provider count and availability
- Update statistics automatically when rates change

**Implementation Notes:**
- Statistical calculations in ComparisonChart component
- Real-time statistics updates via useMemo hooks
- Market analytics display in chart summary cards

### Story 8.2: Rate Freshness Filtering
**As a user, I want to filter rates by recency so I only see today's rates when relevant**

**Acceptance Criteria:**
- Filter rates to show only today's data by default
- Support configurable age thresholds (24 hours default)
- Show count of excluded old rates
- Allow viewing all rates including historical
- Maintain freshness filtering across data sources

**Implementation Notes:**
- isRateFromToday function for date validation
- Rate filtering in combinedRates processing
- Configurable maxAgeHours parameter

### Story 8.3: Provider Reliability Scoring
**As a user, I want to see provider reliability scores so I can trust the data quality**

**Acceptance Criteria:**
- Display reliability percentage for each provider
- Base reliability on successful rate fetches
- Show reliability trends over time
- Factor reliability into provider rankings
- Explain reliability calculation methodology

**Implementation Notes:**
- Reliability scores in rate data (default 99.0% for providers, 99.9% for PCX)
- Reliability display in BenchmarkTable component
- Future enhancement for dynamic reliability calculation

### Story 8.4: Competitive Intelligence
**As a user, I want to identify market leaders and followers so I understand competitive positioning**

**Acceptance Criteria:**
- Identify consistently best-performing providers
- Show market share and position trends
- Highlight new market entrants
- Track provider performance over time
- Show competitive gaps and opportunities

**Implementation Notes:**
- Provider ranking logic in enhancedRateData
- Market position tracking and analysis
- Competitive gap calculations in benchmark table

## Epic 9: Error Handling & Feedback

### Story 9.1: Clear Error Messaging
**As a user, I want clear error messages when rate fetching fails so I understand what went wrong**

**Acceptance Criteria:**
- Show specific error messages for different failure types
- Distinguish between network, authentication, and API errors
- Provide actionable suggestions for error resolution
- Avoid technical jargon in user-facing messages
- Log detailed errors for debugging while showing simple messages to users

**Implementation Notes:**
- ErrorMessage component for consistent error display
- Error categorization in API calls with specific messaging
- Toast notifications for different error types

### Story 9.2: Loading Indicators
**As a user, I want loading indicators during rate fetching so I know the system is working**

**Acceptance Criteria:**
- Show loading spinners during rate fetch operations
- Display different loading states for different operations
- Provide progress information for long-running operations
- Allow cancellation of long-running requests
- Show loading overlay on relevant UI sections

**Implementation Notes:**
- Multiple loading states: isLoading, isLoadingOrgs, isLoadingAllRates
- Loading indicators in Header and throughout UI
- Operation-specific loading messages

### Story 9.3: Success Notifications
**As a user, I want success notifications when operations complete so I know actions were successful**

**Acceptance Criteria:**
- Show toast notifications for successful operations
- Include relevant details (e.g., number of rates fetched)
- Use distinct styling for success vs error messages
- Auto-dismiss notifications after reasonable time
- Allow manual dismissal of notifications

**Implementation Notes:**
- ToastContainer with react-toastify for notifications
- Success toast calls throughout operation completions
- Unique toast IDs to prevent duplicate notifications

### Story 9.4: Input Validation
**As a user, I want validation messages for invalid inputs so I can correct mistakes**

**Acceptance Criteria:**
- Validate numeric inputs for amount fields
- Check currency selection completeness
- Validate organization selection
- Show validation errors immediately on input
- Prevent submission with invalid data

**Implementation Notes:**
- Input validation in handleAmountChange with regex
- Organization validation in settings panel
- Real-time validation feedback in UI

## Epic 10: Advanced Features

### Story 10.1: Detailed Rate Breakdown
**As an analyst, I want to see detailed rate breakdowns (base rate + spread) so I understand pricing components**

**Acceptance Criteria:**
- Show base rate from external provider
- Display applied spread percentage
- Calculate and show final rate
- Break down fee components
- Show margin calculations

**Implementation Notes:**
- Rate breakdown display in BenchmarkTable
- Spread calculation logic in enhancedRateData
- Component rate display (base + spread = final)

### Story 10.2: Rate Calculation Debugging
**As a power user, I want debugging information for rate calculations so I can verify accuracy**

**Acceptance Criteria:**
- Provide detailed calculation logs
- Show rate direction detection logic
- Display expected vs actual rate ranges
- Log provider-specific rate handling
- Enable debugging mode for troubleshooting

**Implementation Notes:**
- debugRate function in calculateRecipientAmount
- window.rateDebugLog for inspection
- Detailed console logging for rate calculations

### Story 10.3: Calculation Methodology Transparency
**As a compliance user, I want to see rate calculation methodology so I can audit the system**

**Acceptance Criteria:**
- Document rate direction detection logic
- Show expected rate ranges for currency pairs
- Explain provider-specific handling
- Provide calculation audit trail
- Support regulatory compliance requirements

**Implementation Notes:**
- Expected rate ranges defined in calculateRecipientAmount
- Provider-specific logic documentation in getProviderSpecificRate
- Comprehensive calculation logging and audit trail

## Epic 11: User Experience

### Story 11.1: Responsive Design
**As a user, I want responsive design that works on different screen sizes so I can use it on various devices**

**Acceptance Criteria:**
- Support desktop, tablet, and mobile screen sizes
- Maintain functionality across different viewports
- Adapt layout for touch interfaces
- Ensure readability on small screens
- Optimize performance for mobile devices

**Implementation Notes:**
- Tailwind CSS responsive design classes
- Mobile-first responsive approach
- Grid and flexbox layouts for adaptability

### Story 11.2: Intuitive Navigation
**As a user, I want intuitive navigation between different views so I can easily access different features**

**Acceptance Criteria:**
- Clear tab navigation between Benchmark, Comparison, and Simulator
- Consistent navigation patterns throughout application
- Logical information hierarchy
- Easy access to settings and configuration
- Breadcrumb navigation where appropriate

**Implementation Notes:**
- Tab-based navigation in Header component
- activeTab state management for view switching
- Consistent navigation patterns across components

### Story 11.3: Professional Styling
**As a user, I want consistent styling and branding so the application feels professional**

**Acceptance Criteria:**
- Consistent color scheme and typography
- Professional color palette with brand colors
- Clean, modern interface design
- Consistent spacing and layout patterns
- Professional iconography and imagery

**Implementation Notes:**
- Tailwind CSS for consistent styling
- Color palette with PCX purple (#8B5CF6) and accent colors
- Lucide React icons for consistent iconography

### Story 11.4: Efficient Workflows
**As a user, I want keyboard shortcuts and quick actions so I can work efficiently**

**Acceptance Criteria:**
- Keyboard shortcuts for common actions
- Quick spread adjustment buttons
- Preset scenario buttons for rapid testing
- Efficient data refresh controls
- Streamlined organization switching

**Implementation Notes:**
- Quick action buttons throughout UI
- Preset spread adjustment controls
- Efficient state management for rapid updates

---

## Technical Implementation Notes

### Key Components
- **RateEngine.jsx**: Main orchestrator component managing all rate comparison logic
- **BenchmarkTable.jsx**: Comprehensive rate comparison table with rankings
- **ComparisonChart.jsx**: Visual rate comparison using Recharts
- **InputSection.jsx**: User input interface for amounts, currencies, and organizations
- **Simulator.jsx**: Advanced spread simulation and what-if analysis
- **LiveProviderRates.jsx**: Real-time rate display from multiple sources

### API Endpoints
- `/api/exchange-rates/*`: PCX rate data and organization management
- `/api/scrape-rates`: External provider rate scraping
- `/api/crypto`: Cryptocurrency rate integration
- `/api/convert`: Currency conversion calculations
- `/api/auth/pcx-token`: Authentication token management

### State Management
- **Zustand** for authentication state (useAuthStore)
- **React hooks** for component state management
- **Local storage** persistence for user preferences
- **Real-time** state updates for dynamic calculations

### Data Sources
- **PCX API**: Organization-specific rates and configurations
- **Web Scraping**: External provider rates via Puppeteer
- **Crypto APIs**: Cryptocurrency rates from Coinbase
- **Real-time aggregation**: Multi-source data combination with deduplication

This comprehensive user story documentation provides detailed specifications for all identified features and functionality within the Rate Compare application.