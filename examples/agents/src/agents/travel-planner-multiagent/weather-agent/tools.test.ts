import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  geocodeLocation,
  getWeatherDescription,
  getWeatherForecast,
  isWeatherError,
  type WeatherForecast,
} from "./tools";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);
vi.spyOn(console, "error").mockImplementation(() => {});

const mockGeoResponse = (results: unknown[] | undefined) => ({
  ok: true,
  json: async () => ({ results }),
});

const mockWeatherResponse = (daily: Record<string, unknown>) => ({
  ok: true,
  json: async () => ({ timezone: "Europe/Paris", daily }),
});

describe("geocodeLocation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should geocode valid location", async () => {
    mockFetch.mockResolvedValueOnce(
      mockGeoResponse([{ name: "Paris", latitude: 48.85, longitude: 2.35, country: "France", admin1: "Île-de-France" }])
    );

    const result = await geocodeLocation("Paris");

    expect(result).toMatchObject({ name: "Paris", latitude: 48.85, country: "France" });
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("geocoding-api.open-meteo.com"));
  });

  it("should return null for not found, API errors, and network errors", async () => {
    // Not found
    mockFetch.mockResolvedValueOnce(mockGeoResponse([]));
    expect(await geocodeLocation("Nonexistent")).toBeNull();

    // API error
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
    expect(await geocodeLocation("Test")).toBeNull();

    // Network error
    mockFetch.mockRejectedValueOnce(new Error("Network"));
    expect(await geocodeLocation("Test")).toBeNull();

    // Invalid response
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ invalid: "data" }) });
    expect(await geocodeLocation("Test")).toBeNull();
  });
});

describe("getWeatherForecast", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should fetch forecast for valid location", async () => {
    mockFetch
      .mockResolvedValueOnce(mockGeoResponse([{ name: "Paris", latitude: 48.85, longitude: 2.35, country: "France", admin1: "IDF" }]))
      .mockResolvedValueOnce(mockWeatherResponse({
        time: ["2025-11-23", "2025-11-24"],
        temperature_2m_max: [60, 62],
        temperature_2m_min: [45, 47],
        precipitation_sum: [0.1, 0],
        weather_code: [1, 0],
      }));

    const result = await getWeatherForecast("Paris", 2);

    expect(isWeatherError(result)).toBe(false);
    if (!isWeatherError(result)) {
      expect(result.location).toBe("Paris, IDF");
      expect(result.dates).toHaveLength(2);
      expect(result.temperatureMax).toEqual([60, 62]);
    }
  });

  it("should return errors for various failure cases", async () => {
    // Location not found
    mockFetch.mockResolvedValueOnce(mockGeoResponse([]));
    let result = await getWeatherForecast("Invalid");
    expect(isWeatherError(result) && result.error).toContain("Location not found");

    // Weather API error
    mockFetch
      .mockResolvedValueOnce(mockGeoResponse([{ name: "London", latitude: 51.5, longitude: -0.1, country: "UK" }]))
      .mockResolvedValueOnce({ ok: false, status: 503 });
    result = await getWeatherForecast("London");
    expect(isWeatherError(result) && result.error).toContain("Weather API error: 503");

    // Invalid weather response
    mockFetch
      .mockResolvedValueOnce(mockGeoResponse([{ name: "Berlin", latitude: 52.5, longitude: 13.4, country: "Germany" }]))
      .mockResolvedValueOnce({ ok: true, json: async () => ({ invalid: "data" }) });
    result = await getWeatherForecast("Berlin");
    expect(isWeatherError(result) && result.error).toContain("Invalid weather API response");

    // Network error
    mockFetch
      .mockResolvedValueOnce(mockGeoResponse([{ name: "Rome", latitude: 41.9, longitude: 12.5, country: "Italy" }]))
      .mockRejectedValueOnce(new Error("Network timeout"));
    result = await getWeatherForecast("Rome");
    expect(isWeatherError(result) && result.error).toContain("Network timeout");
  });

  it("should default to 7 days and cap at 16 days", async () => {
    const setupMock = () => {
      mockFetch
        .mockResolvedValueOnce(mockGeoResponse([{ name: "Tokyo", latitude: 35.6, longitude: 139.6, country: "Japan" }]))
        .mockResolvedValueOnce(mockWeatherResponse({
          time: Array(16).fill("2025-11-23"),
          temperature_2m_max: Array(16).fill(70),
          temperature_2m_min: Array(16).fill(55),
          precipitation_sum: Array(16).fill(0),
          weather_code: Array(16).fill(0),
        }));
    };

    setupMock();
    await getWeatherForecast("Tokyo");
    expect(mockFetch).toHaveBeenLastCalledWith(expect.stringContaining("forecast_days=7"));

    vi.clearAllMocks();
    setupMock();
    await getWeatherForecast("Tokyo", 30);
    expect(mockFetch).toHaveBeenLastCalledWith(expect.stringContaining("forecast_days=16"));
  });
});

describe("getWeatherDescription", () => {
  it("should return correct descriptions for weather codes", () => {
    expect(getWeatherDescription(0)).toBe("Clear sky");
    expect(getWeatherDescription(2)).toBe("Partly cloudy");
    expect(getWeatherDescription(63)).toBe("Moderate rain");
    expect(getWeatherDescription(95)).toBe("Thunderstorm");
    expect(getWeatherDescription(999)).toBe("Unknown");
  });

  it("should handle all standard WMO codes", () => {
    const validCodes = [0, 1, 2, 3, 45, 48, 51, 53, 55, 61, 63, 65, 71, 73, 75, 77, 80, 81, 82, 85, 86, 95, 96, 99];
    for (const code of validCodes) {
      expect(getWeatherDescription(code)).not.toBe("Unknown");
    }
  });
});

describe("isWeatherError", () => {
  it("should correctly identify errors vs forecasts", () => {
    expect(isWeatherError({ error: "Location not found" })).toBe(true);

    const forecast: WeatherForecast = {
      location: "Test",
      latitude: 40,
      longitude: -74,
      timezone: "America/New_York",
      dates: ["2025-11-23"],
      temperatureMax: [70],
      temperatureMin: [50],
      precipitation: [0],
      weatherCode: [0],
    };
    expect(isWeatherError(forecast)).toBe(false);
  });
});
