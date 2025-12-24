// Geography detection utility
// Detects user's location based on IP and determines pricing tier
// Western developed countries pay $5, all others pay $3

/**
 * List of country codes for Western/Developed countries that pay full price ($5)
 * All other countries get developing country pricing ($3)
 */
const WESTERN_COUNTRIES = [
  'US', // United States
  'CA', // Canada
  'GB', // United Kingdom
  'AU', // Australia
  'NZ', // New Zealand
  'DE', // Germany
  'FR', // France
  'IT', // Italy
  'ES', // Spain
  'NL', // Netherlands
  'BE', // Belgium
  'CH', // Switzerland
  'AT', // Austria
  'SE', // Sweden
  'NO', // Norway
  'DK', // Denmark
  'FI', // Finland
  'IE', // Ireland
  'LU', // Luxembourg
  'IS', // Iceland
  'JP', // Japan
  'KR', // South Korea
  'SG', // Singapore
  'HK', // Hong Kong
  'AE', // United Arab Emirates
  'IL', // Israel
];

/**
 * Detect user's country code using IP-based geolocation
 * Returns country code (e.g., 'US', 'IN', 'GB')
 */
export async function detectCountry(): Promise<string | null> {
  try {
    // Use ip-api.com for free IP geolocation
    const response = await fetch('http://ip-api.com/json/', {
      cache: 'no-store',
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.countryCode || null;
  } catch (error) {
    console.error('Failed to detect country:', error);
    return null;
  }
}

/**
 * Check if user is from a Western/Developed country
 * Returns true if user should pay $5, false if user should pay $3
 */
export function isWesternCountry(countryCode: string | null): boolean {
  if (!countryCode) {
    return true; // Default to Western pricing if detection fails
  }
  return WESTERN_COUNTRIES.includes(countryCode.toUpperCase());
}

/**
 * Get pricing information based on geography
 * Returns object with prices for all tiers
 */
export function getPricing(countryCode: string | null) {
  const isWestern = isWesternCountry(countryCode);

  return {
    tier5: isWestern ? 5 : 3,
    tier10: 10,
    tier15: 15,
    currency: 'USD',
    region: isWestern ? 'western' : 'developing',
    countryCode,
  };
}

