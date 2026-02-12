import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'
import Database from 'better-sqlite3'
import { GroupMemberInfo, MessageType, UnifiedGroup, UnifiedMessage, UnifiedUser } from './types'

// SQLite init --------------------------------------------------------------
const dataDir = join(process.cwd(), '.data')
if (!existsSync(dataDir)) {
  mkdirSync(dataDir)
}

const dbPath = join(dataDir, 'sandbox.db')
const db = new Database(dbPath)

// Schema: keep only ID as required; split private/group message storage
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    userId INTEGER PRIMARY KEY NOT NULL,
    nickname TEXT DEFAULT '',
    age INTEGER DEFAULT 0,
    gender TEXT DEFAULT 'unknown',
    friendList TEXT DEFAULT '[]',
    groupList TEXT DEFAULT '[]',
    isCurrent INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS groups (
    groupId INTEGER PRIMARY KEY NOT NULL,
    groupName TEXT DEFAULT '',
    ownerId INTEGER DEFAULT 0,
    adminList TEXT DEFAULT '[]',
    memberList TEXT DEFAULT '[]',
    muteList TEXT DEFAULT '[]'
  );

  CREATE TABLE IF NOT EXISTS private_messages (
    seq INTEGER PRIMARY KEY AUTOINCREMENT,
    peerId TEXT NOT NULL,
    senderId INTEGER NOT NULL,
    receiverId INTEGER NOT NULL,
    timestamp INTEGER NOT NULL,
    content TEXT NOT NULL,
    isRevoked INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS group_messages (
    seq INTEGER PRIMARY KEY AUTOINCREMENT,
    groupId INTEGER NOT NULL,
    senderId INTEGER NOT NULL,
    timestamp INTEGER NOT NULL,
    content TEXT NOT NULL,
    isRevoked INTEGER DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS idx_private_peer ON private_messages(peerId);
  CREATE INDEX IF NOT EXISTS idx_group_id ON group_messages(groupId);
`)

const parseJSON = <T> (value: string | null, fallback: T): T => {
  try {
    return value ? JSON.parse(value) as T : fallback
  } catch (e) {
    return fallback
  }
}

const serializeContent = (content: MessageType | string) => (typeof content === 'string' ? content : JSON.stringify(content))

export type TargetId = number | 'all' | 'current'

type UserRow = {
  userId: number
  nickname: string
  age: number
  gender: string
  friendList: string
  groupList: string
  isCurrent: number
}

type GroupRow = {
  groupId: number
  groupName: string
  ownerId: number
  adminList: string
  memberList: string
  muteList: string
}

const mapUserRow = (row: UserRow): UnifiedUser => ({
  ...row,
  gender: row.gender === 'male' || row.gender === 'female' ? row.gender : 'unknown',
  friendList: parseJSON<number[]>(row.friendList, []),
  groupList: parseJSON<number[]>(row.groupList, [])
})

const mapGroupRow = (row: GroupRow): UnifiedGroup => ({
  ...row,
  adminList: parseJSON<number[]>(row.adminList, []),
  memberList: parseJSON<GroupMemberInfo[]>(row.memberList, []),
  muteList: parseJSON(row.muteList, [])
})

export const dbService = {
  // -------------------- User --------------------
  getUserInfo: (target: TargetId = 'all'): UnifiedUser | UnifiedUser[] | undefined => {
    if (target === 'all') {
      const rows = db.prepare('SELECT * FROM users ORDER BY rowid ASC').all() as UserRow[]
      return rows.map(mapUserRow)
    }

    const row = (target === 'current'
      ? db.prepare('SELECT * FROM users WHERE isCurrent = 1').get()
      : db.prepare('SELECT * FROM users WHERE userId = ?').get(target)) as UserRow | undefined

    if (!row) return undefined
    return mapUserRow(row)
  },

  setActiveUser: (userId: number) => {
    db.transaction(() => {
      db.prepare('UPDATE users SET isCurrent = 0').run()
      db.prepare('UPDATE users SET isCurrent = 1 WHERE userId = ?').run(userId)
    })()
  },

  saveUser: (user: Partial<UnifiedUser> & { userId: number; isCurrent?: boolean | number }) => {
    db.prepare(`
      INSERT INTO users (userId, nickname, age, gender, friendList, groupList, isCurrent)
      VALUES (:userId, :nickname, :age, :gender, :friendList, :groupList, :isCurrent)
      ON CONFLICT(userId) DO UPDATE SET
        nickname = excluded.nickname,
        age = excluded.age,
        gender = excluded.gender,
        friendList = excluded.friendList,
        groupList = excluded.groupList,
        isCurrent = CASE WHEN excluded.isCurrent = 1 THEN 1 ELSE users.isCurrent END;
    `).run({
      userId: user.userId,
      nickname: user.nickname ?? '',
      age: user.age ?? 0,
      gender: user.gender ?? 'unknown',
      friendList: JSON.stringify(user.friendList ?? []),
      groupList: JSON.stringify(user.groupList ?? []),
      isCurrent: user.isCurrent ? 1 : 0
    })
  },

  removeUser: (userId: number, { clearMessages = false }: { clearMessages?: boolean } = {}) => {
    db.transaction(() => {
      db.prepare('DELETE FROM users WHERE userId = ?').run(userId)
      if (clearMessages) {
        const peerLikeA = `${userId}:%`
        const peerLikeB = `%:${userId}`
        db.prepare('DELETE FROM private_messages WHERE peerId LIKE ? OR peerId LIKE ?').run(peerLikeA, peerLikeB)
        db.prepare('DELETE FROM group_messages WHERE senderId = ?').run(userId)
      }
    })()
  },

  updateFriendship: (userAId: number, userBId: number, action: 'add' | 'remove') => {
    const userA = dbService.getUserInfo(userAId) as UnifiedUser | undefined
    const userB = dbService.getUserInfo(userBId) as UnifiedUser | undefined
    if (!userA || !userB) return

    const handleList = (list: number[], peerId: number) => {
      if (action === 'add') return Array.from(new Set([...list, peerId]))
      return list.filter(id => id !== peerId)
    }

    const nextA = handleList(userA.friendList, userBId)
    const nextB = handleList(userB.friendList, userAId)

    db.transaction(() => {
      db.prepare('UPDATE users SET friendList = ? WHERE userId = ?').run(JSON.stringify(nextA), userAId)
      db.prepare('UPDATE users SET friendList = ? WHERE userId = ?').run(JSON.stringify(nextB), userBId)
    })()
  },

  // -------------------- Group --------------------
  getGroupInfo: (target: TargetId = 'all'): UnifiedGroup | UnifiedGroup[] | undefined => {
    if (target === 'all') {
      const rows = db.prepare('SELECT * FROM groups').all() as GroupRow[]
      return rows.map(mapGroupRow)
    }

    const row = (target === 'current'
      ? db.prepare('SELECT * FROM groups LIMIT 1').get()
      : db.prepare('SELECT * FROM groups WHERE groupId = ?').get(target)) as GroupRow | undefined

    if (!row) return undefined
    return mapGroupRow(row)
  },

  saveGroup: (group: Partial<UnifiedGroup> & { groupId: number }) => {
    db.prepare(`
      INSERT INTO groups (groupId, groupName, ownerId, adminList, memberList, muteList)
      VALUES (:groupId, :groupName, :ownerId, :adminList, :memberList, :muteList)
      ON CONFLICT(groupId) DO UPDATE SET
        groupName = excluded.groupName,
        ownerId = excluded.ownerId,
        adminList = excluded.adminList,
        memberList = excluded.memberList,
        muteList = excluded.muteList;
    `).run({
      groupId: group.groupId,
      groupName: group.groupName ?? '',
      ownerId: group.ownerId ?? 0,
      adminList: JSON.stringify(group.adminList ?? []),
      memberList: JSON.stringify(group.memberList ?? []),
      muteList: JSON.stringify(group.muteList ?? [])
    })
  },

  removeGroup: (groupId: number, { clearMessages = true }: { clearMessages?: boolean } = {}) => {
    const group = dbService.getGroupInfo(groupId) as UnifiedGroup | undefined
    if (!group) return

    db.transaction(() => {
      group.memberList.forEach(member => {
        const user = dbService.getUserInfo(member.userId) as UnifiedUser | undefined
        if (user) {
          const next = user.groupList.filter(id => id !== groupId)
          db.prepare('UPDATE users SET groupList = ? WHERE userId = ?').run(JSON.stringify(next), member.userId)
        }
      })
      db.prepare('DELETE FROM groups WHERE groupId = ?').run(groupId)
      if (clearMessages) {
        db.prepare('DELETE FROM group_messages WHERE groupId = ?').run(groupId)
      }
    })()
  },

  upsertGroupMember: (groupId: number, member: GroupMemberInfo) => {
    const group = dbService.getGroupInfo(groupId) as UnifiedGroup | undefined
    if (!group) return
    const existing = group.memberList.filter(m => m.userId !== member.userId)
    const nextList = [...existing, member]
    db.prepare('UPDATE groups SET memberList = ? WHERE groupId = ?').run(JSON.stringify(nextList), groupId)

    const user = dbService.getUserInfo(member.userId) as UnifiedUser | undefined
    if (user) {
      const nextGroups = Array.from(new Set([...(user.groupList || []), groupId]))
      db.prepare('UPDATE users SET groupList = ? WHERE userId = ?').run(JSON.stringify(nextGroups), member.userId)
    }
  },

  removeGroupMember: (groupId: number, userId: number) => {
    const group = dbService.getGroupInfo(groupId) as UnifiedGroup | undefined
    if (!group) return
    const nextList = group.memberList.filter(m => m.userId !== userId)
    db.prepare('UPDATE groups SET memberList = ? WHERE groupId = ?').run(JSON.stringify(nextList), groupId)

    const user = dbService.getUserInfo(userId) as UnifiedUser | undefined
    if (user) {
      const nextGroups = (user.groupList || []).filter(id => id !== groupId)
      db.prepare('UPDATE users SET groupList = ? WHERE userId = ?').run(JSON.stringify(nextGroups), userId)
    }
  },

  // -------------------- Message --------------------
  saveMsg: (msg: Omit<UnifiedMessage, 'seq'>): UnifiedMessage => {
    const payload = { ...msg, isRevoked: msg.isRevoked ?? 0 }

    if (payload.type === 'private') {
      const ids = [payload.senderId, payload.targetId].sort((a, b) => a - b)
      const peerId = `${ids[0]}:${ids[1]}`
      const res = db.prepare(`
        INSERT INTO private_messages (peerId, senderId, receiverId, timestamp, content, isRevoked)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(peerId, payload.senderId, payload.targetId, payload.timestamp, serializeContent(payload.content), payload.isRevoked)

      return { ...payload, seq: res.lastInsertRowid as number, peerId }
    }

    const res = db.prepare(`
      INSERT INTO group_messages (groupId, senderId, timestamp, content, isRevoked)
      VALUES (?, ?, ?, ?, ?)
    `).run(payload.targetId, payload.senderId, payload.timestamp, serializeContent(payload.content), payload.isRevoked)

    return { ...payload, seq: res.lastInsertRowid as number, groupId: payload.targetId }
  },

  getMsg: ({ type, targetId, selfId, limit = 50 }: { type: 'private' | 'group'; targetId: number; selfId?: number; limit?: number }): UnifiedMessage[] => {
    if (type === 'private') {
      if (!selfId) return []
      const ids = [selfId, targetId].sort((a, b) => a - b)
      const peerId = `${ids[0]}:${ids[1]}`
      const rows = db.prepare('SELECT * FROM private_messages WHERE peerId = ? ORDER BY seq DESC LIMIT ?').all(peerId, limit) as any[]

      return rows.reverse().map((row: any) => ({
        seq: row.seq,
        type: 'private',
        senderId: row.senderId,
        targetId,
        peerId: row.peerId,
        content: (() => {
          const parsed = parseJSON<any>(row.content, row.content)
          if (Array.isArray(parsed)) return parsed as MessageType
          return [{ type: 'text', text: String(parsed) }] as MessageType
        })(),
        timestamp: row.timestamp,
        isRevoked: row.isRevoked as 0 | 1
      }))
    }

    const rows = db.prepare('SELECT * FROM group_messages WHERE groupId = ? ORDER BY seq DESC LIMIT ?').all(targetId, limit) as any[]
    return rows.reverse().map((row: any) => ({
      seq: row.seq,
      type: 'group',
      senderId: row.senderId,
      targetId,
      groupId: row.groupId,
      content: (() => {
        const parsed = parseJSON<any>(row.content, row.content)
        if (Array.isArray(parsed)) return parsed as MessageType
        return [{ type: 'text', text: String(parsed) }] as MessageType
      })(),
      timestamp: row.timestamp,
      isRevoked: row.isRevoked as 0 | 1
    }))
  },

  recallMsg: (type: 'private' | 'group', seq: number) => {
    const table = type === 'private' ? 'private_messages' : 'group_messages'
    db.prepare(`UPDATE ${table} SET isRevoked = 1 WHERE seq = ?`).run(seq)
  },

  clearPrivateConversation: (userAId: number, userBId: number) => {
    const ids = [userAId, userBId].sort((a, b) => a - b)
    const peerId = `${ids[0]}:${ids[1]}`
    db.prepare('DELETE FROM private_messages WHERE peerId = ?').run(peerId)
  }
}
