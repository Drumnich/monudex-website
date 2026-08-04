(() => {
  const els = {
    search: document.querySelector("[data-search]"),
    filters: document.querySelector("[data-filters]"),
    grid: document.querySelector("[data-grid]"),
    resultsCopy: document.querySelector("[data-results-copy]"),
    clear: document.querySelector("[data-clear]"),
    empty: document.querySelector("[data-empty]"),
    loadMore: document.querySelector("[data-load-more]"),
    dialog: document.querySelector("[data-monument-dialog]"),
    dialogClose: document.querySelector("[data-dialog-close]"),
  };
  if (!els.grid || !window.MonuDexData) return;

  const { categoryKey, categoryLabel, searchableText, loadMonuments, fetchHistory } = window.MonuDexData;
  const refreshIcons = () => window.MonuDexSite?.refreshIcons();
  const filters = [
    ["all", "All"],
    ["architecture", "Architecture"],
    ["archaeology", "Archaeological"],
    ["religious", "Religious"],
    ["natural", "Natural"],
    ["civic", "Civic & cultural"],
    ["landmark", "Landmarks"],
  ];
  const state = { monuments: [], query: "", filter: "all", visibleCount: 24, historyRequest: 0 };

  function filteredMonuments() {
    const query = state.query.trim().toLocaleLowerCase();
    return state.monuments
      .filter((monument) => (state.filter === "all" || categoryKey(monument.category) === state.filter) && (!query || searchableText(monument).includes(query)))
      .sort((a, b) => a.country.localeCompare(b.country) || a.name.localeCompare(b.name));
  }

  function formatIndex(monument) {
    const index = state.monuments.findIndex((item) => item.id === monument.id) + 1;
    return `#${String(index).padStart(3, "0")}`;
  }

  function coordinate(value, positive, negative) {
    return `${Math.abs(value).toFixed(4)}° ${value >= 0 ? positive : negative}`;
  }

  async function fillHistory(monument, requestId) {
    const history = await fetchHistory(monument);
    if (requestId !== state.historyRequest || !els.dialog.open) return;
    els.dialog.querySelector("[data-dialog-history]").textContent = history.text;
    const link = els.dialog.querySelector("[data-dialog-wikipedia]");
    link.href = history.url;
    link.hidden = false;
  }

  function openMonument(monument) {
    const image = els.dialog.querySelector("[data-dialog-image]");
    image.src = monument.photo;
    image.alt = `${monument.name} in ${monument.country}`;
    image.onerror = () => { image.hidden = true; };
    image.hidden = false;
    els.dialog.querySelector("[data-dialog-category]").textContent = categoryLabel(monument.category);
    els.dialog.querySelector("[data-dialog-name]").textContent = monument.name;
    els.dialog.querySelector("[data-dialog-country]").textContent = monument.country;
    els.dialog.querySelector("[data-dialog-coordinates]").textContent = `${coordinate(monument.lat, "N", "S")} · ${coordinate(monument.lng, "E", "W")}`;
    els.dialog.querySelector("[data-dialog-maps]").href = `https://www.google.com/maps/search/?api=1&query=${monument.lat},${monument.lng}`;
    els.dialog.querySelector("[data-dialog-source]").href = monument.photo;
    els.dialog.querySelector("[data-dialog-history]").textContent = "Loading history...";
    els.dialog.querySelector("[data-dialog-wikipedia]").hidden = true;
    els.dialog.showModal();
    refreshIcons();
    fillHistory(monument, ++state.historyRequest);
  }

  function createCard(monument, index) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "monument-card";
    card.setAttribute("aria-label", `View ${monument.name} in ${monument.country}`);
    const imageWrap = document.createElement("span");
    imageWrap.className = "monument-card-image";
    const image = document.createElement("img");
    image.src = monument.photo;
    image.alt = monument.name;
    image.loading = index < 8 ? "eager" : "lazy";
    image.decoding = "async";
    image.addEventListener("error", () => {
      image.hidden = true;
      imageWrap.classList.add("image-failed");
      imageWrap.dataset.fallback = monument.country;
    }, { once: true });
    const number = document.createElement("span");
    number.className = "monument-card-index";
    number.textContent = formatIndex(monument);
    const copy = document.createElement("span");
    copy.className = "monument-card-copy";
    const text = document.createElement("span");
    const name = document.createElement("strong");
    name.textContent = monument.name;
    const place = document.createElement("span");
    place.textContent = `${monument.country} · ${categoryLabel(monument.category)}`;
    text.append(name, place);
    const arrow = document.createElement("i");
    arrow.dataset.lucide = "arrow-up-right";
    arrow.setAttribute("aria-hidden", "true");
    imageWrap.append(image, number);
    copy.append(text, arrow);
    card.append(imageWrap, copy);
    card.addEventListener("click", () => openMonument(monument));
    return card;
  }

  function renderFilters() {
    const counts = state.monuments.reduce((result, monument) => {
      const key = categoryKey(monument.category);
      result[key] = (result[key] || 0) + 1;
      return result;
    }, {});
    els.filters.replaceChildren(...filters.map(([key, label]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "filter-chip";
      button.setAttribute("aria-pressed", String(state.filter === key));
      button.textContent = `${label} ${key === "all" ? state.monuments.length : (counts[key] || 0)}`;
      button.addEventListener("click", () => {
        state.filter = key;
        state.visibleCount = 24;
        renderFilters();
        renderMonuments();
      });
      return button;
    }));
  }

  function renderMonuments() {
    const monuments = filteredMonuments();
    const visible = monuments.slice(0, state.visibleCount);
    els.grid.replaceChildren(...visible.map(createCard));
    els.grid.hidden = monuments.length === 0;
    els.empty.hidden = monuments.length !== 0;
    els.loadMore.hidden = visible.length >= monuments.length || monuments.length === 0;
    els.clear.hidden = !state.query && state.filter === "all";
    if (!monuments.length) els.resultsCopy.textContent = "No matches in the 585-place collection";
    else if (visible.length < monuments.length) els.resultsCopy.textContent = `Showing ${visible.length} of ${monuments.length} monuments`;
    else els.resultsCopy.textContent = `${monuments.length} ${monuments.length === 1 ? "monument" : "monuments"}`;
    refreshIcons();
  }

  function bindEvents() {
    els.search.addEventListener("input", (event) => {
      state.query = event.target.value;
      state.visibleCount = 24;
      renderMonuments();
    });
    els.clear.addEventListener("click", () => {
      state.query = "";
      state.filter = "all";
      state.visibleCount = 24;
      els.search.value = "";
      renderFilters();
      renderMonuments();
      els.search.focus();
    });
    els.loadMore.addEventListener("click", () => {
      state.visibleCount += 24;
      renderMonuments();
    });
    els.dialogClose.addEventListener("click", () => els.dialog.close());
    els.dialog.addEventListener("click", (event) => { if (event.target === els.dialog) els.dialog.close(); });
    document.addEventListener("keydown", (event) => {
      const tag = document.activeElement?.tagName;
      if (event.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA" && !els.dialog.open) {
        event.preventDefault();
        els.search.focus();
      }
    });
  }

  async function init() {
    bindEvents();
    try {
      state.monuments = await loadMonuments();
      const country = new URLSearchParams(window.location.search).get("country");
      if (country) {
        state.query = country;
        els.search.value = country;
      }
      renderFilters();
      renderMonuments();
    } catch (error) {
      console.error("Unable to load monument catalogue", error);
      els.resultsCopy.textContent = "The monument collection could not be loaded.";
      els.grid.hidden = true;
      els.empty.hidden = false;
      els.empty.querySelector("h3").textContent = "Collection unavailable";
      els.empty.querySelector("p").textContent = "Please refresh the page and try again.";
    }
  }

  init();
})();
