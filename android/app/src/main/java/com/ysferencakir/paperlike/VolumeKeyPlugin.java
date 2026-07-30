package com.ysferencakir.paperlike;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Lets the reader page-turn with the volume buttons — an optional e-reader
 * habit, opt-in via a reader setting. `enabled` is a plain static flag (not
 * a bridge call) because MainActivity.onKeyDown needs a synchronous answer
 * to "should I consume this key or let it change the volume normally?" —
 * there's no time to round-trip to JS for that decision.
 */
@CapacitorPlugin(name = "VolumeKey")
public class VolumeKeyPlugin extends Plugin {
    static volatile boolean enabled = false;

    @PluginMethod
    public void setEnabled(PluginCall call) {
        enabled = Boolean.TRUE.equals(call.getBoolean("enabled", false));
        call.resolve();
    }

    void notifyVolumeKey(String direction) {
        JSObject data = new JSObject();
        data.put("direction", direction);
        notifyListeners("volumeKey", data);
    }
}
