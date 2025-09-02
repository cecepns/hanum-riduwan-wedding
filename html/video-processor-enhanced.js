/**
 * Enhanced Video Processor dengan Bingkai Overlay
 * Library untuk menambahkan bingkai pada video dengan performa tinggi
 * Mendukung FFmpeg.js untuk kualitas terbaik dan fallback ke optimized MediaRecorder
 */

class EnhancedVideoProcessor {
    constructor() {
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.frameImage = null;
        this.isProcessing = false;
        this.ffmpegLoaded = false;
        this.ffmpeg = null;
        this.useFFmpeg = true;
        
        // Worker canvas for background processing
        this.workerCanvas = document.createElement('canvas');
        this.workerCtx = this.workerCanvas.getContext('2d');
        
        // Performance optimizations
        this.ctx.imageSmoothingEnabled = true;
        this.ctx.imageSmoothingQuality = 'high';
        this.workerCtx.imageSmoothingEnabled = true;
        this.workerCtx.imageSmoothingQuality = 'high';
    }

    /**
     * Initialize FFmpeg.js untuk video processing yang optimal
     * @returns {Promise} Promise yang resolve ketika FFmpeg ready
     */
    async initializeFFmpeg() {
        if (this.ffmpegLoaded) return;
        
        try {
            // Load FFmpeg dari CDN jika belum tersedia
            if (typeof FFmpeg === 'undefined') {
                await this.loadFFmpegScript();
            }
            
            if (typeof FFmpeg !== 'undefined') {
                this.ffmpeg = new FFmpeg();
                this.ffmpeg.on('log', ({ message }) => {
                    console.log('FFmpeg:', message);
                });
                
                // Load with WASM binary
                await this.ffmpeg.load({
                    coreURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js'
                });
                
                this.ffmpegLoaded = true;
                console.log('FFmpeg.js loaded successfully');
                return true;
            }
        } catch (error) {
            console.warn('Failed to load FFmpeg.js, using optimized MediaRecorder fallback:', error);
            this.useFFmpeg = false;
            return false;
        }
    }

    /**
     * Load FFmpeg.js script dynamically
     * @returns {Promise} Promise yang resolve ketika script loaded
     */
    async loadFFmpegScript() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://unpkg.com/@ffmpeg/ffmpeg@0.12.10/dist/umd/ffmpeg.js';
            script.onload = () => {
                console.log('FFmpeg.js script loaded');
                resolve();
            };
            script.onerror = () => {
                console.warn('Failed to load FFmpeg.js script');
                reject(new Error('FFmpeg script load failed'));
            };
            document.head.appendChild(script);
        });
    }

    /**
     * Load bingkai image
     * @param {string} framePath - Path ke file bingkai
     * @returns {Promise} Promise yang resolve ketika bingkai loaded
     */
    loadFrame(framePath) {
        return new Promise((resolve, reject) => {
            this.frameImage = new Image();
            this.frameImage.crossOrigin = 'anonymous';
            this.frameImage.onload = () => {
                console.log('Frame image loaded:', this.frameImage.width + 'x' + this.frameImage.height);
                resolve();
            };
            this.frameImage.onerror = () => reject(new Error('Gagal load bingkai'));
            this.frameImage.src = framePath;
        });
    }

    /**
     * Optimized frame processing dengan hardware acceleration
     * @param {HTMLVideoElement} video - Video element
     * @param {number} width - Lebar output
     * @param {number} height - Tinggi output
     * @returns {HTMLCanvasElement} Canvas dengan frame yang sudah diproses
     */
    processFrame(video, width, height) {
        const targetWidth = 1080;
        const targetHeight = 1920;
        
        this.canvas.width = targetWidth;
        this.canvas.height = targetHeight;

        // Calculate optimal scaling dengan aspect ratio preservation
        const videoWidth = video.videoWidth;
        const videoHeight = video.videoHeight;
        const videoAspect = videoWidth / videoHeight;
        const targetAspect = targetWidth / targetHeight;
        
        let drawWidth, drawHeight, offsetX, offsetY;
        
        if (videoAspect > targetAspect) {
            // Video lebih lebar, fit ke height dan crop sides
            drawHeight = targetHeight;
            drawWidth = targetHeight * videoAspect;
            offsetX = (targetWidth - drawWidth) / 2;
            offsetY = 0;
        } else {
            // Video lebih tinggi, fit ke width dan crop top/bottom
            drawWidth = targetWidth;
            drawHeight = targetWidth / videoAspect;
            offsetX = 0;
            offsetY = (targetHeight - drawHeight) / 2;
        }

        // Clear canvas dengan warna background yang smooth
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(0, 0, targetWidth, targetHeight);

        // Optimized drawing dengan smooth scaling
        this.ctx.save();
        this.ctx.imageSmoothingEnabled = true;
        this.ctx.imageSmoothingQuality = 'high';
        this.ctx.drawImage(video, offsetX, offsetY, drawWidth, drawHeight);
        this.ctx.restore();

        // Draw frame overlay jika ada
        if (this.frameImage) {
            this.ctx.save();
            this.ctx.globalCompositeOperation = 'source-over';
            this.ctx.drawImage(this.frameImage, 0, 0, targetWidth, targetHeight);
            this.ctx.restore();
        }

        return this.canvas;
    }

    /**
     * Main video processing method dengan auto-selection optimal method
     * @param {HTMLVideoElement} video - Video element
     * @param {Function} onProgress - Callback untuk progress
     * @param {string} format - Output format ('webm' atau 'mp4')
     * @returns {Promise<Blob>} Promise yang resolve dengan video blob
     */
    async processVideo(video, onProgress = null, format = 'mp4') {
        // Initialize FFmpeg jika belum ready
        const ffmpegReady = await this.initializeFFmpeg();
        
        if (this.useFFmpeg && ffmpegReady && this.ffmpegLoaded) {
            console.log('Using FFmpeg.js for high-quality processing');
            try {
                return await this.processVideoWithFFmpeg(video, onProgress, format);
            } catch (error) {
                console.warn('FFmpeg processing failed, falling back to optimized MediaRecorder:', error);
                return await this.processVideoOptimized(video, onProgress, format);
            }
        } else {
            console.log('Using optimized MediaRecorder for processing');
            return await this.processVideoOptimized(video, onProgress, format);
        }
    }

    /**
     * Process video using FFmpeg.js for professional quality output
     * @param {HTMLVideoElement} video - Video element
     * @param {Function} onProgress - Callback untuk progress
     * @param {string} format - Output format ('webm' atau 'mp4')
     * @returns {Promise<Blob>} Promise yang resolve dengan video blob
     */
    async processVideoWithFFmpeg(video, onProgress = null, format = 'mp4') {
        if (this.isProcessing) {
            throw new Error('Video sedang diproses');
        }

        this.isProcessing = true;

        try {
            console.log('Starting FFmpeg processing...');
            
            // Create video blob dari video element
            const videoBlob = await this.extractVideoBlob(video);
            const videoFileName = 'input.' + (format === 'mp4' ? 'mp4' : 'webm');
            const frameFileName = 'frame.png';
            const outputFileName = 'output.' + (format === 'mp4' ? 'mp4' : 'webm');
            
            // Write input files ke FFmpeg filesystem
            await this.ffmpeg.writeFile(videoFileName, new Uint8Array(await videoBlob.arrayBuffer()));
            
            if (this.frameImage) {
                const frameBlob = await this.createFrameBlob();
                await this.ffmpeg.writeFile(frameFileName, new Uint8Array(await frameBlob.arrayBuffer()));
            }
            
            // Setup progress tracking
            let progressReported = 0;
            this.ffmpeg.on('progress', ({ progress }) => {
                const currentProgress = Math.min(progress, 0.95); // Reserve 5% for final steps
                if (currentProgress > progressReported + 0.05) { // Update every 5%
                    progressReported = currentProgress;
                    if (onProgress) {
                        onProgress(currentProgress);
                    }
                }
            });
            
            // Build FFmpeg command dengan optimasi kualitas tinggi
            let ffmpegArgs;
            const targetWidth = 1080;
            const targetHeight = 1920;
            
            if (this.frameImage) {
                // Processing dengan frame overlay
                ffmpegArgs = [
                    '-i', videoFileName,
                    '-i', frameFileName,
                    '-filter_complex',
                    `[0:v]scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=increase,crop=${targetWidth}:${targetHeight}[scaled];[1:v]scale=${targetWidth}:${targetHeight}[frame];[scaled][frame]overlay=0:0:format=auto`,
                    '-c:v', format === 'mp4' ? 'libx264' : 'libvpx-vp9',
                    '-c:a', format === 'mp4' ? 'aac' : 'libopus',
                    '-b:v', '10M', // Higher bitrate untuk kualitas terbaik
                    '-b:a', '320k',
                    '-preset', 'medium', // Balance antara speed dan quality
                    '-crf', '18', // High quality untuk MP4
                    '-movflags', '+faststart', // Optimize untuk streaming
                    '-y',
                    outputFileName
                ];
            } else {
                // Processing tanpa frame, hanya resize dan optimize
                ffmpegArgs = [
                    '-i', videoFileName,
                    '-vf', `scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=increase,crop=${targetWidth}:${targetHeight}`,
                    '-c:v', format === 'mp4' ? 'libx264' : 'libvpx-vp9',
                    '-c:a', format === 'mp4' ? 'aac' : 'libopus',
                    '-b:v', '10M',
                    '-b:a', '320k',
                    '-preset', 'medium',
                    '-crf', '18',
                    '-movflags', '+faststart',
                    '-y',
                    outputFileName
                ];
            }
            
            console.log('Executing FFmpeg with args:', ffmpegArgs.join(' '));
            
            // Execute FFmpeg command
            await this.ffmpeg.exec(ffmpegArgs);
            
            // Read hasil output
            const outputData = await this.ffmpeg.readFile(outputFileName);
            const outputBlob = new Blob([outputData.buffer], {
                type: format === 'mp4' ? 'video/mp4' : 'video/webm'
            });
            
            // Final progress update
            if (onProgress) {
                onProgress(1.0);
            }
            
            console.log('FFmpeg processing completed successfully, output size:', outputBlob.size);
            this.isProcessing = false;
            return outputBlob;
            
        } catch (error) {
            this.isProcessing = false;
            console.error('FFmpeg processing error:', error);
            throw error;
        }
    }

    /**
     * Extract video blob dari HTMLVideoElement
     * @param {HTMLVideoElement} video - Video element
     * @returns {Promise<Blob>} Video blob
     */
    async extractVideoBlob(video) {
        // Jika video berasal dari file, langsung gunakan file tersebut
        if (video.src && video.src.startsWith('blob:')) {
            // Convert blob URL ke actual blob
            const response = await fetch(video.src);
            return await response.blob();
        }
        
        // Fallback: record dari video element
        return new Promise((resolve, reject) => {
            const stream = video.captureStream();
            const mediaRecorder = new MediaRecorder(stream, {
                mimeType: 'video/webm;codecs=vp8,opus'
            });
            
            const chunks = [];
            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    chunks.push(event.data);
                }
            };
            
            mediaRecorder.onstop = () => {
                const blob = new Blob(chunks, { type: 'video/webm' });
                resolve(blob);
            };
            
            mediaRecorder.onerror = reject;
            
            mediaRecorder.start();
            video.play();
            
            video.addEventListener('ended', () => {
                mediaRecorder.stop();
            }, { once: true });
        });
    }

    /**
     * Create frame image blob
     * @returns {Promise<Blob>} Frame image blob
     */
    async createFrameBlob() {
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = 1080;
            canvas.height = 1920;
            
            // Draw frame dengan proper scaling
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(this.frameImage, 0, 0, 1080, 1920);
            
            canvas.toBlob(resolve, 'image/png', 1.0);
        });
    }

    /**
     * Optimized MediaRecorder processing dengan performance enhancements
     * @param {HTMLVideoElement} video - Video element
     * @param {Function} onProgress - Callback untuk progress
     * @param {string} format - Output format ('webm' atau 'mp4')
     * @returns {Promise<Blob>} Promise yang resolve dengan video blob
     */
    async processVideoOptimized(video, onProgress = null, format = 'mp4') {
        if (this.isProcessing) {
            throw new Error('Video sedang diproses');
        }

        this.isProcessing = true;
        console.log('Starting optimized MediaRecorder processing...');

        try {
            const targetWidth = 1080;
            const targetHeight = 1920;
            const duration = video.duration;
            const fps = 30; // Optimal FPS untuk smooth playback
            
            // Setup canvas dengan optimal settings
            this.canvas.width = targetWidth;
            this.canvas.height = targetHeight;

            // Create processing video element
            const processingVideo = document.createElement('video');
            processingVideo.src = video.src;
            processingVideo.crossOrigin = 'anonymous';
            processingVideo.muted = false;
            processingVideo.volume = 1.0;
            processingVideo.playsInline = true;
            processingVideo.style.display = 'none';
            document.body.appendChild(processingVideo);

            // Wait for video to be ready
            await new Promise((resolve, reject) => {
                processingVideo.onloadeddata = resolve;
                processingVideo.onerror = reject;
                processingVideo.load();
            });

            // Create optimized canvas stream
            const canvasStream = this.canvas.captureStream(fps);
            
            // Enhanced audio handling
            try {
                const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                if (audioContext.state === 'suspended') {
                    await audioContext.resume();
                }
                
                const source = audioContext.createMediaElementSource(processingVideo);
                const destination = audioContext.createMediaStreamDestination();
                const gainNode = audioContext.createGain();
                
                gainNode.gain.value = 1.0;
                source.connect(gainNode);
                gainNode.connect(destination);
                
                // Add audio tracks ke canvas stream
                destination.stream.getAudioTracks().forEach(track => {
                    canvasStream.addTrack(track);
                });
                
                console.log('Audio tracks added:', canvasStream.getAudioTracks().length);
            } catch (audioError) {
                console.warn('Audio processing failed:', audioError);
            }

            // Determine optimal codec
            let mimeType;
            if (format === 'mp4') {
                // Use best available codec untuk "MP4" output
                if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')) {
                    mimeType = 'video/webm;codecs=vp9,opus';
                } else if (MediaRecorder.isTypeSupported('video/webm;codecs=h264,opus')) {
                    mimeType = 'video/webm;codecs=h264,opus';
                } else {
                    mimeType = 'video/webm;codecs=vp8,opus';
                }
            } else {
                if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')) {
                    mimeType = 'video/webm;codecs=vp9,opus';
                } else {
                    mimeType = 'video/webm;codecs=vp8,opus';
                }
            }

            // Create MediaRecorder dengan high-quality settings
            const mediaRecorder = new MediaRecorder(canvasStream, {
                mimeType: mimeType,
                videoBitsPerSecond: 12000000, // 12 Mbps untuk kualitas tinggi
                audioBitsPerSecond: 320000    // 320 kbps untuk audio berkualitas
            });

            const chunks = [];
            let recordingStartTime = Date.now();

            return new Promise((resolve, reject) => {
                mediaRecorder.ondataavailable = (event) => {
                    if (event.data.size > 0) {
                        chunks.push(event.data);
                    }
                };

                mediaRecorder.onstop = () => {
                    const processingTime = (Date.now() - recordingStartTime) / 1000;
                    console.log('Recording completed in', processingTime.toFixed(2), 'seconds');
                    console.log('Total chunks:', chunks.length);
                    
                    document.body.removeChild(processingVideo);
                    
                    const blob = new Blob(chunks, { type: mimeType });
                    console.log('Final output size:', blob.size, 'bytes');
                    
                    this.isProcessing = false;
                    resolve(blob);
                };

                mediaRecorder.onerror = (error) => {
                    console.error('MediaRecorder error:', error);
                    document.body.removeChild(processingVideo);
                    this.isProcessing = false;
                    reject(error);
                };

                // Enhanced frame processing dengan smooth timing
                let animationId = null;
                let lastProgressTime = 0;
                const progressThrottle = 250; // Update progress setiap 250ms
                
                const processFrames = () => {
                    if (!this.isProcessing || processingVideo.ended || processingVideo.currentTime >= duration) {
                        console.log('Frame processing complete');
                        if (animationId) {
                            cancelAnimationFrame(animationId);
                        }
                        
                        // Final progress update
                        if (onProgress) {
                            onProgress(1.0);
                        }
                        
                        // Stop recording setelah delay singkat
                        setTimeout(() => {
                            mediaRecorder.stop();
                        }, 200);
                        return;
                    }

                    // Process current frame dengan optimizations
                    this.processFrame(processingVideo, targetWidth, targetHeight);
                    
                    // Throttled progress updates
                    const now = Date.now();
                    if (onProgress && (now - lastProgressTime) >= progressThrottle) {
                        const progress = Math.min(processingVideo.currentTime / duration, 0.99);
                        onProgress(progress);
                        lastProgressTime = now;
                    }

                    animationId = requestAnimationFrame(processFrames);
                };

                // Start recording
                mediaRecorder.start(100); // Small chunks untuk better quality
                console.log('Started recording with', mimeType);

                // Start video playback dan processing
                processingVideo.currentTime = 0;
                processingVideo.onended = () => {
                    console.log('Video playback ended');
                    if (animationId) {
                        cancelAnimationFrame(animationId);
                    }
                    setTimeout(() => {
                        mediaRecorder.stop();
                    }, 300);
                };

                processingVideo.play().then(() => {
                    console.log('Video playback started');
                    recordingStartTime = Date.now();
                    
                    if (onProgress) {
                        onProgress(0);
                    }
                    
                    processFrames();
                }).catch((error) => {
                    console.error('Video playback failed:', error);
                    document.body.removeChild(processingVideo);
                    this.isProcessing = false;
                    reject(error);
                });
            });

        } catch (error) {
            this.isProcessing = false;
            console.error('Optimized processing error:', error);
            throw error;
        }
    }

    /**
     * Stop processing
     */
    stopProcessing() {
        this.isProcessing = false;
    }

    /**
     * Check if processing is in progress
     * @returns {boolean} Processing status
     */
    isCurrentlyProcessing() {
        return this.isProcessing;
    }

    /**
     * Get supported formats
     * @returns {Array} Array of supported formats
     */
    getSupportedFormats() {
        const formats = [];
        
        if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')) {
            formats.push({ format: 'webm', codec: 'vp9', quality: 'high' });
        }
        if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')) {
            formats.push({ format: 'webm', codec: 'vp8', quality: 'medium' });
        }
        if (MediaRecorder.isTypeSupported('video/webm;codecs=h264,opus')) {
            formats.push({ format: 'webm', codec: 'h264', quality: 'high' });
        }
        
        return formats;
    }
}

/**
 * Enhanced Video Utils untuk optimizations
 */
class EnhancedVideoUtils {
    /**
     * Get video metadata dengan enhanced info
     * @param {Blob} videoBlob - Video blob
     * @returns {Promise<Object>} Video metadata
     */
    static async getVideoMetadata(videoBlob) {
        return new Promise((resolve) => {
            const video = document.createElement('video');
            video.onloadedmetadata = () => {
                resolve({
                    duration: video.duration,
                    width: video.videoWidth,
                    height: video.videoHeight,
                    size: videoBlob.size,
                    aspectRatio: video.videoWidth / video.videoHeight,
                    estimatedBitrate: (videoBlob.size * 8) / video.duration, // bits per second
                    type: videoBlob.type
                });
            };
            video.src = URL.createObjectURL(videoBlob);
        });
    }

    /**
     * Optimize video quality dengan adaptive bitrate
     * @param {number} duration - Video duration in seconds
     * @param {number} targetSize - Target file size in MB
     * @returns {Object} Optimal settings
     */
    static calculateOptimalSettings(duration, targetSize) {
        const targetSizeBytes = targetSize * 1024 * 1024;
        const targetBitrate = (targetSizeBytes * 8) / duration; // bits per second
        
        // Reserve 20% untuk audio
        const videoBitrate = targetBitrate * 0.8;
        const audioBitrate = Math.min(targetBitrate * 0.2, 320000);
        
        return {
            videoBitrate: Math.max(videoBitrate, 1000000), // Minimum 1 Mbps
            audioBitrate: Math.max(audioBitrate, 128000),   // Minimum 128 kbps
            fps: videoBitrate > 8000000 ? 30 : 25 // Higher FPS untuk high bitrate
        };
    }

    /**
     * Check browser capabilities
     * @returns {Object} Browser capabilities
     */
    static getBrowserCapabilities() {
        return {
            webm: MediaRecorder.isTypeSupported('video/webm'),
            vp8: MediaRecorder.isTypeSupported('video/webm;codecs=vp8'),
            vp9: MediaRecorder.isTypeSupported('video/webm;codecs=vp9'),
            h264: MediaRecorder.isTypeSupported('video/webm;codecs=h264'),
            opus: MediaRecorder.isTypeSupported('audio/webm;codecs=opus'),
            hardwareAcceleration: 'VideoEncoder' in window,
            webAssembly: typeof WebAssembly !== 'undefined'
        };
    }
}

// Export untuk penggunaan global
if (typeof window !== 'undefined') {
    window.EnhancedVideoProcessor = EnhancedVideoProcessor;
    window.EnhancedVideoUtils = EnhancedVideoUtils;
    
    // Maintain backward compatibility
    window.VideoFrameProcessor = EnhancedVideoProcessor;
    window.VideoUtils = EnhancedVideoUtils;
}

// Export untuk ES6 modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { EnhancedVideoProcessor, EnhancedVideoUtils };
}
