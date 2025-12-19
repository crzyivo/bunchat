import { Elysia } from "elysia";
import { html } from "@elysiajs/html";

// Modules
import { usersController } from "./modules/users";
import { chatroomsController } from "./modules/chatrooms";
import { messagesController } from "./modules/messages";

const app = new Elysia()
    .use(html())

    // Static file serving
    .get("/css/*", ({ params }) => {
        return Bun.file(`public/css/${params["*"]}`);
    })
    .get("/avatars/*", ({ params }) => {
        return Bun.file(`public/avatars/${params["*"]}`);
    })
    .get("/uploads/*", ({ params }) => {
        return Bun.file(`public/uploads/${params["*"]}`);
    })
    .get("/buzz.mp3", () => {
        return Bun.file("public/buzz.mp3");
    })

    // Mount modules
    .use(usersController)
    .use(chatroomsController)
    .use(messagesController)

    .listen(Bun.env.PORT || 3000);

console.log(`Chat server running at http://localhost:${app.server?.port}`);
