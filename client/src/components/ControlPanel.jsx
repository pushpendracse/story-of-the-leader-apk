import React, { useState } from 'react';

const ControlPanel = ({ onBroadcast, onSpeedChange, typingSpeed, audioEnabled, onAudioToggle, onToggleRecordingMode, theme, onToggleTheme, startRecording, micEnabled, setMicEnabled, systemAudioEnabled, setSystemAudioEnabled, draftNews, setDraftNews, recordingStatus }) => {
    const { heading: h, content: c, mediaList: mediaPreviews, outroImage } = draftNews;

    const setH = (val) => setDraftNews(prev => ({ ...prev, heading: val }));
    const setC = (val) => setDraftNews(prev => ({ ...prev, content: val }));
    const setMediaPreviews = (val) => setDraftNews(prev => ({ ...prev, mediaList: typeof val === 'function' ? val(prev.mediaList) : val }));
    const setOutroImage = (val) => setDraftNews(prev => ({ ...prev, outroImage: val }));

    // Multiple Image Upload Handler
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

    return (
        <div className="w-full h-full md:fixed md:top-0 md:right-0 md:w-80 bg-black border-l border-gray-800 text-white z-50 p-6 flex flex-col shadow-[0_0_50px_rgba(0,0,0,1)]">
            <h2 className="text-xl font-black text-yellow-500 mb-8 uppercase tracking-tighter italic flex items-center gap-2">
                <span className="w-2 h-8 bg-yellow-500 rounded-full"></span>
                Control Room
            </h2>

            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1 no-scrollbar mb-4">
                <input value={h} onChange={(e) => setH(e.target.value)} placeholder="Episode Title" className="w-full p-4 bg-gray-900/50 border border-gray-700/50 rounded-xl text-sm outline-none focus:border-yellow-500 transition-all" />
                <textarea rows="6" value={c} onChange={(e) => setC(e.target.value)} placeholder="Script..." className="w-full p-4 bg-gray-900/50 border border-gray-700/50 rounded-xl text-sm outline-none focus:border-yellow-500 transition-all resize-none" />

                {/* Multiple Image Upload */}
                <div className="space-y-2">
                    <label className="block text-gray-500 text-[10px] uppercase font-bold tracking-widest">Background Gallery</label>
                    <input
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={handleMultipleImages}
                        className="text-[10px] text-gray-500 file:mr-2 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-gray-800 file:text-yellow-500 cursor-pointer w-full"
                    />
                    {mediaPreviews.length > 0 && (
                        <div className="grid grid-cols-3 gap-2 mt-2 max-h-32 overflow-y-auto p-2 bg-gray-900/30 rounded-xl border border-gray-800">
                            {mediaPreviews.map((img, idx) => (
                                <div key={idx} className="h-12 rounded-lg overflow-hidden relative group">
                                    <img src={img} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" alt="Preview" />
                                    <button onClick={() => setMediaPreviews(prev => prev.filter((_, i) => i !== idx))} className="absolute inset-0 flex items-center justify-center bg-red-600/0 hover:bg-red-600/80 text-white opacity-0 hover:opacity-100 text-[10px] transition-all">Remove</button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Outro Image Upload */}
                <div className="space-y-2">
                    <label className="block text-gray-500 text-[10px] uppercase font-bold tracking-widest">Outro Image</label>
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
                        className="text-[10px] text-gray-500 file:mr-2 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-gray-800 file:text-red-500 cursor-pointer w-full"
                    />
                    {outroImage && (
                        <div className="h-16 rounded-xl overflow-hidden relative border border-gray-800 mt-2">
                            <img src={outroImage} className="w-full h-full object-cover opacity-80" alt="Outro Preview" />
                            <button onClick={() => setOutroImage(null)} className="absolute top-0 right-0 bg-red-600/80 text-[10px] px-3 py-1 rounded-bl-xl hover:bg-red-600 transition-colors">Del</button>
                        </div>
                    )}
                </div>

                {/* One-Click Master Studio */}
                <div className="bg-gradient-to-br from-red-600/20 to-gray-900 p-5 rounded-2xl border border-red-500/30 space-y-4 shadow-2xl shadow-red-900/20">
                    <div className="flex items-center justify-between">
                        <label className="block text-red-500 text-[10px] uppercase font-black tracking-widest">Master Studio</label>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setMicEnabled(!micEnabled)}
                                title="Microphone"
                                className={`p-2 rounded-xl transition-all ${micEnabled ? 'bg-red-500 text-white shadow-lg shadow-red-500/30' : 'bg-gray-800 text-gray-500'}`}
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                            </button>
                            <button
                                onClick={() => setSystemAudioEnabled(!systemAudioEnabled)}
                                title="PC Sound"
                                className={`p-2 rounded-xl transition-all ${systemAudioEnabled ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30' : 'bg-gray-800 text-gray-500'}`}
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>
                            </button>
                        </div>
                    </div>

                    {recordingStatus && (
                        <div className="bg-black/40 p-2 rounded-lg border border-red-500/20 text-center">
                            <span className="text-[10px] text-red-400 font-bold animate-pulse uppercase tracking-tight">
                                {recordingStatus}
                            </span>
                        </div>
                    )}

                    {/* Master Broadcast Action */}
                    <div className="space-y-3">
                        <button
                            onClick={onBroadcast}
                            className="w-full bg-yellow-500 hover:bg-yellow-400 text-black py-4 rounded-2xl font-black shadow-xl shadow-yellow-500/20 text-sm uppercase tracking-[0.2em] transition-all active:scale-[0.95]"
                        >
                            🚀 Start Broadcast
                        </button>

                        <button
                            onClick={startRecording}
                            className="w-full bg-red-600/20 hover:bg-red-600/40 text-red-500 py-3 rounded-2xl font-bold border border-red-500/20 text-[10px] uppercase tracking-widest transition-all"
                        >
                            Studio Record Only
                        </button>
                    </div>
                </div>

                {/* Speed & Theme Controls */}
                <div className="bg-gray-900 p-4 rounded-xl border border-gray-800 space-y-4">
                    <div className="flex justify-between items-center">
                        <label className="block text-gray-500 text-[10px] uppercase font-bold">Reading Speed ({typingSpeed} WPM)</label>
                        <button
                            onClick={onToggleTheme}
                            className="text-[10px] uppercase font-bold text-yellow-500 hover:text-yellow-400 border border-yellow-500/30 px-2 py-1 rounded"
                        >
                            {theme === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode'}
                        </button>
                    </div>
                    <input type="range" min="20" max="200" step="5" value={typingSpeed} onChange={(e) => onSpeedChange(parseInt(e.target.value))} className="w-full accent-yellow-500" />
                </div>
            </div>
        </div>
    );
};

export default ControlPanel;
