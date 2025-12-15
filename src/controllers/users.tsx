import { Elysia } from "elysia";
import Html from "@kitajs/html";
import {
    createUser,
    getUserByUsername,
    getUserById,
    updateUserPassword,
    updateUserAvatar,
    createSession,
    getSession,
    deleteSession,
    type User,
} from "../db";
import Layout from "../views/layout";
import LoginPage from "../views/login";
import RegisterPage from "../views/register";
import ProfilePage from "../views/profile";

// Helper to get user from session cookie
export async function getUserFromCookie(cookie: any): Promise<User | null> {
    const sessionId = cookie?.session?.value;
    if (!sessionId) return null;
    const session = getSession(sessionId);
    if (!session) return null;
    return getUserById(session.user_id);
}

export const usersController = new Elysia()
    // Auth middleware
    .derive(async ({ cookie }) => {
        const user = await getUserFromCookie(cookie);
        return { user };
    })

    // ============ AUTH ROUTES ============

    .get("/login", ({ user, redirect }) => {
        if (user) return redirect("/");
        return (
            <Layout title="Login">
                <LoginPage />
            </Layout>
        );
    })

    .post("/login", async ({ body, cookie, redirect }) => {
        const { username, password } = body as { username: string; password: string };
        const user = getUserByUsername(username);

        if (!user) {
            return (
                <Layout title="Login">
                    <LoginPage error="Invalid username or password" />
                </Layout>
            );
        }

        const valid = await Bun.password.verify(password, user.password_hash);
        if (!valid) {
            return (
                <Layout title="Login">
                    <LoginPage error="Invalid username or password" />
                </Layout>
            );
        }

        const sessionId = createSession(user.id);
        cookie.session.set({
            value: sessionId,
            httpOnly: true,
            maxAge: 7 * 24 * 60 * 60,
            path: "/",
        });

        return redirect("/");
    })

    .get("/register", ({ user, redirect }) => {
        if (user) return redirect("/");
        return (
            <Layout title="Register">
                <RegisterPage />
            </Layout>
        );
    })

    .post("/register", async ({ body, cookie, redirect }) => {
        const { username, password, confirmPassword } = body as {
            username: string;
            password: string;
            confirmPassword: string;
        };

        if (password !== confirmPassword) {
            return (
                <Layout title="Register">
                    <RegisterPage error="Passwords do not match" />
                </Layout>
            );
        }

        if (username.length < 3 || username.length > 20) {
            return (
                <Layout title="Register">
                    <RegisterPage error="Username must be 3-20 characters" />
                </Layout>
            );
        }

        if (password.length < 6) {
            return (
                <Layout title="Register">
                    <RegisterPage error="Password must be at least 6 characters" />
                </Layout>
            );
        }

        const passwordHash = await Bun.password.hash(password, { algorithm: "argon2id" });
        const avatarNum = Math.floor(Math.random() * 5) + 1;
        const avatarUrl = `/avatars/default${avatarNum}.svg`;

        const user = createUser(username, passwordHash, avatarUrl);
        if (!user) {
            return (
                <Layout title="Register">
                    <RegisterPage error="Username already taken" />
                </Layout>
            );
        }

        const sessionId = createSession(user.id);
        cookie.session.set({
            value: sessionId,
            httpOnly: true,
            maxAge: 7 * 24 * 60 * 60,
            path: "/",
        });

        return redirect("/");
    })

    .get("/logout", ({ cookie, redirect }) => {
        const sessionId = cookie?.session?.value;
        if (sessionId) {
            deleteSession(sessionId);
            cookie.session.remove();
        }
        return redirect("/login");
    })

    // ============ PROFILE ============

    .get("/profile", ({ user, redirect, cookie }) => {
        if (!user) return redirect("/login");
        const sessionId = cookie?.session?.value || "";
        return (
            <Layout title="Profile">
                <ProfilePage user={user} sessionId={sessionId} />
            </Layout>
        );
    })

    .post("/profile/password", async ({ user, body, redirect, cookie }) => {
        if (!user) return redirect("/login");
        const sessionId = cookie?.session?.value || "";

        const { currentPassword, newPassword, confirmPassword } = body as {
            currentPassword: string;
            newPassword: string;
            confirmPassword: string;
        };

        const valid = await Bun.password.verify(currentPassword, user.password_hash);
        if (!valid) {
            return (
                <Layout title="Profile">
                    <ProfilePage user={user} error="Current password is incorrect" sessionId={sessionId} />
                </Layout>
            );
        }

        if (newPassword !== confirmPassword) {
            return (
                <Layout title="Profile">
                    <ProfilePage user={user} error="New passwords do not match" sessionId={sessionId} />
                </Layout>
            );
        }

        if (newPassword.length < 6) {
            return (
                <Layout title="Profile">
                    <ProfilePage user={user} error="Password must be at least 6 characters" sessionId={sessionId} />
                </Layout>
            );
        }

        const passwordHash = await Bun.password.hash(newPassword, { algorithm: "argon2id" });
        updateUserPassword(user.id, passwordHash);

        return (
            <Layout title="Profile">
                <ProfilePage user={user} success="Password updated successfully" sessionId={sessionId} />
            </Layout>
        );
    })

    // API endpoint for avatar update (async JSON response)
    .post("/api/profile/avatar", async ({ user, body }) => {
        if (!user) {
            return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const { avatar } = body as { avatar: string };

        if (!avatar || !avatar.startsWith("/avatars/")) {
            return Response.json({ success: false, error: "Invalid avatar" }, { status: 400 });
        }

        updateUserAvatar(user.id, avatar);
        const updatedUser = getUserById(user.id)!;

        return Response.json({
            success: true,
            message: "Avatar updated successfully",
            avatar_url: updatedUser.avatar_url,
        });
    })

    // API endpoint for avatar file upload
    .post("/api/profile/avatar/upload", async ({ user, body }) => {
        if (!user) {
            return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const formData = body as { avatar?: File };
        const file = formData.avatar;

        if (!file || !(file instanceof File)) {
            return Response.json({ success: false, error: "No file provided" }, { status: 400 });
        }

        // Validate file type
        const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
        if (!allowedTypes.includes(file.type)) {
            return Response.json({ success: false, error: "Invalid file type" }, { status: 400 });
        }

        // Validate file size (5MB max)
        const maxSize = 5 * 1024 * 1024;
        if (file.size > maxSize) {
            return Response.json({ success: false, error: "File too large. Maximum 5MB." }, { status: 400 });
        }

        try {
            // Generate unique filename
            const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
            const filename = `avatar_${user.id}_${Date.now()}.${ext}`;
            const filepath = `public/uploads/${filename}`;

            // Ensure uploads directory exists
            const uploadsDir = "public/uploads";
            try {
                await Bun.write(`${uploadsDir}/.keep`, "");
            } catch {
                // Directory might already exist
            }

            // Write file
            const arrayBuffer = await file.arrayBuffer();
            await Bun.write(filepath, arrayBuffer);

            // Update user avatar URL
            const avatarUrl = `/uploads/${filename}`;
            updateUserAvatar(user.id, avatarUrl);

            return Response.json({
                success: true,
                message: "Avatar uploaded successfully",
                avatar_url: avatarUrl,
            });
        } catch (error) {
            console.error("Avatar upload error:", error);
            return Response.json({ success: false, error: "Failed to upload file" }, { status: 500 });
        }
    })

    // Form-based fallback for avatar update
    .post("/profile/avatar", async ({ user, body, redirect }) => {
        if (!user) return redirect("/login");

        const { avatar } = body as { avatar: string };
        if (avatar) {
            updateUserAvatar(user.id, avatar);
        }

        return redirect("/profile");
    });
