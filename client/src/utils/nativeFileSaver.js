import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

export const saveReelVideo = async (blob) => {
    const timestamp = Date.now();
    const fileName = `STORY_REEL_${timestamp}.webm`;

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

            const writeResult = await Filesystem.writeFile({
                path: fileName,
                data: base64Data,
                directory: Directory.Cache
            });

            const canShare = await Share.canShare().then(r => r.value).catch(() => false);
            if (canShare) {
                await Share.share({
                    title: 'Story Reel',
                    text: 'Your generated story reel video is ready!',
                    url: writeResult.uri,
                    dialogTitle: 'Save or Share Reel'
                });
            }
            return { success: true, uri: writeResult.uri };
        } catch (error) {
            console.error("Capacitor native save error, using browser fallback:", error);
        }
    }

    // Web fallback
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
        }, 1500);
        return { success: true, downloaded: true };
    } catch (e) {
        console.error("Download fallback failed:", e);
        return { success: false, error: e.message };
    }
};
