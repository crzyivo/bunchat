import { t } from 'elysia'

export const UserModel = {
    avatarBody: t.Object({
        avatar: t.String(),
    }),

    avatarResponse: t.Object({
        success: t.Boolean(),
        message: t.Optional(t.String()),
        avatar_url: t.Optional(t.String()),
        error: t.Optional(t.String()),
    }),
}

export type AvatarBody = typeof UserModel.avatarBody.static
