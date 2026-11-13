package app.memovida;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowInsets;
import android.webkit.GeolocationPermissions;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;

/**
 * MemoVida · contenedor Android.
 *
 * La aplicación vive en assets/public (la demo estática) y se sirve desde el
 * origen seguro https://appassets.local interceptando las peticiones, sin
 * dependencias de AndroidX ni de Gradle. Funciona sin conexión: la base de
 * datos se guarda en el localStorage del WebView.
 */
public class MainActivity extends Activity {

    private static final String HOST = "appassets.local";
    private static final String BASE = "https://" + HOST + "/";
    private static final int REQ_LOCATION = 10;

    private WebView web;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(Color.parseColor("#1f6f5c"));
        getWindow().setNavigationBarColor(Color.parseColor("#1f6f5c"));

        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#f7f3ec"));

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setGeolocationEnabled(true);
        s.setLoadWithOverviewMode(false);
        s.setUseWideViewPort(true);
        s.setSupportMultipleWindows(false);
        s.setJavaScriptCanOpenWindowsAutomatically(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setMediaPlaybackRequiresUserGesture(false);

        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
                Uri u = req.getUrl();
                if (u == null || !HOST.equals(u.getHost())) return null;
                String path = u.getPath();
                if (path == null || path.equals("/") || path.isEmpty()) path = "/index.html";

                // Evita salir de assets/public
                if (path.contains("..")) return notFound();

                try {
                    InputStream in = getAssets().open("public" + path);
                    return new WebResourceResponse(mimeOf(path), charsetOf(path), in);
                } catch (IOException missing) {
                    if (path.lastIndexOf('.') < 0) {
                        try {
                            return new WebResourceResponse("text/html", "utf-8",
                                    getAssets().open("public/index.html"));
                        } catch (IOException ignored) { /* cae abajo */ }
                    }
                    return notFound();
                }
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                Uri u = req.getUrl();
                if (u == null) return false;
                if (HOST.equals(u.getHost())) return false;
                String scheme = u.getScheme() == null ? "" : u.getScheme();
                if (scheme.equals("http") || scheme.equals("https")
                        || scheme.equals("tel") || scheme.equals("mailto") || scheme.equals("sms")) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception ignored) { /* noop */ }
                    return true;
                }
                return false;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                view.setVisibility(View.VISIBLE);
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback cb) {
                boolean granted = checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)
                        == PackageManager.PERMISSION_GRANTED;
                cb.invoke(origin, granted, false);
            }
        });

        if (Build.VERSION.SDK_INT >= 30) {
            web.setOnApplyWindowInsetsListener((v, insets) -> {
                android.graphics.Insets bars = insets.getInsets(
                        WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                v.setPadding(bars.left, bars.top, bars.right, bars.bottom);
                return insets;
            });
        } else {
            web.setOnApplyWindowInsetsListener((v, insets) -> {
                v.setPadding(0, insets.getSystemWindowInsetTop(), 0, insets.getSystemWindowInsetBottom());
                return insets;
            });
        }

        setContentView(web);

        if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION
            }, REQ_LOCATION);
        }

        if (state != null) {
            web.restoreState(state);
        } else {
            web.loadUrl(BASE + "index.html");
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        if (web != null) web.saveState(out);
    }

    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    private static WebResourceResponse notFound() {
        return new WebResourceResponse("text/plain", "utf-8",
                new ByteArrayInputStream("404".getBytes()));
    }

    private static String mimeOf(String path) {
        String p = path.toLowerCase();
        if (p.endsWith(".html")) return "text/html";
        if (p.endsWith(".css")) return "text/css";
        if (p.endsWith(".js") || p.endsWith(".mjs")) return "text/javascript";
        if (p.endsWith(".json")) return "application/json";
        if (p.endsWith(".webmanifest")) return "application/manifest+json";
        if (p.endsWith(".svg")) return "image/svg+xml";
        if (p.endsWith(".png")) return "image/png";
        if (p.endsWith(".jpg") || p.endsWith(".jpeg")) return "image/jpeg";
        if (p.endsWith(".webp")) return "image/webp";
        if (p.endsWith(".gif")) return "image/gif";
        if (p.endsWith(".ico")) return "image/x-icon";
        if (p.endsWith(".woff2")) return "font/woff2";
        if (p.endsWith(".mp3")) return "audio/mpeg";
        if (p.endsWith(".wav")) return "audio/wav";
        return "application/octet-stream";
    }

    private static String charsetOf(String path) {
        String m = mimeOf(path);
        return m.startsWith("text/") || m.equals("application/json")
                || m.equals("image/svg+xml") || m.equals("text/javascript")
                ? "utf-8" : null;
    }
}
