import { t } from 'elysia'

export const ChatRoomModel = {
    createBody: t.Object({
        name: t.String({ minLength: 1 }),
    }),

    joinBody: t.Object({
        code: t.String({ minLength: 1 }),
    }),

    roomResponse: t.Object({
        success: t.Boolean(),
        room: t.Optional(t.Object({
            id: t.Number(),
            name: t.String(),
            join_code: t.String(),
        })),
        redirect: t.Optional(t.String()),
        error: t.Optional(t.String()),
        already_member: t.Optional(t.Boolean()),
    }),
}

export type CreateRoomBody = typeof ChatRoomModel.createBody.static
export type JoinRoomBody = typeof ChatRoomModel.joinBody.static
