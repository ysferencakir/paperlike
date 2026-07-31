import assert from "node:assert/strict";
import test from "node:test";
import { convertAndroidBenchmark } from "./android-benchmark-report.mjs";

test("normalizes AndroidX metrics into the shared benchmark schema", () => {
  const report = convertAndroidBenchmark(
    {
      context: {
        build: {
          brand: "google",
          model: "Pixel Test",
          fingerprint: "paperlike/test",
          version: { sdk: 35 },
        },
        cpuCoreCount: 8,
        memTotalBytes: 8_000_000_000,
      },
      benchmarks: [
        {
          name: "coldStartup",
          repeatIterations: 3,
          metrics: {
            timeToInitialDisplayMs: { runs: [800, 900, 1_000] },
          },
          sampledMetrics: {},
        },
        {
          name: "mediumPdfReaderFramesAndMemory",
          repeatIterations: 3,
          metrics: {
            memoryRssAnonMaxKb: { runs: [100_000, 110_000, 120_000] },
          },
          sampledMetrics: {
            frameOverrunMs: { runs: [[-2, 4], [8]] },
          },
        },
      ],
    },
    { generatedAt: "2026-07-31T00:00:00.000Z", timingsEnforced: false }
  );

  assert.equal(report.schemaVersion, 1);
  assert.equal(report.platform, "android");
  assert.equal(report.environment.device, "google Pixel Test");
  assert.equal(report.iterations, 3);
  assert.deepEqual(
    report.metrics.map(({ id, p50, p95, status }) => ({ id, p50, p95, status })),
    [
      {
        id: "cold_startup_time_to_initial_display_ms",
        p50: 900,
        p95: 1_000,
        status: "pass",
      },
      {
        id: "medium_pdf_reader_frames_and_memory_memory_rss_anon_max_kb",
        p50: 110_000,
        p95: 120_000,
        status: "pass",
      },
      {
        id: "medium_pdf_reader_frames_and_memory_frame_overrun_ms",
        p50: 4,
        p95: 8,
        status: "pass",
      },
    ]
  );
});

test("warns on resource overruns unless calibrated enforcement is enabled", () => {
  const raw = {
    context: { build: {} },
    benchmarks: [
      {
        name: "reader",
        repeatIterations: 1,
        metrics: { memoryRssAnonKb: { runs: [300_000] } },
      },
    ],
  };
  assert.equal(
    convertAndroidBenchmark(raw, { timingsEnforced: false }).metrics[0].status,
    "warn"
  );
  assert.equal(
    convertAndroidBenchmark(raw, { timingsEnforced: true }).metrics[0].status,
    "fail"
  );
});
