const MAP_WIDTH = 3000,
	MAP_HEIGHT = 3000;
const MAP_BUFFER = 1000;
const EDGE_POPUP_OPTIONS = {
	autoPan: true,
	keepInView: true,
	autoPanPadding: L.point(80, 80),
	autoPanPaddingTopLeft: L.point(80, 80),
	autoPanPaddingBottomRight: L.point(80, 80),
};
const WORLD_WIDTH = MAP_WIDTH + MAP_BUFFER * 2;
const WORLD_HEIGHT = MAP_HEIGHT + MAP_BUFFER * 2;
const WORLD_CENTER_Y = MAP_BUFFER + MAP_HEIGHT / 2;
const WORLD_CENTER_X = MAP_BUFFER + MAP_WIDTH / 2;

function px([y, x]) {
	return [WORLD_CENTER_Y - y, WORLD_CENTER_X + x];
}

const bounds = [
	[0, 0],
	[WORLD_HEIGHT, WORLD_WIDTH],
];
const imageBounds = [
	[MAP_BUFFER, MAP_BUFFER],
	[MAP_BUFFER + MAP_HEIGHT, MAP_BUFFER + MAP_WIDTH],
];
const map = L.map("map", {
	crs: L.CRS.Simple,
	tap: true,
	closePopupOnClick: false,
	zoomControl: false,
	minZoom: -2,
	maxZoom: 2,
	maxBounds: bounds,
	maxBoundsViscosity: 0.3,
});
map.fitBounds(bounds);
L.control.zoom({ position: "bottomleft" }).addTo(map);
L.imageOverlay("images/3k.png", imageBounds).addTo(map);

let editorMode = false,
	debugMarker = null;
let suppressNextMapClick = false;

function setEditorMode(enabled) {
	editorMode = !!enabled;
	const box = document.getElementById("editor-mode-toggle");
	if (box) box.checked = editorMode;
	if (editorMode) {
		if (map.hasLayer(districtsLayer)) map.removeLayer(districtsLayer);
	}
	if (!editorMode && debugMarker) {
		map.removeLayer(debugMarker);
		debugMarker = null;
	}
}

map.on("click", (e) => {
	hideSearchResults();
	if (editorMode) {
		const y = WORLD_CENTER_Y - e.latlng.lat;
		const x = e.latlng.lng - WORLD_CENTER_X;
		console.log(`pos: [${Math.round(y)}, ${Math.round(x)}]`);

		if (debugMarker) map.removeLayer(debugMarker);
		debugMarker = L.marker(e.latlng)
			.addTo(map)
			.bindPopup(
				`<span style="color:#fff;">pos: [${Math.round(y)}, ${Math.round(x)}]</span>`,
				EDGE_POPUP_OPTIONS,
			)
			.openPopup();
	} else {
		if (suppressNextMapClick) {
			suppressNextMapClick = false;
			return;
		}
		clearDistrict();
	}
});

const categoryGroups = {},
	markerMap = {};
Object.keys(CATEGORIES).forEach((c) => {
	categoryGroups[c] = L.layerGroup().addTo(map);
});

let activeDistrict = null;
let layersControl = null;
const districtPolygons = {};
const districtsLayer = L.layerGroup().addTo(map);

map.on("overlayadd", (e) => {
	if (e.layer === districtsLayer && editorMode) {
		setEditorMode(false);
	}
});

function districtAccent1Color(district) {
	return district.accent1 || district.accent || "#5a6672";
}

function ensureEditorToggleRow() {
	if (!layersControl) return;
	const overlaysEl = layersControl
		.getContainer()
		.querySelector(".leaflet-control-layers-overlays");
	if (!overlaysEl || document.getElementById("editor-mode-toggle")) return;
	const row = document.createElement("div");
	row.className = "editor-toggle-row";
	const label = document.createElement("label");
	const box = document.createElement("input");
	box.id = "editor-mode-toggle";
	box.type = "checkbox";
	box.checked = editorMode;
	label.appendChild(box);
	label.appendChild(document.createTextNode("Coord Click"));
	row.appendChild(label);

	const districtsLabel = Array.from(overlaysEl.querySelectorAll("label")).find(
		(el) => el.textContent?.trim().endsWith("Districts"),
	);
	const districtsRow = districtsLabel?.parentElement;
	if (districtsRow?.parentElement === overlaysEl && districtsRow.nextSibling) {
		overlaysEl.insertBefore(row, districtsRow.nextSibling);
	} else {
		overlaysEl.appendChild(row);
	}

	box.addEventListener("change", (e) => {
		setEditorMode(e.target.checked);
	});
}

function districtStyle(district, selected) {
	const base = districtAccent1Color(district);
	return {
		color: base,
		weight: selected ? 3 : 1,
		fillColor: base,
		fillOpacity: selected ? 0.5 : 0.22,
	};
}

function applyDistrictStyles() {
	DISTRICTS.forEach((district) => {
		const polygon = districtPolygons[district.id];
		if (!polygon) return;
		polygon.setStyle(districtStyle(district, activeDistrict === district.id));
	});
}

function collapseLayersControl() {
	if (!layersControl) return;
	const container = layersControl.getContainer?.();
	if (!container) return;
	if (container.classList.contains("leaflet-control-layers-expanded")) {
		const toggle = container.querySelector(".leaflet-control-layers-toggle");
		if (toggle) {
			toggle.click();
			return;
		}
	}
	if (typeof layersControl.collapse === "function") layersControl.collapse();
	else if (typeof layersControl._collapse === "function")
		layersControl._collapse();
}

function clearDistrict() {
	activeDistrict = null;
	applyDistrictStyles();
}

function openLocationById(locId, floorIndex = null, center = true) {
	const entry = markerMap[locId];
	if (!entry) return false;
	const marker = entry.marker;
	if (Number.isInteger(floorIndex)) {
		marker._openFloorIndex = floorIndex;
	} else {
		delete marker._openFloorIndex;
	}
	if (center) map.setView(marker.getLatLng(), 1);
	if (
		Number.isInteger(floorIndex) &&
		typeof marker.isPopupOpen === "function" &&
		marker.isPopupOpen()
	) {
		marker.closePopup();
	}
	marker.openPopup();
	updateUrlParams({
		loc: locId,
		district: null,
		floor: Number.isInteger(floorIndex) ? String(floorIndex) : null,
	});
	return true;
}

function openDistrictById(districtId) {
	const polygon = districtPolygons[districtId];
	const district = DISTRICT_INDEX[districtId];
	if (!polygon || !district) return false;
	activeDistrict = district.id;
	applyDistrictStyles();
	polygon.bringToFront();
	map.fitBounds(polygon.getBounds(), { maxZoom: 1, padding: [30, 30] });
	polygon.openPopup(polygon.getBounds().getCenter());
	updateUrlParams({ district: districtId, loc: null, floor: null });
	return true;
}

function applyDeepLinkFromUrl() {
	const url = new URL(window.location.href);
	const loc = url.searchParams.get("loc");
	const district = url.searchParams.get("district");
	const floorRaw = url.searchParams.get("floor");
	const floor = floorRaw !== null ? Number.parseInt(floorRaw, 10) : null;
	if (
		loc &&
		openLocationById(loc, Number.isInteger(floor) ? floor : null, true)
	)
		return;
	if (district) openDistrictById(district);
}

function renderMapData() {
	districtsLayer.clearLayers();
	Object.keys(districtPolygons).forEach((id) => delete districtPolygons[id]);
	Object.keys(markerMap).forEach((id) => delete markerMap[id]);
	Object.values(categoryGroups).forEach((group) => group.clearLayers());
	activeDistrict = null;

	DISTRICTS.forEach((district) => {
		const latLngs = district.points.map((ring) => ring.map((pt) => px(pt)));
		const polygon = L.polygon(latLngs, {
			...districtStyle(district, false),
			className: "district-overlay",
		})
			.bindPopup(makeDistrictPopup(district), EDGE_POPUP_OPTIONS)
			.bindTooltip(district.label, { sticky: true })
			.addTo(districtsLayer);
		polygon.on("click", (e) => {
			if (editorMode) {
				polygon.closePopup();
				map.closePopup();
				L.DomEvent.stop(e);
				return;
			}
			activeDistrict = district.id;
			applyDistrictStyles();
			polygon.bringToFront();
			polygon.openPopup(e.latlng);
			updateUrlParams({ district: district.id, loc: null, floor: null });
			suppressNextMapClick = true;
			L.DomEvent.stop(e);
		});
		districtPolygons[district.id] = polygon;
	});

	LOCATIONS.forEach((loc) => {
		const district = districtForLocation(loc);
		const marker = L.marker(px(loc.pos), {
			icon: makeIcon(loc.cat, district),
		}).bindPopup(makePopup(loc), EDGE_POPUP_OPTIONS);
		marker.on("click", () =>
			updateUrlParams({ loc: loc.id, district: null, floor: null }),
		);
		categoryGroups[loc.cat].addLayer(marker);
		markerMap[loc.id] = { marker, loc };
	});

	const overlays = {};
	const categoryEntries = Object.entries(CATEGORIES);
	const sortedCategoryEntries = categoryEntries
		.filter(([k]) => k !== "other")
		.sort((a, b) => a[1].label.localeCompare(b[1].label));
	if (CATEGORIES.other) sortedCategoryEntries.push(["other", CATEGORIES.other]);
	sortedCategoryEntries.forEach(([k, v]) => {
		overlays[
			`<img src="${v.icon}" alt="" style="width:12px;height:12px;vertical-align:-2px;margin-right:6px;" />${v.label}`
		] = categoryGroups[k];
	});
	overlays["Districts"] = districtsLayer;
	if (layersControl) map.removeControl(layersControl);
	layersControl = L.control
		.layers(null, overlays, { collapsed: true })
		.addTo(map);
	ensureEditorToggleRow();
}

async function loadWorldData() {
	const [districtsRes, locationsIndexRes] = await Promise.all([
		fetch("./data/districts.json"),
		fetch("./data/locations/index.json"),
	]);
	if (!districtsRes.ok)
		throw new Error(`Failed to load districts data: ${districtsRes.status}`);
	if (!locationsIndexRes.ok)
		throw new Error(
			`Failed to load locations index: ${locationsIndexRes.status}`,
		);
	const locationFiles = await locationsIndexRes.json();
	if (!Array.isArray(locationFiles))
		throw new Error("Locations index must be a JSON array of filenames");
	const locationResponses = await Promise.all(
		locationFiles.map((file) => fetch(`./data/locations/${file}`)),
	);
	locationResponses.forEach((res, i) => {
		if (!res.ok)
			throw new Error(
				`Failed to load locations file "${locationFiles[i]}": ${res.status}`,
			);
	});
	const locationArrays = await Promise.all(
		locationResponses.map((res) => res.json()),
	);
	const mergedLocations = [];
	locationArrays.forEach((payload, i) => {
		if (!Array.isArray(payload))
			throw new Error(
				`Locations file "${locationFiles[i]}" must be a JSON array`,
			);
		mergedLocations.push(...payload);
	});
	const raw = {
		districts: await districtsRes.json(),
		locations: mergedLocations,
	};
	const data = parseWorldData(raw);
	DISTRICTS = data.districts;
	LOCATIONS = data.locations;
	DISTRICT_INDEX = Object.fromEntries(DISTRICTS.map((r) => [r.id, r]));
	renderMapData();
	if (!deepLinkApplied) {
		applyDeepLinkFromUrl();
		deepLinkApplied = true;
	}
}

loadWorldData().catch((err) => {
	console.error(err);
	const details = err && err.message ? `\n\nDetails: ${err.message}` : "";
	alert(
		`Could not load map data from data/districts.json or data/locations/index.json.${details}`,
	);
});

window.addEventListener("popstate", () => {
	applyDeepLinkFromUrl();
});

map.on("overlayadd overlayremove", () => {
	ensureEditorToggleRow();
});

bindSearchHandlers();

map.on("popupopen", (e) => {
	collapseLayersControl();
	const el = e.popup.getElement();
	const btns = el.querySelectorAll(".vtab-btn");
	const panels = el.querySelectorAll(".floor-panel");

	btns.forEach((b) => {
		b.onclick = () => {
			btns.forEach((x) => x.classList.remove("active"));
			b.classList.add("active");

			panels.forEach((p) => {
				p.style.display = p.dataset.i === b.dataset.i ? "block" : "none";
			});
		};
	});

	const source = e.popup._source;
	if (source && Number.isInteger(source._openFloorIndex)) {
		const targetBtn = el.querySelector(
			`.vtab-btn[data-i="${source._openFloorIndex}"]`,
		);
		if (targetBtn) targetBtn.click();
		delete source._openFloorIndex;
	}
});
