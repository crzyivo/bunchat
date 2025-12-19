import mysql from 'mysql2/promise'
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

export class MySQLAdapter implements DatabaseAdapter {
    private pool: mysql.Pool;

    constructor(config: {
        host: string;
        port: number;
        user: string;
        password: string;
        database: string;
    }) {
        this.pool = mysql.createPool({
            host: config.host,
            port: config.port,
            user: config.user,
            password: config.password,
            database: config.database,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0,
        });
    }

    async initSchema(): Promise<void> {
        const conn = await this.pool.getConnection();
        try {
            await conn.query(`
                CREATE TABLE IF NOT EXISTS users (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    username VARCHAR(255) UNIQUE NOT NULL,
                    password_hash VARCHAR(255) NOT NULL,
                    avatar_url VARCHAR(255) DEFAULT '/avatars/default1.svg',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);

            await conn.query(`
                CREATE TABLE IF NOT EXISTS chatrooms (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    join_code VARCHAR(255) UNIQUE NOT NULL,
                    creator_id INT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (creator_id) REFERENCES users(id)
                )
            `);

            await conn.query(`
                CREATE TABLE IF NOT EXISTS memberships (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NOT NULL,
                    room_id INT NOT NULL,
                    last_read_message_id INT DEFAULT 0,
                    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id),
                    FOREIGN KEY (room_id) REFERENCES chatrooms(id),
                    UNIQUE KEY unique_membership (user_id, room_id)
                )
            `);

            await conn.query(`
                CREATE TABLE IF NOT EXISTS messages (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    room_id INT NOT NULL,
                    user_id INT NOT NULL,
                    content TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (room_id) REFERENCES chatrooms(id),
                    FOREIGN KEY (user_id) REFERENCES users(id),
                    INDEX idx_messages_room (room_id, created_at DESC)
                )
            `);

            await conn.query(`
                CREATE TABLE IF NOT EXISTS sessions (
                    id VARCHAR(36) PRIMARY KEY,
                    user_id INT NOT NULL,
                    expires_at DATETIME NOT NULL,
                    FOREIGN KEY (user_id) REFERENCES users(id),
                    INDEX idx_sessions_expires (expires_at)
                )
            `);
        } finally {
            conn.release();
        }
    }

    // User functions
    async createUser(username: string, passwordHash: string, avatarUrl: string): Promise<User | null> {
        try {
            const [result] = await this.pool.query(
                "INSERT INTO users (username, password_hash, avatar_url) VALUES (?, ?, ?)",
                [username, passwordHash, avatarUrl]
            );
            const insertId = (result as mysql.ResultSetHeader).insertId;
            const [users] = await this.pool.query("SELECT * FROM users WHERE id = ?", [insertId]);
            return (users as User[])[0] || null;
        } catch {
            return null;
        }
    }

    async getUserByUsername(username: string): Promise<User | null> {
        const [rows] = await this.pool.query("SELECT * FROM users WHERE username = ?", [username]);
        return (rows as User[])[0] || null;
    }

    async getUserById(id: number): Promise<User | null> {
        const [rows] = await this.pool.query("SELECT * FROM users WHERE id = ?", [id]);
        return (rows as User[])[0] || null;
    }

    async updateUserPassword(userId: number, passwordHash: string): Promise<boolean> {
        const [result] = await this.pool.query("UPDATE users SET password_hash = ? WHERE id = ?", [passwordHash, userId]);
        return (result as mysql.ResultSetHeader).affectedRows > 0;
    }

    async updateUserAvatar(userId: number, avatarUrl: string): Promise<boolean> {
        const [result] = await this.pool.query("UPDATE users SET avatar_url = ? WHERE id = ?", [avatarUrl, userId]);
        return (result as mysql.ResultSetHeader).affectedRows > 0;
    }

    // Session functions
    async createSession(userId: number): Promise<string> {
        const sessionId = crypto.randomUUID();
        const expiresAt = new Date(Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
        await this.pool.query("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)", [sessionId, userId, expiresAt]);
        return sessionId;
    }

    async getSession(sessionId: string): Promise<Session | null> {
        const [rows] = await this.pool.query("SELECT * FROM sessions WHERE id = ? AND expires_at > NOW()", [sessionId]);
        return (rows as Session[])[0] || null;
    }

    async deleteSession(sessionId: string): Promise<void> {
        await this.pool.query("DELETE FROM sessions WHERE id = ?", [sessionId]);
    }

    async cleanExpiredSessions(): Promise<void> {
        await this.pool.query("DELETE FROM sessions WHERE expires_at <= NOW()");
    }

    // ChatRoom functions
    async createChatRoom(name: string, creatorId: number): Promise<ChatRoom | null> {
        try {
            let joinCode = generateJoinCode();
            while (await this.getChatRoomByCode(joinCode)) {
                joinCode = generateJoinCode();
            }

            const [result] = await this.pool.query(
                "INSERT INTO chatrooms (name, join_code, creator_id) VALUES (?, ?, ?)",
                [name, joinCode, creatorId]
            );
            const insertId = (result as mysql.ResultSetHeader).insertId;
            const [rooms] = await this.pool.query("SELECT * FROM chatrooms WHERE id = ?", [insertId]);
            const room = (rooms as ChatRoom[])[0] || null;

            if (room) {
                await this.joinRoom(creatorId, room.id);
            }
            return room;
        } catch {
            return null;
        }
    }

    async getChatRoomById(id: number): Promise<ChatRoom | null> {
        const [rows] = await this.pool.query("SELECT * FROM chatrooms WHERE id = ?", [id]);
        return (rows as ChatRoom[])[0] || null;
    }

    async getChatRoomByCode(code: string): Promise<ChatRoom | null> {
        const [rows] = await this.pool.query("SELECT * FROM chatrooms WHERE join_code = ?", [code]);
        return (rows as ChatRoom[])[0] || null;
    }

    // Membership functions
    async joinRoom(userId: number, roomId: number): Promise<boolean> {
        try {
            await this.pool.query("INSERT INTO memberships (user_id, room_id) VALUES (?, ?)", [userId, roomId]);
            return true;
        } catch {
            return false;
        }
    }

    async leaveRoom(userId: number, roomId: number): Promise<boolean> {
        const [result] = await this.pool.query("DELETE FROM memberships WHERE user_id = ? AND room_id = ?", [userId, roomId]);
        return (result as mysql.ResultSetHeader).affectedRows > 0;
    }

    async isMember(userId: number, roomId: number): Promise<boolean> {
        const [rows] = await this.pool.query("SELECT 1 FROM memberships WHERE user_id = ? AND room_id = ?", [userId, roomId]);
        return (rows as any[]).length > 0;
    }

    async getUserRooms(userId: number): Promise<RoomWithDetails[]> {
        const [rows] = await this.pool.query(`
            SELECT 
                c.*,
                (SELECT content FROM messages WHERE room_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message,
                (SELECT created_at FROM messages WHERE room_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_time,
                (SELECT COUNT(*) FROM messages WHERE room_id = c.id AND id > COALESCE(m.last_read_message_id, 0) AND user_id != ?) as unread_count
            FROM chatrooms c
            JOIN memberships m ON c.id = m.room_id
            WHERE m.user_id = ?
            ORDER BY last_message_time DESC, c.created_at DESC
        `, [userId, userId]);
        return rows as RoomWithDetails[];
    }

    async updateLastRead(userId: number, roomId: number, messageId: number): Promise<void> {
        await this.pool.query("UPDATE memberships SET last_read_message_id = ? WHERE user_id = ? AND room_id = ?", [messageId, userId, roomId]);
    }

    async getRoomMembers(roomId: number): Promise<number[]> {
        const [rows] = await this.pool.query("SELECT user_id FROM memberships WHERE room_id = ?", [roomId]);
        return (rows as { user_id: number }[]).map(r => r.user_id);
    }

    // Message functions
    async createMessage(roomId: number, userId: number, content: string): Promise<Message | null> {
        try {
            const [result] = await this.pool.query(
                "INSERT INTO messages (room_id, user_id, content) VALUES (?, ?, ?)",
                [roomId, userId, content]
            );
            const insertId = (result as mysql.ResultSetHeader).insertId;
            const [messages] = await this.pool.query("SELECT * FROM messages WHERE id = ?", [insertId]);
            return (messages as Message[])[0] || null;
        } catch {
            return null;
        }
    }

    async getMessages(roomId: number, limit: number = 20, beforeId?: number): Promise<MessageWithUser[]> {
        if (beforeId) {
            const [rows] = await this.pool.query(`
                SELECT m.*, u.username, u.avatar_url 
                FROM messages m 
                JOIN users u ON m.user_id = u.id 
                WHERE m.room_id = ? AND m.id < ?
                ORDER BY m.created_at DESC LIMIT ?
            `, [roomId, beforeId, limit]);
            return (rows as MessageWithUser[]).reverse();
        } else {
            const [rows] = await this.pool.query(`
                SELECT m.*, u.username, u.avatar_url 
                FROM messages m 
                JOIN users u ON m.user_id = u.id 
                WHERE m.room_id = ?
                ORDER BY m.created_at DESC LIMIT ?
            `, [roomId, limit]);
            return (rows as MessageWithUser[]).reverse();
        }
    }

    async getLatestMessageId(roomId: number): Promise<number> {
        const [rows] = await this.pool.query("SELECT MAX(id) as max_id FROM messages WHERE room_id = ?", [roomId]);
        return (rows as { max_id: number | null }[])[0]?.max_id || 0;
    }

    async close(): Promise<void> {
        await this.pool.end();
    }
}
