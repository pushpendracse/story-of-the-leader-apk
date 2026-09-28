import React, { useState, useEffect, useRef } from 'react';

const NewsRoom = React.forwardRef(({ newsData, audioEnabled, highlightSpeed, theme, isRecording, onRecordingComplete }, ref) => {
    const { heading, content, mediaList, outroImage } = newsData || { heading: '', content: '', mediaList: [], outroImage: null };
    const [currentImgIdx, setCurrentImgIdx] = useState(0);
    const [phase, setPhase] = useState('heading');
    const [showOutro, setShowOutro] = useState(false);

    const scrollRef = useRef(null);
    const containerRef = useRef(null);

    // Expose internal ref to parent
    React.useImperativeHandle(ref, () => ({
        container: containerRef.current
    }));

    // Image Rotation Logic
    useEffect(() => {
        if (mediaList && mediaList.length > 1) {
            const timer = setInterval(() => {
                setCurrentImgIdx(prev => (prev + 1) % mediaList.length);
            }, 8000);
            return () => clearInterval(timer);
        }
    }, [mediaList]);

    // Split content into graphemes
    const graphemes = React.useMemo(() => {
        if (!content) return [];
        const segmenter = new Intl.Segmenter('hi-IN', { granularity: 'grapheme' });
        return Array.from(segmenter.segment(content)).map(segment => segment.segment);
    }, [content]);

    const progressRef = useRef(0);
    const lastFrameTime = useRef(0);
    const requestRef = useRef();

    // Highlighting Animation Loop
    const animate = (time) => {
        if (lastFrameTime.current !== 0) {
            const deltaTime = time - lastFrameTime.current;
            
            // "MAKHAN OPTIMIZATION": Clamp delta time to max 15ms.
            // If the browser lags (e.g. 100ms frame time due to recording),
            // we ONLY advance the highlight by 15ms visually.
            // This prevents "Jumping/Teleporting" and ensures smooth flow.
            const clampedDelta = Math.min(deltaTime, 50);

            // WPM LOGIC:
            // highlightSpeed is now WPM (100-400).
            // Average word length = 5 chars (standard).
            // Chars Per Minute = WPM * 5.
            // Chars Per Second = (WPM * 5) / 60.
            const wpm = highlightSpeed || 150; // Reduced default speed to make it slower
            const charsPerSecond = (wpm * 5) / 60;

            // Increment based on time elapsed (sec/1000) * speed (chars/sec)
            const increment = (clampedDelta / 1000) * charsPerSecond;

            progressRef.current = Math.min(progressRef.current + increment, graphemes.length);
            const currentProgress = progressRef.current;

            if (containerRef.current) {
                containerRef.current.style.setProperty('--progress', currentProgress);
            }

            // Ultra-smooth pixel-by-pixel scrolling - very slow movement
            if (scrollRef.current && containerRef.current) {
                const charElements = containerRef.current.querySelectorAll('.char-span');
                const activeChar = charElements[Math.floor(currentProgress)];

                if (activeChar) {
                    const targetScroll = activeChar.offsetTop - 250;
                    const currentScroll = scrollRef.current.scrollTop;
                    const scrollDiff = targetScroll - currentScroll;

                    // Very gradual scrolling for ultra-smooth movement
                    if (Math.abs(scrollDiff) > 0.1) {
                        // Move only a tiny fraction to make it extremely slow
                        scrollRef.current.scrollTop += scrollDiff * 0.1;
                    }
                }
            }
        }
        lastFrameTime.current = time;
        if (progressRef.current < graphemes.length) {
            requestRef.current = requestAnimationFrame(animate);
        }
    };

    // Reset Progress
    useEffect(() => {
        if (content) {
            progressRef.current = 0;
            if (containerRef.current) containerRef.current.style.setProperty('--progress', 0);
            setCurrentImgIdx(0);
            setPhase('heading');
            setShowOutro(false);
            setTimeout(() => setPhase('content'), 1000);
        }
    }, [content, heading]);

    // Phase Trigger
    useEffect(() => {
        if (phase === 'content' && progressRef.current < graphemes.length) {
            requestRef.current = requestAnimationFrame(animate);
        }
        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
            lastFrameTime.current = 0;
        };
    }, [phase, highlightSpeed, graphemes.length]);

    // Outro Logic
    useEffect(() => {
        const interval = setInterval(() => {
            if (isRecording && progressRef.current >= graphemes.length && graphemes.length > 0 && !showOutro) {
                clearInterval(interval);
                setTimeout(() => {
                    if (outroImage) {
                        setShowOutro(true);
                        setTimeout(() => onRecordingComplete?.(), 4000);
                    } else {
                        onRecordingComplete?.();
                    }
                }, 2000);
            }
        }, 500);
        return () => clearInterval(interval);
    }, [graphemes.length, isRecording, outroImage, showOutro, onRecordingComplete]);

    const isLight = theme === 'light';
    const containerBg = isLight ? 'bg-white' : 'bg-black';
    const textColor = isLight ? 'text-black' : 'text-white';
    const overlayGradient = isLight ? 'from-white/60 via-transparent to-white/80' : 'from-black/60 via-transparent to-black/80';
    const glassBg = isLight ? 'bg-white/10 border-black/5' : 'bg-black/10 border-white/5';
    const headerFooterBg = isLight ? 'bg-white/60 border-black/10' : 'bg-black/60 border-white/10';

    return (
        <div
            ref={containerRef}
            id="newsroom-container"
            className={`relative flex flex-col overflow-hidden font-serif shadow-2xl transition-all duration-300 ${isRecording
                ? 'w-auto h-full aspect-[9/16] border-0'
                : 'w-full h-[100dvh] md:w-[360px] md:h-[640px] md:border-[6px] border-black'
                } ${containerBg}`}
        >
            {/* Outro Overlay */}
            {showOutro && outroImage && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black animate-fade-in">
                    <img src={outroImage} className="w-full h-full object-cover" alt="Outro" />
                </div>
            )}

            {/* Background Layer */}
            {mediaList && mediaList.length > 0 && (
                <div className="absolute inset-0 z-0 overflow-hidden">
                    <div
                        key={currentImgIdx}
                        className="w-full h-full bg-cover bg-center opacity-100 animate-ken-burns transition-all duration-1000"
                        style={{ backgroundImage: `url(${mediaList[currentImgIdx]})` }}
                    ></div>
                    <div className={`absolute inset-0 bg-gradient-to-b ${overlayGradient}`}></div>
                </div>
            )}

            {/* Header */}
            <div className={`p-6 pb-4 backdrop-blur-md z-30 border-b mx-4 mt-4 rounded-xl shadow-lg ${headerFooterBg} ${isLight ? 'border-gray-200' : 'border-white/10'}`}>
                <h1 className={`text-xl font-black text-center uppercase leading-tight line-clamp-2 drop-shadow-md ${textColor}`}>{heading}</h1>
                <div className="h-[4px] w-16 bg-red-600 mt-3 mx-auto rounded-full shadow-red-500/50 shadow-lg"></div>
            </div>

            {/* Content Area */}
            <div ref={scrollRef} className="flex-grow px-4 overflow-y-auto pt-8 pb-32 no-scrollbar z-20 relative">
                <div className={`p-4 rounded-2xl border shadow-2xl mx-2 my-4 ${glassBg}`}>
                    <div className={`text-[18px] text-center leading-[1.8] relative whitespace-pre-wrap drop-shadow-sm ${textColor}`}>
                        {graphemes.map((char, i) => (
                            <span
                                key={i}
                                className="char-span relative"
                                style={{
                                    backgroundImage: `linear-gradient(to right, #e88c0a calc((var(--progress, 0) - ${i}) * 100%), transparent 0%)`,
                                    backgroundClip: 'padding-box',
                                    WebkitBackgroundClip: 'padding-box',
                                    display: 'inline',
                                    whiteSpace: 'pre-wrap',
                                    color: (isLight ? 'black' : 'white'),
                                    transition: 'color 0.1s ease-out'
                                }}
                            >
                                {char}
                            </span>
                        ))}
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className={`absolute bottom-0 w-full h-20 backdrop-blur-md border-t flex items-center justify-center z-30 ${headerFooterBg}`}>
                <div className={`border px-4 py-1 rounded text-[10px] font-sans tracking-widest uppercase font-bold ${isLight ? 'border-black/30 text-gray-600 bg-black/5' : 'border-white/30 text-gray-300 bg-white/5'}`}>
                    Historical Archive • StoryOfTheLeader
                </div>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes kenburns {
                    0% { transform: scale(1) translate(0, 0); }
                    50% { transform: scale(1.2) translate(-15px, -10px); }
                    100% { transform: scale(1) translate(0, 0); }
                }
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                .animate-fade-in { animation: fadeIn 0.5s ease-out forwards; }
                .animate-ken-burns { animation: kenburns 15s ease-in-out infinite; }
                .no-scrollbar::-webkit-scrollbar { display: none; }
            `}} />
        </div>
    );
});

export default NewsRoom;
