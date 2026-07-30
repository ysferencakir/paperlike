package com.ysferencakir.paperlike;

import android.content.Intent;
import android.content.pm.ShortcutInfo;
import android.net.Uri;
import androidx.core.content.pm.ShortcutInfoCompat;
import androidx.core.content.pm.ShortcutManagerCompat;
import androidx.core.graphics.drawable.IconCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * A single dynamic "Continue reading <title>" shortcut on the app icon's
 * long-press menu, always pointing at whichever book was opened most
 * recently. The shortcut's intent targets MainActivity directly with our
 * own paperlike://continue-reading URI — no manifest intent-filter needed,
 * since we (not another app) construct and own this intent.
 */
@CapacitorPlugin(name = "Shortcuts")
public class ShortcutPlugin extends Plugin {
    private static final String SHORTCUT_ID = "continue_reading";

    @PluginMethod
    public void setContinueReading(PluginCall call) {
        String bookId = call.getString("bookId");
        String title = call.getString("title", "Kaldığın yerden devam et");
        if (bookId == null) {
            call.reject("bookId is required");
            return;
        }

        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse("paperlike://continue-reading?bookId=" + bookId));
        intent.setClass(getContext(), MainActivity.class);
        intent.setAction(Intent.ACTION_VIEW);

        ShortcutInfoCompat shortcut = new ShortcutInfoCompat.Builder(getContext(), SHORTCUT_ID)
            .setShortLabel(title)
            .setLongLabel(title)
            .setIcon(IconCompat.createWithResource(getContext(), R.drawable.ic_launcher_foreground))
            .setIntent(intent)
            .build();

        ShortcutManagerCompat.pushDynamicShortcut(getContext(), shortcut);
        call.resolve();
    }

    void notifyShortcutOpened(String bookId) {
        JSObject data = new JSObject();
        data.put("bookId", bookId);
        notifyListeners("shortcutOpened", data);
    }
}
