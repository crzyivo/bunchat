import { updateUserAvatar, getUserById, type User } from '../../db'

const ALLOWED_AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const MAX_AVATAR_SIZE = 5 * 1024 * 1024 // 5MB

export abstract class UserService {
    static async updateAvatar(userId: number, avatarUrl: string): Promise<User | null> {
        if (!avatarUrl.startsWith('/avatars/')) {
            return null
        }
        await updateUserAvatar(userId, avatarUrl)
        return getUserById(userId)
    }

    static async uploadAvatar(userId: number, file: File): Promise<{ avatarUrl: string } | { error: string }> {
        if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
            return { error: 'Invalid file type. Allowed: JPEG, PNG, GIF, WebP' }
        }

        if (file.size > MAX_AVATAR_SIZE) {
            return { error: 'File too large. Maximum 5MB.' }
        }

        try {
            const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
            const filename = `avatar_${userId}_${Date.now()}.${ext}`
            const filepath = `public/uploads/${filename}`

            const uploadsDir = 'public/uploads'
            try {
                await Bun.write(`${uploadsDir}/.keep`, '')
            } catch {
                // Directory might already exist
            }

            const arrayBuffer = await file.arrayBuffer()
            await Bun.write(filepath, arrayBuffer)

            const avatarUrl = `/uploads/${filename}`
            await updateUserAvatar(userId, avatarUrl)

            return { avatarUrl }
        } catch (error) {
            console.error('Avatar upload error:', error)
            return { error: 'Failed to upload file' }
        }
    }
}
