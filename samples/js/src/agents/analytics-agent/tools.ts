/**
 * Analytics Agent Tools
 *
 * Chart generation using Chart.js and node-canvas.
 * These tools demonstrate:
 * - Server-side chart rendering
 * - Image generation (PNG)
 * - Data parsing and visualization
 * - Artifact creation
 */

import { ChartConfiguration } from "chart.js/auto";
import { createCanvas } from "canvas";
import { Chart, registerables } from "chart.js";

// Register Chart.js components
Chart.register(...registerables);

/**
 * Chart Data Structure
 */
export interface ChartData {
  labels: string[];
  values: number[];
}

/**
 * Generated Chart Result
 */
export interface ChartResult {
  id: string;
  name: string;
  mimeType: string;
  data: Buffer;
  base64: string;
}

/**
 * Parse CSV-like data from prompt
 *
 * Supports formats:
 * - "Jan,1000 Feb,2000 Mar,1500"
 * - "Jan:1000, Feb:2000, Mar:1500"
 * - "a:100, b:200, c:300"
 *
 * @param prompt - User prompt containing data
 * @returns Parsed chart data
 */
export function parseChartData(prompt: string): ChartData {
  const labels: string[] = [];
  const values: number[] = [];

  // Remove common prefixes
  let data = prompt
    .replace(/generate\s+a?\s*chart\s+(of|for|with)?\s*/gi, "")
    .replace(/revenue:?/gi, "")
    .replace(/sales:?/gi, "")
    .replace(/data:?/gi, "")
    .trim();

  // Try to parse as comma-separated key:value or key,value pairs
  const pairs = data.split(/\s+(?=[A-Za-z])/); // Split on space before letter

  for (const pair of pairs) {
    // Match patterns like "Jan:1000", "Jan,$1000", "Jan,1000"
    const match = pair.match(/([A-Za-z]+)[:,$]\$?([0-9,.]+)/);
    if (match) {
      labels.push(match[1]);
      // Remove commas and dollar signs from number
      const numStr = match[2].replace(/[,$]/g, "");
      values.push(parseFloat(numStr));
    }
  }

  // If no matches, try CSV format: "Category,Value\nJan,1000\nFeb,2000"
  if (labels.length === 0) {
    const lines = data.split("\n").filter((line) => line.trim());
    // Skip header line if present
    const startIdx = lines[0]?.toLowerCase().includes("category") ? 1 : 0;

    for (let i = startIdx; i < lines.length; i++) {
      const parts = lines[i].split(",").map((p) => p.trim());
      if (parts.length >= 2) {
        labels.push(parts[0]);
        values.push(parseFloat(parts[1].replace(/[$,]/g, "")));
      }
    }
  }

  return { labels, values };
}

/**
 * Generate a bar chart image from data
 *
 * @param data - Chart data (labels and values)
 * @param title - Chart title (optional)
 * @returns Generated chart as PNG buffer and base64
 */
export async function generateBarChart(
  data: ChartData,
  title: string = "Bar Chart"
): Promise<ChartResult> {
  // Create canvas
  const width = 800;
  const height = 600;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // Chart configuration
  const config: ChartConfiguration = {
    type: "bar",
    data: {
      labels: data.labels,
      datasets: [
        {
          label: "Value",
          data: data.values,
          backgroundColor: "rgba(54, 162, 235, 0.6)",
          borderColor: "rgba(54, 162, 235, 1)",
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: false,
      animation: false,
      plugins: {
        title: {
          display: true,
          text: title,
          font: {
            size: 20,
          },
        },
        legend: {
          display: false,
        },
      },
      scales: {
        y: {
          beginAtZero: true,
        },
      },
    },
  };

  // Render chart
  new Chart(ctx as any, config);

  // Convert to PNG buffer
  const buffer = canvas.toBuffer("image/png");
  const base64 = buffer.toString("base64");

  // Generate unique ID
  const id = `chart-${Date.now()}-${Math.random().toString(36).substring(7)}`;

  return {
    id,
    name: "generated_chart.png",
    mimeType: "image/png",
    data: buffer,
    base64,
  };
}

/**
 * Generate chart from natural language prompt
 *
 * Main function that combines parsing and rendering.
 *
 * @param prompt - User prompt containing chart data
 * @returns Generated chart result
 */
export async function generateChartFromPrompt(
  prompt: string
): Promise<ChartResult> {
  // Parse data from prompt
  const data = parseChartData(prompt);

  if (data.labels.length === 0 || data.values.length === 0) {
    throw new Error(
      "Could not parse chart data from prompt. Expected format: 'Label:Value Label:Value' or CSV format."
    );
  }

  // Extract title from prompt
  let title = "Bar Chart";
  const titleMatch = prompt.match(
    /chart\s+(?:of|for)\s+([A-Za-z\s]+?)[:,$]/i
  );
  if (titleMatch) {
    title = titleMatch[1].trim();
  }

  // Generate chart
  return await generateBarChart(data, title);
}

