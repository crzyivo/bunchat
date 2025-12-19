import {
    getUserById,
    getSession,
    isMember,
    createMessage,
    updateLastRead,
    getRoomMembers,
    type User,
    type Message,
} from '../../db'

export abstract class MessageService {
    static async getUserFromSession(sessionId: string): Promise<User | null> {
        const session = await getSession(sessionId)
        if (!session) return null
        return getUserById(session.user_id)
    }

    static async isMember(userId: number, roomId: number): Promise<boolean> {
        return isMember(userId, roomId)
    }

    static async createMessage(roomId: number, userId: number, content: string): Promise<Message | null> {
        const trimmed = content.trim()
        if (trimmed.length === 0) return null
        return createMessage(roomId, userId, trimmed)
    }

    static async markAsRead(userId: number, roomId: number, messageId: number): Promise<void> {
        await updateLastRead(userId, roomId, messageId)
    }

    static async getRoomMembers(roomId: number): Promise<number[]> {
        return getRoomMembers(roomId)
    }
}
