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
import android.view.View;
import android.view.Gravity;
import android.view.WindowInsetsController;
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
import android.webkit.WebResourceResponse;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebResourceError;
import android.util.Log;
import android.widget.Button;
import android.widget.TextView;
import android.widget.LinearLayout;
import android.webkit.ServiceWorkerController;
import android.webkit.ServiceWorkerClient;
import android.widget.Toast;

public final class MainActivity extends Activity {
    private static final String APP_HOST = "mezgeb-omega.vercel.app";
    private static final String APP_URL = BundledUi.START;
    private static final int PICK_FILE_REQUEST = 71;
    // Dark Android clock, battery and connectivity indicators over pale violet.
    private static final int STATUS_BAR_BACKGROUND = Color.rgb(224, 229, 251);
    private WebView webView;
    private static final String TAG="MezgebStartup";
    private boolean onlineRecovery;
    private boolean recovering;
    private final android.os.Handler handler = new android.os.Handler(android.os.Looper.getMainLooper());
    private Runnable startupTimeout;
    private NativeUpdates nativeUpdates;
    private LedgerExport ledgerExport;
    private ValueCallback<Uri[]> pendingFileSelection;

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        try { initialize(savedInstanceState); } catch (RuntimeException | LinkageError failure) {
            Log.e(TAG, "Native startup failed", failure);
            showRecovery("Mezgeb could not open on this device. Your records have not been cleared.");
        }
    }

    private void initialize(Bundle savedInstanceState) {
        nativeUpdates = new NativeUpdates(this);
        // PhoneWindow.getInsetsController() can throw before DecorView exists.
        // Install the decor explicitly, then apply appearance only after content attachment.
        getWindow().getDecorView();
        getWindow().setStatusBarColor(STATUS_BAR_BACKGROUND);
        getWindow().setNavigationBarColor(Color.rgb(16, 17, 37));
        WebView.setWebContentsDebuggingEnabled(false);
        webView = new WebView(this);

        webView.setBackgroundColor(Color.rgb(16, 17, 37));
        FrameLayout viewport = new FrameLayout(this);
        viewport.setBackgroundColor(Color.rgb(16, 17, 37));
        // On Android 15+, statusBarColor can be transparent under enforced
        // edge-to-edge. Paint the actual inset behind the OS indicators.
        View statusBarBackdrop = new View(this);
        statusBarBackdrop.setBackgroundColor(STATUS_BAR_BACKGROUND);
        viewport.addView(statusBarBackdrop, new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, 0, Gravity.TOP));
        viewport.addView(webView, new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        // Android 15+ enforces edge-to-edge for apps targeting API 35.
        // Keep the status bar clock, battery, notification icons, camera cutout,
        // gesture bar and three-button navigation clear of web content.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            getWindow().setDecorFitsSystemWindows(false);
            viewport.setOnApplyWindowInsetsListener((view, insets) -> {
                if (webView == null) return insets;
                Insets bars = insets.getInsets(
                    WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                // An edge-to-edge window is not automatically resized for IME.
                // Apply keyboard bottom inset as well so focused inputs remain visible.
                Insets keyboard = insets.getInsets(WindowInsets.Type.ime());
                int safeBottom = Math.max(bars.bottom, keyboard.bottom);
                FrameLayout.LayoutParams statusParams =
                    (FrameLayout.LayoutParams) statusBarBackdrop.getLayoutParams();
                if (statusParams.height != bars.top) {
                    statusParams.height = bars.top;
                    statusBarBackdrop.setLayoutParams(statusParams);
                }
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
        applySystemBarAppearance();
        viewport.post(this::applySystemBarAppearance);
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
        // Optional vendor-specific WebView integrations must never prevent startup.
        try {
            ServiceWorkerController.getInstance().setServiceWorkerClient(new ServiceWorkerClient() {
                @Override public WebResourceResponse shouldInterceptRequest(WebResourceRequest request) {
                    return BundledUi.response(MainActivity.this,request.getUrl(),request.getMethod());
                }
            });
        } catch (RuntimeException | LinkageError unavailable) { Log.w(TAG,"Service worker interception unavailable",unavailable); }
        try {
            ledgerExport = new LedgerExport(this);
            ledgerExport.attach(webView);
        } catch (RuntimeException | LinkageError unavailable) {
            ledgerExport = null;
            Log.w(TAG,"Optional backup bridge unavailable",unavailable);
        }
        webView.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return BundledUi.response(MainActivity.this,request.getUrl(),request.getMethod());
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                if (request.isForMainFrame() && "https".equalsIgnoreCase(url.getScheme())
                        && APP_HOST.equalsIgnoreCase(url.getHost()) && "/native-update".equals(url.getPath())) {
                    if (request.hasGesture()) {
                        if (!"com.hisabtechnologies.mezgeb".equals(getPackageName())) Toast.makeText(MainActivity.this,"Recovery test cannot install production updates.",Toast.LENGTH_LONG).show();
                        else nativeUpdates.check();
                    }
                    return true;
                }
                return request.isForMainFrame() && handleNavigation(url);
            }
            @Override public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                Log.e(TAG,"WebView renderer stopped; crashed="+detail.didCrash());
                showRecovery("The Android web engine stopped. Your ledger is still stored on this device.");
                return true;
            }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) {
                    Log.e(TAG,"Main frame load failed: "+error.getErrorCode());
                    showRecovery("Mezgeb could not load its interface. Try opening it again.");
                }
            }
            @Override public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
                handler.cancel(); // Never bypass TLS errors for financial records.
                showRecovery("Secure connection failed. Check your network or device date and try again.");
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override public void onReceivedTitle(WebView view,String title) {
                if (view == webView && "Mezgeb Ready".equals(title)) {
                    cancelStartupTimeout();
                    Log.i(TAG,"Bundled interface ready");
                } else if (view == webView && "Mezgeb Recovery".equals(title)) {
                    cancelStartupTimeout();
                    Log.e(TAG,"Bundled interface recovery screen");
                }
            }
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
        // Always boot the current bundled entry after an update. Never restore a stale versioned URL.
        // IndexedDB, cookies and localStorage are intentionally retained.
        onlineRecovery = getIntent().getBooleanExtra("mezgebOnlineRecovery",false);
        if (!onlineRecovery) {
            startupTimeout = () -> {if (!isFinishing() && !isDestroyed() && !recovering) showRecovery("The interface did not finish loading. Retry or open the existing online interface.");};
            handler.postDelayed(startupTimeout,20000);
        }
        webView.loadUrl(onlineRecovery ? "https://"+APP_HOST+"/" : APP_URL);
    }

    private void applySystemBarAppearance() {
        // Appearance is cosmetic. A missing or not-yet-attached controller must never abort launch.
        try {
            View decor = getWindow().getDecorView();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                WindowInsetsController controller = decor.getWindowInsetsController();
                if (controller != null) {
                    controller.setSystemBarsAppearance(
                        WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS,
                        WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS);
                }
            } else {
                decor.setSystemUiVisibility(decor.getSystemUiVisibility() | View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);
            }
        } catch (RuntimeException | LinkageError unavailable) {
            Log.w(TAG,"System bar appearance deferred",unavailable);
        }
    }
    @Override public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) applySystemBarAppearance();
    }
    private void cancelStartupTimeout() {
        if (startupTimeout != null) { handler.removeCallbacks(startupTimeout); startupTimeout=null; }
    }
    private void showRecovery(String message) {
        if (isFinishing() || isDestroyed() || recovering) return;
        recovering=true;
        cancelStartupTimeout();
        WebView previous=webView;webView=null;
        if(previous!=null){
            try { android.view.ViewParent parent=previous.getParent();if(parent instanceof ViewGroup)((ViewGroup)parent).removeView(previous);previous.destroy(); }
            catch(RuntimeException | LinkageError ignored){Log.w(TAG,"Renderer cleanup unavailable");}
        }
        LinearLayout panel=new LinearLayout(this);panel.setOrientation(LinearLayout.VERTICAL);panel.setGravity(Gravity.CENTER);panel.setPadding(48,64,48,64);panel.setBackgroundColor(Color.rgb(245,247,255));
        TextView logo=new TextView(this);logo.setText("መዝገብ");logo.setTextSize(40);logo.setTextColor(Color.rgb(73,37,245));panel.addView(logo);
        TextView title=new TextView(this);title.setText("Mezgeb");title.setTextSize(26);title.setTextColor(Color.rgb(16,17,37));panel.addView(title);
        TextView body=new TextView(this);body.setText(message+"\n\nNo records have been deleted. Do not clear app data.");body.setTextSize(16);body.setTextColor(Color.rgb(60,64,86));body.setPadding(0,24,0,24);panel.addView(body);
        Button retry=new Button(this);retry.setText("Retry Mezgeb");retry.setOnClickListener(v->{getIntent().removeExtra("mezgebOnlineRecovery");recreate();});panel.addView(retry);
        Button online=new Button(this);online.setText("Open existing online interface");online.setOnClickListener(v->{getIntent().putExtra("mezgebOnlineRecovery",true);recreate();});panel.addView(online);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) getWindow().setDecorFitsSystemWindows(true);
        setContentView(panel);
        applySystemBarAppearance();
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
        if (requestCode == LedgerExport.REQUEST && ledgerExport != null) {ledgerExport.result(resultCode,data);return;}
        if (requestCode == PICK_FILE_REQUEST && pendingFileSelection != null) {
            pendingFileSelection.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data));
            pendingFileSelection = null;
        }
    }
    @Override protected void onSaveInstanceState(Bundle outState) {
        // Do not persist WebView navigation state across process recreation or releases.
        super.onSaveInstanceState(outState);
    }
    @Override public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }
    @Override protected void onDestroy() {
        cancelStartupTimeout();
        if (pendingFileSelection != null) { pendingFileSelection.onReceiveValue(null); pendingFileSelection = null; }
        if (nativeUpdates != null) nativeUpdates.close();
        if (ledgerExport != null) ledgerExport.close();
        super.onDestroy();
    }
}
