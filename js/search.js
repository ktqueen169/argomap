const searchInput=document.getElementById('search');
const searchResultsEl=document.getElementById('search-results');
let searchResults=[];
let searchActiveIndex=-1;

function buildSearchIndex(query){
 const q=query.trim().toLowerCase();
 if(!q) return [];
 const out=[];
 LOCATIONS.forEach(loc=>{
  const region=regionForLocation(loc);
  const locText=[
   loc.name,loc.desc||'',(loc.aliases||[]).join(' ')
  ].join(' ').toLowerCase();
  if(locText.includes(q)){
   out.push({type:'location',loc,floorIndex:null,label:loc.name,meta:`${region.label} · ${CATEGORIES[loc.cat].label}`});
  }
  if(Array.isArray(loc.floors)){
   loc.floors.forEach((f,i)=>{
    const floorText=[f.name,f.desc||'',(f.aliases||[]).join(' ')].join(' ').toLowerCase();
    if(floorText.includes(q)){
      out.push({type:'floor',loc,floorIndex:i,label:f.name,meta:`${loc.name} · ${region.label}`});
    }
   });
  }
 });
 return out.slice(0,12);
}

function setSearchActiveIndex(next){
 searchActiveIndex=next;
 const items=searchResultsEl.querySelectorAll('.search-item');
 items.forEach((el,i)=>el.classList.toggle('active',i===searchActiveIndex));
}

function hideSearchResults(){
 searchResultsEl.style.display='none';
 searchResultsEl.innerHTML='';
 searchResults=[];
 searchActiveIndex=-1;
}

function renderSearchResults(results){
 searchResults=results;
 if(!results.length){
  hideSearchResults();
  return;
 }
 searchResultsEl.innerHTML=results.map((r,i)=>`
  <div class="search-item ${i===0?'active':''}" data-i="${i}">
   <div class="search-name">${r.label}</div>
   <div class="search-meta">${r.meta}</div>
  </div>`).join('');
 searchResultsEl.style.display='block';
 searchActiveIndex=0;
 searchResultsEl.querySelectorAll('.search-item').forEach(el=>{
  el.onclick=()=>{
   const i=Number.parseInt(el.dataset.i,10);
   const hit=searchResults[i];
   if(!hit) return;
   openLocationById(hit.loc.id,hit.floorIndex,true);
   hideSearchResults();
  };
 });
}

function findSearchMatch(query){
 const hits=buildSearchIndex(query);
 return hits.length ? hits[0] : null;
}

function bindSearchHandlers(){
 searchInput.addEventListener('input',e=>{
  const results=buildSearchIndex(e.target.value);
  renderSearchResults(results);
 });

 searchInput.addEventListener('keydown',e=>{
  if(e.key==='ArrowDown' && searchResults.length){
   e.preventDefault();
   setSearchActiveIndex(Math.min(searchActiveIndex+1, searchResults.length-1));
   return;
  }
  if(e.key==='ArrowUp' && searchResults.length){
   e.preventDefault();
   setSearchActiveIndex(Math.max(searchActiveIndex-1, 0));
   return;
  }
  if(e.key==='Enter'){
   e.preventDefault();
   if(searchResults.length && searchActiveIndex>=0){
    const hit=searchResults[searchActiveIndex];
    openLocationById(hit.loc.id,hit.floorIndex,true);
    hideSearchResults();
    return;
   }
   const match=findSearchMatch(e.target.value);
   if(match){
    openLocationById(match.loc.id,match.floorIndex,true);
    hideSearchResults();
   }
  }
 });

 searchInput.addEventListener('blur',()=>{
  setTimeout(hideSearchResults,120);
 });
}
