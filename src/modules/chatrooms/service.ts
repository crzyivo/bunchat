import {
    createChatRoom,
    getChatRoomById,
    getChatRoomByCode,
    joinRoom,
    leaveRoom,
    isMember,
    getUserRooms,
    updateLastRead,
    getMessages,
    getLatestMessageId,
    type ChatRoom,
} from '../../db'

export abstract class ChatRoomService {
    static create(name: string, creatorId: number): ChatRoom | null {
        if (!name || name.trim().length === 0) {
            return null
        }
        return createChatRoom(name.trim(), creatorId)
    }

    static getByCode(code: string): ChatRoom | null {
        if (!code || code.trim().length === 0) {
            return null
        }
        return getChatRoomByCode(code.trim().toLowerCase())
    }

    static getById(id: number): ChatRoom | null {
        return getChatRoomById(id)
    }

    static join(userId: number, roomId: number): boolean {
        return joinRoom(userId, roomId)
    }

    static leave(userId: number, roomId: number): boolean {
        return leaveRoom(userId, roomId)
    }

    static isMember(userId: number, roomId: number): boolean {
        return isMember(userId, roomId)
    }

    static getUserRooms(userId: number) {
        return getUserRooms(userId)
    }

    static getMessages(roomId: number, limit: number = 20, beforeId?: number) {
        return getMessages(roomId, limit, beforeId)
    }

    static markAsRead(userId: number, roomId: number): void {
        const latestId = getLatestMessageId(roomId)
        if (latestId > 0) {
            updateLastRead(userId, roomId, latestId)
        }
    }
}
