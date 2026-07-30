package com.ysferencakir.paperlike;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.widget.RemoteViews;

/**
 * Home-screen widget showing the book currently being read and how far the
 * reader has gotten. Data is written into SharedPreferences by WidgetPlugin
 * (called from JS whenever reading progress changes) and pushed into every
 * placed widget instance from there — updatePeriodMillis in the widget-info
 * XML is only a 30-minute fallback, since Android won't honor anything
 * shorter than that.
 */
public class ContinueReadingWidgetProvider extends AppWidgetProvider {
    static final String PREFS_NAME = "paperlike_widget_prefs";
    static final String KEY_BOOK_ID = "bookId";
    static final String KEY_TITLE = "title";
    static final String KEY_PERCENTAGE = "percentage";

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            appWidgetManager.updateAppWidget(appWidgetId, buildRemoteViews(context));
        }
    }

    static void updateAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        ComponentName provider = new ComponentName(context, ContinueReadingWidgetProvider.class);
        int[] ids = manager.getAppWidgetIds(provider);
        if (ids.length == 0) return;
        RemoteViews views = buildRemoteViews(context);
        for (int id : ids) {
            manager.updateAppWidget(id, views);
        }
    }

    private static RemoteViews buildRemoteViews(Context context) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_continue_reading);
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String bookId = prefs.getString(KEY_BOOK_ID, null);
        String title = prefs.getString(KEY_TITLE, "");
        int percentage = prefs.getInt(KEY_PERCENTAGE, 0);

        if (bookId == null) {
            views.setViewVisibility(R.id.widget_empty_text, android.view.View.VISIBLE);
            views.setViewVisibility(R.id.widget_book_group, android.view.View.GONE);
            Intent launchIntent = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
            PendingIntent pendingIntent = PendingIntent.getActivity(
                context, 0, launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
            views.setOnClickPendingIntent(R.id.widget_empty_text, pendingIntent);
            return views;
        }

        views.setViewVisibility(R.id.widget_empty_text, android.view.View.GONE);
        views.setViewVisibility(R.id.widget_book_group, android.view.View.VISIBLE);
        views.setTextViewText(R.id.widget_title, title);
        views.setProgressBar(R.id.widget_progress, 100, percentage, false);
        views.setTextViewText(R.id.widget_percentage, "%" + percentage + " — devam et");

        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse("paperlike://continue-reading?bookId=" + bookId));
        intent.setClass(context, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            context, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_book_group, pendingIntent);
        return views;
    }
}
