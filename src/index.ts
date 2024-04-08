import { Elysia } from "elysia";
import { html } from '@elysiajs/html';
import { Layout } from 'views/layout';
import { Home } from 'views/home';

const app = new Elysia()
.on('beforeHandle', async ({ request }) => {
  console.log(
    `${request.method} ${request.url} - ${request.headers.get('user-agent')}`
  );
}).get("/", () => (<Layout><Home/></Layout>)).listen(3000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
