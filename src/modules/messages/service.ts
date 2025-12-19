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
    static getUserFromSession(sessionId: string): User | null {
        const session = getSession(sessionId)
        if (!session) return null
        return getUserById(session.user_id)
    }

    static isMember(userId: number, roomId: number): boolean {
        return isMember(userId, roomId)
    }

    static createMessage(roomId: number, userId: number, content: string): Message | null {
        const trimmed = content.trim()
        if (trimmed.length === 0) return null
        return createMessage(roomId, userId, trimmed)
    }

    static markAsRead(userId: number, roomId: number, messageId: number): void {
        updateLastRead(userId, roomId, messageId)
    }

    static getRoomMembers(roomId: number): number[] {
        return getRoomMembers(roomId)
    }
}
