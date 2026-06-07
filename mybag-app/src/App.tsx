import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import Live2DCanvas from './components/Live2DCanvas'
import type { Live2DCanvasHandle } from './components/Live2DCanvas'
import { getAIResponse } from './services/ai'
import { createSpeechRecognition } from './services/stt'
import { speak, isTTSSupported } from './services/tts'
import { saveMessage, getRecentMessages, deleteOldMessages } from './services/storage'
import { getEmotionEmoji, getLive2DExpression, type Emotion } from './services/emotion'
import './App.css'

// 优先使用本地模型（打包在APK内），如果不存在则回退到CDN
const LIVE2D_MODEL_URL =
  new URL('./live2d-models/haru_greeter_t03.model3.json', import.meta.url).href

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  emotion?: string
}

// AI 说话时触发 Live2D 动作
function triggerLive2DTalk(ref: React.RefObject<Live2DCanvasHandle | null>) {
  try { ref.current?.playMotion('tap_body') } catch { /* ignore */ }
}

function App() {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputText, setInputText] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const [autoSpeak, setAutoSpeak] = useState(false) // 是否自动朗读
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const live2dRef = useRef<Live2DCanvasHandle>(null)
  const recognitionRef = useRef<ReturnType<typeof createSpeechRecognition> | null>(null)
  const expressionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 初始化：加载历史消息
  useEffect(() => {
    const loadHistory = async () => {
      const history = await getRecentMessages(50)
      if (history.length > 0) {
        setMessages(history.map(m => ({
          id: m.id!,
          role: m.role as 'user' | 'assistant',
          content: m.content,
          timestamp: m.timestamp,
          emotion: m.emotion,
        })))
      } else {
        // 首次使用，显示欢迎语
        const welcomeMsg: Message = {
          id: 'welcome',
          role: 'assistant',
          content: '嗨～你來啦！我等你好久了耶～今天過得怎麼樣呀？',
          timestamp: Date.now(),
          emotion: 'loving',
        }
        setMessages([welcomeMsg])
        saveMessage({
          id: welcomeMsg.id,
          role: 'assistant',
          content: welcomeMsg.content,
          timestamp: welcomeMsg.timestamp,
          emotion: 'loving',
        })
      }
    }
    loadHistory()
    deleteOldMessages(30) // 保留最近30天
  }, [])

  // 自动滚动
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  // 当前 AI 表情（取最后一条 AI 消息的 emotion）
  const currentEmotion = useMemo(() => {
    const lastAi = messages.filter(m => m.role === 'assistant' && m.emotion).slice(-1)[0]
    return (lastAi?.emotion as Emotion) || 'neutral'
  }, [messages])

  // 情绪变化时驱动 Live2D 表情
  const setLive2DExpression = useCallback((emotion: Emotion) => {
    const exprName = getLive2DExpression(emotion)
    try {
      if (exprName) {
        live2dRef.current?.setExpression(exprName)
      } else {
        live2dRef.current?.setExpression('')
      }
    } catch { }

    if (expressionTimerRef.current) {
      clearTimeout(expressionTimerRef.current)
      expressionTimerRef.current = null
    }

    if (emotion !== 'neutral') {
      expressionTimerRef.current = setTimeout(() => {
        try { live2dRef.current?.setExpression('') } catch { }
      }, 3000)
    }
  }, [])

  // 监听 currentEmotion
  useEffect(() => {
    setLive2DExpression(currentEmotion)
  }, [currentEmotion, setLive2DExpression])

  // 清理定时器
  useEffect(() => {
    return () => {
      if (expressionTimerRef.current) clearTimeout(expressionTimerRef.current)
    }
  }, [])

  // 点击头像区域触发 Live2D 互动
  const handleAvatarClick = useCallback(() => {
    try { live2dRef.current?.playMotion('tap_body') } catch { }
    const emotions = ['happy', 'loving', 'surprised']
    const randEmotion = emotions[Math.floor(Math.random() * emotions.length)]
    setLive2DExpression(randEmotion as Emotion)
    setTimeout(() => setLive2DExpression('neutral'), 3000)
  }, [])

  // 发送消息
  const handleSend = async () => {
    if (!inputText.trim() || isTyping) return

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputText.trim(),
      timestamp: Date.now(),
    }

    setMessages(prev => [...prev, userMsg])
    setInputText('')
    setIsTyping(true)
    triggerLive2DTalk(live2dRef)

    // 保存用户消息
    saveMessage({
      id: userMsg.id,
      role: 'user',
      content: userMsg.content,
      timestamp: userMsg.timestamp,
    })

    try {
      const history = messages
        .filter(m => m.id !== 'welcome')
        .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))

      const { content, emotion } = await getAIResponse(userMsg.content, history)

      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content,
        timestamp: Date.now(),
        emotion,
      }

      setMessages(prev => [...prev, aiMsg])
      triggerLive2DTalk(live2dRef)

      // 保存 AI 消息
      saveMessage({
        id: aiMsg.id,
        role: 'assistant',
        content: aiMsg.content,
        timestamp: aiMsg.timestamp,
        emotion,
      })

      // 自动朗读
      if (autoSpeak && isTTSSupported()) {
        setTimeout(() => speak(aiMsg.content), 300)
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error)
      console.error('AI error:', errMsg)
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '嗚嗚…剛剛網路怪怪的，你再說一次好不好？(' + errMsg.slice(0, 30) + ')',
        timestamp: Date.now(),
        emotion: 'sad',
      }
      setMessages(prev => [...prev, errorMsg])
    } finally {
      setIsTyping(false)
      triggerLive2DTalk(live2dRef)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // ===== 语音识别 =====
  const handleVoiceStart = () => {
    if (recognitionRef.current) return
    setIsRecording(true)

    try {
      const rec = createSpeechRecognition({
        lang: 'zh-TW',
        continuous: false,
        interimResults: false,
        onResult: (text) => {
          setInputText(text)
          setIsRecording(false)
          recognitionRef.current = null
          // 自动发送
          setTimeout(() => {
            inputRef.current?.focus()
            if (text.trim()) handleSend()
          }, 300)
        },
        onError: (err) => {
          console.warn('语音识别:', err)
          setIsRecording(false)
          recognitionRef.current = null
        },
        onEnd: () => {
          setIsRecording(false)
          recognitionRef.current = null
        },
      })
      recognitionRef.current = rec
      rec.start()
    } catch {
      setIsRecording(false)
      recognitionRef.current = null
      // 降级：直接输入文字提示
      setInputText('（語音不可用，請打字輸入喔～）')
    }
  }

  const handleVoiceEnd = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
    setIsRecording(false)
  }


  return (
    <div className="app-container">
      {/* Live2D 头像区域 */}
      <div className="avatar-area" onClick={handleAvatarClick}>
        <div className={`live2d-wrapper emotion-${currentEmotion}`}>
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
          <p className="avatar-name">
            小晴 {getEmotionEmoji(currentEmotion)}
          </p>
          <p className="avatar-status">
            {isTyping ? '輸入中...' : isRecording ? '聽你說話...' : '在線 · 等你聊天'}
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
                  <div className="message-avatar">{getEmotionEmoji(msg.emotion || 'neutral')}</div>
                )}
                <div className={`message-bubble ${msg.role === 'user' ? 'bubble-user' : 'bubble-ai'}`}>
                  <p>{msg.content}</p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* AI 打字指示器 */}
          {isTyping && (
            <motion.div className="message-row message-ai" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
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
        {/* 语音按钮 */}
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
            placeholder={isRecording ? '听你說話中...' : '想說什麼...'}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>

        {/* 自动朗读开关 */}
        <motion.button
          className={`tts-toggle ${autoSpeak ? 'tts-on' : ''}`}
          onClick={() => setAutoSpeak(!autoSpeak)}
          whileTap={{ scale: 0.9 }}
          aria-label={autoSpeak ? '关闭朗读' : '开启朗读'}
          title={autoSpeak ? '关闭自动朗读' : '开启自动朗读'}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 5 6 9H2v6h4l5 4V5Z" />
            {autoSpeak && (
              <>
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
              </>
            )}
          </svg>
        </motion.button>

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
