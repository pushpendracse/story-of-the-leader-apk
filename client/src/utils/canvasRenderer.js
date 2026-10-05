export class CanvasRenderer {
    constructor(canvas, video) {
        this.canvas = canvas;
        this.video = video;
        this.ctx = canvas.getContext('2d');
        
        // State
        this.scrollOffset = 0;
        this.scrollSpeed = 1;
        this.isRecording = false;
        
        // Data
        this.scriptText = "";
        this.headingText = "";
        this.images = []; // Array of Image objects
        
        // Internal
        this.imageObjs = [];
    }

    setScriptData({ heading, script, images }) {
        this.headingText = heading;
        this.scriptText = script;
        
        // Load images
        this.imageObjs = [];
        images.forEach(imgData => {
            const img = new Image();
            img.src = imgData.url;
            img.onload = () => {
                this.imageObjs.push(img);
            };
        });
    }

    setSpeed(speed) {
        this.scrollSpeed = speed;
    }
    
    setRecordingState(isRec) {
        this.isRecording = isRec;
    }

    draw(timestamp) {
        if (!this.canvas || !this.video) return;
        
        const w = this.canvas.width;
        const h = this.canvas.height;
        
        // 1. Draw Camera (Background)
        if (this.video.readyState >= 2) {
            this.ctx.drawImage(this.video, 0, 0, w, h);
        } else {
            // Fallback black background if camera not ready
            this.ctx.fillStyle = '#000';
            this.ctx.fillRect(0, 0, w, h);
        }

        // 2. Draw Images (Collage / Overlays)
        if (this.imageObjs.length > 0) {
            this.imageObjs.forEach((img, i) => {
                const imgW = 400;
                const imgH = 300;
                // Distribute images nicely
                const x = 50 + (i % 2) * 450; 
                const y = 300 + Math.floor(i / 2) * 350;
                
                // Add shadow & border
                this.ctx.save();
                this.ctx.shadowColor = 'rgba(0,0,0,0.8)';
                this.ctx.shadowBlur = 20;
                this.ctx.shadowOffsetY = 10;
                this.ctx.strokeStyle = '#ffffff';
                this.ctx.lineWidth = 10;
                
                this.ctx.strokeRect(x, y, imgW, imgH);
                this.ctx.drawImage(img, x, y, imgW, imgH);
                this.ctx.restore();
            });
        }

        // 3. Draw Teleprompter Text
        if (this.scriptText) {
            this.ctx.save();
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
            this.ctx.fillRect(0, 0, w, h); // Slight darken for text readability

            this.ctx.font = 'bold 60px Arial';
            this.ctx.fillStyle = '#ffffff';
            this.ctx.textAlign = 'center';
            this.ctx.shadowColor = '#000';
            this.ctx.shadowBlur = 8;
            this.ctx.shadowOffsetY = 4;

            const maxLineWidth = w - 100;
            const words = this.scriptText.split(' ');
            const lines = [];
            let currentLine = words[0];

            for (let i = 1; i < words.length; i++) {
                const word = words[i];
                const metrics = this.ctx.measureText(currentLine + " " + word);
                if (metrics.width < maxLineWidth) {
                    currentLine += " " + word;
                } else {
                    lines.push(currentLine);
                    currentLine = word;
                }
            }
            lines.push(currentLine);

            const lineHeight = 80;
            const startY = h / 2 - this.scrollOffset;
            
            lines.forEach((line, index) => {
                const y = startY + (index * lineHeight);
                // Only draw if visible on screen
                if (y > -100 && y < h + 100) {
                    // Highlight the text in the exact center
                    if (y > h/2 - 100 && y < h/2 + 100) {
                        this.ctx.fillStyle = '#fde047'; // yellow-300
                        this.ctx.font = 'bold 65px Arial';
                    } else {
                        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
                        this.ctx.font = 'bold 60px Arial';
                    }
                    this.ctx.fillText(line, w / 2, y);
                }
            });
            this.ctx.restore();
            
            // Advance scroll only if recording
            if (this.isRecording) {
                this.scrollOffset += this.scrollSpeed;
            }
        }

        // 4. Draw Lower Thirds (Heading)
        if (this.headingText) {
            this.ctx.save();
            // Red gradient bar
            const grad = this.ctx.createLinearGradient(0, h - 160, 0, h - 60);
            grad.addColorStop(0, '#dc2626'); // red-600
            grad.addColorStop(1, '#991b1b'); // red-800
            
            this.ctx.fillStyle = grad;
            this.ctx.shadowColor = 'rgba(0,0,0,0.8)';
            this.ctx.shadowBlur = 20;
            this.ctx.fillRect(0, h - 160, w, 100);

            // "BREAKING NEWS" Badge
            this.ctx.fillStyle = '#ffffff';
            this.ctx.fillRect(0, h - 220, 350, 60);
            this.ctx.fillStyle = '#dc2626';
            this.ctx.font = 'bold 35px Arial';
            this.ctx.textAlign = 'left';
            this.ctx.fillText("BREAKING NEWS", 20, h - 178);

            // Heading Text
            this.ctx.fillStyle = '#ffffff';
            this.ctx.font = 'bold 50px Arial';
            this.ctx.shadowColor = 'transparent';
            this.ctx.fillText(this.headingText.toUpperCase(), 30, h - 90);
            this.ctx.restore();
        }
        
        // 5. Draw Record Indicator
        if (this.isRecording) {
            this.ctx.save();
            this.ctx.fillStyle = (Math.floor(timestamp / 500) % 2 === 0) ? '#ef4444' : 'transparent';
            this.ctx.beginPath();
            this.ctx.arc(60, 60, 20, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.fillStyle = '#ffffff';
            this.ctx.font = 'bold 30px Arial';
            this.ctx.fillText('REC', 90, 70);
            this.ctx.restore();
        }
    }
}
