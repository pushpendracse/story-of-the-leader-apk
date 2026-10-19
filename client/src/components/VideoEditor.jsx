import React, { useState, useRef, useEffect } from 'react';
import { saveReelVideo } from '../utils/nativeFileSaver';
import { Capacitor } from '@capacitor/core';

const VideoEditor = ({ onClose }) => {
    const [videoSrc, setVideoSrc] = useState(null);
    const [videoFile, setVideoFile] = useState(null);
    const [frameColor, setFrameColor] = useState('#ff0000');
    const [frameWidth, setFrameWidth] = useState(20);
    const [frameStyle, setFrameStyle] = useState('classic');
    const [videoFilter, setVideoFilter] = useState('none');
    const [topText, setTopText] = useState('BREAKING NEWS');
    const [bottomText, setBottomText] = useState('STORY OF THE LEADER EXCLUSIVE');
    const [isExporting, setIsExporting] = useState(false);
    const [exportProgress, setExportProgress] = useState(0);
    const [exportedVideoUrl, setExportedVideoUrl] = useState(null);

    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const animationFrameRef = useRef(null);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setVideoFile(file);
            setVideoSrc(URL.createObjectURL(file));
            setExportedVideoUrl(null);
        }
    };

    const drawFrame = () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas) return;

        const ctx = canvas.getContext('2d');
        if (video.videoWidth > 0 && video.videoHeight > 0) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
        } else {
            canvas.width = 1080;
            canvas.height = 1920;
        }

        const render = () => {
            // Always request next frame to keep animations running even if paused
            drawCanvasContent(ctx, canvas, video);
            
            // Only stop if we are exporting, export has its own render loop
            if (!isExporting) {
                animationFrameRef.current = requestAnimationFrame(render);
            }
        };
        
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        render();
    };

    const drawCanvasContent = (ctx, canvas, video) => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        let timeInSeconds = video.currentTime;
        if (video.paused && !isExporting) {
            timeInSeconds = performance.now() / 1000;
        }
        
        // Apply Video Filter
        if (videoFilter === 'grayscale') ctx.filter = 'grayscale(100%)';
        else if (videoFilter === 'sepia') ctx.filter = 'sepia(100%)';
        else if (videoFilter === 'contrast') ctx.filter = 'contrast(150%) brightness(110%)';
        else ctx.filter = 'none';

        // Draw Video
        if (video.readyState >= 2) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        } else {
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        // Reset filter for UI overlay so text/frames aren't affected
        ctx.filter = 'none';

        const barHeight = canvas.height * 0.08;
        ctx.textBaseline = 'middle';
        
        const textWidth = ctx.measureText(bottomText).width;
        const speed = canvas.width * 0.3;
        const xOffset = canvas.width - ((timeInSeconds * speed) % (canvas.width + textWidth * 3)); // *3 for safety margin
        const isFlashingOn = Math.floor(timeInSeconds * 2) % 2 === 0;

        if (frameStyle === 'classic') {
            // Draw Frame
            ctx.strokeStyle = frameColor;
            ctx.lineWidth = frameWidth * 2; 
            ctx.strokeRect(0, 0, canvas.width, canvas.height);

            // Draw Top Text Bar
            ctx.fillStyle = frameColor;
            ctx.fillRect(0, 0, canvas.width, barHeight);
            
            ctx.fillStyle = '#ffffff';
            ctx.font = `bold ${barHeight * 0.5}px sans-serif`;
            ctx.textAlign = 'left';
            ctx.fillText(topText, canvas.width * 0.05, barHeight / 2);

            // Flashing "LIVE" Badge
            if (isFlashingOn) {
                ctx.fillStyle = '#ff0000';
                const badgeWidth = canvas.width * 0.15;
                const badgeHeight = barHeight * 0.6;
                const badgeX = canvas.width - badgeWidth - (canvas.width * 0.05);
                const badgeY = (barHeight - badgeHeight) / 2;
                ctx.fillRect(badgeX, badgeY, badgeWidth, badgeHeight);
                ctx.fillStyle = '#ffffff';
                ctx.font = `bold ${badgeHeight * 0.6}px sans-serif`;
                ctx.textAlign = 'center';
                ctx.fillText("LIVE", badgeX + badgeWidth / 2, badgeY + badgeHeight / 2);
            }

            // Draw Bottom Text Bar
            ctx.fillStyle = frameColor;
            ctx.fillRect(0, canvas.height - barHeight, canvas.width, barHeight);
            ctx.fillStyle = '#ffffff';
            ctx.font = `bold ${barHeight * 0.45}px sans-serif`;
            ctx.textAlign = 'left';
            ctx.fillText(bottomText, xOffset, canvas.height - barHeight / 2);

        } else if (frameStyle === 'modern') {
            // Gradient Overlay instead of thick borders
            const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
            grad.addColorStop(0, 'rgba(0,0,0,0.8)');
            grad.addColorStop(0.15, 'rgba(0,0,0,0)');
            grad.addColorStop(0.85, 'rgba(0,0,0,0)');
            grad.addColorStop(1, 'rgba(0,0,0,0.9)');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Modern Top Bar
            ctx.fillStyle = '#ffffff';
            ctx.font = `bold ${barHeight * 0.6}px Arial, sans-serif`;
            ctx.textAlign = 'left';
            ctx.fillText(topText, canvas.width * 0.05, barHeight * 0.6);

            // Modern LIVE badge (rounded)
            if (isFlashingOn) {
                ctx.fillStyle = '#ff0000';
                const badgeWidth = canvas.width * 0.15;
                const badgeHeight = barHeight * 0.6;
                const badgeX = canvas.width - badgeWidth - (canvas.width * 0.05);
                const badgeY = barHeight * 0.3;
                
                ctx.beginPath();
                ctx.roundRect ? ctx.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, badgeHeight/2) : ctx.fillRect(badgeX, badgeY, badgeWidth, badgeHeight);
                ctx.fill();
                
                ctx.fillStyle = '#ffffff';
                ctx.font = `bold ${badgeHeight * 0.6}px sans-serif`;
                ctx.textAlign = 'center';
                ctx.fillText("LIVE", badgeX + badgeWidth / 2, badgeY + badgeHeight / 2);
            }

            // Modern Bottom Ticker
            ctx.fillStyle = frameColor;
            ctx.fillRect(0, canvas.height - barHeight * 1.2, canvas.width, barHeight * 1.2);
            
            // Breaking badge in the ticker
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, canvas.height - barHeight * 1.2, canvas.width * 0.3, barHeight * 1.2);
            ctx.fillStyle = '#000000';
            ctx.font = `900 ${barHeight * 0.45}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText("UPDATE", canvas.width * 0.15, canvas.height - barHeight * 0.6);

            // Ticker text
            ctx.fillStyle = '#ffffff';
            ctx.font = `600 ${barHeight * 0.5}px sans-serif`;
            ctx.textAlign = 'left';
            
            ctx.save();
            ctx.beginPath();
            ctx.rect(canvas.width * 0.3, canvas.height - barHeight * 1.2, canvas.width * 0.7, barHeight * 1.2);
            ctx.clip();
            ctx.fillText(bottomText, xOffset, canvas.height - barHeight * 0.6);
            ctx.restore();

        } else if (frameStyle === 'breaking') {
            // Breaking News Style (Yellow & Red)
            ctx.strokeStyle = '#ff0000';
            ctx.lineWidth = frameWidth * 2; 
            ctx.strokeRect(0, 0, canvas.width, canvas.height);

            // Huge Breaking News Header
            ctx.fillStyle = '#cc0000';
            ctx.fillRect(0, 0, canvas.width, barHeight * 1.5);
            ctx.fillStyle = '#ffffff';
            ctx.font = `900 ${barHeight * 0.8}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText("BREAKING NEWS", canvas.width / 2, barHeight * 0.75);

            // Sub Header
            ctx.fillStyle = 'rgba(0,0,0,0.7)';
            ctx.fillRect(0, barHeight * 1.5, canvas.width, barHeight * 0.8);
            ctx.fillStyle = '#ffff00';
            ctx.font = `bold ${barHeight * 0.4}px sans-serif`;
            ctx.fillText(topText, canvas.width / 2, barHeight * 1.9);

            // Bottom Ticker
            ctx.fillStyle = '#ffff00';
            ctx.fillRect(0, canvas.height - barHeight, canvas.width, barHeight);
            ctx.fillStyle = '#000000';
            ctx.font = `900 ${barHeight * 0.5}px sans-serif`;
            ctx.textAlign = 'left';
            ctx.fillText(bottomText, xOffset, canvas.height - barHeight / 2);
        }
    };

    // Ensure preview updates when settings change
    useEffect(() => {
        if (videoRef.current && videoSrc) {
            const video = videoRef.current;
            video.addEventListener('loadeddata', () => {
                video.play().then(() => {
                    video.pause();
                    drawFrame(); // Draw initial preview frame
                }).catch(e => console.log(e));
            }, { once: true });
        }
    }, [videoSrc]);

    useEffect(() => {
        if (videoRef.current && canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d');
            drawCanvasContent(ctx, canvasRef.current, videoRef.current);
        }
    }, [frameColor, frameWidth, topText, bottomText, frameStyle, videoFilter]);

    const handleExport = async () => {
        if (!videoRef.current || !videoSrc) return;
        setIsExporting(true);
        setExportProgress(0);

        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        
        // Setup Audio Context to capture original video audio
        let audioContext = null;
        let dest = null;
        let source = null;
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            source = audioContext.createMediaElementSource(video);
            dest = audioContext.createMediaStreamDestination();
            source.connect(dest);
            source.connect(audioContext.destination); // to hear it while recording
        } catch(e) {
            console.log("Audio capture error:", e);
        }

        const canvasStream = canvas.captureStream(30);
        let finalStream = canvasStream;
        
        if (dest && dest.stream.getAudioTracks().length > 0) {
            finalStream = new MediaStream([
                ...canvasStream.getVideoTracks(),
                ...dest.stream.getAudioTracks()
            ]);
        }

        // Reset video to start
        video.currentTime = 0;
        
        const chunks = [];
        const recorder = new MediaRecorder(finalStream, {
            videoBitsPerSecond: 5000000,
            mimeType: 'video/webm;codecs=vp8' // Using webm as it's universally supported by Chrome/Android Canvas MediaRecorder
        });

        recorder.ondataavailable = e => {
            if (e.data.size > 0) chunks.push(e.data);
        };

        recorder.onstop = () => {
            const blob = new Blob(chunks, { type: 'video/mp4' }); // We can spoof mp4 for compatibility or let native FileSaver handle it
            const url = URL.createObjectURL(blob);
            setExportedVideoUrl(url);
            setIsExporting(false);
            
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
            
            if (audioContext) {
                audioContext.close();
            }
        };

        // Start playback and recording
        recorder.start(100);
        mediaRecorderRef.current = recorder;
        video.play();

        const duration = video.duration || 10;
        
        const renderExport = () => {
            drawCanvasContent(ctx, canvas, video);
            setExportProgress(Math.min(100, Math.floor((video.currentTime / duration) * 100)));
            
            if (video.ended) {
                recorder.stop();
            } else {
                animationFrameRef.current = requestAnimationFrame(renderExport);
            }
        };
        
        animationFrameRef.current = requestAnimationFrame(renderExport);
    };

    const downloadVideo = async () => {
        if (!exportedVideoUrl) return;
        
        if (Capacitor.isNativePlatform()) {
            try {
                // Fetch blob from URL to pass to native file saver
                const response = await fetch(exportedVideoUrl);
                const blob = await response.blob();
                await saveReelVideo(blob, 'mp4');
                alert("Saved to Gallery!");
            } catch (e) {
                console.error(e);
                fallbackDownload();
            }
        } else {
            fallbackDownload();
        }
    };

    const fallbackDownload = () => {
        const a = document.createElement('a');
        a.href = exportedVideoUrl;
        a.download = `Framed_News_Video_${Date.now()}.mp4`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    return (
        <div className="flex flex-col md:flex-row w-full h-full bg-slate-900 text-white overflow-hidden">
            {/* Control Panel */}
            <div className="w-full md:w-96 bg-black border-r border-neutral-800 p-6 flex flex-col gap-6 overflow-y-auto">
                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-black uppercase text-yellow-500">News Video Framer</h2>
                    <button onClick={onClose} className="text-neutral-500 hover:text-white">✕</button>
                </div>

                <div className="space-y-4">
                    {/* Video Upload */}
                    <div>
                        <label className="block text-xs font-bold text-neutral-400 mb-2 uppercase">1. Upload Video</label>
                        <input 
                            type="file" 
                            accept="video/*"
                            onChange={handleFileChange}
                            className="w-full text-sm text-neutral-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-bold file:bg-yellow-500 file:text-black hover:file:bg-yellow-400 transition-all"
                        />
                    </div>

                    {/* Frame Styles Picker */}
                    <div>
                        <label className="block text-xs font-bold text-neutral-400 mb-2 uppercase">2. Frame Style</label>
                        <div className="flex gap-2">
                            {['classic', 'modern', 'breaking'].map(s => (
                                <button 
                                    key={s} 
                                    onClick={() => setFrameStyle(s)} 
                                    className={`flex-1 py-2 rounded-lg text-xs font-bold capitalize transition-all ${frameStyle === s ? 'bg-yellow-500 text-black shadow-[0_0_15px_rgba(234,179,8,0.4)]' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'}`}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Video Filters */}
                    <div>
                        <label className="block text-xs font-bold text-neutral-400 mb-2 uppercase">3. Video Filter</label>
                        <div className="grid grid-cols-2 gap-2">
                            {['none', 'grayscale', 'sepia', 'contrast'].map(f => (
                                <button 
                                    key={f} 
                                    onClick={() => setVideoFilter(f)} 
                                    className={`py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${videoFilter === f ? 'bg-purple-600 text-white shadow-[0_0_15px_rgba(147,51,234,0.4)]' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'}`}
                                >
                                    {f}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Frame Color */}
                    <div>
                        <label className="block text-xs font-bold text-neutral-400 mb-2 uppercase">4. Brand Color</label>
                        <div className="flex gap-2">
                            <input 
                                type="color" 
                                value={frameColor}
                                onChange={(e) => setFrameColor(e.target.value)}
                                className="w-12 h-12 rounded cursor-pointer bg-transparent border-0 p-0"
                            />
                            <input 
                                type="text" 
                                value={frameColor}
                                onChange={(e) => setFrameColor(e.target.value)}
                                className="flex-1 bg-neutral-900 border border-neutral-700 rounded-xl px-4 text-sm font-mono text-white"
                            />
                        </div>
                    </div>

                    {/* Frame Width */}
                    {frameStyle !== 'modern' && (
                        <div>
                            <label className="block text-xs font-bold text-neutral-400 mb-2 uppercase">Frame Width: {frameWidth}px</label>
                            <input 
                                type="range" 
                                min="0" 
                                max="100"
                                value={frameWidth}
                                onChange={(e) => setFrameWidth(Number(e.target.value))}
                                className="w-full accent-yellow-500"
                            />
                        </div>
                    )}

                    {/* Top Text */}
                    <div>
                        <label className="block text-xs font-bold text-neutral-400 mb-2 uppercase">3. Top Headline</label>
                        <input 
                            type="text" 
                            value={topText}
                            onChange={(e) => setTopText(e.target.value)}
                            className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-2.5 text-sm font-bold text-white focus:outline-none focus:border-yellow-500 transition-all"
                            placeholder="e.g. BREAKING NEWS"
                        />
                    </div>

                    {/* Bottom Text */}
                    <div>
                        <label className="block text-xs font-bold text-neutral-400 mb-2 uppercase">4. Bottom Ticker</label>
                        <input 
                            type="text" 
                            value={bottomText}
                            onChange={(e) => setBottomText(e.target.value)}
                            className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-2.5 text-sm font-bold text-white focus:outline-none focus:border-yellow-500 transition-all"
                            placeholder="e.g. EXCLUSIVE FOOTAGE"
                        />
                    </div>

                    {/* Actions */}
                    <div className="pt-4 mt-4 border-t border-neutral-800 space-y-3">
                        <button 
                            onClick={handleExport}
                            disabled={!videoSrc || isExporting}
                            className={`w-full py-3.5 bg-red-600 hover:bg-red-700 text-white font-black rounded-2xl uppercase tracking-widest text-xs shadow-[0_0_20px_rgba(220,38,38,0.4)] active:scale-95 transition-all ${(!videoSrc || isExporting) ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            {isExporting ? `Processing... ${exportProgress}%` : '🎬 Process & Export Video'}
                        </button>

                        {exportedVideoUrl && (
                            <button 
                                onClick={downloadVideo}
                                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl uppercase tracking-widest text-xs shadow-[0_0_20px_rgba(16,185,129,0.4)] active:scale-95 transition-all"
                            >
                                💾 Download / Save to Gallery
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Preview Stage */}
            <div className="flex-1 bg-black/90 p-4 md:p-8 flex items-center justify-center relative bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wNSkiLz48L3N2Zz4=')]">
                {!videoSrc ? (
                    <div className="text-center space-y-4 max-w-sm">
                        <div className="w-24 h-24 bg-neutral-900 rounded-full flex items-center justify-center mx-auto border border-neutral-800">
                            <span className="text-4xl">📹</span>
                        </div>
                        <h3 className="text-lg font-black text-white">No Video Selected</h3>
                        <p className="text-xs text-neutral-400">Upload a video from your gallery to start editing and adding custom frames.</p>
                    </div>
                ) : (
                    <div className="relative w-full max-w-md aspect-[9/16] bg-black rounded-xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-neutral-800">
                        {/* Hidden Video element for source */}
                        <video 
                            ref={videoRef}
                            src={videoSrc}
                            className="hidden"
                            crossOrigin="anonymous"
                            playsInline
                            muted // Start muted for preview
                        />
                        {/* Visible Canvas for composited preview */}
                        <canvas 
                            ref={canvasRef}
                            className="w-full h-full object-contain"
                            onClick={() => {
                                const video = videoRef.current;
                                if(video.paused) { video.play(); drawFrame(); }
                                else { video.pause(); }
                            }}
                        />

                        {exportedVideoUrl && (
                            <div className="absolute inset-0 z-10 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
                                <div className="text-center space-y-4">
                                    <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center mx-auto animate-bounce shadow-[0_0_30px_rgba(16,185,129,0.5)]">
                                        <span className="text-2xl">✓</span>
                                    </div>
                                    <h3 className="text-lg font-black text-white uppercase tracking-wider">Video Ready!</h3>
                                    <button 
                                        onClick={downloadVideo}
                                        className="bg-emerald-600 px-6 py-2 rounded-full text-xs font-bold shadow-lg shadow-emerald-500/20 active:scale-95"
                                    >
                                        Save to Device
                                    </button>
                                    <button 
                                        onClick={() => setExportedVideoUrl(null)}
                                        className="block mx-auto text-xs text-neutral-400 hover:text-white"
                                    >
                                        Return to Editor
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default VideoEditor;
