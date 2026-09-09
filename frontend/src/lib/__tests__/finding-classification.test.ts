import { describe, expect, it } from "vitest";

import { classifyFinding } from "../finding-classification";

describe("classifyFinding", () => {
  it.each(["trend", "comparison", "ranking", "composition", "change", "seasonality", "anomaly"])(
    "classifies %s as insight",
    (category) => {
      expect(classifyFinding(category)).toBe("insight");
    }
  );

  it.each(["relationship", "distribution", "derived_metric", "other", "unknown_future_category"])(
    "classifies %s as exploration",
    (category) => {
      expect(classifyFinding(category)).toBe("exploration");
    }
  );
});
