let submap = null;
let submapImageLayer = null;
let submapMarkerLayer = null;
let activeSubmapId = null;
let activeSubmapData = null;
const submapMarkerMap = {};

async function loadSubmapData(submapId) {
	const response = await fetch(`data/submaps/${submapId}.json`);
	if (!response.ok) {
		throw new Error(`Unable to load submap: ${submapId}`);
	}
	return response.json();
}

function submapPoint([y, x]) {
	return [y, x];
}

function makeSubmapIcon(location, data) {
	const category = data.categories?.[location.cat];
	const iconUrl = category?.icon || "images/othericon.svg";
	const accent = data.accent?.accent2
		? `rgb(${data.accent.accent2})`
		: "#6f47d8";
	const halo = data.accent?.accent3
		? `rgba(${data.accent.accent3}, 0.55)`
		: "rgba(190, 184, 217, 0.55)";

	return L.divIcon({
		className: "map-pin-icon",
		html: `<div style="width:30px;height:35px;display:flex;justify-content:center;">
			<div style="width:28px;height:28px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#1f2430;display:flex;align-items:center;justify-content:center;border:2px solid ${accent};box-shadow:0 0 0 2px ${halo},0 3px 8px rgba(0,0,0,.55);">
				<img src="${iconUrl}" alt="${category?.label || ""}" style="width:16px;height:16px;transform:rotate(45deg);" />
			</div>
		</div>`,
		iconSize: [30, 35],
		iconAnchor: [15, 34],
		popupAnchor: [0, -30],
	});
}

function makeSubmapPopup(location, data) {
	const category = data.categories?.[location.cat];
	const accent = data.accent || {};
	const style = [
		accent.accent1 ? `--accent1: ${accent.accent1}` : "",
		accent.accent2 ? `--accent2: ${accent.accent2}` : "",
		accent.accent3 ? `--accent3: ${accent.accent3}` : "",
	]
		.filter(Boolean)
		.join(";");

	return `<div class="popup-body" style="${style}">
		<div class="popup-title">${escapeHtml(location.name)}</div>
		<div class="popup-cat">${escapeHtml(category?.label || location.cat || "Location")}</div>
		${location.desc ? `<div class="popup-desc">${escapeHtml(location.desc)}</div>` : ""}
	</div>`;
}

function renderSubmapMarkers(data) {
	if (!submapMarkerLayer) {
		submapMarkerLayer = L.layerGroup().addTo(submap);
	}
	submapMarkerLayer.clearLayers();
	Object.keys(submapMarkerMap).forEach((key) => delete submapMarkerMap[key]);

	(data.locations || []).forEach((location) => {
		if (!Array.isArray(location.pos)) return;
		const marker = L.marker(submapPoint(location.pos), {
			icon: makeSubmapIcon(location, data),
		})
			.bindPopup(makeSubmapPopup(location, data), {
				autoPan: true,
				keepInView: false,
				autoPanPadding: L.point(80, 80),
			})
			.addTo(submapMarkerLayer);
		if (location.id) submapMarkerMap[location.id] = marker;
	});
}

function openSubmapLocationById(locId) {
	const marker = submapMarkerMap[locId];
	if (!marker || !submap) return false;
	submap.setView(marker.getLatLng(), Math.max(submap.getZoom(), 1), {
		animate: !prefersReducedMotion(),
		duration: 0.6,
	});
	marker.openPopup();
	return true;
}

function closeSubmap() {
	const modal = document.getElementById("submap-modal");
	if (!modal) return;

	modal.hidden = true;
	document.body.classList.remove("submap-open");
	activeSubmapId = null;
	activeSubmapData = null;
	hideSearchResults();
}

async function openSubmap(submapId) {
	const modal = document.getElementById("submap-modal");
	const title = document.getElementById("submap-title");
	const mapEl = document.getElementById("submap");
	if (!modal || !title || !mapEl) return;

	let data;
	try {
		data = await loadSubmapData(submapId);
	} catch (error) {
		console.error(error);
		return;
	}

	activeSubmapId = data.id;
	activeSubmapData = data;
	hideSearchResults();
	title.textContent = data.title;
	modal.hidden = false;
	document.body.classList.add("submap-open");

	window.setTimeout(() => {
		const bounds = [
			[0, 0],
			[data.height, data.width],
		];

		if (!submap) {
			submap = L.map("submap", {
				crs: L.CRS.Simple,
				zoomControl: true,
				minZoom: -2,
				maxZoom: 5,
				zoomSnap: 0.1,
				zoomDelta: 0.5,
			});
		}

		if (submapImageLayer) {
			submap.removeLayer(submapImageLayer);
		}

		submapImageLayer = L.imageOverlay(data.image, bounds).addTo(submap);
		renderSubmapMarkers(data);
		submap.invalidateSize();
		submap.fitBounds(bounds, {
			animate: false,
		});
	}, 0);
}

function openTestSubmap() {
	if (window.openHiddenLocationById?.("lithos")) return;
	openSubmap("lithos");
}

window.openSubmap = openSubmap;
window.openSubmapLocationById = openSubmapLocationById;
window.getActiveSubmapData = () => activeSubmapData;
window.openTestSubmap = openTestSubmap;
window.closeSubmap = closeSubmap;

document.addEventListener("DOMContentLoaded", () => {
	const closeButton = document.getElementById("submap-close");
	if (closeButton) closeButton.addEventListener("click", closeSubmap);

	document.addEventListener("keydown", (event) => {
		if (event.key === "Escape") closeSubmap();
		if (event.key.toLowerCase() === "s" && event.shiftKey) openTestSubmap();
	});
});
