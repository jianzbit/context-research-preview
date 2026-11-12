import {STATUS,FIT,TYPES,groups,scopeCoverage,coverageRows,matches,safeUrl,csv} from './model.js';

const $=s=>document.querySelector(s);
const esc=value=>String(value??'Not specified').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const link=(label,url)=>safeUrl(url)?`<a class="source-link" href="${esc(safeUrl(url))}" target="_blank" rel="noopener noreferrer">${esc(label)} ↗</a>`:esc(label);
const defaults={indicator:'all',country:'all',type:'all',date:'all',query:'',view:'sources',status:'attempted'};
let data,state,page=0,toastTimer;
const countryName=code=>data.countries.find(c=>c.code===code)?.name||code;
const indicatorName=id=>data.indicators.find(i=>i.id===id)?.name||id;
const human=value=>value?String(value).replaceAll('_',' ').replace(/^./,c=>c.toUpperCase()):'Not specified';
const dateText=r=>r.sourceDateReviewed?`${r.sourceDateType} ${r.sourceDate}`:'Source date not confirmed';
const tags=records=>[...new Set(records.map(r=>r.indicatorId))].map(id=>`<span class="tag indicator">${esc(id)}</span>`).join('')+[...new Set(records.map(r=>r.claimType))].map(t=>`<span class="tag ${esc(t)}">${esc(human(t))}</span>`).join('')+([...new Set(records.map(r=>r.indicatorFit))].map(f=>`<span class="tag">${esc(FIT[f]||human(f))}</span>`).join(''));
function figureStrip(records){
 const unique=new Map();
 for(const r of records)for(const f of r.figures){const k=JSON.stringify([f.value,f.unit,f.label,f.referencePeriod]);if(!unique.has(k))unique.set(k,{...f,claim:r.claimType});}
 return unique.size?`<div class="figure-strip">${[...unique.values()].slice(0,3).map(f=>`<div class="figure-item"><strong>${esc(f.value)} <small>${String(f.value).trim().endsWith(String(f.unit).trim())?'':esc(f.unit)}</small></strong><span>${esc(f.label)} · ${esc(f.referencePeriod)} · ${esc(human(f.claim))}</span></div>`).join('')}</div>`:'';
}
function readState(){
 const p=new URLSearchParams(location.search),next={...defaults};
 for(const k of Object.keys(next))if(p.has(k))next[k]=p.get(k);
 if(!data.indicators.some(i=>i.id===next.indicator))next.indicator='all';
 if(!data.countries.some(c=>c.code===next.country))next.country='all';
 for(const [key,allowed] of Object.entries({type:['all',...Object.keys(TYPES)],date:['all','recent','unknown'],view:['sources','coverage'],status:['all','attempted',...Object.keys(STATUS)]}))if(!allowed.includes(next[key]))next[key]=defaults[key];
 next.query=next.query.slice(0,300);return next;
}
function viewUrl(){
 const url=new URL(location.href);
 for(const [key,val] of Object.entries(state)){if(val===defaults[key])url.searchParams.delete(key);else url.searchParams.set(key,val);}
 return url;
}
function syncUrl(){
 const url=viewUrl();history.replaceState(null,'',url);
 if(window.parent!==window)window.parent.postMessage({type:'gold-sources-view',query:url.search},location.origin);
}
function change(patch){state={...state,...patch};page=0;syncUrl();render();}
function notify(message){$('#toast').textContent=message;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{$('#toast').hidden=true;},3500);}
function renderNavigation(){
 const labels={'2':'Energy & operations','3':'Materials & emissions','4':'Investment & finance','6':'Climate risks','7':'Climate commitments','8':'Codes & certification',topic:'Additional topic'};
 $('#indicator-navigation').innerHTML=Object.entries(labels).map(([id,label])=>`<section class="indicator-group"><h2>${label}</h2>${data.indicators.filter(i=>i.group===id).map(i=>`<button class="indicator-button" data-indicator="${esc(i.id)}" aria-pressed="false"><span class="indicator-id">${i.id==='ndc-adaptation'?'NDC':esc(i.id)}</span><span class="indicator-name">${esc(i.name)}</span><span class="indicator-count">${new Set(data.records.filter(r=>r.indicatorId===i.id).map(r=>r.sourceUrl)).size}</span></button>`).join('')}</section>`).join('');
 $('#indicator').insertAdjacentHTML('beforeend',data.indicators.map(i=>`<option value="${esc(i.id)}">${i.id==='ndc-adaptation'?'Topic':esc(i.id)} · ${esc(i.name)}</option>`).join(''));
 $('#country').insertAdjacentHTML('beforeend',data.countries.map(c=>`<option value="${esc(c.code)}">${esc(c.name)} (${c.code})</option>`).join(''));
}
function renderCard(g,index){
 const r=g.records[0];
 return `<article class="source-card"><div class="card-top"><span class="source-type ${esc(g.format)}">${esc(TYPES[g.format])}</span><span class="country-label">${esc(countryName(g.countryCode))}<span class="country-code">${esc(g.countryCode)}</span></span></div><h3>${esc(r.headline)}</h3><p class="card-publisher">${esc(r.publisher)} <span>·</span> <span class="${r.sourceDateReviewed?'':'source-date-unconfirmed'}">${esc(dateText(r))}</span></p><p class="card-description">${esc(r.statement)}</p><div class="record-tags">${tags(g.records)}${g.records.some(r=>r.documentStatus)?'<span class="tag draft">Draft status</span>':''}</div>${figureStrip(g.records)}<div class="card-bottom"><span class="screening-status">${g.records.length} screened record${g.records.length===1?'':'s'}</span><div class="card-actions"><button class="text-button" data-source="${index}">View evidence</button>${link('Source',g.url)}</div></div></article>`;
}
function emptyState(){
 const cells=scopeCoverage(data,state),attempted=cells.filter(c=>c.status!=='not_submitted');
 const hasRecords=data.records.some(r=>(state.indicator==='all'||state.indicator===r.indicatorId)&&(state.country==='all'||state.country===r.countryCode));
 let title='No admitted sources in this view',body='The bounded search did not retain an admissible record for this selection. This does not establish an absence of relevant evidence.';
 if(hasRecords){title='No sources match these filters';body='Try another source type, date setting or search term. Evidence exists for this indicator and country selection.';}
 else if(!attempted.length){title='This selection has not been searched';body='The roster includes this selection, but it was outside the current partial-coverage search. No indicator value can be inferred.';}
 else if(attempted.every(c=>c.status==='error')){title='The search call did not complete';body='The earlier call failed. This is a processing status and provides no conclusion about the indicator.';}
 return `<div class="empty-state"><span class="empty-symbol" aria-hidden="true">⌕</span><h3>${title}</h3><p>${body}</p><button class="button" id="inspect-coverage">Inspect coverage and source leads</button></div>`;
}
function renderCoverage(){
 const rows=coverageRows(data,state),start=page*25;
 if(start>=rows.length)page=0;
 $('#results-subtitle').textContent=`${rows.length.toLocaleString('en')} indicator × country pairs · select a row to inspect status and leads`;
 $('#result-list').innerHTML=rows.length?`<div class="coverage-table-wrap"><table class="coverage-table"><thead><tr><th>Indicator</th><th>Country</th><th>Search status</th><th>Records</th><th></th></tr></thead><tbody>${rows.slice(page*25,page*25+25).map((c,i)=>`<tr><td><strong>${esc(c.indicatorId)}</strong><br>${esc(indicatorName(c.indicatorId))}</td><td>${esc(countryName(c.countryCode))}<br><small>${c.countryCode}</small></td><td><span class="coverage-status ${esc(c.status)}">${esc(STATUS[c.status])}</span></td><td>${data.records.filter(r=>r.indicatorId===c.indicatorId&&r.countryCode===c.countryCode).length}</td><td><button class="text-button" data-pair="${i}">Details</button></td></tr>`).join('')}</tbody></table></div>`:emptyState();
 $('#pagination').hidden=rows.length<=25;
 $('#previous-page').disabled=page===0;$('#next-page').disabled=(page+1)*25>=rows.length;
 $('#page-label').textContent=`${page*25+1}–${Math.min((page+1)*25,rows.length)} of ${rows.length.toLocaleString('en')}`;
 document.querySelectorAll('[data-pair]').forEach(b=>b.onclick=()=>openPair(rows[page*25+Number(b.dataset.pair)]));
}
function render(){
 $('#indicator').value=state.indicator;$('#country').value=state.country;$('#search').value=state.query;$('#source-date').value=state.date;$('#coverage-status').value=state.status;
 for(const [selector,key] of [['[data-indicator]','indicator'],['[data-type]','type'],['[data-view]','view']])document.querySelectorAll(selector).forEach(b=>{const active=b.dataset[key]===state[key];b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
 $('#source-controls').hidden=state.view!=='sources';$('#coverage-controls').hidden=state.view!=='coverage';
 const gs=groups(data,state),cells=scopeCoverage(data,state),attempted=cells.filter(c=>c.status!=='not_submitted');
 $('#metric-sources').textContent=gs.length;$('#metric-records').textContent=gs.reduce((n,g)=>n+g.records.length,0);
 $('#metric-countries').textContent=new Set(attempted.map(c=>c.countryCode)).size;
 $('#metric-coverage').innerHTML=`${attempted.length}<span class="denominator"> / ${cells.length.toLocaleString('en')}</span>`;
 document.querySelectorAll('[data-type]').forEach(b=>b.querySelector('span').textContent=groups(data,{...state,type:b.dataset.type}).length);
 const scope=state.indicator==='all'?'All indicators':`${state.indicator==='ndc-adaptation'?'NDC adaptation':state.indicator} · ${indicatorName(state.indicator)}`;
 $('#results-title').textContent=state.view==='coverage'?'Search coverage':scope;
 if(state.view==='coverage')renderCoverage();
 else{
  $('#pagination').hidden=true;
  $('#results-subtitle').textContent=`${gs.length} source${gs.length===1?'':'s'} · ${state.country==='all'?'All countries':countryName(state.country)} · grouped by source URL and country`;
  $('#result-list').innerHTML=gs.length?gs.map(renderCard).join(''):emptyState();
  document.querySelectorAll('[data-source]').forEach(b=>b.onclick=()=>openSource(gs[Number(b.dataset.source)]));
 }
 const inspect=$('#inspect-coverage');if(inspect)inspect.onclick=()=>change({view:'coverage',status:'all',query:''});
 $('#export').disabled=!data.records.some(r=>matches(r,state,data.publicationWindow));
}
function showDialog(html){$('#dialog-content').innerHTML=html;$('#source-dialog').showModal();}
function recordDetail(r){
 const facts=[['Indicator',`${r.indicatorId} · ${indicatorName(r.indicatorId)}`],['Claim type',human(r.claimType)],['Indicator fit',FIT[r.indicatorFit]||human(r.indicatorFit)],['Data / target period',r.period],['Source date',dateText(r)],['Geographic scope',r.geographyScope],['National relevance',r.nationalRelevance],['Source language',r.sourceLanguage]];
 return `<section class="record-detail"><div class="record-tags">${tags([r])}</div><h3>${esc(r.headline)}</h3><p>${esc(r.statement)}</p><div class="detail-facts">${facts.map(([label,val])=>`<div><span>${label}</span>${esc(val)}</div>`).join('')}</div>${figureStrip([r])}<div class="detail-label">${esc(r.excerptKind)}</div><blockquote>${esc(r.excerpt)}</blockquote>${r.translationNote?`<p class="translation-note">${esc(r.translationNote)}</p>`:''}<p>Locator: <strong>${esc(r.locator)}</strong></p><div class="detail-label">Limitations and qualifications</div><ul class="limitations">${[...r.limitations,r.sourceMetadataNote,r.documentStatus].filter(Boolean).map(t=>`<li>${esc(t)}</li>`).join('')}</ul><details><summary>Provenance and model screening</summary><p>Model scores are not calibrated probabilities. Screening applies to the retained claim, not to an official indicator value.</p><pre>${esc(JSON.stringify({recordId:r.recordId,sourceSha256:r.sourceSha256,locator:r.locator,retrievedAt:r.retrievedAt,exportOrigin:r.exportOrigin},null,2))}</pre></details></section>`;
}
function openSource(g){showDialog(`<h2 id="dialog-title" class="dialog-title">${esc(g.title)}</h2><div class="dialog-source"><span>${esc(countryName(g.countryCode))}</span><span>${g.records.length} evidence records</span>${link('Open original source',g.url)}</div>${g.records.map(recordDetail).join('')}`);}
function openPair(c){
 const records=data.records.filter(r=>r.indicatorId===c.indicatorId&&r.countryCode===c.countryCode),leads=data.leads.filter(l=>l.indicatorId===c.indicatorId&&l.countryCode===c.countryCode);
 showDialog(`<h2 id="dialog-title" class="dialog-title">${esc(c.indicatorId)} · ${esc(countryName(c.countryCode))}</h2><p>${esc(indicatorName(c.indicatorId))}</p><span class="coverage-status ${esc(c.status)}">${esc(STATUS[c.status])}</span><p>${esc(c.reason||'No additional processing reason was recorded.')}</p>${records.length?records.map(recordDetail).join(''):'<p>No admitted record was retained for this pair. This is a search outcome, not an indicator value.</p>'}${leads.length?`<div class="detail-label">Retained source leads</div><p>Links are discovery leads; inclusion alone does not establish support for the indicator.</p><ul class="lead-list">${leads.map(l=>`<li>${link(new URL(l.sourceUrl).hostname,l.sourceUrl)} · ${l.admitted?'Contains an admitted record':'Lead only; no admitted record'}</li>`).join('')}</ul>`:'<p>No source leads were retained for this pair.</p>'}`);
}
async function init(){
 const response=await fetch(new URL('data.json',import.meta.url));if(!response.ok)throw Error('The source snapshot could not be loaded.');data=await response.json();
 state=readState();document.body.classList.toggle('embedded',new URLSearchParams(location.search).get('embed')==='1');renderNavigation();
 document.querySelectorAll('[data-indicator]').forEach(b=>b.onclick=()=>change({indicator:b.dataset.indicator}));
 document.querySelectorAll('[data-type]').forEach(b=>b.onclick=()=>change({type:b.dataset.type}));
 document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>change({view:b.dataset.view}));
 for(const [id,key] of [['indicator','indicator'],['country','country'],['source-date','date'],['coverage-status','status']])$('#'+id).onchange=e=>change({[key]:e.target.value});
 $('#search').oninput=e=>change({query:e.target.value});$('#reset').onclick=()=>change(defaults);
 $('#previous-page').onclick=()=>{page--;render();};$('#next-page').onclick=()=>{page++;render();};
 $('#close-dialog').onclick=()=>$('#source-dialog').close();$('#source-dialog').onclick=e=>{if(e.target===$('#source-dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}};
 $('#copy-view').onclick=async()=>{try{let url=viewUrl();if(document.body.classList.contains('embedded')){url=new URL('/tools/gold-sources',location.origin);const q=viewUrl().searchParams;q.delete('embed');url.search=q.toString();}await navigator.clipboard.writeText(url.href);notify('View link copied.');}catch{notify('Copy is unavailable. Use the current address to share this view.');}};
 $('#export').onclick=()=>{const rows=data.records.filter(r=>matches(r,state,data.publicationWindow)),blob=new Blob([csv(rows)],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`gold-sources-${state.indicator}-${state.country}-${data.snapshotDate}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notify(`${rows.length} English evidence records exported.`);};
 window.addEventListener('popstate',()=>{state=readState();page=0;render();});render();
}
init().catch(error=>{$('#result-list').innerHTML=`<div class="empty-state"><h3>Source snapshot unavailable</h3><p>${esc(error.message)} Reload this page to try again.</p></div>`;});
