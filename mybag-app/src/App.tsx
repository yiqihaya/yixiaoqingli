import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import { AnimatePresence, motion } from "framer-motion"
import Live2DCanvas from "./components/Live2DCanvas"
import type { Live2DCanvasHandle } from "./components/Live2DCanvas"
import { getAIResponse } from "./services/ai"
import { createSpeechRecognition } from "./services/stt"
import { speak, isTTSSupported, loadVoices } from "./services/tts"
import { saveMessage, getRecentMessages, deleteOldMessages } from "./services/storage"
import { getEmotionEmoji, getLive2DExpression, type Emotion } from "./services/emotion"
import "./App.css"

const LIVE2D_MODEL_URL =
  new URL("./live2d-models/haru_greeter_t03.model3.json", import.meta.url).href

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: number
  emotion?: string
}

function triggerLive2DTalk(ref: React.RefObject<Live2DCanvasHandle | null>) {
  try { ref.current?.playMotion("tap_body") } catch { /* ignore */ }
}

function App() {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputText, setInputText] = useState("")
  const [isRecording, setIsRecording] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const [autoSpeak, setAutoSpeak] = useState(true)
  const inputRef = useRef<HTMLInputElement>(null)
  const live2dRef = useRef<Live2DCanvasHandle>(null)
  const recognitionRef = useRef<ReturnType<typeof createSpeechRecognition> | null>(null)
  const expressionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [voiceBanner, setVoiceBanner] = useState<string | null>(null)
  const [ttsReady, setTtsReady] = useState(false)
  const [ttsInitErr, setTtsInitErr] = useState<string | null>(null)

  // 加载历史
  useEffect(() => {
    const loadHistory = async () => {
      const history = await getRecentMessages(50)
      if (history.length > 0) {
        setMessages(history.map(m => ({
          id: m.id!,
          role: m.role as "user" | "assistant",
          content: m.content,
          timestamp: m.timestamp,
          emotion: m.emotion,
        })))
      } else {
        const welcomeMsg: Message = {
          id: "welcome",
          role: "assistant",
          content: "喂～你来啦！我等你很久了耶～今天过得怎么样？",
          timestamp: Date.now(),
          emotion: "loving",
        }
        setMessages([welcomeMsg])
        saveMessage({ id: welcomeMsg.id, role: "assistant", content: welcomeMsg.content, timestamp: welcomeMsg.timestamp, emotion: "loving" })
      }
    }
    loadHistory()
    deleteOldMessages(30)
  }, [])

  // 预加载 TTS 语音列表
  useEffect(() => {
    const initTTS = async () => {
      const voices = await loadVoices()
      if (voices.length === 0) {
        setTtsReady(false)
        setTtsInitErr('未检测到语音引擎，无法朗读')
        return
      }
      const hasZh = voices.some(v => v.lang && v.lang.startsWith('zh'))
      if (!hasZh) {
        setTtsInitErr('未找到中文语音，可能会用默认语音朗读')
      }
      setTtsReady(true)
    }
    initTTS()
  }, [])

  // 当前情绪
  const currentEmotion = useMemo(() => {
    const lastAi = messages.filter(m => m.role === "assistant" && m.emotion).slice(-1)[0]
    return (lastAi?.emotion as Emotion) || "neutral"
  }, [messages])

  // Live2D 表情驱动
  const setLive2DExpression = useCallback((emotion: Emotion) => {
    const exprName = getLive2DExpression(emotion)
    try { live2dRef.current?.setExpression(exprName || "") } catch { }
    if (expressionTimerRef.current) { clearTimeout(expressionTimerRef.current); expressionTimerRef.current = null }
    if (emotion !== "neutral") {
      expressionTimerRef.current = setTimeout(() => {
        try { live2dRef.current?.setExpression("") } catch { }
      }, 3000)
    }
  }, [])

  useEffect(() => { setLive2DExpression(currentEmotion) }, [currentEmotion, setLive2DExpression])
  useEffect(() => { return () => { if (expressionTimerRef.current) clearTimeout(expressionTimerRef.current) } }, [])

  // 点击头像互动
  const handleAvatarClick = useCallback(() => {
    try { live2dRef.current?.playMotion("tap_body") } catch { }
    const emotions: Emotion[] = ["happy", "loving", "surprised"]
    const rand = emotions[Math.floor(Math.random() * emotions.length)]
    setLive2DExpression(rand)
    setTimeout(() => setLive2DExpression("neutral"), 3000)
  }, [])

  // 发送消息
  const handleSend = async () => {
    if (!inputText.trim() || isTyping) return
    const userMsg: Message = { id: Date.now().toString(), role: "user", content: inputText.trim(), timestamp: Date.now() }
    setMessages(prev => [...prev, userMsg])
    setInputText("")
    setIsTyping(true)
    triggerLive2DTalk(live2dRef)
    saveMessage({ id: userMsg.id, role: "user", content: userMsg.content, timestamp: userMsg.timestamp })

    try {
      const history = messages.filter(m => m.id !== "welcome").map(m => ({ role: m.role as "user" | "assistant", content: m.content }))
      const { content, emotion } = await getAIResponse(userMsg.content, history)
      const aiMsg: Message = { id: (Date.now() + 1).toString(), role: "assistant", content, timestamp: Date.now(), emotion }
      setMessages(prev => [...prev, aiMsg])
      triggerLive2DTalk(live2dRef)
      saveMessage({ id: aiMsg.id, role: "assistant", content: aiMsg.content, timestamp: aiMsg.timestamp, emotion })
      if (autoSpeak && ttsReady) {
        speak(aiMsg.content, { onError: (err) => { console.warn("TTS:", err); setVoiceBanner(err.slice(0, 50)) } })
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error)
      console.error("AI error:", errMsg)
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: "assistant", content: "呜呜……网络怪怪的，你再说一次好不好？(" + errMsg.slice(0, 30) + ")", timestamp: Date.now(), emotion: "sad" }])
    } finally {
      setIsTyping(false)
      triggerLive2DTalk(live2dRef)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend() } }

  const handleVoiceStart = () => {
    if (recognitionRef.current) return
    setIsRecording(true)
    try {
      const rec = createSpeechRecognition({
        lang: "zh-TW", continuous: false, interimResults: false,
        onResult: (text) => { setInputText(text); setIsRecording(false); recognitionRef.current = null; setTimeout(() => { inputRef.current?.focus(); if (text.trim()) handleSend() }, 300) },
        onError: (err) => { console.warn("语音识别:", err); setVoiceBanner(err); setIsRecording(false); recognitionRef.current = null },
        onEnd: () => { setIsRecording(false); recognitionRef.current = null },
      })
      recognitionRef.current = rec
      rec.start()
    } catch {
      setIsRecording(false); recognitionRef.current = null
      setVoiceBanner("语音识别不可用（需Google服务，国内手机可能不支持）")
    }
  }

  const handleVoiceEnd = () => { if (recognitionRef.current) { recognitionRef.current.stop(); recognitionRef.current = null } setIsRecording(false) }

  // 气泡数据：取最新用户消息 + 最新AI消息
  const lastUserMsg = useMemo(() => messages.filter(m => m.role === "user").slice(-1)[0], [messages])
  const lastAiMsg = useMemo(() => messages.filter(m => m.role === "assistant").slice(-1)[0], [messages])

  return (
    <div className="app-container">
      {/* 语音横幅 */}
      <AnimatePresence>
        {(voiceBanner || ttsInitErr) && (
          <motion.div className="voice-banner" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} onClick={() => { setVoiceBanner(null); setTtsInitErr(null) }}>
            <span>{voiceBanner || ttsInitErr}</span>
            <button className="voice-banner-close" onClick={(e) => { e.stopPropagation(); setVoiceBanner(null); setTtsInitErr(null) }}>&times;</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 主区域：圆形头像 + 浮动气泡 */}
      <div className="avatar-stage">
        {/* AI 气泡 (左侧) */}
        <div className="bubble-zone bubble-zone-left">
          <AnimatePresence mode="wait">
            {isTyping ? (
              <motion.div key="typing" className="chat-bubble chat-bubble-ai" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
                <span className="typing-dot-bubble" /><span className="typing-dot-bubble" /><span className="typing-dot-bubble" />
              </motion.div>
            ) : lastAiMsg ? (
              <motion.div key={lastAiMsg.id} className="chat-bubble chat-bubble-ai" initial={{ opacity: 0, x: -20, scale: 0.9 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: -10 }}>
                <p>{lastAiMsg.content}</p>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        {/* 圆形头像 */}
        <motion.div
          className="avatar-circle-wrapper"
          onClick={handleAvatarClick}
          animate={isTyping ? { x: [0, -2, 2, -1, 1, 0], y: [0, 1, -1, 0.5, -0.5, 0] } : { x: 0, y: 0 }}
          transition={isTyping ? { repeat: Infinity, duration: 0.5, ease: "easeInOut" } : {}}
        >
          <div className={`avatar-circle emotion-${currentEmotion}`}>
            <Live2DCanvas ref={live2dRef} modelUrl={LIVE2D_MODEL_URL} width={320} height={320} autoMotion={true} circular={true} />
          </div>
          <div className="avatar-circle-glow" />
        </motion.div>

        {/* 用户气泡 (右侧) */}
        <div className="bubble-zone bubble-zone-right">
          <AnimatePresence mode="wait">
            {lastUserMsg && (
              <motion.div key={lastUserMsg.id} className="chat-bubble chat-bubble-user" initial={{ opacity: 0, x: 20, scale: 0.9 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: 10 }}>
                <p>{lastUserMsg.content}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* 状态文字 */}
      <div className="avatar-status-bar">
        <p className="avatar-name">小晴 {getEmotionEmoji(currentEmotion)}</p>
        <p className="avatar-status-text">{isTyping ? "输入中.." : isRecording ? "听你说话.." : "在线 · 等你聊天"}</p>
      </div>

      {/* 输入栏 */}
      <div className="input-bar glass safe-bottom">
        <motion.button className={`voice-btn ${isRecording ? "voice-btn-active" : ""}`} aria-label="语音输入"
          onMouseDown={handleVoiceStart} onMouseUp={handleVoiceEnd} onMouseLeave={handleVoiceEnd}
          onTouchStart={handleVoiceStart} onTouchEnd={handleVoiceEnd} whileTap={{ scale: 0.9 }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
        </motion.button>
        <div className="input-wrapper">
          <input ref={inputRef} type="text" className="text-input" placeholder={isRecording ? "听你说话.." : "想说什么.."} value={inputText} onChange={(e) => setInputText(e.target.value)} onKeyDown={handleKeyDown} />
        </div>
        <motion.button className={`tts-toggle ${autoSpeak ? "tts-on" : ""}`} onClick={() => setAutoSpeak(!autoSpeak)} whileTap={{ scale: 0.9 }} aria-label={autoSpeak ? "关闭朗读" : "开启朗读"}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5 6 9H2v6h4l5 4V5Z"/>{autoSpeak && (<><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></>)}</svg>
        </motion.button>
        <motion.button className="send-btn" onClick={handleSend} disabled={!inputText.trim() || isTyping} aria-label="发送" whileTap={{ scale: 0.9 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
        </motion.button>
      </div>
    </div>
  )
}

export default App
