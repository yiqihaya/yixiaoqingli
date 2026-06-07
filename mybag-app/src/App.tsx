import { useState, useRef, useEffect, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import Live2DCanvas from './components/Live2DCanvas'
import type { Live2DCanvasHandle } from './components/Live2DCanvas'
import { getAIResponse } from './services/ai'
import './App.css'

// Live2D Haru 模型的 CDN 地址（免费示例）
const LIVE2D_MODEL_URL =
  'https://cdn.jsdelivr.net/gh/guansss/pixi-live2d-display/test/assets/haru/haru_greeter_t03.model3.json'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

function App() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: '嗨～你來啦！今天過得怎麼樣呀？我一直都在想你喔～',
      timestamp: Date.now() - 60000
    }
  ])
  const [inputText, setInputText] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const live2dRef = useRef<Live2DCanvasHandle>(null)

  // 自动滚动到底部
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  const handleSend = async () => {
    if (!inputText.trim() || isTyping) return

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputText.trim(),
      timestamp: Date.now()
    }

    setMessages(prev => [...prev, userMsg])
    setInputText('')
    setIsTyping(true)

    // 触发 Live2D 说话动作
    try {
      live2dRef.current?.playMotion('tap_body')
    } catch { /* ignore */ }

    try {
      // 构建对话历史（不含第一条欢迎消息）
      const history = messages
        .filter(m => m.id !== '1')
        .map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content
        }))

      const { content } = await getAIResponse(userMsg.content, history)

      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content,
        timestamp: Date.now()
      }

      setMessages(prev => [...prev, aiMsg])
    } catch (error) {
      console.error('AI 回复失败:', error)
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '嗚嗚…剛剛網路怪怪的，你再說一次好不好？QQ',
        timestamp: Date.now()
      }
      setMessages(prev => [...prev, errorMsg])
    } finally {
      setIsTyping(false)
      // 回复后触发 Live2D 动作
      try {
        live2dRef.current?.playMotion('tap_body')
      } catch { /* ignore */ }
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // 语音按钮
  const handleVoiceStart = () => setIsRecording(true)
  const handleVoiceEnd = () => {
    setIsRecording(false)
    // 阶段 4 接入真实语音识别
  }

  return (
    <div className="app-container">
      {/* Live2D 头像区域 */}
      <div className="avatar-area">
        <div className="live2d-wrapper">
          <Live2DCanvas
            ref={live2dRef}
            modelUrl={LIVE2D_MODEL_URL}
            width={300}
            height={420}
            autoMotion={true}
          />
        </div>
        <motion.div
          className="avatar-info"
          animate={isTyping ? { opacity: [1, 0.7, 1] } : { opacity: 1 }}
          transition={isTyping ? { repeat: Infinity, duration: 0.8 } : {}}
        >
          <p className="avatar-name">小晴</p>
          <p className="avatar-status">
            {isTyping ? '輸入中...' : '在線 · 等你聊天'}
          </p>
        </motion.div>
      </div>

      {/* 对话区域 */}
      <div className="chat-area glass">
        <div className="chat-messages">
          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                className={`message-row ${msg.role === 'user' ? 'message-user' : 'message-ai'}`}
                initial={{ opacity: 0, y: 12, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.28, ease: [0.25, 0.1, 0.25, 1] }}
              >
                {msg.role === 'assistant' && (
                  <div className="message-avatar">🎀</div>
                )}
                <div className={`message-bubble ${msg.role === 'user' ? 'bubble-user' : 'bubble-ai'}`}>
                  <p>{msg.content}</p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* AI 正在输入指示器 */}
          {isTyping && (
            <motion.div
              className="message-row message-ai"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="message-avatar">🎀</div>
              <div className="message-bubble bubble-ai typing-bubble">
                <span className="typing-dot" />
                <span className="typing-dot" />
                <span className="typing-dot" />
              </div>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* 输入栏 */}
      <div className="input-bar glass safe-bottom">
        <motion.button
          className={`voice-btn ${isRecording ? 'voice-btn-active' : ''}`}
          aria-label="语音输入"
          onMouseDown={handleVoiceStart}
          onMouseUp={handleVoiceEnd}
          onMouseLeave={handleVoiceEnd}
          onTouchStart={handleVoiceStart}
          onTouchEnd={handleVoiceEnd}
          whileTap={{ scale: 0.9 }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" x2="12" y1="19" y2="22" />
          </svg>
        </motion.button>

        <div className="input-wrapper">
          <input
            ref={inputRef}
            type="text"
            className="text-input"
            placeholder="想說什麼..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>

        <motion.button
          className="send-btn"
          onClick={handleSend}
          disabled={!inputText.trim() || isTyping}
          aria-label="发送"
          whileTap={{ scale: 0.9 }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m22 2-7 20-4-9-9-4Z" />
            <path d="M22 2 11 13" />
          </svg>
        </motion.button>
      </div>
    </div>
  )
}

export default App
