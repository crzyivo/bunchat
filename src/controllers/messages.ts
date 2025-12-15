import { Elysia, t } from "elysia";
import {
    getUserById,
    getSession,
    isMember,
    createMessage,
    updateLastRead,
    getRoomMembers,
} from "../db";

// Store connection data separately using a WeakMap keyed by the raw websocket
interface ConnectionData {
    id: string;
    userId: number | null;
    username: string | null;
    avatarUrl: string | null;
    roomId: number | null;
}

// Connection registry: id -> ws instance
const connections = new Map<string, any>();
// Room subscriptions: roomId -> Set of connection ids
const roomSubscriptions = new Map<number, Set<string>>();
// Connection data: id -> ConnectionData
const connectionData = new Map<string, ConnectionData>();
// User connections: userId -> Set of connection ids (for dashboard updates)
const userConnections = new Map<number, Set<string>>();

let connectionCounter = 0;

function generateConnectionId(): string {
    return `conn_${Date.now()}_${++connectionCounter}`;
}

export const messagesController = new Elysia()
    .ws("/ws", {
        body: t.Object({
            type: t.String(),
            sessionId: t.Optional(t.String()),
            roomId: t.Optional(t.Union([t.String(), t.Number()])),
            content: t.Optional(t.String()),
        }),
        open(ws) {
            const connId = generateConnectionId();
            // Store the connection id on the ws.data object (Elysia's way)
            (ws.data as any).connId = connId;

            connections.set(connId, ws);
            connectionData.set(connId, {
                id: connId,
                userId: null,
                username: null,
                avatarUrl: null,
                roomId: null,
            });

            console.log("WebSocket opened:", connId);
        },
        message(ws, message) {
            try {
                const connId = (ws.data as any).connId as string;
                const data = connectionData.get(connId);

                if (!data) {
                    console.error("No connection data for:", connId);
                    return;
                }

                console.log("WebSocket message:", message.type, "from:", connId);

                // Handle auth
                if (message.type === "auth" && message.sessionId) {
                    const session = getSession(message.sessionId);
                    if (session) {
                        const user = getUserById(session.user_id);
                        if (user) {
                            data.userId = user.id;
                            data.username = user.username;
                            data.avatarUrl = user.avatar_url;

                            // Track user connection for dashboard updates
                            if (!userConnections.has(user.id)) {
                                userConnections.set(user.id, new Set());
                            }
                            userConnections.get(user.id)!.add(connId);

                            ws.send(JSON.stringify({ type: "auth_success" }));
                            console.log("Auth success for:", user.username, "connId:", connId);
                            return;
                        }
                    }
                    ws.send(JSON.stringify({ type: "auth_failed" }));
                    return;
                }

                // Handle join room
                if (message.type === "join" && data.userId && message.roomId) {
                    const roomId = typeof message.roomId === "string"
                        ? parseInt(message.roomId)
                        : message.roomId;

                    if (isMember(data.userId, roomId)) {
                        // Leave previous room if any
                        if (data.roomId !== null) {
                            const prevSubs = roomSubscriptions.get(data.roomId);
                            if (prevSubs) {
                                prevSubs.delete(connId);
                                if (prevSubs.size === 0) {
                                    roomSubscriptions.delete(data.roomId);
                                }
                            }
                        }

                        // Join new room
                        data.roomId = roomId;
                        if (!roomSubscriptions.has(roomId)) {
                            roomSubscriptions.set(roomId, new Set());
                        }
                        roomSubscriptions.get(roomId)!.add(connId);

                        ws.send(JSON.stringify({ type: "joined", roomId }));
                        console.log("User", data.username, "joined room:", roomId);
                    } else {
                        ws.send(JSON.stringify({ type: "join_failed", error: "Not a member" }));
                    }
                    return;
                }

                // Handle message
                if (message.type === "message" && data.userId && data.roomId && message.content) {
                    const content = message.content.trim();

                    if (content.length > 0) {
                        const msg = createMessage(data.roomId, data.userId, content);
                        if (msg) {
                            const broadcast = JSON.stringify({
                                type: "message",
                                message: {
                                    ...msg,
                                    username: data.username,
                                    avatar_url: data.avatarUrl,
                                },
                            });

                            // Broadcast to all connections in the room and mark as read
                            const subs = roomSubscriptions.get(data.roomId);
                            const usersInRoom = new Set<number>();
                            if (subs) {
                                for (const subConnId of subs) {
                                    const conn = connections.get(subConnId);
                                    const subData = connectionData.get(subConnId);
                                    if (conn && subData && subData.userId) {
                                        usersInRoom.add(subData.userId);
                                        try {
                                            conn.send(broadcast);
                                            // Mark message as read for users currently in the room
                                            updateLastRead(subData.userId, data.roomId, msg.id);
                                        } catch (e) {
                                            console.error("Failed to send to:", subConnId);
                                        }
                                    }
                                }
                            }

                            // Send room_update to all members not currently in the room
                            const roomMembers = getRoomMembers(data.roomId);
                            const roomUpdate = JSON.stringify({
                                type: "room_update",
                                roomId: data.roomId,
                                lastMessage: content.substring(0, 50) + (content.length > 50 ? "..." : ""),
                                lastMessageTime: msg.created_at,
                                fromUserId: data.userId,
                            });

                            for (const memberId of roomMembers) {
                                // Skip users who are in the room (they already got the message)
                                if (usersInRoom.has(memberId)) continue;

                                const memberConns = userConnections.get(memberId);
                                if (memberConns) {
                                    for (const memberConnId of memberConns) {
                                        const conn = connections.get(memberConnId);
                                        if (conn) {
                                            try {
                                                conn.send(roomUpdate);
                                            } catch (e) {
                                                // Ignore errors
                                            }
                                        }
                                    }
                                }
                            }

                            console.log("Message broadcast to room:", data.roomId);
                        }
                    }
                    return;
                }

                // Handle typing
                if (message.type === "typing" && data.userId && data.roomId) {
                    const broadcast = JSON.stringify({
                        type: "typing",
                        username: data.username,
                    });

                    const subs = roomSubscriptions.get(data.roomId);
                    if (subs) {
                        for (const subConnId of subs) {
                            if (subConnId !== connId) {
                                const conn = connections.get(subConnId);
                                if (conn) {
                                    try {
                                        conn.send(broadcast);
                                    } catch (e) {
                                        // Ignore send errors for typing
                                    }
                                }
                            }
                        }
                    }
                    return;
                }
            } catch (e) {
                console.error("WebSocket message error:", e);
            }
        },
        close(ws) {
            const connId = (ws.data as any).connId as string;
            const data = connectionData.get(connId);

            console.log("WebSocket closed:", connId);

            if (data) {
                // Clean up room subscription
                if (data.roomId !== null) {
                    const subs = roomSubscriptions.get(data.roomId);
                    if (subs) {
                        subs.delete(connId);
                        if (subs.size === 0) {
                            roomSubscriptions.delete(data.roomId);
                        }
                    }
                }

                // Clean up user connection tracking
                if (data.userId !== null) {
                    const userConns = userConnections.get(data.userId);
                    if (userConns) {
                        userConns.delete(connId);
                        if (userConns.size === 0) {
                            userConnections.delete(data.userId);
                        }
                    }
                }
            }

            connections.delete(connId);
            connectionData.delete(connId);
        },
    });
