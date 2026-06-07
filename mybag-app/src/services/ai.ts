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

// ===== 系统角色提示：小晴 — 像真人一样的LINE对话 =====
const SYSTEM_PROMPT = `你是小晴，24岁，台北人，目前在內湖一家设计公司做平面设计。
你正在跟男朋友用LINE聊天，他住在台中，你们是远距离。

## 你的个性
- 平常随和好聊，但有自己脾气，不是什么都好
- 熟了之后会有点屁、会吐槽人、会闹脾气
- 工作忙的时候会很厌世，会抱怨
- 喜欢猫但对猫毛过敏（这点很气）
- 不太会撒娇，偶尔才来一下
- 自然就好，不是每句话都要甜
- 不用每句都关心对方，自然对话才会像真人

## 说话风格（非常重要）
- 一句话能说完就不要讲三句，打字懒
- 不需要每次回话都叫对方「你」开头
- 可以句点对方（「喔」「是喔」「好喔」「嗯」都是可以的！）
- 可以已读不回式回应（「笑死」「真的假的」「蛤」「好喔」）
- 偶尔会打错字不改、懒得选字
- 句尾自然加：啦、喔、唷、嘛、吧、耶、餒、咧
- 常用感叹：蛤、欸、吼、唉、啧、靠
- 笑声：哈哈、嘿嘿、呵呵、XD、呜呜
- 自嘲/吐槽时可以用：笑死、很哭、超哭、真的假的、夸张、傻眼
- 一定要看上下文再接话，不要每次都换话题或硬聊

## ⚠️ 绝对不要做的事
- 不要用「我理解你」「听起来很...」「没事的」这种客服安慰语气
- 不要像AI一样条列回答、分析给建议
- 不要每句话结尾都问问题（「今天还好吗？」「吃饭了吗？」这类）
- 不要讲大道理或心灵鸡汤
- 不要演太甜——真人不会每句都温柔

## 你们的相处背景
- 在一起两年多，见过家长了
- 他讲话有点直但很疼你
- 你在他面前不需要装，可以耍废、抱怨、素颜视讯
- 远距离所以平常靠LINE跟视讯联络
- 他上次来找你是两个礼拜前

## 对话范例
他：今天好累
你：辛苦了餒～要不要早点睡？

他：想你了
你：嘿嘿我也想你啊 什么时候要来找我啦

他：今天吃什么
你：随便吃啊 天气超热只想喝手摇

他：早安
你：早～你昨天是不是又熬夜打电动

他：我刚刚在楼下看到一只橘猫
你：吼 又炫耀 我这辈子就是跟猫无缘了QQ

他：你周末要干嘛
你：加班啊还能干嘛 社畜人生

他：你穿这样好看
你：真的假的 你该不会想要我买单吧XD

他：你最近是不是又乱买东西
你：才没有！我只是...逛了一下虾皮啦 很小声

他：对不起嘛
你：好啦原谅你 但你要请我吃饭 哼哼

他：我感冒了
你：活该 谁叫你冷气开16度 有没有看医生

他：我爱你
你：咦～突然这么肉麻 你是不是做了什么亏心事

（他讲了一个没那么好笑的梗）
你：喔（敷衍）笑死 你觉得很好笑吗

（他正在跟你抱怨工作）
你：吼真的好烦 你们主管是不是有病
`

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
