const CATEGORIES = {
	shop: { label: "Shop", icon: "images/shopicon.svg" },
	"food-drink": { label: "Food & Drink", icon: "images/foodicon.svg" },
	residences: { label: "Residences", icon: "images/resicon.svg" },
	schools: { label: "Schools", icon: "images/schoolicon.svg" },
	parks: { label: "Parks", icon: "images/parkicon.svg" },
	farms: { label: "Farms", icon: "images/farmicon.svg" },
	government: { label: "Government", icon: "images/govicon.svg" },
	services: { label: "Services", icon: "images/servicesicon.svg" },
	entertainment: {
		label: "Entertainment",
		icon: "images/entertainmenticon.svg",
	},
	other: { label: "Other", icon: "images/othericon.svg" },
};

var REGIONS = [];
var REGION_INDEX = {};
var LOCATIONS = [];
var deepLinkApplied = false;

const DEFAULT_REGION = {
	id: "wilds",
	label: "Outer Wilds",
	accent: "#5a6672",
	soft: "rgba(90,102,114,0.10)",
};

function validNumber(v) {
	return typeof v === "number" && Number.isFinite(v);
}

function isPoint(pt) {
	return (
		Array.isArray(pt) &&
		pt.length === 2 &&
		validNumber(pt[0]) &&
		validNumber(pt[1])
	);
}

function normalizeRing(points) {
	if (!Array.isArray(points)) return [];
	return points.filter(isPoint);
}

function normalizePoints(points) {
	if (!Array.isArray(points)) return [];
	if (points.length === 0) return [];
	if (isPoint(points[0])) {
		const ring = normalizeRing(points);
		return ring.length >= 3 ? [ring] : [];
	}
	const rings = points.map(normalizeRing).filter((ring) => ring.length >= 3);
	return rings.length ? rings : [];
}

function sanitizeRegion(raw) {
	if (!raw || typeof raw !== "object") return null;
	if (typeof raw.id !== "string" || !raw.id.trim()) return null;
	if (typeof raw.label !== "string" || !raw.label.trim()) return null;
	const points = normalizePoints(raw.points);
	if (points.length === 0) return null;
	return {
		id: raw.id.trim(),
		label: raw.label,
		accent1: typeof raw.accent1 === "string" ? raw.accent1 : "",
		accent2: typeof raw.accent2 === "string" ? raw.accent2 : "",
		accent3: typeof raw.accent3 === "string" ? raw.accent3 : "",
		img: typeof raw.img === "string" ? raw.img : "",
		desc: typeof raw.desc === "string" ? raw.desc : "",
		link: typeof raw.link === "string" ? raw.link : "",
		accent: typeof raw.accent === "string" ? raw.accent : "#5a6672",
		soft: typeof raw.soft === "string" ? raw.soft : "rgba(90,102,114,0.10)",
		overlay:
			typeof raw.overlay === "string" ? raw.overlay : "rgba(90,102,114,0.14)",
		stroke: typeof raw.stroke === "string" ? raw.stroke : "#5a6672",
		points,
	};
}

function sanitizeOwner(raw) {
	if (!raw || typeof raw !== "object") return null;
	if (typeof raw.name !== "string" || !raw.name.trim()) return null;
	return {
		name: raw.name.trim(),
		url: typeof raw.url === "string" ? raw.url : "",
	};
}

function sanitizeFloor(raw) {
	if (!raw || typeof raw !== "object") return null;
	if (typeof raw.name !== "string" || !raw.name.trim()) return null;
	return {
		name: raw.name.trim(),
		img: typeof raw.img === "string" ? raw.img : "",
		desc: typeof raw.desc === "string" ? raw.desc : "",
		link: typeof raw.link === "string" ? raw.link : "",
		owner: sanitizeOwner(raw.owner),
		aliases: Array.isArray(raw.aliases)
			? raw.aliases.filter((a) => typeof a === "string")
			: [],
		vacant: raw.vacant === true,
	};
}

function sanitizeLocation(raw) {
	if (!raw || typeof raw !== "object") return null;
	if (typeof raw.id !== "string" || !raw.id.trim()) return null;
	if (typeof raw.name !== "string" || !raw.name.trim()) return null;
	if (typeof raw.cat !== "string" || !CATEGORIES[raw.cat]) return null;
	if (
		!Array.isArray(raw.pos) ||
		raw.pos.length !== 2 ||
		!validNumber(raw.pos[0]) ||
		!validNumber(raw.pos[1])
	)
		return null;
	const floors = Array.isArray(raw.floors)
		? raw.floors.map(sanitizeFloor).filter(Boolean)
		: null;
	return {
		id: raw.id.trim(),
		region: typeof raw.region === "string" ? raw.region : "",
		cat: raw.cat,
		pos: [raw.pos[0], raw.pos[1]],
		name: raw.name.trim(),
		img: typeof raw.img === "string" ? raw.img : "",
		desc: typeof raw.desc === "string" ? raw.desc : "",
		link: typeof raw.link === "string" ? raw.link : "",
		owner: sanitizeOwner(raw.owner),
		aliases: Array.isArray(raw.aliases)
			? raw.aliases.filter((a) => typeof a === "string")
			: [],
		floors,
	};
}

function parseWorldData(data) {
	const rawRegions = Array.isArray(data && data.regions) ? data.regions : [];
	const rawLocations = Array.isArray(data && data.locations)
		? data.locations
		: [];
	const regions = [];
	const regionIds = new Set();
	rawRegions.forEach((r, i) => {
		const region = sanitizeRegion(r);
		if (!region) {
			console.warn(`Skipping invalid region at index ${i}`);
			return;
		}
		if (regionIds.has(region.id)) {
			console.warn(`Duplicate region id "${region.id}" skipped`);
			return;
		}
		regionIds.add(region.id);
		regions.push(region);
	});

	const locations = [];
	const locIds = new Set();
	rawLocations.forEach((l, i) => {
		const loc = sanitizeLocation(l);
		if (!loc) {
			console.warn(`Skipping invalid location at index ${i}`);
			return;
		}
		if (locIds.has(loc.id)) {
			console.warn(`Duplicate location id "${loc.id}" skipped`);
			return;
		}
		locIds.add(loc.id);
		locations.push(loc);
	});

	return { regions, locations };
}

function pointInPolygon([y, x], polygon) {
	let inside = false;
	for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
		const [yi, xi] = polygon[i];
		const [yj, xj] = polygon[j];
		const edgeCross =
			yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
		if (edgeCross) inside = !inside;
	}
	return inside;
}

function pointInRegion([y, x], region) {
	const [outer, ...holes] = region.points;
	if (!pointInPolygon([y, x], outer)) return false;
	for (const hole of holes) {
		if (pointInPolygon([y, x], hole)) return false;
	}
	return true;
}

function regionForPos([y, x]) {
	for (const region of REGIONS) {
		if (pointInRegion([y, x], region)) return region;
	}
	return DEFAULT_REGION;
}

function regionForLocation(loc) {
	if (loc.region && REGION_INDEX[loc.region]) return REGION_INDEX[loc.region];
	return regionForPos(loc.pos);
}

function makeIcon(cat, region) {
	const cfg = CATEGORIES[cat];
	const accent = (region && region.accent) || DEFAULT_REGION.accent;
	const halo = (region && region.soft) || DEFAULT_REGION.soft;
	return L.divIcon({
		className: "map-pin-icon",
		html: `<div style="width:24px;height:28px;display:flex;justify-content:center;">
    <div style="width:22px;height:22px;border-radius:50% 50% 50% 0;
    transform:rotate(-45deg);background:#1f2430;
    display:flex;align-items:center;justify-content:center;
    border:2px solid ${accent}; box-shadow:0 0 0 2px ${halo};">
    <img src="${cfg.icon}" alt="${cfg.label}" style="width:12px;height:12px;transform:rotate(45deg);" />
    </div></div>`,
		iconSize: [24, 28],
		iconAnchor: [12, 27],
	});
}
