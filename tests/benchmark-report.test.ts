import { describe, expect, it } from "vitest";
import { createMetricResult, percentile } from "../benchmarks/report";

describe("UT-BENCHMARK-REPORT-001 benchmark report aggregation", () => {
  it("uses nearest-rank p50/p95 without mutating the source samples", () => {
    const samples = [40, 10, 30, 20];

    expect(percentile(samples, 50)).toBe(20);
    expect(percentile(samples, 95)).toBe(40);
    expect(samples).toEqual([40, 10, 30, 20]);
  });

  it("warns for noisy timing overruns but always fails structural overruns", () => {
    const timing = createMetricResult(
      { id: "timing", label: "Timing", unit: "ms", kind: "timing", budget: 100 },
      [120],
      false
    );
    const enforcedTiming = createMetricResult(
      { id: "timing", label: "Timing", unit: "ms", kind: "timing", budget: 100 },
      [120],
      true
    );
    const structural = createMetricResult(
      { id: "count", label: "Count", unit: "count", kind: "structural", budget: 10 },
      [11],
      false
    );

    expect(timing.status).toBe("warn");
    expect(enforcedTiming.status).toBe("fail");
    expect(structural.status).toBe("fail");
  });
});
