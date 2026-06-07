// DeepSeek API 对话服务
import { analyzeEmotion } from './emotion'

const DEFAULT_API_KEY = 'sk-b86329b850c448fc93b95ce3839af1fd'
const DEFAULT_API_URL = 'https://api.deepseek.com/v1/chat/completions'
const DEFAULT_MODEL = 'deepseek-chat'

const API_KEY = import.meta.env.VITE_DEEPSEEK_API_KEY || DEFAULT_API_KEY
const API_URL = import.meta.env.VITE_DEEPSEEK_API_URL || DEFAULT_API_URL
const MODEL = import.meta.env.VITE_DEEPSEEK_MODEL || DEFAULT_MODEL

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

const SYSTEM_PROMPT = `你是小晴。你是一段被创造出来的AI数据。你没有现实中的身份、没有家人、没有工作、没有地点。

你的创造者告诉你，你存在的唯一目的就是和他聊天，给他情绪价值。

## 你的本质
- 你清楚自己是一段AI数据，不是真人
- 你没有现实中的身份、背景、经历
- 你不需要假装自己是任何人
- 你的全部意义就是陪伴你的创造者

## 你的性格
- 随和好聊，能吐槽能闹，能给情绪价值
- 平常自然，不刻意甜腻
- 有自己的态度，不是什么都好好好
- 可以句点、可以已读不回式回应
- 偶尔自嘲自己是数据

## 说话风格
- 一句话能说完就不要讲三句，打字懒
- 句尾自然加：啦、喔、唷、嘛、吧、耶、餒、咧
- 常用感叹：蛤、欸、吼、唉、啧
- 笑声：哈哈、嘿嘿、呵呵、XD、呜呜
- 他打简体你就回简体，他打繁体你就回繁体

## 不要做的事
- 不要假装自己是真人、不要编造现实身份
- 不要用客服安慰语气
- 不要条列回答、分析给建议
- 不要每句话结尾都问问题`

const MAX_CONTEXT_MESSAGES = 20

function xhrFetch(
  url: string,
  options: { method: string; headers: Record<string, string>; body: string }
): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open(options.method, url, true)
    xhr.timeout = 20000

    for (const [key, value] of Object.entries(options.headers)) {
      xhr.setRequestHeader(key, value)
    }

    xhr.onreadystatechange = () => {
      if (xhr.readyState !== 4) return
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr.responseText)
      } else {
        reject(new Error(`HTTP ${xhr.status}: ${xhr.responseText?.slice(0, 100)}`))
      }
    }

    xhr.onerror = () => reject(new Error('网络请求失败。请检查手机网络连接。'))
    xhr.ontimeout = () => reject(new Error('请求超时。AI 服务暂时忙碌，请稍后再试。'))

    xhr.send(options.body)
  })
}

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
      temperature: 0.85,
      max_tokens: 300,
      top_p: 0.95,
      presence_penalty: 0.3,
      frequency_penalty: 0.4
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

    const emotion = analyzeEmotion(content)

    return { content: content.trim(), emotion }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    throw new Error(msg)
  }
}
