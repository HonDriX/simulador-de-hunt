(function(root){
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
        return;
      }
      if(/^\s*revive\s*$/i.test(clean)){steps.push({type:'revive'});return;}
      const match=clean.match(/^\s*(?:poke(?:mon)?)\s*(\d+)\s+(?:cds?|golpes?)\s+(.+?)\s*$/i);
      if(!match)throw Error(`Linha ${i+1}: use "poke 1 cd 1 3 4 5" ou "poke 1 cds 1 a 6".`);
      const p=Number(match[1])-1,selection=match[2];
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
  if(typeof module!=='undefined'){module.exports={parseSequence};return;}
  const localStorage={getItem:()=>null,setItem:()=>{}};
  const sim=root.pokeSimulator,$=id=>document.getElementById(id);
  let run=null;
  function message(text){if($('auto-status').textContent!==text)$('auto-status').textContent=text;}
  function controls(){const active=!!run;$('auto-start').disabled=active;$('auto-pause').disabled=!active;$('auto-stop').disabled=!active;$('auto-sequence').disabled=active;$('auto-delay').disabled=active;$('auto-repeat').disabled=active;$('auto-pause').textContent=run?.paused?'Continuar sequência':'Pausar sequência';}
  function stop(text){run=null;controls();message(text);}
  $('auto-start').onclick=()=>{
    try{
      if(sim.state.box.finishedAt!==null)throw Error('Crie uma nova box antes de iniciar.');
      const steps=parseSequence($('auto-sequence').value,sim.state.team);
      const delay=Number($('auto-delay').value);
      if(!Number.isFinite(delay)||delay<0.1||delay>60)throw Error('Use um intervalo entre 0,1 e 60 segundos.');
      sim.resume();run={steps,index:0,delay,nextAt:sim.state.elapsed,repeat:$('auto-repeat').checked,paused:false,cycle:1};controls();message('Sequência iniciada.');tick();
    }catch(e){message(e.message);}
  };
  $('auto-pause').onclick=()=>{if(!run)return;if(run.paused){run.nextAt+=sim.state.elapsed-run.pausedAt;run.paused=false;}else{run.paused=true;run.pausedAt=sim.state.elapsed;}controls();message(run.paused?'Sequência pausada; cooldowns continuam recuperando.':'Sequência retomada.');};
  $('auto-stop').onclick=()=>stop('Sequência parada. Vida e cooldowns mantidos.');
  ['new-box','restart-box'].forEach(id=>$(id).addEventListener('click',()=>{if(run)stop('Sequência parada para iniciar uma nova box.');}));
  function tick(){
    if(!run)return;
    sim.sync();
    if(sim.state.box.finishedAt!==null){stop('Box finalizada! Os 8 dummies morreram. Sequência encerrada.');return;}
    if(run.paused)return;
    if(sim.isPaused()){message('Simulação pausada. Continue a simulação para executar a sequência.');return;}
    if(sim.state.elapsed<run.nextAt)return;
    const step=run.steps[run.index];
    if(step.type==='revive'){
      const pokemon=sim.state.team[sim.state.active];
      pokemon.moves.forEach(m=>{m.remaining=0;m.total=0;});
      sim.swap(sim.state.active);
      message(`Revive: cooldowns de ${pokemon.name} recuperados.`);
      nextStep();return;
    }
    const p=sim.state.team.indexOf(step.pokemon);
    if(p<0||step.pokemon.moves[step.moveIndex]!==step.move){stop('Sequência interrompida: um Pokémon ou golpe foi removido.');return;}
    if(sim.state.active!==p)sim.swap(p);
    const label=`Ciclo ${run.cycle} · ${run.index+1}/${run.steps.length} · ${step.pokemon.name} · ${step.move.name}`;
    if(step.move.remaining>0.000001){message(`${label}: aguardando cooldown (${step.move.remaining.toFixed(1)}s).`);return;}
    if(!sim.cast(p,step.moveIndex,step.elixir))return;
    message(`${label}: usado${step.elixir?` · Elixir +${step.elixir}%`:""}.`);
    if(sim.state.box.finishedAt!==null){stop('Box finalizada! Os 8 dummies morreram. Sequência encerrada.');return;}
    nextStep();
  }
  function nextStep(){
    run.index++;run.nextAt=sim.state.elapsed+run.delay;
    if(run.index===run.steps.length){if(run.repeat){run.index=0;run.cycle++;}else stop('Sequência concluída.');}
  }

  const comboKey='poke-saved-combos-v1';
  let combos=Array(6).fill(null);
  try{const saved=JSON.parse(localStorage.getItem(comboKey));if(Array.isArray(saved)&&saved.length===6)combos=saved;}catch{}
  function comboMessage(text){$('combo-status').textContent=text;}
  function renderCombos(){
    $('combo-list').innerHTML=combos.map((c,i)=>'<div class="combo-row"><button data-combo="'+i+'" data-action="run" '+(!c?'disabled':'')+'>▶ Combo '+(i+1)+'</button><button class="quiet" data-combo="'+i+'" data-action="load" '+(!c?'disabled':'')+'>Editar</button><button class="quiet" data-combo="'+i+'" data-action="save">Salvar atual</button></div>').join('');
  }
  $('combo-list').addEventListener('click',event=>{
    const button=event.target.closest('button[data-combo]');if(!button)return;
    const i=Number(button.dataset.combo),action=button.dataset.action;
    try{
      if(action==='save'){
        const sequence=$('auto-sequence').value,delay=Number($('auto-delay').value);
        parseSequence(sequence,sim.state.team);
        if(!Number.isFinite(delay)||delay<0.1||delay>60)throw Error('Use um intervalo entre 0,1 e 60 segundos.');
        combos[i]={sequence,delay,repeat:$('auto-repeat').checked};renderCombos();
        try{localStorage.setItem(comboKey,JSON.stringify(combos));comboMessage('Combo '+(i+1)+' preparado. Clique em Salvar na conta.');}catch{comboMessage('Combo salvo apenas nesta sessão: armazenamento indisponível.');}
        return;
      }
      const combo=combos[i];if(!combo)return;
      if(action==='run'){
        parseSequence(combo.sequence,sim.state.team);
        if(sim.state.box.finishedAt!==null)throw Error('Crie uma nova box antes de iniciar.');
      }
      if(run)stop('Sequência anterior interrompida.');
      $('auto-sequence').value=combo.sequence;$('auto-delay').value=combo.delay;$('auto-repeat').checked=combo.repeat;
      if(action==='run'){$('auto-start').onclick();comboMessage('Combo '+(i+1)+' selecionado. A execução aparece em Sequência automática.');}
      else{comboMessage('Edite a sequência acima e clique em Salvar atual no Combo '+(i+1)+'.');$('auto-sequence').focus();}
    }catch(e){comboMessage(e.message);}
  });
  renderCombos();

  root.pokeCombos={snapshot:()=>JSON.parse(JSON.stringify(combos)),restore(items){combos=JSON.parse(JSON.stringify(items));renderCombos();},stop:()=>stop('Sequência parada.')};
  controls();setInterval(tick,100);
})(globalThis);
