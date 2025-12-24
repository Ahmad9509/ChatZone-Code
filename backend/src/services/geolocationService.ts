// Geolocation service - Get user's location and timezone from IP
// Self-hosted using geoip-lite (no external API calls)
import geoip from 'geoip-lite';

/**
 * Get user's country from IP address
 * Returns country code (e.g., 'US', 'IN', 'GB')
 */
export function getCountryFromIP(ipAddress: string): string {
  try {
    // Handle localhost/internal IPs (for development)
    if (!ipAddress || ipAddress === '::1' || ipAddress.startsWith('127.') || ipAddress.startsWith('192.168.') || ipAddress.startsWith('10.')) {
      console.log('🏠 Localhost detected, defaulting to US');
      return 'US';
    }

    // Look up IP in local database
    const geo = geoip.lookup(ipAddress);

    if (geo && geo.country) {
      console.log(`🌍 IP ${ipAddress} → Country: ${geo.country}`);
      return geo.country;
    }

    // If IP not found in database, default to US
    console.warn(`⚠️  IP ${ipAddress} not found in database, defaulting to US`);
    return 'US';
  } catch (error) {
    console.error(`❌ Geolocation lookup failed for ${ipAddress}:`, error);
    return 'US';
  }
}

/**
 * Get user's timezone from IP address
 * Returns timezone string (e.g., 'America/New_York', 'Asia/Kolkata')
 */
export function getTimezoneFromIP(ipAddress: string): string {
  try {
    // Handle localhost
    if (!ipAddress || ipAddress === '::1' || ipAddress.startsWith('127.') || ipAddress.startsWith('192.168.') || ipAddress.startsWith('10.')) {
      return 'UTC';
    }

    const geo = geoip.lookup(ipAddress);

    if (geo && geo.timezone) {
      console.log(`🕐 IP ${ipAddress} → Timezone: ${geo.timezone}`);
      return geo.timezone;
    }

    return 'UTC';
  } catch (error) {
    console.error(`❌ Timezone lookup failed for ${ipAddress}:`, error);
    return 'UTC';
  }
}

/**
 * Get full geolocation data from IP
 * Returns all available information
 */
export function getFullGeolocationFromIP(ipAddress: string) {
  try {
    const geo = geoip.lookup(ipAddress);
    
    if (geo) {
      return {
        country: geo.country,
        region: geo.region,
        timezone: geo.timezone,
        city: geo.city || 'Unknown',
        coordinates: geo.ll, // [latitude, longitude]
      };
    }

    return null;
  } catch (error) {
    console.error(`❌ Full geolocation lookup failed:`, error);
    return null;
  }
}

/**
 * Get formatted current date/time for user's timezone
 * Returns human-readable string for AI context
 */
export function getFormattedDateForTimezone(timezone: string): string {
  try {
    const date = new Date();
    
    // Format: "Friday, October 31, 2025, 9:16 PM EDT"
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short'
    });

    return formatter.format(date);
  } catch (error) {
    // Fallback to UTC if timezone invalid
    const date = new Date();
    return date.toUTCString();
  }
}

/**
 * Get ISO date for search queries (e.g., "2025-10-31")
 */
export function getISODateForTimezone(timezone: string): { 
  year: string; 
  month: string; 
  monthName: string; 
  day: string;
  full: string;
} {
  try {
    const date = new Date();
    
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });

    const monthNameFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      month: 'long'
    });

    const parts = formatter.formatToParts(date);
    const year = parts.find(p => p.type === 'year')?.value || '';
    const month = parts.find(p => p.type === 'month')?.value || '';
    const day = parts.find(p => p.type === 'day')?.value || '';
    const monthName = monthNameFormatter.format(date);

    return {
      year,
      month,
      monthName,
      day,
      full: `${year}-${month}-${day}`
    };
  } catch (error) {
    const date = new Date();
    return {
      year: date.getUTCFullYear().toString(),
      month: (date.getUTCMonth() + 1).toString().padStart(2, '0'),
      monthName: date.toLocaleDateString('en-US', { month: 'long' }),
      day: date.getDate().toString().padStart(2, '0'),
      full: date.toISOString().split('T')[0]
    };
  }
}

/**
 * Get date from N months ago in user's timezone
 * Used for determining "recent" threshold in AI prompts
 */
export function getMonthsAgo(months: number, timezone: string): string {
  try {
    const date = new Date();
    date.setMonth(date.getMonth() - months);
    
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: 'long'
    });

    return formatter.format(date);
  } catch (error) {
    const date = new Date();
    date.setMonth(date.getMonth() - months);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  }
}

