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
    static async create(name: string, creatorId: number): Promise<ChatRoom | null> {
        if (!name || name.trim().length === 0) {
            return null
        }
        return createChatRoom(name.trim(), creatorId)
    }

    static async getByCode(code: string): Promise<ChatRoom | null> {
        if (!code || code.trim().length === 0) {
            return null
        }
        return getChatRoomByCode(code.trim().toLowerCase())
    }

    static async getById(id: number): Promise<ChatRoom | null> {
        return getChatRoomById(id)
    }

    static async join(userId: number, roomId: number): Promise<boolean> {
        return joinRoom(userId, roomId)
    }

    static async leave(userId: number, roomId: number): Promise<boolean> {
        return leaveRoom(userId, roomId)
    }

    static async isMember(userId: number, roomId: number): Promise<boolean> {
        return isMember(userId, roomId)
    }

    static async getUserRooms(userId: number) {
        return getUserRooms(userId)
    }

    static async getMessages(roomId: number, limit: number = 20, beforeId?: number) {
        return getMessages(roomId, limit, beforeId)
    }

    static async markAsRead(userId: number, roomId: number): Promise<void> {
        const latestId = await getLatestMessageId(roomId)
        if (latestId > 0) {
            await updateLastRead(userId, roomId, latestId)
        }
    }
}
