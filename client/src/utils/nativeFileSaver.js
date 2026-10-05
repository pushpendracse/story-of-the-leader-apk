import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

export const saveReelVideo = async (blob, preferredExt = 'mp4') => {
    const timestamp = Date.now();
    // Universal extension: MP4 is supported natively on Android, iOS/iPhone, WhatsApp, Instagram, and PC
    let ext = preferredExt;
    if (!ext) {
        ext = blob.type?.includes('webm') && !blob.type?.includes('h264') ? 'webm' : 'mp4';
    }
    const fileName = `STORY_REEL_${timestamp}.${ext}`;

    if (Capacitor.isNativePlatform()) {
        try {
            const reader = new FileReader();
            const base64Promise = new Promise((resolve, reject) => {
                reader.onloadend = () => {
                    const res = reader.result;
                    const base64 = typeof res === 'string' && res.includes(',') ? res.split(',')[1] : res;
                    resolve(base64);
                };
                reader.onerror = reject;
            });
            reader.readAsDataURL(blob);
            const base64Data = await base64Promise;

            if (!base64Data) {
                alert("Debug: Base64 data is empty!");
                return { success: false };
            }

            // Detect if video is too large for the JS Bridge (typically > 2MB causes issues on older devices)
            const isLargeFile = base64Data.length > 2000000; 

            let writeResult;
            
            if (isLargeFile) {
                // Safely chunk the file
                const CHUNK_SIZE = 1048576; // exactly 1MB (multiple of 4)
                for (let i = 0; i < base64Data.length; i += CHUNK_SIZE) {
                    const chunk = base64Data.slice(i, i + CHUNK_SIZE);
                    if (i === 0) {
                        writeResult = await Filesystem.writeFile({
                            path: fileName,
                            data: chunk,
                            directory: 'CACHE'
                        });
                    } else {
                        await Filesystem.appendFile({
                            path: fileName,
                            data: chunk,
                            directory: 'CACHE'
                        });
                    }
                }
            } else {
                // 1. Save to Cache directory for reliable sharing
                writeResult = await Filesystem.writeFile({
                    path: fileName,
                    data: base64Data,
                    directory: 'CACHE' 
                });
            }

            // Removed redundant Share.share from here. It is handled by App.jsx!
            
            return { success: true, uri: writeResult.uri, fileName };
        } catch (error) {
            console.error("Capacitor native save error:", error);
            alert("Studio Error: Failed to save video to device. " + (error.message || JSON.stringify(error)));
        }
    }

    // Web fallback (Browser / Mobile Chrome direct download)
    try {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            if (a.parentNode) document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }, 2500);
        return { success: true, downloaded: true, fileName };
    } catch (e) {
        console.error("Download fallback failed:", e);
        return { success: false, error: e.message };
    }
};
