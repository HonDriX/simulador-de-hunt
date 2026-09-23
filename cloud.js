import {createClient} from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/+esm';
const client=createClient('https://zzetsupxfwwcevfknpex.supabase.co','sb_publishable_-nxn3iMc4ZjwYO6-gGspHQ_lHzvXgR9');
const $=id=>document.getElementById(id);
let owner=null,stamp=null,ready=false,generation=0,busy=false;
const tell=text=>{$('account-status').textContent=text;};
function controls(){for(const id of ['cloud-save','cloud-load','cloud-import','cloud-export'])$(id).disabled=busy||!ready;}
function snapshot(){return {version:1,cards:pokeCards.snapshot(),library:pokeCards.library(),combos:pokeCombos.snapshot(),automation:{sequence:$('auto-sequence').value,delay:Number($('auto-delay').value),repeat:$('auto-repeat').checked}};}
function normalize(data){
  const p=data.cards?data:{version:1,cards:data,library:data.team||[],combos:Array(6).fill(null),automation:data.automation||{sequence:'poke 1 cds 1 a 6',delay:0.5,repeat:false}};
  pokeCards.validate(p.cards);pokeCards.validateLibrary(p.library);
  const validSequence=c=>c&&typeof c.sequence==='string'&&c.sequence.length<=20000&&Number.isFinite(c.delay)&&c.delay>=0.1&&c.delay<=60&&typeof c.repeat==='boolean';
  if(!Array.isArray(p.combos)||p.combos.length!==6||p.combos.some(c=>c!==null&&!validSequence(c))||!validSequence(p.automation))throw Error('Combos ou sequência inválidos.');
  if(new TextEncoder().encode(JSON.stringify(p)).length>900000)throw Error('Backup muito grande.');
  return p;
}
function apply(p){normalize(p);pokeCombos.stop();pokeCards.restore(p.cards,p.library);pokeCombos.restore(p.combos);$('auto-sequence').value=p.automation.sequence;$('auto-delay').value=p.automation.delay;$('auto-repeat').checked=p.automation.repeat;}
function clear(){pokeCombos.stop();pokeCards.reset();pokeCombos.restore(Array(6).fill(null));$('auto-sequence').value='poke 1 cds 1 a 6';$('auto-delay').value=0.5;$('auto-repeat').checked=false;}
async function load(){
  const id=owner,gen=generation;
  const {data,error}=await client.from('pokemon_saves').select('payload,updated_at').eq('user_id',id).maybeSingle();
  if(gen!==generation)return;
  if(error)throw error;
  if(data){apply(normalize(data.payload));stamp=data.updated_at;tell('Seus dados foram carregados da conta.');}
  else{clear();stamp=null;tell('Nenhum backup na conta ainda.');}
  ready=true;$('calculator').hidden=false;
}
async function save(){
  if(!owner||!ready)throw Error('Entre na conta e carregue seus dados primeiro.');
  const id=owner,gen=generation,payload=normalize(snapshot()),updated_at=new Date().toISOString();
  const row={user_id:id,payload,updated_at};
  const query=stamp?client.from('pokemon_saves').update(row).eq('user_id',id).eq('updated_at',stamp):client.from('pokemon_saves').insert(row);
  const {data,error}=await query.select('updated_at').maybeSingle();
  if(gen!==generation)return;
  if(error){if(error.code==='23505')throw Error('Há dados mais recentes na conta. Exporte seu backup antes de carregar novamente.');throw error;}
  if(!data)throw Error('Outra aba atualizou a conta. Exporte seu backup antes de carregar novamente.');
  stamp=data.updated_at;tell('Time, Pokémon individuais e combos salvos na sua conta.');
}
async function task(fn){if(busy)return;busy=true;controls();try{await fn();}catch(e){tell('Não foi possível concluir: '+e.message);}finally{busy=false;controls();}}
async function sessionChanged(session){
  const id=session?.user?.id||null;if(id===owner)return;
  document.body.classList.toggle('signed-out',!id);
  generation++;owner=id;ready=false;stamp=null;clear();$('calculator').hidden=true;$('account-controls').hidden=!id;$('login-form').hidden=!!id;$('account-user').textContent=session?.user?.email||'';controls();
  if(id){try{await load();}catch(e){tell('Falha ao carregar dados. Recarregue a página para tentar novamente: '+e.message);}controls();}
  else tell('Entre ou crie sua conta para salvar seus Pokémon online.');
}
$('login-form').onsubmit=event=>{event.preventDefault();task(async()=>{const {error}=await client.auth.signInWithPassword({email:$('account-email').value.trim(),password:$('account-password').value});if(error)throw error;$('account-password').value='';});};
$('signup').onclick=()=>{if(!$('login-form').reportValidity())return;task(async()=>{const {error}=await client.auth.signUp({email:$('account-email').value.trim(),password:$('account-password').value,options:{emailRedirectTo:location.origin+location.pathname}});if(error)throw error;$('account-password').value='';tell('Confira seu e-mail para confirmar o cadastro. Depois, entre com sua senha.');});};
$('recover').onclick=()=>task(async()=>{if(!$('account-email').reportValidity())return;const {error}=await client.auth.resetPasswordForEmail($('account-email').value.trim(),{redirectTo:location.origin+location.pathname});if(error)throw error;tell('Se houver uma conta, você receberá um e-mail de recuperação.');});
$('recovery-form').onsubmit=event=>{event.preventDefault();task(async()=>{const {error}=await client.auth.updateUser({password:$('new-password').value});if(error)throw error;$('new-password').value='';$('recovery-form').hidden=true;tell('Senha atualizada.');});};
$('cloud-save').onclick=()=>task(save);
$('cloud-load').onclick=()=>task(load);
$('cloud-import').onclick=()=>$('cloud-file').click();
$('cloud-file').onchange=event=>{const file=event.target.files[0];event.target.value='';if(!file)return;const gen=generation;task(async()=>{if(file.size>1000000)throw Error('Arquivo muito grande.');const p=normalize(JSON.parse(await file.text()));if(gen!==generation||!ready)return;apply(p);tell('Backup importado. Revise os cards e clique em Salvar alterações.');});};
$('cloud-export').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(snapshot(),null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='hondrix-backup-completo.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
$('signout').onclick=()=>task(async()=>{const {error}=await client.auth.signOut({scope:'local'});if(error)throw error;await sessionChanged(null);});
client.auth.onAuthStateChange((event,session)=>{if(event==='PASSWORD_RECOVERY')$('recovery-form').hidden=false;setTimeout(()=>sessionChanged(session),0);});
const {data,error}=await client.auth.getSession();
if(error)tell('Falha no acesso: '+error.message);else if(data.session)await sessionChanged(data.session);else tell('Entre ou crie sua conta para salvar seus Pokémon online.');
controls();
