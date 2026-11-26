
(() => {
  'use strict';
  const $ = (selector, root=document) => root.querySelector(selector);
  const $$ = (selector, root=document) => Array.from(root.querySelectorAll(selector));
  const euro = value => (Number(value)||0).toLocaleString('pt-PT',{style:'currency',currency:'EUR'});
  const parseEuro = text => Number(String(text||'').replace(/[^0-9,.-]/g,'').replace(/\.(?=.*[,])/g,'').replace(',','.'))||0;
  const safeUrl = value => { try { const u=new URL(value); return ['http:','https:'].includes(u.protocol)?u.href:''; } catch (_) { return ''; } };
  // As fotografias também podem ser servidas pelo endpoint local (/api/product-image?...).
  const safeImageUrl = value => {
    const raw=String(value||'').trim();
    if(raw.startsWith('/')) return raw.startsWith('//')?'':raw;
    return safeUrl(raw);
  };
  const emitSave = element => { const target=element||$('.furniture-name'); if(target) target.dispatchEvent(new Event('input',{bubbles:true})); };
  const verifyImage = url => new Promise((resolve,reject)=>{
    const probe=new Image();
    probe.onload=()=>resolve(true);
    probe.onerror=()=>reject(new Error('O endereço foi encontrado, mas a imagem não pode ser carregada.'));
    probe.src=url;
  });
  const activateTab = id => {
    $$('.tab-btn').forEach(button=>button.classList.toggle('active',button.dataset.tab===id));
    $$('.tab-panel').forEach(panel=>panel.hidden=panel.id!==id);
    const panel=$('#'+id); if(panel) panel.scrollIntoView({block:'start',behavior:'smooth'});
    refreshAll();
  };
  const nav = $('.tabs');
  if(nav){
    const searchMarkup='<div class="bb-global-tools"><div class="bb-search-wrap"><span class="bb-search-icon" aria-hidden="true">⌕</span><input id="bb-global-search" type="search" placeholder="Pesquisar qualquer móvel, artigo ou trabalho…" autocomplete="off" aria-label="Pesquisa global"><div id="bb-search-results" class="bb-search-results" role="listbox"></div></div><div class="bb-global-hint">Pesquisa em todo o orçamento e em todas as divisões</div></div>';
    nav.insertAdjacentHTML('afterend',searchMarkup);
  }
  $$('.tab-btn').forEach(button=>button.addEventListener('click',()=>activateTab(button.dataset.tab)));
  document.addEventListener('click',event=>{const shortcut=event.target.closest('[data-bb-go]');if(shortcut)activateTab(shortcut.dataset.bbGo);});
  document.addEventListener('click',event=>{ if(!event.target.closest('.bb-search-wrap')) $('#bb-search-results')?.classList.remove('is-open'); });
  const globalSearch = $('#bb-global-search');
  const resultsBox = $('#bb-search-results');
  function searchIndex(query){
    const q=query.trim().toLocaleLowerCase('pt-PT'); if(!q)return [];
    const results=[];
    $$('#furniture-rooms .room-furniture').forEach(room=>{
      const roomName=$('.room-title',room)?.textContent.trim()||'Divisão';
      $$('tbody tr',room).forEach(row=>{
        const name=$('.furniture-name',row)?.value||'';
        const category=$('.furniture-category',row)?.value||'';
        const components=$$('.component-name',row).map(x=>x.value).join(' ');
        const links=$$('.furniture-link',row).map(x=>x.value).join(' ');
        const text=[name,category,roomName,components,links].join(' ').toLocaleLowerCase('pt-PT');
        if(text.includes(q))results.push({kind:'furniture',name:name||'Artigo sem nome',meta:roomName+' · '+category,row,room});
      });
    });
    $$('.calc-table tbody tr').forEach(row=>{
      const text=row.textContent.toLocaleLowerCase('pt-PT');
      if(text.includes(q))results.push({kind:'budget',name:row.textContent.trim().replace(/\s+/g,' ').slice(0,130),meta:'Orçamento da obra',row});
    });
    return results.slice(0,30);
  }
  function showSearchResults(query){
    if(!resultsBox)return;
    const matches=searchIndex(query); resultsBox.innerHTML='';
    if(!query.trim()){resultsBox.classList.remove('is-open');return;}
    if(!matches.length){resultsBox.innerHTML='<div class="bb-search-empty">Não foram encontrados resultados.</div>';resultsBox.classList.add('is-open');return;}
    matches.forEach((item,index)=>{
      const button=document.createElement('button');button.type='button';button.className='bb-search-result';
      const icon=item.kind==='furniture'?'▦':'€';
      button.innerHTML='<span aria-hidden="true">'+icon+'</span><span><strong></strong><small></small></span>';
      $('strong',button).textContent=item.name;$('small',button).textContent=item.meta;
      button.addEventListener('click',()=>{
        if(item.kind==='furniture'){
          activateTab('moveis-panel');
          ['bb-filter-search','bb-filter-room','bb-filter-category','bb-filter-min','bb-filter-max','bb-filter-sort'].forEach(id=>{const control=$('#'+id);if(control)control.value='';});applyFilters();
          item.room.hidden=false;item.room.classList.remove('collapsed');
          const group=item.row.closest('.category-group');if(group){group.hidden=false;group.classList.remove('is-collapsed');const table=$('.furniture-table',group);if(table)table.hidden=false;}
        }else {activateTab('orcamento-panel');const card=item.row.closest('.card');if(card)card.classList.remove('collapsed');}
        resultsBox.classList.remove('is-open');globalSearch.value='';
        item.row.scrollIntoView({behavior:'smooth',block:'center'});
        item.row.style.outline='3px solid #a9c5df';setTimeout(()=>item.row.style.outline='',1800);
      });
      resultsBox.appendChild(button);
    });
    resultsBox.classList.add('is-open');
  }
  globalSearch?.addEventListener('input',()=>showSearchResults(globalSearch.value));
  globalSearch?.addEventListener('keydown',event=>{if(event.key==='Escape'){globalSearch.value='';resultsBox.classList.remove('is-open');}if(event.key==='Enter'){const first=$('.bb-search-result',resultsBox);first?.click();}});
  document.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){event.preventDefault();globalSearch?.focus();}});
  const furniturePanel=$('#moveis-panel');
  if(furniturePanel){
    const intro=$('.furniture-intro',furniturePanel);
    const filter=document.createElement('div');filter.className='bb-filterbar';filter.id='bb-furniture-filters';
    filter.innerHTML='<div><label for="bb-filter-search">Pesquisa nesta área</label><input id="bb-filter-search" type="search" placeholder="Nome ou componente"></div><div><label for="bb-filter-room">Divisão</label><select id="bb-filter-room"><option value="">Todas as divisões</option></select></div><div><label for="bb-filter-category">Categoria</label><select id="bb-filter-category"><option value="">Todas as categorias</option></select></div><div><label for="bb-filter-min">Preço mínimo (€)</label><input id="bb-filter-min" type="number" min="0" step="0.01" placeholder="0"></div><div><label for="bb-filter-max">Preço máximo (€)</label><input id="bb-filter-max" type="number" min="0" step="0.01" placeholder="Sem limite"></div><div><label for="bb-filter-sort">Ordenar por</label><select id="bb-filter-sort"><option value="">Ordem original</option><option value="name">Nome (A–Z)</option><option value="price-desc">Preço (maior primeiro)</option><option value="price-asc">Preço (menor primeiro)</option><option value="qty-desc">Quantidade (maior primeiro)</option></select></div><div class="bb-filter-count" id="bb-filter-count">A mostrar todos os artigos</div>';
    if(intro)intro.insertAdjacentElement('afterend',filter);else furniturePanel.prepend(filter);
  }
  function refreshFilterOptions(){
    const roomSelect=$('#bb-filter-room'),catSelect=$('#bb-filter-category');if(!roomSelect||!catSelect)return;
    const roomValue=roomSelect.value,catValue=catSelect.value;
    const rooms=$$('#furniture-rooms .room-furniture').map(r=>$('.room-title',r)?.textContent.trim()).filter(Boolean);
    const cats=Array.from(new Set($$('#furniture-rooms .furniture-category').map(s=>s.value).filter(Boolean))).sort((a,b)=>a.localeCompare(b,'pt'));
    roomSelect.innerHTML='<option value="">Todas as divisões</option>'+rooms.map(x=>'<option></option>').join('');
    Array.from(roomSelect.options).slice(1).forEach((o,i)=>{o.value=rooms[i];o.textContent=rooms[i];});
    catSelect.innerHTML='<option value="">Todas as categorias</option>'+cats.map(x=>'<option></option>').join('');
    Array.from(catSelect.options).slice(1).forEach((o,i)=>{o.value=cats[i];o.textContent=cats[i];});
    roomSelect.value=rooms.includes(roomValue)?roomValue:'';catSelect.value=cats.includes(catValue)?catValue:'';
  }
  function applyFilters(){
    const query=($('#bb-filter-search')?.value||'').trim().toLocaleLowerCase('pt-PT');
    const roomFilter=$('#bb-filter-room')?.value||'',catFilter=$('#bb-filter-category')?.value||'';
    const minRaw=$('#bb-filter-min')?.value,maxRaw=$('#bb-filter-max')?.value;
    const min=minRaw===''?-Infinity:Number(minRaw),max=maxRaw===''?Infinity:Number(maxRaw);
    const sortMode=$('#bb-filter-sort')?.value||'';
    let shown=0,total=0;
    $$('#furniture-rooms .room-furniture').forEach(room=>{
      const roomName=$('.room-title',room)?.textContent.trim()||'';
      let roomHas=false;
      $$( '.category-group',room).forEach(group=>{
        const tbody=$('tbody',group);if(tbody&&sortMode){const rows=$$('tr',tbody);rows.sort((a,b)=>{if(sortMode==='name')return ($('.furniture-name',a)?.value||'').localeCompare($('.furniture-name',b)?.value||'','pt');const av=sortMode.startsWith('qty')?Number($('.furniture-qty',a)?.value||0):parseEuro(a.dataset.line||$('.line-total',a)?.textContent);const bv=sortMode.startsWith('qty')?Number($('.furniture-qty',b)?.value||0):parseEuro(b.dataset.line||$('.line-total',b)?.textContent);return sortMode.endsWith('asc')?av-bv:bv-av;});rows.forEach(row=>tbody.appendChild(row));}
        let groupHas=false;
        $$('tbody tr',group).forEach(row=>{
          total++;
          const name=$('.furniture-name',row)?.value||'';
          const category=$('.furniture-category',row)?.value||'';
          const comp=$$('.component-name',row).map(x=>x.value).join(' ');
          const text=(name+' '+category+' '+comp+' '+roomName).toLocaleLowerCase('pt-PT');
          const line=parseEuro(row.dataset.line||$('.line-total',row)?.textContent);
          const ok=(!query||text.includes(query))&&(!roomFilter||roomFilter===roomName)&&(!catFilter||catFilter===category)&&line>=min&&line<=max;
          row.classList.toggle('bb-hidden-by-filter',!ok);if(ok){shown++;groupHas=true;roomHas=true;}
        });
        group.classList.toggle('bb-hidden-by-filter',!groupHas);
      });
      const hasActiveFilter=!!(query||roomFilter||catFilter||minRaw!==''||maxRaw!=='');
      room.classList.toggle('bb-hidden-by-filter',!roomHas&&hasActiveFilter);
    });
    const count=$('#bb-filter-count');if(count)count.textContent='A mostrar '+shown+' de '+total+' artigos';
  }
  ['bb-filter-search','bb-filter-room','bb-filter-category','bb-filter-min','bb-filter-max','bb-filter-sort'].forEach(id=>{
    $('#'+id)?.addEventListener('input',applyFilters);$('#'+id)?.addEventListener('change',applyFilters);
  });
  function enhanceRow(row){
    if(!row||row.dataset.bbEnhanced==='1')return;
    row.dataset.bbEnhanced='1';
    const firstCell=row.children[0],nameWrap=$('.furniture-name-wrap',row);
    if(firstCell&&nameWrap){
      const editor=document.createElement('div');editor.className='bb-photo-editor';
      const image=document.createElement('img');image.alt='Fotografia do artigo';image.hidden=true;
      const imageInput=document.createElement('input');imageInput.type='url';imageInput.className='bb-image-url';imageInput.placeholder='URL da fotografia';imageInput.setAttribute('aria-label','URL da fotografia do artigo');
      const current=safeImageUrl(row.dataset.image||'');if(current){image.src=current;image.hidden=false;imageInput.value=current;}
      const fetchButton=document.createElement('button');fetchButton.type='button';fetchButton.className='bb-fetch-product-image';fetchButton.textContent='Obter do link do produto';
      const fetchStatus=document.createElement('span');fetchStatus.className='bb-image-fetch-status';fetchStatus.setAttribute('aria-live','polite');
      const editPhoto=document.createElement('button');editPhoto.type='button';editPhoto.className='bb-photo-toggle';editPhoto.textContent='Fotografia';editPhoto.setAttribute('aria-expanded','false');
      editPhoto.addEventListener('click',()=>{
        const editing=editor.classList.toggle('is-editing');
        editPhoto.setAttribute('aria-expanded',String(editing));
        editPhoto.textContent=editing?'Fechar':'Fotografia';
        if(editing)imageInput.focus();
      });
      editor.append(image,imageInput,fetchButton,fetchStatus);firstCell.append(editPhoto,editor);
      fetchButton.addEventListener('click',async()=>{
        const links=$('.furniture-link-row .furniture-link',row).map(input=>safeUrl(input.value)).filter(Boolean);
        if(!links.length){fetchStatus.textContent='Adiciona primeiro o link do produto.';return;}
        fetchButton.disabled=true;fetchStatus.textContent='A procurar fotografia…';
        try{
          let found=null,lastError='';
          for(const link of links){
            const response=await fetch('/api/product-image',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:link})});
            const data=await response.json().catch(()=>({}));
            if(response.ok&&data.image){found=data.image;break;}
            lastError=data.error||'Não foi possível obter a imagem.';
          }
          if(!found)throw new Error(lastError||'Nenhum dos links disponibilizou uma imagem.');
          await verifyImage(found);
          image.src=found;image.hidden=false;
          fetchStatus.textContent='Fotografia carregada. Confirma para guardar.';
          let saveButton=$('.bb-save-found-image',editor);
          if(!saveButton){saveButton=document.createElement('button');saveButton.type='button';saveButton.className='bb-save-found-image';saveButton.textContent='Guardar fotografia';editor.appendChild(saveButton);}
          saveButton.onclick=()=>{
            row.dataset.image=found;imageInput.value=found;emitSave($('.furniture-name',row));
            fetchStatus.textContent='Fotografia guardada no artigo.';saveButton.remove();
          };
        }catch(error){fetchStatus.textContent=error.message;}
        finally{fetchButton.disabled=false;}
      });
      imageInput.addEventListener('input',()=>{
        const url=safeImageUrl(imageInput.value);row.dataset.image=url;
        if(url){image.src=url;image.hidden=false;}else{image.removeAttribute('src');image.hidden=true;}
        emitSave($('.furniture-name',row));
      });
      imageInput.addEventListener('change',async()=>{
        const source=safeImageUrl(imageInput.value);
        if(!source)return;
        if(source.startsWith('/')){
          try{await verifyImage(source);row.dataset.image=source;image.src=source;image.hidden=false;emitSave($('.furniture-name',row));fetchStatus.textContent='Fotografia carregada e guardada no artigo.';}
          catch(error){fetchStatus.textContent=error.message;}
          return;
        }
        fetchStatus.textContent='A validar fotografia…';
        try{
          const response=await fetch('/api/product-image',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:source})});
          const data=await response.json().catch(()=>({}));
          if(!response.ok||!data.image)throw new Error(data.error||'Não foi possível obter a fotografia.');
          await verifyImage(data.image);
          imageInput.value=data.image;row.dataset.image=data.image;image.src=data.image;image.hidden=false;
          emitSave($('.furniture-name',row));
          fetchStatus.textContent='Fotografia carregada e guardada no artigo.';
        }catch(error){fetchStatus.textContent='Não foi possível validar este endereço: '+error.message;}
      });
      image.addEventListener('error',()=>{image.hidden=true;image.title='Não foi possível carregar esta imagem';fetchStatus.textContent='A imagem não está acessível. Experimenta validar o link.';});
    }
    if(row.classList.contains('is-done')){const line=$('.view-line',row);if(line&&row.dataset.image&&!$('.bb-view-image',line)){const preview=document.createElement('img');preview.className='bb-view-image';preview.alt='';preview.src=safeImageUrl(row.dataset.image)||'';preview.addEventListener('error',()=>{preview.hidden=true;});line.prepend(preview);}}
    const lastCell=row.lastElementChild;
    updateCompleteness(row);
    if(lastCell&&!$('.bb-duplicate',lastCell)){
      const duplicate=document.createElement('button');duplicate.type='button';duplicate.className='bb-duplicate';duplicate.textContent='⧉';duplicate.title='Duplicar artigo';duplicate.setAttribute('aria-label','Duplicar artigo');
      const remove=$('.remove-furniture',lastCell);if(remove)lastCell.insertBefore(duplicate,remove);else lastCell.appendChild(duplicate);
    }
    if(lastCell&&!$('.bb-details',lastCell)){const details=document.createElement('button');details.type='button';details.className='bb-details';details.textContent='⋯';details.title='Ver detalhes do artigo';details.setAttribute('aria-label','Ver detalhes do artigo');const remove=$('.remove-furniture',lastCell);if(remove)lastCell.insertBefore(details,remove);else lastCell.appendChild(details);}
  }
  function updateCompleteness(row){const name=$('.furniture-name',row)?.value.trim()||'';const components=$$( '.furniture-link-row',row);const hasComponent=components.some(c=>($('.component-name',c)?.value.trim()||'')||($('.furniture-link',c)?.value.trim()||''));const hasPrice=components.some(c=>Number($('.component-price',c)?.value||0)>0);const incomplete=!name||!hasComponent||!hasPrice;let badge=$('.bb-incomplete',row);if(incomplete&&!badge){badge=document.createElement('span');badge.className='bb-incomplete';badge.textContent='Dados incompletos';badge.title='Falta o nome do artigo, componente/link ou preço';$('.furniture-name-wrap',row)?.appendChild(badge);}else if(!incomplete&&badge)badge.remove();}
  function enhanceAllRows(){ $$('#furniture-rooms tbody tr').forEach(enhanceRow);$$('#furniture-rooms tbody tr.is-done').forEach(row=>{const line=$('.view-line',row),url=safeUrl(row.dataset.image||'');if(line&&url&&!$('.bb-view-image',line)){const image=document.createElement('img');image.className='bb-view-image';image.alt='';image.src=url;line.prepend(image);}});$$('#furniture-rooms .category-group').forEach(group=>{const cat=(group.dataset.category||'').toLocaleLowerCase('pt-PT');group.classList.toggle('bb-appliance-group',cat.includes('eletrodoméstico')||cat.includes('máquina'));group.classList.toggle('bb-furniture-group',!cat.includes('eletrodoméstico')&&!cat.includes('máquina'));});refreshFilterOptions();applyFilters(); }
  let activeDetailRow=null;
  function showArticleDetails(row){activeDetailRow=row;const modal=$('#bb-detail-modal');if(!modal)return;const set=(id,value)=>{const el=$('#'+id,modal);if(el)el.textContent=value;};const name=$('.furniture-name',row)?.value.trim()||'Artigo sem nome';set('bb-detail-name',name);set('bb-detail-room',$('.room-title',row.closest('.room-furniture'))?.textContent.trim()||'—');set('bb-detail-category',$('.furniture-category',row)?.value||'—');set('bb-detail-quantity',$('.furniture-qty',row)?.value||'1');set('bb-detail-total',$('.line-total',row)?.textContent||'—');const actualInput=$('#bb-detail-actual-price',modal);if(actualInput)actualInput.value=row.dataset.actualPrice||'';set('bb-detail-mode',$('.purchase-mode',row)?.selectedOptions?.[0]?.textContent||'—');const image=$('#bb-detail-image',modal),url=safeImageUrl(row.dataset.image||'');if(url){image.src=url;image.hidden=false;}else{image.removeAttribute('src');image.hidden=true;}const list=$('#bb-detail-components',modal);list.innerHTML='';$$( '.furniture-link-row',row).forEach(component=>{const item=document.createElement('div');item.className='bb-detail-component';const label=document.createElement('strong');label.textContent=$('.component-name',component)?.value||'Componente';const price=document.createElement('span');price.textContent=euro(Number($('.component-price',component)?.value||0))+' × '+($('.component-qty',component)?.value||'1');item.append(label,price);const link=safeUrl($('.furniture-link',component)?.value||'');if(link){const a=document.createElement('a');a.href=link;a.target='_blank';a.rel='noopener noreferrer';a.textContent='Abrir produto na loja';item.appendChild(a);}list.appendChild(item);});modal.hidden=false;}
  const detailModal=document.createElement('div');detailModal.id='bb-detail-modal';detailModal.className='bb-detail-backdrop';detailModal.hidden=true;detailModal.innerHTML='<div class="bb-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="bb-detail-name"><button type="button" class="bb-detail-close" data-bb-detail-close aria-label="Fechar">×</button><img id="bb-detail-image" alt="Fotografia do artigo" hidden><h3 id="bb-detail-name"></h3><p><strong>Divisão:</strong> <span id="bb-detail-room"></span> · <strong>Categoria:</strong> <span id="bb-detail-category"></span></p><p><strong>Quantidade:</strong> <span id="bb-detail-quantity"></span> · <strong>Tipo:</strong> <span id="bb-detail-mode"></span></p><p><strong>Total estimado:</strong> <span id="bb-detail-total"></span></p><label class="bb-actual-label" for="bb-detail-actual-price">Total efetivamente pago (€)</label><input id="bb-detail-actual-price" type="number" min="0" step="0.01" placeholder="Ainda não registado"><h4>Componentes e ligações</h4><div id="bb-detail-components"></div></div>';document.body.appendChild(detailModal);
  document.addEventListener('click',event=>{if(event.target.closest('[data-bb-detail-close]')||event.target===detailModal)detailModal.hidden=true;});
  detailModal.addEventListener('input',event=>{if(event.target.id==='bb-detail-actual-price'&&activeDetailRow){activeDetailRow.dataset.actualPrice=event.target.value;emitSave($('.furniture-name',activeDetailRow));renderAnalysis();}});
  $('#furniture-rooms')?.addEventListener('click',event=>{
    const details=event.target.closest('.bb-details');if(details){showArticleDetails(details.closest('tr'));return;}
    const duplicate=event.target.closest('.bb-duplicate');if(!duplicate)return;
    const row=duplicate.closest('tr');if(!row)return;
    const copy=row.cloneNode(true);copy.dataset.bbEnhanced='1';copy.dataset.actualPrice='';copy.classList.remove('is-done','unselected');$('.bb-photo-editor',copy)?.remove();delete copy.dataset.bbEnhanced;
    $$( '.view-val',copy).forEach(el=>el.remove());
    const nameCell=copy.children[0];if(nameCell)nameCell.colSpan=1;
    const toggle=$('.toggle-furniture',copy);if(toggle){toggle.textContent='✓';toggle.title='Guardar móvel';}
    const group=row.closest('.category-group');const body=group?.querySelector('tbody');
    if(body)body.insertBefore(copy,row.nextSibling);
    enhanceRow(copy);emitSave($('.furniture-name',copy));refreshAll();
  });
  $('#furniture-rooms')?.addEventListener('input',event=>{
    if(event.target.matches('.furniture-name,.furniture-category,.component-name,.component-price,.component-qty,.furniture-qty,.bb-image-url,.room-title')){const row=event.target.closest('tr');if(row)updateCompleteness(row);refreshAll();}
  });
  $('#furniture-rooms')?.addEventListener('change',refreshAll);
  document.addEventListener('input',event=>{if(event.target.matches('.val-input,.item-check'))refreshAll();});
  document.addEventListener('change',event=>{if(event.target.matches('.item-check,.item-check-furn'))refreshAll();});
  function moneyFromId(id){return parseEuro($('#'+id)?.textContent||'0');}
  function renderDashboard(){
    const work=moneyFromId('grand-total'),furn=moneyFromId('furniture-grand-total'),combined=moneyFromId('combined-grand-total');
    const rooms=$$('#furniture-rooms .room-furniture');
    const rows=$$('#furniture-rooms tbody tr');
    const done=rows.filter(r=>r.classList.contains('is-done')).length;
    const set=(id,value)=>{const el=$('#'+id);if(el)el.textContent=value;};
    set('bb-kpi-work',euro(work));set('bb-kpi-furniture',euro(furn));set('bb-kpi-combined',euro(combined));
    set('bb-kpi-items',String(rows.length));set('bb-kpi-items-sub',done+' artigos marcados como concluídos');
    const overview=$('#bb-room-overview');if(!overview)return;overview.innerHTML='';
    rooms.forEach(room=>{
      const card=document.createElement('div');card.className='bb-room-card';
      const title=$('.room-title',room)?.textContent.trim()||'Divisão';
      const count=$$('tbody tr',room).length;
      card.innerHTML='<strong></strong><small></small>';
      $('strong',card).textContent=title;$('small',card).textContent=count+' artigo(s) · '+($('.room-total',room)?.textContent||euro(0));
      overview.appendChild(card);
    });
  }
  function chartRows(targetId,items){
    const target=$('#'+targetId);if(!target)return;target.innerHTML='';
    const max=Math.max(1,...items.map(x=>x.value));
    if(!items.length){target.innerHTML='<div class="bb-empty">Ainda não existem dados para apresentar.</div>';return;}
    items.forEach(item=>{
      const row=document.createElement('div');row.className='bb-chart-row';
      const label=document.createElement('div');label.className='bb-chart-label';label.textContent=item.label;
      const track=document.createElement('div');track.className='bb-chart-track';const fill=document.createElement('div');fill.className='bb-chart-fill';fill.style.width=Math.max(item.value>0?1:0,item.value/max*100)+'%';track.appendChild(fill);
      const value=document.createElement('div');value.className='bb-chart-value';value.textContent=euro(item.value);
      row.append(label,track,value);target.appendChild(row);
    });
  }
  function renderAnalysis(){
    const rooms=$$('#furniture-rooms .room-furniture').map(room=>({label:$('.room-title',room)?.textContent.trim()||'Divisão',value:parseEuro($('.room-total',room)?.textContent)})).sort((a,b)=>b.value-a.value);
    const ids=[['Cozinha','summary-cozinha'],['Casa de banho','summary-wc'],['Sala, quartos e hall','summary-pavi'],['Marquise','summary-marquise'],['Varandas','summary-varandas'],['Portas e roupeiro','summary-portas'],['Trabalhos gerais','summary-gerais']];
    const work=ids.map(([label,id])=>({label,value:moneyFromId(id)})).filter(x=>x.value>0).sort((a,b)=>b.value-a.value);
    chartRows('bb-analysis-rooms',rooms);chartRows('bb-analysis-work',work);
    const total=moneyFromId('combined-grand-total'),workTotal=moneyFromId('grand-total'),furnTotal=moneyFromId('furniture-grand-total');
    const allFurnitureRows=$$('#furniture-rooms tbody tr');
    const purchasedValue=allFurnitureRows.filter(row=>row.classList.contains('is-done')).reduce((sum,row)=>sum+parseEuro(row.dataset.line||$('.line-total',row)?.textContent),0);
    const actualSpend=allFurnitureRows.reduce((sum,row)=>sum+Math.max(0,Number(row.dataset.actualPrice)||0),0);
    const actualRows=allFurnitureRows.filter(row=>row.dataset.actualPrice!==undefined&&row.dataset.actualPrice!=='');
    const expectedForActual=actualRows.reduce((sum,row)=>sum+parseEuro($('.line-total',row)?.textContent),0);
    const actualVariance=actualSpend-expectedForActual;
    chartRows('bb-analysis-spend-comparison',[{label:'Estimativa',value:expectedForActual},{label:'Valor pago',value:actualSpend}]);
    const actualEl=$('#bb-analysis-actual-total');if(actualEl)actualEl.textContent=euro(actualSpend);
    const varianceEl=$('#bb-analysis-variance');if(varianceEl)varianceEl.textContent=(actualVariance>0?'+':'')+euro(actualVariance);
    const purchasedEl=$('#bb-analysis-purchased-total');if(purchasedEl)purchasedEl.textContent=euro(purchasedValue);
    const ratio=total?Math.round(furnTotal/total*100):0;
    const ratioEl=$('#bb-analysis-ratio');if(ratioEl)ratioEl.textContent=ratio+'%';
    const mostExpensive=rooms[0];
    const el=$('#bb-analysis-note');if(el)el.textContent='Os móveis representam '+ratio+'% do total combinado. A divisão com maior custo registado é '+(mostExpensive?mostExpensive.label+' ('+euro(mostExpensive.value)+')':'ainda não determinada')+'. Valor estimado dos artigos marcados como comprados: '+euro(purchasedValue)+'. Total efetivamente pago registado: '+euro(actualSpend)+'. Diferença face à estimativa dos artigos com valor real preenchido: '+euro(actualVariance)+'.';
    const a=$('#bb-analysis-work-total'),b=$('#bb-analysis-furniture-total'),c=$('#bb-analysis-combined-total');
    if(a)a.textContent=euro(workTotal);if(b)b.textContent=euro(furnTotal);if(c)c.textContent=euro(total);
  }
  function renderHistory(){
    const list=$('#bb-history-list');if(!list)return;list.innerHTML='';
    const history=window.__bbGetHistory?.()||[];
    if(!history.length){list.innerHTML='<div class="bb-empty">Ainda não existem versões anteriores guardadas. O histórico começa a ser criado quando fizeres alterações e estas forem sincronizadas.</div>';return;}
    history.forEach((entry,index)=>{
      const card=document.createElement('div');card.className='bb-history-entry';
      const info=document.createElement('div');const title=document.createElement('strong');title.textContent=entry.label||'Versão anterior';
      const date=document.createElement('small');const roomCount=entry.data?.rooms?.length||0;const itemCount=(entry.data?.rooms||[]).reduce((sum,room)=>sum+(room.items||[]).length,0);date.textContent=new Date(entry.at||Date.now()).toLocaleString('pt-PT')+' · '+roomCount+' divisões · '+itemCount+' artigos';
      info.append(title,date);
      const button=document.createElement('button');button.type='button';button.className='secondary';button.textContent='Recuperar esta versão';
      button.addEventListener('click',()=>{
        const ok=confirm('Queres recuperar esta versão? O estado atual será preservado no histórico antes de guardar a recuperação.');
        if(!ok)return;
        if(window.__bbApplySnapshot?.(entry.data)){activateTab('moveis-panel');setTimeout(()=>activateTab('history-panel'),100);renderHistory();}
        else alert('Não foi possível recuperar esta versão. O registo pode estar incompleto.');
      });
      card.append(info,button);list.appendChild(card);
    });
  }
  function refreshAll(){renderDashboard();renderAnalysis();renderHistory();enhanceAllRows();}
  const download=(filename,content,type)=>{
    const blob=new Blob([content],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  $('#bb-export-backup')?.addEventListener('click',()=>{
    const snapshot=window.__bbGetSnapshot?.();if(!snapshot?.rooms?.length){alert('Os dados online ainda não estão carregados.');return;}
    download('brick-by-brick-backup-'+new Date().toISOString().slice(0,10)+'.json',JSON.stringify({format:'brickbybrick-backup-v1',createdAt:new Date().toISOString(),data:snapshot},null,2),'application/json');
  });
  $('#bb-import-backup-file')?.addEventListener('change',async event=>{
    const file=event.target.files?.[0];event.target.value='';if(!file)return;
    try{
      const parsed=JSON.parse(await file.text());const data=parsed?.data||parsed;
      if(!data||!Array.isArray(data.rooms)||!data.rooms.length||!data.rooms.every(r=>r&&Array.isArray(r.items)&&r.items.every(item=>item&&typeof item==='object'&&!Array.isArray(item))))throw new Error('O ficheiro não contém divisões e artigos válidos.');
      if(!confirm('O backup contém '+data.rooms.length+' divisões. Queres substituir o estado atual? A versão atual será preservada no histórico.'))return;
      if(!window.__bbApplySnapshot?.(data))throw new Error('Não foi possível aplicar o backup.');
      alert('Backup aplicado. A sincronização online será iniciada automaticamente.');
    }catch(error){alert('Não foi possível importar o backup: '+error.message);}
  });
  $('#bb-import-backup')?.addEventListener('click',()=>$('#bb-import-backup-file')?.click());
  function refreshAllWhenReady(){
    enhanceAllRows();refreshAll();
    const target=$('#furniture-rooms');
    if(target){const observer=new MutationObserver(()=>{enhanceAllRows();renderDashboard();renderAnalysis();});observer.observe(target,{childList:true,subtree:true});const photoObserver=new MutationObserver(records=>records.forEach(record=>{const row=record.target;if(!row.matches('tr'))return;const url=safeUrl(row.dataset.image||'');const image=$('.bb-photo-editor img',row);const input=$('.bb-image-url',row);if(input&&document.activeElement!==input)input.value=url;if(image){if(url){image.src=url;image.hidden=false;}else{image.removeAttribute('src');image.hidden=true;}}if(row.classList.contains('is-done')){let preview=$('.bb-view-image',row);const line=$('.view-line',row);if(url&&line&&!preview){preview=document.createElement('img');preview.className='bb-view-image';preview.alt='';line.prepend(preview);}if(preview){preview.src=url;preview.hidden=!url;}}}));photoObserver.observe(target,{attributes:true,attributeFilter:['data-image'],subtree:true});}
    const status=$('#cloud-save-status');
    if(status){const syncButtons=()=>{const ready=status.textContent.includes('sincronizados')||status.textContent.includes('Guardado online');$('#bb-export-backup,#bb-import-backup').forEach(b=>b.disabled=!ready);renderDashboard();renderAnalysis();refreshFilterOptions();applyFilters();renderHistory();};new MutationObserver(syncButtons).observe(status,{childList:true,characterData:true,subtree:true});syncButtons();}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',refreshAllWhenReady,{once:true});else refreshAllWhenReady();
  window.addEventListener('resize',()=>renderAnalysis());
})();
