import http from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,existsSync,statSync,createReadStream} from 'node:fs';
import {resolve,dirname,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'dist');
const dbPath=resolve(process.env.DB_PATH||'data/leads.sqlite');
mkdirSync(dirname(dbPath),{recursive:true});
const db=new DatabaseSync(dbPath);
db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS leads (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, contact TEXT NOT NULL, task TEXT NOT NULL DEFAULT "", created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)');
const insert=db.prepare('INSERT INTO leads (name,contact,task) VALUES (?,?,?)');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.ico':'image/x-icon'};
function json(res,status,value){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));}
const server=http.createServer(async(req,res)=>{
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
 let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname)}catch{return json(res,400,{error:'Invalid URL'})}
 if(pathname==='/api/health' && req.method==='GET'){try{db.prepare('SELECT 1').get();return json(res,200,{ok:true})}catch{return json(res,503,{ok:false})}}
 if(pathname==='/api/leads'){
  if(req.method!=='POST')return json(res,405,{error:'Method not allowed'});
  const origin=req.headers.origin;
  if(origin){let valid=false;try{const u=new URL(origin);valid=process.env.PUBLIC_ORIGIN?u.origin===new URL(process.env.PUBLIC_ORIGIN).origin:u.host===req.headers.host}catch{}if(!valid)return json(res,403,{error:'Forbidden'})}
  if(!req.headers['content-type']?.startsWith('application/json'))return json(res,415,{error:'Expected JSON'});
  let body='';try{for await(const chunk of req){body+=chunk.toString();if(Buffer.byteLength(body)>12000){json(res,413,{error:'Too large'});return}}}catch{return json(res,400,{error:'Invalid body'})}
  let data;try{data=JSON.parse(body)}catch{return json(res,400,{error:'Invalid JSON'})}
  if(!data||Array.isArray(data)||typeof data!=='object')return json(res,400,{error:'Invalid payload'});
  if(data.website)return json(res,200,{ok:true});
  const name=typeof data.name==='string'?data.name.trim():'';const contact=typeof data.contact==='string'?data.contact.trim():'';const task=typeof data.task==='string'?data.task.trim():'';
  if(!name||name.length>100||contact.length<5||contact.length>200||task.length>2000)return json(res,400,{error:'Check fields'});
  try{insert.run(name,contact,task);return json(res,201,{ok:true})}catch(error){console.error('Lead save failed',error.message);return json(res,503,{error:'Unable to save'})}
 }
 if(pathname.startsWith('/api/'))return json(res,404,{error:'Not found'});
 if(!['GET','HEAD'].includes(req.method))return json(res,405,{error:'Method not allowed'});
 const path=resolve(root,'.'+pathname);
 if(!path.startsWith(root+sep)&&path!==root)return json(res,404,{error:'Not found'});
 const file=pathname==='/'?resolve(root,'index.html'):path;
 if(!existsSync(file)||!statSync(file).isFile())return json(res,404,{error:'Not found'});
 res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':pathname.startsWith('/assets/')?'public, max-age=31536000, immutable':'no-cache'});
 if(req.method==='HEAD')return res.end();createReadStream(file).on('error',()=>res.destroy()).pipe(res);
});
server.listen(Number(process.env.PORT||3000),process.env.HOST||'0.0.0.0',()=>console.log('NOVUS listening',server.address().port));
function shutdown(){server.close(()=>{db.close();process.exit(0)});setTimeout(()=>process.exit(1),10000).unref()}
process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
