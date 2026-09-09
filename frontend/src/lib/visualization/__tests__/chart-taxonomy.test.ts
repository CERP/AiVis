import { describe, expect, it } from "vitest";

import { categoriesWithCounts, chartsInCategory, compatibilityDescription } from "../chart-taxonomy";
import { CHART_REGISTRY, getChartDefinition } from "../registry";

describe("categoriesWithCounts", () => {
  it("derives categories from the actual registry, not an invented taxonomy", () => {
    const categories = categoriesWithCounts();
    const registryCategories = new Set(CHART_REGISTRY.map((d) => d.category));
    for (const { category } of categories) {
      expect(registryCategories.has(category)).toBe(true);
    }
  });

  it("counts sum to the full registry size", () => {
    const categories = categoriesWithCounts();
    const total = categories.reduce((sum, c) => sum + c.count, 0);
    expect(total).toBe(CHART_REGISTRY.length);
  });
});

describe("chartsInCategory", () => {
  it("returns only charts in the requested category", () => {
    const comparisonCharts = chartsInCategory("comparison");
    expect(comparisonCharts.length).toBeGreaterThan(0);
    for (const def of comparisonCharts) expect(def.category).toBe("comparison");
  });
});

describe("compatibilityDescription", () => {
  it("names OHLC channels explicitly for candlestick", () => {
    const def = getChartDefinition("candlestick")!;
    const text = compatibilityDescription(def);
    expect(text).toMatch(/Open/);
    expect(text).toMatch(/High/);
    expect(text).toMatch(/Low/);
    expect(text).toMatch(/Close/);
  });

  it("describes field-count requirements for a standard chart", () => {
    const def = getChartDefinition("bar")!;
    const text = compatibilityDescription(def);
    expect(text).toMatch(/Needs: 2 fields/);
  });
});
