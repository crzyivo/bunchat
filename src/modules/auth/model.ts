import { t } from 'elysia'

export const AuthModel = {
    loginBody: t.Object({
        username: t.String({ minLength: 1 }),
        password: t.String({ minLength: 1 }),
    }),

    registerBody: t.Object({
        username: t.String({ minLength: 3, maxLength: 20 }),
        password: t.String({ minLength: 6 }),
        confirmPassword: t.String({ minLength: 6 }),
    }),

    changePasswordBody: t.Object({
        currentPassword: t.String({ minLength: 1 }),
        newPassword: t.String({ minLength: 6 }),
        confirmPassword: t.String({ minLength: 6 }),
    }),
}

export type LoginBody = typeof AuthModel.loginBody.static
export type RegisterBody = typeof AuthModel.registerBody.static
export type ChangePasswordBody = typeof AuthModel.changePasswordBody.static
