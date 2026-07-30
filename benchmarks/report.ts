import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export type BenchmarkMetricKind = "timing" | "structural";
export type BenchmarkStatus = "pass" | "warn" | "fail";

export interface BenchmarkMetricDefinition {
  id: string;
  label: string;
  unit: "ms" | "count";
  kind: BenchmarkMetricKind;
  budget: number;
}

export interface BenchmarkMetricResult extends BenchmarkMetricDefinition {
  samples: number[];
  p50: number;
  p95: number;
  max: number;
  status: BenchmarkStatus;
}

export interface BenchmarkReport {
  schemaVersion: 1;
  suite: "paperlike-reader";
  platform: "web" | "android";
  profile: string;
  generatedAt: string;
  iterations: number;
  timingsEnforced: boolean;
  environment: {
    ci: boolean;
    node: string;
    os: string;
    architecture: string;
    browser?: string;
    commit?: string;
  };
  fixtures: Record<string, { bytes: number; itemCount: number; mimeType: string }>;
  metrics: BenchmarkMetricResult[];
}

export function percentile(samples: number[], percentileValue: number): number {
  if (samples.length === 0) return 0;
  const sorted = [...samples].sort((a, b) => a - b);
  const index = Math.ceil((percentileValue / 100) * sorted.length) - 1;
  return round(sorted[Math.max(0, index)]);
}

export function createMetricResult(
  definition: BenchmarkMetricDefinition,
  samples: number[],
  timingsEnforced: boolean
): BenchmarkMetricResult {
  const roundedSamples = samples.map(round);
  const p95 = percentile(roundedSamples, 95);
  const overBudget = p95 > definition.budget;
  const status: BenchmarkStatus = overBudget
    ? definition.kind === "timing" && !timingsEnforced
      ? "warn"
      : "fail"
    : "pass";

  return {
    ...definition,
    samples: roundedSamples,
    p50: percentile(roundedSamples, 50),
    p95,
    max: roundedSamples.length ? Math.max(...roundedSamples) : 0,
    status,
  };
}

export async function writeBenchmarkReport(report: BenchmarkReport): Promise<void> {
  const outputDirectory = path.resolve("benchmark-results");
  await mkdir(outputDirectory, { recursive: true });
  await Promise.all([
    writeFile(
      path.join(outputDirectory, "latest.json"),
      `${JSON.stringify(report, null, 2)}\n`,
      "utf8"
    ),
    writeFile(path.join(outputDirectory, "latest.md"), renderMarkdown(report), "utf8"),
  ]);
}

function renderMarkdown(report: BenchmarkReport): string {
  const rows = report.metrics.map(
    (metric) =>
      `| ${metric.id} | ${metric.p50} | ${metric.p95} | ${metric.budget} ${metric.unit} | ${metric.status.toUpperCase()} |`
  );
  return `# Paperlike Benchmark Report

- Generated: ${report.generatedAt}
- Platform/profile: ${report.platform} / ${report.profile}
- Iterations: ${report.iterations}
- Timing budgets enforced: ${report.timingsEnforced ? "yes" : "no"}
- Commit: ${report.environment.commit ?? "local working tree"}
- Runtime: ${report.environment.browser ?? report.environment.node}

| Metric | p50 | p95 | Budget | Status |
| --- | ---: | ---: | ---: | --- |
${rows.join("\n")}

Timing budget overruns are warnings by default because shared CI runners are noisy. Set
\`BENCHMARK_ENFORCE_TIMINGS=1\` on a calibrated runner to turn them into failures.
Structural budgets always fail.
`;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
