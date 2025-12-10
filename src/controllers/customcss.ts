import Elysia from "elysia";
export const customcss=new Elysia()
.onError(({ code, error}) => {
    console.log('Detectado error: '+JSON.stringify(error));
    return new Response(error.toString())
})
.get('/loading.css',()=>{
    return Bun.file(import.meta.dir+'/../views/css/loading.css',{type:'text/css'})});