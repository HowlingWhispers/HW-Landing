import test from 'node:test';
import assert from 'node:assert/strict';
import { openStore, hash } from '../server/store.mjs';
import { createCodaServer } from '../server/coda.mjs';
import { askKilo } from '../server/kilo.mjs';

async function setup(t, generate) {
  const store=openStore(':memory:');
  for(const id of ['owner','friend','stranger']){store.run('INSERT INTO users VALUES(?,?)',id,id);store.run('INSERT INTO sessions VALUES(?,?,?)',hash(id+'-session'),id,Date.now()+60000);}
  const server=createCodaServer({origin:'http://localhost',clientId:'id',clientSecret:'secret',kiloPassword:'secret'},store,generate || (async()=> 'Woof.'));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));store.db.close();});
  const request=async(user,path,method='GET',data,origin='http://localhost')=>{
    const response=await fetch(`http://127.0.0.1:${server.address().port}/coda/api${path}`,{method,headers:{Cookie:`hw_coda=${user}-session`,Origin:origin,'Content-Type':'application/json'},...(data===undefined?{}:{body:JSON.stringify(data)})});
    return {status:response.status,body:await response.json()};
  };
  return {store,request};
}
test('authenticated members create isolated rooms and forged origins fail',async t=>{
  const {request}=await setup(t);
  const room=(await request('owner','/rooms','POST',{title:'Private'})).body.id;
  assert.equal((await request('stranger','/rooms/'+room)).status,404);
  assert.deepEqual((await request('stranger','/rooms')).body.rooms,[]);
  const friendRoom=(await request('friend','/rooms','POST',{title:'Friend private'}));
  assert.equal(friendRoom.status,201);
  assert.equal((await request('owner','/rooms/'+friendRoom.body.id)).status,404);
  assert.equal((await request('owner','/rooms/'+room+'/messages','POST',{text:'hi'},'https://evil.example')).status,403);
  assert.equal((await request('none','/rooms')).status,401);
});
test('a fresh non-owner can create, message, and reopen their conversation',async t=>{
  const {request}=await setup(t);
  const bootstrap=await request('friend','/me');
  assert.equal(bootstrap.status,200);assert.equal(bootstrap.body.user.id,'friend');assert.equal(bootstrap.body.providerReady,true);
  assert.deepEqual((await request('friend','/rooms')).body.rooms,[]);
  const created=await request('friend','/rooms','POST',{title:'My den'});assert.equal(created.status,201);
  assert.equal((await request('friend','/rooms/'+created.body.id+'/messages','POST',{text:'Hello Coda'})).status,201);
  assert.equal((await request('friend','/rooms/'+created.body.id+'/reply','POST')).status,200);
  const reopened=(await request('friend','/rooms')).body.rooms;assert.equal(reopened.length,1);assert.equal(reopened[0].id,created.body.id);
  const detail=await request('friend','/rooms/'+created.body.id);assert.equal(detail.status,200);assert.deepEqual(detail.body.messages.map(message=>message.author),['friend','coda']);
});
test('single-use invite grants room history; owner removal revokes it',async t=>{
  const {request}=await setup(t);const room=(await request('owner','/rooms','POST',{title:'Shared'})).body.id;
  await request('owner','/rooms/'+room+'/messages','POST',{text:'Visible room history'});
  const invite=(await request('owner','/rooms/'+room+'/invite','POST')).body.url.split('#invite=')[1];
  assert.equal((await request('friend','/join','POST',{token:invite})).status,200);
  assert.equal((await request('stranger','/join','POST',{token:invite})).status,400);
  assert.equal((await request('friend','/rooms/'+room)).body.messages[0].content,'Visible room history');
  assert.equal((await request('friend','/rooms/'+room+'/invite','POST')).status,403);
  await request('owner','/rooms/'+room+'/members','DELETE',{userId:'friend'});
  assert.equal((await request('friend','/rooms/'+room)).status,404);
});
test('expired and revoked invites cannot be redeemed; deleting a room cascades',async t=>{
  const {request,store}=await setup(t);const room=(await request('owner','/rooms','POST',{title:'Delete'})).body.id;
  const token=(await request('owner','/rooms/'+room+'/invite','POST')).body.url.split('#invite=')[1];
  store.run('UPDATE invites SET expires=0');assert.equal((await request('friend','/join','POST',{token})).status,400);
  const other=(await request('owner','/rooms/'+room+'/invite','POST')).body.url.split('#invite=')[1];
  await request('owner','/rooms/'+room+'/invite','DELETE');assert.equal((await request('friend','/join','POST',{token:other})).status,400);
  await request('owner','/rooms/'+room+'/messages','POST',{text:'forget'});await request('owner','/rooms/'+room,'DELETE');
  assert.equal(store.get('SELECT count(*) AS n FROM messages').n,0);assert.equal(store.get('SELECT count(*) AS n FROM members').n,0);
});
test('generation receives only its room, keeps authors, and retry does not repeat user message',async t=>{
  let calls=0;const {request}=await setup(t,async(_config,_room,history)=>{calls++;assert.equal(history.length,1);assert.equal(history[0].author,'owner');assert.equal(history[0].content,'Current');if(calls===1)throw Error('offline');return 'Woof';});
  const hidden=(await request('owner','/rooms','POST',{title:'Hidden'})).body.id;await request('owner','/rooms/'+hidden+'/messages','POST',{text:'Secret'});
  const room=(await request('owner','/rooms','POST',{title:'Here'})).body.id;await request('owner','/rooms/'+room+'/messages','POST',{text:'Current'});
  assert.equal((await request('owner','/rooms/'+room+'/reply','POST')).status,502);assert.equal((await request('owner','/rooms/'+room+'/reply','POST')).status,200);
  assert.equal((await request('owner','/rooms/'+room)).body.messages.length,2);assert.equal((await request('owner','/rooms/'+room+'/reply','POST')).status,409);
});
test('OAuth rejects missing or forged state before contacting Discord',async t=>{
  const {request}=await setup(t);assert.equal((await request('owner','/callback?state=forged&code=x')).status,400);
});
test('Kilo uses all-tool denial and destroys the session after completion and errors',async()=>{
  for(const failure of [false,true]){
    const calls=[];const fetcher=async(url,init)=>{calls.push({url,init});if(url.endsWith('/session'))return Response.json({id:'one'});if(init.method==='DELETE')return new Response(null,{status:204});if(failure)return new Response(null,{status:500});return Response.json({parts:[{type:'text',text:'Woof.'}]});};
    const config={kiloUrl:'http://localhost:4096',kiloUsername:'kilo',kiloPassword:'secret',kiloModel:'kilo/kilo-auto/free'};
    if(failure)await assert.rejects(askKilo(config,'room',[],fetcher));else assert.equal(await askKilo(config,'room',[],fetcher),'Woof.');
    const create=JSON.parse(calls[0].init.body);assert.equal(create.permission[0].action,'deny');
    assert.ok(Object.values(JSON.parse(calls[1].init.body).tools).every(value=>value===false));assert.equal(calls.at(-1).init.method,'DELETE');
  }
});
