package com.hisabtechnologies.mezgeb;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.webkit.WebView;
import android.widget.Toast;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import androidx.webkit.JavaScriptReplyProxy;
import org.json.JSONObject;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Collections;

/** Origin-restricted, user-confirmed export to Android's document provider. */
final class LedgerExport {
    static final int REQUEST = 72;
    private static final int MAX = 25_000_000;
    private final Activity activity;
    private Pending pending;
    private boolean closed;
    private static final class Pending {
        final byte[] bytes; final String id; final JavaScriptReplyProxy reply;
        Pending(byte[] bytes, String id, JavaScriptReplyProxy reply) {
            this.bytes=bytes; this.id=id; this.reply=reply;
        }
    }
    LedgerExport(Activity activity) { this.activity=activity; }
    void attach(WebView view) {
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) return;
        WebViewCompat.addWebMessageListener(view, "MezgebExport",
            Collections.singleton("https://mezgeb-omega.vercel.app"),
            (webView,message,origin,mainFrame,reply) -> {
                if (!mainFrame || !"https".equals(origin.getScheme())
                    || !"mezgeb-omega.vercel.app".equals(origin.getHost())
                    || (origin.getPort()!=-1 && origin.getPort()!=443)) return;
                String raw=message.getData();
                if(raw==null || raw.length()>MAX+4096) {respond(reply,"","error","Backup exceeds the 25 MB limit.");return;}
                String id="";
                try {
                    JSONObject request=new JSONObject(raw);
                    id=request.getString("id");
                    String name=request.getString("name"),mime=request.getString("mime"),content=request.getString("content");
                    if(!id.matches("[A-Za-z0-9-]{1,80}")
                        || !name.matches("mezgeb-[A-Za-z0-9._-]{1,100}\\.(json|csv)")
                        || !(("application/json".equals(mime)&&name.endsWith(".json"))||("text/csv".equals(mime)&&name.endsWith(".csv"))))
                        throw new Exception("Unsupported export.");
                    byte[] bytes=content.getBytes(StandardCharsets.UTF_8);
                    if(bytes.length==0||bytes.length>MAX)throw new Exception("Backup exceeds the 25 MB limit.");
                    if(pending!=null)throw new Exception("Another export is already open.");
                    if(closed||activity.isFinishing())throw new Exception("App is closing.");
                    pending=new Pending(bytes,id,reply);
                    Intent pick=new Intent(Intent.ACTION_CREATE_DOCUMENT);
                    pick.addCategory(Intent.CATEGORY_OPENABLE);
                    pick.setType(mime);pick.putExtra(Intent.EXTRA_TITLE,name);
                    try {activity.startActivityForResult(pick,REQUEST);}
                    catch(Exception e){pending=null;throw new Exception("No document provider is available.");}
                }catch(Exception e){respond(reply,id,"error",e.getMessage()==null?"Export could not start.":e.getMessage());}
            });
    }
    void result(int resultCode, Intent data) {
        Pending item=pending;
        if(item==null)return;
        if(resultCode!=Activity.RESULT_OK||data==null||data.getData()==null){
            pending=null;respond(item.reply,item.id,"cancelled","No backup was saved.");return;
        }
        Uri destination=data.getData();
        if(!"content".equals(destination.getScheme())){
            pending=null;respond(item.reply,item.id,"error","Invalid document destination.");return;
        }
        new Thread(() -> {
            String status="saved",message="Backup saved successfully.";
            try(OutputStream output=activity.getContentResolver().openOutputStream(destination,"w")){
                if(output==null)throw new Exception("Cannot open destination");
                output.write(item.bytes);output.flush();
            }catch(Exception e){status="error";message="Could not save the backup. Check the destination and retry.";}
            final String result=status, detail=message;
            activity.runOnUiThread(()->{
                pending=null;
                if(!closed&&!activity.isFinishing()){
                    respond(item.reply,item.id,result,detail);
                    Toast.makeText(activity,detail,Toast.LENGTH_LONG).show();
                }
            });
        },"MezgebBackupWriter").start();
    }
    void close(){closed=true;if(pending!=null){respond(pending.reply,pending.id,"cancelled","Export interrupted.");pending=null;}}
    private static void respond(JavaScriptReplyProxy reply,String id,String status,String message){
        try {reply.postMessage(new JSONObject().put("id",id).put("status",status).put("message",message).toString());}
        catch(Exception ignored){}
    }
}
