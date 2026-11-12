const $=selector=>document.querySelector(selector);
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function sourceUrl(value){try{const u=new URL(value);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password?u.href:null;}catch{return null;}}
let data;
const query=new URLSearchParams(location.search);
let indicator=query.get('indicator')||'gold-all',country=query.get('country')||'all';
function selectRecords(){const countryName=data.countries.find(c=>c.code===country)?.name;return data.records.filter(r=>(indicator==='gold-all'||r.indicator_id===indicator)&&(country==='all'||r.country_code===country||Boolean(countryName&&r.country===countryName)));}
function card(record){
 const url=sourceUrl(record.source_url),scope=data.indicators.find(i=>i.id===record.indicator_id),notes=(record.validation_warnings||[]).filter(n=>['SOURCE_BOUNDARY','MEASUREMENT_BOUNDARY','SOURCE_DATE'].includes(n.code)).map(n=>n.message);
 const passages=record.supporting_passages||[];
 const figures=(record.key_statistics||[]).map(f=>{const value=String(f.value??''),unit=String(f.unit??'');return `<div class="figure"><strong>${escape(value)}${value.trim().endsWith(unit.trim())?'':' '+escape(unit)}</strong><span>${escape(f.measure||f.statistic_text)}${f.reference_period?' · '+escape(f.reference_period):''}${f.geography?' · '+escape(f.geography):''}</span></div>`;}).join('');
 const dateLabel=(record.validation_warnings||[]).some(n=>n.code==='SOURCE_DATE'&&n.message.startsWith('Updated:'))?'Updated':'Published';
 const meta=[scope?.indicator_code||record.indicator_id,record.country||record.region,record.publisher,record.publication_date?dateLabel+' '+record.publication_date:null].filter(Boolean).map(escape).join('<span class="meta-dot">·</span>');
 const provenance=record.original_provenance;
 return `<article class="evidence-card"><div class="card-heading"><h3>${escape(record.title)}</h3>${url?`<a class="source-link" href="${escape(url)}" target="_blank" rel="noopener noreferrer">Source ↗</a>`:''}</div><p class="metadata">${meta}</p><p class="summary">${escape(record.summary)}</p>${figures?`<div class="figures">${figures}</div>`:''}${passages.length||notes.length?`<details><summary>Source evidence</summary>${passages.map(p=>`<blockquote>${escape(p)}</blockquote>`).join('')}${notes.length?`<ul class="source-notes">${[...new Set(notes)].map(n=>`<li>${escape(n)}</li>`).join('')}</ul>`:''}${provenance?.locator?`<p class="locator">Source locator: ${escape(provenance.locator)}</p>`:''}</details>`:''}</article>`;
}
function render(){
 const records=selectRecords();$('#result-count').textContent=`${records.length} evidence record${records.length===1?'':'s'}`;
 $('#evidence-list').innerHTML=records.length?records.map(card).join(''):'<p class="empty">No evidence is available for this selection in the current snapshot.</p>';
 $('#indicator').value=indicator;$('#country').value=country;
 const url=new URL(location.href);if(indicator==='gold-all')url.searchParams.delete('indicator');else url.searchParams.set('indicator',indicator);if(country==='all')url.searchParams.delete('country');else url.searchParams.set('country',country);history.replaceState(null,'',url);
}
async function init(){
 const response=await fetch(new URL('../preview-data.json',import.meta.url),{cache:'no-cache'});if(!response.ok)throw Error('Evidence could not be loaded.');data=await response.json();
 if(indicator==='all'||!data.indicators.some(i=>i.id===indicator))indicator='gold-all';
 if(!data.countries.some(c=>c.code===country))country='all';
 $('#indicator').insertAdjacentHTML('beforeend',data.indicators.filter(i=>i.id!=='gold-all').map(i=>`<option value="${escape(i.id)}">${escape(i.indicator_code)} — ${escape(i.name)}</option>`).join(''));
 $('#country').insertAdjacentHTML('beforeend',data.countries.map(c=>`<option value="${escape(c.code)}">${escape(c.name)} (${escape(c.code)})</option>`).join(''));
 $('#indicator').addEventListener('change',e=>{indicator=e.target.value;render();});$('#country').addEventListener('change',e=>{country=e.target.value;render();});
 window.addEventListener('popstate',()=>{const p=new URLSearchParams(location.search);indicator=p.get('indicator')||'gold-all';country=p.get('country')||'all';render();});render();
}
init().catch(error=>{$('#evidence-list').innerHTML=`<p class="empty">${escape(error.message)}</p>`;});
