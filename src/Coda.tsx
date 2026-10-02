import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Copy, Ear, LockKeyhole, LogOut, MessageCircle, Plus, Send, ShieldCheck, Sparkles, Trash2, Users, X } from 'lucide-react';
import './coda.css';
type User = { id: string; name: string };
type Room = { id: string; owner: string; title: string; mode: 'reply' | 'listen' };
type Message = { seq: number; author: string; name: string; content: string; created: number };
type Detail = { room: Room; messages: Message[]; members: User[]; busy: boolean };
async function api<T>(path: string, method = 'GET', data?: unknown): Promise<T> {
  const response = await fetch('/coda/api' + path, { method, headers: { 'Content-Type': 'application/json' }, ...(data === undefined ? {} : { body: JSON.stringify(data) }) });
  const result = await response.json().catch(() => ({ error: 'Coda’s room server is not available yet.' }));
  if (!response.ok) throw new Error(result.error || 'Something went wrong. Try again.');
  return result;
}
export function Coda() {
  const [user, setUser] = useState<User | null>(null); const [ready, setReady] = useState(false);
  const [configured, setConfigured] = useState(false); const [providerReady, setProviderReady] = useState(false); const [canCreate, setCanCreate] = useState(false);
  const [rooms, setRooms] = useState<Room[]>([]); const [active, setActive] = useState(''); const [detail, setDetail] = useState<Detail | null>(null);
  const [text, setText] = useState(''); const [error, setError] = useState(''); const [pending, setPending] = useState(false); const [working, setWorking] = useState(false);
  const [newRoom, setNewRoom] = useState(false); const [title, setTitle] = useState(''); const [invite, setInvite] = useState(''); const [inviteCopied, setInviteCopied] = useState(false);
  const [showMembers, setShowMembers] = useState(false); const [mobileRooms, setMobileRooms] = useState(false); const [joining, setJoining] = useState(false);
  const bottom = useRef<HTMLDivElement>(null); const activeRef = useRef(''); activeRef.current = active;
  const inviteToken = useRef(new URLSearchParams(location.hash.slice(1)).get('invite') || sessionStorage.getItem('coda-invite') || '');
  useEffect(() => {
    document.title = 'Coda’s Den · Howling Whispers';
    let meta = document.querySelector('meta[name="robots"]'); if (!meta) { meta = document.createElement('meta'); meta.setAttribute('name','robots'); document.head.append(meta); } meta.setAttribute('content','noindex, nofollow, noarchive');
    document.querySelector('link[rel="canonical"]')?.remove();
    if (inviteToken.current) { sessionStorage.setItem('coda-invite',inviteToken.current); history.replaceState(null,'','/coda'); }
    api<{user: User|null; configured: boolean; providerReady: boolean; canCreate: boolean}>('/me').then(data => { setUser(data.user); setConfigured(data.configured); setProviderReady(data.providerReady); setCanCreate(data.canCreate); }).catch(e=>setError(e.message)).finally(()=>setReady(true));
  },[]);
  async function refreshRooms() { const data = await api<{rooms: Room[]}>('/rooms'); setRooms(data.rooms); return data.rooms; }
  async function refresh(id: string) { const data = await api<Detail>('/rooms/'+id); if (activeRef.current === id) setDetail(data); }
  useEffect(() => { if (user && inviteToken.current) setJoining(true); if (user) refreshRooms().then(list=>{if (!activeRef.current && list.length) setActive(list[0].id);}).catch(e=>setError(e.message)); },[user]);
  useEffect(()=>{
    if (!active) { setDetail(null); return; }
    setDetail(null); setInvite(''); setShowMembers(false); setError('');
    let canceled = false;
    const load = () => api<Detail>('/rooms/'+active).then(data=>{if(!canceled) setDetail(data);}).catch(e=>{if(!canceled) setError(e.message);});
    void load(); const interval = setInterval(load,2500); return ()=>{canceled=true; clearInterval(interval);};
  },[active]);
  useEffect(()=>{bottom.current?.scrollIntoView({behavior:'smooth'});},[detail?.messages.length,working]);
  async function perform(fn:()=>Promise<void>) { setError(''); setPending(true); try { await fn(); } catch(e) { setError((e as Error).message); } finally { setPending(false); } }
  async function ask(id: string) { setWorking(true); try { await api('/rooms/'+id+'/reply','POST'); await refresh(id); } finally { setWorking(false); } }
  async function send() {
    if(!text.trim() || !detail) return; const id=active; const message=text;
    await perform(async()=>{await api('/rooms/'+id+'/messages','POST',{text:message}); setText(''); await refresh(id); if(detail.room.mode==='reply' && !detail.busy) await ask(id);});
  }
  useEffect(() => {
    if (!newRoom && !invite && !joining && !showMembers) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    const controls = () => Array.from(dialog?.querySelectorAll<HTMLElement>('button:not(:disabled), input, textarea, [tabindex="0"]') || []);
    (dialog?.querySelector<HTMLElement>('input') || controls()[0])?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setNewRoom(false); setInvite(''); setJoining(false); setShowMembers(false); }
      if (event.key !== 'Tab') return;
      const list = controls(); const first = list[0]; const last = list[list.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', trap);
    return () => { document.removeEventListener('keydown', trap); previous?.focus(); };
  }, [newRoom, invite, joining, showMembers]);
  const owner = detail?.room.owner===user?.id;
  const signIn = () => { location.href='/coda/api/login'; };
  return <div className="coda-app">
    <aside className={'coda-sidebar '+(mobileRooms?'is-open':'')} aria-label="Conversations">
      <a className="coda-brand" href="/coda"><span className="coda-paw">🐾</span><span>Coda’s Den<small>HOWLING WHISPERS</small></span></a>
      <button className="coda-new" onClick={()=>{setNewRoom(true);setMobileRooms(false);}} disabled={!user || !canCreate}><Plus size={18}/> New conversation</button>
      <div className="coda-side-label">YOUR CONVERSATIONS</div>
      <nav>{rooms.map(room=><button key={room.id} className={'coda-room '+(active===room.id?'selected':'')} onClick={()=>{setActive(room.id);setMobileRooms(false);}}><MessageCircle size={17}/><span>{room.title}</span></button>)}</nav>
      {!rooms.length && <p className="coda-side-empty">A quiet corner, just for you.<br/>Your conversations will live here.</p>}
      <div className="coda-sidebar-bottom"><div className="coda-private"><ShieldCheck size={18}/><span>Private by invitation<small>Only room members can read it.</small></span></div><a href="/"><ArrowLeft size={16}/> Welcome hub</a>{user && <button onClick={()=>perform(async()=>{await api('/logout','POST');location.reload();})}><LogOut size={16}/> Sign out · {user.name}</button>}</div>
    </aside>
    {mobileRooms && <button className="coda-scrim" aria-label="Close conversations" onClick={()=>setMobileRooms(false)}/>}
    <main className="coda-main">
      <header className="coda-header"><button className="coda-mobile-menu" aria-label="Open conversations" onClick={()=>setMobileRooms(true)}><MessageCircle size={21}/></button><div><h1>{detail?.room.title || 'A little room for big ideas'}</h1><span><LockKeyhole size={13}/> {detail ? `${detail.members.length} ${detail.members.length===1?'person':'people'} + Coda` : 'Your private corner of Howling Whispers'}</span></div>{detail && <div className="coda-room-actions"><button onClick={()=>setShowMembers(!showMembers)} aria-label="Room members"><Users size={18}/><span>Members</span></button>{owner && <button onClick={()=>perform(async()=>{const data=await api<{url:string}>('/rooms/'+active+'/invite','POST');setInvite(data.url);setInviteCopied(false);})} disabled={pending}><Plus size={17}/><span>Invite friend</span></button>}</div>}</header>
      <div className="coda-conversation">
        {!detail && <section className="coda-welcome"><div className="coda-avatar large">🐾</div><p className="coda-eyebrow">COME IN. GET COMFY.</p><h2>Well, hello there.</h2><p>Questions, wild ideas, a stubborn bug?<br/>Pull up a chair. My ears are listening.</p><div className="coda-welcome-note"><LockKeyhole size={18}/><span>Start a conversation with me, or invite a friend into your own little den.</span></div>{!ready ? <p role="status">Opening the den…</p> : !user ? <button className="coda-primary" disabled={!configured} onClick={signIn}>Sign in with Discord</button> : <button className="coda-primary" disabled={!canCreate && !inviteToken.current} onClick={()=>inviteToken.current?setJoining(true):setNewRoom(true)}>{inviteToken.current?'Open your invitation':canCreate?'Start a conversation':'Ask your friend for an invitation'}</button>}{ready && !configured && <p className="coda-muted">The den is waiting for its sign-in connection.</p>}{user && inviteToken.current && !joining && <button onClick={()=>setJoining(true)}>Review invitation</button>}</section>}
        {detail && <><div className="coda-room-intro"><span>🐾</span><div><strong>Coda is here.</strong><p>This room has its own history. Nothing from your other conversations is brought in.</p></div></div>{detail.messages.map(message=><article className={'coda-message '+(message.author==='coda'?'from-coda':'')} key={message.seq}><div className="coda-avatar">{message.author==='coda'?'🐾':message.name.slice(0,1).toUpperCase()}</div><div className="coda-message-body"><div className="coda-message-meta"><strong>{message.name}</strong>{message.author==='coda' && <span className="coda-badge">CODA</span>}<time dateTime={new Date(message.created).toISOString()}>{new Date(message.created).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</time></div><p>{message.content}</p><button className="coda-copy" aria-label="Copy message" onClick={()=>perform(async()=>{await navigator.clipboard.writeText(message.content);})}><Copy size={14}/> Copy</button></div></article>)}{(working || detail.busy) && <div className="coda-thinking" role="status"><Sparkles size={17}/> Coda is thinking… <span>Give those canine brain cells a moment.</span></div>}<div ref={bottom}/></>}
      </div>
      {error && <div className="coda-error" role="alert">{error}<button aria-label="Dismiss error" onClick={()=>setError('')}><X size={16}/></button></div>}
      {detail && <footer className="coda-composer-area"><div className="coda-composer-top"><span><Ear size={15}/> {detail.room.mode==='listen'?'Just listening':'Coda replies after you send'}</span><div>{owner && <button disabled={pending} onClick={()=>perform(async()=>{await api('/rooms/'+active,'PATCH',{mode:detail.room.mode==='reply'?'listen':'reply'});await refresh(active);})}>{detail.room.mode==='reply'?'Just listen':'Join in'}</button>}<button disabled={pending || working || detail.busy || !providerReady} onClick={()=>perform(()=>ask(active))}>Ask Coda</button></div></div><form className="coda-composer" onSubmit={e=>{e.preventDefault();void send();}}><textarea aria-label="Message" placeholder={detail.room.mode==='listen'?'Chat with your friend. Coda is listening…':'What’s on your mind?'} value={text} onChange={e=>setText(e.target.value)} maxLength={8000} rows={3}/><button className="coda-send" disabled={pending || !text.trim()} type="submit" aria-label="Send message"><Send size={19}/></button></form><p className="coda-composer-note">Enter makes a new line. Send when you’re ready. · {providerReady?'Powered by Kilo':'Kilo connection pending'}</p></footer>}
    </main>
    {newRoom && <div className="coda-modal-backdrop"><form role="dialog" aria-modal="true" aria-label="New conversation" className="coda-modal" onSubmit={e=>{e.preventDefault();void perform(async()=>{const data=await api<{id:string}>('/rooms','POST',{title});await refreshRooms();setActive(data.id);setNewRoom(false);setTitle('');});}}><button type="button" className="coda-modal-close" aria-label="Close" onClick={()=>setNewRoom(false)}><X/></button><span className="coda-eyebrow">A FRESH LITTLE DEN</span><h2>Name your conversation</h2><label htmlFor="room-title">Room name</label><input id="room-title" autoFocus maxLength={80} value={title} onChange={e=>setTitle(e.target.value)} placeholder="Ideas over bacon" required/><p>It starts with you and Coda. You can invite a friend whenever you like.</p>{error && <p role="alert" className="coda-modal-error">{error}</p>}<button className="coda-primary" disabled={pending || !title.trim()}>Create conversation</button></form></div>}
    {invite && <div className="coda-modal-backdrop"><section role="dialog" aria-modal="true" aria-label="Room controls" className="coda-modal"><button className="coda-modal-close" aria-label="Close" onClick={()=>setInvite('')}><X/></button><span className="coda-eyebrow">MAKE ROOM FOR A FRIEND</span><h2>One invitation. One friend.</h2><p>Valid for 24 hours and one use. Your guest can read this room’s earlier messages. Share it only with the person you want here.</p><input aria-label="Invitation link" readOnly value={invite} onFocus={e=>e.target.select()}/><button className="coda-primary" onClick={()=>perform(async()=>{await navigator.clipboard.writeText(invite);setInviteCopied(true);})}>{inviteCopied?'Copied':'Copy invitation'}</button><button onClick={()=>perform(async()=>{await api('/rooms/'+active+'/invite','DELETE');setInvite('');})}>Revoke unused invitations</button></section></div>}
    {joining && <div className="coda-modal-backdrop"><section role="dialog" aria-modal="true" aria-label="Room controls" className="coda-modal"><button className="coda-modal-close" aria-label="Close" onClick={()=>setJoining(false)}><X/></button><h2>You’ve been invited.</h2><p>Joining gives you access to the room’s history. Your messages will be visible to its members and used as context for Coda’s replies.</p>{error && <p role="alert" className="coda-modal-error">{error}</p>}<button className="coda-primary" disabled={pending} onClick={()=>perform(async()=>{const data=await api<{id:string}>('/join','POST',{token:inviteToken.current});sessionStorage.removeItem('coda-invite');inviteToken.current='';await refreshRooms();setActive(data.id);setJoining(false);})}>Join conversation</button></section></div>}
    {showMembers && detail && <div className="coda-modal-backdrop"><section role="dialog" aria-modal="true" aria-label="Room controls" className="coda-modal"><button className="coda-modal-close" aria-label="Close" onClick={()=>setShowMembers(false)}><X/></button><h2>Who’s in the den?</h2>{detail.members.map(member=><div className="coda-member" key={member.id}><span>{member.name}{member.id===detail.room.owner?' · Host':''}</span>{owner && member.id!==user?.id && <button onClick={()=>perform(async()=>{await api('/rooms/'+active+'/members','DELETE',{userId:member.id});await refresh(active);})}>Remove</button>}</div>)}<div className="coda-member"><span>🐾 Coda</span><span>Assistant</span></div>{owner && <><button onClick={()=>perform(async()=>{await api('/rooms/'+active+'/invite','DELETE');setInvite('');})}>Revoke unused invitations</button><button className="coda-danger" disabled={pending || working || detail.busy} onClick={()=>{if(confirm('Delete this room and its entire history?'))void perform(async()=>{await api('/rooms/'+active,'DELETE');const list=await refreshRooms();setActive(list[0]?.id || '');setShowMembers(false);});}}><Trash2 size={15}/> Delete conversation</button></>}</section></div>}
  </div>;
}
