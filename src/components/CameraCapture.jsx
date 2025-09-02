import { useState, useRef, useCallback } from 'react'
import Webcam from 'react-webcam'
import { Camera, X, RotateCcw } from 'lucide-react'

function CameraCapture({ onCapture, onCancel }) {
  const webcamRef = useRef(null)
  const [facingMode, setFacingMode] = useState('user')

  const capture = useCallback(() => {
    const imageSrc = webcamRef.current.getScreenshot()
    if (imageSrc) {
      onCapture(imageSrc)
    }
  }, [webcamRef, onCapture])

  const switchCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user')
  }

  const videoConstraints = {
    width: 1920,
    height: 1080,
    facingMode: facingMode
  }

  return (
    <div className="card p-6 md:p-8 max-w-2xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-2xl font-bold text-gray-800">Ambil Foto</h3>
        <button 
          className="w-10 h-10 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110"
          onClick={onCancel}
        >
          <X size={20} />
        </button>
      </div>

      <div className="relative rounded-xl overflow-hidden mb-6 bg-gray-100">
        <Webcam
          ref={webcamRef}
          audio={false}
          screenshotFormat="image/jpeg"
          videoConstraints={videoConstraints}
          className="w-full h-auto"
        />
        
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-4/5 h-4/5 border-2 border-dashed border-white/80 rounded-lg flex items-center justify-center">
            <div className="bg-black/70 text-white px-4 py-2 rounded-lg text-sm font-medium">
              Posisikan foto dalam frame ini
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <button 
          className="glass border border-white/20 hover:bg-white/20 px-4 py-3 rounded-xl transition-all duration-300 flex items-center gap-2 justify-center text-gray-700 font-medium"
          onClick={switchCamera}
        >
          <RotateCcw size={20} />
          Ganti Kamera
        </button>
        
        <button 
          className="btn-primary px-8 py-3 text-lg"
          onClick={capture}
        >
          <Camera size={24} />
          Ambil Foto
        </button>
      </div>
    </div>
  )
}

export default CameraCapture