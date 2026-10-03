import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { openStore, hash } from '../server/store.mjs';
import { createCodaServer } from '../server/coda.mjs';
import { askKilo, browserContextRequest, safeModelReply } from '../server/kilo.mjs';

async function setup(t, generate, fetchImpl) {
  const store=openStore(':memory:');
  const imageRoot=mkdtempSync(join(tmpdir(),'coda-images-'));
  for(const id of ['owner','friend','stranger']){store.run('INSERT INTO users VALUES(?,?)',id,id);store.run('INSERT INTO sessions VALUES(?,?,?)',hash(id+'-session'),id,Date.now()+60000);}
  const server=createCodaServer({origin:'http://localhost',clientId:'id',clientSecret:'secret',kiloPassword:'secret',orbisSecret:'secret',orbisMemoryUrl:'http://orbis/memory',imageRoot},store,generate || (async()=> 'Woof.'),fetchImpl || fetch);
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));store.db.close();rmSync(imageRoot,{recursive:true,force:true});});
  const request=async(user,path,method='GET',data,origin='http://localhost')=>{
    const response=await fetch(`http://127.0.0.1:${server.address().port}/coda/api${path}`,{method,headers:{Cookie:`hw_coda=${user}-session`,Origin:origin,'Content-Type':'application/json'},...(data===undefined?{}:{body:JSON.stringify(data)})});
    return {status:response.status,body:await response.json()};
  };
  const raw=async(user,path,method,buffer,headers={})=>fetch(`http://127.0.0.1:${server.address().port}/coda/api${path}`,{method,headers:{Cookie:`hw_coda=${user}-session`,Origin:'http://localhost',...headers},body:buffer});
  return {store,request,raw};
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
test('guests can leave without destroying the room, and renaming stays host-only',async t=>{
  const {request,store}=await setup(t);const room=(await request('owner','/rooms','POST',{title:'Shared'})).body.id;
  await request('owner','/rooms/'+room+'/messages','POST',{text:'Keep this history'});
  const invite=(await request('owner','/rooms/'+room+'/invite','POST')).body.url.split('#invite=')[1];
  assert.equal((await request('friend','/join','POST',{token:invite})).status,200);
  assert.equal((await request('friend','/rooms/'+room,'PATCH',{title:'Hijacked'})).status,403);
  assert.equal((await request('friend','/rooms/'+room,'DELETE')).status,403);
  assert.equal((await request('friend','/rooms/'+room+'/members','DELETE',{userId:'owner'})).status,400);
  assert.equal((await request('friend','/rooms/'+room+'/members','DELETE',{userId:'stranger'})).status,403);
  assert.equal((await request('owner','/rooms/'+room,'PATCH',{title:'  Renamed den  '})).status,200);
  assert.equal((await request('owner','/rooms/'+room)).body.room.title,'Renamed den');
  assert.equal((await request('owner','/rooms/'+room,'PATCH',{title:'Should not stick',mode:'invalid'})).status,400);
  assert.equal((await request('owner','/rooms/'+room)).body.room.title,'Renamed den');
  assert.equal((await request('owner','/rooms/'+room,'PATCH',{title:'   '})).status,400);
  assert.equal((await request('owner','/rooms/'+room,'PATCH',{title:'x'.repeat(100)})).status,200);
  assert.equal((await request('owner','/rooms/'+room)).body.room.title.length,80);
  assert.equal((await request('owner','/rooms/'+room+'/members','DELETE',{userId:'owner'})).status,400);
  assert.equal((await request('friend','/rooms/'+room+'/members','DELETE',{userId:'friend'})).status,200);
  assert.equal((await request('friend','/rooms/'+room)).status,404);
  const kept=await request('owner','/rooms/'+room);assert.equal(kept.status,200);assert.equal(kept.body.messages[0].content,'Keep this history');assert.deepEqual(kept.body.members.map(member=>member.id),['owner']);
  assert.equal(store.get('SELECT count(*) AS n FROM rooms').n,1);assert.equal(store.get('SELECT count(*) AS n FROM messages').n,1);
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
test('generation receives only its room, keeps authors, caller identity, and retry does not repeat user message',async t=>{
  let calls=0;const {request}=await setup(t,async(_config,_room,history,caller)=>{calls++;assert.equal(history.length,1);assert.equal(history[0].author,'owner');assert.equal(history[0].content,'Current');assert.deepEqual(caller,{discordUserId:'owner',speakerName:'owner',privacyScope:'dm'});if(calls===1)throw Error('offline');return 'Woof';});
  const hidden=(await request('owner','/rooms','POST',{title:'Hidden'})).body.id;await request('owner','/rooms/'+hidden+'/messages','POST',{text:'Secret'});
  const room=(await request('owner','/rooms','POST',{title:'Here'})).body.id;await request('owner','/rooms/'+room+'/messages','POST',{text:'Current'});
  assert.equal((await request('owner','/rooms/'+room+'/reply','POST')).status,502);assert.equal((await request('owner','/rooms/'+room+'/reply','POST')).status,200);
  assert.equal((await request('owner','/rooms/'+room)).body.messages.length,2);assert.equal((await request('owner','/rooms/'+room+'/reply','POST')).status,409);
});
test('generation uses shared-safe memory scope when another member can read the room',async t=>{
  let caller;const {request}=await setup(t,async(_config,_room,_history,input)=>{caller=input;return 'Woof';});
  const room=(await request('owner','/rooms','POST',{title:'Shared'})).body.id;
  const invite=(await request('owner','/rooms/'+room+'/invite','POST')).body.url.split('#invite=')[1];
  await request('friend','/join','POST',{token:invite});
  await request('owner','/rooms/'+room+'/messages','POST',{text:'What do you remember?'});
  assert.equal((await request('owner','/rooms/'+room+'/reply','POST')).status,200);
  assert.deepEqual(caller,{discordUserId:'owner',speakerName:'owner',privacyScope:'guild'});
});
test('host can clear a solo transcript but never shared history',async t=>{
  const {request,store}=await setup(t);const room=(await request('owner','/rooms','POST',{title:'Clear'})).body.id;
  for(const command of ['/help','/memory','/format','/clear'])assert.equal((await request('owner','/rooms/'+room+'/messages','POST',{text:command})).status,400);
  assert.equal(store.get('SELECT COUNT(*) AS n FROM messages WHERE room=?',room).n,0);
  await request('owner','/rooms/'+room+'/messages','POST',{text:'temporary'});
  assert.equal((await request('friend','/rooms/'+room+'/clear','DELETE')).status,404);
  const invite=(await request('owner','/rooms/'+room+'/invite','POST')).body.url.split('#invite=')[1];await request('friend','/join','POST',{token:invite});
  assert.equal((await request('owner','/rooms/'+room+'/clear','DELETE')).status,409);await request('friend','/rooms/'+room+'/members','DELETE',{userId:'friend'});
  assert.equal((await request('owner','/rooms/'+room+'/clear','DELETE')).status,200);assert.equal(store.get('SELECT COUNT(*) AS n FROM messages WHERE room=?',room).n,0);assert.ok(store.get('SELECT 1 FROM rooms WHERE id=?',room));
});
test('memory proxy always scopes operations to the authenticated account',async t=>{
  const calls=[];const fetcher=async(url,init={})=>{calls.push({url:String(url),init});return Response.json(url.toString().includes('/view')?{ok:true,profile:null,notes:[],audit:[]}:{ok:true,note:{id:'1'}});};
  const {request}=await setup(t,undefined,fetcher);
  assert.equal((await request('owner','/memory')).status,200);
  assert.equal((await request('owner','/memory/notes','POST',{discordUserId:'stranger',content:'Remember this',visibility:'private'})).status,200);
  assert.match(calls[0].url,/discordUserId=owner/);const body=JSON.parse(calls[1].init.body);assert.equal(body.discordUserId,'owner');assert.equal(body.kind,'memory');assert.equal(body.provenance,'member_stated');
});
test('room images are normalized, attached atomically, and protected by membership',async t=>{
  const {request,raw}=await setup(t);const room=(await request('owner','/rooms','POST',{title:'Images'})).body.id;
  const bytes=await sharp({create:{width:24,height:18,channels:4,background:'#40a0d0'}}).png().toBuffer();
  const upload=await raw('owner','/rooms/'+room+'/images','POST',bytes,{'Content-Type':'image/png','X-Coda-Filename':'map.png','X-Coda-Alt':'Blue test map'});assert.equal(upload.status,201);const image=(await upload.json()).image;
  assert.equal((await request('owner','/rooms/'+room+'/messages','POST',{text:'Map reference',imageIds:[image.id]})).status,201);
  const detail=await request('owner','/rooms/'+room);assert.equal(detail.body.messages[0].images[0].alt,'Blue test map');assert.equal(detail.body.messages[0].images[0].mime,'image/webp');assert.equal('storagePath' in detail.body.messages[0].images[0],false);
  assert.equal((await raw('owner','/rooms/'+room+'/images/'+image.id,'GET')).status,200);assert.equal((await raw('stranger','/rooms/'+room+'/images/'+image.id,'GET')).status,404);
  const invite=(await request('owner','/rooms/'+room+'/invite','POST')).body.url.split('#invite=')[1];await request('friend','/join','POST',{token:invite});assert.equal((await raw('friend','/rooms/'+room+'/images/'+image.id,'GET')).status,200);
});
test('model replies reject raw internal markup and unexpected tool parts',()=>{
  const original=console.warn;const warnings=[];console.warn=(...args)=>warnings.push(args);
  try {
    assert.throws(()=>safeModelReply({parts:[{type:'text',text:'<dots_function_call><invoke><parameter>ls</parameter></invoke></dots_function_call>'}]},'room'),/invalid internal response/);
    assert.throws(()=>safeModelReply({parts:[{type:'text',text:'&lt;invoke&gt;bash&lt;/invoke&gt;'}]},'room'),/invalid internal response/);
    assert.throws(()=>safeModelReply({parts:[{type:'tool',name:'bash'}]},'room'),/unavailable internal action/);
    assert.equal(safeModelReply({parts:[{type:'text',text:'**Safe reply**'}]},'room'),'**Safe reply**');assert.equal(warnings.length,3);
  } finally { console.warn=original; }
});
test('OAuth rejects missing or forged state before contacting Discord',async t=>{
  const {request}=await setup(t);assert.equal((await request('owner','/callback?state=forged&code=x')).status,400);
});
test('Kilo uses all-tool denial and destroys the session after completion and errors',async()=>{
  for(const failure of [false,true]){
    const calls=[];const fetcher=async(url,init)=>{calls.push({url,init});if(url.endsWith('/context'))return Response.json({prompt:'CODA WEB MODE\n\nCODA MEMORY:\n- AmbiProp is a known friend.'});if(url.endsWith('/session'))return Response.json({id:'one'});if(init.method==='DELETE')return new Response(null,{status:204});if(failure)return new Response(null,{status:500});return Response.json({parts:[{type:'text',text:'Woof.'}]});};
    const config={kiloUrl:'http://localhost:4096',kiloUsername:'kilo',kiloPassword:'secret',kiloModel:'kilo/kilo-auto/free',orbisUrl:'http://localhost:8789/api/internal/coda-discord',orbisSecret:'bridge-secret'};
    const caller={discordUserId:'12345678901234567',speakerName:'Eirvargr',privacyScope:'dm'};
    const messages=[{author:'12345678901234567',name:'Eirvargr',content:'What do you remember about AmbiProp?'}];
    if(failure)await assert.rejects(askKilo(config,'room',messages,caller,fetcher));else assert.equal((await askKilo(config,'room',messages,caller,fetcher)).text,'Woof.');
    const contextCall=calls.find(call=>call.url.endsWith('/context'));const contextBody=JSON.parse(contextCall.init.body);assert.equal(contextBody.discordUserId,caller.discordUserId);assert.equal(contextBody.privacyScope,'dm');assert.equal(contextBody.surface,'web');
    const create=JSON.parse(calls.find(call=>call.url.endsWith('/session')).init.body);assert.equal(create.permission[0].action,'deny');
    const message=JSON.parse(calls.find(call=>call.url.endsWith('/message')).init.body);assert.ok(Object.values(message.tools).every(value=>value===false));assert.match(message.system,/AmbiProp is a known friend/);assert.match(message.system,/same Coda identity/);assert.equal(calls.at(-1).init.method,'DELETE');
  }
});
test('vision-capable Kilo receives room image bytes as dedicated file parts',async t=>{
  const directory=mkdtempSync(join(tmpdir(),'coda-vision-'));t.after(()=>rmSync(directory,{recursive:true,force:true}));const path=join(directory,'image.webp');writeFileSync(path,Buffer.from('safe-image-bytes'));
  const calls=[];const fetcher=async(url,init={})=>{calls.push({url:String(url),init});if(String(url).endsWith('/context'))return Response.json({prompt:'CODA WEB MODE'});if(String(url).endsWith('/provider'))return Response.json({all:[{models:{vision:{id:'kilo-auto/vision',capabilities:{input:{image:true}}}}}]});if(String(url).endsWith('/session'))return Response.json({id:'vision-session'});if(init.method==='DELETE')return new Response(null,{status:204});return Response.json({parts:[{type:'text',text:'I can see it.'}]});};
  const config={kiloUrl:'http://vision:4096',kiloUsername:'kilo',kiloPassword:'secret',kiloModel:'kilo/kilo-auto/free',kiloVisionModel:'kilo/kilo-auto/vision',orbisUrl:'http://orbis/coda-discord',orbisSecret:'bridge'};
  const message={author:'12345678901234567',name:'Member',content:'Inspect this',images:[{id:'image',filename:'map.webp',alt:'Map',mime:'image/webp',size:16,width:10,height:10,url:'/image',storagePath:path}]};
  assert.equal((await askKilo(config,'room',[message],{discordUserId:message.author,speakerName:'Member',privacyScope:'dm'},fetcher)).text,'I can see it.');
  const session=JSON.parse(calls.find(call=>call.url.endsWith('/session')).init.body);const completion=JSON.parse(calls.find(call=>call.url.endsWith('/message')).init.body);
  assert.equal(session.model.id,'kilo-auto/vision');assert.equal(completion.model.modelID,'kilo-auto/vision');assert.equal(completion.parts[0].type,'text');assert.equal(completion.parts[1].type,'file');assert.match(completion.parts[1].url,/^data:image\/webp;base64,/);assert.doesNotMatch(completion.parts[0].text,/safe-image-bytes/);
});
test('browser context keeps the current speaker separate from room history',()=>{
  const request=browserContextRequest([
    {author:'22345678901234567',name:'AmbiProp',content:'Earlier message'},
    {author:'12345678901234567',name:'Eirvargr',content:'What do you remember about AmbiProp?'},
  ],{discordUserId:'12345678901234567',speakerName:'Eirvargr',privacyScope:'dm'});
  assert.equal(request.discordUserId,'12345678901234567');assert.equal(request.text,'What do you remember about AmbiProp?');assert.equal(request.recentMessages[0].authorId,'22345678901234567');
});
