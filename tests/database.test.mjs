import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {openStore,ConflictError} from '../server/database.mjs';
import {createApp} from '../server/app.mjs';
import {summary,today} from '../src/model.ts';

test('SQLite persists records, rejects stale writes and invalid relationships atomically',()=>{
 const dir=mkdtempSync(join(tmpdir(),'paisa-'));const path=join(dir,'test.sqlite');let store=openStore(path);
 try {
  const initial=store.read();const d=structuredClone(initial.data);const month=today().slice(0,7);
  d.transactions.push({id:'income',title:"Salary '); DROP TABLE categories;--",amount:100000,kind:'income',categoryId:'salary',date:today(),note:''},{id:'expense',title:'Lunch',amount:12525,kind:'expense',categoryId:'food',date:today(),note:''});
  d.budgets.push({month,categoryId:'food',amount:10000});
  let saved=store.save(d,initial.revision);assert.equal(saved.revision,1);assert.equal(summary(saved.data,month).remaining,-2525);
  assert.throws(()=>store.save(d,0),ConflictError);assert.deepEqual(store.read(),saved);
  const invalid=structuredClone(d);invalid.categories=invalid.categories.filter(c=>c.id!=='food');
  assert.throws(()=>store.save(invalid,1));assert.deepEqual(store.read(),saved);
  const duplicate=structuredClone(d);duplicate.budgets.push({...duplicate.budgets[0]});assert.throws(()=>store.save(duplicate,1));
  // Force a failure after deletion/partial insertion to prove SQL rollback.
  const inspect=new DatabaseSync(path);
  inspect.exec("CREATE TRIGGER reject_test BEFORE INSERT ON transactions WHEN NEW.title='FORCE_FAILURE' BEGIN SELECT RAISE(ABORT,'test failure'); END;");
  const failing=structuredClone(d);failing.transactions[1].title='FORCE_FAILURE';
  assert.throws(()=>store.save(failing,1));assert.deepEqual(store.read(),saved);
  inspect.exec('DROP TRIGGER reject_test');inspect.close();
  store.close();store=openStore(path);assert.deepEqual(store.read(),saved);
  d.categories.find(c=>c.id==='food').name='Meals';d.budgets[0].amount=20000;d.transactions[1].amount=10000;
  saved=store.save(d,1);assert.equal(summary(saved.data,month).remaining,10000);
  d.transactions=[];d.budgets=[];d.categories=d.categories.filter(c=>c.id!=='food');store.save(d,2);
  assert.equal(store.read().data.transactions.length,0);
 } finally {store.close();rmSync(dir,{recursive:true,force:true});}
});

test('HTTP API validates bodies, rejects cross-origin writes and serves saved state',async()=>{
 const store=openStore(':memory:');const server=createApp(store);
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 const base=`http://127.0.0.1:${server.address().port}`;
 try {
  let response=await fetch(base+'/api/workspace');assert.equal(response.status,200);let snapshot=await response.json();
  const put=(body,headers={})=>fetch(base+'/api/workspace',{method:'PUT',headers:{'Content-Type':'application/json',...headers},body:typeof body==='string'?body:JSON.stringify(body)});
  snapshot.data.profile.name='API test';response=await put(snapshot);assert.equal(response.status,200);const saved=await response.json();assert.equal(saved.revision,1);
  assert.equal((await put(snapshot)).status,409);
  assert.equal((await put('{')).status,400);
  assert.equal((await put({revision:1,data:null})).status,400);
  assert.equal((await put(saved,{'Origin':'https://untrusted.example'})).status,403);
  assert.equal((await put(saved,{'Content-Type':'text/plain'})).status,415);
  assert.deepEqual(await (await fetch(base+'/api/workspace')).json(),saved);
  assert.equal((await fetch(base+'/data/paisa.sqlite')).status,404);
  assert.equal((await fetch(base+'/api/missing')).status,404);
 } finally {await new Promise(resolve=>server.close(resolve));store.close();}
});
