// 语音合成服务 — 基于浏览器 Web Speech Synthesis

// 检查浏览器是否支持语音合成
export function isTTSSupported(): boolean {
  return !!window.speechSynthesis
}

// 获取可用的台湾中文语音
export function getTaiwanVoice(): SpeechSynthesisVoice | null {
  if (!isTTSSupported()) return null

  const voices = window.speechSynthesis.getVoices()

  // 按优先级查找台湾中文语音
  const zhTW = voices.find(v => v.lang === 'zh-TW')

  if (zhTW) return zhTW

  // 备选：香港中文
  const zhHK = voices.find(v => v.lang === 'zh-HK')

  if (zhHK) return zhHK

  // 再备选：任何中文语音
  const zhCN = voices.find(v => v.lang.startsWith('zh'))

  if (zhCN) return zhCN

  return voices[0] || null
}

interface TTSOptions {
  voice?: SpeechSynthesisVoice | null
  rate?: number
  pitch?: number
  volume?: number
  onStart?: () => void
  onEnd?: () => void
  onError?: (error: string) => void
}

// 朗读文本
export function speak(text: string, options: TTSOptions = {}): {
  cancel: () => void
  pause: () => void
  resume: () => void
} {
  if (!isTTSSupported()) {
    options.onError?.('浏览器不支持语音合成')
    return { cancel: () => {}, pause: () => {}, resume: () => {} }
  }

  // 清理过长的文本（防止播放太久）
  const maxLength = 200
  const trimmedText = text.length > maxLength
    ? text.slice(0, maxLength) + '...'
    : text

  // 取消当前正在播放的语音
  window.speechSynthesis.cancel()

  const utterance = new SpeechSynthesisUtterance(trimmedText)

  // 设置语音
  const voice = options.voice ?? getTaiwanVoice()

  if (voice) utterance.voice = voice

  // 语速（台湾腔稍慢更自然）
  utterance.rate = options.rate ?? 0.95

  // 音高（稍高一点听起来更可爱）
  utterance.pitch = options.pitch ?? 1.1

  // 音量
  utterance.volume = options.volume ?? 1.0

  utterance.onstart = () => options.onStart?.()
  utterance.onend = () => options.onEnd?.()
  utterance.onerror = (event) => {
    if (event.error !== 'canceled' && event.error !== 'interrupted') {
      options.onError?.(`语音合成出错：${event.error}`)
    }
  }

  window.speechSynthesis.speak(utterance)

  return {
    cancel: () => window.speechSynthesis.cancel(),
    pause: () => window.speechSynthesis.pause(),
    resume: () => window.speechSynthesis.resume(),
  }
}

// 预加载语音列表（Chrome 需要异步获取）
export function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (!isTTSSupported()) {
      resolve([])
      return
    }

    const voices = window.speechSynthesis.getVoices()

    if (voices.length > 0) {
      resolve(voices)
      return
    }

    // Chrome 需要监听 voiceschanged 事件
    window.speechSynthesis.onvoiceschanged = () => {
      resolve(window.speechSynthesis.getVoices())
    }
  })
}
