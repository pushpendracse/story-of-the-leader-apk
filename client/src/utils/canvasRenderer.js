// Canvas Reel Rendering Engine for 1080x1920 Vertical Short-Form Video

export const createReelRenderer = ({
    heading = '',
    content = '',
    mediaImages = [], // Array of loaded HTMLImageElement
    outroImage = null, // Loaded HTMLImageElement or null
    wpm = 110,
    theme = 'dark',
    cameraVideoElement = null, // Live HTMLVideoElement for selfie / front camera
    isFrontCamera = true,
    prompterMode = 'center', // 'center' | 'bottom' | 'top'
    prompterHeight = 0.55, // 0.30 to 0.85 of available height
    prompterOpacity = 0.80, // 0.20 to 0.95
    fontSize = 44,
    aspectRatio = '9:16',
    textAlign = 'justify',
    highlightStyle = 'karaoke',
    fontFamily = 'serif'
}) => {
    const width = aspectRatio === '16:9' ? 1920 : 1080;
    const height = aspectRatio === '16:9' ? 1080 : 1920;

    // Multi-lingual grapheme segmentation for precise Indic/Latin karaoke
    const segmenter = typeof Intl !== 'undefined' && Intl.Segmenter
        ? new Intl.Segmenter('hi-IN', { granularity: 'grapheme' })
        : null;

    const graphemes = segmenter && content
        ? Array.from(segmenter.segment(content)).map(s => s.segment)
        : (content ? content.split('') : []);

    const getCanvasFontFamily = () => {
        switch (fontFamily) {
            case 'handwritten': return '"Kalam", cursive';
            case 'display': return '"Oswald", sans-serif';
            case 'sans-serif': return '"Roboto", sans-serif';
            case 'serif':
            default: return '"Playfair Display", serif';
        }
    };

    let currentGraphemeProgress = 0;
    let currentImageIndex = 0;
    let imageStartTime = 0;
    let isFinished = false;
    let showOutro = false;
    let outroStartTime = 0;
    let startTimestamp = 0;
    let endDelayStartTime = 0;
    let lastFrameTime = 0;

    const processLine = (ctx, lineText, isLastInPara) => {
        const lineChars = Array.from(
            segmenter ? segmenter.segment(lineText) : lineText.split('')
        ).map(s => typeof s === 'string' ? s : s.segment);
        const chars = lineChars.map(ch => ({
            str: ch,
            width: ctx.measureText(ch).width
        }));
        return {
            text: lineText,
            chars: chars,
            lineWidth: ctx.measureText(lineText).width,
            isLastInPara
        };
    };

    // Helper: Wrap text into lines, preserving newlines
    const wrapText = (ctx, text, maxWidth) => {
        const lines = [];
        const paragraphs = text.split('\n');
        for (const p of paragraphs) {
            if (!p) {
                lines.push({ text: '', chars: [], lineWidth: 0, isLastInPara: true });
                continue;
            }
            const words = p.split(' ');
            let currentLine = '';
            for (let i = 0; i < words.length; i++) {
                const testLine = currentLine ? currentLine + ' ' + words[i] : words[i];
                const metrics = ctx.measureText(testLine);
                if (metrics.width > maxWidth && currentLine) {
                    lines.push(processLine(ctx, currentLine, false));
                    currentLine = words[i];
                } else {
                    currentLine = testLine;
                }
            }
            if (currentLine) lines.push(processLine(ctx, currentLine, true));
        }
        return lines;
    };

    // Helper: Draw rounded rectangle
    const drawRoundedRect = (ctx, x, y, w, h, radius, fillStyle, strokeStyle) => {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + w - radius, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
        ctx.lineTo(x + w, y + h - radius);
        ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
        ctx.lineTo(x + radius, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
        if (fillStyle) {
            ctx.fillStyle = fillStyle;
            ctx.fill();
        }
        if (strokeStyle) {
            ctx.strokeStyle = strokeStyle;
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    };

    return {
        width,
        height,
        graphemeCount: graphemes.length,
        isComplete: () => isFinished,

        renderFrame: (ctx, timestamp) => {
            if (startTimestamp === 0) startTimestamp = timestamp;
            const elapsed = timestamp - startTimestamp;

            if (lastFrameTime === 0) lastFrameTime = timestamp;
            const delta = timestamp - lastFrameTime;
            lastFrameTime = timestamp;
            const clampedDelta = Math.min(delta, 50);

            // Background Clear
            ctx.fillStyle = '#0a0a0a';
            ctx.fillRect(0, 0, width, height);

            // Outro Handling
            if (showOutro && outroImage) {
                try {
                    ctx.drawImage(outroImage, 0, 0, width, height);
                } catch (e) {
                    ctx.fillStyle = '#000000';
                    ctx.fillRect(0, 0, width, height);
                }
                if (timestamp - outroStartTime > 4000) {
                    isFinished = true;
                }
                return;
            }

            // 1. Live Camera Feed (Selfie / Front Camera)
            let hasLiveCamera = false;
            if (cameraVideoElement && cameraVideoElement.readyState >= 2 && cameraVideoElement.videoWidth > 0) {
                hasLiveCamera = true;
                ctx.save();
                const vW = cameraVideoElement.videoWidth;
                const vH = cameraVideoElement.videoHeight;
                const scale = Math.max(width / vW, height / vH);
                const sW = vW * scale;
                const sH = vH * scale;
                const dx = (width - sW) / 2;
                const dy = (height - sH) / 2;

                if (isFrontCamera) {
                    // Mirror horizontally for natural selfie camera preview
                    ctx.translate(width, 0);
                    ctx.scale(-1, 1);
                    ctx.drawImage(cameraVideoElement, dx, dy, sW, sH);
                } else {
                    ctx.drawImage(cameraVideoElement, dx, dy, sW, sH);
                }
                ctx.restore();
            }

            // 2. Background Media with Cinematic Entrance Animation & Ken Burns
            if (!hasLiveCamera && mediaImages.length > 0) {
                if (imageStartTime === 0) imageStartTime = timestamp;
                const elapsedSinceImg = timestamp - imageStartTime;
                if (elapsedSinceImg > 8000) {
                    currentImageIndex = (currentImageIndex + 1) % mediaImages.length;
                    imageStartTime = timestamp;
                }

                const img = mediaImages[currentImageIndex];
                if (img && img.complete && img.naturalWidth > 0) {
                    const elapsed = timestamp - imageStartTime;
                    const entranceDuration = 1200; // 1.2s entrance animation
                    const entranceProgress = Math.min(1, elapsed / entranceDuration);
                    const easeOut = 1 - Math.pow(1 - entranceProgress, 3);

                    const progress = elapsed / 8000;
                    // Cinematic entrance scale + subtle pulse
                    const entranceScale = 0.92 + (0.16 * easeOut);
                    const scale = entranceScale + 0.06 * Math.sin(progress * Math.PI);
                    const drawW = width * scale;
                    const drawH = height * scale;
                    const offsetX = (width - drawW) / 2;
                    const offsetY = (height - drawH) / 2;

                    ctx.save();
                    ctx.globalAlpha = easeOut;
                    ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
                    ctx.restore();
                }
            }

            // Dark gradient overlay for text readability
            const grad = ctx.createLinearGradient(0, 0, 0, height);
            if (hasLiveCamera) {
                // Lighter gradient to show user face clearly
                grad.addColorStop(0, 'rgba(0, 0, 0, 0.45)');
                grad.addColorStop(0.3, 'rgba(0, 0, 0, 0.20)');
                grad.addColorStop(0.7, 'rgba(0, 0, 0, 0.35)');
                grad.addColorStop(1, 'rgba(0, 0, 0, 0.75)');
            } else {
                grad.addColorStop(0, 'rgba(0, 0, 0, 0.7)');
                grad.addColorStop(0.3, 'rgba(0, 0, 0, 0.5)');
                grad.addColorStop(0.7, 'rgba(0, 0, 0, 0.6)');
                grad.addColorStop(1, 'rgba(0, 0, 0, 0.85)');
            }
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, width, height);

            // 3. Header Section (Episode / News Title) — hidden in krane mode
            const headerX = 60;
            const headerY = 70;
            const headerW = width - 120;
            const headerH = 200;

            if (heading && prompterMode !== 'krane') {
                drawRoundedRect(
                    ctx,
                    headerX,
                    headerY,
                    headerW,
                    headerH,
                    28,
                    `rgba(15, 15, 20, ${Math.min(0.90, prompterOpacity + 0.1)})`,
                    'rgba(255, 255, 255, 0.15)'
                );

                ctx.font = `900 44px ${getCanvasFontFamily()}`;
                ctx.fillStyle = '#ffffff';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';

                const lines = wrapText(ctx, heading.toUpperCase(), headerW - 60);
                const lineHeight = 52;
                const startY = headerY + (headerH / 2) - 15 - ((lines.length - 1) * lineHeight) / 2;
                lines.forEach((lineObj, idx) => {
                    ctx.fillText(lineObj.text, width / 2, startY + idx * lineHeight);
                });

                // Red Accent Bar
                ctx.fillStyle = '#dc2626';
                drawRoundedRect(ctx, width / 2 - 80, headerY + headerH - 22, 160, 6, 3, '#dc2626', null);
            }

            // 4. Script / Karaoke Teleprompter Section
            if (graphemes.length > 0) {
                if (elapsed > 1500) {
                    const charsPerSec = (wpm * 5) / 60;
                    const increment = (clampedDelta / 1000) * charsPerSec;
                    currentGraphemeProgress = Math.min(
                        currentGraphemeProgress + increment,
                        graphemes.length
                    );
                }

                const cardX = 60;
                const cardW = width - 120;
                const availableArea = height - 420; // Room for header + footer

                let cardY, cardH;
                const calculatedH = Math.max(380, Math.min(availableArea, availableArea * prompterHeight));

                if (prompterMode === 'bottom') {
                    // Lower-Third / News Ticker: Sits at the bottom of the screen
                    cardH = Math.min(650, calculatedH);
                    cardY = height - 160 - cardH;
                } else if (prompterMode === 'top') {
                    // Top Prompter (Eye contact near camera lens)
                    cardH = Math.min(750, calculatedH);
                    cardY = headerY + headerH + 30;
                } else if (prompterMode === 'krane') {
                    // Krane: full-screen immersive — card spans nearly the whole canvas,
                    // no header/footer reserved, text pans downward with reading progress
                    cardH = height - 140; // top 70px + bottom 70px breathing room
                    cardY = 70;
                } else {
                    // Center Card (Classic full studio)
                    cardH = calculatedH;
                    cardY = headerY + headerH + 30 + (availableArea - calculatedH) / 2;
                }

                // Krane: draw inline heading at the very top of the card
                if (prompterMode === 'krane' && heading) {
                    ctx.save();
                    ctx.font = `900 46px ${getCanvasFontFamily()}`;
                    ctx.fillStyle = '#ffffff';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.shadowColor = 'rgba(0,0,0,0.8)';
                    ctx.shadowBlur = 18;
                    const hLines = wrapText(ctx, heading.toUpperCase(), cardW - 60);
                    const hLineH = 54;
                    hLines.forEach((lineObj, idx) => {
                        ctx.fillText(lineObj.text, width / 2, cardY + 54 + idx * hLineH);
                    });
                    // Red accent bar under inline heading
                    ctx.fillStyle = '#dc2626';
                    ctx.shadowBlur = 0;
                    const hBlockH = hLines.length * hLineH + 20;
                    drawRoundedRect(ctx, width / 2 - 70, cardY + hBlockH + 10, 140, 6, 3, '#dc2626', null);
                    ctx.restore();
                }

                // Clip within card for scrolling
                ctx.save();
                ctx.beginPath();
                ctx.rect(cardX + 20, cardY + 20, cardW - 40, cardH - 40);
                ctx.clip();

                const activeFontSize = fontSize || 44;
                ctx.font = `600 ${activeFontSize}px ${getCanvasFontFamily()}`;
                ctx.textAlign = 'left';
                ctx.textBaseline = 'top';

                const lines = wrapText(ctx, content, cardW - 100);
                const lineHeight = Math.round(activeFontSize * 1.68);

                // Calculate which character maps to which line
                const charRatio = currentGraphemeProgress / Math.max(1, graphemes.length);
                const currentLineIndex = Math.min(lines.length - 1, Math.floor(charRatio * lines.length));

                let activeScrollY;
                if (prompterMode === 'krane') {
                    // Krane pan: text starts near the top of the card and slowly drifts down
                    // as reading progresses — mimics a real crane camera pull-down.
                    // kraneTextTop = where line 0 begins (offset from cardY so first line is visible)
                    const inlineHeadingOffset = heading
                        ? (wrapText(ctx, heading.toUpperCase(), cardW - 60).length * 54 + 80)
                        : 0;
                    const kraneStart = cardY + inlineHeadingOffset + activeFontSize;
                    const totalTextH = lines.length * lineHeight;
                    // Max pan: text bottom aligns with card bottom (minus fade zone)
                    const maxPan = Math.max(0, totalTextH - (cardH - inlineHeadingOffset - activeFontSize - cardH * 0.12));
                    const kranePan = charRatio * maxPan;
                    activeScrollY = kraneStart - kranePan;
                } else {
                    // Standard center-tracking scroll
                    const centerTargetOffset = cardH * 0.35;
                    activeScrollY = cardY + centerTargetOffset - currentLineIndex * lineHeight;
                }

                // Edge fade distances — stronger for krane (8%) vs standard (15%)
                const fadePct = prompterMode === 'krane' ? 0.08 : 0.15;

                let charAccumulator = 0;

                lines.forEach((lineObj, lineIdx) => {
                    const lineText = lineObj.text;
                    const lineY = activeScrollY + lineIdx * lineHeight;
                    if (lineY > cardY - 90 && lineY < cardY + cardH + 90) {
                        
                        // Edge Fade Effect
                        let lineAlpha = 1;
                        const fadeDist = cardH * fadePct;
                        const distToTop = lineY - (cardY + 20);
                        const distToBottom = (cardY + cardH - 20) - (lineY + lineHeight);
                        
                        if (distToTop < fadeDist) lineAlpha = Math.max(0, distToTop / fadeDist);
                        if (distToBottom < fadeDist) lineAlpha = Math.min(lineAlpha, Math.max(0, distToBottom / fadeDist));
                        
                        ctx.globalAlpha = lineAlpha;

                        const lineChars = lineObj.chars;
                        const lineWidth = lineObj.lineWidth;
                        let curX = cardX + 50; // default for left

                        if (textAlign === 'center') {
                            curX = (width - lineWidth) / 2;
                        }

                        let spaceExtra = 0;
                        if (textAlign === 'justify' && !lineObj.isLastInPara && lineChars.length > 0) {
                            const spaceCount = lineChars.filter(c => c.str === ' ').length;
                            if (spaceCount > 0) {
                                spaceExtra = ((cardW - 100) - lineWidth) / spaceCount;
                            }
                        }

                        lineChars.forEach((chObj) => {
                            const ch = chObj.str;
                            const chWidth = chObj.width;
                            const charIndex = charAccumulator;
                            
                            const isPassed = currentGraphemeProgress >= charIndex + 1;
                            const isPassing = currentGraphemeProgress > charIndex && currentGraphemeProgress < charIndex + 1;
                            const ratio = isPassing ? currentGraphemeProgress - charIndex : (isPassed ? 1 : 0);

                            const textColorLight = 'rgba(255, 255, 255, 0.95)';
                            const textColorDark = 'rgba(255, 255, 255, 0.40)';
                            const highlightColor = '#f59e0b';
                            
                            let charColor = textColorLight;
                            if (highlightStyle === 'karaoke' || highlightStyle === 'color') {
                                charColor = textColorDark;
                            }
                            
                            if (highlightStyle !== 'none' && (isPassed || isPassing)) {
                                if (highlightStyle === 'box') {
                                    ctx.fillStyle = 'rgba(245, 158, 11, 0.6)';
                                    const bw = isPassed ? chWidth + 2 : (chWidth + 2) * ratio;
                                    ctx.fillRect(curX - 1, lineY - 2, bw, activeFontSize + 12);
                                } else if (highlightStyle === 'underline') {
                                    ctx.fillStyle = highlightColor;
                                    const uw = isPassed ? chWidth : chWidth * ratio;
                                    ctx.fillRect(curX, lineY + activeFontSize + 6, uw, 4);
                                }
                            }

                            if (highlightStyle !== 'none' && (highlightStyle === 'karaoke' || highlightStyle === 'color')) {
                                if (isPassed) {
                                    ctx.fillStyle = highlightColor;
                                    ctx.shadowColor = '#d97706';
                                    ctx.shadowBlur = 10;
                                } else if (isPassing) {
                                    const fill = ctx.createLinearGradient(curX, 0, curX + chWidth, 0);
                                    fill.addColorStop(ratio, highlightColor);
                                    fill.addColorStop(ratio, charColor);
                                    ctx.fillStyle = fill;
                                    ctx.shadowColor = '#d97706';
                                    ctx.shadowBlur = 10 * ratio;
                                } else {
                                    ctx.fillStyle = charColor;
                                    ctx.shadowBlur = 0;
                                }
                            } else {
                                ctx.fillStyle = textColorLight;
                                ctx.shadowBlur = 0;
                            }

                            ctx.fillText(ch, curX, lineY);
                            curX += chWidth + (ch === ' ' ? spaceExtra : 0);
                            charAccumulator++;
                        });
                        
                        charAccumulator++; // Add 1 for the space or newline that caused the wrap
                    } else {
                        charAccumulator += lineText.length + 1; // +1 for the separator
                    }
                });

                ctx.restore();

                // Check completion
                if (currentGraphemeProgress >= graphemes.length) {
                    if (endDelayStartTime === 0) {
                        endDelayStartTime = timestamp;
                    }
                    if (timestamp - endDelayStartTime > 4000) {
                        if (outroImage && !showOutro) {
                            showOutro = true;
                            outroStartTime = timestamp;
                        } else if (!outroImage) {
                            isFinished = true;
                        }
                    }
                }
            }

            // 5. Footer Branding Bar — hidden in krane mode
            if (prompterMode !== 'krane') {
                const footerY = height - 110;
                drawRoundedRect(
                    ctx,
                    width / 2 - 290,
                    footerY,
                    580,
                    50,
                    25,
                    'rgba(15, 15, 20, 0.75)',
                    'rgba(255, 255, 255, 0.15)'
                );
                ctx.font = '800 20px sans-serif';
                ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.shadowBlur = 0;
                ctx.fillText('HISTORICAL ARCHIVE • STORY OF THE LEADER', width / 2, footerY + 25);
            } else {
                // Krane mode: small badge bottom-center
                const badgeY = height - 80;
                drawRoundedRect(ctx, width / 2 - 120, badgeY, 240, 44, 22, 'rgba(0,0,0,0.55)', 'rgba(245,158,11,0.4)');
                ctx.font = '700 18px sans-serif';
                ctx.fillStyle = 'rgba(245,158,11,0.9)';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.shadowBlur = 0;
                ctx.fillText('🏗️ KRANE MODE', width / 2, badgeY + 22);
            }
        }
    };
};
