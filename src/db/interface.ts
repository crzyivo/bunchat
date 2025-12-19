import type {
    User,
    ChatRoom,
    Session,
    Message,
    MessageWithUser,
    RoomWithDetails,
} from './types'

export interface DatabaseAdapter {
    // User functions
    createUser(username: string, passwordHash: string, avatarUrl: string): Promise<User | null>;
    getUserByUsername(username: string): Promise<User | null>;
    getUserById(id: number): Promise<User | null>;
    updateUserPassword(userId: number, passwordHash: string): Promise<boolean>;
    updateUserAvatar(userId: number, avatarUrl: string): Promise<boolean>;

    // Session functions
    createSession(userId: number): Promise<string>;
    getSession(sessionId: string): Promise<Session | null>;
    deleteSession(sessionId: string): Promise<void>;
    cleanExpiredSessions(): Promise<void>;

    // ChatRoom functions
    createChatRoom(name: string, creatorId: number): Promise<ChatRoom | null>;
    getChatRoomById(id: number): Promise<ChatRoom | null>;
    getChatRoomByCode(code: string): Promise<ChatRoom | null>;

    // Membership functions
    joinRoom(userId: number, roomId: number): Promise<boolean>;
    leaveRoom(userId: number, roomId: number): Promise<boolean>;
    isMember(userId: number, roomId: number): Promise<boolean>;
    getUserRooms(userId: number): Promise<RoomWithDetails[]>;
    updateLastRead(userId: number, roomId: number, messageId: number): Promise<void>;
    getRoomMembers(roomId: number): Promise<number[]>;

    // Message functions
    createMessage(roomId: number, userId: number, content: string): Promise<Message | null>;
    getMessages(roomId: number, limit?: number, beforeId?: number): Promise<MessageWithUser[]>;
    getLatestMessageId(roomId: number): Promise<number>;

    // Lifecycle
    close(): Promise<void>;
}
