import { useEffect, useRef, useState, useCallback } from 'react'
import { Download, Play, Pause, Settings } from 'lucide-react'
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { toBlobURL, fetchFile } from '@ffmpeg/util'
import BingkaiImage from '../assets/bingkai.png'

// eslint-disable-next-line react/prop-types
function VideoEditor({ videoSrc }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const frameImageRef = useRef(null)
  const ffmpegRef = useRef(new FFmpeg())
  const animationFrameRef = useRef(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isProcessing, setIsProcessing] = useState(false)
  const [frameImageLoaded, setFrameImageLoaded] = useState(false)
  const [ffmpegLoaded, setFfmpegLoaded] = useState(false)
  const [processingProgress, setProcessingProgress] = useState(0)

  // Initialize FFmpeg
  useEffect(() => {
    const loadFFmpeg = async () => {
      try {
        const ffmpeg = ffmpegRef.current
        
        // Load FFmpeg with progress tracking
        ffmpeg.on('progress', ({ progress }) => {
          setProcessingProgress(Math.round(progress * 100))
        })

        console.log('Starting FFmpeg load...')
        
        // Try local files first, then CDN fallbacks
        const sources = [
          {
            name: 'Local files',
            coreURL: '/ffmpeg/ffmpeg-core.js',
            wasmURL: '/ffmpeg/ffmpeg-core.wasm'
          },
          {
            name: 'unpkg ESM',
            coreURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.js',
            wasmURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.wasm'
          },
          {
            name: 'jsDelivr ESM',
            coreURL: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.js',
            wasmURL: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.wasm'
          }
        ]
        
        let loaded = false
        
        for (const source of sources) {
          try {
            console.log(`Trying to load FFmpeg from: ${source.name}`)
            
            await ffmpeg.load({
              coreURL: await toBlobURL(source.coreURL, 'text/javascript'),
              wasmURL: await toBlobURL(source.wasmURL, 'application/wasm'),
            })
            
            setFfmpegLoaded(true)
            console.log(`FFmpeg loaded successfully from: ${source.name}`)
            loaded = true
            break
          } catch (sourceError) {
            console.warn(`Failed to load from ${source.name}:`, sourceError)
            continue
          }
        }
        
        if (!loaded) {
          throw new Error('All FFmpeg sources failed')
        }
      } catch (error) {
        console.error('Failed to load FFmpeg from all sources:', error)
        setFfmpegLoaded(false)
      }
    }

    loadFFmpeg()
  }, [])

  // Pre-load frame image to prevent flickering
  useEffect(() => {
    const frameImg = new Image()
    frameImg.crossOrigin = 'anonymous'
    frameImg.onload = () => {
      frameImageRef.current = frameImg
      setFrameImageLoaded(true)
    }
    frameImg.onerror = () => {
      console.error('Failed to load frame image')
      setFrameImageLoaded(false)
    }
    frameImg.src = BingkaiImage
  }, [])

  // Optimized draw frame function with memoization
  const drawFrame = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    const frameImg = frameImageRef.current
    if (!video || !canvas || !frameImg) return

    const ctx = canvas.getContext('2d')
    canvas.width = 1080
    canvas.height = 1920

    // Clear canvas
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, 1080, 1920)

    // Calculate video scaling
    const canvasAspect = 1080 / 1920
    const videoAspect = video.videoWidth / video.videoHeight

    let drawWidth, drawHeight, drawX, drawY

    if (videoAspect > canvasAspect) {
      drawWidth = 1080
      drawHeight = 1080 / videoAspect
      drawX = 0
      drawY = (1920 - drawHeight) / 2
    } else {
      drawHeight = 1920
      drawWidth = 1920 * videoAspect
      drawX = (1080 - drawWidth) / 2
      drawY = 0
    }

    // Draw video frame
    ctx.drawImage(video, drawX, drawY, drawWidth, drawHeight)

    // Draw frame overlay (using pre-loaded image)
    ctx.drawImage(frameImg, 0, 0, 1080, 1920)
  }, [])

  // Animation loop for smooth rendering
  const animate = useCallback(() => {
    const video = videoRef.current
    if (!video || video.paused || !frameImageLoaded) return

    drawFrame()
    animationFrameRef.current = requestAnimationFrame(animate)
  }, [drawFrame, frameImageLoaded])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handleLoadedMetadata = () => {
      setDuration(video.duration)
      if (frameImageLoaded) {
        drawFrame()
        // Auto-play video when loaded
        video.play().catch(error => {
          console.log('Auto-play prevented by browser:', error)
          // Browser blocked auto-play, that's fine
        })
      }
    }

    const handleLoadedData = () => {
      // Auto-play when video data is loaded
      if (frameImageLoaded) {
        video.play().catch(error => {
          console.log('Auto-play prevented by browser:', error)
        })
      }
    }

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime)
    }

    const handlePlay = () => {
      setIsPlaying(true)
      if (frameImageLoaded) {
        animate()
      }
    }

    const handlePause = () => {
      setIsPlaying(false)
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
    }

    video.addEventListener('loadedmetadata', handleLoadedMetadata)
    video.addEventListener('loadeddata', handleLoadedData)
    video.addEventListener('timeupdate', handleTimeUpdate)
    video.addEventListener('play', handlePlay)
    video.addEventListener('pause', handlePause)

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata)
      video.removeEventListener('loadeddata', handleLoadedData)
      video.removeEventListener('timeupdate', handleTimeUpdate)
      video.removeEventListener('play', handlePlay)
      video.removeEventListener('pause', handlePause)
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [videoSrc, frameImageLoaded, animate, drawFrame])

  // Auto-play effect when video source changes and frame is loaded
  useEffect(() => {
    const video = videoRef.current
    if (video && videoSrc && frameImageLoaded) {
      // Small delay to ensure video is ready
      const timer = setTimeout(() => {
        video.play().catch(error => {
          console.log('Auto-play prevented by browser:', error)
        })
      }, 100)
      
      return () => clearTimeout(timer)
    }
  }, [videoSrc, frameImageLoaded])

  const togglePlayPause = () => {
    const video = videoRef.current
    if (!video) return

    if (video.paused) {
      video.play()
      setIsPlaying(true)
    } else {
      video.pause()
      setIsPlaying(false)
    }
  }

  const handleSeek = (e) => {
    const video = videoRef.current
    if (!video) return

    const rect = e.target.getBoundingClientRect()
    const pos = (e.clientX - rect.left) / rect.width
    video.currentTime = pos * duration
  }

  // Create frame overlay canvas for FFmpeg processing
  const createFrameOverlay = useCallback(async () => {
    const frameImg = frameImageRef.current
    if (!frameImg) return null

    const overlayCanvas = document.createElement('canvas')
    overlayCanvas.width = 1080
    overlayCanvas.height = 1920
    const ctx = overlayCanvas.getContext('2d')
    
    // Draw frame overlay
    ctx.drawImage(frameImg, 0, 0, 1080, 1920)
    
    // Convert to blob
    return new Promise((resolve) => {
      overlayCanvas.toBlob(resolve, 'image/png')
    })
  }, [])

  // High-quality video processing with FFmpeg
  const processVideoWithFFmpeg = useCallback(async () => {
    if (!ffmpegLoaded || !videoSrc) {
      alert('FFmpeg belum siap atau video tidak tersedia')
      return
    }

    setIsProcessing(true)
    setProcessingProgress(0)

    try {
      const ffmpeg = ffmpegRef.current

      // Load input video
      console.log('Loading video file...')
      const videoData = await fetchFile(videoSrc)
      await ffmpeg.writeFile('input.mp4', videoData)

      // Create frame overlay
      console.log('Creating frame overlay...')
      const frameOverlay = await createFrameOverlay()
      if (frameOverlay) {
        const overlayData = await fetchFile(frameOverlay)
        await ffmpeg.writeFile('frame.png', overlayData)
      }

      // FFmpeg command for high-quality processing with audio preservation
      const ffmpegCommand = [
        '-i', 'input.mp4',
        '-i', 'frame.png',
        '-filter_complex', 
        '[0:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:white[scaled];[scaled][1:v]overlay=0:0[output]',
        '-map', '[output]',
        '-map', '0:a?', // Include audio if available
        '-c:v', 'libx264',
        '-preset', 'medium',
        '-crf', '18', // High quality
        '-c:a', 'aac',
        '-b:a', '128k',
        '-movflags', '+faststart',
        'output.mp4'
      ]

      console.log('Processing video with FFmpeg...')
      await ffmpeg.exec(ffmpegCommand)

      // Read output file
      console.log('Reading output file...')
      const outputData = await ffmpeg.readFile('output.mp4')
      
      // Create download
      const blob = new Blob([outputData], { type: 'video/mp4' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.download = `hanum-riduwan-wedding-video-${Date.now()}.mp4`
      link.href = url
      link.click()
      URL.revokeObjectURL(url)

      // Cleanup
      await ffmpeg.deleteFile('input.mp4')
      await ffmpeg.deleteFile('frame.png')
      await ffmpeg.deleteFile('output.mp4')

      console.log('Video processing completed successfully')
      
    } catch (error) {
      console.error('Error processing video:', error)
      alert('Terjadi kesalahan saat memproses video: ' + error.message)
    } finally {
      setIsProcessing(false)
      setProcessingProgress(0)
    }
  }, [ffmpegLoaded, videoSrc, createFrameOverlay])

  // Use FFmpeg for high-quality processing
  const downloadVideo = processVideoWithFFmpeg

  const formatTime = (time) => {
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  return (
    <div className="card p-6 md:p-8 max-w-7xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          <div className="bg-gray-100 rounded-xl p-4 text-center">
            <video
              ref={videoRef}
              src={videoSrc}
              className="hidden"
              playsInline
              controls={false}
              preload="metadata"
              muted={true}
            />
            
            <canvas
              ref={canvasRef}
              className="max-w-full max-h-[70vh] rounded-lg shadow-2xl bg-white mx-auto"
            />
            
            <div className="flex items-center gap-4 mt-4 p-4 bg-white rounded-lg shadow-md">
              <button 
                className="w-10 h-10 btn-primary rounded-full p-0"
                onClick={togglePlayPause}
              >
                {isPlaying ? <Pause size={20} /> : <Play size={20} />}
              </button>
              
              <div className="text-sm text-gray-600 font-medium min-w-[80px]">
                {formatTime(currentTime)} / {formatTime(duration)}
              </div>
              
              <div 
                className="flex-1 h-2 bg-gray-200 rounded-full cursor-pointer relative overflow-hidden"
                onClick={handleSeek}
              >
                <div 
                  className="h-full bg-gradient-to-r from-primary-500 to-secondary-500 rounded-full transition-all duration-100"
                  style={{ width: `${(currentTime / duration) * 100}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="bg-gray-50 rounded-xl p-6 h-fit space-y-6">
            <div>
              <h4 className="text-lg font-semibold text-gray-800 mb-3">Video dengan Frame</h4>
              <p className="text-gray-600 text-sm leading-relaxed">
                Video Anda telah dikombinasikan dengan frame pernikahan Hanum & Riduwan.
              </p>
            </div>

            <div>
              <h4 className="text-lg font-semibold text-gray-800 mb-3">Status & Catatan</h4>
              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex items-start gap-2">
                  <span className={`mt-0.5 ${ffmpegLoaded ? 'text-green-500' : 'text-yellow-500'}`}>•</span>
                  <span>FFmpeg: {ffmpegLoaded ? 'Siap' : 'Loading...'}</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-primary-500 mt-0.5">•</span>
                  <span>Frame otomatis diterapkan pada video</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-primary-500 mt-0.5">•</span>
                  <span>Ukuran output: 1080 x 1920 (Portrait)</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-primary-500 mt-0.5">•</span>
                  <span>Format: MP4 (High Quality + Audio)</span>
                </div>
              </div>
            </div>

            {isProcessing && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-2">
                  <Settings className="animate-spin text-blue-600" size={16} />
                  <span className="text-blue-800 font-medium">Memproses Video...</span>
                </div>
                <div className="w-full bg-blue-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${processingProgress}%` }}
                  ></div>
                </div>
                <p className="text-blue-700 text-xs mt-1">{processingProgress}% selesai</p>
              </div>
            )}

            <button 
              className={`btn-primary w-full text-lg py-4 ${isProcessing || !ffmpegLoaded ? 'opacity-70 cursor-not-allowed' : ''}`}
              onClick={downloadVideo}
              disabled={isProcessing || !ffmpegLoaded}
            >
              <Download size={20} />
              {isProcessing ? 'Memproses Video...' : !ffmpegLoaded ? 'Loading FFmpeg...' : 'Download Video HD'}
            </button>

            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-green-800 text-sm leading-relaxed">
                <strong>Info:</strong> Video akan diproses dengan FFmpeg untuk kualitas tinggi (1080p) dengan audio yang dipertahankan. Format output: MP4.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default VideoEditor