package com.hisabtechnologies.mezgeb;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.os.Build;
import android.graphics.Insets;
import android.view.WindowInsets;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.webkit.CookieManager;
import android.webkit.SslErrorHandler;
import android.net.http.SslError;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

public final class MainActivity extends Activity {
    private static final String APP_HOST = "mezgeb-omega.vercel.app";
    private static final String APP_URL = "https://" + APP_HOST + "/";
    private static final int PICK_FILE_REQUEST = 71;
    private WebView webView;
    private ValueCallback<Uri[]> pendingFileSelection;

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.rgb(6, 29, 50));
        getWindow().setNavigationBarColor(Color.rgb(6, 29, 50));
        WebView.setWebContentsDebuggingEnabled(false);
        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(6, 29, 50));
        FrameLayout viewport = new FrameLayout(this);
        viewport.setBackgroundColor(Color.rgb(6, 29, 50));
        viewport.addView(webView, new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        // Android 15+ enforces edge-to-edge for apps targeting API 35.
        // Keep the status bar clock, battery, notification icons, camera cutout,
        // gesture bar and three-button navigation clear of web content.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            getWindow().setDecorFitsSystemWindows(false);
            viewport.setOnApplyWindowInsetsListener((view, insets) -> {
                Insets bars = insets.getInsets(
                    WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                // An edge-to-edge window is not automatically resized for IME.
                // Apply keyboard bottom inset as well so focused inputs remain visible.
                Insets keyboard = insets.getInsets(WindowInsets.Type.ime());
                int safeBottom = Math.max(bars.bottom, keyboard.bottom);
                FrameLayout.LayoutParams params =
                    (FrameLayout.LayoutParams) webView.getLayoutParams();
                if (params.leftMargin != bars.left || params.topMargin != bars.top
                        || params.rightMargin != bars.right || params.bottomMargin != safeBottom) {
                    params.setMargins(bars.left, bars.top, bars.right, safeBottom);
                    webView.setLayoutParams(params);
                }
                return insets;
            });
        }
        // Android 8-10 retain their normal non-fullscreen window behavior.
        setContentView(viewport);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            viewport.requestApplyInsets();
        }
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true); // Required for the existing React ledger.
        settings.setDomStorageEnabled(true); // IndexedDB/Service Worker keep device records.
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, false);
        webView.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return request.isForMainFrame() && handleNavigation(request.getUrl());
            }
            @Override public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
                handler.cancel(); // Never bypass TLS errors for financial records.
                Toast.makeText(MainActivity.this, "Secure connection failed. Try again online.", Toast.LENGTH_LONG).show();
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (pendingFileSelection != null) pendingFileSelection.onReceiveValue(null);
                pendingFileSelection = callback;
                try {
                    Intent picker = params.createIntent();
                    startActivityForResult(picker, PICK_FILE_REQUEST);
                    return true;
                } catch (ActivityNotFoundException failure) {
                    pendingFileSelection = null;
                    callback.onReceiveValue(null);
                    return false;
                }
            }
        });
        if (savedInstanceState != null && webView.restoreState(savedInstanceState) != null) {
            return;
        }
        webView.loadUrl(APP_URL);
    }

    private boolean handleNavigation(Uri destination) {
        if ("https".equalsIgnoreCase(destination.getScheme()) && APP_HOST.equalsIgnoreCase(destination.getHost())) {
            return false;
        }
        String scheme = destination.getScheme();
        if (!"https".equalsIgnoreCase(scheme) && !"mailto".equalsIgnoreCase(scheme) && !"tel".equalsIgnoreCase(scheme)) {
            return true; // Reject external file:, intent:, data:, and other untrusted schemes.
        }
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, destination));
        } catch (ActivityNotFoundException unavailable) {
            Toast.makeText(this, "No app is available to open that link.", Toast.LENGTH_SHORT).show();
        }
        return true;
    }

    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == PICK_FILE_REQUEST && pendingFileSelection != null) {
            pendingFileSelection.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data));
            pendingFileSelection = null;
        }
    }
    @Override protected void onSaveInstanceState(Bundle outState) {
        if (webView != null) webView.saveState(outState);
        super.onSaveInstanceState(outState);
    }
    @Override public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }
    @Override protected void onDestroy() {
        if (pendingFileSelection != null) { pendingFileSelection.onReceiveValue(null); pendingFileSelection = null; }
        super.onDestroy();
    }
}
