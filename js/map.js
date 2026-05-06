const SIZE_TO_IMAGE={
 1000:'1k.png',
 2000:'2k.png',
 3000:'3k.png'
};
const DEFAULT_MAP_SIZE=2000;
const DEFAULT_MAP_IMAGE=SIZE_TO_IMAGE[DEFAULT_MAP_SIZE];
const urlParams=new URLSearchParams(window.location.search);
const mapSizeParam=Number.parseInt(urlParams.get('map')||'',10);
const mapSize=SIZE_TO_IMAGE[mapSizeParam] ? mapSizeParam : DEFAULT_MAP_SIZE;
const mapImageParam=(urlParams.get('img')||'').trim();
const mapImage=mapImageParam || SIZE_TO_IMAGE[mapSize] || DEFAULT_MAP_IMAGE;

const MAP_WIDTH=mapSize, MAP_HEIGHT=mapSize;
const MAP_BUFFER=400;
const WORLD_WIDTH=MAP_WIDTH+(MAP_BUFFER*2);
const WORLD_HEIGHT=MAP_HEIGHT+(MAP_BUFFER*2);
const WORLD_CENTER_Y=MAP_BUFFER+(MAP_HEIGHT/2);
const WORLD_CENTER_X=MAP_BUFFER+(MAP_WIDTH/2);

function px([y,x]){
 return [WORLD_CENTER_Y-y,WORLD_CENTER_X+x];
}

const bounds=[[0,0],[WORLD_HEIGHT,WORLD_WIDTH]];
const imageBounds=[[MAP_BUFFER,MAP_BUFFER],[MAP_BUFFER+MAP_HEIGHT,MAP_BUFFER+MAP_WIDTH]];
const map=L.map('map',{
 crs:L.CRS.Simple,
 tap:true,
 closePopupOnClick:false,
 zoomControl:false,
 minZoom:-2,
 maxZoom:2,
 maxBounds:bounds,
 maxBoundsViscosity:1.0
});
map.fitBounds(bounds);
L.control.zoom({position:'bottomleft'}).addTo(map);
L.imageOverlay(`images/${mapImage}`, imageBounds).addTo(map);

let editorMode=false, debugMarker=null;
let suppressNextMapClick=false;

function setEditorMode(enabled){
 editorMode=!!enabled;
 const box=document.getElementById('editor-mode-toggle');
 if(box) box.checked=editorMode;
 if(editorMode){
  if(map.hasLayer(regionsLayer)) map.removeLayer(regionsLayer);
 }
 if(!editorMode && debugMarker){
  map.removeLayer(debugMarker);
  debugMarker=null;
 }
}

map.on('click',e=>{
 hideSearchResults();
  if(editorMode){
    const y=WORLD_CENTER_Y-e.latlng.lat;
    const x=e.latlng.lng-WORLD_CENTER_X;
    console.log(`pos: [${Math.round(y)}, ${Math.round(x)}]`);

    if(debugMarker) map.removeLayer(debugMarker);
    debugMarker=L.marker(e.latlng).addTo(map)
      .bindPopup(`<span style="color:#fff;">pos: [${Math.round(y)}, ${Math.round(x)}]</span>`)
      .openPopup();
  } else {
  if(suppressNextMapClick){
   suppressNextMapClick=false;
   return;
  }
  clearRegion();
 }
});

const categoryGroups={}, markerMap={};
Object.keys(CATEGORIES).forEach(c=>{
 categoryGroups[c]=L.layerGroup().addTo(map);
});

let activeRegion=null;
let layersControl=null;
const regionPolygons={};
const regionsLayer=L.layerGroup().addTo(map);

function regionAccent1Color(region){
 const theme=REGION_ACCENTS[region.id];
 return (theme && theme.accent1) || region.accent || '#5a6672';
}

function ensureEditorToggleRow(){
 if(!layersControl) return;
 const overlaysEl=layersControl.getContainer().querySelector('.leaflet-control-layers-overlays');
 if(!overlaysEl || document.getElementById('editor-mode-toggle')) return;
 const row=document.createElement('div');
 row.className='editor-toggle-row';
 row.innerHTML='<label><input id="editor-mode-toggle" type="checkbox"/>Coord Click</label>';
 overlaysEl.appendChild(row);
 const box=row.querySelector('#editor-mode-toggle');
 box.checked=editorMode;
 box.addEventListener('change',e=>{
  setEditorMode(e.target.checked);
 });
}

function regionStyle(region, selected){
 const base=regionAccent1Color(region);
 return {
  color:base,
  weight:selected?3:1,
  fillColor:base,
  fillOpacity:selected?0.5:0.22
 };
}

function applyRegionStyles(){
 REGIONS.forEach(region=>{
  const polygon=regionPolygons[region.id];
  if(!polygon) return;
  polygon.setStyle(regionStyle(region, activeRegion===region.id));
 });
}

function clearRegion(){
 activeRegion=null;
 applyRegionStyles();
}

function openLocationById(locId, floorIndex=null, center=true){
 const entry=markerMap[locId];
 if(!entry) return false;
 const marker=entry.marker;
 if(Number.isInteger(floorIndex)){
  marker._openFloorIndex=floorIndex;
 } else {
  delete marker._openFloorIndex;
 }
 if(center) map.setView(marker.getLatLng(),1);
 if(Number.isInteger(floorIndex) && typeof marker.isPopupOpen==='function' && marker.isPopupOpen()){
  marker.closePopup();
 }
 marker.openPopup();
 updateUrlParams({loc:locId,region:null,floor:Number.isInteger(floorIndex)?String(floorIndex):null});
 return true;
}

function openRegionById(regionId){
 const polygon=regionPolygons[regionId];
 const region=REGION_INDEX[regionId];
 if(!polygon || !region) return false;
 activeRegion=region.id;
 applyRegionStyles();
 polygon.bringToFront();
 map.fitBounds(polygon.getBounds(),{maxZoom:1,padding:[30,30]});
 polygon.openPopup(polygon.getBounds().getCenter());
 updateUrlParams({region:regionId,loc:null,floor:null});
 return true;
}

function applyDeepLinkFromUrl(){
 const url=new URL(window.location.href);
 const loc=url.searchParams.get('loc');
 const region=url.searchParams.get('region');
 const floorRaw=url.searchParams.get('floor');
 const floor=floorRaw!==null ? Number.parseInt(floorRaw,10) : null;
 if(loc && openLocationById(loc, Number.isInteger(floor)?floor:null, true)) return;
 if(region) openRegionById(region);
}

function renderMapData(){
 regionsLayer.clearLayers();
 Object.keys(regionPolygons).forEach(id=>delete regionPolygons[id]);
 Object.keys(markerMap).forEach(id=>delete markerMap[id]);
 Object.values(categoryGroups).forEach(group=>group.clearLayers());
 activeRegion=null;

 REGIONS.forEach(region=>{
  const latLngs=region.points.map(ring=>ring.map(pt=>px(pt)));
  const polygon=L.polygon(latLngs,{
   ...regionStyle(region,false),
   className:'region-overlay'
  })
   .bindPopup(makeRegionPopup(region))
   .bindTooltip(region.label,{sticky:true})
   .addTo(regionsLayer);
  polygon.on('click',e=>{
   if(editorMode){
    polygon.closePopup();
    map.closePopup();
    L.DomEvent.stop(e);
    return;
   }
   activeRegion=region.id;
   applyRegionStyles();
   polygon.bringToFront();
   polygon.openPopup(e.latlng);
   updateUrlParams({region:region.id,loc:null,floor:null});
   suppressNextMapClick=true;
   L.DomEvent.stop(e);
  });
  regionPolygons[region.id]=polygon;
 });

 LOCATIONS.forEach(loc=>{
  const region=regionForLocation(loc);
  const marker=L.marker(px(loc.pos),{icon:makeIcon(loc.cat,region)})
   .bindPopup(makePopup(loc));
  marker.on('click',()=>updateUrlParams({loc:loc.id,region:null,floor:null}));
  categoryGroups[loc.cat].addLayer(marker);
  markerMap[loc.id]={marker,loc};
 });

 const overlays={};
 Object.entries(CATEGORIES).forEach(([k,v])=>{
  overlays[`${v.e} ${v.label}`]=categoryGroups[k];
 });
 overlays['Regions']=regionsLayer;
 if(layersControl) map.removeControl(layersControl);
 layersControl=L.control.layers(null,overlays,{collapsed:true}).addTo(map);
 ensureEditorToggleRow();
}

async function loadWorldData(){
 const [regionsRes,locationsIndexRes]=await Promise.all([
  fetch('./data/regions.json'),
  fetch('./data/locations/index.json')
 ]);
 if(!regionsRes.ok) throw new Error(`Failed to load regions data: ${regionsRes.status}`);
 if(!locationsIndexRes.ok) throw new Error(`Failed to load locations index: ${locationsIndexRes.status}`);
 const locationFiles=await locationsIndexRes.json();
 if(!Array.isArray(locationFiles)) throw new Error('Locations index must be a JSON array of filenames');
 const locationResponses=await Promise.all(
  locationFiles.map(file=>fetch(`./data/locations/${file}`))
 );
 locationResponses.forEach((res,i)=>{
  if(!res.ok) throw new Error(`Failed to load locations file "${locationFiles[i]}": ${res.status}`);
 });
 const locationArrays=await Promise.all(locationResponses.map(res=>res.json()));
 const mergedLocations=[];
 locationArrays.forEach((payload,i)=>{
  if(!Array.isArray(payload)) throw new Error(`Locations file "${locationFiles[i]}" must be a JSON array`);
  mergedLocations.push(...payload);
 });
 const raw={
  regions:await regionsRes.json(),
  locations:mergedLocations
 };
 const data=parseWorldData(raw);
 REGIONS=data.regions;
 LOCATIONS=data.locations;
 REGION_INDEX=Object.fromEntries(REGIONS.map(r=>[r.id,r]));
 renderMapData();
 if(!deepLinkApplied){
  applyDeepLinkFromUrl();
  deepLinkApplied=true;
 }
}

loadWorldData().catch(err=>{
 console.error(err);
 alert('Could not load map data from data/regions.json or data/locations/index.json');
});

window.addEventListener('popstate',()=>{
 applyDeepLinkFromUrl();
});

map.on('overlayadd overlayremove',()=>{
 ensureEditorToggleRow();
});

bindSearchHandlers();

map.on('popupopen',e=>{
 const el=e.popup.getElement();
 const btns=el.querySelectorAll('.vtab-btn');
 const panels=el.querySelectorAll('.floor-panel');

 btns.forEach(b=>{
  b.onclick=()=>{
   btns.forEach(x=>x.classList.remove('active'));
   b.classList.add('active');

   panels.forEach(p=>{
    p.style.display=p.dataset.i===b.dataset.i?'block':'none';
   });
  };
 });

 const source=e.popup._source;
 if(source && Number.isInteger(source._openFloorIndex)){
  const targetBtn=el.querySelector(`.vtab-btn[data-i="${source._openFloorIndex}"]`);
  if(targetBtn) targetBtn.click();
  delete source._openFloorIndex;
 }
});
