import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
const temp=mkdtempSync(join(tmpdir(),'novus-test-'));const dbPath=join(temp,'leads.sqlite');
async function start(){const child=spawn(process.execPath,['server.mjs'],{env:{...process.env,PORT:'0',HOST:'127.0.0.1',DB_PATH:dbPath},stdio:['ignore','pipe','pipe']});let output='';const port=await new Promise((resolve,reject)=>{child.on('exit',()=>reject(new Error('Server exited')));child.stdout.on('data',chunk=>{output+=chunk;const m=output.match(/NOVUS listening (\d+)/);if(m)resolve(m[1])});});return {child,url:`http://127.0.0.1:${port}`}}
async function stop(child){await new Promise(r=>{child.once('exit',r);child.kill('SIGTERM')})}
test('assets, validation, origin protection and durable lead storage',async()=>{let s=await start();try{
 assert.equal((await fetch(s.url)).status,200);assert.equal((await fetch(s.url+'/arbat.webp')).status,200);
 const post=(data,origin)=>fetch(s.url+'/api/leads',{method:'POST',headers:{'content-type':'application/json',...(origin?{origin}:{})},body:JSON.stringify(data)});
 assert.equal((await post({})).status,400);
 assert.equal((await post({name:'Test',contact:'test@example.com'},'https://evil.example')).status,403);
 assert.equal((await post({name:'Test',contact:'test@example.com',task:'Test report'},s.url)).status,201);
 assert.equal((await fetch(s.url+'/api/leads')).status,405);
 assert.equal((await fetch(s.url+'/data/leads.sqlite')).status,404);
 await stop(s.child);s=await start();assert.equal((await fetch(s.url+'/api/health')).status,200);
 const db=new DatabaseSync(dbPath);assert.equal(db.prepare('SELECT count(*) AS total FROM leads').get().total,1);db.close();
 }finally{await stop(s.child);rmSync(temp,{recursive:true,force:true})}});
