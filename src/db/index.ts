import { Database } from "bun:sqlite";

const db = new Database(Bun.env.DATABASE_PATH || "chat.db");

// Initialize database schema
db.run(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    avatar_url TEXT DEFAULT '/avatars/default1.svg',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS chatrooms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    join_code TEXT UNIQUE NOT NULL,
    creator_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (creator_id) REFERENCES users(id)
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS memberships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    room_id INTEGER NOT NULL,
    last_read_message_id INTEGER DEFAULT 0,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (room_id) REFERENCES chatrooms(id),
    UNIQUE(user_id, room_id)
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (room_id) REFERENCES chatrooms(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    expires_at DATETIME NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`);

// Create indexes for performance
db.run(`CREATE INDEX IF NOT EXISTS idx_messages_room ON messages(room_id, created_at DESC)`);
db.run(`CREATE INDEX IF NOT EXISTS idx_memberships_user ON memberships(user_id)`);
db.run(`CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at)`);

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

// User functions
export function createUser(username: string, passwordHash: string, avatarUrl: string): User | null {
    try {
        const stmt = db.prepare(
            "INSERT INTO users (username, password_hash, avatar_url) VALUES (?, ?, ?) RETURNING *"
        );
        return stmt.get(username, passwordHash, avatarUrl) as User;
    } catch {
        return null;
    }
}

export function getUserByUsername(username: string): User | null {
    const stmt = db.prepare("SELECT * FROM users WHERE username = ?");
    return stmt.get(username) as User | null;
}

export function getUserById(id: number): User | null {
    const stmt = db.prepare("SELECT * FROM users WHERE id = ?");
    return stmt.get(id) as User | null;
}

export function updateUserPassword(userId: number, passwordHash: string): boolean {
    const stmt = db.prepare("UPDATE users SET password_hash = ? WHERE id = ?");
    const result = stmt.run(passwordHash, userId);
    return result.changes > 0;
}

export function updateUserAvatar(userId: number, avatarUrl: string): boolean {
    const stmt = db.prepare("UPDATE users SET avatar_url = ? WHERE id = ?");
    const result = stmt.run(avatarUrl, userId);
    return result.changes > 0;
}

// Session functions
const SESSION_EXPIRY_DAYS = parseInt(Bun.env.SESSION_EXPIRY_DAYS || "7", 10);

export function createSession(userId: number): string {
    const sessionId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const stmt = db.prepare("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)");
    stmt.run(sessionId, userId, expiresAt);
    return sessionId;
}

export function getSession(sessionId: string): Session | null {
    const stmt = db.prepare("SELECT * FROM sessions WHERE id = ? AND expires_at > datetime('now')");
    return stmt.get(sessionId) as Session | null;
}

export function deleteSession(sessionId: string): void {
    const stmt = db.prepare("DELETE FROM sessions WHERE id = ?");
    stmt.run(sessionId);
}

export function cleanExpiredSessions(): void {
    const stmt = db.prepare("DELETE FROM sessions WHERE expires_at <= datetime('now')");
    stmt.run();
}

// ChatRoom functions
const adjectives = ["swift", "bright", "calm", "dark", "eager", "fair", "glad", "happy", "keen", "lively"];
const nouns = ["river", "mountain", "forest", "ocean", "valley", "meadow", "canyon", "island", "desert", "glacier"];

export function generateJoinCode(): string {
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    const num = Math.floor(Math.random() * 100);
    return `${adj}-${noun}-${num}`;
}

export function createChatRoom(name: string, creatorId: number): ChatRoom | null {
    try {
        let joinCode = generateJoinCode();
        // Ensure unique join code
        while (getChatRoomByCode(joinCode)) {
            joinCode = generateJoinCode();
        }
        const stmt = db.prepare(
            "INSERT INTO chatrooms (name, join_code, creator_id) VALUES (?, ?, ?) RETURNING *"
        );
        const room = stmt.get(name, joinCode, creatorId) as ChatRoom;
        // Auto-join creator to the room
        joinRoom(creatorId, room.id);
        return room;
    } catch {
        return null;
    }
}

export function getChatRoomById(id: number): ChatRoom | null {
    const stmt = db.prepare("SELECT * FROM chatrooms WHERE id = ?");
    return stmt.get(id) as ChatRoom | null;
}

export function getChatRoomByCode(code: string): ChatRoom | null {
    const stmt = db.prepare("SELECT * FROM chatrooms WHERE join_code = ?");
    return stmt.get(code) as ChatRoom | null;
}

// Membership functions
export function joinRoom(userId: number, roomId: number): boolean {
    try {
        const stmt = db.prepare("INSERT INTO memberships (user_id, room_id) VALUES (?, ?)");
        stmt.run(userId, roomId);
        return true;
    } catch {
        return false; // Already a member
    }
}

export function leaveRoom(userId: number, roomId: number): boolean {
    const stmt = db.prepare("DELETE FROM memberships WHERE user_id = ? AND room_id = ?");
    const result = stmt.run(userId, roomId);
    return result.changes > 0;
}

export function isMember(userId: number, roomId: number): boolean {
    const stmt = db.prepare("SELECT 1 FROM memberships WHERE user_id = ? AND room_id = ?");
    return stmt.get(userId, roomId) !== null;
}

export function getUserRooms(userId: number): (ChatRoom & { last_message?: string; last_message_time?: string; unread_count: number })[] {
    const stmt = db.prepare(`
    SELECT 
      c.*,
      (SELECT content FROM messages WHERE room_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message,
      (SELECT created_at FROM messages WHERE room_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_time,
      (SELECT COUNT(*) FROM messages WHERE room_id = c.id AND id > COALESCE(m.last_read_message_id, 0) AND user_id != ?) as unread_count
    FROM chatrooms c
    JOIN memberships m ON c.id = m.room_id
    WHERE m.user_id = ?
    ORDER BY last_message_time DESC NULLS LAST, c.created_at DESC
  `);
    return stmt.all(userId, userId) as (ChatRoom & { last_message?: string; last_message_time?: string; unread_count: number })[];
}

export function updateLastRead(userId: number, roomId: number, messageId: number): void {
    const stmt = db.prepare("UPDATE memberships SET last_read_message_id = ? WHERE user_id = ? AND room_id = ?");
    stmt.run(messageId, userId, roomId);
}

export function getRoomMembers(roomId: number): number[] {
    const stmt = db.prepare("SELECT user_id FROM memberships WHERE room_id = ?");
    const rows = stmt.all(roomId) as { user_id: number }[];
    return rows.map(r => r.user_id);
}

// Message functions
export function createMessage(roomId: number, userId: number, content: string): Message | null {
    try {
        const stmt = db.prepare(
            "INSERT INTO messages (room_id, user_id, content) VALUES (?, ?, ?) RETURNING *"
        );
        return stmt.get(roomId, userId, content) as Message;
    } catch {
        return null;
    }
}

export function getMessages(roomId: number, limit: number = 20, beforeId?: number): (Message & { username: string; avatar_url: string })[] {
    if (beforeId) {
        const stmt = db.prepare(`
            SELECT m.*, u.username, u.avatar_url 
            FROM messages m 
            JOIN users u ON m.user_id = u.id 
            WHERE m.room_id = ? AND m.id < ?
            ORDER BY m.created_at DESC LIMIT ?
        `);
        const messages = stmt.all(roomId, beforeId, limit) as (Message & { username: string; avatar_url: string })[];
        return messages.reverse();
    } else {
        const stmt = db.prepare(`
            SELECT m.*, u.username, u.avatar_url 
            FROM messages m 
            JOIN users u ON m.user_id = u.id 
            WHERE m.room_id = ?
            ORDER BY m.created_at DESC LIMIT ?
        `);
        const messages = stmt.all(roomId, limit) as (Message & { username: string; avatar_url: string })[];
        return messages.reverse();
    }
}

export function getLatestMessageId(roomId: number): number {
    const stmt = db.prepare("SELECT MAX(id) as max_id FROM messages WHERE room_id = ?");
    const result = stmt.get(roomId) as { max_id: number | null };
    return result.max_id || 0;
}

export default db;
