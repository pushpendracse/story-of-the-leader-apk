import React from 'react';

const ControlPanel = ({
    onBroadcast,
    onSpeedChange,
    typingSpeed = 105,
    audioEnabled,
    onAudioToggle,
    theme,
    onToggleTheme,
    startRecording,
    micEnabled,
    setMicEnabled,
    systemAudioEnabled,
    setSystemAudioEnabled,
    draftNews,
    setDraftNews,
    recordingStatus,
    cameraEnabled,
    setCameraEnabled,
    isFrontCamera,
    setIsFrontCamera,
    prompterMode,
    setPrompterMode,
    prompterHeight,
    setPrompterHeight,
    prompterOpacity,
    setPrompterOpacity,
    fontSize,
    setFontSize,
    aspectRatio,
    setAspectRatio,
    textAlign,
    setTextAlign,
    highlightStyle,
    setHighlightStyle
}) => {
    const { heading: h, content: c, mediaList: mediaPreviews, outroImage } = draftNews;

    const setH = (val) => setDraftNews(prev => ({ ...prev, heading: val }));
    const setC = (val) => setDraftNews(prev => ({ ...prev, content: val }));
    const setMediaPreviews = (val) => setDraftNews(prev => ({ ...prev, mediaList: typeof val === 'function' ? val(prev.mediaList) : val }));
    const setOutroImage = (val) => setDraftNews(prev => ({ ...prev, outroImage: val }));

    const handleMultipleImages = (e) => {
        const files = Array.from(e.target.files);
        const newPreviews = [];
        files.forEach(file => {
            const reader = new FileReader();
            reader.onloadend = () => {
                newPreviews.push(reader.result);
                if (newPreviews.length === files.length) {
                    setMediaPreviews(newPreviews);
                }
            };
            reader.readAsDataURL(file);
        });
    };

    const speedPresets = [
        { label: '🐢 Slow', wpm: 65 },
        { label: '🎙️ Normal', wpm: 105 },
        { label: '⚡ Fast', wpm: 145 },
        { label: '🔥 Express', wpm: 185 },
    ];

    return (
        <div className="w-full h-full md:fixed md:top-0 md:right-0 md:w-96 bg-slate-900/40 backdrop-blur-3xl border-l border-white/10 text-white z-50 flex flex-col shadow-[-10px_0_30px_rgba(0,0,0,0.3)] relative">
            {/* Header (Fixed at top) */}
            <div className="flex items-center justify-between p-4 border-b border-white/10 bg-white/5 backdrop-blur-2xl shrink-0">
                <h2 className="text-base font-black text-yellow-500 uppercase tracking-tighter italic flex items-center gap-2">
                    <span className="w-2.5 h-5 bg-yellow-500 rounded-full"></span>
                    Control Room
                </h2>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={onToggleTheme}
                        className="text-[10px] font-bold px-2 py-1 rounded-lg bg-neutral-800 border border-neutral-700 text-yellow-400"
                    >
                        {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
                    </button>
                </div>
            </div>

            {/* Scrollable Content Body (Full touch scrolling with visible scrollbar) */}
            <div className="flex-1 overflow-y-auto overscroll-contain touch-pan-y p-4 space-y-4 pb-36">

                {/* 1. Live Camera Switch Section */}
                <div className="bg-white/5 backdrop-blur-xl p-3.5 rounded-3xl border border-white/10 space-y-3 shadow-[0_4px_24px_rgba(0,0,0,0.2)] hover:border-white/20 transition-all">
                    <div className="flex items-center justify-between">
                        <label className="text-xs uppercase font-black tracking-wider text-neutral-200 flex items-center gap-1.5">
                            📷 Real Camera (Front / Anchor)
                        </label>
                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${cameraEnabled ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-neutral-800 text-neutral-400'}`}>
                            {cameraEnabled ? '● ACTIVE' : 'OFF'}
                        </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <button
                            type="button"
                            onClick={() => setCameraEnabled(!cameraEnabled)}
                            className={`py-3 px-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${cameraEnabled ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/30' : 'bg-neutral-800 text-neutral-200 border border-neutral-700 hover:bg-neutral-700'}`}
                        >
                            {cameraEnabled ? '✓ Camera Active' : '▶ Turn Camera ON'}
                        </button>

                        <button
                            type="button"
                            disabled={!cameraEnabled}
                            onClick={() => setIsFrontCamera(!isFrontCamera)}
                            className={`py-3 px-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all border border-neutral-700 ${cameraEnabled ? 'bg-neutral-800 text-neutral-200 hover:bg-neutral-700' : 'opacity-40 cursor-not-allowed text-neutral-600'}`}
                        >
                            🔄 {isFrontCamera ? 'Front Cam' : 'Back Cam'}
                        </button>
                    </div>
                    {cameraEnabled && (
                        <p className="text-[10px] text-emerald-400/80 italic text-center">
                            Real device camera is active! You will see yourself on the preview screen.
                        </p>
                    )}
                </div>

                {/* Aspect Ratio Toggle Section */}
                <div className="bg-white/5 backdrop-blur-xl p-3.5 rounded-3xl border border-white/10 space-y-2 shadow-[0_4px_24px_rgba(0,0,0,0.2)] hover:border-white/20 transition-all">
                    <label className="text-[11px] uppercase font-black tracking-widest text-neutral-400">
                        📺 Video Aspect Ratio
                    </label>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => setAspectRatio('9:16')}
                            className={`flex-1 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all border ${aspectRatio === '9:16' ? 'bg-neutral-200 text-black border-neutral-200 shadow-[0_0_15px_rgba(255,255,255,0.2)]' : 'bg-neutral-800 text-neutral-400 border-neutral-700 hover:bg-neutral-700'}`}
                        >
                            📱 9:16 (Shorts)
                        </button>
                        <button
                            type="button"
                            onClick={() => setAspectRatio('16:9')}
                            className={`flex-1 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all border ${aspectRatio === '16:9' ? 'bg-neutral-200 text-black border-neutral-200 shadow-[0_0_15px_rgba(255,255,255,0.2)]' : 'bg-neutral-800 text-neutral-400 border-neutral-700 hover:bg-neutral-700'}`}
                        >
                            🖥️ 16:9 (YouTube)
                        </button>
                    </div>
                </div>

                {/* Styling and Formatting Section */}
                <div className="bg-white/5 backdrop-blur-xl p-3.5 rounded-3xl border border-white/10 space-y-3 shadow-[0_4px_24px_rgba(0,0,0,0.2)] hover:border-white/20 transition-all">
                    <label className="text-[11px] uppercase font-black tracking-widest text-neutral-400 block mb-1">
                        🎨 Formatting & Highlights
                    </label>
                    <div className="flex gap-2">
                        <select
                            value={textAlign}
                            onChange={(e) => setTextAlign(e.target.value)}
                            className="flex-1 py-2 px-3 rounded-xl font-bold text-xs bg-neutral-800 text-white border border-neutral-700 focus:outline-none focus:border-yellow-500"
                        >
                            <option value="left">Align: Left</option>
                            <option value="center">Align: Center</option>
                            <option value="justify">Align: Justify</option>
                        </select>
                        <select
                            value={highlightStyle}
                            onChange={(e) => setHighlightStyle(e.target.value)}
                            className="flex-1 py-2 px-3 rounded-xl font-bold text-xs bg-neutral-800 text-white border border-neutral-700 focus:outline-none focus:border-yellow-500"
                        >
                            <option value="karaoke">🎨 Style: Karaoke</option>
                            <option value="box">🎨 Style: Box</option>
                            <option value="underline">🎨 Style: Underline</option>
                            <option value="color">🎨 Style: Color Fill</option>
                        </select>
                    </div>
                </div>

                {/* 2. Speed Control Room Section */}
                <div className="bg-white/5 backdrop-blur-xl p-3.5 rounded-3xl border border-white/10 space-y-3 shadow-[0_4px_24px_rgba(0,0,0,0.2)] hover:border-white/20 transition-all">
                    <div className="flex items-center justify-between">
                        <label className="text-xs uppercase font-black tracking-wider text-yellow-500 flex items-center gap-1">
                            ⏱️ Prompter Speed: <span className="text-white font-bold ml-1">{typingSpeed} WPM</span>
                        </label>
                        <div className="flex gap-1.5">
                            <button
                                type="button"
                                onClick={() => onSpeedChange(Math.max(30, typingSpeed - 5))}
                                className="w-7 h-7 bg-neutral-800 hover:bg-neutral-700 active:scale-95 rounded-lg text-sm font-black flex items-center justify-center text-yellow-500 border border-neutral-700"
                            >
                                -
                            </button>
                            <button
                                type="button"
                                onClick={() => onSpeedChange(Math.min(280, typingSpeed + 5))}
                                className="w-7 h-7 bg-neutral-800 hover:bg-neutral-700 active:scale-95 rounded-lg text-sm font-black flex items-center justify-center text-yellow-500 border border-neutral-700"
                            >
                                +
                            </button>
                        </div>
                    </div>

                    {/* Presets */}
                    <div className="grid grid-cols-4 gap-1.5">
                        {speedPresets.map(preset => (
                            <button
                                key={preset.wpm}
                                type="button"
                                onClick={() => onSpeedChange(preset.wpm)}
                                className={`py-2 px-1 rounded-xl text-[10px] font-bold transition-all ${typingSpeed === preset.wpm ? 'bg-yellow-500 text-black shadow-md shadow-yellow-500/20 font-black' : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'}`}
                            >
                                {preset.label}
                            </button>
                        ))}
                    </div>

                    <input
                        type="range"
                        min="30"
                        max="260"
                        step="5"
                        value={typingSpeed}
                        onChange={(e) => onSpeedChange(parseInt(e.target.value))}
                        className="w-full accent-yellow-500 h-2 bg-neutral-800 rounded-lg cursor-pointer"
                    />
                </div>

                {/* 3. Text Position & Screen Range Section */}
                <div className="bg-white/5 backdrop-blur-xl p-3.5 rounded-3xl border border-white/10 space-y-3 shadow-[0_4px_24px_rgba(0,0,0,0.2)] hover:border-white/20 transition-all">
                    <label className="text-xs uppercase font-black tracking-wider text-neutral-200 block">
                        📐 Prompter Position on Screen
                    </label>

                    {/* Mode buttons */}
                    <div className="grid grid-cols-3 gap-2">
                        <button
                            type="button"
                            onClick={() => setPrompterMode('center')}
                            className={`py-2.5 px-1 rounded-xl text-[10px] font-black uppercase transition-all ${prompterMode === 'center' ? 'bg-yellow-500 text-black shadow-md' : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'}`}
                        >
                            🎯 Center Card
                        </button>
                        <button
                            type="button"
                            onClick={() => setPrompterMode('bottom')}
                            className={`py-2.5 px-1 rounded-xl text-[10px] font-black uppercase transition-all ${prompterMode === 'bottom' ? 'bg-yellow-500 text-black shadow-md' : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'}`}
                        >
                            📺 Bottom Ticker
                        </button>
                        <button
                            type="button"
                            onClick={() => setPrompterMode('top')}
                            className={`py-2.5 px-1 rounded-xl text-[10px] font-black uppercase transition-all ${prompterMode === 'top' ? 'bg-yellow-500 text-black shadow-md' : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'}`}
                        >
                            👁️ Top Camera
                        </button>
                    </div>

                    {/* Screen Height Coverage */}
                    <div className="space-y-1.5 pt-1">
                        <div className="flex justify-between text-[11px] text-neutral-300">
                            <span>Screen Height Coverage</span>
                            <span className="font-bold text-yellow-500">{Math.round(prompterHeight * 100)}%</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            {[
                                { label: '35% Compact', val: 0.35 },
                                { label: '50% Half', val: 0.50 },
                                { label: '70% Full', val: 0.70 }
                            ].map(hOpt => (
                                <button
                                    key={hOpt.val}
                                    type="button"
                                    onClick={() => setPrompterHeight(hOpt.val)}
                                    className={`py-1.5 rounded-xl text-[10px] font-bold uppercase transition-all ${prompterHeight === hOpt.val ? 'bg-neutral-700 text-white border border-yellow-500/60 font-black' : 'bg-neutral-800 text-neutral-400'}`}
                                >
                                    {hOpt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Font Size & Transparency */}
                    <div className="grid grid-cols-2 gap-3 pt-1">
                        <div>
                            <label className="text-[10px] text-neutral-400 block mb-1">Font Size</label>
                            <div className="flex gap-1">
                                {[
                                    { label: 'S', size: 18 },
                                    { label: 'M', size: 22 },
                                    { label: 'L', size: 26 },
                                    { label: 'XL', size: 32 }
                                ].map(f => (
                                    <button
                                        key={f.size}
                                        type="button"
                                        onClick={() => setFontSize(f.size)}
                                        className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold ${fontSize === f.size ? 'bg-yellow-500 text-black font-black' : 'bg-neutral-800 text-neutral-400'}`}
                                    >
                                        {f.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between text-[10px] text-neutral-400 mb-1">
                                <span>Card Darkness</span>
                                <span className="font-bold text-yellow-500">{Math.round(prompterOpacity * 100)}%</span>
                            </div>
                            <input
                                type="range"
                                min="0.2"
                                max="0.95"
                                step="0.05"
                                value={prompterOpacity}
                                onChange={(e) => setPrompterOpacity(parseFloat(e.target.value))}
                                className="w-full accent-yellow-500 h-2 bg-neutral-800 rounded-lg cursor-pointer"
                            />
                        </div>
                    </div>
                </div>

                {/* 4. Episode Title & Script Input */}
                <div className="bg-neutral-900 p-3.5 rounded-2xl border border-neutral-800 space-y-2.5 shadow-md">
                    <label className="text-xs uppercase font-black tracking-wider text-neutral-200 block">
                        📝 Script & Headline
                    </label>
                    <input
                        value={h}
                        onChange={(e) => setH(e.target.value)}
                        placeholder="Episode / News Headline..."
                        className="w-full p-3 bg-black/40 border border-white/10 rounded-xl text-xs outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 transition-all font-bold placeholder-neutral-500 shadow-inner text-white"
                    />
                    <textarea
                        rows="5"
                        value={c}
                        onChange={(e) => setC(e.target.value)}
                        placeholder="Write your news script here (karaoke auto-scrolling)..."
                        className={`w-full p-3 bg-black/40 border border-white/10 rounded-xl text-xs outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 transition-all resize-none leading-relaxed placeholder-neutral-500 font-serif shadow-inner text-white ${textAlign === 'justify' ? 'text-justify' : textAlign === 'center' ? 'text-center' : 'text-left'}`}
                    />
                </div>

                {/* 5. Background Images (shown when camera is OFF) */}
                {!cameraEnabled && (
                    <div className="bg-white/5 backdrop-blur-xl p-3.5 rounded-3xl border border-white/10 space-y-2.5 shadow-[0_4px_24px_rgba(0,0,0,0.2)] hover:border-white/20 transition-all">
                        <label className="block text-neutral-300 text-xs uppercase font-bold tracking-wider">
                            🖼️ Background Gallery (Slide Images)
                        </label>
                        <input
                            type="file"
                            multiple
                            accept="image/*"
                            onChange={handleMultipleImages}
                            className="text-[10px] text-neutral-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:bg-neutral-800 file:text-yellow-500 cursor-pointer w-full"
                        />
                        {mediaPreviews.length > 0 && (
                            <div className="grid grid-cols-4 gap-1.5 mt-2 max-h-24 overflow-y-auto p-1.5 bg-neutral-950 rounded-xl border border-neutral-800">
                                {mediaPreviews.map((img, idx) => (
                                    <div key={idx} className="h-10 rounded-lg overflow-hidden relative group">
                                        <img src={img} className="w-full h-full object-cover opacity-70 group-hover:opacity-100" alt="Preview" />
                                        <button
                                            type="button"
                                            onClick={() => setMediaPreviews(prev => prev.filter((_, i) => i !== idx))}
                                            className="absolute inset-0 flex items-center justify-center bg-red-600/80 text-white opacity-0 group-hover:opacity-100 text-[9px] font-bold"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* 6. Mic Option */}
                <div className="bg-white/5 backdrop-blur-xl p-3 rounded-3xl border border-white/10 flex items-center justify-between shadow-[0_4px_24px_rgba(0,0,0,0.2)] hover:border-white/20 transition-all">
                    <span className="text-xs font-bold text-neutral-300">🎙️ Microphone Audio</span>
                    <button
                        type="button"
                        onClick={() => setMicEnabled(!micEnabled)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${micEnabled ? 'bg-red-500 text-white shadow-md' : 'bg-neutral-800 text-neutral-500'}`}
                    >
                        {micEnabled ? 'Mic ON' : 'Mic OFF'}
                    </button>
                </div>

            </div>

            {/* FIXED / STICKY BOTTOM ACTION BAR (ALWAYS VISIBLE & NEVER COVERED) */}
            <div className="mt-auto p-4 bg-slate-900/60 border-t border-white/10 backdrop-blur-3xl z-50 flex flex-col gap-2 shadow-[0_-10px_30px_rgba(0,0,0,0.3)] shrink-0">
                {recordingStatus && (
                    <div className="text-center">
                        <span className="text-[10px] text-red-400 font-black animate-pulse uppercase tracking-wider">
                            ● {recordingStatus}
                        </span>
                    </div>
                )}
                <button
                    type="button"
                    onClick={onBroadcast}
                    className="relative group overflow-hidden bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 active:scale-95 text-white py-4 rounded-2xl font-black shadow-[0_0_30px_rgba(225,29,72,0.6)] text-xs uppercase tracking-widest flex items-center justify-center gap-3 border border-white/20 transition-all"
                >
                    <div className="absolute inset-0 bg-white/20 group-hover:translate-x-full transition-transform duration-700 ease-out -skew-x-12 -ml-12 w-24"></div>
                    <span className="w-3.5 h-3.5 bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.8)] animate-pulse"></span>
                    <span className="relative z-10">🎬 START RECORDING REEL</span>
                </button>
            </div>
        </div>
    );
};

export default ControlPanel;
