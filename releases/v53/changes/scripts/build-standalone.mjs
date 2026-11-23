import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const buildDir = path.resolve("dist-standalone-build");
const outputDir = path.resolve("dist-standalone");
const manifest=JSON.parse(await readFile(path.join(buildDir,'.vite/manifest.json'),'utf8'));
const entry=Object.values(manifest).find(item=>item.isEntry&&item.src==='index.html');
if(!entry?.file||!entry.css?.length)throw Error('Current standalone build entry is missing from manifest.');
let html=await readFile(path.resolve('index.html'),'utf8');
const css=(await Promise.all(entry.css.map(file=>readFile(path.join(buildDir,file),'utf8')))).join('\n').replaceAll('</style','<\\/style');
const script=(await readFile(path.join(buildDir,entry.file),'utf8')).replaceAll('</script','<\\/script');
html=html.replace('</head>',()=>`<style>${css}</style></head>`);
const scriptMatch=html.match(/<script type="module"[^>]+src="\/static-main\.tsx"[^>]*><\/script>/);
if(!scriptMatch)throw Error('Source entry script was not found.');
html=html.replace(scriptMatch[0],()=>`<script type="module">${script}</script>`);

html = html.replace(/\s*<link rel="icon"[^>]*>/, "");
// Narrative v4 is bundled; offline output makes no rulebook fetch.
await mkdir(outputDir, { recursive: true });
await writeFile(path.join(outputDir, "IPS-Dashboard.html"), html, "utf8");
