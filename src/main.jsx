import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'scroll-timeline-polyfill/dist/scroll-timeline.js';
import './index.scss'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
