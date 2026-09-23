import {createClient} from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/+esm';
const client=createClient('https://zzetsupxfwwcevfknpex.supabase.co','sb_publishable_-nxn3iMc4ZjwYO6-gGspHQ_lHzvXgR9');
const $=id=>document.getElementById(id);
let owner=null,stamp=null,ready=false,generation=0,busy=false,guest=false;
const localKey="hondrix-guest-backup-v1";
let lastLocal="";
const tell=text=>{$('account-status').textContent=text;};
const importStatus=text=>{tell(text);$('cards-status').textContent=text;};
function controls(){for(const id of ['cloud-save','cloud-load','cloud-import','cloud-export','import-cards'])$(id).disabled=busy||!ready;}
function snapshot(){return {version:1,cards:pokeCards.snapshot(),library:pokeCards.library(),combos:pokeCombos.snapshot(),automation:{sequence:$('auto-sequence').value,delay:Number($('auto-delay').value),repeat:$('auto-repeat').checked}};}
function normalize(data){
  if(!data||typeof data!=='object'||Array.isArray(data))throw Error('Backup inválido.');
  const p=data.cards?data:{version:1,cards:data,library:data.team||[],combos:Array(6).fill(null),automation:data.automation||{sequence:'poke 1 cds 1 a 6',delay:0.5,repeat:false}};
  try{pokeCards.validate(p.cards);}catch(e){throw Error('Time: '+e.message);}
  try{pokeCards.validateLibrary(p.library);}catch(e){throw Error('Biblioteca: '+e.message);}
  const validSequence=c=>c&&typeof c.sequence==='string'&&c.sequence.length<=20000&&Number.isFinite(c.delay)&&c.delay>=0.1&&c.delay<=60&&typeof c.repeat==='boolean';
  if(!Array.isArray(p.combos)||p.combos.length!==6||p.combos.some(c=>c!==null&&!validSequence(c))||!validSequence(p.automation))throw Error('Combos ou sequência inválidos.');
  if(new TextEncoder().encode(JSON.stringify(p)).length>900000)throw Error('Backup muito grande.');
  p.cards.globalAtk=p.cards.globalAtk||0;
  return p;
}
function apply(p){normalize(p);pokeCombos.stop();pokeCards.restore(p.cards,p.library);pokeCombos.restore(p.combos);$('auto-sequence').value=p.automation.sequence;$('auto-delay').value=p.automation.delay;$('auto-repeat').checked=p.automation.repeat;}
function clear(){pokeCombos.stop();pokeCards.reset();pokeCombos.restore(Array(6).fill(null));$('auto-sequence').value='poke 1 cds 1 a 6';$('auto-delay').value=0.5;$('auto-repeat').checked=false;}
async function load(migrateLocal=false){
  if(guest){const raw=localStorage.getItem(localKey);if(raw){apply(normalize(JSON.parse(raw)));lastLocal=JSON.stringify(snapshot());tell('Backup local carregado.');}else tell('Ainda não há backup neste navegador.');return;}
  const id=owner,gen=generation;
  const {data,error}=await client.from('pokemon_saves').select('payload,updated_at').eq('user_id',id).maybeSingle();
  if(gen!==generation)return;
  if(error)throw error;
  if(data){apply(normalize(data.payload));stamp=data.updated_at;tell('Seus dados foram carregados da conta.');}
  else{
    stamp=null;
    const raw=migrateLocal?localStorage.getItem(localKey):null;
    if(raw){
      apply(normalize(JSON.parse(raw)));ready=true;$('calculator').hidden=false;
      try{await save();tell('Seus cards e combos locais foram salvos automaticamente na conta.');}
      catch(e){tell('Dados locais carregados, mas não foi possível salvar na conta: '+e.message+'. Tente Salvar alterações.');}
    }else{clear();tell('Nenhum backup na conta ainda.');}
  }
  ready=true;$('calculator').hidden=false;
}
async function save(){
  if(guest){saveLocal();tell('Cards e combos salvos neste navegador. Exporte um backup para levar a outro computador.');return;}
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
  if(guest){try{saveLocal();}catch(e){tell("Falha ao preservar a cópia local: "+e.message);}}guest=false;
  document.body.classList.toggle('signed-out',!id);
  generation++;owner=id;ready=false;stamp=null;clear();$('account-password').value='';$('new-password').value='';$('calculator').hidden=true;$('account-controls').hidden=!id;$('login-form').hidden=!!id;$('account-user').textContent=session?.user?.email||'';modeLabels();controls();
  if(id){try{await load(true);}catch(e){tell('Falha ao carregar dados. Recarregue a página para tentar novamente: '+e.message);}controls();}
  else tell('Entre ou crie sua conta para salvar seus Pokémon online.');
}

function modeLabels(){
 $('cloud-save').textContent=guest?'Salvar neste navegador':'Salvar alterações';
 $('cloud-load').textContent=guest?'Carregar backup local':'Carregar da conta';
 $('signout').textContent=guest?'Entrar / criar conta':'Sair da conta';
 $('cloud-use-local').hidden=guest||!owner;
 $('guest-entry').hidden=!!owner||guest;
 $('storage-note').textContent=guest?'Salvamento automático neste navegador. Exporte um backup para transferir seus dados. Limpar os dados do site apaga a cópia local.':'No primeiro acesso de uma conta vazia, os dados locais são importados automaticamente. Depois, use Salvar alterações para atualizar a nuvem.';
}
function saveLocal(){const value=JSON.stringify(normalize(snapshot()));localStorage.setItem(localKey,value);lastLocal=value;}
function enterGuest(){
 if(owner||busy)return;
 try{
 const raw=localStorage.getItem(localKey),data=raw?normalize(JSON.parse(raw)):null;
 generation++;clear();if(data)apply(data);guest=true;ready=true;stamp=null;
 lastLocal=JSON.stringify(snapshot());
 document.body.classList.remove('signed-out');$('calculator').hidden=false;$('account-controls').hidden=false;$('login-form').hidden=true;$('account-user').textContent='Modo local · sem conta';modeLabels();controls();
 tell('Modo local. Exporte um backup para levar seus dados a outro dispositivo.');
 }catch(e){tell('Não foi possível abrir o modo local: '+e.message);}
}
$('guest-entry').onclick=enterGuest;
$('cloud-use-local').onclick=()=>task(async()=>{const raw=localStorage.getItem(localKey);if(!raw)throw Error('Nenhum backup local neste navegador. Use Importar backup se estiver em outro computador.');apply(normalize(JSON.parse(raw)));tell('Dados locais carregados para revisão. Clique em Salvar alterações para enviá-los à sua conta.');});
setInterval(()=>{if(!guest||!ready||busy)return;try{const value=JSON.stringify(normalize(snapshot()));if(value!==lastLocal){localStorage.setItem(localKey,value);lastLocal=value;tell('Alterações salvas automaticamente neste navegador.');}}catch(e){tell('Não foi possível salvar automaticamente. Exporte um backup: '+e.message);}},1000);

$('login-form').onsubmit=event=>{event.preventDefault();task(async()=>{const {error}=await client.auth.signInWithPassword({email:$('account-email').value.trim(),password:$('account-password').value});if(error)throw error;$('account-password').value='';});};
$('signup').onclick=()=>{if(!$('login-form').reportValidity())return;task(async()=>{const {error}=await client.auth.signUp({email:$('account-email').value.trim(),password:$('account-password').value,options:{emailRedirectTo:location.origin+location.pathname}});if(error)throw error;$('account-password').value='';tell('Confira seu e-mail para confirmar o cadastro. Depois, entre com sua senha.');});};
$('recover').onclick=()=>task(async()=>{if(!$('account-email').reportValidity())return;const {error}=await client.auth.resetPasswordForEmail($('account-email').value.trim(),{redirectTo:location.origin+location.pathname});if(error)throw error;tell('Se houver uma conta, você receberá um e-mail de recuperação.');});
$('recovery-form').onsubmit=event=>{event.preventDefault();task(async()=>{const {error}=await client.auth.updateUser({password:$('new-password').value});if(error)throw error;$('new-password').value='';$('recovery-form').hidden=true;tell('Senha atualizada.');});};
$('cloud-save').onclick=()=>task(save);
$('cloud-load').onclick=()=>task(load);
$('cloud-import').onclick=()=>$('cloud-file').click();
async function importData(data){
 if(!ready)throw Error('Entre na conta ou escolha Usar sem conta antes de importar.');
 const p=normalize(data);apply(p);document.querySelector('[data-panel="pokemon"]').click();
 const message=p.cards.team.length+' Pokémon e '+p.library.length+' cards da biblioteca importados.';
 if(guest){saveLocal();importStatus(message+' Salvos neste navegador.');}
 else importStatus(message+' Clique em Salvar alterações para guardar na conta.');
}
window.pokeBackup={importData};
function describeBackup(data){
 const type=value=>value===null?'nulo':Array.isArray(value)?'lista':typeof value==='object'?'objeto':typeof value==='string'?'texto':typeof value==='number'?'número':typeof value==='undefined'?'ausente':typeof value;
 if(!data||typeof data!=='object'||Array.isArray(data))return 'Formato: JSON do tipo '+type(data)+' (esperado: objeto de backup).';
 const full=Object.prototype.hasOwnProperty.call(data,'cards');
 const cards=full?data.cards:data;
 const count=value=>Array.isArray(value)?value.length+' itens':type(value);
 return ['Formato: '+(full?'backup completo':Array.isArray(data.team)?'backup de cards':'JSON sem cards/team reconhecidos'),
 'Time: '+count(cards?.team),full?'Biblioteca: '+count(data.library):'Biblioteca: será criada com o time',
 full?'Combos: '+count(data.combos):'Combos: ausentes neste formato'].join('\n');
}
function importDetails(lines,failed=false){
 $('import-diagnostics').hidden=false;$('import-diagnostics').open=failed;
 $('import-diagnostic-text').textContent=lines.join('\n');
}
$('cloud-file').onchange=$('cards-file').onchange=event=>{
 const file=event.target.files[0];event.target.value='';if(!file)return;
 const gen=generation,lines=['Versão: import3','Arquivo: '+file.name,'Tamanho: '+file.size+' bytes','Origem: '+(event.target.id==='cloud-file'?'Conta e backups':'Seu time')];
 if(busy){importStatus('Aguarde a operação atual terminar e selecione o arquivo novamente.');importDetails([...lines,'Resultado: importação não iniciada (outra operação em andamento).'],true);return;}
 return task(async()=>{
  let stage='leitura do arquivo';
  try{
   importDetails([...lines,'Lendo arquivo…']);
   if(file.size>1000000)throw Error('O arquivo excede o limite de 1 MB.');
   const text=await file.text();
   if(globalThis.crypto?.subtle){try{const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));lines.push('Identificador do conteúdo: '+Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('').slice(0,16));}catch{}}
   stage='leitura do JSON';
   let data;try{data=JSON.parse(text.replace(/^\uFEFF/,''));}catch{throw Error(text.trim()?'O arquivo não contém JSON válido.':'O arquivo está vazio.');}
   lines.push(describeBackup(data));
   stage='validação do backup';
   const normalized=normalize(data);
   if(gen!==generation)throw Error('A conta mudou durante a importação. Selecione o arquivo novamente.');
   stage='restauração dos dados';
   await importData(normalized);
   importDetails([...lines,'Resultado: importado com sucesso.']);
  }catch(e){
   importStatus('Falha ao importar: '+e.message+' Veja os detalhes abaixo dos botões de backup.');
   document.querySelector('[data-panel="pokemon"]').click();
   importDetails([...lines,'Etapa: '+stage,'Resultado: '+e.message],true);
  }
 });
};
$('cloud-export').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(snapshot(),null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='hondrix-backup-completo.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
$('signout').onclick=()=>task(async()=>{if(guest){saveLocal();guest=false;ready=false;generation++;clear();document.body.classList.add('signed-out');$('calculator').hidden=true;$('account-controls').hidden=true;$('login-form').hidden=false;modeLabels();tell('Entre para usar seus dados online. A cópia local foi preservada.');return;}const {error}=await client.auth.signOut({scope:'local'});if(error)throw error;await sessionChanged(null);});
client.auth.onAuthStateChange((event,session)=>{if(event==='PASSWORD_RECOVERY')$('recovery-form').hidden=false;setTimeout(()=>sessionChanged(session),0);});
const {data,error}=await client.auth.getSession();
if(error)tell('Falha no acesso: '+error.message);else if(data.session)await sessionChanged(data.session);else tell('Entre ou crie sua conta para salvar seus Pokémon online.');
controls();

