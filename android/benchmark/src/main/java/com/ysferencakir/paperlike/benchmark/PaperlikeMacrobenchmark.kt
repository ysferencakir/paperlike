package com.ysferencakir.paperlike.benchmark

import android.content.ComponentName
import android.content.Intent
import androidx.benchmark.macro.BaselineProfileMode
import androidx.benchmark.macro.CompilationMode
import androidx.benchmark.macro.ExperimentalMetricApi
import androidx.benchmark.macro.FrameTimingMetric
import androidx.benchmark.macro.MemoryUsageMetric
import androidx.benchmark.macro.StartupMode
import androidx.benchmark.macro.StartupTimingMetric
import androidx.benchmark.macro.junit4.MacrobenchmarkRule
import androidx.core.content.FileProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.By
import androidx.test.uiautomator.Until
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.util.regex.Pattern

@RunWith(AndroidJUnit4::class)
class PaperlikeMacrobenchmark {
    @get:Rule
    val benchmarkRule = MacrobenchmarkRule()

    @Test
    fun coldStartup() = benchmarkRule.measureRepeated(
        packageName = PACKAGE_NAME,
        metrics = listOf(StartupTimingMetric()),
        compilationMode = CompilationMode.None(),
        startupMode = StartupMode.COLD,
        iterations = iterations(),
        setupBlock = { pressHome() },
    ) {
        startActivityAndWait()
    }

    @OptIn(ExperimentalMetricApi::class)
    @Test
    fun mediumPdfReaderFramesAndMemory() = benchmarkRule.measureRepeated(
        packageName = PACKAGE_NAME,
        metrics = listOf(
            FrameTimingMetric(),
            MemoryUsageMetric(MemoryUsageMetric.Mode.Max),
        ),
        compilationMode = CompilationMode.Partial(
            baselineProfileMode = BaselineProfileMode.Disable,
            warmupIterations = 3,
        ),
        startupMode = null,
        iterations = iterations(),
        setupBlock = {
            killProcess()
            InstrumentationRegistry.getInstrumentation().context.startActivity(pdfImportIntent())
            check(
                device.wait(
                    Until.hasObject(PDF_CONTROLS_SELECTOR),
                    IMPORT_TIMEOUT_MS,
                ),
            ) {
                "The medium PDF was not imported and opened before the measurement."
            }
            pressHome()
        },
    ) {
        startActivityAndWait()
        check(device.wait(Until.hasObject(PDF_CONTROLS_SELECTOR), UI_TIMEOUT_MS)) {
            "PDF reader controls did not become visible."
        }

        val width = device.displayWidth
        val height = device.displayHeight
        repeat(5) {
            device.swipe(width / 2, height * 3 / 4, width / 2, height / 4, 20)
            device.waitForIdle()
        }
    }

    private fun pdfImportIntent(): Intent {
        val context = InstrumentationRegistry.getInstrumentation().context
        val fixture = BenchmarkFixtures.mediumPdf(context)
        val uri = FileProvider.getUriForFile(context, FILE_AUTHORITY, fixture)
        context.grantUriPermission(PACKAGE_NAME, uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
        return Intent(Intent.ACTION_VIEW).apply {
            component = ComponentName(PACKAGE_NAME, "$PACKAGE_NAME.MainActivity")
            setDataAndType(uri, "application/pdf")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
        }
    }

    private fun iterations(): Int {
        val arguments = InstrumentationRegistry.getArguments()
        return arguments.getString("paperlikeBenchmarkIterations")
            ?.toIntOrNull()
            ?.coerceIn(1, 20)
            ?: 5
    }

    private companion object {
        const val PACKAGE_NAME = "com.ysferencakir.paperlike"
        const val FILE_AUTHORITY = "com.ysferencakir.paperlike.benchmark.files"
        const val UI_TIMEOUT_MS = 15_000L
        const val IMPORT_TIMEOUT_MS = 60_000L
        val PDF_CONTROLS_SELECTOR = By.desc(
            Pattern.compile(".*(Uzaklaştır|Zoom out).*", Pattern.CASE_INSENSITIVE),
        )
    }
}
