import { Elysia } from "elysia";
import { html } from "@elysiajs/html";

// Controllers
import { usersController } from "./controllers/users";
import { chatroomsController } from "./controllers/chatrooms";
import { messagesController } from "./controllers/messages";

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

    // Mount controllers
    .use(usersController)
    .use(chatroomsController)
    .use(messagesController)

    .listen(3000);

console.log(`Chat server running at http://localhost:${app.server?.port}`);
