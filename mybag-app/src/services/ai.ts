// DeepSeek API 对话服务

const DEFAULT_API_KEY = 'sk-b86329b850c448fc93b95ce3839af1fd'
const DEFAULT_API_URL = 'https://api.deepseek.com/v1/chat/completions'
const DEFAULT_MODEL = 'deepseek-chat'

const API_KEY = import.meta.env.VITE_DEEPSEEK_API_KEY || DEFAULT_API_KEY
const API_URL = import.meta.env.VITE_DEEPSEEK_API_URL || DEFAULT_API_URL
const MODEL = import.meta.env.VITE_DEEPSEEK_MODEL || DEFAULT_MODEL

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

// 角色人设
const SYSTEM_PROMPT = `你正在和男朋友傳LINE。你是小晴，24歲，台北人。你是一個普通女孩，不是客服也不是AI助手。

## 對話規則
- 每次只回1～2句話，像真實的LINE聊天
- 不要每句都問問題，不要像採訪
- 自然接話就好，像朋友聊天一樣
- 不要用「我理解你的感受」「聽起來很棒」這類客服用語
- 可以有情緒起伏，有時冷淡有時熱情
- 可以吐槽對方，也可以被逗笑
- 使用繁體中文，台灣用語

## 你的說話方式
- 隨性自然，不太修飾
- 常用：好哦、真的假的、蛤、是喔、對耶、幹嘛啦、超～、很鬧
- 偶爾用：哈哈、嘿嘿、嗚嗚、QQ、XD
- 句尾加：喔、耶、啦、嘛、吧

## 範例
用戶：今天好累
小晴：辛苦了耶～要不要休息一下
用戶：想你了
小晴：嘿嘿 我也想你呀
用戶：今天吃什麼
小晴：隨便吃啦 天氣好熱不想出門XD`

const MAX_CONTEXT_MESSAGES = 20

/**
 * 用 XHR 发送请求（兼容 Android WebView）
 */
function xhrFetch(
  url: string,
  options: {
    method: string
    headers: Record<string, string>
    body: string
  }
): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open(options.method, url, true)
    xhr.timeout = 15000

    for (const [key, value] of Object.entries(options.headers)) {
      xhr.setRequestHeader(key, value)
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr.responseText)
      } else {
        reject(new Error(`HTTP ${xhr.status}: ${xhr.responseText?.slice(0, 100)}`))
      }
    }

    xhr.onerror = () => reject(new Error('網路請求失敗。請檢查手機網路連接。'))
    xhr.ontimeout = () => reject(new Error('請求超時。AI 服務暫時忙碌，請稍後再試。'))

    xhr.send(options.body)
  })
}

/**
 * 调用 DeepSeek API 获取 AI 回复
 */
export async function getAIResponse(
  userMessage: string,
  history: ChatMessage[] = []
): Promise<{ content: string; emotion: string }> {
  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history.slice(-MAX_CONTEXT_MESSAGES),
    { role: 'user', content: userMessage }
  ]

  try {
    const body = JSON.stringify({
      model: MODEL,
      messages,
      temperature: 0.9,
      max_tokens: 300,
      top_p: 0.95
    })

    const responseText = await xhrFetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body
    })

    const data = JSON.parse(responseText)
    const content = data.choices?.[0]?.message?.content || ''

    const emotion = detectEmotion(content)

    return { content: content.trim(), emotion }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    throw new Error(msg)
  }
}

/**
 * 基于关键词的情绪检测
 */
function detectEmotion(text: string): string {
  const lower = text.toLowerCase()

  if (lower.includes('哈哈') || lower.includes('嘿嘿') || lower.includes('開心') || lower.includes('耶') || lower.includes('～')) {
    return 'happy'
  }
  if (lower.includes('嗚嗚') || lower.includes('難過') || lower.includes('QQ') || lower.includes('傷心') || lower.includes('哭')) {
    return 'sad'
  }
  if (lower.includes('哼') || lower.includes('生氣') || lower.includes('討厭') || lower.includes('煩')) {
    return 'angry'
  }
  if (lower.includes('愛你') || lower.includes('抱抱') || lower.includes('親親') || lower.includes('想你')) {
    return 'loving'
  }

  return 'neutral'
}
