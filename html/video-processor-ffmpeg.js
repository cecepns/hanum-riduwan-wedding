/**
 * FFmpeg.js Video Processor - Professional Quality Video Processing
 * Mengatasi masalah lag video dan progress bar yang tidak berfungsi
 * Menggunakan FFmpeg.js untuk processing berkualitas tinggi
 */

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

class FFmpegVideoProcessor {
    constructor() {
        this.ffmpeg = new FFmpeg();
        this.isLoaded = false;
        this.isProcessing = false;
        this.frameImage = null;
        this.loadingPromise = null;
        
        // Setup FFmpeg logging for debugging
        this.ffmpeg.on('log', ({ message }) => {
            console.log('[FFmpeg]:', message);
        });
        
        // Setup progress tracking
        this.ffmpeg.on('progress', ({ progress, time }) => {
            console.log(`[FFmpeg Progress]: ${Math.round(progress * 100)}% (time: ${time}s)`);
            if (this.currentProgressCallback) {
                this.currentProgressCallback(progress);
            }
        });
    }
    
    /**
     * Initialize FFmpeg with proper core loading
     * @returns {Promise<boolean>} Success status
     */
    async initialize() {
        if (this.isLoaded) return true;
        
        // Prevent multiple initialization
        if (this.loadingPromise) {
            return await this.loadingPromise;
        }
        
        this.loadingPromise = this._loadFFmpeg();
        return await this.loadingPromise;
    }
    
    async _loadFFmpeg() {
        try {
            console.log('Loading FFmpeg.js...');
            
            // Load FFmpeg core from CDN with proper URLs
            const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
            const coreURL = await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript');
            const wasmURL = await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm');
            
            await this.ffmpeg.load({
                coreURL,
                wasmURL,
            });
            
            this.isLoaded = true;
            console.log('FFmpeg.js loaded successfully');
            return true;
            
        } catch (error) {
            console.error('Failed to load FFmpeg.js:', error);
            this.isLoaded = false;
            return false;
        }
    }
    
    /**
     * Load frame image for overlay
     * @param {string} frameUrl - URL to frame image
     * @returns {Promise<void>}
     */
    async loadFrame(frameUrl) {
        try {
            const response = await fetch(frameUrl);
            if (!response.ok) throw new Error('Failed to fetch frame image');
            
            this.frameImage = await response.blob();
            console.log('Frame image loaded successfully');
        } catch (error) {
            console.error('Failed to load frame image:', error);
            throw error;
        }
    }
    
    /**
     * Process video with frame overlay - MAIN PROCESSING FUNCTION
     * @param {HTMLVideoElement} videoElement - Video element to process
     * @param {Function} onProgress - Progress callback function
     * @param {string} outputFormat - Output format (mp4 or webm)
     * @returns {Promise<Blob>} Processed video blob
     */
    async processVideo(videoElement, onProgress = null, outputFormat = 'mp4') {
        if (!await this.initialize()) {
            throw new Error('FFmpeg initialization failed');
        }
        
        if (this.isProcessing) {
            throw new Error('Another video is currently being processed');
        }
        
        this.isProcessing = true;
        this.currentProgressCallback = onProgress;
        
        try {
            console.log('Starting video processing...');
            
            // Extract video blob from video element
            const videoBlob = await this._extractVideoBlob(videoElement);
            console.log('Video blob extracted:', videoBlob.size, 'bytes');
            
            // Generate unique filenames
            const inputVideo = 'input.mp4';
            const frameImage = 'frame.png';
            const outputVideo = `output.${outputFormat}`;
            
            // Write input files to FFmpeg filesystem
            console.log('Writing input files to FFmpeg filesystem...');
            await this.ffmpeg.writeFile(inputVideo, await fetchFile(videoBlob));
            
            if (this.frameImage) {
                await this.ffmpeg.writeFile(frameImage, await fetchFile(this.frameImage));
            }
            
            // Build FFmpeg command for high-quality processing
            const ffmpegArgs = this._buildFFmpegCommand(inputVideo, frameImage, outputVideo, outputFormat);
            console.log('FFmpeg command:', ffmpegArgs.join(' '));
            
            // Execute FFmpeg processing
            console.log('Executing FFmpeg processing...');
            await this.ffmpeg.exec(ffmpegArgs);
            
            // Read processed video
            console.log('Reading processed video...');
            const outputData = await this.ffmpeg.readFile(outputVideo);
            
            // Create blob with correct MIME type
            const mimeType = outputFormat === 'mp4' ? 'video/mp4' : 'video/webm';
            const processedBlob = new Blob([outputData], { type: mimeType });
            
            console.log('Video processing completed successfully:', processedBlob.size, 'bytes');
            
            // Final progress update
            if (onProgress) {
                onProgress(1.0);
            }
            
            return processedBlob;
            
        } catch (error) {
            console.error('Video processing failed:', error);
            throw error;
        } finally {
            this.isProcessing = false;
            this.currentProgressCallback = null;
        }
    }
    
    /**
     * Extract video blob from video element
     * @param {HTMLVideoElement} videoElement - Video element
     * @returns {Promise<Blob>} Video blob
     */
    async _extractVideoBlob(videoElement) {
        // Check if video has a blob URL source
        if (videoElement.src && videoElement.src.startsWith('blob:')) {
            const response = await fetch(videoElement.src);
            return await response.blob();
        }
        
        // For cases where we need to capture from the video element
        return new Promise((resolve, reject) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // Set canvas to video dimensions
            canvas.width = videoElement.videoWidth || 1280;
            canvas.height = videoElement.videoHeight || 720;
            
            // Create video stream for recording
            const stream = canvas.captureStream(30);
            
            // Add audio track if available
            if (videoElement.captureStream) {
                const videoStream = videoElement.captureStream();
                const audioTracks = videoStream.getAudioTracks();
                audioTracks.forEach(track => stream.addTrack(track));
            }
            
            const recorder = new MediaRecorder(stream, {
                mimeType: 'video/webm;codecs=vp9,opus',
                videoBitsPerSecond: 8000000,
                audioBitsPerSecond: 320000
            });
            
            const chunks = [];
            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunks.push(e.data);
                }
            };
            
            recorder.onstop = () => {
                const blob = new Blob(chunks, { type: 'video/webm' });
                resolve(blob);
            };
            
            recorder.onerror = reject;
            
            // Record the video
            recorder.start();
            
            const drawFrame = () => {
                if (videoElement.ended || videoElement.paused) {
                    recorder.stop();
                    return;
                }
                
                ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
                requestAnimationFrame(drawFrame);
            };
            
            videoElement.currentTime = 0;
            videoElement.play().then(() => {
                drawFrame();
            });
            
            videoElement.onended = () => {
                setTimeout(() => recorder.stop(), 100);
            };
        });
    }
    
    /**
     * Build FFmpeg command for video processing
     * @param {string} inputVideo - Input video filename
     * @param {string} frameImage - Frame image filename
     * @param {string} outputVideo - Output video filename
     * @param {string} format - Output format
     * @returns {Array<string>} FFmpeg command arguments
     */
    _buildFFmpegCommand(inputVideo, frameImage, outputVideo, format) {
        const targetWidth = 1080;
        const targetHeight = 1920;
        
        let args = ['-i', inputVideo];
        
        if (this.frameImage) {
            args.push('-i', frameImage);
            
            // Complex filter for video scaling and frame overlay
            const filterComplex = [
                `[0:v]scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=increase`,
                `crop=${targetWidth}:${targetHeight}[scaled]`,
                `[1:v]scale=${targetWidth}:${targetHeight}[frame]`,
                `[scaled][frame]overlay=0:0[final]`
            ].join(',');
            
            args.push('-filter_complex', filterComplex);
            args.push('-map', '[final]');
            args.push('-map', '0:a?'); // Include audio if present
        } else {
            // Just scale video without frame
            args.push('-vf', `scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=increase,crop=${targetWidth}:${targetHeight}`);
        }
        
        // High-quality encoding settings
        if (format === 'mp4') {
            args.push(
                '-c:v', 'libx264',
                '-preset', 'medium',
                '-crf', '18',
                '-c:a', 'aac',
                '-b:a', '320k',
                '-movflags', '+faststart'
            );
        } else {
            args.push(
                '-c:v', 'libvpx-vp9',
                '-crf', '30',
                '-b:v', '0',
                '-c:a', 'libopus',
                '-b:a', '320k'
            );
        }
        
        args.push(
            '-f', format === 'mp4' ? 'mp4' : 'webm',
            '-y', // Overwrite output file
            outputVideo
        );
        
        return args;
    }
    
    /**
     * Check if FFmpeg is ready
     * @returns {boolean} Ready status
     */
    isReady() {
        return this.isLoaded;
    }
    
    /**
     * Check if currently processing
     * @returns {boolean} Processing status
     */
    isCurrentlyProcessing() {
        return this.isProcessing;
    }
    
    /**
     * Terminate FFmpeg (cleanup)
     */
    terminate() {
        if (this.isLoaded) {
            this.ffmpeg.terminate();
            this.isLoaded = false;
        }
    }
}

/**
 * Fallback MediaRecorder processor for compatibility
 */
class FallbackVideoProcessor {
    constructor() {
        this.frameImage = null;
        this.isProcessing = false;
    }
    
    async loadFrame(frameUrl) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        return new Promise((resolve, reject) => {
            img.onload = () => {
                this.frameImage = img;
                resolve();
            };
            img.onerror = reject;
            img.src = frameUrl;
        });
    }
    
    async processVideo(videoElement, onProgress = null, outputFormat = 'webm') {
        if (this.isProcessing) {
            throw new Error('Another video is being processed');
        }
        
        this.isProcessing = true;
        
        try {
            console.log('Using fallback MediaRecorder processing...');
            
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            canvas.width = 1080;
            canvas.height = 1920;
            
            // Setup high-quality rendering
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            
            const stream = canvas.captureStream(30);
            
            // Add audio from video
            if (videoElement.captureStream) {
                const videoStream = videoElement.captureStream();
                videoStream.getAudioTracks().forEach(track => {
                    stream.addTrack(track);
                });
            }
            
            const recorder = new MediaRecorder(stream, {
                mimeType: `video/${outputFormat};codecs=${outputFormat === 'mp4' ? 'h264,opus' : 'vp9,opus'}`,
                videoBitsPerSecond: 8000000,
                audioBitsPerSecond: 320000
            });
            
            const chunks = [];
            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunks.push(e.data);
            };
            
            return new Promise((resolve, reject) => {
                recorder.onstop = () => {
                    const blob = new Blob(chunks, { type: `video/${outputFormat}` });
                    resolve(blob);
                };
                
                recorder.onerror = reject;
                recorder.start();
                
                const duration = videoElement.duration;
                let lastTime = 0;
                
                const processFrame = () => {
                    if (videoElement.ended || videoElement.currentTime >= duration) {
                        if (onProgress) onProgress(1.0);
                        setTimeout(() => recorder.stop(), 200);
                        return;
                    }
                    
                    // Clear canvas
                    ctx.fillStyle = '#000000';
                    ctx.fillRect(0, 0, 1080, 1920);
                    
                    // Draw video frame
                    const videoWidth = videoElement.videoWidth;
                    const videoHeight = videoElement.videoHeight;
                    const videoAspect = videoWidth / videoHeight;
                    const targetAspect = 1080 / 1920;
                    
                    let drawWidth, drawHeight, offsetX, offsetY;
                    
                    if (videoAspect > targetAspect) {
                        drawHeight = 1920;
                        drawWidth = 1920 * videoAspect;
                        offsetX = (1080 - drawWidth) / 2;
                        offsetY = 0;
                    } else {
                        drawWidth = 1080;
                        drawHeight = 1080 / videoAspect;
                        offsetX = 0;
                        offsetY = (1920 - drawHeight) / 2;
                    }
                    
                    ctx.drawImage(videoElement, offsetX, offsetY, drawWidth, drawHeight);
                    
                    // Draw frame overlay
                    if (this.frameImage) {
                        ctx.drawImage(this.frameImage, 0, 0, 1080, 1920);
                    }
                    
                    // Update progress
                    if (onProgress && videoElement.currentTime - lastTime > 0.5) {
                        onProgress(videoElement.currentTime / duration);
                        lastTime = videoElement.currentTime;
                    }
                    
                    requestAnimationFrame(processFrame);
                };
                
                videoElement.currentTime = 0;
                videoElement.play().then(() => {
                    processFrame();
                });
            });
            
        } finally {
            this.isProcessing = false;
        }
    }
}

/**
 * Main Video Processor with auto-fallback
 */
class VideoProcessor {
    constructor() {
        this.ffmpegProcessor = new FFmpegVideoProcessor();
        this.fallbackProcessor = new FallbackVideoProcessor();
        this.useFFmpeg = true;
    }
    
    async initialize() {
        const ffmpegReady = await this.ffmpegProcessor.initialize();
        if (!ffmpegReady) {
            console.warn('FFmpeg not available, using fallback processor');
            this.useFFmpeg = false;
        }
        return true;
    }
    
    async loadFrame(frameUrl) {
        await Promise.all([
            this.ffmpegProcessor.loadFrame(frameUrl),
            this.fallbackProcessor.loadFrame(frameUrl)
        ]);
    }
    
    async processVideo(videoElement, onProgress = null, outputFormat = 'mp4') {
        if (this.useFFmpeg && this.ffmpegProcessor.isReady()) {
            try {
                return await this.ffmpegProcessor.processVideo(videoElement, onProgress, outputFormat);
            } catch (error) {
                console.warn('FFmpeg processing failed, falling back to MediaRecorder:', error);
                this.useFFmpeg = false;
            }
        }
        
        return await this.fallbackProcessor.processVideo(videoElement, onProgress, 'webm');
    }
    
    isProcessing() {
        return this.ffmpegProcessor.isCurrentlyProcessing() || this.fallbackProcessor.isProcessing;
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { VideoProcessor, FFmpegVideoProcessor, FallbackVideoProcessor };
}

// Export for browser
if (typeof window !== 'undefined') {
    window.VideoProcessor = VideoProcessor;
    window.FFmpegVideoProcessor = FFmpegVideoProcessor;
    window.FallbackVideoProcessor = FallbackVideoProcessor;
}
