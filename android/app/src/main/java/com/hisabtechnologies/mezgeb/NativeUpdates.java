package com.hisabtechnologies.mezgeb;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.PendingIntent;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageInstaller;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.URL;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;
import javax.net.ssl.HttpsURLConnection;

/** Native package updates are separate from the web interface and never trust an arbitrary URL. */
final class NativeUpdates {
    private static final String HOST = "https://mezgeb-omega.vercel.app";
    private static final long MAX_BYTES = 150L * 1024L * 1024L;
    private final Activity activity;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final AtomicBoolean busy = new AtomicBoolean(false);
    private final AtomicBoolean cancelled = new AtomicBoolean(false);
    NativeUpdates(Activity activity) { this.activity = activity; }
    void close() { cancelled.set(true); executor.shutdownNow(); }
    private boolean active() { return !activity.isFinishing() && !activity.isDestroyed(); }
    private void ui(Runnable work) { activity.runOnUiThread(() -> { if (active()) work.run(); }); }
    private void message(String title, String body) {
        ui(() -> new AlertDialog.Builder(activity).setTitle(title).setMessage(body).setPositiveButton("OK", null).show());
    }
    private HttpsURLConnection connect(String path) throws Exception {
        HttpsURLConnection c = (HttpsURLConnection) new URL(HOST + path).openConnection();
        c.setConnectTimeout(15000); c.setReadTimeout(20000);
        c.setInstanceFollowRedirects(false); c.setUseCaches(false);
        c.setRequestProperty("Cache-Control", "no-cache");
        if (c.getResponseCode() != 200) { c.disconnect(); throw new Exception("Secure release server unavailable."); }
        return c;
    }
    private JSONObject metadata() throws Exception {
        HttpsURLConnection c = connect("/native-update.json");
        try (InputStream in = c.getInputStream(); ByteArrayOutputStream bytes = new ByteArrayOutputStream()) {
            byte[] buf = new byte[4096]; int n;
            while ((n = in.read(buf)) != -1) {
                if (bytes.size() + n > 65536) throw new Exception("Invalid release manifest.");
                bytes.write(buf, 0, n);
            }
            return new JSONObject(bytes.toString("UTF-8"));
        } finally { c.disconnect(); }
    }
    private long version(PackageInfo info) {
        return Build.VERSION.SDK_INT >= 28 ? info.getLongVersionCode() : info.versionCode;
    }
    private int signatureFlags() {
        return Build.VERSION.SDK_INT >= 28 ? PackageManager.GET_SIGNING_CERTIFICATES : PackageManager.GET_SIGNATURES;
    }
    private Set<String> signatures(PackageInfo info) throws Exception {
        Signature[] signatures = Build.VERSION.SDK_INT >= 28 && info.signingInfo != null
            ? info.signingInfo.getApkContentsSigners() : info.signatures;
        if (signatures == null || signatures.length == 0) throw new Exception("Missing signing certificate.");
        Set<String> result = new HashSet<>();
        for (Signature s : signatures) result.add(hex(MessageDigest.getInstance("SHA-256").digest(s.toByteArray())));
        return result;
    }
    private static String hex(byte[] bytes) {
        StringBuilder result = new StringBuilder(bytes.length * 2);
        for (byte value : bytes) result.append(String.format(Locale.ROOT, "%02x", value & 0xff));
        return result.toString();
    }
    void check() {
        if (!busy.compareAndSet(false, true)) return;
        cancelled.set(false);
        Toast.makeText(activity, "Checking secure Mezgeb updates…", Toast.LENGTH_SHORT).show();
        executor.execute(() -> {
            try {
                JSONObject m = metadata();
                if (!m.optBoolean("available", false)) {
                    message("Mezgeb updates", "No verified native APK has been published. Your web interface updates separately.");
                    return;
                }
                String name = m.getString("versionName");
                long code = m.getLong("versionCode"), size = m.getLong("bytes");
                String path = m.getString("apkPath"), hash = m.getString("sha256");
                if (!name.matches("[0-9A-Za-z.\\-]{1,40}") || !path.matches("/releases/[A-Za-z0-9._-]+\\.apk")
                    || !hash.matches("[a-fA-F0-9]{64}") || size <= 0 || size > MAX_BYTES)
                    throw new Exception("The release metadata is invalid.");
                PackageInfo installed = activity.getPackageManager().getPackageInfo(activity.getPackageName(), signatureFlags());
                if (code <= version(installed)) { message("Mezgeb updates", "You already have the latest native version."); return; }
                ui(() -> new AlertDialog.Builder(activity).setTitle("Mezgeb " + name)
                    .setMessage("Download a verified update (" + String.format(Locale.ROOT, "%.1f MB", size / 1000000.0)
                        + ")? Your existing app and records will be preserved. Android will ask you to approve installation.")
                    .setNegativeButton("Later", null).setPositiveButton("Update", (dialog, which) -> {
                        if (!activity.getPackageManager().canRequestPackageInstalls()) {
                            new AlertDialog.Builder(activity).setTitle("Allow app updates")
                                .setMessage("Android requires your permission to install updates from Mezgeb. Enable it in Settings, then return and check for updates again.")
                                .setNegativeButton("Cancel", null).setPositiveButton("Open Settings", (d,w) -> {
                                    try { activity.startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + activity.getPackageName()))); }
                                    catch (Exception unavailable) { message("Update unavailable", "Android installation settings could not be opened."); }
                                }).show();
                            return;
                        }
                        download(path, hash, size, code);
                    }).show());
            } catch (Exception e) { message("Update unavailable", "Could not verify the native release. Please try again online."); }
            finally { busy.set(false); }
        });
    }
    private void download(String path, String expectedHash, long expectedBytes, long expectedVersion) {
        if (!busy.compareAndSet(false, true)) return;
        cancelled.set(false);
        LinearLayout content = new LinearLayout(activity); content.setOrientation(LinearLayout.VERTICAL);
        int pad = (int)(24 * activity.getResources().getDisplayMetrics().density);
        content.setPadding(pad,pad,pad,pad);
        TextView label = new TextView(activity); label.setText("Downloading secure update…");
        ProgressBar progress = new ProgressBar(activity,null,android.R.attr.progressBarStyleHorizontal);
        progress.setMax(100); content.addView(label); content.addView(progress);
        AlertDialog dialog = new AlertDialog.Builder(activity).setTitle("Mezgeb update").setView(content)
            .setNegativeButton("Cancel",(d,w)->cancelled.set(true)).setCancelable(false).create();
        dialog.show();
        executor.execute(() -> {
            File apk = null; int sessionId = -1; PackageInstaller installer = activity.getPackageManager().getPackageInstaller();
            try {
                apk = File.createTempFile("mezgeb-update-", ".apk", activity.getCacheDir());
                HttpsURLConnection c = connect(path);
                MessageDigest digest = MessageDigest.getInstance("SHA-256"); long count = 0;
                try (InputStream in = c.getInputStream(); FileOutputStream out = new FileOutputStream(apk)) {
                    byte[] buf = new byte[65536]; int n; int last = -1;
                    while ((n = in.read(buf)) != -1) {
                        if (cancelled.get() || Thread.currentThread().isInterrupted()) throw new Exception("Cancelled");
                        count += n; if (count > expectedBytes || count > MAX_BYTES) throw new Exception("Unexpected package size.");
                        digest.update(buf,0,n); out.write(buf,0,n);
                        int percent = (int)(count * 100 / expectedBytes);
                        if (percent != last) { last = percent; ui(() -> progress.setProgress(percent)); }
                    }
                } finally { c.disconnect(); }
                if (count != expectedBytes || !hex(digest.digest()).equalsIgnoreCase(expectedHash))
                    throw new Exception("Package integrity check failed.");
                ui(() -> label.setText("Verifying package identity and signature…"));
                PackageManager pm = activity.getPackageManager();
                PackageInfo current = pm.getPackageInfo(activity.getPackageName(), signatureFlags());
                PackageInfo candidate = pm.getPackageArchiveInfo(apk.getAbsolutePath(), signatureFlags());
                if (candidate == null || !activity.getPackageName().equals(candidate.packageName)
                    || version(candidate) != expectedVersion || version(candidate) <= version(current)
                    || !signatures(candidate).equals(signatures(current)))
                    throw new Exception("Package identity, version or signing certificate differs.");
                if (cancelled.get() || !active()) throw new Exception("Cancelled");
                PackageInstaller.SessionParams params = new PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL);
                params.setAppPackageName(activity.getPackageName()); params.setSize(expectedBytes);
                if (Build.VERSION.SDK_INT >= 31) params.setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_REQUIRED);
                sessionId = installer.createSession(params);
                try (PackageInstaller.Session session = installer.openSession(sessionId);
                     InputStream in = new java.io.FileInputStream(apk);
                     OutputStream out = session.openWrite("base.apk",0,expectedBytes)) {
                    byte[] buf = new byte[65536]; int n;
                    while ((n = in.read(buf)) != -1) { if (cancelled.get()) throw new Exception("Cancelled"); out.write(buf,0,n); }
                    session.fsync(out);
                    // The stream must be closed before commit.
                }
                if (cancelled.get() || !active()) throw new Exception("Cancelled");
                try (PackageInstaller.Session session = installer.openSession(sessionId)) {
                    Intent result = new Intent(activity, UpdateResultReceiver.class);
                    PendingIntent pending = PendingIntent.getBroadcast(activity, sessionId, result,
                        PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_MUTABLE : 0));
                    session.commit(pending.getIntentSender()); sessionId = -1;
                }
                ui(dialog::dismiss);
            } catch (Exception e) {
                if (sessionId >= 0) { try { installer.abandonSession(sessionId); } catch (Exception ignored) {} }
                ui(dialog::dismiss);
                if (!cancelled.get()) message("Update not installed", "The package could not be verified or installed. Your existing app and data have not been replaced.");
            } finally {
                if (apk != null) apk.delete(); busy.set(false);
            }
        });
    }
}
