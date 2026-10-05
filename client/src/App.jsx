import React, { useState, useRef, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { saveReelVideo } from './utils/nativeFileSaver';

function App() {
    // --- Camera & Recording State ---
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [recordingStatus, setRecordingStatus] = useState('');
    
    // Core Engine Refs
    const videoRef = useRef(null);       // The visible camera preview
    const canvasRef = useRef(null);      // The canvas where we render HD video
    const mediaRecorderRef = useRef(null);
    const chunksRef = useRef([]);
    const animationFrameId = useRef(null);
    const streamRef = useRef(null);
    
    // Export State
    const [showExportModal, setShowExportModal] = useState(false);
    const [exportedVideo, setExportedVideo] = useState(null);
    const exportedVideoRef = useRef(null); // Bulletproof ref for downloads
    const [toastMessage, setToastMessage] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);

    // 1. Initialize Camera
    useEffect(() => {
        const initCamera = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        width: { ideal: 1080 },
                        height: { ideal: 1920 },
                        facingMode: 'user'
                    },
                    audio: true
                });
                streamRef.current = stream;
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
                
                // Start drawing camera to canvas
                renderCanvas();
            } catch (error) {
                console.error("Camera access denied:", error);
                alert("Camera and Microphone permissions are required.");
            }
        };
        initCamera();

        return () => {
            if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
            cancelAnimationFrame(animationFrameId.current);
        };
    }, []);

    // 2. Render Canvas (The Virtual Studio Engine)
    const renderCanvas = () => {
        const canvas = canvasRef.current;
        const video = videoRef.current;
        if (!canvas || !video) return;
        
        const ctx = canvas.getContext('2d');
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
            // Draw full HD video feed to canvas
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            // Here you can overlay text, images, watermark, etc.
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.fillRect(0, canvas.height - 100, canvas.width, 100);
            ctx.fillStyle = 'white';
            ctx.font = 'bold 40px sans-serif';
            ctx.fillText('STORY OF THE LEADER', 50, canvas.height - 40);
        }
        
        animationFrameId.current = requestAnimationFrame(renderCanvas);
    };

    // 3. Start Recording
    const startRecording = () => {
        const canvas = canvasRef.current;
        if (!canvas || !streamRef.current) return;
        
        chunksRef.current = [];
        setRecordingTime(0);
        setExportedVideo(null);
        exportedVideoRef.current = null;
        
        // Capture 30 FPS video stream from canvas
        const canvasStream = canvas.captureStream(30);
        
        // Extract microphone audio from the original camera stream
        const audioTracks = streamRef.current.getAudioTracks();
        if (audioTracks.length > 0) {
            canvasStream.addTrack(audioTracks[0]);
        }
        
        // Choose best supported codec
        let options = { mimeType: 'video/mp4' };
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
            options = { mimeType: 'video/webm; codecs=vp9' };
            if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                options = { mimeType: 'video/webm' };
            }
        }
        
        const recorder = new MediaRecorder(canvasStream, options);
        
        recorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) {
                chunksRef.current.push(e.data);
            }
        };
        
        recorder.onstop = () => {
            if (chunksRef.current.length > 0) {
                const blob = new Blob(chunksRef.current, { type: options.mimeType });
                const ext = options.mimeType.includes('mp4') ? 'mp4' : 'webm';
                const url = URL.createObjectURL(blob);
                
                const videoData = { blob, url, ext };
                setExportedVideo(videoData);
                exportedVideoRef.current = videoData;
                
                // Show export quality modal immediately
                setShowExportModal(true);
            } else {
                alert("Recording failed. No data captured.");
            }
        };
        
        recorder.start(1000); // Capture chunks every 1s
        mediaRecorderRef.current = recorder;
        setIsRecording(true);
        setRecordingStatus('RECORDING');
    };

    // 4. Stop Recording
    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            setRecordingStatus('');
        }
    };

    // 5. Timer
    useEffect(() => {
        let interval;
        if (isRecording) {
            interval = setInterval(() => setRecordingTime(t => t + 1), 1000);
        }
        return () => clearInterval(interval);
    }, [isRecording]);

    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    // 6. Download / Export Flow
    const handleDownloadVideo = async (quality = '1080p') => {
        const targetVideo = exportedVideoRef.current || exportedVideo;
        if (!targetVideo) {
            alert('Debug: Still missing video data!');
            return;
        }
        
        setShowExportModal(false);
        setIsProcessing(true);
        setRecordingStatus(`EXPORTING IN ${quality}...`);

        const triggerWebDownload = () => {
            try {
                const a = document.createElement('a');
                a.href = targetVideo.url;
                a.download = `STORY_REEL_${quality}_${Date.now()}.${targetVideo.ext}`;
                document.body.appendChild(a);
                a.click();
                setTimeout(() => {
                    if (a.parentNode) document.body.removeChild(a);
                }, 10000);
            } catch (err) {
                console.error('Browser fallback error:', err);
            }
        };

        const showSuccessNotification = (msg) => {
            setToastMessage(msg);
            setTimeout(() => setToastMessage(null), 6000);
        };

        if (Capacitor.isNativePlatform()) {
            try {
                const saveResult = await saveReelVideo(targetVideo.blob, targetVideo.ext);
                
                if (saveResult && saveResult.success) {
                    showSuccessNotification('Saved to your phone\'s Documents folder!');
                } else {
                    // Fallback if native file writing fails
                    triggerWebDownload();
                }
            } catch (e) {
                triggerWebDownload();
            }
        } else {
            triggerWebDownload();
            showSuccessNotification('Saved! Check your browser downloads.');
        }
        
        setIsProcessing(false);
        setRecordingStatus('');
    };

    return (
        <div className="w-full h-[100dvh] bg-slate-950 flex flex-col items-center justify-center relative overflow-hidden font-sans">
            
            {/* Custom In-App Notification (Toast) */}
            {toastMessage && (
                <div className="absolute top-10 left-1/2 -translate-x-1/2 z-[9999] bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-6 py-4 rounded-full shadow-[0_10px_40px_rgba(16,185,129,0.4)] flex items-center gap-4 transition-all duration-500 animate-bounce">
                    <div className="bg-white/20 p-2 rounded-full">
                        <span className="text-xl leading-none">📥</span>
                    </div>
                    <div className="flex flex-col">
                        <p className="font-black text-sm tracking-wide uppercase">Download Complete</p>
                        <p className="text-xs font-medium text-emerald-50">{toastMessage}</p>
                    </div>
                    <button onClick={() => setToastMessage(null)} className="ml-4 text-white/70 hover:text-white">✕</button>
                </div>
            )}

            {/* Hidden Offscreen Video Element for Live Camera (Input) */}
            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{ position: 'absolute', opacity: 0, width: '1px', height: '1px', pointerEvents: 'none', zIndex: -100 }}
            />

            {/* The Main Viewport - Canvas (Output) */}
            <div className="relative w-full max-w-sm h-full max-h-[850px] shadow-2xl bg-black rounded-3xl overflow-hidden flex items-center justify-center">
                <canvas 
                    ref={canvasRef} 
                    width="1080" 
                    height="1920" 
                    className="w-full h-full object-cover"
                />

                {/* UI Overlay */}
                <div className="absolute top-8 left-0 right-0 px-6 flex justify-between items-center z-50">
                    <div className="bg-black/50 backdrop-blur px-4 py-1.5 rounded-full text-white font-bold tracking-widest text-xs border border-white/10">
                        {isRecording ? <span className="text-red-500 animate-pulse mr-2">● REC</span> : "STUDIO READY"}
                        {isRecording && <span className="ml-2 font-mono">{formatTime(recordingTime)}</span>}
                    </div>
                </div>

                {/* Recording Controls */}
                <div className="absolute bottom-10 left-0 right-0 flex justify-center z-50">
                    {!isRecording ? (
                        <button 
                            onClick={startRecording}
                            disabled={isProcessing}
                            className="w-20 h-20 bg-white rounded-full border-[6px] border-neutral-300 hover:scale-105 active:scale-95 transition-all shadow-[0_0_30px_rgba(255,255,255,0.3)] flex items-center justify-center"
                        >
                            <div className="w-16 h-16 bg-red-600 rounded-full" />
                        </button>
                    ) : (
                        <button 
                            onClick={stopRecording}
                            className="bg-red-600 hover:bg-red-500 text-white font-black py-4 px-8 rounded-full shadow-[0_0_40px_rgba(220,38,38,0.5)] flex items-center gap-3 active:scale-95 transition-all"
                        >
                            <span className="text-xl leading-none">⏹</span> STOP & EXPORT REEL
                        </button>
                    )}
                </div>

                {isProcessing && (
                    <div className="absolute inset-0 bg-black/80 z-[60] flex flex-col items-center justify-center">
                        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                        <p className="text-white mt-4 font-bold tracking-widest text-sm">{recordingStatus}</p>
                    </div>
                )}
            </div>

            {/* Export Quality Modal */}
            {showExportModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
                    <div className="bg-slate-900 border border-slate-700 p-6 rounded-3xl w-full max-w-sm shadow-2xl flex flex-col gap-4">
                        <h3 className="text-xl font-black text-white mb-1">Export Video</h3>
                        <p className="text-slate-400 text-sm mb-2">Choose the video quality you want to save.</p>
                        
                        <button 
                            onClick={() => handleDownloadVideo('1080p')}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-4 px-5 rounded-2xl transition-all flex justify-between items-center shadow-lg shadow-indigo-600/20 active:scale-95"
                        >
                            <div className="flex flex-col items-start gap-1">
                                <span>1080p (FHD)</span>
                                <span className="text-[10px] text-indigo-200 uppercase tracking-widest font-normal">Original Size</span>
                            </div>
                            <span className="text-xs font-black bg-indigo-800 px-3 py-1.5 rounded-lg text-indigo-100">Recommended</span>
                        </button>
                        
                        <button 
                            onClick={() => handleDownloadVideo('720p')}
                            className="bg-slate-800 hover:bg-slate-700 text-white font-semibold py-4 px-5 rounded-2xl transition-all flex justify-between items-center border border-slate-700 active:scale-95"
                        >
                            <div className="flex flex-col items-start gap-1">
                                <span>720p (HD)</span>
                                <span className="text-[10px] text-slate-400 uppercase tracking-widest font-normal">Smaller File</span>
                            </div>
                        </button>
                        
                        <button 
                            onClick={() => {
                                setShowExportModal(false);
                                setExportedVideo(null);
                            }}
                            className="mt-2 py-3 text-neutral-500 hover:text-neutral-300 font-bold text-xs uppercase tracking-wider transition-all"
                        >
                            ✕ Cancel
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default App;
