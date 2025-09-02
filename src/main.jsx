import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css'

createRoot(document.getElementById('root')).render(
  // Temporarily disable StrictMode if you experience canvas initialization issues
  // <StrictMode>
    <App />
  // </StrictMode>,
)
