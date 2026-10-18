(function(root){
  const plain=text=>text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
  // Acha o Pokémon pelo nome, sem diferenciar acentos nem maiúsculas; o antigo "poke N" ainda vale pela posição.
  function findPokemon(who,team){
    const name=plain(who),byName=team.findIndex(p=>plain(p.name)===name);
    if(byName>=0)return byName;
    const legacy=name.match(/^poke(?:mon)?\s*(\d+)$/);
    return legacy&&team[Number(legacy[1])-1]?Number(legacy[1])-1:-1;
  }
  const pokemonLine=/^\s*(.+?)\s+(?:cds?|golpes?)\s+(\d.*?)\s*$/i;
  // Grava o combo com o nome do Pokémon: troca "poke N" (e variações de escrita) pelo nome de quem está no time.
  function namedSequence(text,team){
    return text.split(/\r?\n/).map(line=>{
      const match=line.match(pokemonLine),p=match?findPokemon(match[1],team):-1;
      return p>=0?`${team[p].name} cds ${match[2]}`:line;
    }).join('\n');
  }
  function parseSequence(text,team){
    const steps=[];
    let pendingElixir=null;
    text.split(/\r?\n/).forEach((line,i)=>{
      if(!line.trim())return;
      const clean=line.normalize('NFD').replace(/[\u0300-\u036f]/g,'');
      const elixir=clean.match(/^\s*elixir(?:\s+(\d+(?:[.,]\d+)?)\s*%?)?\s*$/i);
      if(elixir){
        if(pendingElixir!==null)throw Error(`Linha ${i+1}: o elixir anterior precisa de uma linha de Pokémon.`);
        pendingElixir=elixir[1]===undefined?70:Number(elixir[1].replace(',','.'));
        if(!Number.isFinite(pendingElixir)||pendingElixir>10000)throw Error('Elixir deve estar entre 0 e 10000%.');
        steps.push({type:'elixir',bonus:pendingElixir});
        return;
      }
      const revive=clean.match(/^\s*revive(?:\s+([45])\s*(?:min)?)?(\s+pular)?\s*$/i);
      if(revive){steps.push({type:'revive',cooldown:(Number(revive[1])||5)*60,skip:!!revive[2]});return;}
      const match=line.match(pokemonLine);
      if(!match)throw Error(`Linha ${i+1}: use o nome do Pokémon, como "Zoroark cds 1 a 6" ou "Zoroark cd 1 3 4 5".`);
      const p=findPokemon(match[1],team),selection=match[2].normalize('NFD').replace(/[\u0300-\u036f]/g,'');
      if(p<0)throw Error(`Linha ${i+1}: Pokémon "${match[1].trim()}" não está no time.`);
      const range=selection.match(/^(\d+)\s*(?:a|ate|-)\s*(\d+)$/i);
      let numbers;
      if(range){
        const first=Number(range[1]),last=Number(range[2]);
        if(!team[p]||first<1||last<first||last>team[p].moves.length)throw Error(`Linha ${i+1}: Pokémon ou intervalo de golpes inválido.`);
        numbers=Array.from({length:last-first+1},(_,j)=>first+j);
      }else if(/^\d+(?:\s+\d+)*$/.test(selection))numbers=selection.split(/\s+/).map(Number);
      else throw Error(`Linha ${i+1}: separe os golpes por espaços, como "1 3 4 5", ou use "1 a 6".`);
      if(!team[p]||numbers.some(n=>n<1||n>team[p].moves.length))throw Error(`Linha ${i+1}: Pokémon ou golpe inválido.`);
      for(const n of numbers){const m=n-1;steps.push({pokemon:team[p],move:team[p].moves[m],moveIndex:m,elixir:pendingElixir||0});}
      pendingElixir=null;
    });
    if(pendingElixir!==null)throw Error('Adicione uma linha de Pokémon depois do elixir.');
    if(!steps.some(step=>step.pokemon))throw Error('Adicione pelo menos um golpe à sequência.');
    if(!steps.length)throw Error('Adicione pelo menos uma linha à sequência.');
    return steps;
  }
  if(typeof module!=='undefined'){module.exports={parseSequence,namedSequence};return;}
  root.parseSequence=parseSequence;root.findPokemon=findPokemon;
  const sim=root.pokeSimulator,$=id=>document.getElementById(id);
  let run=null;
  // Limite único de espera pelo revive pulável; valor inválido volta ao padrão.
  const reviveWait=()=>{const v=Number($('revive-wait').value);return $('revive-wait').value!==''&&Number.isFinite(v)&&v>=0&&v<=300?v:5;};
  function message(text){if($('auto-status').textContent!==text)$('auto-status').textContent=text;}
  function controls(){const active=!!run;$('auto-start').disabled=active;$('auto-pause').disabled=!active;$('auto-stop').disabled=!active;$('auto-sequence').disabled=active;$('auto-delay').disabled=active;$('auto-repeat').disabled=active;$('auto-pause').textContent=run?.paused?'Continuar sequência':'Pausar sequência';}
  function stop(text){run=null;controls();message(text);}
  // Encerra a sequência e, se o combo pede, deixa fora da ball o primeiro Pokémon do próximo combo salvo.
  function finish(text){
    let pulled='';
    if(run.pullNext)for(let k=1;k<=combos.length&&!pulled;k++){
      const next=combos[(run.combo+k)%combos.length];
      if(!next)continue;
      try{const first=parseSequence(next.sequence,sim.state.team).find(step=>step.pokemon).pokemon;sim.swap(sim.state.team.indexOf(first));pulled=` ${first.name} fora da ball para o próximo lure.`;}catch{break;}
    }
    stop(text+pulled);
  }
  $('auto-start').onclick=()=>{
    try{
      if(sim.state.box.finishedAt!==null)throw Error('Crie uma nova box antes de iniciar.');
      const steps=parseSequence($('auto-sequence').value,sim.state.team);
      const delay=Number($('auto-delay').value);
      if(!Number.isFinite(delay)||delay<0.1||delay>60)throw Error('Use um intervalo entre 0,1 e 60 segundos.');
      sim.resume();run={steps,index:0,delay,nextAt:sim.state.elapsed,repeat:$('auto-repeat').checked,paused:false,cycle:1,combo:current,pullNext:$('combo-pull').checked&&!$('auto-repeat').checked};controls();message('Sequência iniciada.');tick();
    }catch(e){message(e.message);}
  };
  $('auto-pause').onclick=()=>{if(!run)return;if(run.paused){run.nextAt+=sim.state.elapsed-run.pausedAt;run.paused=false;}else{run.paused=true;run.pausedAt=sim.state.elapsed;}controls();message(run.paused?'Sequência pausada; cooldowns continuam recuperando.':'Sequência retomada.');};
  $('auto-stop').onclick=()=>stop('Sequência parada. Vida e cooldowns mantidos.');
  ['new-box','restart-box'].forEach(id=>$(id).addEventListener('click',()=>{if(run)stop('Sequência parada para iniciar uma nova box.');}));
  function tick(){
    if(!run)return;
    sim.sync();
    if(sim.state.box.finishedAt!==null){finish('Box finalizada! Os 8 dummies morreram. Sequência encerrada.');return;}
    if(run.paused)return;
    if(sim.isPaused()){message('Simulação pausada. Continue a simulação para executar a sequência.');return;}
    if(sim.state.elapsed<run.nextAt)return;
    const step=run.steps[run.index];
    if(step.type==='elixir'){
      if(!root.CooldownEngine.elixir(sim.state)){message('Aguardando elixir ('+Math.ceil(sim.state.elixirRemaining)+'s).');return;}
      // O item não acrescenta um intervalo de golpe; o bônus vale para a etapa seguinte.
      run.index++;tick();return;
    }
    if(step.type==='revive'){
      const pokemon=sim.state.team[sim.state.active];
      if(step.skip&&sim.state.reviveRemaining>reviveWait()){finish(`${run.casts?'Resto do combo pulado':'Combo pulado'}: revive em cooldown (faltam ${Math.ceil(sim.state.reviveRemaining)}s).`);return;}
      if(!root.CooldownEngine.revive(sim.state,step.cooldown)){run.reviveWaitFrom??=sim.state.elapsed;message(`Aguardando revive (${Math.ceil(sim.state.reviveRemaining)}s).`);return;}
      const waited=run.reviveWaitFrom===undefined?0:sim.state.elapsed-run.reviveWaitFrom;delete run.reviveWaitFrom;
      sim.swap(sim.state.active);
      message(`Revive ${step.cooldown/60} min: cooldowns de ${pokemon.name} recuperados${waited?` · esperou ${waited.toFixed(1)}s pelo cooldown`:''}.`);
      nextStep();return;
    }
    const p=sim.state.team.indexOf(step.pokemon);
    if(p<0||step.pokemon.moves[step.moveIndex]!==step.move){stop('Sequência interrompida: um Pokémon ou golpe foi removido.');return;}
    if(sim.state.active!==p)sim.swap(p);
    const label=`Ciclo ${run.cycle} · ${run.index+1}/${run.steps.length} · ${step.pokemon.name} · ${step.move.name}`;
    if(step.move.remaining>0.000001){message(`${label}: aguardando cooldown (${step.move.remaining.toFixed(1)}s).`);return;}
    if(!sim.cast(p,step.moveIndex,step.elixir))return;
    run.casts=(run.casts||0)+1;
    message(`${label}: usado${step.elixir?` · Elixir +${step.elixir}%`:""}.`);
    if(sim.state.box.finishedAt!==null){finish('Box finalizada! Os 8 dummies morreram. Sequência encerrada.');return;}
    nextStep();
  }
  function nextStep(){
    run.index++;run.nextAt=sim.state.elapsed+run.delay;
    if(run.index===run.steps.length){if(run.repeat){run.index=0;run.cycle++;}else finish('Sequência concluída.');}
  }

  // Quantidade de combos é escolha do usuário: começa em 6 e vai de 1 a 20.
  const DEFAULT_COMBOS=6,MAX_COMBOS=20,MAX_MODES=30;
  // Modo de caçar: nome, combos e os nomes dos Pokémon do time. "combos" é sempre a lista do modo ativo.
  let modes=[{name:'Modo 1',combos:Array(DEFAULT_COMBOS).fill(null)}],mode=0,combos=modes[0].combos,current=0;
  function comboMessage(text){$('combo-status').textContent=text;}
  function runnable(c){
    if(!c)return false;
    try{parseSequence(c.sequence,sim.state.team);return true;}catch{return false;}
  }
  function renderCombos(){
    $('combo-tabs').innerHTML=combos.map((c,i)=>'<button type="button" role="tab" data-tab="'+i+'" aria-selected="'+(i===current)+'"'+(!c?' class="empty"':'')+'>Combo '+(i+1)+'</button>').join('')+(combos.length<MAX_COMBOS?'<button type="button" data-add aria-label="Adicionar combo" title="Adicionar combo">+</button>':'');
    $('combo-list').innerHTML=combos.map((c,i)=>'<div class="combo-row"><button data-combo="'+i+'" data-action="run" '+(!runnable(c)?'disabled':'')+'>▶ Combo '+(i+1)+'</button><button class="quiet" data-combo="'+i+'" data-action="load">Editar</button></div>').join('');
    $('combo-remove').disabled=combos.length<=1;
  }
  // A aba escolhida é o combo em edição: os campos da tela sempre mostram combos[current].
  function selectCombo(i){
    if(run)stop('Sequência anterior interrompida.');
    current=i;const c=combos[i];
    $('auto-sequence').value=c?c.sequence:'';$('auto-delay').value=c?c.delay:0.5;$('auto-repeat').checked=!!c?.repeat;$('combo-pull').checked=!!c?.pullNext;
    renderCombos();$('auto-sequence').dispatchEvent(new Event('combo-loaded'));
  }
  function autosave(){
    const sequence=$('auto-sequence').value,delay=Number($('auto-delay').value);
    const validDelay=Number.isFinite(delay)&&delay>=0.1&&delay<=60;
    // Uma etapa incompleta também precisa ser preservada como rascunho.
    combos[current]=sequence.trim()?{sequence:namedSequence(sequence,sim.state.team),delay:validDelay?delay:(combos[current]?.delay||0.5),repeat:$('auto-repeat').checked,pullNext:$('combo-pull').checked}:null;
    renderCombos();
    try{
      if(sequence.trim())parseSequence(sequence,sim.state.team);
      if(!validDelay)throw Error('Use um intervalo entre 0,1 e 60 segundos.');
      message('Combo '+(current+1)+(combos[current]?' atualizado.':' vazio.'));
    }catch(e){message('Rascunho do Combo '+(current+1)+' guardado. Para executar: '+e.message);}
  }
  ['auto-sequence','auto-delay'].forEach(id=>$(id).addEventListener('input',autosave));
  ['auto-repeat','combo-pull'].forEach(id=>$(id).addEventListener('change',autosave));
  $('combo-tabs').addEventListener('click',event=>{
    const tab=event.target.closest('[data-tab]');
    if(event.target.closest('[data-add]'))combos.push(null);
    else if(!tab)return;
    selectCombo(tab?Number(tab.dataset.tab):combos.length-1);if(!tab)message('Combo '+combos.length+' criado.');$('combo-tabs').querySelector('[aria-selected="true"]').focus();
  });
  // Reordena os combos; a aba em edição acompanha o combo que estava aberto.
  function moveCombo(from,to){
    if(from===to||to<0||to>=combos.length)return;
    combos.splice(to,0,combos.splice(from,1)[0]);
    current=current===from?to:from<current&&to>=current?current-1:from>current&&to<=current?current+1:current;
    renderCombos();message('Combo movido para a posição '+(to+1)+'.');
  }
  // Arrasto por eventos de ponteiro: funciona igual com mouse e toque, e em botões no Firefox.
  let drag=null;
  const dropMark=tab=>{$('combo-tabs').querySelectorAll('.drop-target').forEach(t=>t.classList.remove('drop-target'));tab?.classList.add('drop-target');};
  const endDrag=()=>{drag=null;$('combo-tabs').classList.remove('dragging');dropMark(null);};
  $('combo-tabs').addEventListener('pointerdown',event=>{
    const tab=event.target.closest('[data-tab]');
    if(tab&&event.button===0)drag={from:Number(tab.dataset.tab),x:event.clientX,y:event.clientY,moved:false,to:null};
  });
  root.addEventListener('pointermove',event=>{
    if(!drag||!drag.moved&&Math.hypot(event.clientX-drag.x,event.clientY-drag.y)<8)return;
    drag.moved=true;$('combo-tabs').classList.add('dragging');
    const tab=document.elementFromPoint(event.clientX,event.clientY)?.closest('#combo-tabs [data-tab]');
    drag.to=tab?Number(tab.dataset.tab):null;dropMark(tab&&drag.to!==drag.from?tab:null);
  });
  root.addEventListener('pointerup',()=>{if(!drag)return;const {from,to,moved}=drag;endDrag();if(moved&&to!==null)moveCombo(from,to);});
  root.addEventListener('pointercancel',endDrag);
  $('combo-tabs').addEventListener('keydown',event=>{
    const tab=event.target.closest('[data-tab]');
    if(!tab||!event.altKey||!['ArrowLeft','ArrowRight'].includes(event.key))return;
    event.preventDefault();
    const from=Number(tab.dataset.tab),to=from+(event.key==='ArrowLeft'?-1:1);
    moveCombo(from,to);$('combo-tabs').querySelector('[data-tab="'+Math.min(Math.max(to,0),combos.length-1)+'"]').focus();
  });
  $('combo-remove').onclick=()=>{
    if(combos.length<=1)return;
    if(combos[current]&&!confirm('Remover o Combo '+(current+1)+' e suas etapas? Os combos seguintes sobem uma posição.'))return;
    combos.splice(current,1);selectCombo(Math.min(current,combos.length-1));message('Combo removido.');
  };
  $('combo-list').addEventListener('click',event=>{
    const button=event.target.closest('button[data-combo]');if(!button)return;
    const i=Number(button.dataset.combo);
    try{
      if(button.dataset.action==='run'){
        parseSequence(combos[i].sequence,sim.state.team);
        if(sim.state.box.finishedAt!==null)throw Error('Crie uma nova box antes de iniciar.');
        selectCombo(i);$('auto-start').onclick();comboMessage('Combo '+(i+1)+' selecionado. A execução aparece em Sequência automática.');
      }else selectCombo(i);
    }catch(e){comboMessage(e.message);}
  });
  function renderModes(){
    $('mode-select').replaceChildren(...modes.map((m,i)=>new Option(m.name,i)));$('mode-select').value=mode;
    $('mode-delete').disabled=modes.length<=1;$('mode-new').disabled=$('mode-copy').disabled=modes.length>=MAX_MODES;
    $('mode-name').textContent='· '+modes[mode].name;
  }
  // Compara só o que define o card, para saber se o Pokémon do time já está salvo igual na biblioteca.
  const cardKey=p=>JSON.stringify([p.name,p.held,p.heldCrit,p.atk||0,p.food||null,p.moves.map(m=>[m.name,m.base,m.damagePerHit,m.hits,m.focus===true])]);
  // Troca de modo: o time é remontado pelos nomes, com os cards que já estão no time ou a versão mais recente da biblioteca.
  // A biblioteca só é lida. Devolve false se a troca foi cancelada ou não pôde ser feita.
  function switchMode(target){
    const cards=root.pokeCards.snapshot(),library=root.pokeCards.library(),names=modes[target].team;
    let missing=[];
    if(names&&target!==mode){
      const pool=[...cards.team],team=[];
      for(const name of names){
        const key=plain(name),at=pool.findIndex(p=>plain(p.name)===key),card=at>=0?pool.splice(at,1)[0]:library.filter(p=>plain(p.name)===key).pop();
        if(card)team.push(card);else missing.push(name);
      }
      const saved=new Set(library.map(cardKey)),unsaved=pool.filter(p=>!saved.has(cardKey(p))).map(p=>p.name);
      try{
        if(!team.length)throw Error('Nenhum Pokémon do modo "'+modes[target].name+'" está no time ou na biblioteca.');
        if(unsaved.length&&!confirm(unsaved.join(', ')+(unsaved.length>1?' saem do time e têm':' sai do time e tem')+' alterações que não estão salvas na biblioteca. Trocar de modo mesmo assim?'))throw Error('Troca de modo cancelada. Use Salvar Pokémon para guardar as alterações antes.');
        root.pokeCards.restore({...cards,team,active:0},library);
      }catch(e){renderModes();message(e.message);return false;}
    }
    modes[mode].team=cards.team.map(p=>p.name);
    mode=target;combos=modes[mode].combos;renderModes();selectCombo(0);
    message('Modo "'+modes[mode].name+'" selecionado.'+(missing.length?' Não encontrados no time nem na biblioteca: '+missing.join(', ')+'.':''));
    return true;
  }
  const askName=(title,suggestion)=>{const name=(prompt(title,suggestion)||'').trim().slice(0,40);return name||null;};
  function addMode(name,source){
    if(!name||modes.length>=MAX_MODES)return;
    modes.push({name,combos:JSON.parse(JSON.stringify(source)),team:sim.state.team.map(p=>p.name)});
    switchMode(modes.length-1);
  }
  $('mode-select').onchange=()=>switchMode(Number($('mode-select').value));
  $('mode-new').onclick=()=>addMode(askName('Nome do novo modo de caçar:','Modo '+(modes.length+1)),Array(DEFAULT_COMBOS).fill(null));
  $('mode-copy').onclick=()=>addMode(askName('Nome da cópia:',modes[mode].name+' (cópia)'),combos);
  $('mode-rename').onclick=()=>{const name=askName('Novo nome do modo:',modes[mode].name);if(!name)return;modes[mode].name=name;renderModes();message('Modo renomeado.');};
  $('mode-delete').onclick=()=>{
    const old=mode,name=modes[old].name;
    if(modes.length<=1||!confirm('Excluir o modo "'+name+'" e todos os combos dele?'))return;
    if(!switchMode(old===0?1:old-1))return;
    modes.splice(old,1);if(old<mode)mode--;
    renderModes();message('Modo "'+name+'" excluído. Modo "'+modes[mode].name+'" selecionado.');
  };
  renderModes();selectCombo(0);

  root.pokeCombos={snapshot:()=>JSON.parse(JSON.stringify(combos)),
    modes(){const copy=JSON.parse(JSON.stringify(modes));copy[mode].team=sim.state.team.map(p=>p.name);return {modes:copy,mode,combo:current};},
    canonical:namedSequence,
    restore(items,active=0,selected=0){
      modes=JSON.parse(JSON.stringify(items));mode=Math.min(active,modes.length-1);combos=modes[mode].combos;
      // Combos antigos apontavam para a posição no time; passam a guardar o nome.
      for(const c of combos)if(c)c.sequence=namedSequence(c.sequence,sim.state.team);
      renderModes();selectCombo(Math.min(selected,combos.length-1));
    },stop:()=>stop('Sequência parada.'),reviveWait,setReviveWait(value){$('revive-wait').value=value;}};
  controls();setInterval(tick,100);
})(globalThis);
