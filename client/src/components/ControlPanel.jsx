import React from 'react';

const ControlPanel = ({ scrollSpeed, setScrollSpeed, onExit, onAddImage }) => {
    return (
        <div className="absolute top-8 left-0 right-0 px-6 flex justify-between items-start z-50 pointer-events-none">
            {/* Left side: Back Button */}
            <div className="pointer-events-auto">
                <button 
                    onClick={onExit}
                    className="bg-black/50 hover:bg-red-500/80 backdrop-blur border border-white/10 text-white w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-lg"
                >
                    <span className="text-xl">✕</span>
                </button>
            </div>

            {/* Right Side: Teleprompter Controls */}
            <div className="flex flex-col items-end gap-3 pointer-events-auto">
                <div className="bg-black/60 backdrop-blur-md border border-slate-700/50 p-3 rounded-2xl flex flex-col items-center gap-2 shadow-2xl">
                    <span className="text-[10px] text-slate-300 uppercase tracking-widest font-black">Speed</span>
                    <div className="flex flex-col items-center gap-1 bg-black/40 rounded-full py-2 px-1">
                        <button 
                            onClick={() => setScrollSpeed(s => Math.min(s + 0.5, 5))}
                            className="w-8 h-8 flex items-center justify-center text-white hover:text-indigo-400 hover:bg-white/10 rounded-full transition-colors font-bold"
                        >
                            +
                        </button>
                        <span className="text-white font-mono text-sm font-bold my-1">{scrollSpeed.toFixed(1)}</span>
                        <button 
                            onClick={() => setScrollSpeed(s => Math.max(s - 0.5, 0))}
                            className="w-8 h-8 flex items-center justify-center text-white hover:text-indigo-400 hover:bg-white/10 rounded-full transition-colors font-bold"
                        >
                            -
                        </button>
                    </div>
                </div>

                <label className="bg-indigo-600/80 hover:bg-indigo-500 backdrop-blur border border-indigo-400/30 text-white w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-[0_0_20px_rgba(79,70,229,0.4)] cursor-pointer">
                    <span className="text-xl">📸</span>
                    <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={onAddImage}
                    />
                </label>
            </div>
        </div>
    );
};

export default ControlPanel;
