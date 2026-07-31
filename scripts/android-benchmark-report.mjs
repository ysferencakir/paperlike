import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const METRIC_POLICIES = {
  timeToInitialDisplayMs: { unit: "ms", kind: "timing", budget: 2_500 },
  timeToFullDisplayMs: { unit: "ms", kind: "timing", budget: 5_000 },
  frameOverrunMs: { unit: "ms", kind: "timing", budget: 16 },
  frameDurationCpuMs: { unit: "ms", kind: "timing", budget: 32 },
  frameCount: { unit: "count", kind: "structural", budget: 1_000_000 },
  memoryRssAnonKb: { unit: "kb", kind: "resource", budget: 262_144 },
  memoryRssFileKb: { unit: "kb", kind: "resource", budget: 262_144 },
  memoryRssShmemKb: { unit: "kb", kind: "resource", budget: 131_072 },
  memoryHeapSizeKb: { unit: "kb", kind: "resource", budget: 262_144 },
  memoryGpuKb: { unit: "kb", kind: "resource", budget: 262_144 },
  memoryRssAnonMaxKb: { unit: "kb", kind: "resource", budget: 262_144 },
  memoryRssFileMaxKb: { unit: "kb", kind: "resource", budget: 262_144 },
  memoryRssShmemMaxKb: { unit: "kb", kind: "resource", budget: 131_072 },
  memoryHeapSizeMaxKb: { unit: "kb", kind: "resource", budget: 262_144 },
  memoryGpuMaxKb: { unit: "kb", kind: "resource", budget: 262_144 },
};

export function convertAndroidBenchmark(raw, options = {}) {
  if (!Array.isArray(raw?.benchmarks) || raw.benchmarks.length === 0) {
    throw new Error("AndroidX benchmark report contains no benchmark results.");
  }

  const timingsEnforced = options.timingsEnforced ?? process.env.BENCHMARK_ENFORCE_TIMINGS === "1";
  const metrics = [];
  for (const benchmark of raw.benchmarks) {
    const containers = [benchmark.metrics ?? {}, benchmark.sampledMetrics ?? {}];
    for (const container of containers) {
      for (const [rawName, rawMetric] of Object.entries(container)) {
        const policy = policyFor(rawName);
        if (!policy) continue;
        const samples = extractSamples(rawMetric);
        if (samples.length === 0) continue;
        const p50 = percentile(samples, 50);
        const p95 = percentile(samples, 95);
        const overBudget = p95 > policy.budget;
        metrics.push({
          id: `${toSnakeCase(benchmark.name)}_${toSnakeCase(rawName)}`,
          label: `${benchmark.name}: ${rawName}`,
          unit: policy.unit,
          kind: policy.kind,
          budget: policy.budget,
          samples: samples.map(round),
          p50,
          p95,
          max: round(Math.max(...samples)),
          status: overBudget
            ? policy.kind === "structural" || timingsEnforced
              ? "fail"
              : "warn"
            : "pass",
        });
      }
    }
  }
  if (metrics.length === 0) {
    throw new Error("AndroidX benchmark report contains no supported metrics.");
  }

  const build = raw.context?.build ?? {};
  return {
    schemaVersion: 1,
    suite: "paperlike-reader",
    platform: "android",
    profile: options.profile ?? "medium",
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    iterations: Math.max(...raw.benchmarks.map((item) => item.repeatIterations ?? 0)),
    timingsEnforced,
    environment: {
      ci: options.ci ?? Boolean(process.env.CI),
      device: [build.brand, build.model].filter(Boolean).join(" ") || build.device || "unknown",
      sdk: build.version?.sdk,
      fingerprint: build.fingerprint,
      memoryBytes: raw.context?.memTotalBytes,
      cpuCoreCount: raw.context?.cpuCoreCount,
      architecture: raw.context?.cpuAbi,
      commit: options.commit ?? process.env.GITHUB_SHA,
    },
    fixtures: {
      pdf: { bytes: 0, itemCount: 120, mimeType: "application/pdf" },
    },
    metrics,
  };
}

export async function convertLatestAndroidBenchmark(options = {}) {
  const searchRoot = path.resolve(
    options.searchRoot ?? "android/benchmark/build/outputs"
  );
  const candidates = await findBenchmarkReports(searchRoot);
  if (candidates.length === 0) {
    throw new Error(
      `No *-benchmarkData.json file found under ${searchRoot}. Run the device benchmark first.`
    );
  }
  const sourcePath = candidates.sort().at(-1);
  const raw = JSON.parse(await readFile(sourcePath, "utf8"));
  const report = convertAndroidBenchmark(raw, options);
  const outputDirectory = path.resolve(options.outputDirectory ?? "benchmark-results");
  await mkdir(outputDirectory, { recursive: true });
  await Promise.all([
    writeFile(
      path.join(outputDirectory, "android-latest.json"),
      `${JSON.stringify(report, null, 2)}\n`,
      "utf8"
    ),
    writeFile(path.join(outputDirectory, "android-latest.md"), renderMarkdown(report), "utf8"),
  ]);
  return { report, sourcePath };
}

async function findBenchmarkReports(directory) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
  const nested = await Promise.all(
    entries.map((entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return findBenchmarkReports(entryPath);
      return entry.name.endsWith("-benchmarkData.json") ? [entryPath] : [];
    })
  );
  return nested.flat();
}

function extractSamples(metric) {
  if (Array.isArray(metric)) return metric.filter(Number.isFinite);
  if (Array.isArray(metric?.runs)) return metric.runs.flat(Infinity).filter(Number.isFinite);
  if (Array.isArray(metric?.data)) return metric.data.filter(Number.isFinite);
  if (Number.isFinite(metric?.median)) return [metric.median];
  return [];
}

function policyFor(rawName) {
  if (METRIC_POLICIES[rawName]) return METRIC_POLICIES[rawName];
  const baseName = Object.keys(METRIC_POLICIES).find((name) => rawName.startsWith(`${name}_`));
  return baseName ? METRIC_POLICIES[baseName] : undefined;
}

function percentile(samples, value) {
  const sorted = [...samples].sort((a, b) => a - b);
  const index = Math.max(0, Math.ceil((value / 100) * sorted.length) - 1);
  return round(sorted[index]);
}

function toSnakeCase(value) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .toLowerCase();
}

function renderMarkdown(report) {
  const rows = report.metrics.map(
    (metric) =>
      `| ${metric.id} | ${metric.p50} | ${metric.p95} | ${metric.budget} ${metric.unit} | ${metric.status.toUpperCase()} |`
  );
  return `# Paperlike Android Benchmark Report

- Generated: ${report.generatedAt}
- Device: ${report.environment.device} (API ${report.environment.sdk ?? "unknown"})
- Profile/iterations: ${report.profile} / ${report.iterations}
- Timing and resource budgets enforced: ${report.timingsEnforced ? "yes" : "no"}
- Commit: ${report.environment.commit ?? "local working tree"}

| Metric | p50 | p95 | Budget | Status |
| --- | ---: | ---: | ---: | --- |
${rows.join("\n")}

AndroidX raw traces and benchmarkData JSON remain the diagnostic source. This normalized
report shares schema version 1 with the web benchmark.
`;
}

function round(value) {
  return Math.round(value * 100) / 100;
}

const isCli = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isCli) {
  convertLatestAndroidBenchmark()
    .then(({ sourcePath }) => console.log(`Android benchmark report converted from ${sourcePath}`))
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}
