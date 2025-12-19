import {
    createUser,
    getUserByUsername,
    getUserById,
    updateUserPassword,
    createSession,
    getSession,
    deleteSession,
    type User,
} from '../../db'
import type { LoginBody, RegisterBody, ChangePasswordBody } from './model'

export abstract class AuthService {
    static async login({ username, password }: LoginBody): Promise<{ user: User; sessionId: string } | { error: string }> {
        const user = await getUserByUsername(username)
        if (!user) {
            return { error: 'Invalid username or password' }
        }

        const valid = await Bun.password.verify(password, user.password_hash)
        if (!valid) {
            return { error: 'Invalid username or password' }
        }

        const sessionId = await createSession(user.id)
        return { user, sessionId }
    }

    static async register({ username, password, confirmPassword }: RegisterBody): Promise<{ user: User; sessionId: string } | { error: string }> {
        if (password !== confirmPassword) {
            return { error: 'Passwords do not match' }
        }

        if (username.length < 3 || username.length > 20) {
            return { error: 'Username must be 3-20 characters' }
        }

        if (password.length < 6) {
            return { error: 'Password must be at least 6 characters' }
        }

        const passwordHash = await Bun.password.hash(password, { algorithm: 'argon2id' })
        const avatarNum = Math.floor(Math.random() * 5) + 1
        const avatarUrl = `/avatars/default${avatarNum}.svg`

        const user = await createUser(username, passwordHash, avatarUrl)
        if (!user) {
            return { error: 'Username already taken' }
        }

        const sessionId = await createSession(user.id)
        return { user, sessionId }
    }

    static async changePassword(
        userId: number,
        currentHash: string,
        { currentPassword, newPassword, confirmPassword }: ChangePasswordBody
    ): Promise<{ success: true } | { error: string }> {
        const valid = await Bun.password.verify(currentPassword, currentHash)
        if (!valid) {
            return { error: 'Current password is incorrect' }
        }

        if (newPassword !== confirmPassword) {
            return { error: 'New passwords do not match' }
        }

        if (newPassword.length < 6) {
            return { error: 'Password must be at least 6 characters' }
        }

        const passwordHash = await Bun.password.hash(newPassword, { algorithm: 'argon2id' })
        await updateUserPassword(userId, passwordHash)
        return { success: true }
    }

    static async logout(sessionId: string): Promise<void> {
        await deleteSession(sessionId)
    }

    static async getUserFromSession(sessionId: string | undefined): Promise<User | null> {
        if (!sessionId) return null
        const session = await getSession(sessionId)
        if (!session) return null
        return getUserById(session.user_id)
    }
}
