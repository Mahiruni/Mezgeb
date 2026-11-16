package com.hisabtechnologies.mezgeb;
import android.content.Context;
import android.net.Uri;
import android.webkit.WebResourceResponse;
import java.io.InputStream;
import java.io.ByteArrayInputStream;
import java.util.Map;
import java.util.Set;
import java.util.HashMap;
/** Read-only signed APK assets, served under the existing HTTPS ledger origin. */
final class BundledUi {
    static final String HOST="mezgeb-omega.vercel.app";
    static final String PREFIX="/__mezgeb_native__/1.1.0";
    static final String START="https://"+HOST+PREFIX+"/";
    private static final Set<String> PAGES=new java.util.HashSet<>(java.util.Arrays.asList("/","/ledger","/receipts","/reports","/dube","/settings","/plans","/account","/settings-business","/settings-language","/settings-appearance","/settings-tax","/settings-security","/settings-cloud","/settings-backup","/settings-updates","/settings-help","/settings-about","/auth","/auth/status","/auth/update-password","/privacy"));
    static boolean isLocal(Uri u) {return "https".equalsIgnoreCase(u.getScheme())&&HOST.equalsIgnoreCase(u.getHost())&&(u.getPort()==-1||u.getPort()==443)&&u.getPath()!=null&&u.getPath().startsWith(PREFIX+"/");}
    static WebResourceResponse response(Context context,Uri u,String method){
        if(!"GET".equals(method)||!isLocal(u))return null;
        String path=u.getPath().substring(PREFIX.length());
        String asset,mime,encoding=null;
        if(PAGES.contains(path)){asset="index.html";mime="text/html";encoding="UTF-8";}
        else if(path.equals("/app.js")){asset="app.js";mime="application/javascript";encoding="UTF-8";}
        else if(path.equals("/app.css")){asset="app.css";mime="text/css";encoding="UTF-8";}
        else if(path.matches("/fonts/[A-Za-z0-9._-]+\\.(woff2|woff|ttf)")){asset=path.substring(1);mime=path.endsWith(".woff2")?"font/woff2":path.endsWith(".woff")?"font/woff":"font/ttf";}
        else return error(404,"Not Found");
        try {
            InputStream in=context.getAssets().open("mezgeb-ui/"+asset);
            Map<String,String> headers=new HashMap<>();headers.put("Cache-Control","no-store");headers.put("X-Content-Type-Options","nosniff");
            return new WebResourceResponse(mime,encoding,200,"OK",headers,in);
        } catch(Exception e){return error(503,"Bundled interface unavailable");}
    }
    private static WebResourceResponse error(int code,String reason){return new WebResourceResponse("text/plain","UTF-8",code,reason,java.util.Collections.singletonMap("Cache-Control","no-store"),new ByteArrayInputStream(reason.getBytes(java.nio.charset.StandardCharsets.UTF_8)));}
}
