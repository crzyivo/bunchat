import { Elysia } from "elysia";
import Html from "@kitajs/html";
import {
    getUserById,
    getSession,
    createChatRoom,
    getChatRoomById,
    getChatRoomByCode,
    joinRoom,
    leaveRoom,
    isMember,
    getUserRooms,
    updateLastRead,
    getMessages,
    getLatestMessageId,
    type User,
} from "../db";
import Layout from "../views/layout";
import DashboardPage from "../views/dashboard";
import ChatRoomPage from "../views/chatroom";

// Helper to get user from session cookie
async function getUserFromCookie(cookie: any): Promise<User | null> {
    const sessionId = cookie?.session?.value;
    if (!sessionId) return null;
    const session = await getSession(sessionId);
    if (!session) return null;
    return getUserById(session.user_id);
}

export const chatroomsController = new Elysia()
    // Auth middleware
    .derive(async ({ cookie }) => {
        const user = await getUserFromCookie(cookie);
        return { user };
    })

    // ============ DASHBOARD (HOME) ============

    .get("/", async ({ user, query, redirect, cookie }) => {
        if (!user) return redirect("/login");
        const rooms = await getUserRooms(user.id);
        const error = query.error === "invalid_code" ? "Invalid join code" : undefined;
        const sessionId = cookie?.session?.value || "";
        return (
            <Layout title="Dashboard">
                <DashboardPage user={user} rooms={rooms} error={error} sessionId={sessionId} />
            </Layout>
        );
    })

    // ============ ROOM MANAGEMENT (API - async JSON responses) ============

    .post("/api/rooms/create", async ({ user, body }) => {
        if (!user) {
            return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const { name } = body as { name: string };
        if (!name || name.trim().length === 0) {
            return Response.json({ success: false, error: "Room name is required" }, { status: 400 });
        }

        const room = await createChatRoom(name.trim(), user.id);
        if (room) {
            return Response.json({
                success: true,
                room: {
                    id: room.id,
                    name: room.name,
                    join_code: room.join_code,
                },
                redirect: `/rooms/${room.id}`,
            });
        } else {
            return Response.json({ success: false, error: "Failed to create room" }, { status: 500 });
        }
    })

    .post("/api/rooms/join", async ({ user, body }) => {
        if (!user) {
            return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const { code } = body as { code: string };
        if (!code || code.trim().length === 0) {
            return Response.json({ success: false, error: "Join code is required" }, { status: 400 });
        }

        const room = await getChatRoomByCode(code.trim().toLowerCase());
        if (!room) {
            return Response.json({ success: false, error: "Invalid join code" }, { status: 404 });
        }

        const joined = await joinRoom(user.id, room.id);
        return Response.json({
            success: true,
            room: {
                id: room.id,
                name: room.name,
                join_code: room.join_code,
            },
            already_member: !joined,
            redirect: `/rooms/${room.id}`,
        });
    })

    .post("/api/rooms/:id/leave", async ({ user, params }) => {
        if (!user) {
            return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const roomId = parseInt(params.id);
        const left = await leaveRoom(user.id, roomId);

        return Response.json({
            success: left,
            redirect: "/",
        });
    })

    // Form-based fallbacks
    .post("/rooms/create", async ({ user, body, redirect }) => {
        if (!user) return redirect("/login");

        const { name } = body as { name: string };
        if (!name || name.trim().length === 0) {
            return redirect("/");
        }

        const room = await createChatRoom(name.trim(), user.id);
        if (room) {
            return redirect(`/rooms/${room.id}`);
        } else {
            return redirect("/");
        }
    })

    .post("/rooms/join", async ({ user, body, redirect }) => {
        if (!user) return redirect("/login");

        const { code } = body as { code: string };
        const room = await getChatRoomByCode(code.trim().toLowerCase());

        if (room) {
            await joinRoom(user.id, room.id);
            return redirect(`/rooms/${room.id}`);
        } else {
            return redirect("/?error=invalid_code");
        }
    })

    .post("/rooms/:id/leave", async ({ user, params, redirect }) => {
        if (!user) return redirect("/login");

        const roomId = parseInt(params.id);
        await leaveRoom(user.id, roomId);
        return redirect("/");
    })

    // ============ CHAT ROOM ============

    .get("/rooms/:id", async ({ user, params, redirect, cookie }) => {
        if (!user) return redirect("/login");

        const roomId = parseInt(params.id);
        const room = await getChatRoomById(roomId);
        const memberCheck = await isMember(user.id, roomId);

        if (!room || !memberCheck) {
            return redirect("/");
        }

        const messages = await getMessages(roomId, 20);
        const latestId = await getLatestMessageId(roomId);
        if (latestId > 0) {
            await updateLastRead(user.id, roomId, latestId);
        }

        const sessionId = cookie?.session?.value || "";
        return (
            <Layout title={room.name}>
                <ChatRoomPage user={user} room={room} messages={messages} sessionId={sessionId} />
            </Layout>
        );
    })

    // API for infinite scroll
    .get("/api/rooms/:id/history", async ({ user, params, query }) => {
        if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

        const roomId = parseInt(params.id);
        const memberCheck = await isMember(user.id, roomId);
        if (!memberCheck) {
            return Response.json({ error: "Not a member" }, { status: 403 });
        }

        const beforeId = query.before ? parseInt(query.before as string) : undefined;
        const messages = await getMessages(roomId, 20, beforeId);

        return Response.json(messages);
    });
