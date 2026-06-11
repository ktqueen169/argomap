const searchInput = document.getElementById("search");
const searchResultsEl = document.getElementById("search-results");
let searchResults = [];
let searchActiveIndex = -1;

function buildSearchIndex(query) {
	const q = query.trim().toLowerCase();
	if (!q) return [];
	const out = [];
	LOCATIONS.forEach((loc) => {
		const district = districtForLocation(loc);
		const locText = [loc.name, loc.desc || "", (loc.aliases || []).join(" ")]
			.join(" ")
			.toLowerCase();
		if (locText.includes(q)) {
			out.push({
				type: "location",
				loc,
				floorIndex: null,
				label: loc.name,
				meta: `${district.label} · ${CATEGORIES[loc.cat].label}`,
			});
		}
		if (Array.isArray(loc.floors)) {
			loc.floors.forEach((f, i) => {
				const floorText = [f.name, f.desc || "", (f.aliases || []).join(" ")]
					.join(" ")
					.toLowerCase();
				if (floorText.includes(q)) {
					out.push({
						type: "floor",
						loc,
						floorIndex: i,
						label: f.name,
						meta: `${loc.name} · ${district.label}`,
					});
				}
			});
		}
	});
	return out.slice(0, 12);
}

function setSearchActiveIndex(next) {
	searchActiveIndex = next;
	const items = searchResultsEl.querySelectorAll(".search-item");
	items.forEach((el, i) =>
		el.classList.toggle("active", i === searchActiveIndex),
	);
}

function hideSearchResults() {
	searchResultsEl.style.display = "none";
	searchResultsEl.textContent = "";
	searchResults = [];
	searchActiveIndex = -1;
}

function renderSearchResults(results) {
	searchResults = results;
	if (!results.length) {
		hideSearchResults();
		return;
	}
	searchResultsEl.textContent = "";
	results.forEach((r, i) => {
		const row = document.createElement("div");
		row.className = `search-item ${i === 0 ? "active" : ""}`;
		row.dataset.i = String(i);

		const name = document.createElement("div");
		name.className = "search-name";
		name.textContent = r.label;

		const meta = document.createElement("div");
		meta.className = "search-meta";
		meta.textContent = r.meta;

		row.appendChild(name);
		row.appendChild(meta);
		row.onclick = () => {
			const idx = Number.parseInt(row.dataset.i, 10);
			const hit = searchResults[idx];
			if (!hit) return;
			openLocationById(hit.loc.id, hit.floorIndex, true);
			hideSearchResults();
		};

		searchResultsEl.appendChild(row);
	});
	searchResultsEl.style.display = "block";
	searchActiveIndex = 0;
}

function findSearchMatch(query) {
	const hits = buildSearchIndex(query);
	return hits.length ? hits[0] : null;
}

function bindSearchHandlers() {
	searchInput.addEventListener("input", (e) => {
		const results = buildSearchIndex(e.target.value);
		renderSearchResults(results);
	});

	searchInput.addEventListener("keydown", (e) => {
		if (e.key === "ArrowDown" && searchResults.length) {
			e.preventDefault();
			setSearchActiveIndex(
				Math.min(searchActiveIndex + 1, searchResults.length - 1),
			);
			return;
		}
		if (e.key === "ArrowUp" && searchResults.length) {
			e.preventDefault();
			setSearchActiveIndex(Math.max(searchActiveIndex - 1, 0));
			return;
		}
		if (e.key === "Enter") {
			e.preventDefault();
			if (searchResults.length && searchActiveIndex >= 0) {
				const hit = searchResults[searchActiveIndex];
				openLocationById(hit.loc.id, hit.floorIndex, true);
				hideSearchResults();
				return;
			}
			const match = findSearchMatch(e.target.value);
			if (match) {
				openLocationById(match.loc.id, match.floorIndex, true);
				hideSearchResults();
			}
		}
	});

	searchInput.addEventListener("blur", () => {
		setTimeout(hideSearchResults, 120);
	});
}
