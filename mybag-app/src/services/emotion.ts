// 情感分析服务

type Emotion = 'happy' | 'sad' | 'angry' | 'loving' | 'neutral'

const EMOTION_KEYWORDS: Record<Emotion, string[]> = {
  happy: [
    '哈哈', '嘿嘿', '開心', '好棒', '耶', '太棒', '讚',
    '喜歡', '好好笑', '真好', '爽', '棒棒', '棒棒噠',
    '太好了', 'nice', 'cool'
  ],
  sad: [
    '嗚嗚', '難過', 'QQ', '傷心', '哭', '失望', '不開心',
    '煩惱', '擔心', '寂寞', '孤單', '想哭', '累了', '好累'
  ],
  angry: [
    '哼', '生氣', '討厭', '煩', '夠了', '不要', '走開',
    '北七', '靠北', '超煩', '過分', '不爽', '故意的'
  ],
  loving: [
    '愛你', '抱抱', '親親', '想你', '好想你', '想你了',
    '愛你喔', '寶貝', '親愛的', '想妳了', '愛你耶',
    '❤', '💕', '🥰', '😘', '寶'
  ],
  neutral: [],
}

const EMOTION_EMOJI: Record<Emotion, string> = {
  happy: '😊',
  sad: '🥺',
  angry: '😤',
  loving: '🥰',
  neutral: '🎀',
}

// 基于关键词的情绪分析
export function analyzeEmotion(text: string): Emotion {
  const lower = text.toLowerCase()
  const scores: Record<Emotion, number> = {
    happy: 0,
    sad: 0,
    angry: 0,
    loving: 0,
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

  return best
}

// 获取情绪对应的表情符号
export function getEmotionEmoji(emotion: string | Emotion): string {
  return EMOTION_EMOJI[emotion as Emotion] || '🎀'
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
