import React, { useState, useEffect, useRef } from 'react';
import NewsRoom from './components/NewsRoom';
import ControlPanel from './components/ControlPanel';
import { createReelRenderer } from './utils/canvasRenderer';
import { saveReelVideo } from './utils/nativeFileSaver';
import { Capacitor } from '@capacitor/core';

const App = () => {
    const [news, setNews] = useState({
        heading: "",
        content: "",
        mediaList: [],
        outroImage: null,
    });
    const [audioEnabled, setAudioEnabled] = useState(false);
    const [liveSpeed, setLiveSpeed] = useState(50);

    const [isRecordingMode, setIsRecordingMode] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [micEnabled, setMicEnabled] = useState(false);
    const [systemAudioEnabled, setSystemAudioEnabled] = useState(true);
    const [recordingStatus, setRecordingStatus] = useState("");

    const [showControls, setShowControls] = useState(true);
    const [controlsTimeout, setControlsTimeout] = useState(null);
    const [theme, setTheme] = useState('dark');
    const [activeTab, setActiveTab] = useState('preview'); // 'preview' | 'controls' for mobile view

    const mediaRecorderRef = useRef(null);
    const audioContextRef = useRef(null);
    const chunksRef = useRef([]);
    const newsRoomRef = useRef(null);
    const animationFrameRef = useRef(null);
    const activeStreamRef = useRef(null);

    const [draftNews, setDraftNews] = useState({
        heading: "Breaking News: Story of the Leader",
        content: "Welcome to the news room broadcast. This teleprompter automatically animates your script with high precision.",
        mediaList: [],
        outroImage: null
    });

    const resetControlsTimeout = () => {
        setShowControls(true);
        if (controlsTimeout) clearTimeout(controlsTimeout);
        if (isRecordingMode) {
            const timeout = setTimeout(() => setShowControls(false), 3500);
            setControlsTimeout(timeout);
        }
    };

    useEffect(() => {
        if (isRecordingMode) resetControlsTimeout();
        else {
            setShowControls(true);
            if (controlsTimeout) clearTimeout(controlsTimeout);
        }
        return () => controlsTimeout && clearTimeout(controlsTimeout);
    }, [isRecordingMode]);

    const handleMouseMove = () => isRecordingMode && resetControlsTimeout();

    // Preload image helper for canvas renderer
    const preloadImage = (src) => {
        return new Promise((resolve) => {
            if (!src) return resolve(null);
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = () => resolve(null);
            img.src = src;
        });
    };

    // ===============================================
    // UNIFIED RECORDING ENGINE (MOBILE APK + DESKTOP)
    // ===============================================
    const startRecording = async () => {
        try {
            const isNative = Capacitor.isNativePlatform();
            const hasDisplayMedia = typeof navigator.mediaDevices?.getDisplayMedia === 'function';

            setIsRecordingMode(true);
            setActiveTab('preview');
            setRecordingStatus("PREPARING STUDIO...");

            // If running on Android APK or getDisplayMedia is unavailable, use Direct Canvas Synthesis
            const useDirectCanvas = isNative || !hasDisplayMedia || window.innerWidth < 768;

            let finalStream;
            let canvas = null;

            if (useDirectCanvas) {
                // Direct Canvas Engine (Android APK Safe & 1080x1920 Native)
                setRecordingStatus("LOADING ASSETS...");
                canvas = document.createElement('canvas');
                canvas.width = 1080;
                canvas.height = 1920;
                const ctx = canvas.getContext('2d', { alpha: false });
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';

                // Preload media
                const mediaImages = await Promise.all(
                    (draftNews.mediaList || []).map(src => preloadImage(src))
                );
                const outroImg = draftNews.outroImage ? await preloadImage(draftNews.outroImage) : null;

                const renderer = createReelRenderer({
                    heading: draftNews.heading,
                    content: draftNews.content,
                    mediaImages: mediaImages.filter(Boolean),
                    outroImage: outroImg,
                    wpm: liveSpeed,
                    theme: theme
                });

                let startTime = null;
                const renderLoop = (time) => {
                    if (!startTime) startTime = time;
                    renderer.renderFrame(ctx, time);

                    if (renderer.isComplete()) {
                        stopRecording();
                        return;
                    }
                    animationFrameRef.current = requestAnimationFrame(renderLoop);
                };
                animationFrameRef.current = requestAnimationFrame(renderLoop);

                const canvasStream = canvas.captureStream(30);
                activeStreamRef.current = canvasStream;
                finalStream = canvasStream;

                // Add microphone if enabled
                if (micEnabled) {
                    try {
                        const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                        finalStream = new MediaStream([
                            ...canvasStream.getVideoTracks(),
                            ...micStream.getAudioTracks()
                        ]);
                    } catch (e) {
                        console.warn("Microphone not available:", e);
                    }
                }

            } else {
                // Desktop Tab Capture Mode
                setRecordingStatus("AWAITING SHARE...");
                const displayStream = await navigator.mediaDevices.getDisplayMedia({
                    video: { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 60 } },
                    audio: systemAudioEnabled,
                    preferCurrentTab: true
                });

                canvas = document.createElement('canvas');
                canvas.width = 1080;
                canvas.height = 1920;
                const ctx = canvas.getContext('2d', { alpha: false });
                ctx.imageSmoothingEnabled = true;

                const video = document.createElement('video');
                video.muted = true;
                video.playsInline = true;
                video.srcObject = displayStream;

                await new Promise((resolve) => {
                    const onReady = () => video.play().then(resolve);
                    if (video.readyState >= 2) onReady();
                    else video.onloadeddata = onReady;
                });

                const drawFrame = () => {
                    if (!video || video.paused || video.ended) return;
                    const newsRoomEl = document.getElementById('newsroom-container');
                    const rect = newsRoomEl?.getBoundingClientRect();

                    if (rect && video.videoWidth > 0) {
                        const scaleX = video.videoWidth / window.innerWidth;
                        const scaleY = video.videoHeight / window.innerHeight;
                        ctx.drawImage(video, rect.left * scaleX, rect.top * scaleY, rect.width * scaleX, rect.height * scaleY, 0, 0, canvas.width, canvas.height);
                    }
                    animationFrameRef.current = requestAnimationFrame(drawFrame);
                };
                drawFrame();

                const canvasStream = canvas.captureStream(60);
                finalStream = canvasStream;
                activeStreamRef.current = displayStream;

                const systemAudio = displayStream.getAudioTracks();
                if (micEnabled || (systemAudioEnabled && systemAudio.length > 0)) {
                    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                    const dest = audioCtx.createMediaStreamDestination();

                    if (systemAudio.length > 0) {
                        const sysSource = audioCtx.createMediaStreamSource(new MediaStream([systemAudio[0]]));
                        sysSource.connect(dest);
                    }

                    if (micEnabled) {
                        try {
                            const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
                            const micSource = audioCtx.createMediaStreamSource(mic);
                            micSource.connect(dest);
                        } catch (e) { console.warn("Mic Permission Denied", e); }
                    }

                    finalStream = new MediaStream([...canvasStream.getVideoTracks(), ...dest.stream.getAudioTracks()]);
                    audioContextRef.current = audioCtx;
                }

                displayStream.getVideoTracks()[0].onended = () => {
                    stopRecording();
                };
            }

            // Codec Selection
            let options = { mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: 25000000 };
            if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                options.mimeType = 'video/webm;codecs=h264';
                if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                    options.mimeType = 'video/webm';
                    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                        options = { mimeType: 'video/mp4' };
                    }
                }
            }

            const recorder = new MediaRecorder(finalStream, options);
            chunksRef.current = [];
            recorder.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);

            recorder.onstop = async () => {
                setRecordingStatus("SAVING VIDEO...");
                if (chunksRef.current.length > 0) {
                    const blob = new Blob(chunksRef.current, { type: chunksRef.current[0].type || 'video/webm' });
                    await saveReelVideo(blob);
                }
                setIsRecording(false);
                setIsRecordingMode(false);
                setRecordingStatus("");
                if (activeStreamRef.current) {
                    activeStreamRef.current.getTracks().forEach(t => t.stop());
                }
                if (audioContextRef.current) {
                    audioContextRef.current.close().catch(() => {});
                }
                if (animationFrameRef.current) {
                    cancelAnimationFrame(animationFrameRef.current);
                }
            };

            recorder.start(1000);
            mediaRecorderRef.current = recorder;
            setIsRecording(true);
            setNews({ ...draftNews });
            setRecordingStatus("LIVE • RECORDING");

        } catch (err) {
            console.error("Recording Error:", err);
            setIsRecordingMode(false);
            setRecordingStatus("");
            alert("Studio Alert: " + (err.name === 'NotAllowedError' ? "Permission Required to Start." : err.message));
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }
    };

    return (
        <div className={`w-full h-screen bg-neutral-950 flex flex-col md:flex-row overflow-hidden relative ${isRecordingMode && !showControls ? 'cursor-none' : ''}`} onMouseMove={handleMouseMove} onTouchStart={handleMouseMove}>

            {/* Mobile Tab Navigation Bar (Visible only on small screens when not recording) */}
            {!isRecordingMode && (
                <div className="md:hidden flex bg-neutral-900 border-b border-neutral-800 z-40 p-2 gap-2">
                    <button
                        onClick={() => setActiveTab('preview')}
                        className={`flex-1 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition-all ${activeTab === 'preview' ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/20' : 'bg-neutral-800 text-neutral-400'}`}
                    >
                        👁 Studio Preview
                    </button>
                    <button
                        onClick={() => setActiveTab('controls')}
                        className={`flex-1 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition-all ${activeTab === 'controls' ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/20' : 'bg-neutral-800 text-neutral-400'}`}
                    >
                        ⚙ Control Room
                    </button>
                </div>
            )}

            {/* Main Stage / Teleprompter Canvas */}
            <div className={`transition-all duration-700 ease-in-out flex justify-center items-center ${isRecordingMode ? 'w-full h-full absolute inset-0 z-[100] bg-black' : activeTab === 'preview' ? 'flex-1 h-full' : 'hidden md:flex flex-1 h-full'}`}>

                <NewsRoom
                    ref={newsRoomRef}
                    newsData={news.content ? news : draftNews}
                    audioEnabled={audioEnabled}
                    highlightSpeed={liveSpeed}
                    theme={theme}
                    isRecording={isRecordingMode}
                    onRecordingComplete={stopRecording}
                />

                {isRecordingMode && (
                    <>
                        <div className={`absolute top-6 right-4 z-[120] flex items-center gap-2.5 bg-black/80 backdrop-blur-xl px-4 py-2 rounded-2xl border border-red-500/30 shadow-2xl transition-all duration-500 ${recordingStatus ? 'opacity-100' : 'opacity-0'}`}>
                            {isRecording && <span className="w-2.5 h-2.5 bg-red-600 rounded-full animate-pulse shadow-[0_0_10px_rgba(220,38,38,0.8)]"></span>}
                            <span className="text-[10px] text-white font-black uppercase tracking-widest">{recordingStatus}</span>
                        </div>

                        <div className={`absolute top-6 left-4 z-[120] flex gap-2 transition-all duration-500 ${showControls ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-10 pointer-events-none'}`}>
                            {isRecording ? (
                                <button
                                    onClick={stopRecording}
                                    className="bg-red-600 hover:bg-red-700 text-white px-6 py-2.5 rounded-2xl shadow-2xl border border-red-400 active:scale-95 transition-all text-xs font-black uppercase tracking-widest flex items-center gap-2"
                                >
                                    <span>⏹</span> STOP & SAVE
                                </button>
                            ) : (
                                <button
                                    onClick={() => setIsRecordingMode(false)}
                                    className="bg-gray-800/80 hover:bg-gray-700 text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest border border-gray-600"
                                >
                                    Exit Studio
                                </button>
                            )}
                        </div>
                    </>
                )}
            </div>

            {/* Control Panel Drawer */}
            <div className={`transition-all duration-500 ${isRecordingMode ? 'hidden' : activeTab === 'controls' ? 'w-full flex-1 md:w-80 md:flex-none' : 'hidden md:block w-80'}`}>
                <ControlPanel
                    draftNews={draftNews}
                    setDraftNews={setDraftNews}
                    onBroadcast={startRecording}
                    audioEnabled={audioEnabled}
                    onAudioToggle={() => setAudioEnabled(!audioEnabled)}
                    typingSpeed={liveSpeed}
                    onSpeedChange={setLiveSpeed}
                    theme={theme}
                    onToggleTheme={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')}
                    startRecording={startRecording}
                    micEnabled={micEnabled}
                    setMicEnabled={setMicEnabled}
                    systemAudioEnabled={systemAudioEnabled}
                    setSystemAudioEnabled={setSystemAudioEnabled}
                    recordingStatus={recordingStatus}
                />
            </div>
        </div>
    );
};

export default App;
