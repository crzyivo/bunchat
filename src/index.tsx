import { Elysia } from "elysia";
import { html } from '@elysiajs/html';
import Layout from './views/layout';
import  Home  from './views/home';
import  Chatroom  from './views/components/chatroom';
import { customcss } from "./controllers/customcss";

const sleep = (time: number) => new Promise(resolve => setTimeout(resolve, time));
const app = new Elysia()
.use(html())
.use(customcss)
.on('beforeHandle', async ({ request }) => {
  console.log(
    `${request.method} ${request.url} - ${request.headers.get('user-agent')}`
  );
}).get('/',() => {
  return (
    <Layout>
      <Home/>
    </Layout>
  );
}).post('/register',async ()=>{
  await sleep(1000);
  return (<Chatroom/>);
})
.ws('/chatroom',{
    open(ws){
      ws.subscribe('chatroom');
      ws.send('<div id=chat_room hx-swap-oob=beforeend>Welcome!</div>');
    },
    message(ws,message){
      ws.publish('chatroom','<div id=chat_room hx-swap-oob=beforeend>'+message.chat_message+'</div>');
    }
})
.listen(3000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
