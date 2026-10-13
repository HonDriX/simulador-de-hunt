(function(root){
  function decode(text){
    return text.split(/\r?\n/).filter(l=>l.trim()).map(line=>{
      const s=line.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
      const v=s.match(/^revive(?:\s+([45])\s*(?:min)?)?(\s+pular)?$/i);
      if(v)return {type:'revive',minutes:+v[1]||5,skip:!!v[2]};
      const e=s.match(/^elixir(?:\s+(\d+(?:[.,]\d+)?)\s*%?)?$/i);
      if(e)return {type:'elixir',value:e[1]?Number(e[1].replace(',','.')):70};
      const who=line.trim().match(/^(.+?)\s+(?:cds?|golpes?)\s+\d/i),p=s.match(/^(.+?)\s+(?:cds?|golpes?)\s+(\d.*)$/i);
      if(!who||!p)throw Error('Há um comando não reconhecido. Corrija no Modo avançado.');
      const r=p[2].match(/^(\d+)\s*(?:a|ate|-)\s*(\d+)$/i);
      let moves;
      if(r){if(+r[1]<1||+r[2]>6||+r[2]<+r[1])throw Error('Intervalo de golpes inválido.');moves=Array.from({length:+r[2]-+r[1]+1},(_,i)=>+r[1]+i);}
      else if(/^\d+(?:\s+\d+)*$/.test(p[2]))moves=p[2].split(/\s+/).map(Number);
      else throw Error('Lista de golpes inválida.');
      if(moves.some(n=>n<1||n>6))throw Error('Escolha golpes de 1 a 6.');
      return {type:'pokemon',pokemon:who[1],moves};
    });
  }
  function encode(steps){return steps.map(s=>s.type==='pokemon'?`${s.pokemon} cds ${s.moves.join(' ')}`:s.type==='revive'?`revive${s.minutes===4?' 4':''}${s.skip?' pular':''}`:s.value===70?'elixir':`elixir ${s.value}%`).join('\n');}
  if(typeof module!=='undefined'){module.exports={decode,encode};return;}
  const $=id=>document.getElementById(id),source=$('auto-sequence');
  let steps=[],editing=null,lastText=null,lastTeam='',valid=true;
  const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function message(s){$('builder-status').textContent=s;}
  function render(){
    $('builder-steps').innerHTML=steps.map((s,i)=>{
      const title=s.type==='pokemon'?`${s.pokemon}${root.findPokemon(s.pokemon,root.pokeSimulator.state.team)<0?' (fora do time)':''} · golpes ${s.moves.join(', ')}`:s.type==='revive'?`Revive ${s.minutes} min · recupera os cooldowns`:`Elixir · +${s.value}% no próximo Pokémon`;
      return `<li><span class="step-number">${i+1}</span><span class="step-title">${escape(title)}</span><div class="step-actions">${s.type==='revive'?`<label><input type="checkbox" data-step="${i}" data-op="skip" ${s.skip?'checked':''}> pular se em cooldown</label>`:''}${s.type==='pokemon'?`<button type="button" data-step="${i}" data-op="edit">Editar</button>`:''}<button type="button" data-step="${i}" data-op="up" aria-label="Subir etapa ${i+1}" ${i===0?'disabled':''}>↑</button><button type="button" data-step="${i}" data-op="down" aria-label="Descer etapa ${i+1}" ${i===steps.length-1?'disabled':''}>↓</button><button type="button" data-step="${i}" data-op="remove">Remover</button></div></li>`;
    }).join('');
    $('builder-empty').hidden=!!steps.length;
  }
  function cancel(){editing=null;$('builder-editor').hidden=true;}
  function sync(){
    const team=root.pokeSimulator.state.team,signature=JSON.stringify(team.map(p=>[p.name,p.moves.map(m=>m.name)]));
    if(signature!==lastTeam){lastTeam=signature;const selected=$('builder-pokemon').value;$('builder-pokemon').innerHTML=team.map(p=>`<option value="${escape(p.name)}">${escape(p.name)}</option>`).join('');if(team.some(p=>p.name===selected))$('builder-pokemon').value=selected;render();}
    if(source.value!==lastText){lastText=source.value;cancel();try{steps=decode(lastText);for(const s of steps){const i=s.type==='pokemon'?root.findPokemon(s.pokemon,team):-1;if(i>=0)s.pokemon=team[i].name;}valid=true;message('');render();}catch(e){valid=false;steps=[];render();message(e.message);$('builder-advanced').open=true;}}
    $('builder-fields').disabled=source.disabled||!valid;
  }
  function commit(){source.value=encode(steps);lastText=source.value;source.dispatchEvent(new Event('input',{bubbles:true}));render();message('Sequência atualizada.');}
  function openEditor(index=null){editing=index;const step=index===null?null:steps[index];$('builder-pokemon').value=step?.pokemon||root.pokeSimulator.state.team[0].name;document.querySelectorAll('[name="builder-move"]').forEach(c=>c.checked=step?step.moves.includes(+c.value):true);$('builder-apply').textContent=step?'Aplicar alteração':'Adicionar etapa';$('builder-editor').hidden=false;}
  $('builder-add').onclick=()=>openEditor();
  $('builder-cancel').onclick=cancel;
  $('builder-apply').onclick=()=>{
    const moves=[...document.querySelectorAll('[name="builder-move"]:checked')].map(c=>+c.value);
    if(!moves.length){message('Marque pelo menos um golpe.');return;}
    const step={type:'pokemon',pokemon:$('builder-pokemon').value,moves};
    if(root.findPokemon(step.pokemon,root.pokeSimulator.state.team)<0){message('Selecione um Pokémon válido.');return;}
    if(editing===null)steps.push(step);else steps[editing]=step;cancel();commit();
  };
  $('builder-elixir').onclick=()=>{cancel();steps.push({type:'elixir',value:70});commit();};
  $('builder-revive').onclick=()=>{cancel();steps.push({type:'revive',minutes:5});commit();};
  $('builder-revive4').onclick=()=>{cancel();steps.push({type:'revive',minutes:4});commit();};
  $('builder-steps').onclick=event=>{const b=event.target.closest('[data-step]');if(!b||source.disabled)return;const i=+b.dataset.step,op=b.dataset.op;if(op==='edit'){openEditor(i);return;}cancel();if(op==='skip'){steps[i].skip=b.checked;commit();return;}if(op==='remove')steps.splice(i,1);else{const j=i+(op==='up'?-1:1);if(j<0||j>=steps.length)return;[steps[i],steps[j]]=[steps[j],steps[i]];}commit();};
  source.addEventListener('input',sync);source.addEventListener('combo-loaded',sync);sync();setInterval(sync,200);
})(globalThis);
