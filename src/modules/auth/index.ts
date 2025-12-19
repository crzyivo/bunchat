import { Elysia } from 'elysia'
import { AuthService } from './service'
import type { User } from '../../db'

export const authPlugin = new Elysia({ name: 'Auth.Plugin' })
    .derive({ as: 'global' }, async ({ cookie }): Promise<{ user: User | null; sessionId: string }> => {
        const sessionId = (cookie?.session?.value as string) || ''
        const user = await AuthService.getUserFromSession(sessionId || undefined)
        return { user, sessionId }
    })

export { AuthService } from './service'
export { AuthModel } from './model'
