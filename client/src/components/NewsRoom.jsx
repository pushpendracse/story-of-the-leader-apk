import React, { useState, useEffect, useRef } from 'react';

const NewsRoom = React.forwardRef(({
    newsData,
    audioEnabled,
    highlightSpeed = 110,
    theme = 'dark',
    isRecording,
    onRecordingComplete,
    cameraStream = null,
    isFrontCamera = true,
    prompterMode = 'center', // 'center' | 'bottom' | 'top'
    prompterHeight = 0.55, // 0.30 to 0.85
    prompterOpacity = 0.80, // 0.20 to 0.95
    fontSize = 20,
    aspectRatio = '9:16',
    textAlign = 'justify',
    highlightStyle = 'karaoke',
    fontFamily = 'serif'
}, ref) => {
    const { heading, content, mediaList, outroImage } = newsData || { heading: '', content: '', mediaList: [], outroImage: null };
    const [currentImgIdx, setCurrentImgIdx] = useState(0);
    const [phase, setPhase] = useState('heading');
    const [showOutro, setShowOutro] = useState(false);

    const scrollRef = useRef(null);
    const textContainerRef = useRef(null);
    const containerRef = useRef(null);
    const cameraVideoRef = useRef(null);

    // Bind camera stream to local preview video element
    useEffect(() => {
        if (cameraVideoRef.current && cameraStream) {
            cameraVideoRef.current.srcObject = cameraStream;
            cameraVideoRef.current.play().catch(e => console.log("Camera preview play notice:", e));
        }
    }, [cameraStream]);

    // Expose internal ref & video element to parent
    React.useImperativeHandle(ref, () => ({
        container: containerRef.current,
        cameraVideo: cameraVideoRef.current
    }));

    // Image Rotation Logic (when camera is not active)
    useEffect(() => {
        if (!cameraStream && mediaList && mediaList.length > 1) {
            const timer = setInterval(() => {
                setCurrentImgIdx(prev => (prev + 1) % mediaList.length);
            }, 8000);
            return () => clearInterval(timer);
        }
    }, [mediaList, cameraStream]);

    // Split content into graphemes
    const graphemes = React.useMemo(() => {
        if (!content) return [];
        const segmenter = typeof Intl !== 'undefined' && Intl.Segmenter
            ? new Intl.Segmenter('hi-IN', { granularity: 'grapheme' })
            : null;
        return segmenter
            ? Array.from(segmenter.segment(content)).map(segment => segment.segment)
            : content.split('');
    }, [content]);

    const progressRef = useRef(0);
    const lastFrameTime = useRef(0);
    const requestRef = useRef();

    // Highlighting Animation Loop
    const animate = (time) => {
        if (lastFrameTime.current !== 0) {
            const deltaTime = time - lastFrameTime.current;
            const clampedDelta = Math.min(deltaTime, 50);

            const wpm = highlightSpeed || 110;
            const charsPerSecond = (wpm * 5) / 60;
            const increment = (clampedDelta / 1000) * charsPerSecond;

            progressRef.current = Math.min(progressRef.current + increment, graphemes.length);
            const currentProgress = progressRef.current;

            if (containerRef.current) {
                containerRef.current.style.setProperty('--progress', currentProgress);
            }

            // Smooth scrolling centered on active reading character
            if (scrollRef.current && textContainerRef.current) {
                // Highly optimized O(1) live collection access instead of heavy querySelectorAll
                const charElements = textContainerRef.current.children;
                const activeChar = charElements[Math.floor(currentProgress)];

                if (activeChar) {
                    const scrollContainer = scrollRef.current;
                    const targetScroll = activeChar.offsetTop - (scrollContainer.clientHeight * 0.35);
                    const currentScroll = scrollContainer.scrollTop;
                    const scrollDiff = targetScroll - currentScroll;

                    if (Math.abs(scrollDiff) > 0.5) {
                        scrollContainer.scrollTop += scrollDiff * 0.12;
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
            if (isRecording) {
                const timer = setTimeout(() => setPhase('content'), 1500);
                return () => clearTimeout(timer);
            }
        }
    }, [content, heading, isRecording]);

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
                }, 4000);
            }
        }, 500);
        return () => clearInterval(interval);
    }, [graphemes.length, isRecording, outroImage, showOutro, onRecordingComplete]);

    const isLight = theme === 'light';
    const containerBg = isLight ? 'bg-neutral-100' : 'bg-black';
    const textColor = isLight ? 'text-black' : 'text-white';
    const overlayGradient = isLight
        ? 'from-white/70 via-transparent to-white/90'
        : (cameraStream ? 'from-black/50 via-transparent to-black/75' : 'from-black/60 via-transparent to-black/85');
    const headerFooterBg = isLight ? 'bg-white/75 border-black/10' : 'bg-black/75 border-white/10';

    let prompterPositionClasses = 'justify-center items-center';
    let cardMaxHeightStyle = `${Math.round(prompterHeight * 100)}%`;

    if (prompterMode === 'bottom') {
        prompterPositionClasses = 'justify-end items-center pb-24';
        cardMaxHeightStyle = `${Math.min(48, Math.round(prompterHeight * 100))}%`;
    } else if (prompterMode === 'top') {
        prompterPositionClasses = 'justify-start items-center pt-2';
        cardMaxHeightStyle = `${Math.min(52, Math.round(prompterHeight * 100))}%`;
    }

    const textAlignClass = textAlign === 'justify' ? 'text-justify' : textAlign === 'center' ? 'text-center' : 'text-left';

    const getFontFamilyStyle = () => {
        switch (fontFamily) {
            case 'handwritten': return '"Kalam", cursive';
            case 'display': return '"Oswald", sans-serif';
            case 'sans-serif': return '"Roboto", sans-serif';
            case 'serif':
            default: return '"Playfair Display", serif';
        }
    };

    const getHighlightStyle = (i) => {
        const progressCalc = `calc((var(--progress, 0) - ${i}) * 100%)`;
        const base = { display: 'inline', whiteSpace: 'pre-wrap' };
        
        if (highlightStyle === 'karaoke' || highlightStyle === 'color') {
            return {
                ...base,
                backgroundImage: `linear-gradient(to right, #f59e0b ${progressCalc}, ${isLight ? '#000000' : '#ffffff'} 0%)`,
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                color: 'transparent'
            };
        } else if (highlightStyle === 'box') {
            return {
                ...base,
                backgroundImage: `linear-gradient(to right, rgba(245, 158, 11, 0.6) ${progressCalc}, transparent 0%)`,
                backgroundClip: 'padding-box',
                WebkitBackgroundClip: 'padding-box',
                color: isLight ? 'black' : 'white',
                borderRadius: '4px'
            };
        } else if (highlightStyle === 'underline') {
            return {
                ...base,
                backgroundImage: `linear-gradient(to right, #f59e0b ${progressCalc}, transparent 0%)`,
                backgroundPosition: 'bottom',
                backgroundSize: '100% 4px',
                backgroundRepeat: 'no-repeat',
                color: isLight ? 'black' : 'white',
            };
        }
        
        // Default / Fallback
        return {
            ...base,
            backgroundImage: `linear-gradient(to right, #f59e0b ${progressCalc}, transparent 0%)`,
            backgroundClip: 'padding-box',
            WebkitBackgroundClip: 'padding-box',
            color: isLight ? 'black' : 'white'
        };
    };

    return (
        <div
            ref={containerRef}
            id="newsroom-container"
            className={`relative flex flex-col overflow-hidden font-serif shadow-2xl transition-all duration-300 ${isRecording
                ? `w-auto h-full ${aspectRatio === '16:9' ? 'aspect-[16/9]' : 'aspect-[9/16]'} border-0`
                : `w-full ${aspectRatio === '16:9' ? 'aspect-[16/9] md:w-[680px] md:h-[380px]' : 'h-[100dvh] md:w-[380px] md:h-[680px]'} md:rounded-3xl md:border-[6px] border-neutral-900`
                } ${containerBg}`}
        >
            {/* Outro Overlay */}
            {showOutro && outroImage && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black animate-fade-in">
                    <img src={outroImage} className="w-full h-full object-cover" alt="Outro" />
                </div>
            )}

            {/* Layer 1: Live Front/Back Camera Stream */}
            {cameraStream && (
                <div className="absolute inset-0 z-0 overflow-hidden bg-black">
                    <video
                        ref={cameraVideoRef}
                        autoPlay
                        playsInline
                        muted
                        className={`w-full h-full object-cover ${isFrontCamera ? '-scale-x-100' : ''}`}
                    />
                </div>
            )}

            {/* Layer 2: Background Images (when camera is OFF) */}
            {!cameraStream && mediaList && mediaList.length > 0 && (
                <div className="absolute inset-0 z-0 overflow-hidden">
                    <div
                        key={currentImgIdx}
                        className="w-full h-full bg-cover bg-center opacity-100 animate-ken-burns transition-all duration-1000"
                        style={{ backgroundImage: `url(${mediaList[currentImgIdx]})` }}
                    ></div>
                </div>
            )}

            {/* Layer 3: Dark contrast gradient overlay */}
            <div className={`absolute inset-0 z-10 bg-gradient-to-b ${overlayGradient} pointer-events-none`}></div>

            {/* Header Section */}
            <div className={`relative p-4 pb-3 backdrop-blur-md z-30 border-b mx-3 mt-3 rounded-2xl shadow-xl ${headerFooterBg} ${isLight ? 'border-gray-300' : 'border-white/10'}`}>
                <h1 className={`text-base md:text-lg font-black text-center uppercase leading-tight line-clamp-2 drop-shadow-md tracking-tight ${textColor}`} style={{ fontFamily: getFontFamilyStyle() }}>
                    {heading}
                </h1>
                <div className="h-[3px] w-14 bg-red-600 mt-2 mx-auto rounded-full shadow-red-500/50 shadow-md"></div>
            </div>

            {/* Content / Prompter Area with Adjustable Mode and Height */}
            <div className={`flex-grow px-3 overflow-hidden z-20 relative flex flex-col ${prompterPositionClasses}`}>
                <div
                    ref={scrollRef}
                    style={{
                        maxHeight: cardMaxHeightStyle,
                        backgroundColor: 'transparent',
                        maskImage: 'linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)',
                        WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)'
                    }}
                    className={`w-full p-4 overflow-y-auto no-scrollbar transition-all duration-300`}
                >
                    <div
                        ref={textContainerRef}
                        style={{ fontSize: `${fontSize}px`, lineHeight: 1.7, fontFamily: getFontFamilyStyle() }}
                        className={`relative drop-shadow-sm font-semibold w-full ${textAlignClass} ${textColor}`}
                    >
                        {graphemes.map((char, i) => (
                            <span
                                key={i}
                                className="char-span relative"
                                style={getHighlightStyle(i)}
                            >
                                {char}
                            </span>
                        ))}
                    </div>
                </div>
            </div>

            {/* Footer Branding Bar */}
            <div className={`relative bottom-0 w-full h-14 backdrop-blur-md border-t flex items-center justify-center z-30 ${headerFooterBg}`}>
                <div className={`border px-3 py-1 rounded-full text-[9px] font-sans tracking-widest uppercase font-black ${isLight ? 'border-black/30 text-gray-700 bg-black/5' : 'border-white/30 text-gray-300 bg-white/5'}`}>
                    Historical Archive • StoryOfTheLeader
                </div>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes kenburns {
                    0% { transform: scale(1) translate(0, 0); }
                    50% { transform: scale(1.15) translate(-10px, -8px); }
                    100% { transform: scale(1) translate(0, 0); }
                }
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                .animate-fade-in { animation: fadeIn 0.4s ease-out forwards; }
                .animate-ken-burns { animation: kenburns 14s ease-in-out infinite; }
                .no-scrollbar::-webkit-scrollbar { display: none; }
            `}} />
        </div>
    );
});

export default NewsRoom;
