const HOLIDAY_EFFECTS_STORAGE_KEY = "argomap-holiday-effects";

const HOLIDAY_CONFIG = {
	startMonth: 12,
	startDay: 1,
	endMonth: 1,
	endDay: 10,
	timeZone: "America/Los_Angeles",
	threadUrl: "",
	markerPosition: [-110, 120],
};

function holidayDateParts(date = new Date()) {
	const parts = new Intl.DateTimeFormat("en-US", {
		timeZone: HOLIDAY_CONFIG.timeZone,
		month: "numeric",
		day: "numeric",
	}).formatToParts(date);
	const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
	return { month: Number(values.month), day: Number(values.day) };
}

function holidayScheduleIsActive(date = new Date()) {
	const { month, day } = holidayDateParts(date);
	return (
		(month === HOLIDAY_CONFIG.startMonth && day >= HOLIDAY_CONFIG.startDay) ||
		month > HOLIDAY_CONFIG.startMonth ||
		month < HOLIDAY_CONFIG.endMonth ||
		(month === HOLIDAY_CONFIG.endMonth && day <= HOLIDAY_CONFIG.endDay)
	);
}

function holidayIsActive() {
	const override = new URLSearchParams(window.location.search).get("holiday");
	if (override === "1") return true;
	if (override === "0") return false;
	return holidayScheduleIsActive();
}

function addHolidaySnow() {
	if (document.querySelector(".holiday-snow")) return;
	const snow = document.createElement("div");
	snow.className = "holiday-snow";
	snow.setAttribute("aria-hidden", "true");

	for (let i = 0; i < 36; i += 1) {
		const flake = document.createElement("span");
		flake.className = "holiday-snowflake";
		flake.style.setProperty("--snow-left", `${(i * 37 + 11) % 100}%`);
		flake.style.setProperty("--snow-size", `${3 + (i % 5)}px`);
		flake.style.setProperty("--snow-opacity", `${0.38 + (i % 4) * 0.14}`);
		flake.style.setProperty("--snow-duration", `${9 + (i % 8)}s`);
		flake.style.setProperty("--snow-delay", `${-(i % 13)}s`);
		flake.style.setProperty("--snow-drift", `${-45 + (i % 7) * 15}px`);
		flake.style.setProperty("--snow-static-top", `${(i * 29) % 96}%`);
		snow.appendChild(flake);
	}

	document.body.appendChild(snow);
}

function holidayEffectsEnabled() {
	try {
		return localStorage.getItem(HOLIDAY_EFFECTS_STORAGE_KEY) !== "off";
	} catch {
		return true;
	}
}

function setHolidayEffects(enabled) {
	document.body.classList.toggle("holiday-effects", enabled);
	if (enabled) addHolidaySnow();
	else document.querySelector(".holiday-snow")?.remove();
	try {
		localStorage.setItem(HOLIDAY_EFFECTS_STORAGE_KEY, enabled ? "on" : "off");
	} catch {}
	document.querySelectorAll(".holiday-effects-toggle").forEach((button) => {
		button.setAttribute("aria-pressed", String(enabled));
		button.setAttribute("aria-label", `Holiday effects ${enabled ? "on" : "off"}`);
		button.title = `Holiday effects ${enabled ? "on" : "off"}`;
	});
}

function initializeHolidayEffectsToggle() {
	const button = document.getElementById("holiday-effects-toggle");
	if (!button) return;
	button.hidden = false;
	button.addEventListener("click", () => {
		setHolidayEffects(button.getAttribute("aria-pressed") !== "true");
	});
}

function holidayPopupContent() {
	const link = HOLIDAY_CONFIG.threadUrl
		? `<a class="holiday-popup-link" href="${HOLIDAY_CONFIG.threadUrl}" target="_blank" rel="noopener noreferrer">Visit the holiday thread</a>`
		: '<span class="holiday-popup-link">Holiday thread coming soon</span>';

	return `<div class="holiday-popup">
		<div class="holiday-popup-title">Happy Holidays, Argo!</div>
		<div class="holiday-popup-message">Cheers to another year writing together</div>
		${link}
	</div>`;
}

function addHolidayMarker() {
	const icon = L.divIcon({
		className: "holiday-marker",
		html: '<span class="holiday-marker-sparkle" role="img" aria-label="A mysterious holiday sparkle">✦</span>',
		iconSize: [26, 26],
		iconAnchor: [13, 13],
		popupAnchor: [0, -10],
	});

	L.marker(px(HOLIDAY_CONFIG.markerPosition), {
		icon,
		title: "A mysterious holiday sparkle",
		keyboard: true,
		zIndexOffset: 350,
	})
		.addTo(map)
		.bindPopup(holidayPopupContent(), EDGE_POPUP_OPTIONS);
}

function initializeHolidayLayer() {
	if (!holidayIsActive()) return;
	setHolidayEffects(holidayEffectsEnabled());
	initializeHolidayEffectsToggle();
	addHolidayMarker();
}

initializeHolidayLayer();
