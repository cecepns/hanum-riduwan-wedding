/**
 * FFmpeg.js Video Processor - UMD Version for Browser Compatibility
 * Mengatasi masalah lag video dan progress bar yang tidak berfungsi
 * Menggunakan FFmpeg.js untuk processing berkualitas tinggi
 */

(function(global) {
    'use strict';

    class FFmpegVideoProcessor {
        constructor() {
            this.ffmpeg = null;
            this.isLoaded = false;
            this.isProcessing = false;
            this.frameImage = null;
            this.loadingPromise = null;
            this.currentProgressCallback = null;
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
                
                // Check if FFmpeg is available globally
                if (typeof FFmpeg === 'undefined') {
                    throw new Error('FFmpeg not found. Make sure to load @ffmpeg/ffmpeg before this script.');
                }
                
                this.ffmpeg = new FFmpeg.FFmpeg();
                
                // Setup logging for debugging
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
                
                // Load FFmpeg core from CDN with proper URLs
                const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
                const coreURL = await FFmpegUtil.toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript');
                const wasmURL = await FFmpegUtil.toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm');
                
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
                console.log('Starting FFmpeg video processing...');
                
                // Extract video blob from video element
                const videoBlob = await this._extractVideoBlob(videoElement);
                console.log('Video blob extracted:', videoBlob.size, 'bytes');
                
                // Generate unique filenames
                const inputVideo = 'input.mp4';
                const frameImage = 'frame.png';
                const outputVideo = `output.${outputFormat}`;
                
                // Write input files to FFmpeg filesystem
                console.log('Writing input files to FFmpeg filesystem...');
                await this.ffmpeg.writeFile(inputVideo, await FFmpegUtil.fetchFile(videoBlob));
                
                if (this.frameImage) {
                    await this.ffmpeg.writeFile(frameImage, await FFmpegUtil.fetchFile(this.frameImage));
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
                
                console.log('FFmpeg video processing completed successfully:', processedBlob.size, 'bytes');
                
                // Final progress update
                if (onProgress) {
                    onProgress(1.0);
                }
                
                return processedBlob;
                
            } catch (error) {
                console.error('FFmpeg video processing failed:', error);
                throw error;
            } finally {
                this.isProcessing = false;
                this.currentProgressCallback = null;
            }
        }
        
        /**
         * Extract video blob from video element - FIXED VERSION
         * @param {HTMLVideoElement} videoElement - Video element
         * @returns {Promise<Blob>} Video blob
         */
        async _extractVideoBlob(videoElement) {
            // PRIORITY: Use original blob if available - this preserves audio perfectly
            if (videoElement.src && videoElement.src.startsWith('blob:')) {
                console.log('Using original video blob - preserves audio and full duration');
                const response = await fetch(videoElement.src);
                return await response.blob();
            }
            
            // Fallback: capture from video element (should rarely be needed)
            console.log('Fallback: capturing from video element');
            return new Promise((resolve, reject) => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                // Set canvas to video dimensions
                canvas.width = videoElement.videoWidth || 1280;
                canvas.height = videoElement.videoHeight || 720;
                
                // Create video stream for recording
                const stream = canvas.captureStream(30);
                
                // CRITICAL: Preserve audio by NOT muting the processing video
                const processingVideo = document.createElement('video');
                processingVideo.src = videoElement.src;
                processingVideo.muted = false; // KEEP AUDIO ENABLED
                processingVideo.volume = 0; // Silent playback but keep audio track
                processingVideo.style.display = 'none';
                processingVideo.crossOrigin = 'anonymous';
                document.body.appendChild(processingVideo);
                
                // Wait for video to load completely
                processingVideo.addEventListener('loadeddata', async () => {
                    try {
                        // Add audio track from processing video
                        if (processingVideo.captureStream) {
                            const videoStream = processingVideo.captureStream();
                            const audioTracks = videoStream.getAudioTracks();
                            console.log('Found audio tracks:', audioTracks.length);
                            audioTracks.forEach(track => {
                                stream.addTrack(track);
                                console.log('Added audio track:', track.label, 'enabled:', track.enabled);
                            });
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
                            console.log('Captured video blob:', blob.size, 'bytes with audio tracks');
                            
                            // Cleanup
                            if (document.body.contains(processingVideo)) {
                                document.body.removeChild(processingVideo);
                            }
                            resolve(blob);
                        };
                        
                        recorder.onerror = (error) => {
                            console.error('Recorder error:', error);
                            if (document.body.contains(processingVideo)) {
                                document.body.removeChild(processingVideo);
                            }
                            reject(error);
                        };
                        
                        // Start recording
                        recorder.start(100);
                        
                        const duration = processingVideo.duration;
                        let frameCount = 0;
                        
                        const drawFrame = () => {
                            if (processingVideo.ended || processingVideo.currentTime >= duration) {
                                console.log('Video processing complete - frames:', frameCount, 'duration:', processingVideo.currentTime);
                                setTimeout(() => recorder.stop(), 200);
                                return;
                            }
                            
                            ctx.drawImage(processingVideo, 0, 0, canvas.width, canvas.height);
                            frameCount++;
                            requestAnimationFrame(drawFrame);
                        };
                        
                        // Start playback and recording
                        processingVideo.currentTime = 0;
                        await processingVideo.play();
                        drawFrame();
                        
                        processingVideo.onended = () => {
                            console.log('Video ended naturally at:', processingVideo.currentTime, '/', duration);
                            setTimeout(() => recorder.stop(), 200);
                        };
                        
                    } catch (error) {
                        console.error('Video processing error:', error);
                        if (document.body.contains(processingVideo)) {
                            document.body.removeChild(processingVideo);
                        }
                        reject(error);
                    }
                });
                
                processingVideo.addEventListener('error', (error) => {
                    console.error('Video loading error:', error);
                    if (document.body.contains(processingVideo)) {
                        document.body.removeChild(processingVideo);
                    }
                    reject(error);
                });
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
                
                // Optimized complex filter for video scaling and frame overlay
                const filterComplex = [
                    `[0:v]scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=increase`,
                    `crop=${targetWidth}:${targetHeight}[scaled]`,
                    `[1:v]scale=${targetWidth}:${targetHeight}[frame]`,
                    `[scaled][frame]overlay=0:0:format=auto[final]`
                ].join(',');
                
                args.push('-filter_complex', filterComplex);
                args.push('-map', '[final]');
                args.push('-map', '0:a?'); // Include audio if present
            } else {
                // Just scale video without frame
                args.push('-vf', `scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=increase,crop=${targetWidth}:${targetHeight}`);
            }
            
            // Optimized encoding settings for better performance
            if (format === 'mp4') {
                args.push(
                    '-c:v', 'libx264',
                    '-preset', 'fast', // Changed from 'medium' to 'fast' for better performance
                    '-crf', '20', // Slightly reduced quality for faster processing
                    '-maxrate', '8M', // Add max bitrate to prevent huge files
                    '-bufsize', '16M', // Buffer size for rate control
                    '-c:a', 'aac',
                    '-b:a', '256k', // Reduced audio bitrate
                    '-movflags', '+faststart',
                    '-threads', '0' // Use all available CPU threads
                );
            } else {
                args.push(
                    '-c:v', 'libvpx-vp9',
                    '-crf', '32', // Slightly reduced quality for faster processing
                    '-b:v', '0',
                    '-cpu-used', '4', // Faster VP9 encoding
                    '-row-mt', '1', // Enable row multithreading
                    '-c:a', 'libopus',
                    '-b:a', '256k',
                    '-threads', '0'
                );
            }
            
            // Additional optimizations for longer videos
            args.push(
                '-avoid_negative_ts', 'make_zero', // Avoid timestamp issues
                '-fflags', '+genpts', // Generate presentation timestamps
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
            if (this.isLoaded && this.ffmpeg) {
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
                console.log('Using SIMPLE fallback MediaRecorder processing with WebM format');
                
                // Create processing video element that preserves audio
                const processingVideo = document.createElement('video');
                processingVideo.src = videoElement.src;
                processingVideo.muted = false; // Keep audio enabled
                processingVideo.volume = 0; // Silent playback but preserve audio track
                processingVideo.style.display = 'none';
                processingVideo.crossOrigin = 'anonymous';
                processingVideo.playsInline = true;
                document.body.appendChild(processingVideo);
                
                // Wait for video to load completely
                await new Promise((resolve, reject) => {
                    processingVideo.onloadeddata = resolve;
                    processingVideo.onerror = reject;
                    processingVideo.load(); // Ensure loading
                });
                
                console.log('Simple fallback - Video loaded. Duration:', processingVideo.duration, 'seconds');
                
                // Create canvas for frame processing
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = 1080;
                canvas.height = 1920;
                
                // Setup high-quality rendering
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                
                // Create canvas stream
                const canvasStream = canvas.captureStream(30);
                
                // SIMPLE AUDIO HANDLING: Use captureStream from video element
                let combinedStream = canvasStream;
                try {
                    // Try to get audio stream from the processing video
                    if (processingVideo.captureStream) {
                        const videoStream = processingVideo.captureStream();
                        const audioTracks = videoStream.getAudioTracks();
                        console.log('Simple fallback: Found', audioTracks.length, 'audio tracks');
                        
                        // Add each audio track to the canvas stream
                        audioTracks.forEach((track, index) => {
                            canvasStream.addTrack(track);
                            console.log(`Simple fallback: Added audio track ${index}:`, track.label, 'enabled:', track.enabled);
                        });
                        
                        combinedStream = canvasStream;
                    }
                } catch (audioError) {
                    console.warn('Simple fallback: Audio capture failed, proceeding without audio:', audioError);
                }
                
                console.log('Simple fallback: Final stream has', combinedStream.getAudioTracks().length, 'audio tracks');
                
                // Use stable WebM codecs for reliable results
                let recorderOptions = {};
                
                // Priority order: VP9 > VP8 > H264 (all in WebM container)
                if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')) {
                    recorderOptions.mimeType = 'video/webm;codecs=vp9,opus';
                    console.log('Using VP9/Opus codec for best WebM quality');
                } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')) {
                    recorderOptions.mimeType = 'video/webm;codecs=vp8,opus';
                    console.log('Using VP8/Opus codec for WebM compatibility');
                } else if (MediaRecorder.isTypeSupported('video/webm;codecs=h264,opus')) {
                    recorderOptions.mimeType = 'video/webm;codecs=h264,opus';
                    console.log('Using H264/Opus codec in WebM container');
                } else {
                    recorderOptions.mimeType = 'video/webm';
                    console.log('Using basic WebM codec');
                }
                
                // Optimized bitrates for WebM
                recorderOptions.videoBitsPerSecond = 5000000; // 5Mbps for good quality
                recorderOptions.audioBitsPerSecond = 192000;  // 192kbps for good audio
                
                const recorder = new MediaRecorder(combinedStream, recorderOptions);
                console.log('Simple fallback: MediaRecorder initialized with:', recorderOptions.mimeType);
                
                const chunks = [];
                recorder.ondataavailable = (e) => {
                    if (e.data.size > 0) {
                        chunks.push(e.data);
                        console.log('Simple fallback: Chunk received:', e.data.size, 'bytes');
                    }
                };
                
                return new Promise((resolve, reject) => {
                    recorder.onstop = () => {
                        console.log('Simple fallback: Recording stopped, total chunks:', chunks.length);
                        
                        // Clean up processing video
                        if (document.body.contains(processingVideo)) {
                            document.body.removeChild(processingVideo);
                        }
                        
                        // Create WebM blob with proper MIME type
                        const blob = new Blob(chunks, { type: recorderOptions.mimeType || 'video/webm' });
                        console.log('Simple fallback: Created WebM blob:', blob.type, blob.size, 'bytes with', combinedStream.getAudioTracks().length, 'audio tracks');
                        resolve(blob);
                    };
                    
                    recorder.onerror = (error) => {
                        console.error('Simple fallback: Recorder error:', error);
                        // Clean up on error
                        if (document.body.contains(processingVideo)) {
                            document.body.removeChild(processingVideo);
                        }
                        reject(error);
                    };
                    
                    // Start recording with reasonable chunk size
                    recorder.start(200); // 200ms chunks for stability
                    console.log('Simple fallback: Started recording');
                    
                    const duration = processingVideo.duration;
                    let frameCount = 0;
                    let startTime = Date.now();
                    
                    console.log('Simple fallback: Starting synchronized playback and recording for', duration, 'seconds');
                    
                    // SYNCHRONIZED processing - play video and capture frames in real-time
                    const processFrames = () => {
                        // Check if video has ended
                        if (processingVideo.ended || processingVideo.currentTime >= duration) {
                            console.log('Simple fallback: Video complete at', processingVideo.currentTime.toFixed(2), '/', duration.toFixed(2), 'seconds, frames:', frameCount);
                            if (onProgress) onProgress(1.0);
                            
                            // Stop recording with delay to ensure all frames are captured
                            setTimeout(() => {
                                recorder.stop();
                            }, 500);
                            return;
                        }
                        
                        // Clear canvas with black background
                        ctx.fillStyle = '#000000';
                        ctx.fillRect(0, 0, 1080, 1920);
                        
                        // Calculate proper scaling for video frame
                        const videoWidth = processingVideo.videoWidth || 1280;
                        const videoHeight = processingVideo.videoHeight || 720;
                        const videoAspect = videoWidth / videoHeight;
                        const targetAspect = 1080 / 1920; // 0.5625
                        
                        let drawWidth, drawHeight, offsetX, offsetY;
                        
                        // Always FILL the canvas (crop if needed) - same logic as photo capture
                        if (videoAspect > targetAspect) {
                            // Video is wider than target, fit to height (crop sides)
                            drawHeight = 1920;
                            drawWidth = 1920 * videoAspect;
                            offsetX = (1080 - drawWidth) / 2;
                            offsetY = 0;
                        } else {
                            // Video is taller than target, fit to width (crop top/bottom)
                            drawWidth = 1080;
                            drawHeight = 1080 / videoAspect;
                            offsetX = 0;
                            offsetY = (1920 - drawHeight) / 2;
                        }
                        
                        // Draw video frame with high quality
                        ctx.save();
                        ctx.imageSmoothingEnabled = true;
                        ctx.imageSmoothingQuality = 'high';
                        ctx.drawImage(processingVideo, offsetX, offsetY, drawWidth, drawHeight);
                        ctx.restore();
                        
                        // Draw frame overlay if available
                        if (this.frameImage) {
                            ctx.drawImage(this.frameImage, 0, 0, 1080, 1920);
                        }
                        
                        // Update progress based on video time
                        if (onProgress && frameCount % 10 === 0) { // Update every 10 frames
                            const progress = Math.min(processingVideo.currentTime / duration, 0.99);
                            onProgress(progress);
                        }
                        
                        frameCount++;
                        
                        // Continue processing at 30fps
                        requestAnimationFrame(processFrames);
                    };
                    
                    // Start video playback and synchronized frame processing
                    processingVideo.currentTime = 0;
                    processingVideo.play().then(() => {
                        console.log('Simple fallback: Video playback started, beginning synchronized frame processing...');
                        startTime = Date.now();
                        
                        // Initial progress
                        if (onProgress) onProgress(0);
                        
                        // Start frame processing loop
                        processFrames();
                    }).catch((error) => {
                        console.error('Simple fallback: Video playback failed:', error);
                        reject(error);
                    });
                    
                    // Handle natural video ending
                    processingVideo.addEventListener('ended', () => {
                        const processingTime = (Date.now() - startTime) / 1000;
                        console.log('Simple fallback: Video ended naturally after', processingTime.toFixed(2), 'seconds, frames processed:', frameCount);
                        
                        // Final progress
                        if (onProgress) onProgress(1.0);
                        
                        // Stop recording after a short delay
                        setTimeout(() => {
                            recorder.stop();
                        }, 500);
                    });
                });
                
            } finally {
                this.isProcessing = false;
            }
        }
    }

    /**
     * Main Video Processor with auto-fallback and MP4 priority
     */
    class VideoProcessor {
        constructor() {
            this.ffmpegProcessor = new FFmpegVideoProcessor();
            this.fallbackProcessor = new FallbackVideoProcessor();
            this.useFFmpeg = true;
            this.preferMP4 = true; // Always prefer MP4 output
        }
        
        async initialize() {
            const ffmpegReady = await this.ffmpegProcessor.initialize();
            if (!ffmpegReady) {
                console.warn('FFmpeg not available, using fallback processor (WebM output only)');
                this.useFFmpeg = false;
            }
            console.log('Video processor initialized, using:', this.useFFmpeg ? 'FFmpeg.js (MP4 capable)' : 'Fallback MediaRecorder (WebM only)');
            return true;
        }
        
        async loadFrame(frameUrl) {
            await Promise.all([
                this.ffmpegProcessor.loadFrame(frameUrl),
                this.fallbackProcessor.loadFrame(frameUrl)
            ]);
        }
        
        async processVideo(videoElement, onProgress = null, outputFormat = 'mp4') {
            // Always try to use FFmpeg first for MP4 output
            if (outputFormat === 'mp4' && this.useFFmpeg && this.ffmpegProcessor.isReady()) {
                try {
                    console.log('Using FFmpeg.js for MP4 high-quality processing');
                    return await this.ffmpegProcessor.processVideo(videoElement, onProgress, 'mp4');
                } catch (error) {
                    console.warn('FFmpeg MP4 processing failed, falling back to MediaRecorder WebM:', error);
                    // Don't disable FFmpeg completely, just for this attempt
                }
            }
            
            // If FFmpeg is available but output format is not MP4, still try FFmpeg
            if (this.useFFmpeg && this.ffmpegProcessor.isReady()) {
                try {
                    console.log('Using FFmpeg.js for', outputFormat, 'processing');
                    return await this.ffmpegProcessor.processVideo(videoElement, onProgress, outputFormat);
                } catch (error) {
                    console.warn('FFmpeg processing failed, falling back to MediaRecorder:', error);
                }
            }
            
            // Fallback to MediaRecorder with format preference
            console.log('Using fallback MediaRecorder processing with format:', outputFormat);
            const result = await this.fallbackProcessor.processVideo(videoElement, onProgress, outputFormat);
            
            // Log what format we actually got
            console.log('Fallback processor result type:', result.type);
            if (outputFormat === 'mp4' && !result.type.includes('mp4')) {
                console.warn('MP4 requested but fallback provided:', result.type, '- File will still be saved as .mp4');
            }
            
            return result;
        }
        
        isProcessing() {
            return this.ffmpegProcessor.isCurrentlyProcessing() || this.fallbackProcessor.isProcessing;
        }
        
        /**
         * Check if MP4 output is supported
         * @returns {boolean} True if MP4 output is available
         */
        supportsMP4() {
            return this.useFFmpeg && this.ffmpegProcessor.isReady();
        }
        
        /**
         * Get recommended output format based on capabilities
         * @returns {string} Recommended format
         */
        getRecommendedFormat() {
            return this.supportsMP4() ? 'mp4' : 'webm';
        }
    }

    // Export to global scope
    global.VideoProcessor = VideoProcessor;
    global.FFmpegVideoProcessor = FFmpegVideoProcessor;
    global.FallbackVideoProcessor = FallbackVideoProcessor;

})(typeof window !== 'undefined' ? window : this);

