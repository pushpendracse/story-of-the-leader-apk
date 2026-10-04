import React, { useState, useEffect, useRef } from 'react';
import NewsRoom from './components/NewsRoom';
import ControlPanel from './components/ControlPanel';
import { createReelRenderer } from './utils/canvasRenderer';
import { saveReelVideo } from './utils/nativeFileSaver';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';

const App = () => {
    const [news, setNews] = useState({
        heading: "",
        content: "",
        mediaList: [],
        outroImage: null,
    });
    const [audioEnabled, setAudioEnabled] = useState(false);
    const [liveSpeed, setLiveSpeed] = useState(105);

    const [isRecordingMode, setIsRecordingMode] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [micEnabled, setMicEnabled] = useState(true);
    const [systemAudioEnabled, setSystemAudioEnabled] = useState(true);
    const [recordingStatus, setRecordingStatus] = useState("");

    // Live Camera States
    const [cameraEnabled, setCameraEnabled] = useState(false);
    const [isFrontCamera, setIsFrontCamera] = useState(true);
    const [cameraStream, setCameraStream] = useState(null);

    // Prompter Screen Customization States
    const [prompterMode, setPrompterMode] = useState('center'); // 'center' | 'bottom' | 'top'
    const [prompterHeight, setPrompterHeight] = useState(0.50); // 0.35 | 0.50 | 0.70
    const [prompterOpacity, setPrompterOpacity] = useState(0.80);
    const [fontSize, setFontSize] = useState(22);

    // Export & Share Modal State
    const [exportedVideo, setExportedVideo] = useState(null);

    const [showControls, setShowControls] = useState(true);
    const [controlsTimeout, setControlsTimeout] = useState(null);
    const [theme, setTheme] = useState('dark');
    const [activeTab, setActiveTab] = useState('preview');

    const mediaRecorderRef = useRef(null);
    const audioContextRef = useRef(null);
    const chunksRef = useRef([]);
    const newsRoomRef = useRef(null);
    const animationFrameRef = useRef(null);
    const activeStreamRef = useRef(null);
    const cameraVideoRef = useRef(null);

    const [draftNews, setDraftNews] = useState({
        heading: "Breaking News: Story of the Leader",
        content: "Welcome to the news room broadcast. This teleprompter automatically animates your script with high precision.",
        mediaList: [],
        outroImage: null
    });

    // Real Camera Stream Management with Multi-tier Fallback
    useEffect(() => {
        let stream = null;
        if (cameraEnabled) {
            const initCamera = async () => {
                const constraintOptions = [
                    {
                        video: {
                            facingMode: isFrontCamera ? 'user' : 'environment',
                            width: { ideal: 1280 },
                            height: { ideal: 720 }
                        },
                        audio: true
                    },
                    {
                        video: {
                            facingMode: isFrontCamera ? 'user' : 'environment'
                        },
                        audio: true
                    },
                    {
                        video: true,
                        audio: true
                    }
                ];

                let activeStream = null;
                let lastErr = null;
                for (const constraints of constraintOptions) {
                    try {
                        activeStream = await navigator.mediaDevices.getUserMedia(constraints);
                        if (activeStream) break;
                    } catch (err) {
                        lastErr = err;
                    }
                }

                if (activeStream) {
                    stream = activeStream;
                    setCameraStream(activeStream);
                    if (cameraVideoRef.current) {
                        cameraVideoRef.current.srcObject = activeStream;
                        cameraVideoRef.current.play().catch(e => console.log("Camera play err:", e));
                    }
                } else {
                    console.error("Camera access error:", lastErr);
                    alert("Camera Permission Required: Please allow Camera permissions in your phone settings.\n(" + (lastErr ? lastErr.message : "Error opening device camera") + ")");
                    setCameraEnabled(false);
                }
            };
            initCamera();
        } else {
            if (cameraStream) {
                cameraStream.getTracks().forEach(t => t.stop());
                setCameraStream(null);
            }
        }

        return () => {
            if (stream) stream.getTracks().forEach(t => t.stop());
        };
    }, [cameraEnabled, isFrontCamera]);

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
            if (!src.startsWith('data:')) {
                img.crossOrigin = 'anonymous';
            }
            img.onload = () => resolve(img);
            img.onerror = () => resolve(null);
            img.src = src;
        });
    };

    // ===============================================
    // UNIFIED RECORDING ENGINE (HD CANVAS + REAL CAMERA + AUDIO)
    // ===============================================
    const startRecording = async () => {
        try {
            setIsRecordingMode(true);
            setActiveTab('preview');
            setRecordingStatus("PREPARING STUDIO...");

            const canvas = document.createElement('canvas');
            canvas.width = 1080;
            canvas.height = 1920;
            const ctx = canvas.getContext('2d', { alpha: false });
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';

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
                theme: theme,
                cameraVideoElement: cameraVideoRef.current,
                isFrontCamera: isFrontCamera,
                prompterMode: prompterMode,
                prompterHeight: prompterHeight,
                prompterOpacity: prompterOpacity,
                fontSize: fontSize * 2
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
            let finalStream = canvasStream;

            // Audio mixing from camera or microphone
            let audioStream = null;
            if (cameraStream && cameraStream.getAudioTracks().length > 0) {
                audioStream = cameraStream;
            } else if (micEnabled) {
                try {
                    audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                } catch (e) {
                    console.warn("Microphone access:", e);
                }
            }

            if (audioStream && audioStream.getAudioTracks().length > 0) {
                finalStream = new MediaStream([
                    ...canvasStream.getVideoTracks(),
                    ...audioStream.getAudioTracks()
                ]);
            }

            // Codec Selection: Universal MP4 First + Lightweight Full HD (1080p) Bitrate
            const candidateCodecs = [
                { mime: 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', ext: 'mp4' },
                { mime: 'video/mp4;codecs=avc1', ext: 'mp4' },
                { mime: 'video/mp4;codecs=h264', ext: 'mp4' },
                { mime: 'video/mp4', ext: 'mp4' },
                { mime: 'video/webm;codecs=h264', ext: 'mp4' },
                { mime: 'video/webm;codecs=vp9', ext: 'webm' },
                { mime: 'video/webm;codecs=vp8', ext: 'webm' },
                { mime: 'video/webm', ext: 'webm' }
            ];

            let selectedCodec = { mime: '', ext: 'mp4' };
            for (const cand of candidateCodecs) {
                if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(cand.mime)) {
                    selectedCodec = cand;
                    break;
                }
            }

            const recorderOptions = {
                videoBitsPerSecond: 6000000, // 6 Mbps for High Quality HD (keeps file size safe for mobile)
                audioBitsPerSecond: 128000
            };
            if (selectedCodec.mime) {
                recorderOptions.mimeType = selectedCodec.mime;
            }

            const recorder = new MediaRecorder(finalStream, recorderOptions);
            chunksRef.current = [];
            recorder.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);

            recorder.onstop = async () => {
                setRecordingStatus("PROCESSING HD VIDEO...");
                if (chunksRef.current.length > 0) {
                    const mimeType = selectedCodec.mime || chunksRef.current[0].type || 'video/mp4';
                    const blob = new Blob(chunksRef.current, { type: mimeType });
                    const blobUrl = URL.createObjectURL(blob);

                    const saveResult = await saveReelVideo(blob, selectedCodec.ext);

                    setExportedVideo({
                        url: blobUrl,
                        blob: blob,
                        fileName: saveResult.fileName || `STORY_REEL_${Date.now()}.${selectedCodec.ext}`,
                        uri: saveResult.uri || null,
                        sizeMb: (blob.size / (1024 * 1024)).toFixed(1)
                    });
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

    const handleShareVideo = async () => {
        if (!exportedVideo) return;
        try {
            const canShare = await Share.canShare().then(r => r.value).catch(() => false);
            if (canShare && exportedVideo.uri) {
                await Share.share({
                    title: 'Story of the Leader - HD Reel',
                    text: 'Watch my 1080p HD vertical story reel!',
                    url: exportedVideo.uri,
                    dialogTitle: 'Share HD Video'
                });
            } else if (navigator.share) {
                const file = new File([exportedVideo.blob], exportedVideo.fileName, { type: exportedVideo.blob.type });
                if (navigator.canShare && navigator.canShare({ files: [file] })) {
                    await navigator.share({
                        files: [file],
                        title: 'Story of the Leader - HD Reel',
                        text: 'Watch my 1080p HD vertical story reel!'
                    });
                } else {
                    await navigator.share({
                        title: 'Story of the Leader - HD Reel',
                        url: window.location.href
                    });
                }
            } else {
                const a = document.createElement('a');
                a.href = exportedVideo.url;
                a.download = exportedVideo.fileName;
                a.click();
            }
        } catch (e) {
            console.log("Share notice:", e);
        }
    };

    const handleDownloadVideo = async () => {
        if (!exportedVideo) return;
        if (Capacitor.isNativePlatform()) {
            try {
                const reader = new FileReader();
                reader.readAsDataURL(exportedVideo.blob);
                reader.onloadend = async () => {
                    try {
                        const res = reader.result;
                        const base64Data = typeof res === 'string' && res.includes(',') ? res.split(',')[1] : res;
                        if (!base64Data) throw new Error("Base64 encoding failed");

                        await Filesystem.writeFile({
                            path: exportedVideo.fileName,
                            data: base64Data,
                            directory: Directory.Documents
                        });
                        alert('✅ SUCCESS: Video has been downloaded to your phone\\'s "Documents" folder!');
                    } catch (err) {
                        alert('⚠️ Save failed: ' + err.message);
                    }
                };
            } catch (e) {
                alert('⚠️ Download error: ' + e.message);
            }
        } else {
            const a = document.createElement('a');
            a.href = exportedVideo.url;
            a.download = exportedVideo.fileName;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
                if (a.parentNode) document.body.removeChild(a);
            }, 1500);
        }
    };

    return (
        <div className={`w-full h-[100dvh] bg-slate-950 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/30 via-slate-950 to-black flex flex-col md:flex-row overflow-hidden relative ${isRecordingMode && !showControls ? 'cursor-none' : ''}`} onMouseMove={handleMouseMove} onTouchStart={handleMouseMove}>

            {/* Hidden Offscreen Video Element for Live Camera Synthesis onto Canvas */}
            <video
                ref={cameraVideoRef}
                autoPlay
                playsInline
                muted
                style={{ position: 'absolute', opacity: 0, width: '1px', height: '1px', pointerEvents: 'none', zIndex: -100 }}
            />

            {/* Mobile Tab Navigation Bar */}
            {!isRecordingMode && (
                <div className="md:hidden flex bg-neutral-900 border-b border-neutral-800 z-40 p-2 gap-2 shrink-0">
                    <button
                        onClick={() => setActiveTab('preview')}
                        className={`flex-1 py-2.5 text-xs font-black uppercase tracking-wider rounded-xl transition-all ${activeTab === 'preview' ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/20' : 'bg-neutral-800 text-neutral-400'}`}
                    >
                        👁 Studio Preview
                    </button>
                    <button
                        onClick={() => setActiveTab('controls')}
                        className={`flex-1 py-2.5 text-xs font-black uppercase tracking-wider rounded-xl transition-all ${activeTab === 'controls' ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/20' : 'bg-neutral-800 text-neutral-400'}`}
                    >
                        ⚙ Control Room
                    </button>
                </div>
            )}

            {/* Main Stage / Teleprompter Canvas */}
            <div className={`transition-all duration-500 flex flex-col justify-center items-center relative overflow-hidden ${isRecordingMode ? 'w-full h-full absolute inset-0 z-[100] bg-black' : activeTab === 'preview' ? 'flex-1 h-full' : 'hidden md:flex flex-1 h-full'}`}>

                {/* Top Quick Floating Controls Bar */}
                {!isRecordingMode && (
                    <div className="absolute top-4 z-30 flex items-center gap-2 bg-white/10 backdrop-blur-2xl px-4 py-2 rounded-3xl border border-white/20 shadow-[0_8px_30px_rgb(0,0,0,0.5)] max-w-[95%] overflow-x-auto no-scrollbar transition-all duration-300">
                        {/* Camera Quick Toggle */}
                        <button
                            onClick={() => setCameraEnabled(!cameraEnabled)}
                            className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-md ${cameraEnabled ? 'bg-emerald-500 text-black font-black' : 'bg-neutral-800 text-neutral-300'}`}
                        >
                            📷 {cameraEnabled ? 'Cam ON' : 'Cam OFF'}
                        </button>

                        {/* Front / Back switch */}
                        {cameraEnabled && (
                            <button
                                onClick={() => setIsFrontCamera(!isFrontCamera)}
                                className="px-2.5 py-1.5 rounded-xl text-[10px] font-bold bg-neutral-800 text-neutral-200 border border-neutral-700"
                            >
                                🔄 {isFrontCamera ? 'Front' : 'Back'}
                            </button>
                        )}

                        {/* Speed Stepper */}
                        <div className="flex items-center gap-1 bg-neutral-800/90 px-2 py-0.5 rounded-xl border border-neutral-700">
                            <button
                                onClick={() => setLiveSpeed(prev => Math.max(30, prev - 5))}
                                className="text-yellow-500 font-black text-sm px-1.5 hover:text-white"
                            >
                                -
                            </button>
                            <span className="text-[10px] font-black text-yellow-400 min-w-12 text-center">
                                {liveSpeed} WPM
                            </span>
                            <button
                                onClick={() => setLiveSpeed(prev => Math.min(260, prev + 5))}
                                className="text-yellow-500 font-black text-sm px-1.5 hover:text-white"
                            >
                                +
                            </button>
                        </div>

                        {/* Prompter Mode Quick Picker */}
                        <div className="flex gap-1 bg-neutral-800/90 p-0.5 rounded-xl">
                            {['center', 'bottom', 'top'].map(m => (
                                <button
                                    key={m}
                                    onClick={() => setPrompterMode(m)}
                                    className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase ${prompterMode === m ? 'bg-yellow-500 text-black shadow-sm' : 'text-neutral-400'}`}
                                >
                                    {m === 'center' ? 'Center' : m === 'bottom' ? 'Ticker' : 'Top'}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <NewsRoom
                    ref={newsRoomRef}
                    newsData={news.content ? news : draftNews}
                    audioEnabled={audioEnabled}
                    highlightSpeed={liveSpeed}
                    theme={theme}
                    isRecording={isRecordingMode}
                    onRecordingComplete={stopRecording}
                    cameraStream={cameraStream}
                    isFrontCamera={isFrontCamera}
                    prompterMode={prompterMode}
                    prompterHeight={prompterHeight}
                    prompterOpacity={prompterOpacity}
                    fontSize={fontSize}
                />

                {/* DIRECT BIG RED RECORD BUTTON ON PREVIEW SCREEN (INSTANT 1-TAP RECORDING) */}
                {!isRecordingMode && activeTab === 'preview' && (
                    <div className="absolute bottom-12 md:bottom-5 z-40 w-full flex items-center justify-center pointer-events-none">
                        <button
                            type="button"
                            onClick={startRecording}
                            className="pointer-events-auto relative group overflow-hidden bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 active:scale-95 text-white px-8 py-3.5 rounded-full font-black text-xs uppercase tracking-widest flex items-center gap-3 shadow-[0_0_30px_rgba(225,29,72,0.6)] border border-white/20 animate-bounce"
                        >
                            <div className="absolute inset-0 bg-white/20 group-hover:translate-x-full transition-transform duration-700 ease-out -skew-x-12 -ml-12 w-24"></div>
                            <span className="w-3.5 h-3.5 bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.8)]"></span>
                            <span className="relative z-10">🎬 START RECORDING REEL</span>
                        </button>
                    </div>
                )}

                {/* In-Recording Floating Status & Stop Button */}
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
                                    <span>⏹</span> STOP & EXPORT REEL
                                </button>
                            ) : (
                                <button
                                    onClick={() => setIsRecordingMode(false)}
                                    className="bg-neutral-800 hover:bg-neutral-700 text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest border border-neutral-700"
                                >
                                    Exit Studio
                                </button>
                            )}
                        </div>
                    </>
                )}
            </div>

            {/* Control Panel Drawer (Smooth Touch Scrolling + Fixed Bottom Record Button) */}
            <div className={`transition-all duration-500 h-[100dvh] ${isRecordingMode ? 'hidden' : activeTab === 'controls' ? 'w-full flex-1 md:w-96 md:flex-none' : 'hidden md:block w-96'}`}>
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
                    cameraEnabled={cameraEnabled}
                    setCameraEnabled={setCameraEnabled}
                    isFrontCamera={isFrontCamera}
                    setIsFrontCamera={setIsFrontCamera}
                    prompterMode={prompterMode}
                    setPrompterMode={setPrompterMode}
                    prompterHeight={prompterHeight}
                    setPrompterHeight={setPrompterHeight}
                    prompterOpacity={prompterOpacity}
                    setPrompterOpacity={setPrompterOpacity}
                    fontSize={fontSize}
                    setFontSize={setFontSize}
                />
            </div>

            {/* ======================================================== */}
            {/* RECORDED VIDEO READY MODAL (PREVIEW + SAVE + SHARE)     */}
            {/* ======================================================== */}
            {exportedVideo && (
                <div className="fixed inset-0 z-[200] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-slate-900/80 backdrop-blur-3xl border border-white/20 rounded-[2rem] max-w-sm w-full p-6 space-y-5 shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col items-center relative overflow-hidden">
                        <div className="absolute -top-24 -left-24 w-48 h-48 bg-indigo-500/30 rounded-full blur-3xl pointer-events-none"></div>
                        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-rose-500/30 rounded-full blur-3xl pointer-events-none"></div>
                        <div className="relative z-10 w-full flex justify-between items-center pb-2 border-b border-white/10">
                            <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping"></span>
                                <span className="text-xs font-black text-white uppercase tracking-wider">
                                    HD Reel Exported!
                                </span>
                            </div>
                            <span className="text-[10px] font-bold text-yellow-500 bg-yellow-500/10 px-2 py-0.5 rounded-full border border-yellow-500/30">
                                1080p MP4 • {exportedVideo.sizeMb} MB
                            </span>
                        </div>

                        {/* Video Player */}
                        <div className="w-full aspect-[9/16] max-h-[50vh] bg-black rounded-2xl overflow-hidden border border-neutral-800 shadow-inner flex items-center justify-center">
                            <video
                                src={exportedVideo.url}
                                controls
                                autoPlay
                                loop
                                playsInline
                                className="w-full h-full object-contain"
                            />
                        </div>

                        <p className="text-[11px] text-neutral-400 text-center">
                            Your vertical reel is saved in Full HD MP4 and ready to post on Instagram Reels, YouTube Shorts, or WhatsApp!
                        </p>

                        {/* Actions */}
                        <div className="relative z-10 w-full space-y-3 mt-2">
                            <button
                                onClick={handleShareVideo}
                                className="w-full py-3.5 bg-gradient-to-r from-yellow-400 to-amber-500 hover:from-yellow-300 hover:to-amber-400 text-black font-black rounded-2xl uppercase tracking-widest text-xs flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(251,191,36,0.4)] active:scale-95 transition-all"
                            >
                                📤 Share to WhatsApp / Instagram
                            </button>

                            <button
                                onClick={handleDownloadVideo}
                                className="w-full py-3.5 bg-white/10 hover:bg-white/20 backdrop-blur-md text-white font-bold rounded-2xl uppercase tracking-wider text-xs flex items-center justify-center gap-2 border border-white/20 active:scale-95 transition-all shadow-lg"
                            >
                                💾 Download / Save to Phone
                            </button>

                            <button
                                onClick={() => setExportedVideo(null)}
                                className="w-full py-2 text-neutral-500 hover:text-neutral-300 font-bold text-xs uppercase tracking-wider transition-all"
                            >
                                ✕ Close & Record Another
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default App;
