package com.hisabtechnologies.mezgeb;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInstaller;
import android.os.Build;
import android.widget.Toast;

public final class UpdateResultReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context, Intent result) {
        int status = result.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE);
        if (status == PackageInstaller.STATUS_PENDING_USER_ACTION) {
            Intent confirmation = Build.VERSION.SDK_INT >= 33
                ? result.getParcelableExtra(Intent.EXTRA_INTENT, Intent.class)
                : result.getParcelableExtra(Intent.EXTRA_INTENT);
            if (confirmation != null) {
                confirmation.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                try { context.startActivity(confirmation); }
                catch (Exception ignored) { Toast.makeText(context,"Open Mezgeb to retry the update.",Toast.LENGTH_LONG).show(); }
            }
        } else if (status == PackageInstaller.STATUS_SUCCESS) {
            Toast.makeText(context,"Mezgeb update installed.",Toast.LENGTH_SHORT).show();
        } else {
            Toast.makeText(context,"Mezgeb update was not installed. Your existing app is unchanged.",Toast.LENGTH_LONG).show();
        }
    }
}
