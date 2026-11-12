// Source adapter for the retained Evidence Hub frontend. No backend or model calls.
export const REVIEW_QUEUE = ['NEW','REVIEWED','NEEDS_REVISION'];
let pending;
const current = () => new URLSearchParams(globalThis.location?.search || '');
async function snapshot(){
  return pending ??= fetch(new URL('../preview-data.json?v=a6abb7a854c1',import.meta.url)).then(async response=>{
    if(!response.ok)throw Error('The Evidence Hub snapshot could not be loaded.');
    const data=await response.json();
    if(data.schema_version!=='public-preview.v1')throw Error('Unsupported snapshot schema.');
    return data;
  }).catch(error=>{pending=undefined;throw error;});
}
const urlOf=value=>new URL(value,'https://preview.invalid');
const page=(rows,url)=>rows.slice(Number(url.searchParams.get('offset')||0),Number(url.searchParams.get('offset')||0)+Number(url.searchParams.get('limit')||100));
export function selectRecords(data,id='gold-all',country='all'){
  const name=data.countries.find(c=>c.code===country)?.name;
  return data.records.filter(r=>(id==='gold-all'||r.indicator_id===id)&&(country==='all'||r.country_code===country||Boolean(name&&r.country===name)));
}
function runFor(data,id,rows){return {...data.run,id:'snapshot-'+id,mode:'imported_snapshot',stage:'Saved source snapshot; human review pending',candidate_count:rows.length,relevant_count:rows.length,extracted_count:rows.length,approved_count:0,generated_queries:[],started_at:data.captured_at,completed_at:data.captured_at,date_from:null,date_to:data.captured_at.slice(0,10),provider:'local-result-import',warnings:['This is a read-only imported snapshot. Gold coverage and retained legacy pilot sources are separate.']};}
export async function previewApi(path,options={}){
  if((options.method||'GET').toUpperCase()!=='GET')throw Error('This preview is read-only. Review decisions require the full Evidence Hub backend.');
  const data=await snapshot(),url=urlOf(path),route=url.pathname,params=current(),country=params.get('country')||'all';
  const indicators=data.indicators||[data.indicator];
  const id=route.startsWith('/indicators/')?decodeURIComponent(route.split('/')[2]):'gold-all';
  const rows=selectRecords(data,id,country),all=selectRecords(data,'gold-all',country);let result;
  if(route==='/session')result={user_id:'preview-visitor',role:'reader',auth_mode:'preview',search_provider:'preview',ai_provider:'none',forge_adapter:'preview',indicator_source:'private_snapshot',indicator_catalog_error:null};
  else if(route==='/indicators'){
    const selected=params.get('indicator');result=[...indicators];
    if(selected&&result.some(i=>i.id===selected))result.sort((a,b)=>Number(b.id===selected)-Number(a.id===selected));
  }
  else if(route===`/indicators/${id}`)result=indicators.find(i=>i.id===id);
  else if(route===`/indicators/${id}/context`)result=page(rows.filter(r=>!url.searchParams.get('status')||r.review_status===url.searchParams.get('status')),url);
  else if(route===`/indicators/${id}/context-summary`)result={approved_count:0,case_study_count:0,record_count:rows.length,countries:[...new Set(rows.map(r=>r.country).filter(Boolean))],regions:[],evidence_types:{},review_queue_count:rows.filter(r=>REVIEW_QUEUE.includes(r.review_status)).length,last_successful_search:null,most_recent_evidence_date:rows.map(r=>r.publication_date).filter(Boolean).sort().at(-1)||null,statistics_count:0,primary_source_count:0,gaps:[]};
  else if(route==='/review-queue')result=page(all.filter(r=>REVIEW_QUEUE.includes(r.review_status)&&(!url.searchParams.get('indicator_id')||url.searchParams.get('indicator_id')==='gold-all'||r.indicator_id===url.searchParams.get('indicator_id'))),url);
  else if(route.startsWith('/evidence/'))result=data.records.find(r=>r.id===route.split('/')[2]);
  else if(route===`/indicators/${id}/research-runs`)result=[runFor(data,id,rows)];
  else if(route.startsWith('/research-runs/')&&route.endsWith('/results')){const target=route.split('/')[2].replace(/^snapshot-/,'');result=selectRecords(data,target,country).map(r=>({id:r.id,title:r.title,source_url:r.source_url,relevance_label:'Imported; pending human review',relevance_explanation:r.why_relevant,processing_status:'EXTRACTED'}));}
  else if(route==='/team/discoveries'){
    const scope=url.searchParams.get('scope')||'today',queue=all.filter(r=>REVIEW_QUEUE.includes(r.review_status)),selected=scope==='approved'?[]:scope==='pending'?queue:all;
    result={scope,workspace:'active',date:data.captured_at.slice(0,10),timezone:'America/Toronto',counts:{today:all.length,pending:queue.length,approved:0},total:selected.length,offset:Number(url.searchParams.get('offset')||0),limit:Number(url.searchParams.get('limit')||1),items:page(selected,url).map(r=>({id:r.id,title:r.title,summary_preview:r.summary.slice(0,237),indicator:{id:r.indicator_id,code:indicators.find(i=>i.id===r.indicator_id)?.indicator_code||r.indicator_id,name:indicators.find(i=>i.id===r.indicator_id)?.name||r.indicator_id},publisher:r.publisher,publication_date:r.publication_date,discovered_at:r.created_at,source_url:r.source_url,source_type:r.source_type,evidence_type:r.evidence_type,context_category:r.context_category,review_status:r.review_status,is_demo:false,has_critical_warnings:r.validation_warnings.some(w=>w.severity==='critical')}))};
  }
  if(result===undefined)throw Error('This action requires the full Evidence Hub backend.');
  return structuredClone(result);
}
const quote=value=>{let s=value==null?'':typeof value==='object'?JSON.stringify(value):String(value);if(/^\s*[=+@-]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
export async function previewDownload(path,options={}){
  const data=await snapshot(),url=urlOf(path),country=current().get('country')||'all',id=decodeURIComponent(url.pathname.split('/')[2]);
  if(!url.pathname.startsWith(`/indicators/${id}/export.`))throw Error('Export is unavailable for this selection.');
  let rows=selectRecords(data,id,country);const ids=options.body?JSON.parse(String(options.body)).evidence_ids:undefined;
  if(ids){if(!ids.length||ids.some(id=>!rows.some(r=>r.id===id)))throw Error('Select records from the current view.');rows=rows.filter(r=>ids.includes(r.id));}
  else if(url.searchParams.get('scope')==='approved')rows=[];
  if(url.pathname.endsWith('.xlsx'))throw Error('Use CSV for this read-only snapshot.');
  if(url.pathname.endsWith('.json'))return new Blob([JSON.stringify({schema_version:data.schema_version,captured_at:data.captured_at,indicator:data.indicators.find(i=>i.id===id),evidence:rows},null,2)],{type:'application/json'});
  const fields=['indicator_id','title','summary','context_category','review_status','country','publication_date','publisher','source_url','key_statistics','why_relevant','supporting_passages','original_provenance'];
  return new Blob(['\ufeff'+[fields.map(quote).join(','),...rows.map(r=>fields.map(k=>quote(r[k])).join(','))].join('\r\n')],{type:'text/csv;charset=utf-8'});
}
