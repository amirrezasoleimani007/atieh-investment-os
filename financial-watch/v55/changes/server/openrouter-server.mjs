import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {makeReportHandler} from './openrouter-handler.mjs';
const port=Number(process.env.REPORT_PORT??4178);
if(!Number.isInteger(port)||port<1024||port>65535)throw Error('REPORT_PORT is invalid');
const handle=makeReportHandler({apiKey:process.env.OPENROUTER_API_KEY??'',model:process.env.OPENROUTER_MODEL??''});
const html=fileURLToPath(new URL('../dist-standalone/IPS-Dashboard.html',import.meta.url));
const server=http.createServer(async(req,res)=>{
 const host=req.headers.host;if(![`127.0.0.1:${port}`,`localhost:${port}`].includes(host)){res.writeHead(403);return res.end('Forbidden host')}
 try{
  const url=new URL(req.url,`http://${host}`);
  if(url.pathname.startsWith('/api/')){
   const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>70000){res.writeHead(413);res.end();return}chunks.push(chunk)}
   const request=new Request(url,{method:req.method,headers:req.headers,body:req.method==='GET'||req.method==='HEAD'?undefined:Buffer.concat(chunks)});
   const reply=await handle(request);res.writeHead(reply.status,Object.fromEntries(reply.headers));res.end(Buffer.from(await reply.arrayBuffer()));return;
  }
  if(req.method!=='GET'||!['/','/index.html'].includes(url.pathname)){res.writeHead(404);return res.end('Not found')}
  const data=await readFile(html);res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(data);
 }catch{res.writeHead(500,{'Content-Type':'text/plain; charset=utf-8'});res.end('پاسخ آماده نشد. خروجی build را بررسی کنید.')}
});
server.requestTimeout=55000;
server.listen(port,'127.0.0.1',()=>console.log(`Local report pilot: http://127.0.0.1:${port} — no API key is printed. Keep this pilot on loopback.`));
