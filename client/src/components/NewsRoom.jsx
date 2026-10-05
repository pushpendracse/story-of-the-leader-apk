import React, { useState } from 'react';

const NewsRoom = ({ onStartStudio }) => {
    const [heading, setHeading] = useState('');
    const [script, setScript] = useState('');
    const [images, setImages] = useState([]);

    const handleImageUpload = (e) => {
        const files = Array.from(e.target.files);
        if (images.length + files.length > 5) {
            alert('You can only upload up to 5 images max.');
            return;
        }

        const newImages = files.map(file => {
            const url = URL.createObjectURL(file);
            return { file, url };
        });

        setImages(prev => [...prev, ...newImages]);
    };

    const removeImage = (indexToRemove) => {
        setImages(prev => {
            const newImages = [...prev];
            URL.revokeObjectURL(newImages[indexToRemove].url);
            newImages.splice(indexToRemove, 1);
            return newImages;
        });
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onStartStudio({
            heading: heading || 'BREAKING NEWS',
            script: script || 'Welcome to the news room broadcast. This teleprompter automatically animates your script with high precision.',
            images
        });
    };

    return (
        <div className="w-full max-w-2xl mx-auto p-6 md:p-10 bg-slate-900/50 backdrop-blur-xl rounded-3xl border border-slate-800 shadow-2xl overflow-y-auto max-h-[100dvh]">
            <div className="text-center mb-8">
                <h1 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400 mb-2 tracking-tight">
                    Story of the Leader
                </h1>
                <p className="text-slate-400 font-medium tracking-wide text-sm">Professional Mobile Studio & Teleprompter</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                
                {/* Heading Input */}
                <div className="space-y-2">
                    <label className="block text-sm font-bold text-slate-300 uppercase tracking-widest">
                        News Heading
                    </label>
                    <input
                        type="text"
                        value={heading}
                        onChange={(e) => setHeading(e.target.value)}
                        placeholder="Enter breaking news heading..."
                        className="w-full bg-slate-950/50 border border-slate-800 text-white px-5 py-4 rounded-2xl focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all font-bold text-lg placeholder:text-slate-600"
                        maxLength={60}
                    />
                </div>

                {/* Script Input */}
                <div className="space-y-2">
                    <div className="flex justify-between items-end">
                        <label className="block text-sm font-bold text-slate-300 uppercase tracking-widest">
                            Teleprompter Script
                        </label>
                        <span className="text-xs font-mono text-slate-500">{script.length} chars</span>
                    </div>
                    <textarea
                        value={script}
                        onChange={(e) => setScript(e.target.value)}
                        placeholder="Type or paste your full script here. It will automatically scroll on the screen..."
                        rows={6}
                        className="w-full bg-slate-950/50 border border-slate-800 text-slate-200 px-5 py-4 rounded-2xl focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all resize-none leading-relaxed"
                    />
                </div>

                {/* Media Upload */}
                <div className="space-y-3">
                    <label className="block text-sm font-bold text-slate-300 uppercase tracking-widest">
                        Visuals & Media ({images.length}/5)
                    </label>
                    
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {images.map((img, index) => (
                            <div key={index} className="relative aspect-[4/3] rounded-xl overflow-hidden group border border-slate-700 bg-black">
                                <img src={img.url} alt={`Upload ${index}`} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                                <button
                                    type="button"
                                    onClick={() => removeImage(index)}
                                    className="absolute top-2 right-2 bg-red-500/80 hover:bg-red-500 text-white w-8 h-8 rounded-full flex items-center justify-center backdrop-blur shadow-lg transition-transform active:scale-95"
                                >
                                    ✕
                                </button>
                            </div>
                        ))}
                        
                        {images.length < 5 && (
                            <label className="aspect-[4/3] rounded-xl border-2 border-dashed border-slate-700 hover:border-indigo-500 hover:bg-indigo-500/5 transition-all flex flex-col items-center justify-center cursor-pointer text-slate-500 hover:text-indigo-400 gap-2">
                                <span className="text-3xl">📸</span>
                                <span className="text-xs font-bold uppercase tracking-wider">Add Photo</span>
                                <input
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    onChange={handleImageUpload}
                                    className="hidden"
                                />
                            </label>
                        )}
                    </div>
                </div>

                <div className="pt-4">
                    <button
                        type="submit"
                        className="w-full bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-black text-lg py-5 px-6 rounded-2xl shadow-[0_0_40px_rgba(79,70,229,0.3)] active:scale-95 transition-all flex items-center justify-center gap-3 uppercase tracking-widest"
                    >
                        <span>🎬 Start Studio</span>
                    </button>
                </div>
            </form>
        </div>
    );
};

export default NewsRoom;
