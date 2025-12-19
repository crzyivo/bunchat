import { Elysia } from 'elysia'
import Html from '@kitajs/html'
import { authPlugin, AuthService } from '../auth'
import { UserService } from './service'
import { getUserById } from '../../db'
import Layout from '../../views/layout'
import LoginPage from '../../views/login'
import RegisterPage from '../../views/register'
import ProfilePage from '../../views/profile'

const ensureSessionCookie = (cookie: Record<string, any>) => {
    const sessionCookie = cookie?.session
    if (!sessionCookie) {
        throw new Error('Session cookie is not configured. Did you enable the session plugin?')
    }
    return sessionCookie
}

export const usersController = new Elysia({ name: 'Users.Controller' })
    .use(authPlugin)

    // ============ AUTH ROUTES ============

    .get('/login', ({ user, redirect }) => {
        if (user) return redirect('/')
        return (
            <Layout title="Login">
                <LoginPage />
            </Layout>
        )
    })

    .post('/login', async ({ body, cookie, redirect }) => {
        const { username, password } = body as { username: string; password: string }
        const result = await AuthService.login({ username, password })

        if ('error' in result) {
            return (
                <Layout title="Login">
                    <LoginPage error={result.error} />
                </Layout>
            )
        }

        ensureSessionCookie(cookie).set({
            value: result.sessionId,
            httpOnly: true,
            maxAge: 7 * 24 * 60 * 60,
            path: '/',
        })

        return redirect('/')
    })

    .get('/register', ({ user, redirect }) => {
        if (user) return redirect('/')
        return (
            <Layout title="Register">
                <RegisterPage />
            </Layout>
        )
    })

    .post('/register', async ({ body, cookie, redirect }) => {
        const { username, password, confirmPassword } = body as {
            username: string
            password: string
            confirmPassword: string
        }

        const result = await AuthService.register({ username, password, confirmPassword })

        if ('error' in result) {
            return (
                <Layout title="Register">
                    <RegisterPage error={result.error} />
                </Layout>
            )
        }

        ensureSessionCookie(cookie).set({
            value: result.sessionId,
            httpOnly: true,
            maxAge: 7 * 24 * 60 * 60,
            path: '/',
        })

        return redirect('/')
    })

    .get('/logout', async ({ cookie, redirect, sessionId }) => {
        if (sessionId) {
            await AuthService.logout(sessionId)
            ensureSessionCookie(cookie).remove()
        }
        return redirect('/login')
    })

    // ============ PROFILE ============

    .get('/profile', ({ user, redirect, sessionId }) => {
        if (!user) return redirect('/login')
        return (
            <Layout title="Profile">
                <ProfilePage user={user} sessionId={sessionId} />
            </Layout>
        )
    })

    .post('/profile/password', async ({ user, body, redirect, sessionId }) => {
        if (!user) return redirect('/login')

        const { currentPassword, newPassword, confirmPassword } = body as {
            currentPassword: string
            newPassword: string
            confirmPassword: string
        }

        const result = await AuthService.changePassword(user.id, user.password_hash, {
            currentPassword,
            newPassword,
            confirmPassword,
        })

        if ('error' in result) {
            return (
                <Layout title="Profile">
                    <ProfilePage user={user} error={result.error} sessionId={sessionId} />
                </Layout>
            )
        }

        return (
            <Layout title="Profile">
                <ProfilePage user={user} success="Password updated successfully" sessionId={sessionId} />
            </Layout>
        )
    })

    // API endpoint for avatar update
    .post('/api/profile/avatar', async ({ user, body }) => {
        if (!user) {
            return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 })
        }

        const { avatar } = body as { avatar: string }
        const updatedUser = await UserService.updateAvatar(user.id, avatar)

        if (!updatedUser) {
            return Response.json({ success: false, error: 'Invalid avatar' }, { status: 400 })
        }

        return Response.json({
            success: true,
            message: 'Avatar updated successfully',
            avatar_url: updatedUser.avatar_url,
        })
    })

    // API endpoint for avatar file upload
    .post('/api/profile/avatar/upload', async ({ user, body }) => {
        if (!user) {
            return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 })
        }

        const formData = body as { avatar?: File }
        const file = formData.avatar

        if (!file || !(file instanceof File)) {
            return Response.json({ success: false, error: 'No file provided' }, { status: 400 })
        }

        const result = await UserService.uploadAvatar(user.id, file)

        if ('error' in result) {
            return Response.json({ success: false, error: result.error }, { status: 400 })
        }

        return Response.json({
            success: true,
            message: 'Avatar uploaded successfully',
            avatar_url: result.avatarUrl,
        })
    })

    // Form-based fallback for avatar update
    .post('/profile/avatar', async ({ user, body, redirect }) => {
        if (!user) return redirect('/login')

        const { avatar } = body as { avatar: string }
        if (avatar) {
            await UserService.updateAvatar(user.id, avatar)
        }

        return redirect('/profile')
    })
