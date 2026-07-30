package com.ysferencakir.paperlike;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Bridges "Open with Paperlike" intents (see the VIEW intent-filter in
 * AndroidManifest.xml) into the web app. MainActivity calls
 * notifyFileOpened() with the incoming file's URI whenever one arrives —
 * on cold start or while already running — and JS picks it up via
 * addListener("fileOpened", ...). retainUntilConsumed=true so a cold-start
 * open isn't lost while the web app is still booting and hasn't attached
 * its listener yet.
 */
@CapacitorPlugin(name = "OpenFile")
public class OpenFilePlugin extends Plugin {

    public void notifyFileOpened(String uri, String mimeType) {
        JSObject data = new JSObject();
        data.put("uri", uri);
        data.put("mimeType", mimeType);
        notifyListeners("fileOpened", data, true);
    }
}
