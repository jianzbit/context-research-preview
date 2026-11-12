// Add scoped country browsing to the retained, read-only Evidence Hub frontend.
const data=await fetch(new URL('./preview-data.json?v=a6abb7a854c1',import.meta.url)).then(r=>r.json());
const params=new URLSearchParams(location.search);
let mounted;
function enhance(){
 const picker=document.querySelector('#indicator');
 if(!picker||picker===mounted)return;
 mounted=picker;
 const panel=document.createElement('section');panel.className='hub-snapshot-controls';panel.setAttribute('aria-label','Snapshot country and coverage');
 const label=document.createElement('label');label.htmlFor='hub-country';label.append('Country');
 const select=document.createElement('select');select.id='hub-country';
 for(const country of [{code:'all',name:'All countries'},...data.countries]){const option=document.createElement('option');option.value=country.code;option.textContent=country.code==='all'?country.name:`${country.name} (${country.code})`;select.append(option);}
 select.value=params.get('country')||'all';if(!select.value)select.value='all';label.append(select);
 const stats=document.createElement('p');stats.className='hub-snapshot-stats';
 const coverage=document.createElement('a');coverage.className='hub-coverage-link';coverage.textContent='Coverage & source cards ↗';
 const note=document.createElement('p');note.className='hub-snapshot-note';note.textContent='21 Gold evidence records + 8 retained wildfire pilot records. All await human review. Shared review changes require the full backend.';
 panel.append(label,stats,coverage,note);picker.closest('.indicator-choice').after(panel);
 function summarize(){
  const selected=picker.value||params.get('indicator')||'gold-all';
  const indicator=selected==='gold-all'?'all':selected,country=select.value;
  const pairs=data.gold_coverage.filter(c=>(indicator==='all'||c.indicatorId===indicator)&&(country==='all'||c.countryCode===country));
  const tried=pairs.filter(c=>c.status!=='not_submitted').length;
  stats.textContent=`Gold search coverage: ${tried} / ${pairs.length.toLocaleString('en')} pairs attempted. Legacy pilot sources are counted separately.`;
  const q=new URLSearchParams({indicator,country,view:'coverage',status:'all'});coverage.href='./gold-coverage.html?'+q;
 }
 picker.addEventListener('change',()=>{const url=new URL(location.href);url.searchParams.set('indicator',picker.value);history.replaceState(null,'',url);summarize();});
 select.addEventListener('change',()=>{const url=new URL(location.href);url.searchParams.set('country',select.value);url.searchParams.set('indicator',picker.value);location.assign(url);});
 summarize();
}
const observer=new MutationObserver(()=>{
 enhance();
 for(const button of document.querySelectorAll('button'))if(button.textContent.trim()==='Excel .xlsx'){button.disabled=true;button.title='CSV export is available for the current snapshot.';}
});
observer.observe(document.querySelector('#root'),{childList:true,subtree:true});enhance();
