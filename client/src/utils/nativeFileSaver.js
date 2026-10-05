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
            const CHUNK_SIZE = 3 * 1024 * 1024; // 3MB chunks (must be multiple of 3 bytes for flawless base64 concatenation)
            let offset = 0;

            while (offset < blob.size) {
                const chunk = blob.slice(offset, offset + CHUNK_SIZE);
                const chunkBase64 = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        const res = reader.result;
                        resolve(typeof res === 'string' && res.includes(',') ? res.split(',')[1] : res);
                    };
                    reader.onerror = reject;
                    reader.readAsDataURL(chunk);
                });
                
                await Filesystem.appendFile({
                    path: fileName,
                    data: chunkBase64,
                    directory: Directory.Cache
                });
                offset += CHUNK_SIZE;
            }

            const stat = await Filesystem.getUri({
                path: fileName,
                directory: Directory.Cache
            });

            // Call our custom native Android plugin to copy from Cache to public Movies/Gallery
            await MediaSaver.saveVideo({ sourcePath: stat.uri, fileName: fileName });

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
