package com.ysferencakir.paperlike;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.firebase.crashlytics.FirebaseCrashlytics;

/**
 * Bridges JS-side errors (window.onerror / unhandledrejection — native
 * Android crashes are already caught automatically by the Firebase SDK
 * itself once initialized, no bridge call needed for those) into
 * Crashlytics, so real-world crashes are visible in the Firebase console
 * instead of only ever being seen via a manually-attached chrome://inspect
 * session.
 */
@CapacitorPlugin(name = "CrashReporting")
public class CrashReportingPlugin extends Plugin {

    @PluginMethod
    public void setCollectionEnabled(PluginCall call) {
        boolean enabled = Boolean.TRUE.equals(call.getBoolean("enabled", false));
        FirebaseCrashlytics crashlytics = FirebaseCrashlytics.getInstance();
        crashlytics.setCrashlyticsCollectionEnabled(enabled);
        if (!enabled) {
            // With automatic collection disabled, reports otherwise remain on
            // the device and could be uploaded by a later opt-in.
            crashlytics.deleteUnsentReports();
        }
        call.resolve();
    }

    @PluginMethod
    public void recordException(PluginCall call) {
        String message = call.getString("message", "Unknown error");
        String stack = call.getString("stack", "");
        FirebaseCrashlytics crashlytics = FirebaseCrashlytics.getInstance();
        if (!crashlytics.isCrashlyticsCollectionEnabled()) {
            call.resolve();
            return;
        }
        if (!stack.isEmpty()) {
            crashlytics.log(stack);
        }
        crashlytics.recordException(new Throwable(message));
        call.resolve();
    }

    @PluginMethod
    public void log(PluginCall call) {
        String message = call.getString("message", "");
        FirebaseCrashlytics.getInstance().log(message);
        call.resolve();
    }
}
