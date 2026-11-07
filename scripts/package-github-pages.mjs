import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const [release, artifactDir] = process.argv.slice(2);
if (!/^\d+$/.test(release ?? '') || !artifactDir) throw new Error('Usage: node scripts/package-github-pages.mjs <release> <artifact-dir>');
const faRelease = Number(release).toLocaleString('fa-IR',{useGrouping:false});
const assets = 'github-pages-dist/assets';
const list = readdirSync(assets);
const asset = ext => {
  const matches = list.filter(file=>file.endsWith(ext));
  if (matches.length !== 1) throw new Error(`Expected one ${ext} asset, found ${matches.length}`);
  return readFileSync(join(assets,matches[0]),'utf8');
};
const payload = {js:asset('.js'),css:asset('.css')};
const compress = data => gzipSync(JSON.stringify(data),{level:9});
const packed = compress(payload);
const packName = `ips-v${release}.pack`;
const logo = `data:image/png;base64,${readFileSync('public/atieh-logo.png').toString('base64')}`;

function html(source, icon) {
  return `<!doctype html>
<html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="atieh-release" content="${release}"><link rel="icon" href="${icon}"><title>سامانه خط‌مشی سرمایه‌گذاری آتیه فولاد | نسخه ${faRelease}</title></head>
<body><div id="root">در حال بارگذاری نسخه ${faRelease}…</div><script type="module">
const root=document.querySelector("#root");
try {
 ${source}
 const data=await new Response(stream.pipeThrough(new DecompressionStream("gzip"))).json();
 const css=document.createElement("style");css.textContent=data.css;document.head.append(css);
 const url=URL.createObjectURL(new Blob([data.js],{type:"text/javascript"}));
 try{await import(url);}finally{URL.revokeObjectURL(url);}
} catch(error) { console.error(error);root.textContent="بارگذاری سامانه انجام نشد. صفحه را دوباره بارگذاری کنید."; }
</script></body></html>
`;
}
mkdirSync('assets',{recursive:true});
mkdirSync(artifactDir,{recursive:true});
writeFileSync(join('assets',packName),packed);
writeFileSync('index.html',html(`const response=await fetch(new URL("./assets/${packName}",location.href));
 if(!response.ok||!response.body)throw Error("download");
 const stream=response.body;`,'./atieh-logo.png'));
const standalone = {
  js:payload.js.replace(/(["'`])\/atieh-logo\.png\1/g,()=>JSON.stringify(logo)),
  css:payload.css.replace(/\/atieh-investment-os\/fonts\/(vazirmatn-\d+\.woff2)/g,(_,file)=>`data:font/woff2;base64,${readFileSync(join('public/fonts',file)).toString('base64')}`),
};
if (!standalone.js.includes(logo) || standalone.css.includes('/atieh-investment-os/fonts/')) throw new Error('Standalone logo or font embedding failed');
writeFileSync(join(artifactDir,`Atieh-IPS-v${release}.html`),html(`const compressed=Uint8Array.from(atob("${compress(standalone).toString('base64')}"),ch=>ch.charCodeAt(0));
 const stream=new Blob([compressed]).stream();`,logo));
console.log(`${packName}: ${packed.length} bytes; SHA-256 ${createHash('sha256').update(packed).digest('hex')}`);
