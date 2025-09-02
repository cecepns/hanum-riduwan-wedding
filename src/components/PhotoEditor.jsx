import { useEffect, useRef, useState } from 'react'
import { Download, RotateCcw, ZoomIn, ZoomOut, Move, AlertCircle } from 'lucide-react'
import BingkaiImage from '../assets/bingkai.png'

// eslint-disable-next-line react/prop-types
function PhotoEditor({ imageSrc }) {
  const canvasRef = useRef(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0, scale: 1 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const userImageRef = useRef(null)
  const frameImageRef = useRef(null)

  // Canvas dimensions
  const CANVAS_WIDTH = 1080
  const CANVAS_HEIGHT = 1920

  const drawCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas || !userImageRef.current || !frameImageRef.current) return

    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

    // Draw white background
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

    // Draw user image
    const userImg = userImageRef.current
    const { x, y, scale } = imagePosition
    
    const scaledWidth = userImg.width * scale
    const scaledHeight = userImg.height * scale
    
    ctx.drawImage(
      userImg,
      x - scaledWidth / 2,
      y - scaledHeight / 2,
      scaledWidth,
      scaledHeight
    )

    // Draw frame on top
    const frameImg = frameImageRef.current
    ctx.drawImage(frameImg, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
  }

  const loadImages = async () => {
    try {
      setIsLoading(true)
      setError(null)

      // Load user image
      const userImg = new Image()
      userImg.crossOrigin = 'anonymous'
      
      await new Promise((resolve, reject) => {
        userImg.onload = resolve
        userImg.onerror = () => reject(new Error('Failed to load user image'))
        userImg.src = imageSrc
      })

      // Load frame image
      const frameImg = new Image()
      frameImg.crossOrigin = 'anonymous'
      
      await new Promise((resolve, reject) => {
        frameImg.onload = resolve
        frameImg.onerror = () => reject(new Error('Failed to load frame image'))
        frameImg.src = BingkaiImage
      })

      userImageRef.current = userImg
      frameImageRef.current = frameImg

      // Calculate initial scale and position to fit image in canvas
      const canvasAspect = CANVAS_WIDTH / CANVAS_HEIGHT
      const imgAspect = userImg.width / userImg.height

      let scale
      if (imgAspect > canvasAspect) {
        scale = CANVAS_WIDTH / userImg.width
      } else {
        scale = CANVAS_HEIGHT / userImg.height
      }

      setImagePosition({
        x: CANVAS_WIDTH / 2,
        y: CANVAS_HEIGHT / 2,
        scale: scale
      })

      setIsLoading(false)
    } catch (err) {
      console.error('Error loading images:', err)
      setError('Gagal memuat gambar. Silakan coba dengan gambar lain.')
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadImages()
  }, [imageSrc])

  useEffect(() => {
    if (!isLoading && !error) {
      drawCanvas()
    }
  }, [imagePosition, isLoading, error])

  const handleMouseDown = (e) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const scaleX = CANVAS_WIDTH / rect.width
    const scaleY = CANVAS_HEIGHT / rect.height
    
    setIsDragging(true)
    setDragStart({
      x: (e.clientX - rect.left) * scaleX - imagePosition.x,
      y: (e.clientY - rect.top) * scaleY - imagePosition.y
    })
  }

  const handleMouseMove = (e) => {
    if (!isDragging) return

    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const scaleX = CANVAS_WIDTH / rect.width
    const scaleY = CANVAS_HEIGHT / rect.height

    setImagePosition(prev => ({
      ...prev,
      x: (e.clientX - rect.left) * scaleX - dragStart.x,
      y: (e.clientY - rect.top) * scaleY - dragStart.y
    }))
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const downloadImage = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const link = document.createElement('a')
    link.download = `hanum-riduwan-wedding-${Date.now()}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  const zoomIn = () => {
    setImagePosition(prev => ({
      ...prev,
      scale: Math.min(prev.scale * 1.1, 3)
    }))
  }

  const zoomOut = () => {
    setImagePosition(prev => ({
      ...prev,
      scale: Math.max(prev.scale * 0.9, 0.1)
    }))
  }

  const resetImage = () => {
    if (!userImageRef.current) return

    const userImg = userImageRef.current
    const canvasAspect = CANVAS_WIDTH / CANVAS_HEIGHT
    const imgAspect = userImg.width / userImg.height

    let scale
    if (imgAspect > canvasAspect) {
      scale = CANVAS_WIDTH / userImg.width
    } else {
      scale = CANVAS_HEIGHT / userImg.height
    }

    setImagePosition({
      x: CANVAS_WIDTH / 2,
      y: CANVAS_HEIGHT / 2,
      scale: scale
    })
  }

  return (
    <div className="card p-6 md:p-8 max-w-7xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          <div className="relative bg-gray-100 rounded-xl overflow-hidden flex justify-center items-center min-h-[600px]">
            {isLoading && !error && (
              <div className="absolute inset-0 bg-white/90 flex flex-col items-center justify-center z-10">
                <div className="w-10 h-10 border-4 border-gray-300 border-t-primary-500 rounded-full animate-spin mb-4"></div>
                <p className="text-gray-600 font-medium">Memuat editor...</p>
              </div>
            )}
            
            {error && (
              <div className="absolute inset-0 bg-white/90 flex flex-col items-center justify-center z-10">
                <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
                <p className="text-red-600 font-medium text-center px-4 mb-4">{error}</p>
                <button 
                  className="btn-primary px-6 py-2"
                  onClick={() => {
                    setError(null)
                    loadImages()
                  }}
                >
                  Coba Lagi
                </button>
              </div>
            )}
            <canvas 
              ref={canvasRef} 
              width={1080}
              height={1920}
              className="max-w-full max-h-[70vh] rounded-lg shadow-2xl bg-white cursor-move"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            />
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="bg-gray-50 rounded-xl p-6 h-fit">
            <div className="mb-6">
              <h4 className="text-lg font-semibold text-gray-800 mb-4">Kontrol Gambar</h4>
              <div className="space-y-2">
                <button 
                  className="w-full glass border border-gray-200 hover:bg-white/50 px-4 py-3 rounded-lg transition-all duration-300 flex items-center gap-2 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={zoomIn}
                  disabled={isLoading || error}
                >
                  <ZoomIn size={18} />
                  Zoom In
                </button>
                <button 
                  className="w-full glass border border-gray-200 hover:bg-white/50 px-4 py-3 rounded-lg transition-all duration-300 flex items-center gap-2 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={zoomOut}
                  disabled={isLoading || error}
                >
                  <ZoomOut size={18} />
                  Zoom Out
                </button>
                <button 
                  className="w-full glass border border-gray-200 hover:bg-white/50 px-4 py-3 rounded-lg transition-all duration-300 flex items-center gap-2 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={resetImage}
                  disabled={isLoading || error}
                >
                  <RotateCcw size={18} />
                  Reset
                </button>
              </div>
            </div>

            <div className="mb-6">
              <h4 className="text-lg font-semibold text-gray-800 mb-4">Instruksi</h4>
              <div className="space-y-3 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <Move size={16} className="text-primary-500" />
                  <span>Drag gambar untuk memposisikan</span>
                </div>
                <div className="flex items-center gap-2">
                  <ZoomIn size={16} className="text-primary-500" />
                  <span>Gunakan tombol zoom untuk mengubah ukuran</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-lg">🖼️</span>
                  <span>Frame akan otomatis diterapkan</span>
                </div>
              </div>
            </div>

            <button 
              className="btn-primary w-full text-lg py-4 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={downloadImage}
              disabled={isLoading || error}
            >
              <Download size={20} />
              Download Hasil
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PhotoEditor