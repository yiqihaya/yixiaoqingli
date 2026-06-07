// 情感分析服务 + Live2D 表情映射
export type Emotion = 'happy' | 'sad' | 'angry' | 'loving' | 'surprised' | 'neutral'

const EMOTION_KEYWORDS: Record<Emotion, string[]> = {
  happy: [
    '哈哈', '嘿嘿', '开心', '好笑', '太棒', '喜欢', '好好笑', '真好', '棒棒', '棒棒的',
    '太好了', 'nice', 'cool', '笑死', '嘻嘻', '呵呵', 'XD', '超好笑', '笑疯了',
    '可爱', '超喜欢', '好开心', '快乐'
  ],
  sad: [
    '呜呜', '难过', 'QQ', '伤心', '哭', '失望', '不开心',
    '烦躁', '担心', '寂寞', '孤单', '想哭', '累了', '好累', '心累',
    '崩溃', '厌世', '好烦', '哭哭', '郁闷', '低落', '悲伤'
  ],
  angry: [
    '吼', '生气', '讨厌', '烦', '够了', '不要', '走开',
    '气死', '靠北', '超烦', '过分', '不爽', '故意的', '火大',
    '怒', '可恶', '欠揍', '闭嘴', '懒得理你'
  ],
  loving: [
    '爱你', '抱抱', '亲亲', '想你', '好想你', '想你了',
    '爱你唷', '宝贝', '要亲亲', '想亲你', '爱你喔',
    '想你啦', '爱你啦', '亲爱的', '抱抱你', '好想你呀'
  ],
  surprised: [
    '真的假的', '什么', '哇', '吓到', '天啊', '居然', '竟然',
    '不会吧', '真假', '夸张', '不敢相信', '傻眼', '天哪',
    '我晕', '不是吧', '怎么可能', '真的吗'
  ],
  neutral: [],
}

const EMOTION_EMOJI: Record<Emotion, string> = {
  happy: '😉',
  sad: '🥺',
  angry: '😫',
  loving: '🥰',
  surprised: '😮',
  neutral: '🐰',
}

// Live2D Haru 模型对应的表情名称映射
const EMOTION_TO_EXPRESSION: Record<Emotion, string | null> = {
  happy: 'f02',       // joyful.exp3.json
  sad: 'f03',         // sad.exp3.json
  angry: 'f00',       // angry.exp3.json
  loving: 'f02',      // joyful.exp3.json (love = joy)
  surprised: 'f04',   // surprised.exp3.json
  neutral: null,      // 无表情 — 恢复默认
}

// 基于关键词的情感分析
export function analyzeEmotion(text: string): Emotion {
  const lower = text.toLowerCase()
  const scores: Record<Emotion, number> = {
    happy: 0,
    sad: 0,
    angry: 0,
    loving: 0,
    surprised: 0,
    neutral: 0,
  }

  for (const [emotion, keywords] of Object.entries(EMOTION_KEYWORDS)) {
    for (const kw of keywords) {
      if (lower.includes(kw)) {
        scores[emotion as Emotion] += 1
      }
    }
  }

  // 取最高分
  let best: Emotion = 'neutral'
  let bestScore = 0

  for (const [emotion, score] of Object.entries(scores)) {
    if (score > bestScore) {
      best = emotion as Emotion
      bestScore = score
    }
  }

  // 如果 neutral 以外的最高分并列，优先非 neutral
  return best
}

// 获取情绪对应的表情符号
export function getEmotionEmoji(emotion: string | Emotion): string {
  return EMOTION_EMOJI[emotion as Emotion] || '🐰'
}

// 获取情绪对应的 Live2D 表情名称（用于 model.expression()）
export function getLive2DExpression(emotion: string | Emotion): string | null {
  return EMOTION_TO_EXPRESSION[emotion as Emotion] ?? null
}

// 情绪历史追踪（简单滑动窗口）
const emotionWindow: Emotion[] = []

export function trackEmotion(emotion: Emotion): void {
  emotionWindow.push(emotion)
  if (emotionWindow.length > 10) emotionWindow.shift()
}

// 获取当前主导情绪
export function getDominantEmotion(): Emotion {
  if (emotionWindow.length === 0) return 'neutral'

  const counts: Partial<Record<Emotion, number>> = {}
  for (const e of emotionWindow) {
    counts[e] = (counts[e] || 0) + 1
  }

  let best: Emotion = 'neutral'
  let bestCount = 0
  for (const [emotion, count] of Object.entries(counts)) {
    if (count > bestCount) {
      best = emotion as Emotion
      bestCount = count
    }
  }

  return best
}
