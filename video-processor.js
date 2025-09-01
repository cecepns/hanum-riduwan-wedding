/**
 * Video Processor dengan Bingkai Overlay
 * Library untuk menambahkan bingkai pada video menggunakan Canvas API
 */

class VideoFrameProcessor {
    constructor() {
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.frameImage = null;
        this.isProcessing = false;
    }

    /**
     * Load bingkai image
     * @param {string} framePath - Path ke file bingkai
     * @returns {Promise} Promise yang resolve ketika bingkai loaded
     */
    loadFrame(framePath) {
        return new Promise((resolve, reject) => {
            this.frameImage = new Image();
            this.frameImage.onload = () => resolve();
            this.frameImage.onerror = () => reject(new Error('Gagal load bingkai'));
            this.frameImage.src = framePath;
        });
    }

    /**
     * Proses frame video dengan bingkai
     * @param {HTMLVideoElement} video - Video element
     * @param {number} width - Lebar output
     * @param {number} height - Tinggi output
     * @returns {HTMLCanvasElement} Canvas dengan frame yang sudah diproses
     */
    processFrame(video, width, height) {
        // Set canvas size to reels format (1080x1920 - portrait)
        const targetWidth = 1080;
        const targetHeight = 1920;
        
        this.canvas.width = targetWidth;
        this.canvas.height = targetHeight;

        // Calculate scaling to fit video content within reels format
        const videoWidth = video.videoWidth;
        const videoHeight = video.videoHeight;
        
        // Calculate aspect ratios - for portrait reels, we want to FILL the canvas
        const videoAspect = videoWidth / videoHeight;
        const targetAspect = targetWidth / targetHeight; // 1080/1920 = 0.5625
        
        let drawWidth, drawHeight, offsetX, offsetY;
        
        // Always FILL the canvas (crop if needed) - this ensures no black bars
        if (videoAspect > targetAspect) {
            // Video is wider than target, fit to height (crop sides)
            drawHeight = targetHeight;
            drawWidth = targetHeight * videoAspect;
            offsetX = (targetWidth - drawWidth) / 2; // Center horizontally
            offsetY = 0;
        } else {
            // Video is taller than target, fit to width (crop top/bottom)
            drawWidth = targetWidth;
            drawHeight = targetWidth / videoAspect;
            offsetX = 0;
            offsetY = (targetHeight - drawHeight) / 2; // Center vertically
        }

        // Fill canvas with black background first
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(0, 0, targetWidth, targetHeight);

        // Draw video frame to canvas with proper scaling
        this.ctx.drawImage(video, offsetX, offsetY, drawWidth, drawHeight);

        // Draw frame overlay if available
        if (this.frameImage) {
            this.ctx.drawImage(this.frameImage, 0, 0, targetWidth, targetHeight);
        }

        return this.canvas;
    }

    /**
     * Proses video dengan bingkai dan export sebagai video
     * @param {HTMLVideoElement} video - Video element
     * @param {Function} onProgress - Callback untuk progress
     * @param {string} format - Output format ('webm' atau 'mp4')
     * @returns {Promise<Blob>} Promise yang resolve dengan video blob
     */
    async processVideo(video, onProgress = null, format = 'mp4') {
        if (this.isProcessing) {
            throw new Error('Video sedang diproses');
        }

        this.isProcessing = true;

        try {
            const targetWidth = 1080;
            const targetHeight = 1920;
            const duration = video.duration;
            const fps = 30; // Standard FPS
            
            // Setup canvas for processing
            this.canvas.width = targetWidth;
            this.canvas.height = targetHeight;

            // Create separate video and audio elements for proper handling
            const videoElement = document.createElement('video');
            videoElement.src = video.src;
            videoElement.crossOrigin = 'anonymous';
            videoElement.muted = false; // Keep audio enabled
            videoElement.playsInline = true;
            videoElement.volume = 1.0;

            // Wait for video to be ready
            await new Promise((resolve, reject) => {
                videoElement.onloadeddata = resolve;
                videoElement.onerror = reject;
                videoElement.load();
            });

            // Create canvas stream with higher quality settings
            const canvasStream = this.canvas.captureStream(fps);
            
            // Handle audio properly by creating audio context and routing
            let audioStream = null;
            try {
                if (!videoElement.muted && videoElement.src) {
                    // Create audio context for audio processing
                    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                    
                    // Resume context if suspended (required for autoplay policies)
                    if (audioContext.state === 'suspended') {
                        await audioContext.resume();
                    }
                    
                    const source = audioContext.createMediaElementSource(videoElement);
                    const destination = audioContext.createMediaStreamDestination();
                    
                    // Create gain node for volume control
                    const gainNode = audioContext.createGain();
                    gainNode.gain.value = 1.0;
                    
                    // Connect audio pipeline: source -> gain -> destination
                    source.connect(gainNode);
                    gainNode.connect(destination);
                    
                    // Also connect to default output so we can hear during processing
                    gainNode.connect(audioContext.destination);
                    
                    audioStream = destination.stream;
                    
                    // Add audio tracks to canvas stream
                    audioStream.getAudioTracks().forEach(track => {
                        canvasStream.addTrack(track);
                        console.log('Added audio track:', track.label, track.enabled);
                    });
                }
            } catch (audioError) {
                console.warn('Audio processing failed, proceeding without audio:', audioError);
            }

            // Determine best codec for the format
            let mimeType;
            let codecOptions = {};
            
            // Note: MediaRecorder doesn't produce true MP4 files compatible with all players
            // We'll always use WebM but can create different quality profiles
            if (format === 'mp4') {
                // Use highest quality WebM codec for "MP4" requests
                if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')) {
                    mimeType = 'video/webm;codecs=vp9,opus';
                } else if (MediaRecorder.isTypeSupported('video/webm;codecs=h264,opus')) {
                    mimeType = 'video/webm;codecs=h264,opus';
                } else {
                    mimeType = 'video/webm;codecs=vp8,opus';
                }
            } else {
                // Standard WebM
                if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')) {
                    mimeType = 'video/webm;codecs=vp9,opus';
                } else if (MediaRecorder.isTypeSupported('video/webm;codecs=h264,opus')) {
                    mimeType = 'video/webm;codecs=h264,opus';
                } else {
                    mimeType = 'video/webm';
                }
            }

            codecOptions = {
                mimeType: mimeType,
                videoBitsPerSecond: 8000000, // 8 Mbps for higher quality
                audioBitsPerSecond: 256000   // 256 kbps for high quality audio
            };

            console.log('Using codec:', mimeType);
            console.log('Audio tracks in stream:', canvasStream.getAudioTracks().length);

            const mediaRecorder = new MediaRecorder(canvasStream, codecOptions);
            const chunks = [];
            
            return new Promise((resolve, reject) => {
                mediaRecorder.ondataavailable = (event) => {
                    if (event.data.size > 0) {
                        chunks.push(event.data);
                        console.log('Chunk received:', event.data.size, 'bytes');
                    }
                };

                mediaRecorder.onstop = () => {
                    console.log('Recording stopped, total chunks:', chunks.length);
                    // Always create WebM blob since MediaRecorder doesn't produce true MP4
                    const blob = new Blob(chunks, { 
                        type: mimeType
                    });
                    console.log('Final blob size:', blob.size, 'bytes');
                    console.log('Final blob type:', blob.type);
                    this.isProcessing = false;
                    resolve(blob);
                };



                // Start recording
                mediaRecorder.start(200); // Record in 200ms chunks for better quality
                console.log('Started recording with', mimeType);

                // Improved real-time processing with better timing and timeout protection
                let frameCount = 0;
                const totalFrames = Math.floor(duration * fps);
                let startTime = Date.now();
                let animationId = null;
                let lastFrameTime = 0;
                
                // Add timeout protection to prevent infinite processing
                const maxProcessingTime = (duration + 10) * 1000; // Add 10 second buffer
                const processingTimeout = setTimeout(() => {
                    console.warn('Processing timeout reached, stopping recording');
                    if (animationId) {
                        cancelAnimationFrame(animationId);
                    }
                    this.isProcessing = false;
                    mediaRecorder.stop();
                }, maxProcessingTime);
                
                const processFrame = () => {
                    if (!this.isProcessing) {
                        if (animationId) {
                            cancelAnimationFrame(animationId);
                        }
                        clearTimeout(processingTimeout);
                        mediaRecorder.stop();
                        return;
                    }

                    // Calculate current time based on actual elapsed time
                    const elapsed = (Date.now() - startTime) / 1000;
                    const currentTime = Math.min(elapsed, duration);
                    
                    // Only update video time if enough time has passed (throttling)
                    if (currentTime - lastFrameTime >= (1 / fps)) {
                        videoElement.currentTime = currentTime;
                        lastFrameTime = currentTime;
                        
                        // Process current frame with overlay
                        this.processFrame(videoElement, targetWidth, targetHeight);
                        frameCount++;
                    }
                    
                    const progress = Math.min(currentTime / duration, 1);
                    
                    if (onProgress) {
                        onProgress(progress);
                    }
                    
                    if (currentTime >= duration) {
                        console.log('Processing complete, stopping recording...');
                        if (animationId) {
                            cancelAnimationFrame(animationId);
                        }
                        clearTimeout(processingTimeout);
                        mediaRecorder.stop();
                        return;
                    }
                    
                    // Schedule next frame using requestAnimationFrame for smoother processing
                    animationId = requestAnimationFrame(processFrame);
                };

                // Cleanup function
                const cleanup = () => {
                    if (animationId) {
                        cancelAnimationFrame(animationId);
                    }
                    clearTimeout(processingTimeout);
                };

                // Start processing when video is ready
                videoElement.currentTime = 0;
                videoElement.addEventListener('loadeddata', () => {
                    console.log('Video loaded, starting real-time processing...');
                    startTime = Date.now();
                    animationId = requestAnimationFrame(processFrame);
                }, { once: true });
                
                // Enhanced error handling
                mediaRecorder.onerror = (error) => {
                    console.error('MediaRecorder error:', error);
                    cleanup();
                    this.isProcessing = false;
                    reject(error);
                };
            });

        } catch (error) {
            this.isProcessing = false;
            throw error;
        }
    }

    /**
     * Alternative processing method using playback synchronization
     * This method plays the video in real-time and captures frames
     * @param {HTMLVideoElement} video - Video element
     * @param {Function} onProgress - Callback untuk progress
     * @param {string} format - Output format ('webm' atau 'mp4')
     * @returns {Promise<Blob>} Promise yang resolve dengan video blob
     */
    async processVideoRealtime(video, onProgress = null, format = 'mp4') {
        if (this.isProcessing) {
            throw new Error('Video sedang diproses');
        }

        this.isProcessing = true;

        try {
            const targetWidth = 1080;
            const targetHeight = 1920;
            const duration = video.duration;
            
            // Setup canvas for processing
            this.canvas.width = targetWidth;
            this.canvas.height = targetHeight;

            // Create hidden video element for processing
            const hiddenVideo = document.createElement('video');
            hiddenVideo.src = video.src;
            hiddenVideo.muted = false;
            hiddenVideo.volume = 1.0;
            hiddenVideo.playbackRate = 1.0;
            hiddenVideo.style.display = 'none';
            hiddenVideo.crossOrigin = 'anonymous';
            document.body.appendChild(hiddenVideo);

            // Wait for video to load
            await new Promise((resolve, reject) => {
                hiddenVideo.onloadeddata = resolve;
                hiddenVideo.onerror = reject;
            });

            // Create canvas stream
            const canvasStream = this.canvas.captureStream(30);
            
            // Add audio from the video
            try {
                const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                await audioContext.resume();
                
                const source = audioContext.createMediaElementSource(hiddenVideo);
                const destination = audioContext.createMediaStreamDestination();
                
                source.connect(destination);
                source.connect(audioContext.destination);
                
                destination.stream.getAudioTracks().forEach(track => {
                    canvasStream.addTrack(track);
                });
            } catch (audioError) {
                console.warn('Audio setup failed:', audioError);
            }

            // Setup MediaRecorder with improved codec selection
            let mimeType;
            if (format === 'mp4') {
                // Use highest quality WebM codec for "MP4" requests
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
                } else if (MediaRecorder.isTypeSupported('video/webm;codecs=h264,opus')) {
                    mimeType = 'video/webm;codecs=h264,opus';
                } else {
                    mimeType = 'video/webm';
                }
            }

            const mediaRecorder = new MediaRecorder(canvasStream, {
                mimeType: mimeType,
                videoBitsPerSecond: 8000000, // Higher quality
                audioBitsPerSecond: 256000
            });

            const chunks = [];

            return new Promise((resolve, reject) => {
                mediaRecorder.ondataavailable = (event) => {
                    if (event.data.size > 0) {
                        chunks.push(event.data);
                    }
                };

                mediaRecorder.onstop = () => {
                    document.body.removeChild(hiddenVideo);
                    // Always create WebM blob since MediaRecorder doesn't produce true MP4
                    const blob = new Blob(chunks, { 
                        type: mimeType
                    });
                    this.isProcessing = false;
                    resolve(blob);
                };



                // Real-time frame processing during playback with timeout protection
                let animationId = null;
                
                // Add timeout protection
                const maxProcessingTime = (duration + 10) * 1000;
                const processingTimeout = setTimeout(() => {
                    console.warn('Realtime processing timeout reached, stopping recording');
                    if (animationId) {
                        cancelAnimationFrame(animationId);
                    }
                    this.isProcessing = false;
                    mediaRecorder.stop();
                }, maxProcessingTime);
                
                const updateFrame = () => {
                    if (!this.isProcessing || hiddenVideo.ended) {
                        if (animationId) {
                            cancelAnimationFrame(animationId);
                        }
                        clearTimeout(processingTimeout);
                        mediaRecorder.stop();
                        return;
                    }

                    // Process current frame
                    this.processFrame(hiddenVideo, targetWidth, targetHeight);
                    
                    // Update progress
                    if (onProgress && duration > 0) {
                        const progress = Math.min(hiddenVideo.currentTime / duration, 1);
                        onProgress(progress);
                    }

                    animationId = requestAnimationFrame(updateFrame);
                };
                
                // Cleanup function
                const cleanup = () => {
                    if (animationId) {
                        cancelAnimationFrame(animationId);
                    }
                    clearTimeout(processingTimeout);
                };

                // Start everything
                mediaRecorder.start(100);
                hiddenVideo.currentTime = 0;
                
                hiddenVideo.onended = () => {
                    console.log('Video playback ended, stopping recording');
                    cleanup();
                    mediaRecorder.stop();
                };

                // Enhanced error handling for realtime method
                mediaRecorder.onerror = (error) => {
                    console.error('MediaRecorder error in realtime method:', error);
                    cleanup();
                    document.body.removeChild(hiddenVideo);
                    this.isProcessing = false;
                    reject(error);
                };

                hiddenVideo.play().then(() => {
                    updateFrame();
                }).catch((error) => {
                    cleanup();
                    reject(error);
                });
            });

        } catch (error) {
            this.isProcessing = false;
            throw error;
        }
    }

    /**
     * Simple video processing method with better handling for longer videos
     * Uses chunk-based processing to avoid timeouts
     * @param {HTMLVideoElement} video - Video element
     * @param {Function} onProgress - Callback untuk progress
     * @returns {Promise<Blob>} Promise yang resolve dengan video blob
     */
    async processVideoSimple(video, onProgress = null) {
        if (this.isProcessing) {
            throw new Error('Video sedang diproses');
        }

        this.isProcessing = true;

        try {
            const targetWidth = 1080;
            const targetHeight = 1920;
            const duration = video.duration;
            
            // Setup canvas for processing
            this.canvas.width = targetWidth;
            this.canvas.height = targetHeight;

            // Create hidden video element for processing
            const hiddenVideo = document.createElement('video');
            hiddenVideo.src = video.src;
            hiddenVideo.muted = false;
            hiddenVideo.volume = 1.0;
            hiddenVideo.playbackRate = 1.0;
            hiddenVideo.style.display = 'none';
            hiddenVideo.crossOrigin = 'anonymous';
            hiddenVideo.preload = 'metadata';
            document.body.appendChild(hiddenVideo);

            // Wait for video to load
            await new Promise((resolve, reject) => {
                hiddenVideo.onloadedmetadata = resolve;
                hiddenVideo.onerror = (e) => {
                    console.error('Video loading error:', e);
                    reject(new Error('Gagal memuat video'));
                };
                hiddenVideo.load();
            });

            console.log('Video loaded - Duration:', duration, 'seconds');

            // Create canvas stream with stable frame rate
            const fps = 25; // Lower FPS for better stability
            const canvasStream = this.canvas.captureStream(fps);
            
            // Enhanced audio handling
            try {
                const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                
                // Resume context if suspended (required for autoplay policies)
                if (audioContext.state === 'suspended') {
                    await audioContext.resume();
                }
                
                const source = audioContext.createMediaElementSource(hiddenVideo);
                const destination = audioContext.createMediaStreamDestination();
                
                // Create gain node for audio control
                const gainNode = audioContext.createGain();
                gainNode.gain.value = 1.0;
                
                // Connect audio pipeline
                source.connect(gainNode);
                gainNode.connect(destination);
                
                // Add audio tracks to canvas stream
                destination.stream.getAudioTracks().forEach(track => {
                    canvasStream.addTrack(track);
                    console.log('Audio track added:', track.label, 'enabled:', track.enabled);
                });
                
                console.log('Audio context state:', audioContext.state);
                console.log('Audio tracks in stream:', canvasStream.getAudioTracks().length);
            } catch (audioError) {
                console.warn('Audio setup failed, proceeding without audio:', audioError);
            }

            // Use the most compatible codec
            let mimeType = 'video/webm';
            if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')) {
                mimeType = 'video/webm;codecs=vp8,opus';
            } else if (MediaRecorder.isTypeSupported('video/webm;codecs=h264,opus')) {
                mimeType = 'video/webm;codecs=h264,opus';
            }

            // Create MediaRecorder with optimized settings for longer videos
            const mediaRecorder = new MediaRecorder(canvasStream, {
                mimeType: mimeType,
                videoBitsPerSecond: 3000000, // Reduced bitrate for better performance
                audioBitsPerSecond: 128000   // Standard audio quality
            });

            console.log('Using MediaRecorder with:', mimeType);

            const chunks = [];
            let recordingStartTime = Date.now();

            return new Promise((resolve, reject) => {
                mediaRecorder.ondataavailable = (event) => {
                    if (event.data.size > 0) {
                        chunks.push(event.data);
                        console.log('Chunk received:', event.data.size, 'bytes', 'Total chunks:', chunks.length);
                    }
                };

                mediaRecorder.onstop = () => {
                    const processingTime = (Date.now() - recordingStartTime) / 1000;
                    console.log('Recording stopped after', processingTime.toFixed(2), 'seconds');
                    console.log('Total chunks collected:', chunks.length);
                    
                    document.body.removeChild(hiddenVideo);
                    
                    const blob = new Blob(chunks, { type: mimeType });
                    console.log('Final blob size:', blob.size, 'bytes');
                    console.log('Final blob type:', blob.type);
                    
                    this.isProcessing = false;
                    resolve(blob);
                };

                mediaRecorder.onerror = (error) => {
                    console.error('MediaRecorder error:', error);
                    document.body.removeChild(hiddenVideo);
                    this.isProcessing = false;
                    reject(error);
                };

                // Enhanced frame processing with better timing control and progress reporting
                let animationId = null;
                let lastProgressUpdate = 0;
                const progressInterval = 100; // Update progress every 100ms for more responsive UI
                
                const updateFrame = () => {
                    if (!this.isProcessing || hiddenVideo.ended || hiddenVideo.currentTime >= duration) {
                        console.log('Ending frame processing. Ended:', hiddenVideo.ended, 'CurrentTime:', hiddenVideo.currentTime, 'Duration:', duration);
                        if (animationId) {
                            cancelAnimationFrame(animationId);
                        }
                        
                        // Final progress update
                        if (onProgress) {
                            onProgress(1); // 100% completion
                        }
                        
                        // Add a small delay before stopping to ensure all frames are captured
                        setTimeout(() => {
                            mediaRecorder.stop();
                        }, 100);
                        return;
                    }

                    // Process current frame with overlay
                    this.processFrame(hiddenVideo, targetWidth, targetHeight);
                    
                    // Update progress more frequently and ensure it's always updated
                    const now = Date.now();
                    if (onProgress && (now - lastProgressUpdate) >= progressInterval) {
                        const progress = Math.min(hiddenVideo.currentTime / duration, 1);
                        console.log('Progress update:', Math.round(progress * 100) + '% - Current time:', hiddenVideo.currentTime.toFixed(2), '/', duration.toFixed(2));
                        onProgress(progress);
                        lastProgressUpdate = now;
                    }

                    animationId = requestAnimationFrame(updateFrame);
                };

                // Start recording with longer chunks for stability
                mediaRecorder.start(500); // 500ms chunks for better performance
                console.log('Started recording with', mimeType);

                // Start video playback and frame processing
                hiddenVideo.currentTime = 0;
                hiddenVideo.onended = () => {
                    console.log('Video playback ended naturally');
                    if (animationId) {
                        cancelAnimationFrame(animationId);
                    }
                    setTimeout(() => {
                        mediaRecorder.stop();
                    }, 200); // Extra delay to ensure all frames are captured
                };

                hiddenVideo.play().then(() => {
                    console.log('Video playback started, beginning frame processing...');
                    console.log('Video duration:', duration, 'seconds');
                    recordingStartTime = Date.now();
                    
                    // Initial progress update
                    if (onProgress) {
                        onProgress(0);
                    }
                    
                    updateFrame();
                }).catch((error) => {
                    console.error('Video playback failed:', error);
                    document.body.removeChild(hiddenVideo);
                    this.isProcessing = false;
                    reject(error);
                });
            });

        } catch (error) {
            this.isProcessing = false;
            console.error('Video processing error:', error);
            throw error;
        }
    }

    /**
     * Stop processing video
     */
    stopProcessing() {
        this.isProcessing = false;
    }
}

/**
 * Utility functions untuk video processing
 */
class VideoUtils {
    /**
     * Convert video format
     * @param {Blob} videoBlob - Video blob
     * @param {string} format - Format target (webm, mp4)
     * @returns {Promise<Blob>} Converted video blob
     */
    static async convertFormat(videoBlob, format) {
        // Implementation untuk convert format video
        // Note: Ini memerlukan library tambahan seperti FFmpeg.js
        return videoBlob;
    }

    /**
     * Compress video
     * @param {Blob} videoBlob - Video blob
     * @param {number} quality - Quality (0-1)
     * @returns {Promise<Blob>} Compressed video blob
     */
    static async compressVideo(videoBlob, quality = 0.8) {
        // Implementation untuk compress video
        return videoBlob;
    }

    /**
     * Get video metadata
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
                    size: videoBlob.size
                });
            };
            video.src = URL.createObjectURL(videoBlob);
        });
    }
}

// Export untuk penggunaan global
if (typeof window !== 'undefined') {
    window.VideoFrameProcessor = VideoFrameProcessor;
    window.VideoUtils = VideoUtils;
}

// Export untuk ES6 modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { VideoFrameProcessor, VideoUtils };
}
