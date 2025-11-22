import { describe, expect, it, vi, beforeEach } from "vitest";
import {
	geocodeLocation,
	getWeatherForecast,
	getWeatherDescription,
	isWeatherError,
	type GeocodeResult,
	type WeatherForecast,
} from "./tools";

// Mock the global fetch function
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Mock console.error to prevent test output pollution
const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

describe("Weather Agent - Tools", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockFetch.mockClear();
		consoleErrorSpy.mockClear();
	});

	describe("geocodeLocation", () => {
		it("should geocode a valid location", async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					results: [
						{
							name: "San Francisco",
							latitude: 37.7749,
							longitude: -122.4194,
							country: "United States",
							admin1: "California",
						},
					],
				}),
			} as Response);

			const result = await geocodeLocation("San Francisco");

			expect(result).not.toBeNull();
			expect(result?.name).toBe("San Francisco");
			expect(result?.latitude).toBe(37.7749);
			expect(result?.longitude).toBe(-122.4194);
			expect(result?.country).toBe("United States");
			expect(result?.admin1).toBe("California");

			expect(mockFetch).toHaveBeenCalledWith(
				expect.stringContaining("https://geocoding-api.open-meteo.com/v1/search"),
			);
		});

		it("should return null for location not found", async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ results: [] }),
			} as Response);

			const result = await geocodeLocation("NonexistentCity12345");

			expect(result).toBeNull();
		});

		it("should handle geocoding API errors", async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 500,
			} as Response);

			const result = await geocodeLocation("Test City");

			expect(result).toBeNull();
			expect(consoleErrorSpy).toHaveBeenCalledWith("Geocoding API error: 500");
		});

		it("should handle network errors", async () => {
			mockFetch.mockRejectedValueOnce(new Error("Network error"));

			const result = await geocodeLocation("Test City");

			expect(result).toBeNull();
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				"Geocoding error:",
				expect.any(Error),
			);
		});

		it("should handle invalid API response format", async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ invalid: "data" }),
			} as Response);

			const result = await geocodeLocation("Test City");

			expect(result).toBeNull();
		});

		it("should handle empty results array", async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ results: [] }),
			} as Response);

			const result = await geocodeLocation("Test City");

			expect(result).toBeNull();
		});

		it("should handle location without admin1 field", async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					results: [
						{
							name: "Tokyo",
							latitude: 35.6762,
							longitude: 139.6503,
							country: "Japan",
						},
					],
				}),
			} as Response);

			const result = await geocodeLocation("Tokyo");

			expect(result).not.toBeNull();
			expect(result?.name).toBe("Tokyo");
			expect(result?.admin1).toBeUndefined();
		});
	});

	describe("getWeatherForecast", () => {
		it("should fetch weather forecast for a valid location", async () => {
			// Mock geocoding
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					results: [
						{
							name: "Paris",
							latitude: 48.8566,
							longitude: 2.3522,
							country: "France",
							admin1: "Île-de-France",
						},
					],
				}),
			} as Response);

			// Mock weather API
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					timezone: "Europe/Paris",
					daily: {
						time: ["2025-11-23", "2025-11-24"],
						temperature_2m_max: [60, 62],
						temperature_2m_min: [45, 47],
						precipitation_sum: [0.1, 0.0],
						weather_code: [1, 0],
					},
				}),
			} as Response);

			const result = await getWeatherForecast("Paris", 2);

			expect(isWeatherError(result)).toBe(false);
			if (!isWeatherError(result)) {
				expect(result.location).toBe("Paris, Île-de-France");
				expect(result.timezone).toBe("Europe/Paris");
				expect(result.dates).toHaveLength(2);
				expect(result.temperatureMax).toEqual([60, 62]);
				expect(result.temperatureMin).toEqual([45, 47]);
			}
		});

		it("should return error for location not found", async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ results: [] }),
			} as Response);

			const result = await getWeatherForecast("InvalidLocation12345");

			expect(isWeatherError(result)).toBe(true);
			if (isWeatherError(result)) {
				expect(result.error).toContain("Location not found");
			}
		});

		it("should handle weather API errors", async () => {
			// Mock successful geocoding
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					results: [
						{
							name: "London",
							latitude: 51.5074,
							longitude: -0.1278,
							country: "United Kingdom",
						},
					],
				}),
			} as Response);

			// Mock failed weather API
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 503,
			} as Response);

			const result = await getWeatherForecast("London");

			expect(isWeatherError(result)).toBe(true);
			if (isWeatherError(result)) {
				expect(result.error).toContain("Weather API error: 503");
			}
		});

		it("should handle invalid weather API response", async () => {
			// Mock successful geocoding
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					results: [
						{
							name: "Berlin",
							latitude: 52.52,
							longitude: 13.405,
							country: "Germany",
						},
					],
				}),
			} as Response);

			// Mock invalid weather API response
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ invalid: "data" }),
			} as Response);

			const result = await getWeatherForecast("Berlin");

			expect(isWeatherError(result)).toBe(true);
			if (isWeatherError(result)) {
				expect(result.error).toContain("Invalid weather API response");
			}
		});

		it("should handle network errors during weather fetch", async () => {
			// Mock successful geocoding
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					results: [
						{
							name: "Rome",
							latitude: 41.9028,
							longitude: 12.4964,
							country: "Italy",
						},
					],
				}),
			} as Response);

			// Mock network error
			mockFetch.mockRejectedValueOnce(new Error("Network timeout"));

			const result = await getWeatherForecast("Rome");

			expect(isWeatherError(result)).toBe(true);
			if (isWeatherError(result)) {
				expect(result.error).toContain("Weather fetch error: Network timeout");
			}
		});

		it("should default to 7 days if days parameter not provided", async () => {
			// Mock geocoding
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					results: [
						{
							name: "Madrid",
							latitude: 40.4168,
							longitude: -3.7038,
							country: "Spain",
						},
					],
				}),
			} as Response);

			// Mock weather API
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					timezone: "Europe/Madrid",
					daily: {
						time: ["2025-11-23", "2025-11-24", "2025-11-25", "2025-11-26", "2025-11-27", "2025-11-28", "2025-11-29"],
						temperature_2m_max: [65, 67, 66, 68, 70, 72, 71],
						temperature_2m_min: [50, 52, 51, 53, 55, 57, 56],
						precipitation_sum: [0, 0, 0.1, 0, 0, 0, 0.2],
						weather_code: [0, 1, 2, 1, 0, 0, 3],
					},
				}),
			} as Response);

			const result = await getWeatherForecast("Madrid");

			expect(isWeatherError(result)).toBe(false);
			if (!isWeatherError(result)) {
				expect(result.dates).toHaveLength(7);
			}

			expect(mockFetch).toHaveBeenCalledWith(
				expect.stringContaining("forecast_days=7"),
			);
		});

		it("should limit forecast days to 16 maximum", async () => {
			// Mock geocoding
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					results: [
						{
							name: "Tokyo",
							latitude: 35.6762,
							longitude: 139.6503,
							country: "Japan",
						},
					],
				}),
			} as Response);

			// Mock weather API
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					timezone: "Asia/Tokyo",
					daily: {
						time: Array.from({ length: 16 }, (_, i) => `2025-11-${23 + i}`),
						temperature_2m_max: Array(16).fill(70),
						temperature_2m_min: Array(16).fill(55),
						precipitation_sum: Array(16).fill(0),
						weather_code: Array(16).fill(0),
					},
				}),
			} as Response);

			await getWeatherForecast("Tokyo", 30);

			expect(mockFetch).toHaveBeenCalledWith(
				expect.stringContaining("forecast_days=16"),
			);
		});

		it("should use location without admin1 if not available", async () => {
			// Mock geocoding without admin1
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					results: [
						{
							name: "Singapore",
							latitude: 1.3521,
							longitude: 103.8198,
							country: "Singapore",
						},
					],
				}),
			} as Response);

			// Mock weather API
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					timezone: "Asia/Singapore",
					daily: {
						time: ["2025-11-23"],
						temperature_2m_max: [88],
						temperature_2m_min: [77],
						precipitation_sum: [0.5],
						weather_code: [2],
					},
				}),
			} as Response);

			const result = await getWeatherForecast("Singapore", 1);

			expect(isWeatherError(result)).toBe(false);
			if (!isWeatherError(result)) {
				expect(result.location).toBe("Singapore, Singapore");
			}
		});
	});

	describe("getWeatherDescription", () => {
		it("should return correct description for clear sky", () => {
			expect(getWeatherDescription(0)).toBe("Clear sky");
		});

		it("should return correct description for partly cloudy", () => {
			expect(getWeatherDescription(2)).toBe("Partly cloudy");
		});

		it("should return correct description for moderate rain", () => {
			expect(getWeatherDescription(63)).toBe("Moderate rain");
		});

		it("should return correct description for thunderstorm", () => {
			expect(getWeatherDescription(95)).toBe("Thunderstorm");
		});

		it("should return 'Unknown' for invalid weather code", () => {
			expect(getWeatherDescription(999)).toBe("Unknown");
			expect(getWeatherDescription(-1)).toBe("Unknown");
		});

		it("should handle all standard WMO weather codes", () => {
			const validCodes = [0, 1, 2, 3, 45, 48, 51, 53, 55, 61, 63, 65, 71, 73, 75, 77, 80, 81, 82, 85, 86, 95, 96, 99];

			for (const code of validCodes) {
				const description = getWeatherDescription(code);
				expect(description).not.toBe("Unknown");
				expect(typeof description).toBe("string");
				expect(description.length).toBeGreaterThan(0);
			}
		});
	});

	describe("isWeatherError", () => {
		it("should return true for error response", () => {
			const errorResponse = { error: "Location not found" };
			expect(isWeatherError(errorResponse)).toBe(true);
		});

		it("should return false for valid weather forecast", () => {
			const forecast: WeatherForecast = {
				location: "Test City",
				latitude: 40.0,
				longitude: -74.0,
				timezone: "America/New_York",
				dates: ["2025-11-23"],
				temperatureMax: [70],
				temperatureMin: [50],
				precipitation: [0],
				weatherCode: [0],
			};
			expect(isWeatherError(forecast)).toBe(false);
		});

		it("should work as a type guard", () => {
			const response: WeatherForecast | { error: string } = {
				error: "API error",
			};

			if (isWeatherError(response)) {
				expect(response.error).toBe("API error");
			} else {
				// This branch should not execute
				expect(false).toBe(true);
			}
		});
	});
});

