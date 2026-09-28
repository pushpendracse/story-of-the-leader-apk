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
    fontSize = 44
}) => {
    const width = 1080;
    const height = 1920;

    // Multi-lingual grapheme segmentation for precise Indic/Latin karaoke
    const segmenter = typeof Intl !== 'undefined' && Intl.Segmenter
        ? new Intl.Segmenter('hi-IN', { granularity: 'grapheme' })
        : null;

    const graphemes = segmenter && content
        ? Array.from(segmenter.segment(content)).map(s => s.segment)
        : (content ? content.split('') : []);

    let currentGraphemeProgress = 0;
    let currentImageIndex = 0;
    let imageStartTime = 0;
    let isFinished = false;
    let showOutro = false;
    let outroStartTime = 0;

    // Helper: Wrap text into lines
    const wrapText = (ctx, text, maxWidth) => {
        const words = text.split(' ');
        const lines = [];
        let currentLine = '';

        for (let i = 0; i < words.length; i++) {
            const testLine = currentLine ? currentLine + ' ' + words[i] : words[i];
            const metrics = ctx.measureText(testLine);
            if (metrics.width > maxWidth && currentLine) {
                lines.push(currentLine);
                currentLine = words[i];
            } else {
                currentLine = testLine;
            }
        }
        if (currentLine) lines.push(currentLine);
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

            // 2. Background Media with Ken Burns Zoom & Pan (when camera is not active)
            if (!hasLiveCamera && mediaImages.length > 0) {
                if (imageStartTime === 0) imageStartTime = timestamp;
                const elapsedSinceImg = timestamp - imageStartTime;
                if (elapsedSinceImg > 8000) {
                    currentImageIndex = (currentImageIndex + 1) % mediaImages.length;
                    imageStartTime = timestamp;
                }

                const img = mediaImages[currentImageIndex];
                if (img && img.complete && img.naturalWidth > 0) {
                    const progress = (timestamp - imageStartTime) / 8000;
                    const scale = 1.05 + 0.12 * Math.sin(progress * Math.PI);
                    const drawW = width * scale;
                    const drawH = height * scale;
                    const offsetX = (width - drawW) / 2;
                    const offsetY = (height - drawH) / 2;

                    ctx.save();
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

            // 3. Header Section (Episode / News Title)
            const headerX = 60;
            const headerY = 70;
            const headerW = width - 120;
            const headerH = 200;

            if (heading) {
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

                ctx.font = '900 44px serif';
                ctx.fillStyle = '#ffffff';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';

                const lines = wrapText(ctx, heading.toUpperCase(), headerW - 60);
                const lineHeight = 52;
                const startY = headerY + (headerH / 2) - 15 - ((lines.length - 1) * lineHeight) / 2;
                lines.forEach((line, idx) => {
                    ctx.fillText(line, width / 2, startY + idx * lineHeight);
                });

                // Red Accent Bar
                ctx.fillStyle = '#dc2626';
                drawRoundedRect(ctx, width / 2 - 80, headerY + headerH - 22, 160, 6, 3, '#dc2626', null);
            }

            // 4. Script / Karaoke Teleprompter Section
            if (graphemes.length > 0) {
                const charsPerSec = (wpm * 5) / 60;
                currentGraphemeProgress = Math.min(
                    currentGraphemeProgress + charsPerSec / 60,
                    graphemes.length
                );

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
                } else {
                    // Center Card (Classic full studio)
                    cardH = calculatedH;
                    cardY = headerY + headerH + 30 + (availableArea - calculatedH) / 2;
                }

                // Draw Prompter Glass Container
                drawRoundedRect(
                    ctx,
                    cardX,
                    cardY,
                    cardW,
                    cardH,
                    32,
                    `rgba(10, 10, 15, ${prompterOpacity})`,
                    'rgba(255, 255, 255, 0.12)'
                );

                // Clip within card for scrolling
                ctx.save();
                ctx.beginPath();
                ctx.rect(cardX + 20, cardY + 20, cardW - 40, cardH - 40);
                ctx.clip();

                const activeFontSize = fontSize || 44;
                ctx.font = `600 ${activeFontSize}px serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'top';

                const lines = wrapText(ctx, content, cardW - 100);
                const lineHeight = Math.round(activeFontSize * 1.68);

                // Calculate which character maps to which line
                const charRatio = currentGraphemeProgress / Math.max(1, graphemes.length);
                const currentLineIndex = Math.min(lines.length - 1, Math.floor(charRatio * lines.length));

                // Smooth vertical scrolling centering on current line
                const centerTargetOffset = cardH * 0.35;
                const targetScrollY = cardY + centerTargetOffset - currentLineIndex * lineHeight;
                const activeScrollY = targetScrollY;

                let charAccumulator = 0;

                lines.forEach((line, lineIdx) => {
                    const lineY = activeScrollY + lineIdx * lineHeight;
                    if (lineY > cardY - 90 && lineY < cardY + cardH + 90) {
                        const lineChars = Array.from(
                            segmenter ? segmenter.segment(line) : line.split('')
                        ).map(s => typeof s === 'string' ? s : s.segment);

                        const lineWidth = ctx.measureText(line).width;
                        let curX = (width - lineWidth) / 2;

                        lineChars.forEach((ch) => {
                            const chWidth = ctx.measureText(ch).width;
                            const isHighlighted = charAccumulator <= currentGraphemeProgress;

                            ctx.fillStyle = isHighlighted ? '#f59e0b' : 'rgba(255, 255, 255, 0.88)';
                            if (isHighlighted) {
                                ctx.shadowColor = '#d97706';
                                ctx.shadowBlur = 10;
                            } else {
                                ctx.shadowBlur = 0;
                            }

                            ctx.fillText(ch, curX + chWidth / 2, lineY);
                            curX += chWidth;
                            charAccumulator++;
                        });
                    } else {
                        charAccumulator += line.length;
                    }
                });

                ctx.restore();

                // Check completion
                if (currentGraphemeProgress >= graphemes.length) {
                    if (outroImage && !showOutro) {
                        showOutro = true;
                        outroStartTime = timestamp;
                    } else if (!outroImage) {
                        isFinished = true;
                    }
                }
            }

            // 5. Footer Branding Bar
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
        }
    };
};
