// 引入 whatwg-fetch 的 polyfill（兼容 Android WebView）
import 'whatwg-fetch'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
