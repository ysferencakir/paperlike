package com.ysferencakir.paperlike;

import android.view.WindowManager;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Hides/shows the Android system navigation bar to match the reader's own
 * "chrome" (top/bottom menu) visibility, so hiding the app's UI actually
 * gives a full-screen reading surface instead of leaving the system nav
 * bar behind. Swiping from the bottom still temporarily reveals it
 * (BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE) so it never traps the user.
 */
@CapacitorPlugin(name = "Immersive")
public class ImmersivePlugin extends Plugin {

    @PluginMethod
    public void hide(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            WindowCompat.setDecorFitsSystemWindows(getActivity().getWindow(), false);
            WindowInsetsControllerCompat controller =
                WindowCompat.getInsetsController(getActivity().getWindow(), getActivity().getWindow().getDecorView());
            controller.setSystemBarsBehavior(
                WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            controller.hide(WindowInsetsCompat.Type.navigationBars());
            call.resolve();
        });
    }

    @PluginMethod
    public void show(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            WindowCompat.setDecorFitsSystemWindows(getActivity().getWindow(), true);
            WindowInsetsControllerCompat controller =
                WindowCompat.getInsetsController(getActivity().getWindow(), getActivity().getWindow().getDecorView());
            controller.show(WindowInsetsCompat.Type.navigationBars());
            call.resolve();
        });
    }

    /** Keeps the screen from dimming/locking (true) or lets it behave normally (false). */
    @PluginMethod
    public void keepAwake(PluginCall call) {
        boolean awake = Boolean.TRUE.equals(call.getBoolean("awake", true));
        getActivity().runOnUiThread(() -> {
            if (awake) {
                getActivity().getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            } else {
                getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            }
            call.resolve();
        });
    }
}
