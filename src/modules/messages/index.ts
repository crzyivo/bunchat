import { Elysia } from 'elysia'
import { MessageModel } from './model'
import { MessageService } from './service'

interface ConnectionData {
    id: string
    userId: number | null
    username: string | null
    avatarUrl: string | null
    roomId: number | null
}

const connections = new Map<string, any>()
const roomSubscriptions = new Map<number, Set<string>>()
const connectionData = new Map<string, ConnectionData>()
const userConnections = new Map<number, Set<string>>()

const BUZZ_COOLDOWN_MS = 5000
const lastBuzzTime = new Map<string, number>()

let connectionCounter = 0

function generateConnectionId(): string {
    return `conn_${Date.now()}_${++connectionCounter}`
}

export const messagesController = new Elysia({ name: 'Messages.Controller' })
    .ws('/ws', {
        body: MessageModel.wsMessage,
        open(ws) {
            const connId = generateConnectionId()
                ; (ws.data as any).connId = connId

            connections.set(connId, ws)
            connectionData.set(connId, {
                id: connId,
                userId: null,
                username: null,
                avatarUrl: null,
                roomId: null,
            })

            console.log('WebSocket opened:', connId)
        },
        message(ws, message) {
            try {
                const connId = (ws.data as any).connId as string
                const data = connectionData.get(connId)

                if (!data) {
                    console.error('No connection data for:', connId)
                    return
                }

                console.log('WebSocket message:', message.type, 'from:', connId)

                // Handle auth
                if (message.type === 'auth' && message.sessionId) {
                    const user = MessageService.getUserFromSession(message.sessionId)
                    if (user) {
                        data.userId = user.id
                        data.username = user.username
                        data.avatarUrl = user.avatar_url

                        if (!userConnections.has(user.id)) {
                            userConnections.set(user.id, new Set())
                        }
                        userConnections.get(user.id)!.add(connId)

                        ws.send(JSON.stringify({ type: 'auth_success' }))
                        console.log('Auth success for:', user.username, 'connId:', connId)
                        return
                    }
                    ws.send(JSON.stringify({ type: 'auth_failed' }))
                    return
                }

                // Handle join room
                if (message.type === 'join' && data.userId && message.roomId) {
                    const roomId = typeof message.roomId === 'string'
                        ? parseInt(message.roomId)
                        : message.roomId

                    if (MessageService.isMember(data.userId, roomId)) {
                        if (data.roomId !== null) {
                            const prevSubs = roomSubscriptions.get(data.roomId)
                            if (prevSubs) {
                                prevSubs.delete(connId)
                                if (prevSubs.size === 0) {
                                    roomSubscriptions.delete(data.roomId)
                                }
                            }
                        }

                        data.roomId = roomId
                        if (!roomSubscriptions.has(roomId)) {
                            roomSubscriptions.set(roomId, new Set())
                        }
                        roomSubscriptions.get(roomId)!.add(connId)

                        ws.send(JSON.stringify({ type: 'joined', roomId }))
                        console.log('User', data.username, 'joined room:', roomId)
                    } else {
                        ws.send(JSON.stringify({ type: 'join_failed', error: 'Not a member' }))
                    }
                    return
                }

                // Handle message
                if (message.type === 'message' && data.userId && data.roomId && message.content) {
                    const msg = MessageService.createMessage(data.roomId, data.userId, message.content)
                    if (msg) {
                        const broadcast = JSON.stringify({
                            type: 'message',
                            message: {
                                ...msg,
                                username: data.username,
                                avatar_url: data.avatarUrl,
                            },
                        })

                        const subs = roomSubscriptions.get(data.roomId)
                        const usersInRoom = new Set<number>()
                        if (subs) {
                            for (const subConnId of subs) {
                                const conn = connections.get(subConnId)
                                const subData = connectionData.get(subConnId)
                                if (conn && subData && subData.userId) {
                                    usersInRoom.add(subData.userId)
                                    try {
                                        conn.send(broadcast)
                                        MessageService.markAsRead(subData.userId, data.roomId, msg.id)
                                    } catch (e) {
                                        console.error('Failed to send to:', subConnId)
                                    }
                                }
                            }
                        }

                        const roomMembers = MessageService.getRoomMembers(data.roomId)
                        const roomUpdate = JSON.stringify({
                            type: 'room_update',
                            roomId: data.roomId,
                            lastMessage: message.content.substring(0, 50) + (message.content.length > 50 ? '...' : ''),
                            lastMessageTime: msg.created_at,
                            fromUserId: data.userId,
                        })

                        for (const memberId of roomMembers) {
                            if (usersInRoom.has(memberId)) continue

                            const memberConns = userConnections.get(memberId)
                            if (memberConns) {
                                for (const memberConnId of memberConns) {
                                    const conn = connections.get(memberConnId)
                                    if (conn) {
                                        try {
                                            conn.send(roomUpdate)
                                        } catch (e) {
                                            // Ignore errors
                                        }
                                    }
                                }
                            }
                        }

                        console.log('Message broadcast to room:', data.roomId)
                    }
                    return
                }

                // Handle typing
                if (message.type === 'typing' && data.userId && data.roomId) {
                    const broadcast = JSON.stringify({
                        type: 'typing',
                        username: data.username,
                    })

                    const subs = roomSubscriptions.get(data.roomId)
                    if (subs) {
                        for (const subConnId of subs) {
                            if (subConnId !== connId) {
                                const conn = connections.get(subConnId)
                                if (conn) {
                                    try {
                                        conn.send(broadcast)
                                    } catch (e) {
                                        // Ignore send errors
                                    }
                                }
                            }
                        }
                    }
                    return
                }

                // Handle buzz
                if (message.type === 'buzz' && data.userId && data.roomId) {
                    const buzzKey = `${data.userId}_${data.roomId}`
                    const now = Date.now()
                    const lastBuzz = lastBuzzTime.get(buzzKey) || 0
                    const remaining = BUZZ_COOLDOWN_MS - (now - lastBuzz)

                    if (remaining > 0) {
                        ws.send(JSON.stringify({
                            type: 'buzz_cooldown',
                            remainingMs: remaining,
                        }))
                        return
                    }

                    lastBuzzTime.set(buzzKey, now)

                    const broadcast = JSON.stringify({
                        type: 'buzz',
                        username: data.username,
                        fromUserId: data.userId,
                    })

                    const subs = roomSubscriptions.get(data.roomId)
                    if (subs) {
                        for (const subConnId of subs) {
                            const conn = connections.get(subConnId)
                            if (conn) {
                                try {
                                    conn.send(broadcast)
                                } catch (e) {
                                    // Ignore send errors
                                }
                            }
                        }
                    }
                    return
                }
            } catch (e) {
                console.error('WebSocket message error:', e)
            }
        },
        close(ws) {
            const connId = (ws.data as any).connId as string
            const data = connectionData.get(connId)

            console.log('WebSocket closed:', connId)

            if (data) {
                if (data.roomId !== null) {
                    const subs = roomSubscriptions.get(data.roomId)
                    if (subs) {
                        subs.delete(connId)
                        if (subs.size === 0) {
                            roomSubscriptions.delete(data.roomId)
                        }
                    }
                }

                if (data.userId !== null) {
                    const userConns = userConnections.get(data.userId)
                    if (userConns) {
                        userConns.delete(connId)
                        if (userConns.size === 0) {
                            userConnections.delete(data.userId)
                        }
                    }
                }
            }

            connections.delete(connId)
            connectionData.delete(connId)
        },
    })
