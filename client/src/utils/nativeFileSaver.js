import { Capacitor, registerPlugin } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';

const MediaSaver = registerPlugin('MediaSaver');

export const saveReelVideo = async (blob, preferredExt = 'mp4') => {
    const timestamp = Date.now();
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
                alert("Debug: Empty Base64 data");
                return { success: false, error: "Empty Base64 data" };
            }

            // Call our custom native Android plugin to save directly to public Movies/Gallery
            await MediaSaver.saveVideo({ base64Data: base64Data, fileName: fileName });

            return { success: true, uri: 'gallery', fileName };
        } catch (error) {
            console.error("Capacitor native save error:", error);
            alert("Studio Error: Failed to save video to device gallery. " + (error.message || JSON.stringify(error)));
            return { success: false, error: error.message };
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
