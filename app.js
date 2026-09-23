(() => {
  const E = CooldownEngine;
  const localStorage = {getItem:()=>null,setItem:()=>{}};
  const makePokemon = name => ({ name, held: 0, heldCrit: 0, atk: 0, food: null, heldMode: 'percent', moves: [25, 40, 40, 40, 50, 50].map((base, i) => ({ name: `Golpe ${i + 1}`, base, damagePerHit: 0, hits: 1, remaining: 0, total: 0 })) });
  const state = { active: 0, disk: 6, globalCrit: 0, globalAtk: 0, elapsed: 0, team: ['Charizard','Blastoise','Venusaur','Pikachu','Gengar','Dragonite'].map(makePokemon) };
  state.box = E.newBox();
  let paused = true, last = performance.now();
  const team = document.getElementById('team');
  const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt = n => n < 10 ? n.toFixed(1) : Math.ceil(n).toString();
  const say = s => { document.getElementById('announcement').textContent = s; };
  function sync() { const now = performance.now(); if (!paused) E.advance(state, (now-last)/1000); last = now; }
  function render() {
    team.innerHTML = state.team.map((p,i) => `<article class="pokemon" data-index="${i}">
      <div class="card-heading"><button class="choose" data-action="swap" aria-pressed="false"><span class="number">${String(i+1).padStart(2,'0')}</span><span><span class="name">${escape(p.name)}</span><span class="position"></span></span></button><span class="ready-count"></span></div>
      <div class="equipment"><span class="disk-label"></span><span class="held-label"></span><span class="crit-label"></span></div>
      <div class="foods"><label><input type="checkbox" data-field="food" value="blaziken" ${p.food==='blaziken'?'checked':''}> Blaziken Food (3% atk)</label><label><input type="checkbox" data-field="food" value="salad" ${p.food==='salad'?'checked':''}> Elite Salad (3% crítico)</label></div>
      <div class="moves">${p.moves.map((m,j) => `<button class="move" data-action="cast" data-move="${j}"><span class="move-title">${escape(m.name)}</span><span class="move-value"></span><span class="move-meta"></span><span class="fill"></span></button>`).join('')}</div>
      <details><summary>Configurar Pokémon e golpes</summary><div class="settings">
        <div class="settings-heading"><label>Nome do Pokémon<input data-field="name" value="${escape(p.name)}" maxlength="35"></label><button class="quiet" data-action="save-pokemon">Salvar Pokémon</button><button class="quiet remove" data-action="remove" ${state.team.length===1?'disabled':''}>Remover</button></div>
        <div class="equipment-inputs"><label>Redução de cooldown do held (%)<input data-field="held" type="number" min="0" max="100" step="0.1" value="${p.held}"></label><label>Chance de crítico do held (%)<input data-field="heldCrit" type="number" min="0" max="100" step="0.1" value="${p.heldCrit}"></label><label>ATK (%)<input data-field="atk" type="number" min="0" max="10000" step="0.1" value="${p.atk||0}"></label></div>
        <p class="setting-note">ATK soma com o ATK global e com os 3% da Blaziken Food.</p>
        <p class="setting-note crit-detail"></p>
        <div class="move-config">${p.moves.map((m,j)=>`<fieldset class="move-fields"><legend>Golpe ${j+1}</legend><label>Nome<input aria-label="Nome do golpe ${j+1}" data-field="moveName" data-move="${j}" maxlength="24" value="${escape(m.name)}"></label><label>Cooldown base (s)<input aria-label="Cooldown base do golpe ${j+1} em segundos" type="number" min="0" max="86400" step="0.1" data-field="base" data-move="${j}" value="${m.base}"></label><label>Dano por hit<input aria-label="Dano por hit do golpe ${j+1}" type="number" min="0" max="1000000000" step="0.1" data-field="damagePerHit" data-move="${j}" value="${m.damagePerHit}"></label><label>Número de hits<input aria-label="Número de hits do golpe ${j+1}" type="number" min="1" max="10000" step="1" data-field="hits" data-move="${j}" value="${m.hits}"></label><output class="damage-summary" data-summary="${j}"></output></fieldset>`).join('')}</div>
        <p class="setting-note">Os tempos iniciais são exemplos. Configure os valores do seu jogo. Mudanças no held e no cooldown base valem no próximo uso.</p>
      </div></details></article>`).join('');
    document.getElementById('count').textContent = String(state.team.length).padStart(2,'0');
    document.getElementById('add').disabled = state.team.length >= 12;
    update();
  }
  function updateBox() {
    const box=state.box, dead=box.targets.filter(t=>t.hp===0).length;
    document.getElementById('box-center').textContent=state.team[state.active].name;
    document.getElementById('box-count').textContent=`${dead}/8 derrotados`;
    box.targets.forEach(t=>{
      const tile=document.getElementById(`dummy-${t.id}`);
      tile.classList.toggle('dead',t.hp===0);
      tile.querySelector('.dummy-hp').textContent=t.hp===0?'Derrotado':`${Math.ceil(t.hp).toLocaleString('pt-BR')} HP`;
      tile.querySelector('progress').value=t.hp;
      tile.querySelector('.dummy-hit').textContent=`${t.lastDamage ? '−'+t.lastDamage.toLocaleString('pt-BR',{maximumFractionDigits:1})+' · ' : ''}Críticos acumulados: ${t.totalCriticalHits||0}/${t.totalHits||0} hits`;
    });
    const duration=box.startedAt===null?0:(box.finishedAt??state.elapsed)-box.startedAt;
    document.getElementById('box-time').textContent=`${duration.toFixed(1)}s · ${box.casts} golpes usados`;
    const message=box.finishedAt!==null?`Box finalizada! Os 8 dummies morreram em ${duration.toFixed(1)}s, com ${box.casts} golpes.`:box.startedAt===null?'Configure o dano dos golpes e use-os para começar.':`Último golpe: ${box.lastMove}`;
    const status=document.getElementById('box-status');
    if(status.textContent!==message)status.textContent=message;
    status.classList.toggle('complete',box.finishedAt!==null);
  }
  const diskNames={"3":"Nightmare Disk 4.0","4":"Nightmare Disk 3.0","6":"Nightmare Disk 2.0","8":"Nightmare Disk 1.0"};
  const diskImages={"3":"https://wiki.pokexgames.com/images/6/6f/Nightmare-disk-4.0.png","4":"https://wiki.pokexgames.com/images/c/c8/Nightmare-disk-3.png","6":"https://wiki.pokexgames.com/images/9/9a/Nightmare-disk-2.png","8":"https://wiki.pokexgames.com/images/2/28/Nightmare-disk-1.png"};
  function update() {
    const diskImage=document.getElementById("disk-image");
    diskImage.hidden=!state.disk;
    if(state.disk){diskImage.src=diskImages[state.disk];diskImage.alt=diskNames[state.disk];}
    document.getElementById("disk-effect").textContent=state.disk?`Recupera 1s a cada ${state.disk}s dentro da ball.`:"Sem recuperação dentro da ball.";
    updateBox();
    document.getElementById('elapsed').textContent = `${String(Math.floor(state.elapsed/60)).padStart(2,'0')}:${(state.elapsed%60).toFixed(1).padStart(4,'0')}`;
    document.getElementById('active-label').textContent = `${state.team[state.active].name} fora da ball${paused?' · pausado':''}`;
    [...team.children].forEach((card,i) => {
      const p = state.team[i], active = i === state.active;
      card.classList.toggle('active',active);
      card.querySelector('.choose').setAttribute('aria-pressed',String(active));
      card.querySelector('.choose').setAttribute('aria-label',`${p.name}: ${active?'fora da ball':'colocar fora da ball'}`);
      card.querySelector('.name').textContent=p.name;
      card.querySelector('.position').textContent=active?'FORA DA BALL · 1s/s':state.disk?`NA BALL · 1s a cada ${state.disk}s`:'NA BALL · sem recuperação';
      card.querySelector('.ready-count').textContent=`${p.moves.filter(m=>m.remaining<=0.000001).length}/${p.moves.length} prontos`;
      card.querySelector('.disk-label').textContent=active?'Disco não se aplica':state.disk?`${diskNames[state.disk]} · 1:${state.disk}`:'Sem disco';
      card.querySelector('.held-label').textContent=p.held?`CD −${p.held}${p.heldMode==='percent'?'%':'s'}`:'Sem redução de CD';
      const chance = Number(E.criticalChance(state,p).toFixed(2));
      card.querySelector('.crit-label').textContent=`Crítico ${chance}% · dano ×2`;
      card.querySelector('.crit-detail').textContent=`${state.globalCrit}% global + ${p.heldCrit}% do held${p.food==='salad'?' + 3% da Elite Salad':''} = ${chance}% de crítico${state.globalCrit+p.heldCrit+(p.food==='salad'?3:0)>100?' (limite de 100%)':''}. Sorteio independente para cada hit em cada alvo.`;
      card.querySelectorAll('[data-field="food"]').forEach(input=>{input.checked=p.food===input.value;});
      card.querySelectorAll('.move').forEach((button,j)=>{
        const m=p.moves[j], ready=m.remaining<=0.000001, rate=active?1:state.disk?1/state.disk:0;
        button.disabled=!active || !ready;
        button.classList.toggle('ready',ready);
        button.querySelector('.move-title').textContent=m.name;
        button.querySelector('.move-value').textContent=ready?'Pronto':`${fmt(m.remaining)}s`;
        const total=E.effective(m.base,p.held,p.heldMode);
        card.querySelector(`[data-summary="${j}"]`).textContent=`Dano total sem crítico: ${(m.damagePerHit*m.hits*E.attackMultiplier(p, state)*2).toLocaleString('pt-BR', {maximumFractionDigits:2})} por alvo (super efetivo ×2; ATK +${Number(((E.attackMultiplier(p, state)-1)*100).toFixed(2))}%${p.food==='blaziken'?', inclui food':''})`;
        button.querySelector('.move-meta').textContent=ready?`${fmt(total)}s total`:rate?`pronto em ${fmt(m.remaining/rate)}s`:'parado na ball';
        button.querySelector('.fill').style.width=`${ready?100:Math.max(0,100*(1-m.remaining/(m.total||1)))}%`;
        button.setAttribute('aria-label',`${p.name}, ${m.name}: ${ready?`pronto, cooldown ${fmt(total)} segundos${active?', usar golpe':', tire da ball para usar'}`:`${fmt(m.remaining)} segundos de cooldown restantes`}`);
      });
    });
  }
  function swap(index) { sync(); E.swap(state,index); update(); say(`${state.team[index].name} fora da ball`); }
  function cast(index,move,elixir=0) { sync(); const ok=E.cast(state,index,move,Math.random,elixir); update(); if(ok) say(`${state.team[index].moves[move].name} usado`); return ok; }
  team.addEventListener('click',event=>{
    const button=event.target.closest('button[data-action]'); if(!button)return;
    const index=Number(button.closest('[data-index]').dataset.index);
    if(button.dataset.action==='swap')swap(index);
    if(button.dataset.action==='cast')cast(index,Number(button.dataset.move));
    if(button.dataset.action==='remove' && state.team.length>1){sync();state.team.splice(index,1);if(state.active===index)state.active=0;else if(index<state.active)state.active--;render();say('Pokémon removido');}
  });
  team.addEventListener('input',event=>{
    const input=event.target,field=input.dataset.field;if(!field)return;sync();
    const p=state.team[Number(input.closest('[data-index]').dataset.index)],j=Number(input.dataset.move);
    if(field==='name')p.name=input.value||'Pokémon';
    if(field==='moveName')p.moves[j].name=input.value||`Golpe ${j+1}`;
    if(field==='food')p.food=input.checked?input.value:null;
    if(field==='heldCrit'){p.heldCrit=E.percent(input.value);if(Number(input.value)<0||Number(input.value)>100)input.value=p.heldCrit;}
    if(field==='atk'){p.atk=Math.min(10000,Math.max(0,Number(input.value)||0));if(Number(input.value)<0||Number(input.value)>10000)input.value=p.atk;}
    if(field==='damagePerHit'||field==='hits'){const min=field==='hits'?1:0,max=field==='hits'?10000:1000000000;const raw=Number(input.value)||0;const val=Math.min(max,Math.max(min,field==='hits'?Math.floor(raw):raw));p.moves[j][field]=val;if(input.value!==''&&raw!==val)input.value=val;}
    if(field==='held'||field==='base'){const max=field==='held'&&p.heldMode==='percent'?100:86400;const val=Math.min(max,Math.max(0,Number(input.value)||0));if(Number(input.value)<0||Number(input.value)>max)input.value=val;if(field==='held')p.held=val;else p.moves[j].base=val;}
    update();
  });
  document.getElementById('global-disk').addEventListener('change',event=>{sync();state.disk=Number(event.target.value);update();say(state.disk?`Disco global: 1 segundo a cada ${state.disk} segundos, somente dentro da ball`:'Disco desativado');});
  document.getElementById('global-crit').addEventListener('input',event=>{sync();state.globalCrit=E.percent(event.target.value);if(Number(event.target.value)<0||Number(event.target.value)>100)event.target.value=state.globalCrit;update();});
  document.getElementById('global-atk').addEventListener('input',event=>{sync();state.globalAtk=Math.min(10000,Math.max(0,Number(event.target.value)||0));if(Number(event.target.value)<0||Number(event.target.value)>10000)event.target.value=state.globalAtk;update();});
  document.getElementById('pause').onclick=()=>{sync();paused=!paused;document.getElementById('pause').textContent=paused?'Continuar':'Pausar';update();};
  document.getElementById('skip').onclick=()=>{sync();E.advance(state,10);update();say('Avançou 10 segundos');};
  document.getElementById('reset').onclick=()=>{sync();state.team.forEach(p=>p.moves.forEach(m=>{m.remaining=0;m.total=0;}));update();say('Todos os cooldowns estão prontos');};
  document.getElementById('new-box').onclick=()=>{sync();state.box=E.newBox();update();say('Nova box. Cooldowns mantidos.');};
  document.getElementById('restart-box').onclick=()=>{sync();state.elapsed=0;state.box=E.newBox();state.team.forEach(p=>p.moves.forEach(m=>{m.remaining=0;m.total=0;}));update();say('Box e cooldowns reiniciados.');};
  document.getElementById('add').onclick=()=>{if(state.team.length>=12)return;sync();state.team.push(makePokemon(`Pokémon ${state.team.length+1}`));render();const card=team.lastElementChild;card.querySelector('details').open=true;card.querySelector('[data-field=name]').focus();};
  const boxGrid=document.getElementById('box-grid');
  let dummyId=0;
  boxGrid.innerHTML=Array.from({length:9},(_,slot)=>slot===4?'<div class="box-center"><span>FORA DA BALL</span><strong id="box-center"></strong></div>':`<div class="dummy" id="dummy-${dummyId}"><strong>Dummy ${dummyId+1}</strong><span class="dummy-hp"></span><progress max="797539" value="797539" aria-label="Vida do Dummy ${dummyId+1}"></progress><span class="dummy-hit"></span></div>${(dummyId++,'')}`).join('');
  window.pokeSimulator={state,cast,swap,sync,isPaused:()=>paused,resume:()=>{sync();paused=false;document.getElementById('pause').textContent='Pausar';update();}};

  const cardsKey='poke-cards-v1';
  const cardsStatus=text=>{document.getElementById('cards-status').textContent=text;};
  function cardsSnapshot(){return {version:1,team:state.team.map(p=>({...p,moves:p.moves.map(m=>({...m,remaining:0,total:0}))})),active:state.active,disk:state.disk,globalCrit:state.globalCrit,globalAtk:state.globalAtk||0};}
  function validateCards(data){
    const num=(v,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=max;
    if(!data||!Array.isArray(data.team)||data.team.length<1||data.team.length>12)throw Error('Backup de cards inválido.');
    for(const p of data.team){
      if(!p||typeof p.name!=='string'||!num(p.held,100)||!num(p.heldCrit,100)||!num(p.atk||0,10000)||![null,undefined,'blaziken','salad'].includes(p.food)||!Array.isArray(p.moves)||p.moves.length!==6)throw Error('Configuração de Pokémon inválida.');
      for(const m of p.moves)if(!m||typeof m.name!=='string'||!num(m.base,86400)||!num(m.damagePerHit,1e9)||!Number.isInteger(m.hits)||m.hits<1||m.hits>10000)throw Error('Configuração de golpe inválida.');
    }
    if(![0,3,4,6,8].includes(data.disk)||!num(data.globalCrit,100)||!num(data.globalAtk||0,10000))throw Error('Configuração global inválida.');
    return data;
  }
  function restoreCards(data){
    validateCards(data);
    paused=true;state.elapsed=0;last=performance.now();document.getElementById("pause").textContent="Continuar";
    state.team=data.team.map(p=>({...p,atk:p.atk||0,heldMode:'percent',moves:p.moves.map(m=>({...m,remaining:0,total:0}))}));
    state.active=Number.isInteger(data.active)&&data.active>=0&&data.active<state.team.length?data.active:0;
    state.disk=data.disk;state.globalCrit=data.globalCrit;state.globalAtk=data.globalAtk||0;
    state.box=E.newBox();
    document.getElementById('global-disk').value=state.disk;
    document.getElementById('global-crit').value=state.globalCrit;
    document.getElementById('global-atk').value=state.globalAtk;
  }
  document.getElementById('save-cards').onclick=()=>{
    try{localStorage.setItem(cardsKey,JSON.stringify(cardsSnapshot()));cardsStatus('Clique em Salvar na conta para guardar seus dados online.');}
    catch{cardsStatus('Não foi possível salvar no navegador. Use Exportar backup.');}
  };
  document.getElementById('export-cards').onclick=()=>{
    const url=URL.createObjectURL(new Blob([JSON.stringify(cardsSnapshot(),null,2)],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download='meus-cards-pokemon.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);cardsStatus('Backup exportado com os cards e configurações globais.');
  };
  document.getElementById('import-cards').onclick=()=>document.getElementById('cards-file').click();
  document.getElementById('cards-file').onchange=async event=>{
    const file=event.target.files[0];if(!file)return;
    try{
      const data=validateCards(JSON.parse(await file.text()));
      document.getElementById('auto-stop').click();restoreCards(data);render();
      try{localStorage.setItem(cardsKey,JSON.stringify(cardsSnapshot()));cardsStatus('Cards importados. Clique em Salvar na conta para guardá-los online.');}
      catch{cardsStatus('Cards importados apenas nesta sessão; armazenamento indisponível.');}
    }catch(e){cardsStatus('Falha ao importar: '+e.message);}
    event.target.value='';
  };
  try{const saved=localStorage.getItem(cardsKey);if(saved){restoreCards(JSON.parse(saved));cardsStatus('Seus cards salvos foram restaurados.');}}catch{cardsStatus('Não foi possível restaurar o backup do navegador. Você pode importar um arquivo.');}


  const libraryKey='poke-individual-cards-v1';
  let library=[];
  try{const saved=JSON.parse(localStorage.getItem(libraryKey));if(Array.isArray(saved))library=saved;}catch{}
  function renderLibrary(){
    document.getElementById('pokemon-library').innerHTML='<option value="">Escolha um Pokémon salvo</option>'+library.map((p,i)=>'<option value="'+i+'">'+escape(p.name)+'</option>').join('');
  }
  team.addEventListener('click',event=>{
    const button=event.target.closest('[data-action="save-pokemon"]');if(!button)return;
    const p=state.team[Number(button.closest('[data-index]').dataset.index)];
    const card={...p,moves:p.moves.map(m=>({...m,remaining:0,total:0}))};
    const next=[...library,card];
    try{localStorage.setItem(libraryKey,JSON.stringify(next));library=next;renderLibrary();document.getElementById('pokemon-library').value=library.length-1;cardsStatus(p.name+' adicionado à biblioteca. Clique em Salvar na conta.');}
    catch{cardsStatus('Não foi possível salvar o Pokémon no navegador.');}
  });
  document.getElementById('load-pokemon').onclick=()=>{
    const selected=document.getElementById('pokemon-library').value;if(selected===''){cardsStatus('Escolha um Pokémon salvo.');return;}
    if(state.team.length>=12){cardsStatus('Limite de 12 Pokémon. Remova um card antes de carregar outro.');return;}
    try{
      const p=library[Number(selected)];validateCards({...cardsSnapshot(),team:[p]});
      state.team.push({...p,moves:p.moves.map(m=>({...m,remaining:0,total:0}))});render();cardsStatus(p.name+' carregado como um novo card.');
    }catch{cardsStatus('Este Pokémon salvo possui dados inválidos.');}
  };
  renderLibrary();


  window.pokeCards={snapshot:cardsSnapshot,validate:validateCards,
    library:()=>JSON.parse(JSON.stringify(library)),
    validateLibrary(items){if(!Array.isArray(items)||items.length>500)throw Error('Biblioteca inválida (máximo 500).');for(const p of items)validateCards({...cardsSnapshot(),team:[p]});},
    restore(cards,items){this.validate(cards);this.validateLibrary(items);document.getElementById('auto-stop').click();restoreCards(cards);library=JSON.parse(JSON.stringify(items));renderLibrary();render();},
    reset(){this.restore({team:['Charizard','Blastoise','Venusaur','Pikachu','Gengar','Dragonite'].map(makePokemon),active:0,disk:6,globalCrit:0,globalAtk:0},[]);}
  };

  render();setInterval(()=>{sync();update();},100);
  if(document.modelContext?.registerTool){
    const lifecycle=new AbortController();
    const register=tool=>{try{Promise.resolve(document.modelContext.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{}};
    register({name:'read_cooldowns',description:'Lê o time e os cooldowns atuais; índices começam em zero.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute(){sync();update();return JSON.parse(JSON.stringify(state));}});
    register({name:'swap_active_pokemon',description:'Coloca um Pokémon fora da ball e recolhe o anterior.',inputSchema:{type:'object',properties:{index:{type:'integer',minimum:0}},required:['index'],additionalProperties:false},annotations:{readOnlyHint:false},execute(input){if(!Number.isInteger(input?.index)||!state.team[input.index])throw new Error('Pokémon inválido');swap(input.index);return{active:state.active,name:state.team[state.active].name};}});
    register({name:'use_move',description:'Usa um dos seis golpes prontos do Pokémon que está fora da ball.',inputSchema:{type:'object',properties:{move:{type:'integer',minimum:0,maximum:5}},required:['move'],additionalProperties:false},annotations:{readOnlyHint:false},execute(input){if(!Number.isInteger(input?.move)||input.move<0||input.move>=state.team[state.active].moves.length)throw new Error('Golpe inválido');if(!cast(state.active,input.move))throw new Error('Golpe em cooldown');return{remaining:state.team[state.active].moves[input.move].remaining};}});
    window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
  }
})();
