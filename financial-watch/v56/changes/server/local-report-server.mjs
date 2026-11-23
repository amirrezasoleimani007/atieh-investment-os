import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {makeOllamaHandler} from './ollama-handler.mjs';
const port=Number(process.env.REPORT_PORT??4178);
if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Invalid REPORT_PORT');
const handle=makeOllamaHandler();
const paths=[new URL('../index.html',import.meta.url),new URL('../dist-standalone/IPS-Dashboard.html',import.meta.url)];
let html;
for(const path of paths){try{const b=await readFile(fileURLToPath(path));if(b.length>100000){html=b;break;}}catch{}}
if(!html)throw Error('Build app first: npm run build');
const server=http.createServer(async(req,res)=>{
 if(![`localhost:${port}`,`127.0.0.1:${port}`].includes(req.headers.host)){res.writeHead(403);return res.end();}
 const controller=new AbortController();req.on('aborted',()=>controller.abort());res.on('close',()=>{if(!res.writableEnded)controller.abort();});
 try{
  const url=new URL(req.url,`http://${req.headers.host}`);
  if(url.pathname.startsWith('/api/')){let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>150000){res.writeHead(413);return res.end();}chunks.push(chunk);}
   const request=new Request(url,{method:req.method,headers:req.headers,signal:controller.signal,body:['GET','HEAD'].includes(req.method)?undefined:Buffer.concat(chunks)});
   const response=await handle(request);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return;
  }
  if(req.method!=='GET'||!['/','/index.html'].includes(url.pathname)){res.writeHead(404);return res.end();}
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});res.end(html);
 }catch{if(!res.headersSent)res.writeHead(500);res.end();}
});
server.requestTimeout=1220000;server.on('error',e=>{console.error(e.code==='EADDRINUSE'?`Port ${port} is already in use. Close the previous local report server or set REPORT_PORT.`:'Local server could not start.');process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>console.log(`Financial Report 56: http://127.0.0.1:${port} — local Ollama only`));
