import { describe, expect, it } from "vitest";
import type { ChartData } from "./tools";
import { generateBarChart, generateChartFromPrompt, parseChartData } from "./tools";

describe("parseChartData", () => {
  it("should parse various data formats", () => {
    expect(parseChartData("Jan:1000 Feb:2000 Mar:1500")).toEqual({
      labels: ["Jan", "Feb", "Mar"],
      values: [1000, 2000, 1500],
    });

    expect(parseChartData("Jan,$1000 Feb,$2000")).toEqual({
      labels: ["Jan", "Feb"],
      values: [1000, 2000],
    });

    expect(parseChartData("Category,Value\nJan,1000\nFeb,2000")).toEqual({
      labels: ["Jan", "Feb"],
      values: [1000, 2000],
    });
  });

  it("should handle edge cases", () => {
    expect(parseChartData("Generate a chart of revenue Jan:1000 Feb:2000").labels).toEqual(["Jan", "Feb"]);
    expect(parseChartData("Not valid data")).toEqual({ labels: [], values: [] });
  });
});

describe("generateBarChart", () => {
  const testData: ChartData = { labels: ["Q1", "Q2", "Q3"], values: [100, 150, 200] };

  it("should generate valid PNG chart", async () => {
    const result = await generateBarChart(testData, "Test Chart");

    expect(result.name).toBe("generated_chart.png");
    expect(result.mimeType).toBe("image/png");
    expect(result.data).toBeInstanceOf(Buffer);
    expect(result.base64).toMatch(/^[A-Za-z0-9+/]+=*$/);

    // PNG signature
    expect(result.data.slice(0, 4)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  });

  it("should handle various data scenarios", async () => {
    const scenarios: ChartData[] = [
      { labels: ["Single"], values: [100] },
      { labels: ["A", "B", "C"], values: [0, 10, 0] },
      { labels: ["Loss", "Profit"], values: [-50, 100] },
    ];

    for (const data of scenarios) {
      const result = await generateBarChart(data);
      expect(result.data.length).toBeGreaterThan(0);
    }
  });
});

describe("generateChartFromPrompt", () => {
  it("should generate chart from natural language", async () => {
    const result = await generateChartFromPrompt("Revenue: Jan:1000 Feb:2000 Mar:1500");

    expect(result.name).toBe("generated_chart.png");
    expect(result.mimeType).toBe("image/png");
    expect(result.data.length).toBeGreaterThan(5000);
  });

  it("should throw for unparseable data", async () => {
    await expect(generateChartFromPrompt("No chart data")).rejects.toThrow("Could not parse chart data");
    await expect(generateChartFromPrompt("")).rejects.toThrow("Could not parse chart data");
  });
});
