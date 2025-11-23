/**
 * Analytics Agent Tools Tests
 *
 * Tests the chart generation and data parsing utility functions.
 * These are pure functions that don't require LLM calls.
 */

import { describe, expect, it } from "vitest";
import type { ChartData, ChartResult } from "./tools";
import { generateBarChart, generateChartFromPrompt, parseChartData } from "./tools";

describe("Analytics Tools", () => {
  describe("parseChartData", () => {
    it("should parse colon-separated data", () => {
      const prompt = "Jan:1000 Feb:2000 Mar:1500";
      const result = parseChartData(prompt);

      expect(result.labels).toEqual(["Jan", "Feb", "Mar"]);
      expect(result.values).toEqual([1000, 2000, 1500]);
    });

    it("should parse simple key-value format", () => {
      const prompt = "A:100 B:200 C:300";
      const result = parseChartData(prompt);

      expect(result.labels).toEqual(["A", "B", "C"]);
      expect(result.values).toEqual([100, 200, 300]);
    });

    it("should parse data with dollar signs", () => {
      const prompt = "Jan,$1000 Feb,$2000 Mar,$1500";
      const result = parseChartData(prompt);

      expect(result.labels).toEqual(["Jan", "Feb", "Mar"]);
      expect(result.values).toEqual([1000, 2000, 1500]);
    });

    it("should parse CSV format with newlines", () => {
      const prompt = "Category,Value\nJan,1000\nFeb,2000\nMar,1500";
      const result = parseChartData(prompt);

      expect(result.labels).toEqual(["Jan", "Feb", "Mar"]);
      expect(result.values).toEqual([1000, 2000, 1500]);
    });

    it("should ignore common prefixes", () => {
      const prompt = "Generate a chart of revenue Jan:1000 Feb:2000";
      const result = parseChartData(prompt);

      expect(result.labels).toEqual(["Jan", "Feb"]);
      expect(result.values).toEqual([1000, 2000]);
    });

    it("should return empty arrays for unparseable data", () => {
      const prompt = "This is not valid chart data at all";
      const result = parseChartData(prompt);

      expect(result.labels).toEqual([]);
      expect(result.values).toEqual([]);
    });
  });

  describe("generateBarChart", () => {
    it("should generate a PNG chart with data", async () => {
      const data: ChartData = {
        labels: ["Q1", "Q2", "Q3"],
        values: [100, 150, 200],
      };

      const result: ChartResult = await generateBarChart(data, "Quarterly Sales");

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.name).toBe("generated_chart.png");
      expect(result.mimeType).toBe("image/png");
      expect(result.data).toBeInstanceOf(Buffer);
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.base64).toBeDefined();
      expect(result.base64.length).toBeGreaterThan(0);
    });

    it("should generate chart with default title", async () => {
      const data: ChartData = {
        labels: ["A", "B", "C"],
        values: [10, 20, 30],
      };

      const result = await generateBarChart(data);

      expect(result).toBeDefined();
      expect(result.name).toBe("generated_chart.png");
    });

    it("should handle single data point", async () => {
      const data: ChartData = {
        labels: ["Single"],
        values: [100],
      };

      const result = await generateBarChart(data, "Single Point");

      expect(result).toBeDefined();
      expect(result.data.length).toBeGreaterThan(0);
    });

    it("should handle multiple data points", async () => {
      const data: ChartData = {
        labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        values: [10, 20, 15, 25, 30, 35, 40],
      };

      const result = await generateBarChart(data, "Weekly Data");

      expect(result).toBeDefined();
      expect(result.data.length).toBeGreaterThan(0);
    });

    it("should handle zero values", async () => {
      const data: ChartData = {
        labels: ["A", "B", "C"],
        values: [0, 10, 0],
      };

      const result = await generateBarChart(data, "With Zeros");

      expect(result).toBeDefined();
      expect(result.data.length).toBeGreaterThan(0);
    });

    it("should handle negative values", async () => {
      const data: ChartData = {
        labels: ["Loss", "Profit", "Neutral"],
        values: [-50, 100, 0],
      };

      const result = await generateBarChart(data, "Financial Data");

      expect(result).toBeDefined();
      expect(result.data.length).toBeGreaterThan(0);
    });
  });

  describe("generateChartFromPrompt", () => {
    it("should generate chart from natural language prompt", async () => {
      const prompt = "Generate a chart of revenue: Jan:1000 Feb:2000 Mar:1500";
      const result = await generateChartFromPrompt(prompt);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.name).toBe("generated_chart.png");
      expect(result.mimeType).toBe("image/png");
      expect(result.base64).toBeDefined();
      expect(result.data.length).toBeGreaterThan(0);
    });

    it("should generate chart without title extraction", async () => {
      const prompt = "A:10 B:20 C:30 D:40";
      const result = await generateChartFromPrompt(prompt);

      expect(result).toBeDefined();
      expect(result.data.length).toBeGreaterThan(0);
    });

    it("should handle simple data format", async () => {
      const prompt = "A:10 B:20 C:30";
      const result = await generateChartFromPrompt(prompt);

      expect(result).toBeDefined();
      expect(result.base64).toBeDefined();
    });

    it("should throw error for unparseable data", async () => {
      const prompt = "This has no chart data whatsoever";

      await expect(generateChartFromPrompt(prompt)).rejects.toThrow("Could not parse chart data");
    });

    it("should throw error for empty labels", async () => {
      const prompt = "";

      await expect(generateChartFromPrompt(prompt)).rejects.toThrow("Could not parse chart data");
    });

    it("should handle complex data with formatting", async () => {
      const prompt = "Generate a chart for sales: Jan,$1,000 Feb,$2,500 Mar,$1,800";
      const result = await generateChartFromPrompt(prompt);

      expect(result).toBeDefined();
      expect(result.data.length).toBeGreaterThan(0);
    });
  });

  describe("Chart Image Validation", () => {
    it("should generate valid PNG header", async () => {
      const data: ChartData = {
        labels: ["Test"],
        values: [100],
      };

      const result = await generateBarChart(data);

      // PNG files start with these bytes: 89 50 4E 47 (PNG signature)
      const header = result.data.slice(0, 4);
      expect(header[0]).toBe(0x89);
      expect(header[1]).toBe(0x50);
      expect(header[2]).toBe(0x4e);
      expect(header[3]).toBe(0x47);
    });

    it("should generate valid base64 string", async () => {
      const data: ChartData = {
        labels: ["Test"],
        values: [100],
      };

      const result = await generateBarChart(data);

      // Base64 should be valid
      expect(result.base64).toMatch(/^[A-Za-z0-9+/]+=*$/);

      // Should be able to convert back to buffer
      const buffer = Buffer.from(result.base64, "base64");
      expect(buffer.length).toBe(result.data.length);
    });

    it("should generate reasonable file size", async () => {
      const data: ChartData = {
        labels: ["A", "B", "C"],
        values: [10, 20, 30],
      };

      const result = await generateBarChart(data);

      // PNG should be between 5KB and 500KB for a simple chart
      expect(result.data.length).toBeGreaterThan(5000);
      expect(result.data.length).toBeLessThan(500000);
    });
  });
});
