import React, { useState, useRef, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { saveReelVideo } from './utils/nativeFileSaver';
import NewsRoom from './components/NewsRoom';
import ControlPanel from './components/ControlPanel';
import { CanvasRenderer } from './utils/canvasRenderer';

function App() {
    const [step, setStep] = useState('NEWS_ROOM'); // 'NEWS_ROOM' or 'STUDIO'
    
    // UI State
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [recordingStatus, setRecordingStatus] = useState('');
    const [scrollSpeed, setScrollSpeed] = useState(1);
    const [toastMessage, setToastMessage] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);

    // Export State
    const [showExportModal, setShowExportModal] = useState(false);
    const [exportedVideo, setExportedVideo] = useState(null);
    const exportedVideoRef = useRef(null);

    // Core Engine Refs
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const rendererRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const chunksRef = useRef([]);
    const animationFrameId = useRef(null);
    const streamRef = useRef(null);

    // Initial Script Data
    const scriptDataRef = useRef({ heading: '', script: '', images: [] });

    // 1. Initialize Camera (when entering Studio)
    useEffect(() => {
        if (step !== 'STUDIO') return;

        const initCamera = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { width: { ideal: 1080 }, height: { ideal: 1920 }, facingMode: 'user' },
                    audio: true
                });
                streamRef.current = stream;
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    videoRef.current.play().catch(e => console.error("Play error:", e));
                }
                
                // Initialize Renderer
                if (canvasRef.current && videoRef.current) {
                    rendererRef.current = new CanvasRenderer(canvasRef.current, videoRef.current);
                    rendererRef.current.setScriptData(scriptDataRef.current);
                    rendererRef.current.setSpeed(scrollSpeed);
                    renderLoop();
                }
            } catch (error) {
                console.error("Camera error:", error);
                alert("Camera and Microphone permissions are required.");
                setStep('NEWS_ROOM');
            }
        };
        initCamera();

        return () => {
            if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
            cancelAnimationFrame(animationFrameId.current);
        };
    }, [step]);

    // 2. The Render Loop
    const renderLoop = (timestamp) => {
        if (rendererRef.current) {
            rendererRef.current.draw(timestamp);
        }
        animationFrameId.current = requestAnimationFrame(renderLoop);
    };

    // Update Renderer Speed & Status
    useEffect(() => {
        if (rendererRef.current) rendererRef.current.setSpeed(scrollSpeed);
    }, [scrollSpeed]);

    useEffect(() => {
        if (rendererRef.current) rendererRef.current.setRecordingState(isRecording);
    }, [isRecording]);

    // 3. Start Recording
    const startRecording = () => {
        const canvas = canvasRef.current;
        if (!canvas || !streamRef.current) return;
        
        chunksRef.current = [];
        setRecordingTime(0);
        setExportedVideo(null);
        exportedVideoRef.current = null;
        
        const canvasStream = canvas.captureStream(30);
        const audioTracks = streamRef.current.getAudioTracks();
        if (audioTracks.length > 0) canvasStream.addTrack(audioTracks[0]);
        
        let options = { mimeType: 'video/mp4' };
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
            options = { mimeType: 'video/webm; codecs=vp9' };
            if (!MediaRecorder.isTypeSupported(options.mimeType)) options = { mimeType: 'video/webm' };
        }
        
        const recorder = new MediaRecorder(canvasStream, options);
        
        recorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
        };
        
        recorder.onstop = () => {
            if (chunksRef.current.length > 0) {
                const blob = new Blob(chunksRef.current, { type: options.mimeType });
                const ext = options.mimeType.includes('mp4') ? 'mp4' : 'webm';
                const url = URL.createObjectURL(blob);
                
                const videoData = { blob, url, ext };
                setExportedVideo(videoData);
                exportedVideoRef.current = videoData;
                setShowExportModal(true);
            }
        };
        
        recorder.start(1000);
        mediaRecorderRef.current = recorder;
        setIsRecording(true);
        setRecordingStatus('RECORDING');
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            setRecordingStatus('');
        }
    };

    // Timer
    useEffect(() => {
        let interval;
        if (isRecording) interval = setInterval(() => setRecordingTime(t => t + 1), 1000);
        return () => clearInterval(interval);
    }, [isRecording]);

    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    // Export Logic
    const handleDownloadVideo = async (quality = '1080p') => {
        const targetVideo = exportedVideoRef.current || exportedVideo;
        if (!targetVideo) return;
        
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
                    showSuccessNotification("Saved to your phone's Documents folder!");
                } else {
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

    const handleStartStudio = (data) => {
        scriptDataRef.current = data;
        setStep('STUDIO');
    };

    const handleAddImage = (e) => {
        const file = e.target.files[0];
        if (file && rendererRef.current) {
            scriptDataRef.current.images.push({ url: URL.createObjectURL(file) });
            rendererRef.current.setScriptData(scriptDataRef.current);
        }
    };

    if (step === 'NEWS_ROOM') {
        return (
            <div className="w-full min-h-[100dvh] bg-slate-950 flex flex-col items-center p-4">
                <NewsRoom onStartStudio={handleStartStudio} />
            </div>
        );
    }

    return (
        <div className="w-full h-[100dvh] bg-slate-950 flex flex-col items-center justify-center relative overflow-hidden font-sans">
            
            {/* Toast */}
            {toastMessage && (
                <div className="absolute top-10 left-1/2 -translate-x-1/2 z-[9999] bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-6 py-4 rounded-full shadow-[0_10px_40px_rgba(16,185,129,0.4)] flex items-center gap-4 animate-bounce">
                    <div className="bg-white/20 p-2 rounded-full"><span className="text-xl">📥</span></div>
                    <div className="flex flex-col">
                        <p className="font-black text-sm tracking-wide uppercase">Download Complete</p>
                        <p className="text-xs font-medium text-emerald-50">{toastMessage}</p>
                    </div>
                    <button onClick={() => setToastMessage(null)} className="ml-4 text-white/70 hover:text-white">✕</button>
                </div>
            )}

            <video ref={videoRef} autoPlay playsInline muted className="absolute w-[10px] h-[10px] opacity-0 pointer-events-none -z-50" />

            {/* Viewport */}
            <div className="relative w-full max-w-sm h-full max-h-[850px] shadow-2xl bg-black overflow-hidden flex items-center justify-center">
                <canvas ref={canvasRef} width="1080" height="1920" className="w-full h-full object-cover" />

                {!isRecording && !isProcessing && (
                    <ControlPanel 
                        scrollSpeed={scrollSpeed} 
                        setScrollSpeed={setScrollSpeed} 
                        onExit={() => setStep('NEWS_ROOM')}
                        onAddImage={handleAddImage}
                    />
                )}

                {/* Recording Info */}
                {isRecording && (
                    <div className="absolute top-10 right-6 z-50 bg-black/50 backdrop-blur px-4 py-1.5 rounded-full text-white font-bold tracking-widest text-xs border border-white/10 flex items-center shadow-lg">
                        <span className="text-red-500 animate-pulse mr-2">● REC</span>
                        <span className="ml-2 font-mono">{formatTime(recordingTime)}</span>
                    </div>
                )}

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
                            <span className="text-xl">⏹</span> STOP & EXPORT REEL
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

            {/* Export Modal */}
            {showExportModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
                    <div className="bg-slate-900 border border-slate-700 p-6 rounded-3xl w-full max-w-sm shadow-2xl flex flex-col gap-4">
                        <h3 className="text-xl font-black text-white mb-1">Export Video</h3>
                        <p className="text-slate-400 text-sm mb-2">Choose the video quality you want to save.</p>
                        
                        <button onClick={() => handleDownloadVideo('1080p')} className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-4 px-5 rounded-2xl transition-all flex justify-between items-center shadow-lg shadow-indigo-600/20 active:scale-95">
                            <div className="flex flex-col items-start gap-1">
                                <span>1080p (FHD)</span>
                                <span className="text-[10px] text-indigo-200 uppercase tracking-widest font-normal">Original Size</span>
                            </div>
                            <span className="text-xs font-black bg-indigo-800 px-3 py-1.5 rounded-lg text-indigo-100">Recommended</span>
                        </button>
                        
                        <button onClick={() => handleDownloadVideo('720p')} className="bg-slate-800 hover:bg-slate-700 text-white font-semibold py-4 px-5 rounded-2xl transition-all flex justify-between items-center border border-slate-700 active:scale-95">
                            <div className="flex flex-col items-start gap-1">
                                <span>720p (HD)</span>
                                <span className="text-[10px] text-slate-400 uppercase tracking-widest font-normal">Smaller File</span>
                            </div>
                        </button>
                        
                        <button onClick={() => { setShowExportModal(false); setExportedVideo(null); }} className="mt-2 py-3 text-neutral-500 hover:text-neutral-300 font-bold text-xs uppercase tracking-wider transition-all">
                            ✕ Cancel
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default App;
