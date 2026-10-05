package com.story.leader;

import com.getcapacitor.Plugin;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.PluginCall;
import android.content.ContentValues;
import android.os.Environment;
import android.provider.MediaStore;
import android.net.Uri;
import java.io.OutputStream;
import android.util.Base64;
import android.os.Build;

@CapacitorPlugin(name = "MediaSaver")
public class MediaSaverPlugin extends Plugin {
    @PluginMethod
    public void saveVideo(PluginCall call) {
        String base64Data = call.getString("base64Data");
        String fileName = call.getString("fileName");
        
        if (base64Data == null || fileName == null) {
            call.reject("Missing base64Data or fileName");
            return;
        }
        
        try {
            byte[] videoBytes = Base64.decode(base64Data, Base64.DEFAULT);
            ContentValues values = new ContentValues();
            values.put(MediaStore.Video.Media.DISPLAY_NAME, fileName);
            values.put(MediaStore.Video.Media.MIME_TYPE, "video/mp4");
            
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                values.put(MediaStore.Video.Media.RELATIVE_PATH, Environment.DIRECTORY_MOVIES + "/StoryOfTheLeader");
                values.put(MediaStore.Video.Media.IS_PENDING, 1);
            }

            Uri collection = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
                    ? MediaStore.Video.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY)
                    : MediaStore.Video.Media.EXTERNAL_CONTENT_URI;
                    
            Uri uri = getContext().getContentResolver().insert(collection, values);
            if (uri != null) {
                OutputStream os = getContext().getContentResolver().openOutputStream(uri);
                if (os != null) {
                    os.write(videoBytes);
                    os.close();
                    
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        values.clear();
                        values.put(MediaStore.Video.Media.IS_PENDING, 0);
                        getContext().getContentResolver().update(uri, values, null, null);
                    }
                    
                    call.resolve();
                } else {
                    call.reject("Could not open output stream");
                }
            } else {
                call.reject("Could not create MediaStore entry");
            }
        } catch (Exception e) {
            e.printStackTrace();
            call.reject(e.getMessage());
        }
    }
}
