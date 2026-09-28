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

            // 1. Save to Cache directory for instant system sharing
            const writeResult = await Filesystem.writeFile({
                path: fileName,
                data: base64Data,
                directory: Directory.Cache
            });

            // 2. Also save to Documents directory for permanent device storage
            try {
                await Filesystem.writeFile({
                    path: `StoryOfTheLeader/${fileName}`,
                    data: base64Data,
                    directory: Directory.Documents,
                    recursive: true
                });
            } catch (storageErr) {
                console.log("Documents directory save optional notice:", storageErr);
            }

            // 3. Open Native Share sheet so user can save directly to Gallery, WhatsApp, or Drive
            const canShare = await Share.canShare().then(r => r.value).catch(() => false);
            if (canShare) {
                await Share.share({
                    title: 'Story of the Leader - HD Reel',
                    text: 'Your 1080p HD vertical story reel is ready!',
                    url: writeResult.uri,
                    dialogTitle: 'Save Video to Gallery / Share'
                });
            }
            return { success: true, uri: writeResult.uri, fileName };
        } catch (error) {
            console.error("Capacitor native save error, using browser fallback:", error);
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
