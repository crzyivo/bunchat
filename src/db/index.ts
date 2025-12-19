import type { DatabaseAdapter } from './interface'
import { SQLiteAdapter } from './sqlite'
import { MySQLAdapter } from './mysql'

export type {
    User,
    ChatRoom,
    Membership,
    Message,
    Session,
    MessageWithUser,
    RoomWithDetails,
} from './types'

export type { DatabaseAdapter } from './interface'

// Database type selection via environment variable
// DB_TYPE: 'sqlite' (default) or 'mysql'
const DB_TYPE = Bun.env.DB_TYPE || 'sqlite'

let adapter: DatabaseAdapter

if (DB_TYPE === 'mysql') {
    const mysqlAdapter = new MySQLAdapter({
        host: Bun.env.MYSQL_HOST || 'localhost',
        port: parseInt(Bun.env.MYSQL_PORT || '3306', 10),
        user: Bun.env.MYSQL_USER || 'root',
        password: Bun.env.MYSQL_PASSWORD || '',
        database: Bun.env.MYSQL_DATABASE || 'bunchat',
    })
    // Initialize MySQL schema
    mysqlAdapter.initSchema().catch(console.error)
    adapter = mysqlAdapter
    console.log('🐬 Using MySQL database')
} else {
    adapter = new SQLiteAdapter(Bun.env.DATABASE_PATH || 'chat.db')
    console.log('📦 Using SQLite database')
}

// Export the adapter instance
export { adapter }

// User functions
export async function createUser(username: string, passwordHash: string, avatarUrl: string) {
    return adapter.createUser(username, passwordHash, avatarUrl)
}

export async function getUserByUsername(username: string) {
    return adapter.getUserByUsername(username)
}

export async function getUserById(id: number) {
    return adapter.getUserById(id)
}

export async function updateUserPassword(userId: number, passwordHash: string) {
    return adapter.updateUserPassword(userId, passwordHash)
}

export async function updateUserAvatar(userId: number, avatarUrl: string) {
    return adapter.updateUserAvatar(userId, avatarUrl)
}

// Session functions
export async function createSession(userId: number) {
    return adapter.createSession(userId)
}

export async function getSession(sessionId: string) {
    return adapter.getSession(sessionId)
}

export async function deleteSession(sessionId: string) {
    return adapter.deleteSession(sessionId)
}

export async function cleanExpiredSessions() {
    return adapter.cleanExpiredSessions()
}

// ChatRoom functions
export async function createChatRoom(name: string, creatorId: number) {
    return adapter.createChatRoom(name, creatorId)
}

export async function getChatRoomById(id: number) {
    return adapter.getChatRoomById(id)
}

export async function getChatRoomByCode(code: string) {
    return adapter.getChatRoomByCode(code)
}

// Membership functions
export async function joinRoom(userId: number, roomId: number) {
    return adapter.joinRoom(userId, roomId)
}

export async function leaveRoom(userId: number, roomId: number) {
    return adapter.leaveRoom(userId, roomId)
}

export async function isMember(userId: number, roomId: number) {
    return adapter.isMember(userId, roomId)
}

export async function getUserRooms(userId: number) {
    return adapter.getUserRooms(userId)
}

export async function updateLastRead(userId: number, roomId: number, messageId: number) {
    return adapter.updateLastRead(userId, roomId, messageId)
}

export async function getRoomMembers(roomId: number) {
    return adapter.getRoomMembers(roomId)
}

// Message functions
export async function createMessage(roomId: number, userId: number, content: string) {
    return adapter.createMessage(roomId, userId, content)
}

export async function getMessages(roomId: number, limit: number = 20, beforeId?: number) {
    return adapter.getMessages(roomId, limit, beforeId)
}

export async function getLatestMessageId(roomId: number) {
    return adapter.getLatestMessageId(roomId)
}
