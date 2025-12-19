export interface User {
    id: number;
    username: string;
    password_hash: string;
    avatar_url: string;
    created_at: string;
}

export interface ChatRoom {
    id: number;
    name: string;
    join_code: string;
    creator_id: number;
    created_at: string;
}

export interface Membership {
    id: number;
    user_id: number;
    room_id: number;
    last_read_message_id: number;
    joined_at: string;
}

export interface Message {
    id: number;
    room_id: number;
    user_id: number;
    content: string;
    created_at: string;
}

export interface Session {
    id: string;
    user_id: number;
    expires_at: string;
}

export interface MessageWithUser extends Message {
    username: string;
    avatar_url: string;
}

export interface RoomWithDetails extends ChatRoom {
    last_message?: string;
    last_message_time?: string;
    unread_count: number;
}
