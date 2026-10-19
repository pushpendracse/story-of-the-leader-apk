import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { saveReelVideo } from '../utils/nativeFileSaver';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';

/**
 * Enterprise Multi-Track Timeline Studio (CapCut & Canva-Grade)
 * 
 * Major Features:
 * 1. Dual Theme System: Enterprise Light Mode & Sleek Dark Mode (1-Click Toggle)
 * 2. CapCut-Style Timeline:
 *    - Draggable Clips (Move left/right along timeline)
 *    - Edge Trimming Handles (Drag left/right borders to trim duration)
 *    - Split / Cut Clip at Playhead (✂️ Split)
 *    - Duplicate Clip (📑) & Delete (🗑️)
 *    - Undo / Redo History (⏪ / ⏩)
 *    - Zoom In / Zoom Out (1x to 4x slider & buttons)
 *    - High-Precision Time Ruler with Snapping
 * 3. Track Controls:
 *    - 👁️ Visibility Toggle (Hide/Show Image, Text, Marker, Video layer)
 *    - 🔒 Lock Track
 *    - 🔇 Mute Audio / BGM
 * 4. Canva-Style Left Navigation Rail:
 *    - 📁 Media & Uploads (Photos, Videos)
 *    - ✍️ Script & Captions (Styles, Lower-Third Labels, Subtitles, Karaoke Toggle)
 *    - ⭕ Focus Markers (Circle Spotlight, Freehand Marker, Arrow, Focus Box with Auto-Fade)
 *    - 🎵 Music & BGM (Synthesized News Beat, Custom MP3, Ducking Volume)
 *    - 🪄 Animations & Transitions (Zoom Ken Burns, Slide Up/Left, Fade, Elastic Pop)
 *    - 🛡️ Voice Cleaner (Web Audio Highpass + Notch + Dynamics Compressor)
 * 5. Full HD MP4/WebM Export Engine with Native Gallery Save & Social Share
 */

const TimelineStudio = ({
    initialVideo = null,       // { url, blob, ext, sizeMb }
    initialNews = null,        // { heading, content, mediaList, outroImage }
    onClose,
    onSaveSuccess
}) => {
    // ==========================================
    // 1. THEME: LIGHT & DARK MODE
    // ==========================================
    const [studioTheme, setStudioTheme] = useState('dark'); // 'dark' | 'light'
    const isDark = studioTheme === 'dark';

    // ==========================================
    // 2. VIDEO & PLAYBACK STATES
    // ==========================================
    const [videoSrc, setVideoSrc] = useState(initialVideo?.url || null);
    const [videoBlob, setVideoBlob] = useState(initialVideo?.blob || null);
    const [duration, setDuration] = useState(15);
    const [currentTime, setCurrentTime] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [aspectRatio, setAspectRatio] = useState('9:16'); // '9:16' or '16:9'

    // ==========================================
    // 3. CANVA-STYLE NAVIGATION & ACTIVE TOOL
    // ==========================================
    const [activeSidebarTab, setActiveSidebarTab] = useState('images'); // 'images' | 'text' | 'marker' | 'bgm' | 'audio' | 'transitions'

    // ==========================================
    // 4. TIMELINE CONTROLS (ZOOM, SNAPPING, DRAG)
    // ==========================================
    const [timelineZoom, setTimelineZoom] = useState(1.0); // 1.0x to 3.5x
    const [isSnappingEnabled, setIsSnappingEnabled] = useState(true);
    const [selectedClip, setSelectedClip] = useState(null); // { type: 'images'|'text'|'marker', id: string }
    const [dragState, setDragState] = useState(null); // For dragging & trimming clips

    // Track Visibilities & Mutes
    const [trackVisibility, setTrackVisibility] = useState({
        video: true,
        images: true,
        text: true,
        marker: true,
        bgm: true
    });

    const [trackLocked, setTrackLocked] = useState({
        video: false,
        images: false,
        text: false,
        marker: false,
        bgm: false
    });

    // ==========================================
    // 5. TRACK DATA (IMAGES, TEXT, MARKERS, BGM)
    // ==========================================
    // Track 2: Images
    const [imageTracks, setImageTracks] = useState(() => {
        const initialList = initialNews?.mediaList || [];
        if (initialList.length === 0) return [];
        const segDuration = Math.max(3, Math.min(8, 15 / initialList.length));
        return initialList.map((src, index) => ({
            id: `img_${index}_${Date.now()}`,
            src,
            name: `Slide Photo ${index + 1}`,
            startTime: Number((index * segDuration).toFixed(1)),
            duration: Number(segDuration.toFixed(1)),
            animation: index % 3 === 0 ? 'zoom-in' : index % 3 === 1 ? 'slide-bottom' : 'fade',
            position: 'cover' // 'cover' | 'pip' | 'top'
        }));
    });

    // Track 3: Text & Captions
    const [textTracks, setTextTracks] = useState(() => {
        const content = initialNews?.content || '';
        const heading = initialNews?.heading || 'BREAKING NEWS';
        if (!content) {
            return [
                {
                    id: 'txt_0',
                    text: heading,
                    startTime: 0,
                    duration: 5,
                    isHighlightEnabled: false,
                    displayStyle: 'label' // 'label' or 'subtitle'
                }
            ];
        }
        const sentences = content.split(/(?<=[.!?।\n])\s+/).filter(Boolean);
        const segDuration = Math.max(4, 15 / Math.max(1, sentences.length));
        return sentences.map((sen, index) => ({
            id: `txt_${index}_${Date.now()}`,
            text: sen.trim(),
            startTime: Number((index * segDuration).toFixed(1)),
            duration: Number(segDuration.toFixed(1)),
            isHighlightEnabled: true,
            displayStyle: index === 0 ? 'label' : 'subtitle'
        }));
    });
    const [globalHighlightEnabled, setGlobalHighlightEnabled] = useState(true);

    // Track 4: Focus Markers (Disappearing Highlighter / Circle)
    const [markerTracks, setMarkerTracks] = useState([]);
    const [isDrawingMarker, setIsDrawingMarker] = useState(false);
    const [markerType, setMarkerType] = useState('circle'); // 'circle' | 'hand' | 'box' | 'arrow'
    const [markerColor, setMarkerColor] = useState('#f59e0b');
    const [markerDuration, setMarkerDuration] = useState(2.0);
    const [currentPath, setCurrentPath] = useState([]);
    const [dragStart, setDragStart] = useState(null);

    // Track 5: BGM
    const [bgmSrc, setBgmSrc] = useState(null);
    const [bgmName, setBgmName] = useState('None');
    const [bgmVolume, setBgmVolume] = useState(0.25);
    const [isGeneratingBgm, setIsGeneratingBgm] = useState(false);

    // Audio Enhancement
    const [noiseReductionEnabled, setNoiseReductionEnabled] = useState(true);
    const [noiseReductionStrength, setNoiseReductionStrength] = useState('medium');
    const [voiceVolume, setVoiceVolume] = useState(1.0);

    // Export States
    const [isExporting, setIsExporting] = useState(false);
    const [exportProgress, setExportProgress] = useState(0);
    const [exportedUrl, setExportedUrl] = useState(null);
    const [exportedBlob, setExportedBlob] = useState(null);

    // Undo / Redo History
    const [history, setHistory] = useState([]);
    const [historyIndex, setHistoryIndex] = useState(-1);

    // Snapshot state for Undo/Redo
    const pushHistorySnapshot = useCallback(() => {
        const snapshot = {
            images: JSON.parse(JSON.stringify(imageTracks)),
            texts: JSON.parse(JSON.stringify(textTracks)),
            markers: JSON.parse(JSON.stringify(markerTracks))
        };
        setHistory(prev => [...prev.slice(0, historyIndex + 1), snapshot]);
        setHistoryIndex(prev => prev + 1);
    }, [imageTracks, textTracks, markerTracks, historyIndex]);

    const handleUndo = () => {
        if (historyIndex > 0) {
            const prevState = history[historyIndex - 1];
            setImageTracks(prevState.images);
            setTextTracks(prevState.texts);
            setMarkerTracks(prevState.markers);
            setHistoryIndex(prev => prev - 1);
        }
    };

    const handleRedo = () => {
        if (historyIndex < history.length - 1) {
            const nextState = history[historyIndex + 1];
            setImageTracks(nextState.images);
            setTextTracks(nextState.texts);
            setMarkerTracks(nextState.markers);
            setHistoryIndex(prev => prev + 1);
        }
    };

    // DOM Refs
    const videoRef = useRef(null);
    const bgmAudioRef = useRef(null);
    const previewCanvasRef = useRef(null);
    const overlayCanvasRef = useRef(null);
    const timelineContainerRef = useRef(null);
    const timelineScrollWrapperRef = useRef(null);
    const animFrameRef = useRef(null);
    const imageCacheRef = useRef(new Map());

    // Preload & Cache Images
    useEffect(() => {
        imageTracks.forEach(item => {
            if (item.src && !imageCacheRef.current.has(item.src)) {
                const img = new Image();
                if (!item.src.startsWith('data:')) img.crossOrigin = 'anonymous';
                img.src = item.src;
                img.onload = () => imageCacheRef.current.set(item.src, img);
            }
        });
    }, [imageTracks]);

    // Update duration when video metadata loads
    const onVideoLoadedMetadata = () => {
        if (videoRef.current) {
            const vidDuration = videoRef.current.duration;
            if (vidDuration && !isNaN(vidDuration) && isFinite(vidDuration)) {
                setDuration(Math.max(5, Math.round(vidDuration * 10) / 10));
            }
        }
    };

    const onVideoTimeUpdate = () => {
        if (videoRef.current && isPlaying) {
            setCurrentTime(videoRef.current.currentTime);
        }
    };

    // Playback Toggle
    const togglePlay = () => {
        if (!videoRef.current) return;
        if (isPlaying) {
            videoRef.current.pause();
            if (bgmAudioRef.current) bgmAudioRef.current.pause();
            setIsPlaying(false);
        } else {
            if (videoRef.current.currentTime >= duration - 0.2) {
                videoRef.current.currentTime = 0;
            }
            videoRef.current.play().then(() => {
                if (bgmAudioRef.current && bgmSrc && trackVisibility.bgm) {
                    bgmAudioRef.current.currentTime = videoRef.current.currentTime % (bgmAudioRef.current.duration || 10);
                    bgmAudioRef.current.volume = bgmVolume;
                    bgmAudioRef.current.play().catch(() => {});
                }
                setIsPlaying(true);
            }).catch(e => console.log("Play error:", e));
        }
    };

    // Stop Playback Function (Pauses video and resets playhead to start)
    const handleStopPlayback = () => {
        if (videoRef.current) {
            videoRef.current.pause();
            videoRef.current.currentTime = 0;
        }
        if (bgmAudioRef.current) {
            bgmAudioRef.current.pause();
            bgmAudioRef.current.currentTime = 0;
        }
        setIsPlaying(false);
        setCurrentTime(0);
    };

    // Seek Playhead
    const handleSeek = (newTime) => {
        const clamped = Math.max(0, Math.min(duration, newTime));
        setCurrentTime(clamped);
        if (videoRef.current) {
            videoRef.current.currentTime = clamped;
        }
        if (bgmAudioRef.current && bgmSrc) {
            bgmAudioRef.current.currentTime = clamped % (bgmAudioRef.current.duration || 10);
        }
    };

    // ==========================================
    // CAPCUT-STYLE CLIP SPLIT / CUT FUNCTIONALITY
    // ==========================================
    const handleSplitClipAtPlayhead = () => {
        if (!selectedClip) {
            // Find clip under playhead automatically
            const imgUnderPlayhead = imageTracks.find(img => currentTime > img.startTime + 0.3 && currentTime < img.startTime + img.duration - 0.3);
            if (imgUnderPlayhead) {
                splitImageClip(imgUnderPlayhead.id);
                return;
            }
            const txtUnderPlayhead = textTracks.find(txt => currentTime > txt.startTime + 0.3 && currentTime < txt.startTime + txt.duration - 0.3);
            if (txtUnderPlayhead) {
                splitTextClip(txtUnderPlayhead.id);
                return;
            }
            alert("Place playhead over an image or text clip to split it!");
            return;
        }

        if (selectedClip.type === 'images') {
            splitImageClip(selectedClip.id);
        } else if (selectedClip.type === 'text') {
            splitTextClip(selectedClip.id);
        }
    };

    const splitImageClip = (id) => {
        const target = imageTracks.find(img => img.id === id);
        if (!target) return;
        if (currentTime <= target.startTime + 0.3 || currentTime >= target.startTime + target.duration - 0.3) {
            alert("Playhead must be inside the clip to cut it!");
            return;
        }
        pushHistorySnapshot();

        const firstDuration = Number((currentTime - target.startTime).toFixed(1));
        const secondDuration = Number((target.duration - firstDuration).toFixed(1));

        const clip1 = { ...target, duration: firstDuration };
        const clip2 = {
            ...target,
            id: `img_split_${Date.now()}`,
            name: `${target.name} (Part 2)`,
            startTime: Number(currentTime.toFixed(1)),
            duration: secondDuration
        };

        setImageTracks(prev => prev.flatMap(img => img.id === id ? [clip1, clip2] : [img]));
        setSelectedClip({ type: 'images', id: clip2.id });
    };

    const splitTextClip = (id) => {
        const target = textTracks.find(txt => txt.id === id);
        if (!target) return;
        if (currentTime <= target.startTime + 0.3 || currentTime >= target.startTime + target.duration - 0.3) {
            alert("Playhead must be inside the text segment to cut it!");
            return;
        }
        pushHistorySnapshot();

        const words = target.text.split(' ');
        const midWord = Math.floor(words.length / 2);
        const text1 = words.slice(0, midWord).join(' ') || target.text;
        const text2 = words.slice(midWord).join(' ') || target.text;

        const firstDuration = Number((currentTime - target.startTime).toFixed(1));
        const secondDuration = Number((target.duration - firstDuration).toFixed(1));

        const clip1 = { ...target, text: text1, duration: firstDuration };
        const clip2 = {
            ...target,
            id: `txt_split_${Date.now()}`,
            text: text2,
            startTime: Number(currentTime.toFixed(1)),
            duration: secondDuration
        };

        setTextTracks(prev => prev.flatMap(txt => txt.id === id ? [clip1, clip2] : [txt]));
        setSelectedClip({ type: 'text', id: clip2.id });
    };

    // Duplicate selected clip
    const handleDuplicateClip = () => {
        if (!selectedClip) return;
        pushHistorySnapshot();

        if (selectedClip.type === 'images') {
            const target = imageTracks.find(i => i.id === selectedClip.id);
            if (!target) return;
            const newStart = Math.min(duration - 1, target.startTime + target.duration + 0.2);
            const dup = {
                ...target,
                id: `img_dup_${Date.now()}`,
                name: `${target.name} (Copy)`,
                startTime: Number(newStart.toFixed(1))
            };
            setImageTracks(prev => [...prev, dup]);
            setSelectedClip({ type: 'images', id: dup.id });
        } else if (selectedClip.type === 'text') {
            const target = textTracks.find(t => t.id === selectedClip.id);
            if (!target) return;
            const newStart = Math.min(duration - 1, target.startTime + target.duration + 0.2);
            const dup = {
                ...target,
                id: `txt_dup_${Date.now()}`,
                startTime: Number(newStart.toFixed(1))
            };
            setTextTracks(prev => [...prev, dup]);
            setSelectedClip({ type: 'text', id: dup.id });
        }
    };

    // Delete selected clip
    const handleDeleteClip = () => {
        if (!selectedClip) return;
        pushHistorySnapshot();

        if (selectedClip.type === 'images') {
            setImageTracks(prev => prev.filter(i => i.id !== selectedClip.id));
        } else if (selectedClip.type === 'text') {
            setTextTracks(prev => prev.filter(t => t.id !== selectedClip.id));
        } else if (selectedClip.type === 'marker') {
            setMarkerTracks(prev => prev.filter(m => m.id !== selectedClip.id));
        }
        setSelectedClip(null);
    };

    // ==========================================
    // CAPCUT-STYLE DRAGGING & TRIMMING HANDLERS
    // ==========================================
    const startClipDrag = (e, trackType, item, handleType) => {
        e.stopPropagation();
        if (trackLocked[trackType]) return;

        setSelectedClip({ type: trackType, id: item.id });
        setDragState({
            trackType,
            itemId: item.id,
            handle: handleType, // 'move' | 'left' | 'right'
            startX: e.clientX,
            initialStartTime: item.startTime,
            initialDuration: item.duration
        });
    };

    const onTimelinePointerMove = (e) => {
        if (!dragState) return;
        const rect = timelineContainerRef.current?.getBoundingClientRect();
        if (!rect) return;

        const effectiveWidth = rect.width * timelineZoom;
        const pixelsPerSec = effectiveWidth / duration;
        const deltaPx = e.clientX - dragState.startX;
        const deltaSec = deltaPx / pixelsPerSec;

        const updateItemTime = (trackType, id, newStart, newDur) => {
            if (trackType === 'images') {
                setImageTracks(prev => prev.map(item => item.id === id ? { ...item, startTime: newStart, duration: newDur } : item));
            } else if (trackType === 'text') {
                setTextTracks(prev => prev.map(item => item.id === id ? { ...item, startTime: newStart, duration: newDur } : item));
            } else if (trackType === 'marker') {
                setMarkerTracks(prev => prev.map(item => item.id === id ? { ...item, startTime: newStart, duration: newDur } : item));
            }
        };

        if (dragState.handle === 'move') {
            let targetStart = Math.max(0, Math.min(duration - dragState.initialDuration, dragState.initialStartTime + deltaSec));
            if (isSnappingEnabled) {
                if (Math.abs(targetStart - currentTime) < 0.25) targetStart = currentTime;
            }
            updateItemTime(dragState.trackType, dragState.itemId, Number(targetStart.toFixed(1)), dragState.initialDuration);

        } else if (dragState.handle === 'left') {
            let targetStart = Math.max(0, Math.min(dragState.initialStartTime + dragState.initialDuration - 0.5, dragState.initialStartTime + deltaSec));
            if (isSnappingEnabled && Math.abs(targetStart - currentTime) < 0.25) targetStart = currentTime;
            const newDur = (dragState.initialStartTime + dragState.initialDuration) - targetStart;
            updateItemTime(dragState.trackType, dragState.itemId, Number(targetStart.toFixed(1)), Number(newDur.toFixed(1)));

        } else if (dragState.handle === 'right') {
            let targetDur = Math.max(0.5, Math.min(duration - dragState.initialStartTime, dragState.initialDuration + deltaSec));
            const targetEnd = dragState.initialStartTime + targetDur;
            if (isSnappingEnabled && Math.abs(targetEnd - currentTime) < 0.25) {
                targetDur = Math.max(0.5, currentTime - dragState.initialStartTime);
            }
            updateItemTime(dragState.trackType, dragState.itemId, dragState.initialStartTime, Number(targetDur.toFixed(1)));
        }
    };

    const onTimelinePointerUp = () => {
        if (dragState) {
            pushHistorySnapshot();
            setDragState(null);
        }
    };

    // ==========================================
    // INTERACTIVE DRAWING (MARKER / FOCUS CIRCLE)
    // ==========================================
    const handleCanvasPointerDown = (e) => {
        if (!isDrawingMarker) return;
        const canvas = overlayCanvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;

        setDragStart({ x, y });
        if (markerType === 'hand') {
            setCurrentPath([{ x, y }]);
        }
    };

    const handleCanvasPointerMove = (e) => {
        if (!isDrawingMarker || !dragStart) return;
        const canvas = overlayCanvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;

        if (markerType === 'hand') {
            setCurrentPath(prev => [...prev, { x, y }]);
        }
    };

    const handleCanvasPointerUp = (e) => {
        if (!isDrawingMarker || !dragStart) return;
        const canvas = overlayCanvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;

        let newMarker = null;
        if (markerType === 'circle') {
            const radius = Math.max(0.04, Math.hypot(x - dragStart.x, y - dragStart.y));
            newMarker = {
                id: `marker_${Date.now()}`,
                type: 'circle',
                startTime: Number(currentTime.toFixed(1)),
                duration: markerDuration,
                color: markerColor,
                cx: dragStart.x,
                cy: dragStart.y,
                radius: Math.min(0.4, radius)
            };
        } else if (markerType === 'box') {
            newMarker = {
                id: `marker_${Date.now()}`,
                type: 'box',
                startTime: Number(currentTime.toFixed(1)),
                duration: markerDuration,
                color: markerColor,
                x: Math.min(dragStart.x, x),
                y: Math.min(dragStart.y, y),
                w: Math.max(0.05, Math.abs(x - dragStart.x)),
                h: Math.max(0.05, Math.abs(y - dragStart.y))
            };
        } else if (markerType === 'arrow') {
            newMarker = {
                id: `marker_${Date.now()}`,
                type: 'arrow',
                startTime: Number(currentTime.toFixed(1)),
                duration: markerDuration,
                color: markerColor,
                fromX: dragStart.x,
                fromY: dragStart.y,
                toX: x,
                toY: y
            };
        } else if (markerType === 'hand' && currentPath.length > 2) {
            newMarker = {
                id: `marker_${Date.now()}`,
                type: 'hand',
                startTime: Number(currentTime.toFixed(1)),
                duration: markerDuration,
                color: markerColor,
                points: currentPath
            };
        }

        if (newMarker) {
            pushHistorySnapshot();
            setMarkerTracks(prev => [...prev, newMarker]);
            setSelectedClip({ type: 'marker', id: newMarker.id });
        }

        setDragStart(null);
        setCurrentPath([]);
        setIsDrawingMarker(false);
    };

    // ==========================================
    // FRAME COMPOSITING ENGINE
    // ==========================================
    const renderCompositeFrame = (ctx, canvasWidth, canvasHeight, timestamp) => {
        ctx.clearRect(0, 0, canvasWidth, canvasHeight);
        ctx.fillStyle = isDark ? '#0b0f19' : '#ffffff';
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);

        // 1. Draw Base Video
        const video = videoRef.current;
        if (trackVisibility.video && video && video.readyState >= 2) {
            const vW = video.videoWidth || 1080;
            const vH = video.videoHeight || 1920;
            const scale = Math.max(canvasWidth / vW, canvasHeight / vH);
            const drawW = vW * scale;
            const drawH = vH * scale;
            const dx = (canvasWidth - drawW) / 2;
            const dy = (canvasHeight - drawH) / 2;
            ctx.drawImage(video, dx, dy, drawW, drawH);
        }

        // 2. Draw Images Track (with entrance animations)
        if (trackVisibility.images) {
            const activeImgTrack = imageTracks.find(
                img => timestamp >= img.startTime && timestamp < (img.startTime + img.duration)
            );

            if (activeImgTrack && activeImgTrack.src) {
                const cachedImg = imageCacheRef.current.get(activeImgTrack.src);
                if (cachedImg && cachedImg.complete && cachedImg.naturalWidth > 0) {
                    const imgElapsed = timestamp - activeImgTrack.startTime;
                    const animDuration = 0.8;
                    const animProgress = Math.min(1, Math.max(0, imgElapsed / animDuration));
                    const easeOut = 1 - Math.pow(1 - animProgress, 3);

                    ctx.save();
                    let scale = 1.0;
                    let translateX = 0;
                    let translateY = 0;
                    let alpha = 1.0;

                    const totalProgress = imgElapsed / activeImgTrack.duration;
                    const continuousZoom = 1.0 + (0.08 * totalProgress);

                    if (activeImgTrack.animation === 'zoom-in') {
                        scale = (0.75 + 0.25 * easeOut) * continuousZoom;
                        alpha = easeOut;
                    } else if (activeImgTrack.animation === 'slide-bottom') {
                        translateY = (1 - easeOut) * (canvasHeight * 0.4);
                        alpha = easeOut;
                        scale = continuousZoom;
                    } else if (activeImgTrack.animation === 'slide-left') {
                        translateX = -(1 - easeOut) * (canvasWidth * 0.5);
                        alpha = easeOut;
                        scale = continuousZoom;
                    } else if (activeImgTrack.animation === 'fade') {
                        alpha = easeOut;
                        scale = continuousZoom;
                    } else if (activeImgTrack.animation === 'pop') {
                        const popScale = animProgress < 0.8 ? (animProgress / 0.8) * 1.08 : 1.08 - ((animProgress - 0.8) / 0.2) * 0.08;
                        scale = popScale * continuousZoom;
                        alpha = easeOut;
                    }

                    ctx.globalAlpha = alpha;
                    const iw = cachedImg.naturalWidth;
                    const ih = cachedImg.naturalHeight;
                    let targetW = canvasWidth;
                    let targetH = canvasHeight;
                    let targetX = 0;
                    let targetY = 0;

                    if (activeImgTrack.position === 'pip') {
                        targetW = canvasWidth * 0.45;
                        targetH = targetW * (ih / iw);
                        targetX = canvasWidth * 0.5;
                        targetY = canvasHeight * 0.15;
                        ctx.shadowColor = 'rgba(0,0,0,0.7)';
                        ctx.shadowBlur = 25;
                    } else if (activeImgTrack.position === 'top') {
                        targetW = canvasWidth * 0.88;
                        targetH = targetW * 0.65;
                        targetX = (canvasWidth - targetW) / 2;
                        targetY = canvasHeight * 0.12;
                    } else {
                        const imgScale = Math.max(canvasWidth / iw, canvasHeight / ih);
                        targetW = iw * imgScale;
                        targetH = ih * imgScale;
                        targetX = (canvasWidth - targetW) / 2;
                        targetY = (canvasHeight - targetH) / 2;
                    }

                    const cx = targetX + targetW / 2 + translateX;
                    const cy = targetY + targetH / 2 + translateY;
                    ctx.translate(cx, cy);
                    ctx.scale(scale, scale);
                    ctx.drawImage(cachedImg, -targetW / 2, -targetH / 2, targetW, targetH);
                    ctx.restore();
                }
            }
        }

        // 3. Vignette / Dark gradient overlay for text readability
        const grad = ctx.createLinearGradient(0, canvasHeight * 0.55, 0, canvasHeight);
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(0.5, 'rgba(0,0,0,0.6)');
        grad.addColorStop(1, 'rgba(0,0,0,0.92)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, canvasHeight * 0.55, canvasWidth, canvasHeight * 0.45);

        // 4. Draw Synced Text / Captions
        if (trackVisibility.text) {
            const activeTextTrack = textTracks.find(
                t => timestamp >= t.startTime && timestamp < (t.startTime + t.duration)
            );

            if (activeTextTrack && activeTextTrack.text) {
                ctx.save();
                const textElapsed = timestamp - activeTextTrack.startTime;
                const textRatio = Math.min(1, Math.max(0, textElapsed / activeTextTrack.duration));
                const isLabel = activeTextTrack.displayStyle === 'label';
                const shouldHighlight = globalHighlightEnabled && activeTextTrack.isHighlightEnabled;

                if (isLabel) {
                    const bannerH = canvasHeight * 0.085;
                    const bannerY = canvasHeight - bannerH - (canvasHeight * 0.06);

                    // Badge
                    const badgeW = canvasWidth * 0.28;
                    ctx.fillStyle = '#dc2626';
                    ctx.fillRect(canvasWidth * 0.05, bannerY, badgeW, bannerH);
                    ctx.fillStyle = '#ffffff';
                    ctx.font = `900 ${bannerH * 0.40}px sans-serif`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText("EXCLUSIVE", canvasWidth * 0.05 + badgeW / 2, bannerY + bannerH / 2);

                    // Strip
                    const stripX = canvasWidth * 0.05 + badgeW;
                    const stripW = canvasWidth * 0.90 - badgeW;
                    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
                    ctx.fillRect(stripX, bannerY, stripW, bannerH);
                    ctx.strokeStyle = '#f59e0b';
                    ctx.lineWidth = 3;
                    ctx.strokeRect(stripX, bannerY, stripW, bannerH);

                    // Text
                    ctx.textAlign = 'left';
                    ctx.textBaseline = 'middle';
                    const fontSize = bannerH * 0.38;
                    ctx.font = `700 ${fontSize}px sans-serif`;
                    const textStr = activeTextTrack.text;
                    const textX = stripX + 16;
                    const textY = bannerY + bannerH / 2;

                    if (shouldHighlight) {
                        const words = textStr.split(' ');
                        const activeWordIdx = Math.floor(textRatio * words.length);
                        let curX = textX;
                        words.forEach((w, wIdx) => {
                            const wordW = ctx.measureText(w + ' ').width;
                            ctx.fillStyle = wIdx <= activeWordIdx ? '#fbbf24' : 'rgba(255, 255, 255, 0.65)';
                            ctx.fillText(w, curX, textY);
                            curX += wordW;
                        });
                    } else {
                        ctx.fillStyle = '#ffffff';
                        ctx.fillText(textStr, textX, textY);
                    }
                } else {
                    const cardW = canvasWidth * 0.88;
                    const cardX = (canvasWidth - cardW) / 2;
                    const fontSize = canvasHeight * 0.024;
                    const lineHeight = fontSize * 1.5;
                    ctx.font = `600 ${fontSize}px sans-serif`;

                    const words = activeTextTrack.text.split(' ');
                    const lines = [];
                    let curLine = '';
                    for (const w of words) {
                        const testLine = curLine ? curLine + ' ' + w : w;
                        if (ctx.measureText(testLine).width > cardW - 40) {
                            lines.push(curLine);
                            curLine = w;
                        } else {
                            curLine = testLine;
                        }
                    }
                    if (curLine) lines.push(curLine);

                    const cardH = lines.length * lineHeight + 36;
                    const cardY = canvasHeight - cardH - (canvasHeight * 0.08);

                    ctx.fillStyle = 'rgba(10, 15, 30, 0.78)';
                    ctx.beginPath();
                    ctx.roundRect ? ctx.roundRect(cardX, cardY, cardW, cardH, 20) : ctx.fillRect(cardX, cardY, cardW, cardH);
                    ctx.fill();
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
                    ctx.lineWidth = 1.5;
                    ctx.stroke();

                    const totalWords = words.length;
                    const activeWordIndex = Math.floor(textRatio * totalWords);
                    let wordAccumulator = 0;

                    lines.forEach((lineText, lineIdx) => {
                        const lineY = cardY + 22 + (lineIdx * lineHeight) + lineHeight / 2;
                        const lineWords = lineText.split(' ');
                        const totalLineW = ctx.measureText(lineText).width;
                        let wordX = (canvasWidth - totalLineW) / 2;
                        ctx.textAlign = 'left';

                        lineWords.forEach((word) => {
                            const wordW = ctx.measureText(word + ' ').width;
                            if (shouldHighlight) {
                                if (wordAccumulator <= activeWordIndex) {
                                    ctx.fillStyle = '#f59e0b';
                                    ctx.shadowColor = '#d97706';
                                    ctx.shadowBlur = 8;
                                } else {
                                    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
                                    ctx.shadowBlur = 0;
                                }
                            } else {
                                ctx.fillStyle = '#ffffff';
                                ctx.shadowBlur = 0;
                            }
                            ctx.fillText(word, wordX, lineY);
                            wordX += wordW;
                            wordAccumulator++;
                        });
                    });
                }
                ctx.restore();
            }
        }

        // 5. Draw Focus Markers (Circles, Arrows, Boxes, Hand-drawings with auto-disappear)
        if (trackVisibility.marker) {
            markerTracks.forEach(marker => {
                if (timestamp >= marker.startTime && timestamp < (marker.startTime + marker.duration)) {
                    const markerElapsed = timestamp - marker.startTime;
                    const lifeRatio = markerElapsed / marker.duration;

                    let markerAlpha = 1.0;
                    if (lifeRatio < 0.15) markerAlpha = lifeRatio / 0.15;
                    else if (lifeRatio > 0.70) markerAlpha = (1.0 - lifeRatio) / 0.30;

                    const pulse = 1.0 + 0.05 * Math.sin(markerElapsed * 10);

                    ctx.save();
                    ctx.globalAlpha = markerAlpha;
                    ctx.strokeStyle = marker.color || '#f59e0b';
                    ctx.lineWidth = 6 * (canvasWidth / 1080);
                    ctx.lineCap = 'round';
                    ctx.lineJoin = 'round';
                    ctx.shadowColor = marker.color || '#f59e0b';
                    ctx.shadowBlur = 18;

                    if (marker.type === 'circle') {
                        const cx = marker.cx * canvasWidth;
                        const cy = marker.cy * canvasHeight;
                        const r = marker.radius * canvasWidth * pulse;
                        ctx.beginPath();
                        ctx.arc(cx, cy, r, 0, Math.PI * 2);
                        ctx.stroke();
                        ctx.fillStyle = marker.color + '22';
                        ctx.fill();

                    } else if (marker.type === 'box') {
                        const bx = marker.x * canvasWidth;
                        const by = marker.y * canvasHeight;
                        const bw = marker.w * canvasWidth;
                        const bh = marker.h * canvasHeight;
                        ctx.strokeRect(bx, by, bw, bh);
                        ctx.fillStyle = marker.color + '22';
                        ctx.fillRect(bx, by, bw, bh);

                    } else if (marker.type === 'arrow') {
                        const fx = marker.fromX * canvasWidth;
                        const fy = marker.fromY * canvasHeight;
                        const tx = marker.toX * canvasWidth;
                        const ty = marker.toY * canvasHeight;
                        const headlen = 25 * (canvasWidth / 1080);
                        const angle = Math.atan2(ty - fy, tx - fx);

                        ctx.beginPath();
                        ctx.moveTo(fx, fy);
                        ctx.lineTo(tx, ty);
                        ctx.lineTo(tx - headlen * Math.cos(angle - Math.PI / 6), ty - headlen * Math.sin(angle - Math.PI / 6));
                        ctx.moveTo(tx, ty);
                        ctx.lineTo(tx - headlen * Math.cos(angle + Math.PI / 6), ty - headlen * Math.sin(angle + Math.PI / 6));
                        ctx.stroke();

                    } else if (marker.type === 'hand' && marker.points && marker.points.length > 1) {
                        ctx.beginPath();
                        marker.points.forEach((pt, idx) => {
                            const px = pt.x * canvasWidth;
                            const py = pt.y * canvasHeight;
                            if (idx === 0) ctx.moveTo(px, py);
                            else ctx.lineTo(px, py);
                        });
                        ctx.stroke();
                    }

                    ctx.restore();
                }
            });
        }
    };

    // Live Preview Render Loop
    useEffect(() => {
        const canvas = previewCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        canvas.width = aspectRatio === '16:9' ? 1920 : 1080;
        canvas.height = aspectRatio === '16:9' ? 1080 : 1920;

        const loop = () => {
            renderCompositeFrame(ctx, canvas.width, canvas.height, currentTime);
            animFrameRef.current = requestAnimationFrame(loop);
        };
        animFrameRef.current = requestAnimationFrame(loop);
        return () => {
            if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        };
    }, [currentTime, aspectRatio, imageTracks, textTracks, markerTracks, globalHighlightEnabled, trackVisibility, isDark]);

    // BGM Ambient Beat Generator
    const generateAmbientNewsBeat = async () => {
        setIsGeneratingBgm(true);
        try {
            const sampleRate = 44100;
            const lengthSeconds = Math.max(10, Math.min(60, duration));
            const ctx = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(2, sampleRate * lengthSeconds, sampleRate);
            const bpm = 116;
            const beatInterval = 60 / bpm;
            const totalBeats = Math.floor(lengthSeconds / beatInterval);

            for (let i = 0; i < totalBeats; i++) {
                const beatTime = i * beatInterval;
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(140, beatTime);
                osc.frequency.exponentialRampToValueAtTime(38, beatTime + 0.12);
                gain.gain.setValueAtTime(0.7, beatTime);
                gain.gain.exponentialRampToValueAtTime(0.001, beatTime + 0.25);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(beatTime);
                osc.stop(beatTime + 0.25);
            }

            const droneOsc = ctx.createOscillator();
            droneOsc.type = 'triangle';
            droneOsc.frequency.setValueAtTime(110, 0);
            const droneGain = ctx.createGain();
            droneGain.gain.setValueAtTime(0.2, 0);
            droneOsc.connect(droneGain);
            droneGain.connect(ctx.destination);
            droneOsc.start(0);
            droneOsc.stop(lengthSeconds);

            const renderedBuffer = await ctx.startRendering();
            const wavBlob = audioBufferToWavBlob(renderedBuffer);
            const wavUrl = URL.createObjectURL(wavBlob);
            setBgmSrc(wavUrl);
            setBgmName('Dynamic News Beat (Built-in)');
        } catch (e) {
            console.error(e);
        } finally {
            setIsGeneratingBgm(false);
        }
    };

    const audioBufferToWavBlob = (buffer) => {
        const numOfChan = buffer.numberOfChannels;
        const length = buffer.length * numOfChan * 2 + 44;
        const out = new DataView(new ArrayBuffer(length));
        const channels = [];
        let offset = 0, pos = 0;
        function setUint16(data) { out.setUint16(pos, data, true); pos += 2; }
        function setUint32(data) { out.setUint32(pos, data, true); pos += 4; }
        setUint32(0x46464952); setUint32(length - 8); setUint32(0x45564157);
        setUint32(0x20746d66); setUint32(16); setUint16(1); setUint16(numOfChan);
        setUint32(buffer.sampleRate); setUint32(buffer.sampleRate * 2 * numOfChan);
        setUint16(numOfChan * 2); setUint16(16);
        setUint32(0x61746164); setUint32(length - pos - 4);
        for (let i = 0; i < buffer.numberOfChannels; i++) channels.push(buffer.getChannelData(i));
        while (offset < buffer.length) {
            for (let i = 0; i < numOfChan; i++) {
                let sample = Math.max(-1, Math.min(1, channels[i][offset]));
                sample = (sample < 0 ? sample * 0x8000 : sample * 0x7FFF) | 0;
                out.setInt16(pos, sample, true);
                pos += 2;
            }
            offset++;
        }
        return new Blob([out.buffer], { type: 'audio/wav' });
    };

    // Full HD Video Render & Export
    const handleExportVideo = async () => {
        setIsExporting(true);
        setExportProgress(0);

        try {
            const canvas = document.createElement('canvas');
            canvas.width = aspectRatio === '16:9' ? 1920 : 1080;
            canvas.height = aspectRatio === '16:9' ? 1080 : 1920;
            const ctx = canvas.getContext('2d');

            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const mediaStreamDest = audioCtx.createMediaStreamDestination();
            const video = videoRef.current;

            if (video && trackVisibility.video) {
                try {
                    const sourceNode = audioCtx.createMediaElementSource(video);
                    if (noiseReductionEnabled) {
                        const highpass = audioCtx.createBiquadFilter();
                        highpass.type = 'highpass';
                        highpass.frequency.value = noiseReductionStrength === 'high' ? 110 : noiseReductionStrength === 'medium' ? 85 : 65;

                        const notch50 = audioCtx.createBiquadFilter();
                        notch50.type = 'notch';
                        notch50.frequency.value = 50;
                        notch50.Q.value = 4.0;

                        const compressor = audioCtx.createDynamicsCompressor();
                        compressor.threshold.value = noiseReductionStrength === 'high' ? -32 : -25;
                        compressor.knee.value = 24;
                        compressor.ratio.value = 10;
                        compressor.attack.value = 0.003;
                        compressor.release.value = 0.22;

                        const voiceGain = audioCtx.createGain();
                        voiceGain.gain.value = voiceVolume;

                        sourceNode.connect(highpass);
                        highpass.connect(notch50);
                        notch50.connect(compressor);
                        compressor.connect(voiceGain);
                        voiceGain.connect(mediaStreamDest);
                    } else {
                        const voiceGain = audioCtx.createGain();
                        voiceGain.gain.value = voiceVolume;
                        sourceNode.connect(voiceGain);
                        voiceGain.connect(mediaStreamDest);
                    }
                } catch (e) {
                    console.log("Audio routing:", e);
                }
            }

            if (bgmAudioRef.current && bgmSrc && trackVisibility.bgm) {
                try {
                    const bgmSource = audioCtx.createMediaElementSource(bgmAudioRef.current);
                    const bgmGain = audioCtx.createGain();
                    bgmGain.gain.value = bgmVolume;
                    bgmSource.connect(bgmGain);
                    bgmGain.connect(mediaStreamDest);
                } catch (e) {
                    console.log("BGM routing:", e);
                }
            }

            const canvasStream = canvas.captureStream(30);
            const mixedTracks = [
                ...canvasStream.getVideoTracks(),
                ...mediaStreamDest.stream.getAudioTracks()
            ];
            const finalStream = new MediaStream(mixedTracks);

            let mimeType = 'video/mp4;codecs=avc1';
            if (typeof MediaRecorder !== 'undefined' && !MediaRecorder.isTypeSupported(mimeType)) {
                mimeType = 'video/webm;codecs=vp8';
            }

            const recorder = new MediaRecorder(finalStream, {
                videoBitsPerSecond: 6000000,
                mimeType
            });

            const chunks = [];
            recorder.ondataavailable = e => e.data.size > 0 && chunks.push(e.data);

            recorder.onstop = () => {
                const blob = new Blob(chunks, { type: 'video/mp4' });
                const url = URL.createObjectURL(blob);
                setExportedBlob(blob);
                setExportedUrl(url);
                setIsExporting(false);
                audioCtx.close().catch(() => {});
            };

            recorder.start(100);
            if (video) video.currentTime = 0;
            if (bgmAudioRef.current && bgmSrc) {
                bgmAudioRef.current.currentTime = 0;
                bgmAudioRef.current.play().catch(() => {});
            }
            if (video) video.play().catch(() => {});

            const startTime = performance.now();
            const renderStep = () => {
                const renderTime = (performance.now() - startTime) / 1000;
                renderCompositeFrame(ctx, canvas.width, canvas.height, renderTime);
                setExportProgress(Math.min(100, Math.floor((renderTime / duration) * 100)));

                if (renderTime >= duration) {
                    if (video) video.pause();
                    if (bgmAudioRef.current) bgmAudioRef.current.pause();
                    recorder.stop();
                } else {
                    requestAnimationFrame(renderStep);
                }
            };
            requestAnimationFrame(renderStep);

        } catch (err) {
            console.error(err);
            setIsExporting(false);
            alert("Export error: " + err.message);
        }
    };

    const handleSaveToGallery = async () => {
        if (!exportedBlob) return;
        if (Capacitor.isNativePlatform()) {
            try {
                await saveReelVideo(exportedBlob, 'mp4');
                alert("🎉 Success! Video saved to your phone Gallery!");
            } catch (e) {
                fallbackDownload();
            }
        } else {
            fallbackDownload();
        }
    };

    const fallbackDownload = () => {
        if (!exportedUrl) return;
        const a = document.createElement('a');
        a.href = exportedUrl;
        a.download = `STORY_STUDIO_${Date.now()}.mp4`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    const formatTime = (secs) => {
        const m = Math.floor(secs / 60);
        const s = Math.floor(secs % 60);
        const ms = Math.floor((secs % 1) * 10);
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${ms}`;
    };

    return (
        <div className={`w-full h-full flex flex-col overflow-hidden select-none font-sans transition-colors duration-300 ${isDark ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'}`}>
            {/* Hidden Video & Audio playback elements */}
            <video
                ref={videoRef}
                src={videoSrc}
                playsInline
                preload="auto"
                onLoadedMetadata={onVideoLoadedMetadata}
                onTimeUpdate={onVideoTimeUpdate}
                style={{ position: 'absolute', opacity: 0, width: '1px', height: '1px', pointerEvents: 'none' }}
            />
            <audio ref={bgmAudioRef} src={bgmSrc} preload="auto" loop style={{ display: 'none' }} />

            {/* ======================================================== */}
            {/* 1. TOP ENTERPRISE HEADER BAR (THEME TOGGLE + ACTIONS)   */}
            {/* ======================================================== */}
            <div className={`h-14 px-4 flex items-center justify-between border-b shrink-0 z-30 transition-colors duration-200 ${isDark ? 'bg-slate-900/90 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-800 shadow-xs'}`}>
                {/* Left Brand & Back */}
                <div className="flex items-center gap-3">
                    <button
                        onClick={onClose}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${isDark ? 'bg-neutral-800 border-neutral-700 text-neutral-300 hover:text-white' : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'}`}
                    >
                        <span>✕</span> Prompter
                    </button>
                    <div className={`h-4 w-px ${isDark ? 'bg-white/20' : 'bg-slate-300'}`}></div>
                    <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 bg-yellow-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(234,179,8,0.8)]"></span>
                        <h1 className="text-xs md:text-sm font-black uppercase tracking-wider text-yellow-500">
                            Studio Timeline Pro
                        </h1>
                    </div>
                </div>

                {/* Right Action Controls */}
                <div className="flex items-center gap-2">
                    {/* ENTERPRISE LIGHT / DARK MODE TOGGLE */}
                    <button
                        type="button"
                        onClick={() => setStudioTheme(prev => prev === 'dark' ? 'light' : 'dark')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border shadow-xs ${isDark ? 'bg-slate-800 border-slate-700 text-yellow-400 hover:bg-slate-700' : 'bg-slate-100 border-slate-300 text-slate-800 hover:bg-slate-200'}`}
                        title="Toggle Light / Dark Mode"
                    >
                        <span>{isDark ? '☀️ Light Mode' : '🌙 Dark Mode'}</span>
                    </button>

                    {/* Noise Filter Toggle */}
                    <button
                        onClick={() => setNoiseReductionEnabled(!noiseReductionEnabled)}
                        className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider border transition-all ${noiseReductionEnabled ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' : isDark ? 'bg-neutral-800 text-neutral-400 border-neutral-700' : 'bg-slate-100 text-slate-500 border-slate-300'}`}
                        title="Background Noise Filter"
                    >
                        <span>🛡️</span> {noiseReductionEnabled ? 'Noise Filter ON' : 'Noise Filter OFF'}
                    </button>

                    {/* Export Final Reel */}
                    <button
                        onClick={handleExportVideo}
                        disabled={isExporting}
                        className={`px-4 py-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-black text-xs uppercase tracking-wider shadow-[0_0_20px_rgba(225,29,72,0.5)] active:scale-95 transition-all flex items-center gap-2 ${isExporting ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        <span>🎬</span> {isExporting ? `Rendering ${exportProgress}%` : 'Export Final Reel'}
                    </button>
                </div>
            </div>

            {/* ======================================================== */}
            {/* 2. MAIN STAGE (LEFT CANVA RAIL + PREVIEW + INSPECTOR)   */}
            {/* ======================================================== */}
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">

                {/* CANVA-STYLE LEFT NAVIGATION RAIL */}
                <div className={`w-16 md:w-20 border-r flex flex-col items-center py-3 gap-2 shrink-0 z-20 transition-colors duration-200 ${isDark ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-200 shadow-xs'}`}>
                    {[
                        { id: 'images', icon: '🖼️', label: 'Media' },
                        { id: 'text', icon: '✍️', label: 'Script' },
                        { id: 'marker', icon: '⭕', label: 'Focus' },
                        { id: 'bgm', icon: '🎵', label: 'Audio' },
                        { id: 'audio', icon: '🎙️', label: 'Noise' },
                        { id: 'transitions', icon: '🪄', label: 'Effects' }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveSidebarTab(tab.id)}
                            className={`w-14 py-2.5 rounded-2xl flex flex-col items-center gap-1 transition-all ${activeSidebarTab === tab.id ? 'bg-yellow-500 text-black shadow-md font-black scale-105' : isDark ? 'text-neutral-400 hover:text-white hover:bg-neutral-800' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'}`}
                        >
                            <span className="text-base">{tab.icon}</span>
                            <span className="text-[9px] uppercase font-bold tracking-tight">{tab.label}</span>
                        </button>
                    ))}
                </div>

                {/* CENTRAL VIDEO CANVAS STAGE */}
                <div className={`flex-1 flex flex-col items-center justify-center relative p-3 overflow-hidden ${isDark ? 'bg-black' : 'bg-slate-200/60'}`}>
                    {/* Aspect Ratio Box with Video Composite */}
                    <div
                        className="relative max-h-full max-w-full flex items-center justify-center rounded-2xl overflow-hidden shadow-[0_15px_45px_rgba(0,0,0,0.5)] border border-white/20"
                        style={{
                            aspectRatio: aspectRatio === '16:9' ? '16/9' : '9/16',
                            height: '100%',
                            maxHeight: 'min(48vh, 520px)'
                        }}
                    >
                        <canvas ref={previewCanvasRef} className="w-full h-full object-contain pointer-events-none" />

                        {/* Interactive Drawing Layer for Focus Circle & Marker */}
                        <canvas
                            ref={overlayCanvasRef}
                            onPointerDown={handleCanvasPointerDown}
                            onPointerMove={handleCanvasPointerMove}
                            onPointerUp={handleCanvasPointerUp}
                            className={`absolute inset-0 w-full h-full z-10 ${isDrawingMarker ? 'cursor-crosshair' : 'pointer-events-none'}`}
                        />

                        {isDrawingMarker && (
                            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-yellow-500 text-black px-4 py-1.5 rounded-full text-xs font-black shadow-lg animate-bounce flex items-center gap-2">
                                <span>✏️</span> Tap & drag on video to create focus marker!
                            </div>
                        )}
                    </div>

                    {/* Quick Playback Bar */}
                    <div className={`w-full max-w-md flex items-center justify-between gap-3 mt-2 px-3 py-1.5 rounded-2xl border shadow-sm ${isDark ? 'bg-neutral-900/80 border-white/10' : 'bg-white border-slate-300'}`}>
                        <button
                            onClick={() => handleSeek(0)}
                            className={`p-1.5 text-xs font-bold ${isDark ? 'text-neutral-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
                            title="Rewind to start"
                        >
                            ⏮ 0s
                        </button>
                        <button
                            onClick={togglePlay}
                            className="px-4 py-1.5 rounded-xl bg-yellow-500 hover:bg-yellow-400 text-black font-black text-xs uppercase flex items-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer"
                        >
                            {isPlaying ? '⏸ Pause' : '▶ Play'}
                        </button>
                        <button
                            onClick={handleStopPlayback}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1 cursor-pointer active:scale-95 ${isDark ? 'bg-neutral-800 border-neutral-700 text-red-400 hover:bg-red-950/40' : 'bg-slate-100 border-slate-300 text-red-600 hover:bg-red-50'}`}
                            title="Stop video and return to 0s"
                        >
                            <span className="w-2.5 h-2.5 bg-red-500 rounded-xs"></span> Stop
                        </button>
                        <span className="font-mono text-xs font-bold text-yellow-500">
                            {formatTime(currentTime)} / {formatTime(duration)}
                        </span>
                        <div className="flex gap-1">
                            {['9:16', '16:9'].map(ratio => (
                                <button
                                    key={ratio}
                                    onClick={() => setAspectRatio(ratio)}
                                    className={`px-2 py-1 rounded-lg text-[10px] font-bold ${aspectRatio === ratio ? 'bg-yellow-500 text-black font-black' : isDark ? 'text-neutral-500' : 'text-slate-400'}`}
                                >
                                    {ratio}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* RIGHT INSPECTOR PANEL (CANVA / CAPCUT TOOLS) */}
                <div className={`w-full md:w-80 border-l flex flex-col shrink-0 max-h-[36vh] md:max-h-full overflow-hidden transition-colors duration-200 ${isDark ? 'bg-slate-900 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-800'}`}>
                    
                    {/* Header */}
                    <div className={`p-3.5 border-b flex items-center justify-between ${isDark ? 'border-white/10 bg-black/20' : 'border-slate-200 bg-slate-50'}`}>
                        <span className="text-xs font-black uppercase text-yellow-500 tracking-wider">
                            {activeSidebarTab === 'images' && '🖼️ Media & Slide Photos'}
                            {activeSidebarTab === 'text' && '✍️ Script & Captions'}
                            {activeSidebarTab === 'marker' && '⭕ Audience Focus Marker'}
                            {activeSidebarTab === 'bgm' && '🎵 Background Music'}
                            {activeSidebarTab === 'audio' && '🎙️ Noise Cleanup Filter'}
                            {activeSidebarTab === 'transitions' && '🪄 Entrance Animations'}
                        </span>
                    </div>

                    {/* Content Scrollable Body */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">

                        {/* TAB 1: MEDIA & SLIDE PHOTOS */}
                        {activeSidebarTab === 'images' && (
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-neutral-400">Photos on Timeline ({imageTracks.length})</span>
                                    <label className="px-3 py-1 bg-yellow-500 text-black font-black text-xs rounded-xl cursor-pointer hover:bg-yellow-400 uppercase shadow-xs">
                                        + Add Photo
                                        <input
                                            type="file"
                                            multiple
                                            accept="image/*"
                                            className="hidden"
                                            onChange={(e) => {
                                                const files = Array.from(e.target.files);
                                                files.forEach((file, i) => {
                                                    const reader = new FileReader();
                                                    reader.onload = () => {
                                                        pushHistorySnapshot();
                                                        setImageTracks(prev => [
                                                            ...prev,
                                                            {
                                                                id: `img_${Date.now()}_${i}`,
                                                                src: reader.result,
                                                                name: file.name || `Photo ${prev.length + 1}`,
                                                                startTime: Number(currentTime.toFixed(1)),
                                                                duration: 4.0,
                                                                animation: 'zoom-in',
                                                                position: 'cover'
                                                            }
                                                        ]);
                                                    };
                                                    reader.readAsDataURL(file);
                                                });
                                            }}
                                        />
                                    </label>
                                </div>

                                {imageTracks.length === 0 ? (
                                    <p className="text-xs text-neutral-500 text-center py-6">
                                        No images added yet. Tap "+ Add Photo" to place slide photos on the timeline!
                                    </p>
                                ) : (
                                    <div className="space-y-2.5">
                                        {imageTracks.map(img => (
                                            <div
                                                key={img.id}
                                                onClick={() => setSelectedClip({ type: 'images', id: img.id })}
                                                className={`p-3 rounded-2xl border transition-all ${selectedClip?.id === img.id ? 'border-yellow-500 bg-yellow-500/10' : isDark ? 'bg-neutral-800/60 border-neutral-700' : 'bg-slate-50 border-slate-200'}`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <img src={img.src} alt="" className="w-12 h-12 rounded-xl object-cover border border-neutral-600" />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex justify-between items-center">
                                                            <p className="text-xs font-bold truncate">{img.name}</p>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    pushHistorySnapshot();
                                                                    setImageTracks(prev => prev.filter(item => item.id !== img.id));
                                                                }}
                                                                className="text-red-400 hover:text-red-300 text-xs px-1"
                                                            >
                                                                ✕
                                                            </button>
                                                        </div>
                                                        <p className="text-[10px] text-yellow-500 font-mono mt-0.5">
                                                            {img.startTime}s - {Number((img.startTime + img.duration).toFixed(1))}s ({img.duration}s)
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Animation Selector */}
                                                <div className="mt-2.5 pt-2 border-t border-white/10">
                                                    <label className="text-[10px] font-bold text-neutral-400 block mb-1 uppercase">Animation:</label>
                                                    <div className="grid grid-cols-3 gap-1">
                                                        {[
                                                            { id: 'zoom-in', label: '🔍 Zoom-In' },
                                                            { id: 'slide-bottom', label: '⬆ Slide Up' },
                                                            { id: 'slide-left', label: '⬅ Slide Left' },
                                                            { id: 'fade', label: '✨ Fade-In' },
                                                            { id: 'pop', label: '💥 Pop-In' }
                                                        ].map(anim => (
                                                            <button
                                                                key={anim.id}
                                                                onClick={() => {
                                                                    pushHistorySnapshot();
                                                                    setImageTracks(prev => prev.map(item => item.id === img.id ? { ...item, animation: anim.id } : item));
                                                                }}
                                                                className={`py-1 px-1 rounded-lg text-[9px] font-bold ${img.animation === anim.id ? 'bg-yellow-500 text-black font-black' : isDark ? 'bg-neutral-900 text-neutral-400' : 'bg-slate-200 text-slate-700'}`}
                                                            >
                                                                {anim.label}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* TAB 2: SCRIPT & CAPTIONS */}
                        {activeSidebarTab === 'text' && (
                            <div className="space-y-4">
                                <div className={`p-3 rounded-2xl border space-y-2 ${isDark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-black uppercase">Karaoke Highlight</label>
                                        <button
                                            onClick={() => setGlobalHighlightEnabled(!globalHighlightEnabled)}
                                            className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase transition-all ${globalHighlightEnabled ? 'bg-yellow-500 text-black' : 'bg-neutral-800 text-neutral-400'}`}
                                        >
                                            {globalHighlightEnabled ? 'Highlight ON' : 'Highlight OFF (Plain)'}
                                        </button>
                                    </div>
                                    <p className="text-[11px] text-neutral-400">
                                        {globalHighlightEnabled ? 'Word-by-word karaoke highlighting active.' : 'Plain text subtitle scrolls smoothly without highlight.'}
                                    </p>
                                </div>

                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-black uppercase text-yellow-500">Text Blocks ({textTracks.length})</span>
                                    <button
                                        onClick={() => {
                                            pushHistorySnapshot();
                                            setTextTracks(prev => [
                                                ...prev,
                                                {
                                                    id: `txt_${Date.now()}`,
                                                    text: 'New News Caption',
                                                    startTime: Number(currentTime.toFixed(1)),
                                                    duration: 4.0,
                                                    isHighlightEnabled: true,
                                                    displayStyle: 'label'
                                                }
                                            ]);
                                        }}
                                        className="px-2.5 py-1 bg-yellow-500 text-black font-black text-xs rounded-xl"
                                    >
                                        + Add Caption
                                    </button>
                                </div>

                                <div className="space-y-2.5">
                                    {textTracks.map(txt => (
                                        <div
                                            key={txt.id}
                                            onClick={() => setSelectedClip({ type: 'text', id: txt.id })}
                                            className={`p-3 rounded-2xl border transition-all ${selectedClip?.id === txt.id ? 'border-yellow-500 bg-yellow-500/10' : isDark ? 'bg-neutral-800/60 border-neutral-700' : 'bg-slate-50 border-slate-200'}`}
                                        >
                                            <div className="flex justify-between items-start gap-2">
                                                <textarea
                                                    rows="2"
                                                    value={txt.text}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        setTextTracks(prev => prev.map(t => t.id === txt.id ? { ...t, text: val } : t));
                                                    }}
                                                    className={`w-full border rounded-lg p-2 text-xs font-bold resize-none ${isDark ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-white border-slate-300 text-slate-900'}`}
                                                />
                                                <button
                                                    onClick={() => {
                                                        pushHistorySnapshot();
                                                        setTextTracks(prev => prev.filter(t => t.id !== txt.id));
                                                    }}
                                                    className="text-red-400 text-xs px-1"
                                                >
                                                    ✕
                                                </button>
                                            </div>

                                            <div className="flex gap-2 mt-2 pt-2 border-t border-white/10">
                                                <button
                                                    onClick={() => setTextTracks(prev => prev.map(t => t.id === txt.id ? { ...t, displayStyle: 'label' } : t))}
                                                    className={`flex-1 py-1 px-2 rounded-lg text-[10px] font-bold ${txt.displayStyle === 'label' ? 'bg-red-600 text-white font-black' : isDark ? 'bg-neutral-900 text-neutral-400' : 'bg-slate-200 text-slate-700'}`}
                                                >
                                                    📺 News Lower-Third
                                                </button>
                                                <button
                                                    onClick={() => setTextTracks(prev => prev.map(t => t.id === txt.id ? { ...t, displayStyle: 'subtitle' } : t))}
                                                    className={`flex-1 py-1 px-2 rounded-lg text-[10px] font-bold ${txt.displayStyle === 'subtitle' ? 'bg-yellow-500 text-black font-black' : isDark ? 'bg-neutral-900 text-neutral-400' : 'bg-slate-200 text-slate-700'}`}
                                                >
                                                    💬 Subtitle Card
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* TAB 3: FOCUS MARKERS (DISAPPEARING CIRCLE/HIGHLIGHTER) */}
                        {activeSidebarTab === 'marker' && (
                            <div className="space-y-4">
                                <div className={`p-3.5 rounded-2xl border space-y-3 ${isDark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                                    <label className="text-xs font-black uppercase text-yellow-500 block">
                                        Audience Focus Explainer (Auto-Disappears)
                                    </label>
                                    <p className="text-[11px] leading-relaxed opacity-80">
                                        Draw on the video to point out text, faces, or charts. It automatically fades away after 1-2 seconds!
                                    </p>

                                    {/* Presets */}
                                    <div className="grid grid-cols-2 gap-2">
                                        {[
                                            { id: 'circle', label: '⭕ Focus Circle' },
                                            { id: 'arrow', label: '➡️ Pointing Arrow' },
                                            { id: 'box', label: '🔲 Focus Box' },
                                            { id: 'hand', label: '✍️ Freehand Draw' }
                                        ].map(m => (
                                            <button
                                                key={m.id}
                                                onClick={() => setMarkerType(m.id)}
                                                className={`py-2 px-2 rounded-xl text-[10px] font-bold transition-all ${markerType === m.id ? 'bg-yellow-500 text-black font-black' : isDark ? 'bg-neutral-800 text-neutral-400' : 'bg-slate-200 text-slate-700'}`}
                                            >
                                                {m.label}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Color & Duration */}
                                    <div className="flex items-center gap-2 pt-1">
                                        <span className="text-[10px] opacity-70">Color:</span>
                                        {['#f59e0b', '#ef4444', '#10b981', '#3b82f6', '#ec4899'].map(c => (
                                            <button
                                                key={c}
                                                onClick={() => setMarkerColor(c)}
                                                className={`w-6 h-6 rounded-full border-2 ${markerColor === c ? 'border-white scale-110 shadow-sm' : 'border-transparent'}`}
                                                style={{ backgroundColor: c }}
                                            />
                                        ))}
                                    </div>

                                    <div>
                                        <div className="flex justify-between text-[10px] opacity-70 mb-1">
                                            <span>Display duration:</span>
                                            <span className="font-bold text-yellow-500">{markerDuration}s</span>
                                        </div>
                                        <input
                                            type="range"
                                            min="0.8"
                                            max="4.0"
                                            step="0.2"
                                            value={markerDuration}
                                            onChange={(e) => setMarkerDuration(parseFloat(e.target.value))}
                                            className="w-full accent-yellow-500"
                                        />
                                    </div>

                                    {/* Action to Draw */}
                                    <button
                                        onClick={() => setIsDrawingMarker(true)}
                                        className="w-full py-3 bg-gradient-to-r from-yellow-500 to-amber-500 text-black font-black text-xs uppercase rounded-xl shadow-md active:scale-95 transition-all flex items-center justify-center gap-2"
                                    >
                                        <span>✏️</span> Tap & Draw on Video
                                    </button>
                                </div>

                                <div className="space-y-2">
                                    <span className="text-[10px] font-bold uppercase opacity-70">Active Markers ({markerTracks.length})</span>
                                    {markerTracks.map(m => (
                                        <div key={m.id} className={`p-2.5 rounded-xl border flex items-center justify-between text-xs ${isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-slate-100 border-slate-200'}`}>
                                            <div className="flex items-center gap-2">
                                                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: m.color }} />
                                                <span className="font-bold capitalize">{m.type}</span>
                                                <span className="text-[10px] opacity-60 font-mono">@{m.startTime}s</span>
                                            </div>
                                            <button
                                                onClick={() => setMarkerTracks(prev => prev.filter(item => item.id !== m.id))}
                                                className="text-red-400 font-bold px-1"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* TAB 4: BGM */}
                        {activeSidebarTab === 'bgm' && (
                            <div className="space-y-4">
                                <div className={`p-3.5 rounded-2xl border space-y-3 ${isDark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                                    <label className="text-xs font-black uppercase text-yellow-500 block">
                                        Background Music Track
                                    </label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <label className={`py-2.5 px-3 rounded-xl text-xs font-bold text-center cursor-pointer border flex items-center justify-center gap-1.5 ${isDark ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-slate-200 border-slate-300 text-slate-800'}`}>
                                            <span>📂</span> Upload MP3
                                            <input
                                                type="file"
                                                accept="audio/*"
                                                className="hidden"
                                                onChange={(e) => {
                                                    const file = e.target.files[0];
                                                    if (file) {
                                                        const url = URL.createObjectURL(file);
                                                        setBgmSrc(url);
                                                        setBgmName(file.name);
                                                    }
                                                }}
                                            />
                                        </label>
                                        <button
                                            onClick={generateAmbientNewsBeat}
                                            disabled={isGeneratingBgm}
                                            className="py-2.5 px-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl text-xs font-bold shadow-md flex items-center justify-center gap-1.5"
                                        >
                                            <span>⚡</span> {isGeneratingBgm ? 'Synthesizing...' : 'News Beat'}
                                        </button>
                                    </div>

                                    {bgmSrc && (
                                        <div className={`p-2.5 rounded-xl border flex items-center justify-between text-xs ${isDark ? 'bg-neutral-900 border-neutral-700' : 'bg-slate-100 border-slate-300'}`}>
                                            <span className="font-bold text-emerald-500 truncate max-w-[180px]">🎵 {bgmName}</span>
                                            <button onClick={() => setBgmSrc(null)} className="text-red-400 text-xs px-1">✕ Remove</button>
                                        </div>
                                    )}

                                    <div>
                                        <div className="flex justify-between text-[10px] opacity-70 mb-1">
                                            <span>BGM Volume (Ducking):</span>
                                            <span className="font-bold text-yellow-500">{Math.round(bgmVolume * 100)}%</span>
                                        </div>
                                        <input
                                            type="range"
                                            min="0"
                                            max="1.0"
                                            step="0.05"
                                            value={bgmVolume}
                                            onChange={(e) => setBgmVolume(parseFloat(e.target.value))}
                                            className="w-full accent-yellow-500"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* TAB 5: AUDIO NOISE CLEANUP */}
                        {activeSidebarTab === 'audio' && (
                            <div className="space-y-4">
                                <div className={`p-3.5 rounded-2xl border space-y-3 ${isDark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-black uppercase text-yellow-500">Noise Filter</label>
                                        <button
                                            onClick={() => setNoiseReductionEnabled(!noiseReductionEnabled)}
                                            className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase ${noiseReductionEnabled ? 'bg-emerald-500 text-black' : 'bg-neutral-800 text-neutral-400'}`}
                                        >
                                            {noiseReductionEnabled ? 'Filter ON' : 'Filter OFF'}
                                        </button>
                                    </div>
                                    <p className="text-[11px] opacity-80 leading-relaxed">
                                        Web Audio filter cuts fan sound, AC hum, mic handling rumble, and suppresses background room noise.
                                    </p>

                                    <div>
                                        <label className="text-[10px] opacity-70 block mb-1">Strength:</label>
                                        <div className="grid grid-cols-3 gap-2">
                                            {['light', 'medium', 'high'].map(s => (
                                                <button
                                                    key={s}
                                                    onClick={() => setNoiseReductionStrength(s)}
                                                    className={`py-1.5 rounded-xl text-[10px] font-bold capitalize ${noiseReductionStrength === s ? 'bg-emerald-500 text-black font-black' : isDark ? 'bg-neutral-800 text-neutral-400' : 'bg-slate-200 text-slate-700'}`}
                                                >
                                                    {s}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <div className="flex justify-between text-[10px] opacity-70 mb-1">
                                            <span>Voice Boost Level:</span>
                                            <span className="font-bold text-yellow-500">{Math.round(voiceVolume * 100)}%</span>
                                        </div>
                                        <input
                                            type="range"
                                            min="0.5"
                                            max="2.0"
                                            step="0.1"
                                            value={voiceVolume}
                                            onChange={(e) => setVoiceVolume(parseFloat(e.target.value))}
                                            className="w-full accent-yellow-500"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* TAB 6: TRANSITIONS */}
                        {activeSidebarTab === 'transitions' && (
                            <div className="space-y-4">
                                <div className={`p-3.5 rounded-2xl border space-y-3 ${isDark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                                    <label className="text-xs font-black uppercase text-yellow-500 block">Transitions & Animation Engine</label>
                                    <p className="text-[11px] opacity-80 leading-relaxed">
                                        Apply cinematic entrance animations to every photo or slide on the timeline.
                                    </p>
                                    <div className="grid grid-cols-2 gap-2">
                                        {[
                                            { id: 'zoom-in', label: '🔍 Ken Burns Zoom', desc: 'Scale smoothly' },
                                            { id: 'slide-bottom', label: '⬆ Bottom Slide', desc: 'Slide up' },
                                            { id: 'slide-left', label: '⬅ Left Slide', desc: 'Slide left' },
                                            { id: 'fade', label: '✨ Dissolve Fade', desc: 'Smooth alpha' },
                                            { id: 'pop', label: '💥 Elastic Pop', desc: 'Bounce in' }
                                        ].map(anim => (
                                            <button
                                                key={anim.id}
                                                onClick={() => {
                                                    pushHistorySnapshot();
                                                    setImageTracks(prev => prev.map(img => ({ ...img, animation: anim.id })));
                                                }}
                                                className={`p-2.5 rounded-xl border text-left transition-all ${isDark ? 'bg-neutral-800/80 border-neutral-700 hover:border-yellow-500' : 'bg-slate-100 border-slate-300 hover:border-yellow-500'}`}
                                            >
                                                <p className="text-xs font-bold">{anim.label}</p>
                                                <p className="text-[9px] opacity-60">{anim.desc}</p>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                    </div>
                </div>
            </div>

            {/* ======================================================== */}
            {/* 3. CAPCUT-GRADE MULTI-TRACK HORIZONTAL TIMELINE         */}
            {/* ======================================================== */}
            <div
                className={`h-48 md:h-56 border-t flex flex-col shrink-0 overflow-hidden transition-colors duration-200 ${isDark ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-200'}`}
                onPointerMove={onTimelinePointerMove}
                onPointerUp={onTimelinePointerUp}
            >
                {/* TIMELINE TOOLBAR (SPLIT, DELETE, DUPLICATE, UNDO, REDO, ZOOM) */}
                <div className={`h-10 px-3 flex items-center justify-between border-b text-xs shrink-0 ${isDark ? 'bg-neutral-950/80 border-white/10' : 'bg-slate-100 border-slate-200'}`}>
                    {/* Left Quick Action Buttons */}
                    <div className="flex items-center gap-1.5">
                        <button
                            onClick={handleSplitClipAtPlayhead}
                            className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 text-[11px] transition-all border ${isDark ? 'bg-neutral-800 border-neutral-700 text-yellow-400 hover:bg-neutral-700' : 'bg-white border-slate-300 text-slate-800 hover:bg-slate-50'}`}
                            title="Split clip at playhead position"
                        >
                            <span>✂️</span> Split Clip
                        </button>

                        <button
                            onClick={handleDuplicateClip}
                            disabled={!selectedClip}
                            className={`px-2 py-1 rounded-lg font-bold flex items-center gap-1 text-[11px] border ${selectedClip ? (isDark ? 'bg-neutral-800 border-neutral-700 text-white hover:bg-neutral-700' : 'bg-white border-slate-300 text-slate-800') : 'opacity-40 cursor-not-allowed border-transparent'}`}
                            title="Duplicate selected clip"
                        >
                            <span>📑</span> Duplicate
                        </button>

                        <button
                            onClick={handleDeleteClip}
                            disabled={!selectedClip}
                            className={`px-2 py-1 rounded-lg font-bold flex items-center gap-1 text-[11px] border ${selectedClip ? 'bg-red-600/20 text-red-500 border-red-500/40 hover:bg-red-600/30' : 'opacity-40 cursor-not-allowed border-transparent'}`}
                            title="Delete selected clip"
                        >
                            <span>🗑️</span> Delete
                        </button>

                        <div className={`h-4 w-px mx-1 ${isDark ? 'bg-white/20' : 'bg-slate-300'}`}></div>

                        <button
                            onClick={handleUndo}
                            disabled={historyIndex <= 0}
                            className={`p-1 rounded-lg text-xs ${historyIndex > 0 ? (isDark ? 'text-white hover:bg-neutral-800' : 'text-slate-800 hover:bg-slate-200') : 'opacity-30 cursor-not-allowed'}`}
                            title="Undo (Ctrl+Z)"
                        >
                            ⏪
                        </button>
                        <button
                            onClick={handleRedo}
                            disabled={historyIndex >= history.length - 1}
                            className={`p-1 rounded-lg text-xs ${historyIndex < history.length - 1 ? (isDark ? 'text-white hover:bg-neutral-800' : 'text-slate-800 hover:bg-slate-200') : 'opacity-30 cursor-not-allowed'}`}
                            title="Redo"
                        >
                            ⏩
                        </button>

                        <button
                            onClick={() => setIsSnappingEnabled(!isSnappingEnabled)}
                            className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-all ${isSnappingEnabled ? 'bg-yellow-500 text-black border-yellow-600' : isDark ? 'bg-neutral-800 text-neutral-400 border-neutral-700' : 'bg-white text-slate-500 border-slate-300'}`}
                            title="Toggle Magnet Snapping"
                        >
                            🧲 Snap {isSnappingEnabled ? 'ON' : 'OFF'}
                        </button>

                        <div className={`h-4 w-px mx-1 ${isDark ? 'bg-white/20' : 'bg-slate-300'}`}></div>

                        {/* Mini Play & Stop on Timeline Toolbar */}
                        <div className="flex items-center gap-1">
                            <button
                                onClick={togglePlay}
                                className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-yellow-500 text-black hover:bg-yellow-400 flex items-center gap-1 cursor-pointer"
                                title={isPlaying ? 'Pause' : 'Play'}
                            >
                                {isPlaying ? '⏸' : '▶'}
                            </button>
                            <button
                                onClick={handleStopPlayback}
                                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border flex items-center gap-1 cursor-pointer ${isDark ? 'bg-neutral-800 border-neutral-700 text-red-400 hover:bg-red-950/40' : 'bg-white border-slate-300 text-red-600 hover:bg-red-50'}`}
                                title="Stop video and return to 0s"
                            >
                                ⏹ Stop
                            </button>
                        </div>
                    </div>

                    {/* Right Timeline Zoom Controls */}
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-yellow-500 font-bold">
                            PLAYHEAD: {formatTime(currentTime)}
                        </span>
                        <div className="flex items-center gap-1 ml-2">
                            <button
                                onClick={() => setTimelineZoom(prev => Math.max(1.0, prev - 0.25))}
                                className={`w-6 h-6 rounded-md font-bold text-xs flex items-center justify-center ${isDark ? 'bg-neutral-800 text-neutral-300 hover:text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}
                            >
                                -
                            </button>
                            <input
                                type="range"
                                min="1.0"
                                max="3.5"
                                step="0.25"
                                value={timelineZoom}
                                onChange={(e) => setTimelineZoom(parseFloat(e.target.value))}
                                className="w-16 accent-yellow-500"
                            />
                            <button
                                onClick={() => setTimelineZoom(prev => Math.min(3.5, prev + 0.25))}
                                className={`w-6 h-6 rounded-md font-bold text-xs flex items-center justify-center ${isDark ? 'bg-neutral-800 text-neutral-300 hover:text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}
                            >
                                +
                            </button>
                            <span className="text-[10px] font-bold opacity-60 ml-1">{timelineZoom}x</span>
                        </div>
                    </div>
                </div>

                {/* TIMELINE TRACKS BODY (LEFT TRACK HEADERS + SCROLLABLE RIGHT CANVAS) */}
                <div className="flex-1 flex overflow-hidden">

                    {/* Left Track Headers (Eye Toggle, Lock Toggle) */}
                    <div className={`w-28 md:w-36 border-r flex flex-col py-1 shrink-0 z-20 space-y-1 text-[10px] font-bold select-none ${isDark ? 'bg-slate-900 border-white/10' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                        {/* Time Ruler Spacer */}
                        <div className="h-5 px-2 flex items-center text-[9px] opacity-50 uppercase tracking-wider font-mono">
                            Tracks
                        </div>

                        {/* Track 1: Video Header */}
                        <div className="h-7 px-2 flex items-center justify-between">
                            <span className="truncate">📹 Video</span>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setTrackVisibility(prev => ({ ...prev, video: !prev.video }))}
                                    className={`p-0.5 hover:text-yellow-400 ${trackVisibility.video ? 'opacity-100' : 'opacity-40'}`}
                                    title="Toggle Track Visibility"
                                >
                                    {trackVisibility.video ? '👁️' : '🕶️'}
                                </button>
                            </div>
                        </div>

                        {/* Track 2: Images Header */}
                        <div className="h-7 px-2 flex items-center justify-between text-yellow-500">
                            <span className="truncate">🖼️ Images</span>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setTrackVisibility(prev => ({ ...prev, images: !prev.images }))}
                                    className={`p-0.5 ${trackVisibility.images ? 'opacity-100' : 'opacity-40'}`}
                                    title="Toggle Image Layer"
                                >
                                    {trackVisibility.images ? '👁️' : '🕶️'}
                                </button>
                            </div>
                        </div>

                        {/* Track 3: Text Header */}
                        <div className="h-7 px-2 flex items-center justify-between text-red-500">
                            <span className="truncate">📝 Text</span>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setTrackVisibility(prev => ({ ...prev, text: !prev.text }))}
                                    className={`p-0.5 ${trackVisibility.text ? 'opacity-100' : 'opacity-40'}`}
                                    title="Toggle Text Layer"
                                >
                                    {trackVisibility.text ? '👁️' : '🕶️'}
                                </button>
                            </div>
                        </div>

                        {/* Track 4: Marker Header */}
                        <div className="h-6 px-2 flex items-center justify-between text-amber-500">
                            <span className="truncate">⭕ Focus</span>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setTrackVisibility(prev => ({ ...prev, marker: !prev.marker }))}
                                    className={`p-0.5 ${trackVisibility.marker ? 'opacity-100' : 'opacity-40'}`}
                                    title="Toggle Marker Layer"
                                >
                                    {trackVisibility.marker ? '👁️' : '🕶️'}
                                </button>
                            </div>
                        </div>

                        {/* Track 5: BGM Header */}
                        <div className="h-6 px-2 flex items-center justify-between text-purple-500">
                            <span className="truncate">🎵 Music</span>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setTrackVisibility(prev => ({ ...prev, bgm: !prev.bgm }))}
                                    className={`p-0.5 ${trackVisibility.bgm ? 'opacity-100' : 'opacity-40'}`}
                                    title="Toggle BGM Audio"
                                >
                                    {trackVisibility.bgm ? '🔊' : '🔇'}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Right Horizontally Scrollable Timeline Container */}
                    <div
                        ref={timelineScrollWrapperRef}
                        className={`flex-1 overflow-x-auto relative ${isDark ? 'bg-slate-950/80' : 'bg-slate-100'}`}
                    >
                        <div
                            ref={timelineContainerRef}
                            style={{ width: `${100 * timelineZoom}%`, minWidth: '100%' }}
                            onClick={(e) => {
                                const rect = timelineContainerRef.current.getBoundingClientRect();
                                const clickRatio = (e.clientX - rect.left) / rect.width;
                                handleSeek(clickRatio * duration);
                            }}
                            className="relative h-full py-1 space-y-1 cursor-pointer select-none"
                        >
                            {/* Draggable Red Playhead Needle */}
                            <div
                                className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-40 pointer-events-none shadow-[0_0_10px_rgba(239,68,68,1)]"
                                style={{ left: `${(currentTime / duration) * 100}%` }}
                            >
                                <div className="w-3.5 h-3.5 bg-red-500 -ml-1.5 -mt-0.5 rotate-45 rounded-xs shadow-md" />
                            </div>

                            {/* Time Ruler */}
                            <div className={`h-5 border-b relative font-mono text-[9px] flex items-center ${isDark ? 'border-white/10 text-neutral-400' : 'border-slate-300 text-slate-500'}`}>
                                {Array.from({ length: Math.ceil(duration / 2) + 1 }).map((_, idx) => {
                                    const sec = idx * 2;
                                    if (sec > duration) return null;
                                    const left = (sec / duration) * 100;
                                    return (
                                        <div key={sec} style={{ left: `${left}%` }} className="absolute -translate-x-1/2 flex flex-col items-center">
                                            <span>{formatTime(sec)}</span>
                                            <span className="h-1.5 w-px bg-current opacity-40"></span>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Track 1: Base Video Feed */}
                            <div className={`h-7 rounded-lg border relative overflow-hidden flex items-center px-2 ${isDark ? 'bg-neutral-800/80 border-neutral-700' : 'bg-slate-200 border-slate-300'}`}>
                                <div className="flex-1 h-3 bg-neutral-700/40 rounded flex items-center px-1">
                                    <span className="text-[8px] font-mono opacity-70">1080p Voiceover Video Track</span>
                                </div>
                            </div>

                            {/* Track 2: Images Track with Trimming Handles & Dragging */}
                            <div className={`h-7 rounded-lg border relative overflow-hidden ${isDark ? 'bg-neutral-800/60 border-neutral-700/80' : 'bg-slate-200/80 border-slate-300'}`}>
                                {imageTracks.map(img => {
                                    const left = (img.startTime / duration) * 100;
                                    const width = (img.duration / duration) * 100;
                                    const isSelected = selectedClip?.id === img.id;

                                    return (
                                        <div
                                            key={img.id}
                                            style={{ left: `${left}%`, width: `${width}%` }}
                                            onPointerDown={(e) => startClipDrag(e, 'images', img, 'move')}
                                            className={`absolute top-0.5 bottom-0.5 rounded px-1.5 flex items-center justify-between text-[8px] font-bold border transition-all cursor-grab active:cursor-grabbing ${isSelected ? 'bg-yellow-500 text-black border-white ring-2 ring-yellow-400 z-30 shadow-md' : 'bg-yellow-600/80 text-white border-yellow-500/50'}`}
                                        >
                                            {/* Left Trimming Handle */}
                                            <div
                                                onPointerDown={(e) => startClipDrag(e, 'images', img, 'left')}
                                                className="w-2.5 h-full -ml-1 cursor-ew-resize hover:bg-white/40 flex items-center justify-center shrink-0"
                                                title="Trim Start"
                                            >
                                                <span className="w-1 h-3 bg-white/60 rounded-full"></span>
                                            </div>

                                            <div className="flex items-center gap-1 truncate pointer-events-none">
                                                <span>{img.animation === 'zoom-in' ? '🔍' : img.animation === 'slide-bottom' ? '⬆' : '✨'}</span>
                                                <span className="truncate">{img.name}</span>
                                            </div>

                                            {/* Right Trimming Handle */}
                                            <div
                                                onPointerDown={(e) => startClipDrag(e, 'images', img, 'right')}
                                                className="w-2.5 h-full -mr-1 cursor-ew-resize hover:bg-white/40 flex items-center justify-center shrink-0"
                                                title="Trim End"
                                            >
                                                <span className="w-1 h-3 bg-white/60 rounded-full"></span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Track 3: Synced Text Track with Trimming Handles & Dragging */}
                            <div className={`h-7 rounded-lg border relative overflow-hidden ${isDark ? 'bg-neutral-800/60 border-neutral-700/80' : 'bg-slate-200/80 border-slate-300'}`}>
                                {textTracks.map(t => {
                                    const left = (t.startTime / duration) * 100;
                                    const width = (t.duration / duration) * 100;
                                    const isSelected = selectedClip?.id === t.id;

                                    return (
                                        <div
                                            key={t.id}
                                            style={{ left: `${left}%`, width: `${width}%` }}
                                            onPointerDown={(e) => startClipDrag(e, 'text', t, 'move')}
                                            className={`absolute top-0.5 bottom-0.5 rounded px-1.5 flex items-center justify-between text-[8px] font-bold border transition-all cursor-grab active:cursor-grabbing ${isSelected ? 'border-white ring-2 ring-red-400 z-30 shadow-md' : ''} ${t.displayStyle === 'label' ? 'bg-red-600/90 text-white border-red-400' : 'bg-indigo-600/90 text-white border-indigo-400'}`}
                                        >
                                            {/* Left Trimming Handle */}
                                            <div
                                                onPointerDown={(e) => startClipDrag(e, 'text', t, 'left')}
                                                className="w-2.5 h-full -ml-1 cursor-ew-resize hover:bg-white/40 flex items-center justify-center shrink-0"
                                                title="Trim Start"
                                            >
                                                <span className="w-1 h-3 bg-white/60 rounded-full"></span>
                                            </div>

                                            <div className="flex items-center gap-1 truncate pointer-events-none">
                                                <span>{t.displayStyle === 'label' ? '📺' : '💬'}</span>
                                                <span className="truncate">{t.text}</span>
                                            </div>

                                            {/* Right Trimming Handle */}
                                            <div
                                                onPointerDown={(e) => startClipDrag(e, 'text', t, 'right')}
                                                className="w-2.5 h-full -mr-1 cursor-ew-resize hover:bg-white/40 flex items-center justify-center shrink-0"
                                                title="Trim End"
                                            >
                                                <span className="w-1 h-3 bg-white/60 rounded-full"></span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Track 4: Focus Marker Track with Dragging */}
                            <div className={`h-6 rounded-lg border relative overflow-hidden ${isDark ? 'bg-neutral-800/40 border-neutral-700/60' : 'bg-slate-200/50 border-slate-300'}`}>
                                {markerTracks.map(m => {
                                    const left = (m.startTime / duration) * 100;
                                    const width = (m.duration / duration) * 100;
                                    const isSelected = selectedClip?.id === m.id;

                                    return (
                                        <div
                                            key={m.id}
                                            style={{ left: `${left}%`, width: `${width}%`, backgroundColor: m.color }}
                                            onPointerDown={(e) => startClipDrag(e, 'marker', m, 'move')}
                                            className={`absolute top-0.5 bottom-0.5 rounded px-1 flex items-center justify-between text-[8px] font-black text-black cursor-grab shadow-xs ${isSelected ? 'ring-2 ring-white z-30' : ''}`}
                                        >
                                            <span>⭕</span>
                                            <span className="truncate">{m.type}</span>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Track 5: BGM Track */}
                            <div className={`h-6 rounded-lg border relative overflow-hidden ${isDark ? 'bg-neutral-800/40 border-neutral-700/60' : 'bg-slate-200/50 border-slate-300'}`}>
                                {bgmSrc && (
                                    <div className="absolute inset-0 bg-purple-600/40 border border-purple-500/50 rounded px-2 flex items-center text-[8px] font-bold text-purple-200">
                                        <span>🎵 {bgmName} (Vol: {Math.round(bgmVolume * 100)}%)</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ======================================================== */}
            {/* 4. EXPORT FINISHED MODAL (DOWNLOAD & SOCIAL SHARE)       */}
            {/* ======================================================== */}
            {exportedUrl && (
                <div className="fixed inset-0 z-[1000] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
                    <div className={`border rounded-[2rem] max-w-sm w-full p-6 space-y-4 shadow-2xl flex flex-col items-center ${isDark ? 'bg-slate-900 border-white/20 text-white' : 'bg-white border-slate-200 text-slate-800'}`}>
                        <div className="w-full flex justify-between items-center pb-2 border-b border-white/10">
                            <span className="text-xs font-black uppercase text-yellow-500 flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping"></span>
                                Final Reel Ready!
                            </span>
                            <span className="text-[10px] font-bold opacity-60">Full HD MP4</span>
                        </div>

                        <div className="w-full aspect-[9/16] max-h-[48vh] bg-black rounded-2xl overflow-hidden border border-neutral-800 flex items-center justify-center shadow-inner">
                            <video src={exportedUrl} controls autoPlay loop playsInline className="w-full h-full object-contain" />
                        </div>

                        <p className="text-[11px] opacity-70 text-center leading-relaxed">
                            All animated images, timed captions, focus markers, BGM and noise reduction filters are compiled into your HD Reel!
                        </p>

                        <div className="w-full space-y-2.5">
                            <button
                                onClick={handleSaveToGallery}
                                className="w-full py-3.5 bg-gradient-to-r from-yellow-400 to-amber-500 text-black font-black rounded-2xl uppercase tracking-wider text-xs shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
                            >
                                💾 Save to Gallery / Download
                            </button>
                            <button
                                onClick={async () => {
                                    if (navigator.share && exportedBlob) {
                                        const file = new File([exportedBlob], 'story_reel.mp4', { type: 'video/mp4' });
                                        await navigator.share({ files: [file], title: 'Story Reel' }).catch(() => {});
                                    } else {
                                        handleSaveToGallery();
                                    }
                                }}
                                className={`w-full py-3 font-bold rounded-2xl uppercase tracking-wider text-xs active:scale-95 transition-all flex items-center justify-center gap-2 border ${isDark ? 'bg-white/10 hover:bg-white/20 text-white border-white/20' : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'}`}
                            >
                                📤 Share to WhatsApp / Instagram
                            </button>
                            <button
                                onClick={() => setExportedUrl(null)}
                                className="w-full py-2 opacity-60 hover:opacity-100 text-xs font-bold transition-all"
                            >
                                ✕ Back to Editor
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TimelineStudio;
