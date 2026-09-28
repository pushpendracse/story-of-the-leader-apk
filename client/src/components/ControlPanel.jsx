import React from 'react';

const ControlPanel = ({
    onBroadcast,
    onSpeedChange,
    typingSpeed = 110,
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
    // Camera & Prompter Customization Props
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
    setFontSize
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
        <div className="w-full h-full md:fixed md:top-0 md:right-0 md:w-88 bg-neutral-950 border-l border-neutral-800 text-white z-50 p-5 flex flex-col shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-black text-yellow-500 uppercase tracking-tighter italic flex items-center gap-2">
                    <span className="w-2.5 h-6 bg-yellow-500 rounded-full"></span>
                    Master Studio Control
                </h2>
                <button
                    onClick={onToggleTheme}
                    className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-neutral-900 border border-neutral-700 text-yellow-400 hover:bg-neutral-800 transition-all"
                >
                    {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
                </button>
            </div>

            {/* Scrollable Control Area */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1 no-scrollbar pb-6">

                {/* 1. Camera Control Section */}
                <div className="bg-neutral-900/90 p-3.5 rounded-2xl border border-neutral-800 space-y-3">
                    <div className="flex items-center justify-between">
                        <label className="text-[11px] uppercase font-black tracking-wider text-neutral-300 flex items-center gap-1.5">
                            📷 Live Camera (Front/Anchor)
                        </label>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cameraEnabled ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-neutral-800 text-neutral-500'}`}>
                            {cameraEnabled ? 'ACTIVE' : 'OFF'}
                        </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <button
                            type="button"
                            onClick={() => setCameraEnabled(!cameraEnabled)}
                            className={`py-2 px-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${cameraEnabled ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20' : 'bg-neutral-800 text-neutral-400 hover:text-white'}`}
                        >
                            {cameraEnabled ? '✓ Camera ON' : 'Turn Camera ON'}
                        </button>

                        <button
                            type="button"
                            disabled={!cameraEnabled}
                            onClick={() => setIsFrontCamera(!isFrontCamera)}
                            className={`py-2 px-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all border border-neutral-700 ${cameraEnabled ? 'bg-neutral-800 text-neutral-200 hover:bg-neutral-700' : 'opacity-40 cursor-not-allowed text-neutral-600'}`}
                        >
                            🔄 {isFrontCamera ? 'Front Cam' : 'Back Cam'}
                        </button>
                    </div>
                </div>

                {/* 2. Speed Control Room Section */}
                <div className="bg-neutral-900/90 p-3.5 rounded-2xl border border-neutral-800 space-y-3">
                    <div className="flex items-center justify-between">
                        <label className="text-[11px] uppercase font-black tracking-wider text-yellow-500 flex items-center gap-1">
                            ⏱️ Reading Speed: <span className="text-white text-xs">{typingSpeed} WPM</span>
                        </label>
                        <div className="flex gap-1">
                            <button
                                type="button"
                                onClick={() => onSpeedChange(Math.max(30, typingSpeed - 5))}
                                className="w-6 h-6 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-xs font-black flex items-center justify-center text-yellow-500"
                            >
                                -
                            </button>
                            <button
                                type="button"
                                onClick={() => onSpeedChange(Math.min(280, typingSpeed + 5))}
                                className="w-6 h-6 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-xs font-black flex items-center justify-center text-yellow-500"
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
                                className={`py-1.5 px-1 rounded-xl text-[10px] font-bold transition-all ${typingSpeed === preset.wpm ? 'bg-yellow-500 text-black shadow-md shadow-yellow-500/20' : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'}`}
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
                        className="w-full accent-yellow-500 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                    />
                </div>

                {/* 3. Text Position & Screen Range Section */}
                <div className="bg-neutral-900/90 p-3.5 rounded-2xl border border-neutral-800 space-y-3">
                    <label className="text-[11px] uppercase font-black tracking-wider text-neutral-300 block">
                        📐 Prompter Position & Screen Area
                    </label>

                    {/* Mode buttons */}
                    <div className="grid grid-cols-3 gap-1.5">
                        <button
                            type="button"
                            onClick={() => setPrompterMode('center')}
                            className={`py-2 px-1 rounded-xl text-[10px] font-bold uppercase transition-all ${prompterMode === 'center' ? 'bg-yellow-500 text-black shadow-md' : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'}`}
                        >
                            🎯 Center
                        </button>
                        <button
                            type="button"
                            onClick={() => setPrompterMode('bottom')}
                            className={`py-2 px-1 rounded-xl text-[10px] font-bold uppercase transition-all ${prompterMode === 'bottom' ? 'bg-yellow-500 text-black shadow-md' : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'}`}
                        >
                            📺 Bottom Ticker
                        </button>
                        <button
                            type="button"
                            onClick={() => setPrompterMode('top')}
                            className={`py-2 px-1 rounded-xl text-[10px] font-bold uppercase transition-all ${prompterMode === 'top' ? 'bg-yellow-500 text-black shadow-md' : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'}`}
                        >
                            👁️ Top Camera
                        </button>
                    </div>

                    {/* Screen Height Coverage */}
                    <div className="space-y-1.5">
                        <div className="flex justify-between text-[10px] text-neutral-400">
                            <span>Screen Height Coverage</span>
                            <span className="font-bold text-yellow-500">{Math.round(prompterHeight * 100)}%</span>
                        </div>
                        <div className="grid grid-cols-3 gap-1.5">
                            {[
                                { label: '35% Compact', val: 0.35 },
                                { label: '50% Half', val: 0.50 },
                                { label: '70% Full', val: 0.70 }
                            ].map(hOpt => (
                                <button
                                    key={hOpt.val}
                                    type="button"
                                    onClick={() => setPrompterHeight(hOpt.val)}
                                    className={`py-1 rounded-lg text-[9px] font-bold uppercase ${prompterHeight === hOpt.val ? 'bg-neutral-700 text-white border border-yellow-500/50' : 'bg-neutral-800 text-neutral-400'}`}
                                >
                                    {hOpt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Font Size & Transparency */}
                    <div className="grid grid-cols-2 gap-2 pt-1">
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
                                        className={`flex-1 py-1 rounded-lg text-[10px] font-bold ${fontSize === f.size ? 'bg-yellow-500 text-black' : 'bg-neutral-800 text-neutral-400'}`}
                                    >
                                        {f.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between text-[10px] text-neutral-400 mb-1">
                                <span>Card Opacity</span>
                                <span className="font-bold text-yellow-500">{Math.round(prompterOpacity * 100)}%</span>
                            </div>
                            <input
                                type="range"
                                min="0.2"
                                max="0.95"
                                step="0.05"
                                value={prompterOpacity}
                                onChange={(e) => setPrompterOpacity(parseFloat(e.target.value))}
                                className="w-full accent-yellow-500 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                            />
                        </div>
                    </div>
                </div>

                {/* 4. Episode Title & Script */}
                <div className="space-y-2">
                    <input
                        value={h}
                        onChange={(e) => setH(e.target.value)}
                        placeholder="Episode / News Headline..."
                        className="w-full p-3.5 bg-neutral-900 border border-neutral-800 rounded-2xl text-xs outline-none focus:border-yellow-500 transition-all font-bold placeholder-neutral-600"
                    />
                    <textarea
                        rows="5"
                        value={c}
                        onChange={(e) => setC(e.target.value)}
                        placeholder="Write your news script here (auto-scrolls with karaoke highlight)..."
                        className="w-full p-3.5 bg-neutral-900 border border-neutral-800 rounded-2xl text-xs outline-none focus:border-yellow-500 transition-all resize-none leading-relaxed placeholder-neutral-600 font-serif"
                    />
                </div>

                {/* 5. Background Gallery & Outro (when camera is not used) */}
                {!cameraEnabled && (
                    <div className="space-y-3 bg-neutral-900/60 p-3.5 rounded-2xl border border-neutral-800">
                        <div className="space-y-1.5">
                            <label className="block text-neutral-400 text-[10px] uppercase font-bold tracking-wider">Background Images (Ken Burns Slideshow)</label>
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
                                                className="absolute inset-0 flex items-center justify-center bg-red-600/80 text-white opacity-0 group-hover:opacity-100 text-[9px] transition-all font-bold"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="space-y-1.5 pt-1">
                            <label className="block text-neutral-400 text-[10px] uppercase font-bold tracking-wider">Outro Slide Image</label>
                            <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => {
                                    const file = e.target.files[0];
                                    if (file) {
                                        const reader = new FileReader();
                                        reader.onloadend = () => setOutroImage(reader.result);
                                        reader.readAsDataURL(file);
                                    }
                                }}
                                className="text-[10px] text-neutral-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:bg-neutral-800 file:text-red-400 cursor-pointer w-full"
                            />
                            {outroImage && (
                                <div className="h-12 rounded-xl overflow-hidden relative border border-neutral-800 mt-1">
                                    <img src={outroImage} className="w-full h-full object-cover opacity-80" alt="Outro Preview" />
                                    <button
                                        type="button"
                                        onClick={() => setOutroImage(null)}
                                        className="absolute top-0 right-0 bg-red-600 text-[9px] px-2 py-0.5 rounded-bl-lg font-bold"
                                    >
                                        Del
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* 6. Audio & Master Record Box */}
                <div className="bg-gradient-to-br from-red-950/40 to-neutral-900 p-4 rounded-2xl border border-red-500/30 space-y-3 shadow-xl">
                    <div className="flex items-center justify-between">
                        <label className="text-red-400 text-[10px] uppercase font-black tracking-widest">
                            Mic & Audio Settings
                        </label>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => setMicEnabled(!micEnabled)}
                                title="Microphone"
                                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${micEnabled ? 'bg-red-500 text-white shadow-lg shadow-red-500/30' : 'bg-neutral-800 text-neutral-500'}`}
                            >
                                🎤 {micEnabled ? 'Mic ON' : 'Mic OFF'}
                            </button>
                        </div>
                    </div>

                    {recordingStatus && (
                        <div className="bg-black/60 p-2 rounded-xl border border-red-500/30 text-center">
                            <span className="text-[11px] text-red-400 font-black animate-pulse uppercase tracking-wider">
                                ● {recordingStatus}
                            </span>
                        </div>
                    )}

                    {/* Master Record / Broadcast Action */}
                    <div className="space-y-2 pt-1">
                        <button
                            type="button"
                            onClick={onBroadcast}
                            className="w-full bg-yellow-500 hover:bg-yellow-400 active:scale-[0.98] text-black py-3.5 rounded-2xl font-black shadow-xl shadow-yellow-500/20 text-xs uppercase tracking-widest transition-all"
                        >
                            🎬 Start Live Recording Reel
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default ControlPanel;
