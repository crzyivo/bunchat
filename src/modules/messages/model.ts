import { t } from 'elysia'

export const MessageModel = {
    wsMessage: t.Object({
        type: t.String(),
        sessionId: t.Optional(t.String()),
        roomId: t.Optional(t.Union([t.String(), t.Number()])),
        content: t.Optional(t.String()),
    }),
}

export type WsMessage = typeof MessageModel.wsMessage.static
