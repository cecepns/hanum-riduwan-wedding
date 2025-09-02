import { useRef } from 'react'
import { Upload } from 'lucide-react'

function FileUpload({ onFileSelect }) {
  const fileInputRef = useRef(null)

  const handleFileChange = (event) => {
    const file = event.target.files[0]
    if (!file) return

    const fileType = file.type.startsWith('image/') ? 'image' : 'video'
    
    if (fileType === 'image') {
      const reader = new FileReader()
      reader.onload = (e) => {
        onFileSelect(e.target.result, 'image')
      }
      reader.readAsDataURL(file)
    } else if (fileType === 'video') {
      const url = URL.createObjectURL(file)
      onFileSelect(url, 'video')
    }
  }

  const triggerFileInput = () => {
    fileInputRef.current?.click()
  }

  return (
    <>
      <button 
        className="btn-primary min-w-[140px]"
        onClick={triggerFileInput}
      >
        <Upload size={24} />
        Upload File
      </button>
      
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        onChange={handleFileChange}
        className="hidden"
      />
    </>
  )
}

export default FileUpload