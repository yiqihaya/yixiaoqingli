// 语音识别服务 — 基于浏览器 Web Speech API

// 检查浏览器是否支持语音识别
export function isSTTSupported(): boolean {
  return !!(
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition
  )
}

// 获取支持的语音识别语言
export function getSupportedLanguages(): string[] {
  // Web Speech API 支持的语言，中文排前面
  return [
    'zh-CN',    // 简体中文
    'zh-TW',    // 繁体中文（台湾）
    'zh-HK',    // 繁体中文（香港）
    'en-US',
    'ja-JP',
    'ko-KR',
  ]
}

interface STTOptions {
  lang?: string
  continuous?: boolean
  interimResults?: boolean
  onResult?: (text: string, isFinal: boolean) => void
  onError?: (error: string) => void
  onStart?: () => void
  onEnd?: () => void
}

// 创建语音识别实例
export function createSpeechRecognition(options: STTOptions = {}) {
  const SpeechRecognition =
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition

  if (!SpeechRecognition) {
    throw new Error('浏览器不支持语音识别')
  }

  const recognition = new SpeechRecognition()

  recognition.lang = options.lang || 'zh-TW'
  recognition.continuous = options.continuous ?? false
  recognition.interimResults = options.interimResults ?? true
  recognition.maxAlternatives = 1

  recognition.onresult = (event: any) => {
    let finalText = ''
    let interimText = ''

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i]
      if (result.isFinal) {
        finalText += result[0].transcript
      } else {
        interimText += result[0].transcript
      }
    }

    const text = finalText || interimText
    const isFinal = !!finalText

    options.onResult?.(text, isFinal)
  }

  recognition.onerror = (event: any) => {
    const errors: Record<string, string> = {
      'not-allowed': '请允许麦克风权限',
      'no-speech': '没有检测到语音，请再试一次',
      'audio-capture': '未找到麦克风',
      'network': '网络错误，请检查网络连接',
      'aborted': '语音识别被中断',
      'language-not-supported': '不支持该语言',
      'service-not-allowed': '语音服务不可用',
    }
    const message = errors[event.error] || `语音识别出错：${event.error}`
    options.onError?.(message)
  }

  recognition.onstart = () => options.onStart?.()
  recognition.onend = () => options.onEnd?.()

  return {
    start: () => {
      try {
        recognition.start()
      } catch {
        // 忽略"已经在运行"的错误
      }
    },
    stop: () => {
      try {
        recognition.stop()
      } catch {
        // 忽略
      }
    },
    abort: () => {
      try {
        recognition.abort()
      } catch {
        // 忽略
      }
    },
  }
}

// 简单的一次性语音识别（返回 Promise）
export function listenOnce(
  lang = 'zh-TW',
  timeout = 10000
): Promise<string> {
  return new Promise((resolve, reject) => {
    const recognition = createSpeechRecognition({
      lang,
      continuous: false,
      interimResults: false,
      onResult: (text) => {
        clearTimeout(timer)
        resolve(text)
        recognition.stop()
      },
      onError: (err) => {
        clearTimeout(timer)
        reject(new Error(err))
      },
    })

    const timer = setTimeout(() => {
      recognition.stop()
      reject(new Error('语音识别超时，请重试'))
    }, timeout)

    recognition.start()
  })
}
