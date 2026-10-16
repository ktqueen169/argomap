let filterTooltipId = 0;

document.addEventListener("DOMContentLoaded", () => {
	const tooltip = document.createElement("div");
	tooltip.className = "filter-tooltip";
	tooltip.id = `filter-tooltip-${++filterTooltipId}`;
	tooltip.setAttribute("role", "tooltip");
	tooltip.textContent = "Coordinate click";
	tooltip.hidden = true;
	document.body.appendChild(tooltip);
	const hide = () => { tooltip.hidden = true; };
	["editor-mode-toggle", "submap-coordinate-toggle"].forEach((id) => {
		const button = document.getElementById(id);
		if (!button) return;
		button.removeAttribute("title");
		button.setAttribute("aria-describedby", `${button.getAttribute("aria-describedby") || ""} ${tooltip.id}`.trim());
		const show = () => {
			const rect = button.getBoundingClientRect();
			tooltip.hidden = false;
			tooltip.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - tooltip.offsetWidth - 8))}px`;
			tooltip.style.top = `${Math.max(8, Math.min(rect.bottom + 6, window.innerHeight - tooltip.offsetHeight - 8))}px`;
		};
		button.addEventListener("mouseenter", show);
		button.addEventListener("focus", show);
		button.addEventListener("mouseleave", hide);
		button.addEventListener("blur", hide);
		button.addEventListener("click", hide);
	});
	document.addEventListener("keydown", (event) => {
		if (event.key === "Escape") hide();
	});
	window.addEventListener("resize", hide);
});

window.createMapFilters = function createMapFilters(targetMap, categories, groups, options = {}) {
	const control = L.control({ position: "topright" });
	const buttons = {};
	let dismissOutside = () => {};
	const tooltip = document.createElement("div");
	tooltip.className = "filter-tooltip";
	tooltip.id = `filter-tooltip-${++filterTooltipId}`;
	tooltip.setAttribute("role", "tooltip");
	tooltip.hidden = true;
	const hideTooltip = () => { tooltip.hidden = true; };
	const showTooltip = (button, label) => {
		tooltip.textContent = label;
		tooltip.hidden = false;
		const rect = button.getBoundingClientRect();
		const width = tooltip.offsetWidth;
		const height = tooltip.offsetHeight;
		tooltip.style.left = `${Math.max(8, Math.min(rect.left - width - 8, window.innerWidth - width - 8))}px`;
		tooltip.style.top = `${Math.max(8, Math.min(rect.top + (rect.height - height) / 2, window.innerHeight - height - 8))}px`;
	};
	control.onAdd = () => {
		document.body.appendChild(tooltip);
		targetMap.on("movestart", hideTooltip);
		window.addEventListener("resize", hideTooltip);
		const container = L.DomUtil.create("div", "map-filters");
		container.setAttribute("aria-label", options.label || "Map filters");
		L.DomEvent.disableClickPropagation(container);
		L.DomEvent.disableScrollPropagation(container);
		const toggle = document.createElement("button");
		toggle.type = "button";
		toggle.className = "filter-panel-toggle";
		toggle.setAttribute("aria-label", options.label || "Map filters");
		toggle.innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m3 7 9-5 9 5-9 5-9-5Zm0 5 9 5 9-5M3 17l9 5 9-5"/></svg>';
		const contents = document.createElement("div");
		contents.className = "filter-panel-contents";
		contents.id = `${tooltip.id}-contents`;
		toggle.setAttribute("aria-controls", contents.id);
		const setExpanded = (expanded) => {
			container.classList.toggle("filters-expanded", expanded);
			toggle.setAttribute("aria-expanded", String(expanded));
			contents.hidden = !expanded;
			if (!expanded) {
				hideTooltip();
				contents.querySelectorAll("details").forEach((details) => { details.open = false; });
			}
		};
		setExpanded(false);
		dismissOutside = (event) => {
			if (!container.contains(event.target)) setExpanded(false);
		};
		document.addEventListener("pointerdown", dismissOutside);
		toggle.addEventListener("click", () => setExpanded(contents.hidden));
		container.addEventListener("mouseenter", () => {
			if (window.matchMedia("(hover: hover)").matches) setExpanded(true);
		});
		container.addEventListener("mouseleave", () => {
			if (window.matchMedia("(hover: hover)").matches) setExpanded(false);
		});
		container.addEventListener("focusout", (event) => {
			if (!container.contains(event.relatedTarget)) setExpanded(false);
		});
		container.addEventListener("keydown", (event) => {
			if (event.key === "Escape") {
				event.stopPropagation();
				setExpanded(false);
				toggle.focus();
			}
		});
		container.append(toggle, contents);
		const grid = document.createElement("div");
		grid.className = "filter-icons";
		Object.entries(categories)
			.sort(([a, x], [b, y]) => a === "other" ? 1 : b === "other" ? -1 : x.label.localeCompare(y.label))
			.forEach(([id, category]) => {
				if (!groups[id]) return;
				const button = document.createElement("button");
				button.type = "button";
				button.className = "filter-icon";
				button.setAttribute("aria-label", category.label);
				button.setAttribute("aria-describedby", tooltip.id);
				button.addEventListener("mouseenter", () => showTooltip(button, category.label));
				button.addEventListener("mouseleave", hideTooltip);
				button.addEventListener("focus", () => showTooltip(button, category.label));
				button.addEventListener("blur", hideTooltip);
				button.addEventListener("keydown", (event) => {
					if (event.key === "Escape") hideTooltip();
				});
				const image = document.createElement("img");
				image.src = category.icon || "images/othericon.svg";
				image.alt = "";
				button.appendChild(image);
				button.addEventListener("click", () => {
					if (targetMap.hasLayer(groups[id])) targetMap.removeLayer(groups[id]);
					else groups[id].addTo(targetMap);
				});
				buttons[id] = button;
				grid.appendChild(button);
			});
		contents.appendChild(grid);
		options.addUtilities?.(contents);
		return container;
	};
	const sync = () => {
		Object.entries(buttons).forEach(([id, button]) => {
			button.setAttribute("aria-pressed", String(targetMap.hasLayer(groups[id])));
		});
		options.sync?.();
	};
	control.onRemove = () => {
		targetMap.off("layeradd layerremove", sync);
		targetMap.off("movestart", hideTooltip);
		window.removeEventListener("resize", hideTooltip);
		document.removeEventListener("pointerdown", dismissOutside);
		tooltip.remove();
	};
	control.addTo(targetMap);
	targetMap.on("layeradd layerremove", sync);
	sync();
	return control;
};
