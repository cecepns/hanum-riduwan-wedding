import { useState } from 'react'
import { Camera, Upload, Download, RotateCcw, Image as ImageIcon, Video } from 'lucide-react'
import PhotoEditor from './components/PhotoEditor'
import VideoEditor from './components/VideoEditor'
import FileUpload from './components/FileUpload'
import CameraCapture from './components/CameraCapture'

function App() {
  const [selectedFile, setSelectedFile] = useState(null)
  const [fileType, setFileType] = useState(null)
  const [showCamera, setShowCamera] = useState(false)
  const [editMode, setEditMode] = useState(false)

  const handleFileSelect = (file, type) => {
    setSelectedFile(file)
    setFileType(type)
    setEditMode(true)
    setShowCamera(false)
  }

  const handleCameraCapture = (imageSrc) => {
    setSelectedFile(imageSrc)
    setFileType('image')
    setEditMode(true)
    setShowCamera(false)
  }

  const resetApp = () => {
    setSelectedFile(null)
    setFileType(null)
    setEditMode(false)
    setShowCamera(false)
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="glass border-b border-white/20 p-8 text-center shadow-lg">
        <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary-500 to-secondary-500 bg-clip-text text-transparent mb-2">
          Wedding Frame Editor
        </h1>
        <p className="text-xl text-gray-600 font-medium mb-4">
          Hanum & Riduwan
        </p>
        <div className="w-24 h-1 bg-gradient-to-r from-primary-500 to-secondary-500 mx-auto rounded-full"></div>
      </header>

      {!editMode && !showCamera && (
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="card p-8 md:p-12 max-w-lg w-full text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-800 mb-4">
              Selamat Datang di Wedding Frame Editor
            </h2>
            <p className="text-gray-600 mb-8 leading-relaxed">
              Buat kenangan indah dengan frame pernikahan <br/> Hanum & Riduwan
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 mb-8">
              <FileUpload onFileSelect={handleFileSelect} />
              
              <button 
                className="btn-secondary min-w-[140px]"
                onClick={() => setShowCamera(true)}
              >
                <Camera size={24} />
                Ambil Foto
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-8 border-t border-gray-200">
              <div className="flex flex-col items-center gap-2 text-gray-600">
                <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                  <ImageIcon size={20} className="text-primary-600" />
                </div>
                <span className="text-sm font-medium">Edit Foto</span>
              </div>
              <div className="flex flex-col items-center gap-2 text-gray-600">
                <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                  <Video size={20} className="text-primary-600" />
                </div>
                <span className="text-sm font-medium">Edit Video</span>
              </div>
              <div className="flex flex-col items-center gap-2 text-gray-600">
                <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                  <Download size={20} className="text-primary-600" />
                </div>
                <span className="text-sm font-medium">Download Hasil</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCamera && (
        <div className="flex-1 p-4">
          <CameraCapture 
            onCapture={handleCameraCapture}
            onCancel={() => setShowCamera(false)}
          />
        </div>
      )}

      {editMode && selectedFile && (
        <div className="flex-1 p-4">
          <div className="mb-4">
            <button 
              className="glass px-4 py-2 rounded-lg border border-white/20 hover:bg-white/20 transition-all duration-300 flex items-center gap-2 text-gray-700 font-medium"
              onClick={resetApp}
            >
              <RotateCcw size={20} />
              Kembali
            </button>
          </div>

          {fileType === 'image' ? (
            <PhotoEditor 
              imageSrc={selectedFile}
              onReset={resetApp}
            />
          ) : (
            <VideoEditor 
              videoSrc={selectedFile}
              onReset={resetApp}
            />
          )}
        </div>
      )}
    </div>
  )
}

export default App