function escapeHtml(value){
 return String(value??'')
  .replace(/&/g,'&amp;')
  .replace(/</g,'&lt;')
  .replace(/>/g,'&gt;')
  .replace(/"/g,'&quot;')
  .replace(/'/g,'&#39;');
}

function escapeAttr(value){
 return escapeHtml(value).replace(/`/g,'&#96;');
}

function popupDetails(item, fallback={}){
 const image=item.img||fallback.img;
 const link=item.link||fallback.link;
 const owner=item.owner||fallback.owner;
 const safeDesc=escapeHtml(item.desc||'');
 const safeAlt=escapeAttr(item.name||fallback.name||'Location image');
 const imageHtml=image
  ? `<img class="popup-img" src="${escapeAttr(image)}" alt="${safeAlt}" loading="lazy" decoding="async" fetchpriority="low"/>`
  : '';
 const ownerHtml=owner
  ? `<div class="popup-owner">Owned by: <a class="popup-owner-link" href="${escapeAttr(owner.url||'')}" target="_blank" rel="noopener">${escapeHtml(owner.name||'')}</a></div>`
  : '';
 const linkHtml=link
  ? `<a class="popup-details-link" href="${escapeAttr(link)}" target="_blank" rel="noopener">More details</a>`
  : '';
 const linksHtml=linkHtml||ownerHtml
  ? `<div class="popup-links">${linkHtml}${ownerHtml}</div>`
  : '';

 return `
  ${imageHtml}
  <div class="popup-desc">${safeDesc}</div>
  ${linksHtml}`;
}

function popupThemeClass(region){
 return `popup-theme-${region.id||DEFAULT_REGION.id}`;
}

function updateUrlParams(params){
 const url=new URL(window.location.href);
 Object.entries(params).forEach(([k,v])=>{
  if(v===null || v===undefined || v===''){
   url.searchParams.delete(k);
  } else {
   url.searchParams.set(k,v);
  }
 });
 window.history.replaceState({},'',url.toString());
}

function makePopup(loc){
 const cfg=CATEGORIES[loc.cat];
 const region=regionForLocation(loc);
 const themeClass=popupThemeClass(region);
 const renderPopupBody=(extraClass='')=>`
  <div class="popup-body ${extraClass}">
   <div class="popup-title">${escapeHtml(loc.name)}</div>
   <div class="popup-cat"><img class="popup-cat-icon" src="${escapeAttr(cfg.icon)}" alt="${escapeAttr(cfg.label)} icon" /> ${escapeHtml(cfg.label)}</div>
   <div class="popup-region-row"><div class="popup-region">${escapeHtml(region.label)}</div></div>
   ${popupDetails(loc)}
  </div>`;

 const base=renderPopupBody(themeClass);

 if(!loc.floors) return base;
 const floorBase=renderPopupBody();

 const tabs=loc.floors.map((f,i)=>{
  const len=f.name.length;
  const sizeClass=len>24?'xlong-label':(len>16?'long-label':'');
  return `<div class="vtab-btn ${i===0?'active':''} ${sizeClass}" data-i="${i}">${escapeHtml(f.name)}</div>`;
 }).join('');

 const content=loc.floors.map((f,i)=>
  `<div class="floor-panel" data-i="${i}" style="display:${i===0?'block':'none'}">
   <div class="popup-title">${escapeHtml(f.name)}</div>
   ${popupDetails(f,loc)}
  </div>`).join('');

 return `<div class="popup-shell ${themeClass}">${floorBase}
 <div class="vtab-container">
  <div class="vtab-list">${tabs}</div>
  <div>${content}</div>
 </div></div>`;
}

function makeRegionPopup(region){
 const themeClass=popupThemeClass(region);
 return `
  <div class="popup-body ${themeClass}">
   <div class="popup-title">${escapeHtml(region.label)}</div>
   <div class="popup-region-row"><div class="popup-cat popup-cat-region">Region</div></div>
   ${popupDetails(region)}
  </div>`;
}
