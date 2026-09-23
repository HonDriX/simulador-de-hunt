(()=>{
  const buttons=[...document.querySelectorAll('[data-panel]')];
  function show(name){
    if(!['combos','pokemon','library','box'].includes(name))return;
    for(const panel of document.querySelectorAll('.feature-panel'))panel.hidden=panel.id!=='panel-'+name;
    for(const button of buttons){if(button.dataset.panel===name)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');}
  }
  for(const button of buttons)button.addEventListener('click',()=>show(button.dataset.panel));
  document.getElementById('combo-list').addEventListener('click',event=>{const action=event.target.closest('[data-action]')?.dataset.action;if(action==='load')show('combos');if(action==='run')show('box');});
  document.getElementById('auto-start').addEventListener('click',()=>{if(document.getElementById('auto-start').disabled)show('box');});
  show('box');
})();
