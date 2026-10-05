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
        String sourcePath = call.getString("sourcePath");
        String fileName = call.getString("fileName");
        
        if (sourcePath == null || fileName == null) {
            call.reject("Missing sourcePath or fileName");
            return;
        }
        
        try {
            // sourcePath is expected to be a local file path (e.g. from Filesystem plugin)
            // Strip "file://" prefix if present
            if (sourcePath.startsWith("file://")) {
                sourcePath = sourcePath.substring(7);
            }
            
            java.io.File sourceFile = new java.io.File(sourcePath);
            if (!sourceFile.exists()) {
                call.reject("Source file does not exist at path: " + sourcePath);
                return;
            }

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
                java.io.FileInputStream fis = new java.io.FileInputStream(sourceFile);
                
                if (os != null) {
                    byte[] buffer = new byte[8192];
                    int length;
                    while ((length = fis.read(buffer)) > 0) {
                        os.write(buffer, 0, length);
                    }
                    fis.close();
                    os.close();
                    
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        values.clear();
                        values.put(MediaStore.Video.Media.IS_PENDING, 0);
                        getContext().getContentResolver().update(uri, values, null, null);
                    }
                    
                    // Optionally delete the source cache file
                    sourceFile.delete();
                    
                    call.resolve();
                } else {
                    fis.close();
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
