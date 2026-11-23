import {sanitizePacket,localReportSchema,prepareLocalReport,buildLocalPrompt,compactModelPacket} from '../lib/local-report-contract.mjs';
import http from 'node:http';
import {Readable} from 'node:stream';
// Node's global fetch has a separate five-minute headers timeout. A slow local
// prompt must use our explicit abort deadline, including time before first token.
function localFetch(url,init={}){return new Promise((resolve,reject)=>{const req=http.request(url,{method:init.method??'GET',headers:init.headers,signal:init.signal},res=>resolve(new Response(Readable.toWeb(res),{status:res.statusCode,headers:res.headers})));req.on('error',reject);req.end(init.body);});}
export function makeOllamaHandler({fetchImpl=localFetch,base='http://127.0.0.1:11434',timeoutMs=1200000,onCandidate}={}){
 let busy=false;
 const reply=(status,data)=>Response.json({...data,applicationVersion:'56.0.0'},{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
 return async function handle(request){
  const url=new URL(request.url);
  if(url.pathname==='/api/status'&&request.method==='GET'){
   try{const r=await fetchImpl(`${base}/api/tags`,{signal:AbortSignal.timeout(5000)});if(!r.ok)throw Error();const data=await r.json();const models=(data.models??[]).map(m=>m.name).filter(n=>typeof n==='string'&&!n.includes(':cloud')&&!n.includes('-cloud')).slice(0,40);return reply(200,{configured:models.length>0,models,model:models.includes('qwen3:4b-instruct')?'qwen3:4b-instruct':models[0]??null,mode:'local-ollama'});}catch{return reply(200,{configured:false,models:[],model:null,mode:'ollama-offline'});}
  }
  if(url.pathname!=='/api/report'||request.method!=='POST')return reply(404,{error:'مسیر موجود نیست.'});
  if(request.headers.get('origin')!==url.origin)return reply(403,{error:'درخواست باید از همین برنامه محلی باشد.'});
  if(!request.headers.get('content-type')?.startsWith('application/json'))return reply(415,{error:'نوع درخواست معتبر نیست.'});
  if(busy)return reply(429,{error:'یک گزارش در حال تولید است. ابتدا آن را تمام یا لغو کنید.'});
  let body,packet;try{const text=await request.text();if(text.length>100000)return reply(413,{error:'بسته شواهد بیش از حد بزرگ است.'});body=JSON.parse(text);packet=sanitizePacket(body.evidence);if(body.consent!==true)return reply(400,{error:'انتخاب شواهد و تولید گزارش را تأیید کنید.'});}catch{return reply(400,{error:'بسته شواهد معتبر نیست.'});}
  const model=typeof body.model==='string'?body.model:'';
  if(!/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,120}$/.test(model)||/:cloud|-cloud/.test(model))return reply(400,{error:'یک مدل محلی نصب‌شده انتخاب کنید.'});
  busy=true;const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
  const cancel=()=>controller.abort();request.signal.addEventListener('abort',cancel,{once:true});
  try{
   const tags=await fetchImpl(`${base}/api/tags`,{signal:controller.signal});const installed=await tags.json();if(!installed.models?.some(m=>m.name===model))return reply(400,{error:'مدل انتخابی نصب نشده است.'});
   const modelPacket=compactModelPacket(packet);
   const prompt=buildLocalPrompt(modelPacket);const chars=JSON.stringify(prompt).length;
   const upstream=await fetchImpl(`${base}/api/chat`,{method:'POST',signal:controller.signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({model,stream:true,think:false,keep_alive:'10m',format:localReportSchema(modelPacket),options:{temperature:0.15,num_ctx:chars>6000?8192:4096,num_predict:1400},messages:prompt})});
   if(!upstream.ok)return reply(502,{error:'Ollama نتوانست گزارش بسازد. اجرای مدل و حافظه آزاد را بررسی کنید.'});
   let result,content='';
   if(upstream.headers.get('content-type')?.includes('application/x-ndjson')){const reader=upstream.body.getReader(),decoder=new TextDecoder();let buffer='',size=0;
    const consume=line=>{if(!line.trim())return;const part=JSON.parse(line);if(part.error)throw Error('Ollama error');content+=part.message?.content??'';if(part.done)result=part;};
    while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>1000000){controller.abort();throw Error('Oversized response');}buffer+=decoder.decode(value,{stream:true});const lines=buffer.split('\n');buffer=lines.pop()??'';for(const line of lines)consume(line);}buffer+=decoder.decode();if(buffer.trim())consume(buffer);
   }else{result=await upstream.json();content=result.message?.content??'';}
   if(!result||result.done_reason==='length')return reply(502,{error:'پاسخ مدل کامل نشد. منابع کمتری انتخاب کنید و دوباره تلاش کنید.'});
   if(onCandidate)await onCandidate(content,{promptTokens:result.prompt_eval_count,generatedTokens:result.eval_count,totalSeconds:result.total_duration/1e9});
   let prepared;try{prepared=prepareLocalReport(JSON.parse(content),modelPacket);}catch(e){return reply(422,{error:e.message??'پاسخ مدل معتبر نیست.'});}
   return reply(200,{report:prepared.report,edits:prepared.edits,model,generatedAt:new Date().toISOString(),mode:'local-ollama',modelEvidenceIds:modelPacket.facts.map(f=>f.id)});
  }catch{return reply(controller.signal.aborted?504:502,{error:controller.signal.aborted?'تولید گزارش لغو شد یا بیش از بیست دقیقه طول کشید. منابع کمتری انتخاب کنید.':'ارتباط با Ollama برقرار نشد. برنامه Ollama را باز نگه دارید.'});}
  finally{clearTimeout(timer);request.signal.removeEventListener('abort',cancel);busy=false;}
 };
}
