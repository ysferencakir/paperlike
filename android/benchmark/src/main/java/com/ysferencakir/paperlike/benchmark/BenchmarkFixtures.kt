package com.ysferencakir.paperlike.benchmark

import android.content.Context
import android.graphics.Paint
import android.graphics.pdf.PdfDocument
import java.io.File
import java.io.FileOutputStream

internal object BenchmarkFixtures {
    private val pagesByProfile = mapOf(
        "small" to 12,
        "medium" to 120,
        "large" to 600,
    )

    fun mediumPdf(context: Context): File = pdf(context, profileName = "medium")

    private fun pdf(context: Context, profileName: String): File {
        val pageCount = pagesByProfile.getValue(profileName)
        val directory = File(context.cacheDir, "benchmark-fixtures").apply { mkdirs() }
        val output = File(directory, "paperlike-benchmark-$profileName.pdf")
        if (output.exists() && output.length() > 0) return output

        val document = PdfDocument()
        val titlePaint = Paint().apply {
            textSize = 22f
            isAntiAlias = true
        }
        val bodyPaint = Paint().apply {
            textSize = 12f
            isAntiAlias = true
        }

        repeat(pageCount) { index ->
            val pageNumber = index + 1
            val info = PdfDocument.PageInfo.Builder(595, 842, pageNumber).create()
            val page = document.startPage(info)
            page.canvas.drawText("Paperlike benchmark page $pageNumber", 48f, 72f, titlePaint)
            page.canvas.drawText(
                "Deterministic Android fixture for import, rendering, memory, and frame timing.",
                48f,
                104f,
                bodyPaint,
            )
            document.finishPage(page)
        }

        FileOutputStream(output).use(document::writeTo)
        document.close()
        return output
    }
}
