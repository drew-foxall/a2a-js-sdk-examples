/**
 * Weather Agent Tools
 *
 * Weather forecast using Open-Meteo API (free, no API key required).
 */

/**
 * Geocoding result for location lookup
 */
export interface GeocodeResult {
  name: string;
  latitude: number;
  longitude: number;
  country: string;
  admin1?: string; // State/Province
}

/**
 * Weather forecast data
 */
export interface WeatherForecast {
  location: string;
  latitude: number;
  longitude: number;
  timezone: string;
  dates: string[];
  temperatureMax: number[];
  temperatureMin: number[];
  precipitation: number[];
  weatherCode: number[];
}

/**
 * Geocode a location to get latitude/longitude
 *
 * Uses Open-Meteo Geocoding API
 */
export async function geocodeLocation(
  location: string
): Promise<GeocodeResult | null> {
  try {
    const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
    url.searchParams.set("name", location);
    url.searchParams.set("count", "1");
    url.searchParams.set("language", "en");
    url.searchParams.set("format", "json");

    const response = await fetch(url.toString());
    if (!response.ok) {
      console.error(`Geocoding API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    if (!data.results || data.results.length === 0) {
      return null;
    }

    const result = data.results[0];
    return {
      name: result.name,
      latitude: result.latitude,
      longitude: result.longitude,
      country: result.country,
      admin1: result.admin1,
    };
  } catch (error) {
    console.error("Geocoding error:", error);
    return null;
  }
}

/**
 * Get weather forecast for a location
 *
 * Uses Open-Meteo Weather API
 */
export async function getWeatherForecast(
  location: string,
  days: number = 7
): Promise<WeatherForecast | { error: string }> {
  try {
    // First, geocode the location
    const geocode = await geocodeLocation(location);
    if (!geocode) {
      return { error: `Location not found: ${location}` };
    }

    // Get weather forecast
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", geocode.latitude.toString());
    url.searchParams.set("longitude", geocode.longitude.toString());
    url.searchParams.set("daily", "temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code");
    url.searchParams.set("forecast_days", Math.min(days, 16).toString());
    url.searchParams.set("timezone", "auto");
    url.searchParams.set("temperature_unit", "fahrenheit");

    const response = await fetch(url.toString());
    if (!response.ok) {
      return { error: `Weather API error: ${response.status}` };
    }

    const data = await response.json();

    return {
      location: `${geocode.name}, ${geocode.admin1 || geocode.country}`,
      latitude: geocode.latitude,
      longitude: geocode.longitude,
      timezone: data.timezone,
      dates: data.daily.time,
      temperatureMax: data.daily.temperature_2m_max,
      temperatureMin: data.daily.temperature_2m_min,
      precipitation: data.daily.precipitation_sum,
      weatherCode: data.daily.weather_code,
    };
  } catch (error) {
    if (error instanceof Error) {
      return { error: `Weather fetch error: ${error.message}` };
    }
    return { error: "Unknown weather fetch error" };
  }
}

/**
 * Convert WMO weather code to description
 */
export function getWeatherDescription(code: number): string {
  const weatherCodes: Record<number, string> = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Foggy",
    48: "Depositing rime fog",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Dense drizzle",
    61: "Slight rain",
    63: "Moderate rain",
    65: "Heavy rain",
    71: "Slight snow",
    73: "Moderate snow",
    75: "Heavy snow",
    77: "Snow grains",
    80: "Slight rain showers",
    81: "Moderate rain showers",
    82: "Violent rain showers",
    85: "Slight snow showers",
    86: "Heavy snow showers",
    95: "Thunderstorm",
    96: "Thunderstorm with slight hail",
    99: "Thunderstorm with heavy hail",
  };

  return weatherCodes[code] || "Unknown";
}

/**
 * Check if response is an error
 */
export function isWeatherError(
  response: WeatherForecast | { error: string }
): response is { error: string } {
  return "error" in response;
}

