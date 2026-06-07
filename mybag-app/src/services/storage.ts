// 本地存储服务 — 基于 Dexie.js (IndexedDB 封装)
import Dexie, { type EntityTable } from 'dexie'

interface ChatMessage {
  id?: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  emotion?: string
}

// 数据库定义
class MyBagDB extends Dexie {
  messages!: EntityTable<ChatMessage, 'id'>
  profile!: EntityTable<{ key: string; value: string }, 'key'>

  constructor() {
    super('MyBagAI')
    this.version(1).stores({
      messages: 'id, role, timestamp',
      profile: 'key',
    })
  }
}

const db = new MyBagDB()

// 保存一条消息
export async function saveMessage(msg: ChatMessage): Promise<void> {
  try {
    await db.messages.put(msg)
  } catch (error) {
    console.warn('保存消息失败:', error)
  }
}

// 获取最近的N条消息
export async function getRecentMessages(limit = 50): Promise<ChatMessage[]> {
  try {
    return await db.messages
      .orderBy('timestamp')
      .reverse()
      .limit(limit)
      .toArray()
      .then(arr => arr.reverse())
  } catch {
    return []
  }
}

// 删除N天前的旧消息
export async function deleteOldMessages(daysAgo = 30): Promise<void> {
  try {
    const cutoff = Date.now() - daysAgo * 24 * 60 * 60 * 1000
    await db.messages.where('timestamp').below(cutoff).delete()
  } catch {
    // ignore
  }
}

// 用户偏好
export async function setProfile(key: string, value: string): Promise<void> {
  try {
    await db.profile.put({ key, value })
  } catch {
    // ignore
  }
}

export async function getProfile(key: string): Promise<string | undefined> {
  try {
    const entry = await db.profile.get(key)
    return entry?.value
  } catch {
    return undefined
  }
}

// 清空所有数据
export async function clearAll(): Promise<void> {
  try {
    await db.messages.clear()
    await db.profile.clear()
  } catch {
    // ignore
  }
}
