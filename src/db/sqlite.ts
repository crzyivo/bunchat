import { Database } from "bun:sqlite";
import type { DatabaseAdapter } from './interface'
import type {
    User,
    ChatRoom,
    Session,
    Message,
    MessageWithUser,
    RoomWithDetails,
} from './types'

const SESSION_EXPIRY_DAYS = parseInt(Bun.env.SESSION_EXPIRY_DAYS || "7", 10);

const adjectives = ["swift", "bright", "calm", "dark", "eager", "fair", "glad", "happy", "keen", "lively"];
const nouns = ["river", "mountain", "forest", "ocean", "valley", "meadow", "canyon", "island", "desert", "glacier"];

function generateJoinCode(): string {
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    const num = Math.floor(Math.random() * 100);
    return `${adj}-${noun}-${num}`;
}

export class SQLiteAdapter implements DatabaseAdapter {
    private db: Database;

    constructor(dbPath: string = "chat.db") {
        this.db = new Database(dbPath);
        this.initSchema();
    }

    private initSchema(): void {
        this.db.run(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                avatar_url TEXT DEFAULT '/avatars/default1.svg',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        this.db.run(`
            CREATE TABLE IF NOT EXISTS chatrooms (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                join_code TEXT UNIQUE NOT NULL,
                creator_id INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (creator_id) REFERENCES users(id)
            )
        `);

        this.db.run(`
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

        this.db.run(`
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

        this.db.run(`
            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL,
                expires_at DATETIME NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        `);

        this.db.run(`CREATE INDEX IF NOT EXISTS idx_messages_room ON messages(room_id, created_at DESC)`);
        this.db.run(`CREATE INDEX IF NOT EXISTS idx_memberships_user ON memberships(user_id)`);
        this.db.run(`CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at)`);
    }

    // User functions
    async createUser(username: string, passwordHash: string, avatarUrl: string): Promise<User | null> {
        try {
            const stmt = this.db.prepare(
                "INSERT INTO users (username, password_hash, avatar_url) VALUES (?, ?, ?) RETURNING *"
            );
            return stmt.get(username, passwordHash, avatarUrl) as User;
        } catch {
            return null;
        }
    }

    async getUserByUsername(username: string): Promise<User | null> {
        const stmt = this.db.prepare("SELECT * FROM users WHERE username = ?");
        return stmt.get(username) as User | null;
    }

    async getUserById(id: number): Promise<User | null> {
        const stmt = this.db.prepare("SELECT * FROM users WHERE id = ?");
        return stmt.get(id) as User | null;
    }

    async updateUserPassword(userId: number, passwordHash: string): Promise<boolean> {
        const stmt = this.db.prepare("UPDATE users SET password_hash = ? WHERE id = ?");
        const result = stmt.run(passwordHash, userId);
        return result.changes > 0;
    }

    async updateUserAvatar(userId: number, avatarUrl: string): Promise<boolean> {
        const stmt = this.db.prepare("UPDATE users SET avatar_url = ? WHERE id = ?");
        const result = stmt.run(avatarUrl, userId);
        return result.changes > 0;
    }

    // Session functions
    async createSession(userId: number): Promise<string> {
        const sessionId = crypto.randomUUID();
        const expiresAt = new Date(Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();
        const stmt = this.db.prepare("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)");
        stmt.run(sessionId, userId, expiresAt);
        return sessionId;
    }

    async getSession(sessionId: string): Promise<Session | null> {
        const stmt = this.db.prepare("SELECT * FROM sessions WHERE id = ? AND expires_at > datetime('now')");
        return stmt.get(sessionId) as Session | null;
    }

    async deleteSession(sessionId: string): Promise<void> {
        const stmt = this.db.prepare("DELETE FROM sessions WHERE id = ?");
        stmt.run(sessionId);
    }

    async cleanExpiredSessions(): Promise<void> {
        const stmt = this.db.prepare("DELETE FROM sessions WHERE expires_at <= datetime('now')");
        stmt.run();
    }

    // ChatRoom functions
    async createChatRoom(name: string, creatorId: number): Promise<ChatRoom | null> {
        try {
            let joinCode = generateJoinCode();
            while (await this.getChatRoomByCode(joinCode)) {
                joinCode = generateJoinCode();
            }
            const stmt = this.db.prepare(
                "INSERT INTO chatrooms (name, join_code, creator_id) VALUES (?, ?, ?) RETURNING *"
            );
            const room = stmt.get(name, joinCode, creatorId) as ChatRoom;
            await this.joinRoom(creatorId, room.id);
            return room;
        } catch {
            return null;
        }
    }

    async getChatRoomById(id: number): Promise<ChatRoom | null> {
        const stmt = this.db.prepare("SELECT * FROM chatrooms WHERE id = ?");
        return stmt.get(id) as ChatRoom | null;
    }

    async getChatRoomByCode(code: string): Promise<ChatRoom | null> {
        const stmt = this.db.prepare("SELECT * FROM chatrooms WHERE join_code = ?");
        return stmt.get(code) as ChatRoom | null;
    }

    // Membership functions
    async joinRoom(userId: number, roomId: number): Promise<boolean> {
        try {
            const stmt = this.db.prepare("INSERT INTO memberships (user_id, room_id) VALUES (?, ?)");
            stmt.run(userId, roomId);
            return true;
        } catch {
            return false;
        }
    }

    async leaveRoom(userId: number, roomId: number): Promise<boolean> {
        const stmt = this.db.prepare("DELETE FROM memberships WHERE user_id = ? AND room_id = ?");
        const result = stmt.run(userId, roomId);
        return result.changes > 0;
    }

    async isMember(userId: number, roomId: number): Promise<boolean> {
        const stmt = this.db.prepare("SELECT 1 FROM memberships WHERE user_id = ? AND room_id = ?");
        return stmt.get(userId, roomId) !== null;
    }

    async getUserRooms(userId: number): Promise<RoomWithDetails[]> {
        const stmt = this.db.prepare(`
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
        return stmt.all(userId, userId) as RoomWithDetails[];
    }

    async updateLastRead(userId: number, roomId: number, messageId: number): Promise<void> {
        const stmt = this.db.prepare("UPDATE memberships SET last_read_message_id = ? WHERE user_id = ? AND room_id = ?");
        stmt.run(messageId, userId, roomId);
    }

    async getRoomMembers(roomId: number): Promise<number[]> {
        const stmt = this.db.prepare("SELECT user_id FROM memberships WHERE room_id = ?");
        const rows = stmt.all(roomId) as { user_id: number }[];
        return rows.map(r => r.user_id);
    }

    // Message functions
    async createMessage(roomId: number, userId: number, content: string): Promise<Message | null> {
        try {
            const stmt = this.db.prepare(
                "INSERT INTO messages (room_id, user_id, content) VALUES (?, ?, ?) RETURNING *"
            );
            return stmt.get(roomId, userId, content) as Message;
        } catch {
            return null;
        }
    }

    async getMessages(roomId: number, limit: number = 20, beforeId?: number): Promise<MessageWithUser[]> {
        if (beforeId) {
            const stmt = this.db.prepare(`
                SELECT m.*, u.username, u.avatar_url 
                FROM messages m 
                JOIN users u ON m.user_id = u.id 
                WHERE m.room_id = ? AND m.id < ?
                ORDER BY m.created_at DESC LIMIT ?
            `);
            const messages = stmt.all(roomId, beforeId, limit) as MessageWithUser[];
            return messages.reverse();
        } else {
            const stmt = this.db.prepare(`
                SELECT m.*, u.username, u.avatar_url 
                FROM messages m 
                JOIN users u ON m.user_id = u.id 
                WHERE m.room_id = ?
                ORDER BY m.created_at DESC LIMIT ?
            `);
            const messages = stmt.all(roomId, limit) as MessageWithUser[];
            return messages.reverse();
        }
    }

    async getLatestMessageId(roomId: number): Promise<number> {
        const stmt = this.db.prepare("SELECT MAX(id) as max_id FROM messages WHERE room_id = ?");
        const result = stmt.get(roomId) as { max_id: number | null };
        return result.max_id || 0;
    }

    async close(): Promise<void> {
        this.db.close();
    }
}
