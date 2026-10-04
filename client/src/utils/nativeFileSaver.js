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

            // 1. Save to App Data directory for reliable cross-app sharing (WhatsApp)
            const CHUNK_SIZE = 1024 * 1024 * 2;
            let finalUri = null;
            
            for (let i = 0; i < base64Data.length; i += CHUNK_SIZE) {
                const chunk = base64Data.slice(i, i + CHUNK_SIZE);
                if (i === 0) {
                    const writeResult = await Filesystem.writeFile({
                        path: fileName,
                        data: chunk,
                        directory: 'DATA'
                    });
                    finalUri = writeResult.uri;
                } else {
                    await Filesystem.appendFile({
                        path: fileName,
                        data: chunk,
                        directory: 'DATA'
                    });
                }
            }

            // 2. Also save to Documents directory for permanent device storage
            try {
                await Filesystem.writeFile({
                    path: fileName,
                    data: base64Data, // Save the whole thing to Documents directly
                    directory: 'DOCUMENTS'
                });
            } catch (storageErr) {
                console.log("Documents save notice:", storageErr);
            }

            // 3. Open Native Share sheet so user can save directly to Gallery, WhatsApp, or Drive
            const canShare = await Share.canShare().then(r => r.value).catch(() => false);
            if (canShare) {
                try {
                    await Share.share({
                        title: 'Story of the Leader - HD Reel',
                        text: 'Your 1080p HD vertical story reel is ready!',
                        url: finalUri,
                        dialogTitle: 'Save Video to Gallery / Share'
                    });
                } catch (shareErr) {
                    console.log("Share sheet dismissed or error:", shareErr);
                }
            }
            return { success: true, uri: finalUri, fileName };
        } catch (error) {
            console.error("Capacitor native save error, using browser fallback:", error);
            // Alert user so we actually know if it failed here instead of silently falling back
            alert("Studio Error: Failed to save video to device. " + error.message);
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
