import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { convertLatestAndroidBenchmark } from "./android-benchmark-report.mjs";

const root = path.resolve(import.meta.dirname, "..");
const androidDirectory = path.join(root, "android");
const assembleOnly = process.argv.includes("--assemble");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const gradleCommand = process.platform === "win32" ? "gradlew.bat" : "./gradlew";
const requestedIterations = Number.parseInt(process.env.BENCHMARK_ITERATIONS ?? "5", 10);
const iterations =
  Number.isFinite(requestedIterations) && requestedIterations > 0
    ? Math.min(requestedIterations, 20)
    : 5;
const javaHome =
  process.env.JAVA_HOME ??
  (process.platform === "win32"
    ? "C:\\Program Files\\Android\\Android Studio\\jbr"
    : process.env.JAVA_HOME);
const deviceBenchmarkAllowed =
  process.env.PAPERLIKE_ALLOW_DEVICE_BENCHMARK === "dedicated-test-device";

if (!javaHome) {
  throw new Error("JAVA_HOME must point to a Java 21 installation.");
}
if (!assembleOnly && !deviceBenchmarkAllowed) {
  throw new Error(
    "Physical-device benchmarks are disabled to protect normal app installs and local data. " +
      "Run --assemble for a build-only check. A dedicated disposable test device must set " +
      "PAPERLIKE_ALLOW_DEVICE_BENCHMARK=dedicated-test-device explicitly."
  );
}

const benchmarkDevice = assembleOnly ? undefined : verifyPhysicalDevice();
run(npmCommand, ["run", "cap:sync"], root);

const gradleArguments = assembleOnly
  ? [":benchmark:assembleBenchmark", "--no-daemon"]
  : [
      ":benchmark:connectedBenchmarkAndroidTest",
      "--no-daemon",
      `-Pandroid.testInstrumentationRunnerArguments.paperlikeBenchmarkIterations=${iterations}`,
    ];
const previousScreenTimeout = benchmarkDevice ? prepareDevice(benchmarkDevice) : undefined;
try {
  run(gradleCommand, gradleArguments, androidDirectory, { JAVA_HOME: javaHome });

  if (!assembleOnly) {
    const { sourcePath } = await convertLatestAndroidBenchmark();
    console.log(`Normalized Android report written from ${sourcePath}`);
  }
} finally {
  if (benchmarkDevice && previousScreenTimeout) {
    adb(benchmarkDevice, ["shell", "settings", "put", "system", "screen_off_timeout", previousScreenTimeout]);
  }
}

function run(command, args, cwd, extraEnvironment = {}) {
  const isWindowsScript =
    process.platform === "win32" && (command.endsWith(".cmd") || command.endsWith(".bat"));
  const executable = isWindowsScript ? (process.env.ComSpec ?? "cmd.exe") : command;
  const executableArguments = isWindowsScript ? ["/d", "/s", "/c", command, ...args] : args;
  const result = spawnSync(executable, executableArguments, {
    cwd,
    env: { ...process.env, ...extraEnvironment },
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const hint =
      !assembleOnly && command.includes("gradlew")
        ? "\nConnect an API 29+ physical Android device with USB debugging enabled and retry."
        : "";
    throw new Error(`${command} exited with code ${result.status}.${hint}`);
  }
}

function verifyPhysicalDevice() {
  const sdkRoot =
    process.env.ANDROID_HOME ??
    process.env.ANDROID_SDK_ROOT ??
    (process.platform === "win32" && process.env.LOCALAPPDATA
      ? path.join(process.env.LOCALAPPDATA, "Android", "Sdk")
      : undefined);
  const adbName = process.platform === "win32" ? "adb.exe" : "adb";
  const sdkAdb = sdkRoot ? path.join(sdkRoot, "platform-tools", adbName) : undefined;
  const adb = sdkAdb && existsSync(sdkAdb) ? sdkAdb : "adb";
  const result = spawnSync(adb, ["devices", "-l"], { encoding: "utf8" });
  if (result.error) {
    throw new Error(`ADB could not be started: ${result.error.message}`);
  }
  const devices = result.stdout
    .split(/\r?\n/)
    .filter((line) => /\sdevice(?:\s|$)/.test(line) && !line.startsWith("List of"));
  if (devices.length === 0) {
    throw new Error(
      "No authorized physical Android device is attached. Enable USB debugging, accept the host key, and retry."
    );
  }
  console.log(`Android benchmark device: ${devices[0]}`);
  return {
    adb,
    serial: devices[0].split(/\s+/, 1)[0],
  };
}

function prepareDevice(device) {
  adb(device, ["shell", "input", "keyevent", "KEYCODE_WAKEUP"]);
  adb(device, ["shell", "wm", "dismiss-keyguard"]);
  const windowState = adb(device, ["shell", "dumpsys", "window"], true);
  if (/isKeyguardShowing=true|mKeyguardShowing=true/.test(windowState)) {
    throw new Error(
      "The Android benchmark device is locked. Unlock it once, then rerun the benchmark."
    );
  }
  const previousScreenTimeout = adb(
    device,
    ["shell", "settings", "get", "system", "screen_off_timeout"],
    true
  ).trim();
  adb(device, ["shell", "settings", "put", "system", "screen_off_timeout", "1800000"]);
  return /^\d+$/.test(previousScreenTimeout) ? previousScreenTimeout : undefined;
}

function adb(device, args, capture = false) {
  const result = spawnSync(device.adb, ["-s", device.serial, ...args], {
    encoding: capture ? "utf8" : undefined,
    stdio: capture ? "pipe" : "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`ADB command failed with code ${result.status}: ${args.join(" ")}`);
  }
  return capture ? result.stdout : "";
}
