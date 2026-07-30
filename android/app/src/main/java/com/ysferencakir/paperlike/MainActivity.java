package com.ysferencakir.paperlike;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.KeyEvent;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.PluginHandle;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ImmersivePlugin.class);
        registerPlugin(OpenFilePlugin.class);
        registerPlugin(VolumeKeyPlugin.class);
        registerPlugin(ShortcutPlugin.class);
        registerPlugin(CrashReportingPlugin.class);
        registerPlugin(WidgetPlugin.class);
        super.onCreate(savedInstanceState);
        handleIncomingIntent(getIntent());
    }

    @Override
    public void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIncomingIntent(intent);
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (VolumeKeyPlugin.enabled
            && (keyCode == KeyEvent.KEYCODE_VOLUME_UP || keyCode == KeyEvent.KEYCODE_VOLUME_DOWN)) {
            if (event.getRepeatCount() == 0) {
                notifyVolumeKey(keyCode == KeyEvent.KEYCODE_VOLUME_UP ? "up" : "down");
            }
            return true; // consumed — don't also change the media volume
        }
        return super.onKeyDown(keyCode, event);
    }

    private void notifyVolumeKey(String direction) {
        PluginHandle handle = getBridge().getPlugin("VolumeKey");
        if (handle == null) return;
        Object instance = handle.getInstance();
        if (instance instanceof VolumeKeyPlugin) {
            ((VolumeKeyPlugin) instance).notifyVolumeKey(direction);
        }
    }

    private void handleIncomingIntent(Intent intent) {
        if (intent == null) return;
        Uri data = Intent.ACTION_VIEW.equals(intent.getAction()) ? intent.getData() : null;
        if (data != null && "paperlike".equals(data.getScheme())) {
            handleShortcutIntent(data);
        } else {
            handleOpenFileIntent(intent);
        }
    }

    // Fires when the "Continue reading" home-screen shortcut (see
    // ShortcutPlugin) is tapped.
    private void handleShortcutIntent(Uri uri) {
        String bookId = uri.getQueryParameter("bookId");
        if (bookId == null) return;
        PluginHandle handle = getBridge().getPlugin("Shortcuts");
        if (handle == null) return;
        Object instance = handle.getInstance();
        if (instance instanceof ShortcutPlugin) {
            ((ShortcutPlugin) instance).notifyShortcutOpened(bookId);
        }
    }

    // Fires when the app is launched (or already running and re-invoked) via
    // "Open with Paperlike" (VIEW) or "Share -> Paperlike" (SEND) on an
    // .epub/.pdf from another app — see the intent-filters in
    // AndroidManifest.xml.
    private void handleOpenFileIntent(Intent intent) {
        String action = intent.getAction();
        Uri uri;
        if (Intent.ACTION_VIEW.equals(action)) {
            uri = intent.getData();
        } else if (Intent.ACTION_SEND.equals(action)) {
            uri = getSendStreamUri(intent);
        } else {
            return;
        }
        if (uri == null) return;

        PluginHandle handle = getBridge().getPlugin("OpenFile");
        if (handle == null) return;
        Object instance = handle.getInstance();
        if (instance instanceof OpenFilePlugin) {
            ((OpenFilePlugin) instance).notifyFileOpened(uri.toString(), intent.getType());
        }
    }

    @SuppressWarnings("deprecation")
    private Uri getSendStreamUri(Intent intent) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            return intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri.class);
        }
        return intent.getParcelableExtra(Intent.EXTRA_STREAM);
    }
}
