import { Elysia } from 'elysia'
import Html from '@kitajs/html'
import { authPlugin } from '../auth'
import { ChatRoomService } from './service'
import Layout from '../../views/layout'
import DashboardPage from '../../views/dashboard'
import ChatRoomPage from '../../views/chatroom'

export const chatroomsController = new Elysia({ name: 'ChatRooms.Controller' })
    .use(authPlugin)

    // ============ DASHBOARD (HOME) ============

    .get('/', ({ user, query, redirect, sessionId }) => {
        if (!user) return redirect('/login')
        const rooms = ChatRoomService.getUserRooms(user.id)
        const error = query.error === 'invalid_code' ? 'Invalid join code' : undefined
        return (
            <Layout title="Dashboard">
                <DashboardPage user={user} rooms={rooms} error={error} sessionId={sessionId} />
            </Layout>
        )
    })

    // ============ ROOM MANAGEMENT (API) ============

    .post('/api/rooms/create', ({ user, body }) => {
        if (!user) {
            return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 })
        }

        const { name } = body as { name: string }
        const room = ChatRoomService.create(name, user.id)

        if (room) {
            return Response.json({
                success: true,
                room: {
                    id: room.id,
                    name: room.name,
                    join_code: room.join_code,
                },
                redirect: `/rooms/${room.id}`,
            })
        }
        return Response.json({ success: false, error: 'Failed to create room' }, { status: 500 })
    })

    .post('/api/rooms/join', ({ user, body }) => {
        if (!user) {
            return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 })
        }

        const { code } = body as { code: string }
        const room = ChatRoomService.getByCode(code)

        if (!room) {
            return Response.json({ success: false, error: 'Invalid join code' }, { status: 404 })
        }

        const joined = ChatRoomService.join(user.id, room.id)
        return Response.json({
            success: true,
            room: {
                id: room.id,
                name: room.name,
                join_code: room.join_code,
            },
            already_member: !joined,
            redirect: `/rooms/${room.id}`,
        })
    })

    .post('/api/rooms/:id/leave', ({ user, params }) => {
        if (!user) {
            return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 })
        }

        const roomId = parseInt(params.id)
        const left = ChatRoomService.leave(user.id, roomId)

        return Response.json({ success: left, redirect: '/' })
    })

    // Form-based fallbacks
    .post('/rooms/create', ({ user, body, redirect }) => {
        if (!user) return redirect('/login')

        const { name } = body as { name: string }
        const room = ChatRoomService.create(name, user.id)

        if (room) {
            return redirect(`/rooms/${room.id}`)
        }
        return redirect('/')
    })

    .post('/rooms/join', ({ user, body, redirect }) => {
        if (!user) return redirect('/login')

        const { code } = body as { code: string }
        const room = ChatRoomService.getByCode(code)

        if (room) {
            ChatRoomService.join(user.id, room.id)
            return redirect(`/rooms/${room.id}`)
        }
        return redirect('/?error=invalid_code')
    })

    .post('/rooms/:id/leave', ({ user, params, redirect }) => {
        if (!user) return redirect('/login')

        const roomId = parseInt(params.id)
        ChatRoomService.leave(user.id, roomId)
        return redirect('/')
    })

    // ============ CHAT ROOM ============

    .get('/rooms/:id', ({ user, params, redirect, sessionId }) => {
        if (!user) return redirect('/login')

        const roomId = parseInt(params.id)
        const room = ChatRoomService.getById(roomId)

        if (!room || !ChatRoomService.isMember(user.id, roomId)) {
            return redirect('/')
        }

        const messages = ChatRoomService.getMessages(roomId, 20)
        ChatRoomService.markAsRead(user.id, roomId)

        return (
            <Layout title={room.name}>
                <ChatRoomPage user={user} room={room} messages={messages} sessionId={sessionId} />
            </Layout>
        )
    })

    // API for infinite scroll
    .get('/api/rooms/:id/history', ({ user, params, query }) => {
        if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

        const roomId = parseInt(params.id)
        if (!ChatRoomService.isMember(user.id, roomId)) {
            return Response.json({ error: 'Not a member' }, { status: 403 })
        }

        const beforeId = query.before ? parseInt(query.before as string) : undefined
        const messages = ChatRoomService.getMessages(roomId, 20, beforeId)

        return Response.json(messages)
    })
