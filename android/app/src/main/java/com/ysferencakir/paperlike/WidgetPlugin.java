package com.ysferencakir.paperlike;

import android.content.Context;
import android.content.SharedPreferences;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Feeds the "continue reading" home-screen widget with the current book/progress. */
@CapacitorPlugin(name = "Widget")
public class WidgetPlugin extends Plugin {
    @PluginMethod
    public void updateProgress(PluginCall call) {
        String bookId = call.getString("bookId");
        String title = call.getString("title", "");
        int percentage = call.getInt("percentage", 0);
        if (bookId == null) {
            call.reject("bookId is required");
            return;
        }

        SharedPreferences prefs = getContext().getSharedPreferences(
            ContinueReadingWidgetProvider.PREFS_NAME, Context.MODE_PRIVATE
        );
        prefs.edit()
            .putString(ContinueReadingWidgetProvider.KEY_BOOK_ID, bookId)
            .putString(ContinueReadingWidgetProvider.KEY_TITLE, title)
            .putInt(ContinueReadingWidgetProvider.KEY_PERCENTAGE, percentage)
            .apply();

        ContinueReadingWidgetProvider.updateAll(getContext());
        call.resolve();
    }
}
