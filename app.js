(() => {
  const state = {
    monuments: [],
    query: "",
    filter: "all",
    visibleCount: 16,
    globe: null,
    globePinned: false,
    globeMatches: [],
    hoverTimer: null,
    hideTimer: null,
    historyRequest: 0,
  };

  const historyCache = new Map();

  const els = {
    header: document.querySelector("[data-header]"),
    menuButton: document.querySelector("[data-menu-button]"),
    nav: document.querySelector("[data-nav]"),
    globe: document.querySelector("[data-globe]"),
    globeStage: document.querySelector("[data-globe-stage]"),
    globeLoading: document.querySelector("[data-globe-loading]"),
    globeSearch: document.querySelector("[data-globe-search]"),
    globeResults: document.querySelector("[data-globe-results]"),
    placePopover: document.querySelector("[data-place-popover]"),
    search: document.querySelector("[data-search]"),
    filters: document.querySelector("[data-filters]"),
    grid: document.querySelector("[data-grid]"),
    resultsCopy: document.querySelector("[data-results-copy]"),
    clear: document.querySelector("[data-clear]"),
    empty: document.querySelector("[data-empty]"),
    loadMore: document.querySelector("[data-load-more]"),
    countries: document.querySelector("[data-countries]"),
    monumentDialog: document.querySelector("[data-monument-dialog]"),
    legalDialog: document.querySelector("[data-legal-dialog]"),
    legalBody: document.querySelector("[data-legal-body]"),
  };

  const filterDefinitions = [
    ["all", "All"],
    ["architecture", "Architecture"],
    ["archaeology", "Archaeological"],
    ["religious", "Religious"],
    ["natural", "Natural"],
    ["civic", "Civic & cultural"],
    ["landmark", "Landmarks"],
  ];

  const countryPicks = [
    "France", "Italy", "India", "Japan", "Egypt", "Mexico",
    "Peru", "Jordan", "Cambodia", "Brazil", "United States", "Australia",
  ];

  const legalContent = {
    privacy: {
      title: "Privacy Policy",
      sections: [
        ["What MonuDex uses", "MonuDex needs camera access to capture an unlock photo and precise location to confirm that the attempt happened near the selected monument. Access is requested only when the relevant feature is used."],
        ["Unlock verification", "A verification attempt may include the submitted image, monument identifier, coordinates, distance, confidence result, and timestamp. These signals are used to decide whether a monument can be added to the collection and to prevent fraudulent unlocks."],
        ["Your control", "You can deny camera or location access, although monument unlocking will not work without both. Uploaded selfies can be removed from the app settings. Public collection visibility remains optional."],
        ["Data protection", "We limit retained data to what the product needs and do not sell precise location or selfie data. Production verification services should receive only the minimum data required for an unlock attempt."],
        ["Contact", "Questions about privacy can be sent to privacy@monudex.app."],
      ],
    },
    terms: {
      title: "Terms of Service",
      sections: [
        ["Using MonuDex", "MonuDex is a travel collection product. Use it lawfully, respect local rules and restricted areas, and never take a photo from an unsafe position."],
        ["Unlocks", "Monument unlocks depend on location and image verification. Incorrect matches can happen, and suspicious or manipulated attempts may be rejected or removed."],
        ["Your content", "You keep ownership of photos you submit. You grant MonuDex the limited permission needed to process, store, and display them for the features you choose."],
        ["Availability", "The product is currently in development and beta functionality can change. Service availability and catalogue entries are not guaranteed."],
        ["Contact", "Questions about these terms can be sent to legal@monudex.app."],
      ],
    },
  };

  function refreshIcons() {
    if (window.lucide) window.lucide.createIcons({ attrs: { "stroke-width": 2 } });
  }

  function categoryKey(category = "") {
    const value = category.toLowerCase();
    if (value.includes("religious")) return "religious";
    if (value.includes("natural")) return "natural";
    if (value.includes("archaeological")) return "archaeology";
    if (value.includes("architectural")) return "architecture";
    if (value.includes("civic") || value.includes("cultural")) return "civic";
    return "landmark";
  }

  function categoryLabel(category = "") {
    return category === "Visit-worthy landmark" ? "Landmark" : (category || "Landmark");
  }

  function searchableText(monument) {
    return `${monument.name} ${monument.country} ${monument.category}`.toLocaleLowerCase();
  }

  function filteredMonuments() {
    const query = state.query.trim().toLocaleLowerCase();
    return state.monuments
      .filter((monument) => {
        const categoryMatch = state.filter === "all" || categoryKey(monument.category) === state.filter;
        const queryMatch = !query || searchableText(monument).includes(query);
        return categoryMatch && queryMatch;
      })
      .sort((a, b) => a.country.localeCompare(b.country) || a.name.localeCompare(b.name));
  }

  function formatIndex(monument) {
    const index = state.monuments.findIndex((item) => item.id === monument.id) + 1;
    return `#${String(index).padStart(3, "0")}`;
  }

  function createMonumentCard(monument, index) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "monument-card";
    card.dataset.monumentId = monument.id;
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

    els.filters.replaceChildren(...filterDefinitions.map(([key, label]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "filter-chip";
      button.setAttribute("aria-pressed", String(state.filter === key));
      const total = key === "all" ? state.monuments.length : (counts[key] || 0);
      button.textContent = `${label} ${total}`;
      button.addEventListener("click", () => {
        state.filter = key;
        state.visibleCount = 16;
        renderFilters();
        renderMonuments();
      });
      return button;
    }));
  }

  function renderMonuments() {
    const monuments = filteredMonuments();
    const visible = monuments.slice(0, state.visibleCount);
    els.grid.replaceChildren(...visible.map(createMonumentCard));
    els.grid.hidden = monuments.length === 0;
    els.empty.hidden = monuments.length !== 0;
    els.loadMore.hidden = visible.length >= monuments.length || monuments.length === 0;
    els.clear.hidden = !state.query && state.filter === "all";

    if (!monuments.length) els.resultsCopy.textContent = "No matches in the 585-place collection";
    else if (visible.length < monuments.length) els.resultsCopy.textContent = `Showing ${visible.length} of ${monuments.length} monuments`;
    else els.resultsCopy.textContent = `${monuments.length} ${monuments.length === 1 ? "monument" : "monuments"}`;
    refreshIcons();
  }

  function renderCountries() {
    const counts = state.monuments.reduce((result, monument) => {
      result[monument.country] = (result[monument.country] || 0) + 1;
      return result;
    }, {});

    els.countries.replaceChildren(...countryPicks.filter((country) => counts[country]).map((country) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "country-button";
      const name = document.createElement("span");
      name.textContent = country;
      const total = document.createElement("span");
      total.textContent = `${counts[country]} places`;
      button.append(name, total);
      button.addEventListener("click", () => {
        state.query = country;
        state.filter = "all";
        state.visibleCount = 16;
        els.search.value = country;
        renderFilters();
        renderMonuments();
        document.querySelector("#explore").scrollIntoView({ behavior: "smooth" });
      });
      return button;
    }));
  }

  function coordinate(value, positive, negative) {
    return `${Math.abs(value).toFixed(4)}° ${value >= 0 ? positive : negative}`;
  }

  function wikipediaSearchUrl(monument) {
    return `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(`${monument.name} ${monument.country}`)}`;
  }

  function compactHistory(text, limit = 720) {
    const clean = String(text || "").replace(/\s+/g, " ").trim();
    if (clean.length <= limit) return clean;
    const shortened = clean.slice(0, limit);
    const end = Math.max(shortened.lastIndexOf(". "), shortened.lastIndexOf("; "));
    return `${shortened.slice(0, end > limit * 0.6 ? end + 1 : limit).trim()}…`;
  }

  async function fetchHistory(monument) {
    if (historyCache.has(monument.id)) return historyCache.get(monument.id);

    const baseParams = {
      action: "query",
      format: "json",
      origin: "*",
      prop: "extracts|info",
      exintro: "1",
      explaintext: "1",
      exsentences: "5",
      inprop: "url",
      redirects: "1",
    };

    const fallback = {
      text: `${monument.name} is a ${categoryLabel(monument.category).toLowerCase()} in ${monument.country}. A verified historical summary is not available yet for this catalogue entry.`,
      url: wikipediaSearchUrl(monument),
    };

    try {
      const directParams = new URLSearchParams({ ...baseParams, titles: monument.name });
      const directResponse = await fetch(`https://en.wikipedia.org/w/api.php?${directParams}`);
      if (!directResponse.ok) throw new Error(`Wikipedia returned ${directResponse.status}`);
      const directData = await directResponse.json();
      let page = Object.values(directData.query?.pages || {})[0];

      if (!page?.extract || page.missing !== undefined) {
        const searchParams = new URLSearchParams({
          ...baseParams,
          generator: "search",
          gsrsearch: `intitle:"${monument.name}" ${monument.country}`,
          gsrnamespace: "0",
          gsrlimit: "1",
        });
        const searchResponse = await fetch(`https://en.wikipedia.org/w/api.php?${searchParams}`);
        if (!searchResponse.ok) throw new Error(`Wikipedia search returned ${searchResponse.status}`);
        const searchData = await searchResponse.json();
        page = Object.values(searchData.query?.pages || {})[0];
      }

      const result = page?.extract ? { text: compactHistory(page.extract), url: page.fullurl || fallback.url } : fallback;
      historyCache.set(monument.id, result);
      return result;
    } catch (error) {
      console.warn(`History unavailable for ${monument.name}`, error);
      historyCache.set(monument.id, fallback);
      return fallback;
    }
  }

  async function fillHistory(monument, textElement, linkElement, requestId) {
    const history = await fetchHistory(monument);
    if (requestId !== state.historyRequest) return;
    textElement.textContent = history.text;
    linkElement.href = history.url;
    linkElement.hidden = false;
  }

  function showPlace(monument, pinned = false) {
    clearTimeout(state.hideTimer);
    if (pinned) state.globePinned = true;
    const popover = els.placePopover;
    popover.dataset.monumentId = monument.id;
    const image = popover.querySelector("[data-place-image]");
    image.src = monument.photo;
    image.alt = `${monument.name} in ${monument.country}`;
    popover.querySelector("[data-place-category]").textContent = categoryLabel(monument.category);
    popover.querySelector("[data-place-name]").textContent = monument.name;
    popover.querySelector("[data-place-country]").textContent = monument.country;
    const historyText = popover.querySelector("[data-place-history]");
    const historyLink = popover.querySelector("[data-place-source]");
    historyText.textContent = "Loading history...";
    historyLink.hidden = true;
    popover.hidden = false;
    refreshIcons();

    const requestId = ++state.historyRequest;
    clearTimeout(state.hoverTimer);
    state.hoverTimer = setTimeout(() => fillHistory(monument, historyText, historyLink, requestId), pinned ? 0 : 220);
  }

  function hidePlace(force = false) {
    if (state.globePinned && !force) return;
    clearTimeout(state.hoverTimer);
    state.hideTimer = setTimeout(() => {
      if (!state.globePinned || force) els.placePopover.hidden = true;
    }, force ? 0 : 180);
  }

  function selectGlobePlace(monument) {
    state.globePinned = true;
    showPlace(monument, true);
    els.globeResults.hidden = true;
    els.globeSearch.value = monument.name;
    if (state.globe) {
      state.globe.pointOfView({ lat: monument.lat, lng: monument.lng, altitude: 1.15 }, 900);
      state.globe.ringsData([monument]);
      try { state.globe.controls().autoRotate = false; } catch (_) {}
    }
  }

  function renderGlobeResults() {
    const query = els.globeSearch.value.trim().toLocaleLowerCase();
    if (!query) {
      state.globeMatches = [];
      els.globeResults.hidden = true;
      return;
    }

    state.globeMatches = state.monuments.filter((monument) => searchableText(monument).includes(query)).slice(0, 6);
    if (!state.globeMatches.length) {
      const empty = document.createElement("p");
      empty.className = "globe-result-empty";
      empty.textContent = "No matching place";
      els.globeResults.replaceChildren(empty);
      els.globeResults.hidden = false;
      return;
    }

    els.globeResults.replaceChildren(...state.globeMatches.map((monument) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "globe-result";
      button.dataset.monumentId = monument.id;
      const image = document.createElement("img");
      image.src = monument.photo;
      image.alt = "";
      const copy = document.createElement("span");
      const name = document.createElement("strong");
      name.textContent = monument.name;
      const country = document.createElement("span");
      country.textContent = monument.country;
      copy.append(name, country);
      const icon = document.createElement("i");
      icon.dataset.lucide = "locate-fixed";
      icon.setAttribute("aria-hidden", "true");
      button.append(image, copy, icon);
      button.addEventListener("click", () => selectGlobePlace(monument));
      return button;
    }));
    els.globeResults.hidden = false;
    refreshIcons();
  }

  function initGlobe() {
    if (!window.Globe) {
      els.globeLoading.querySelector("p").textContent = "3D globe unavailable";
      return;
    }

    try {
      const globe = window.Globe({ animateIn: false })(els.globe)
        .globeImageUrl("assets/earth-blue-marble.jpg")
        .bumpImageUrl("assets/earth-topology.png")
        .backgroundColor("rgba(0,0,0,0)")
        .showAtmosphere(true)
        .atmosphereColor("#0E9F6E")
        .atmosphereAltitude(0.18)
        .pointsData(state.monuments)
        .pointLat("lat")
        .pointLng("lng")
        .pointColor(() => "#18D294")
        .pointAltitude(0.018)
        .pointRadius(0.16)
        .pointResolution(8)
        .pointLabel(() => "")
        .ringsData([])
        .ringLat("lat")
        .ringLng("lng")
        .ringColor(() => (time) => `rgba(14,159,110,${1 - time})`)
        .ringMaxRadius(4)
        .ringPropagationSpeed(2.2)
        .ringRepeatPeriod(900)
        .onPointHover((monument) => {
          if (state.globePinned) return;
          if (monument) showPlace(monument, false);
          else hidePlace(false);
        })
        .onPointClick((monument) => selectGlobePlace(monument))
        .onGlobeClick(() => {
          if (!state.globePinned) return;
          state.globePinned = false;
          globe.ringsData([]);
          hidePlace(true);
        })
        .onGlobeReady(() => els.globeLoading.classList.add("is-ready"));

      state.globe = globe;
      els.globe.dataset.pointCount = String(state.monuments.length);
      els.globe.__monudexGlobe = globe;
      els.globe.__monudexPoints = state.monuments;
      const controls = globe.controls();
      controls.autoRotate = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      controls.autoRotateSpeed = 0.35;
      controls.enablePan = false;
      controls.minDistance = 150;
      controls.maxDistance = 520;
      globe.pointOfView({ lat: 18, lng: 10, altitude: 2.15 });

      const size = () => {
        const rect = els.globeStage.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) globe.width(rect.width).height(rect.height);
      };
      new ResizeObserver(size).observe(els.globeStage);
      size();
      els.globeStage.addEventListener("pointerdown", () => { controls.autoRotate = false; }, { passive: true });
    } catch (error) {
      console.error("Unable to initialize globe", error);
      els.globeLoading.querySelector("p").textContent = "3D globe unavailable";
    }
  }

  function openMonument(monument) {
    const dialog = els.monumentDialog;
    const image = dialog.querySelector("[data-dialog-image]");
    image.src = monument.photo;
    image.alt = `${monument.name} in ${monument.country}`;
    dialog.querySelector("[data-dialog-category]").textContent = categoryLabel(monument.category);
    dialog.querySelector("[data-dialog-name]").textContent = monument.name;
    dialog.querySelector("[data-dialog-country]").textContent = monument.country;
    dialog.querySelector("[data-dialog-coordinates]").textContent = `${coordinate(monument.lat, "N", "S")} · ${coordinate(monument.lng, "E", "W")}`;
    dialog.querySelector("[data-dialog-maps]").href = `https://www.google.com/maps/search/?api=1&query=${monument.lat},${monument.lng}`;
    dialog.querySelector("[data-dialog-source]").href = monument.photo;
    const historyText = dialog.querySelector("[data-dialog-history]");
    const historyLink = dialog.querySelector("[data-dialog-wikipedia]");
    historyText.textContent = "Loading history...";
    historyLink.hidden = true;
    dialog.showModal();
    refreshIcons();
    const requestId = ++state.historyRequest;
    fillHistory(monument, historyText, historyLink, requestId);
  }

  function openLegal(type, updateHash = true) {
    const content = legalContent[type];
    if (!content) return;
    const title = document.createElement("h2");
    title.id = "legal-title";
    title.textContent = content.title;
    const date = document.createElement("p");
    date.className = "legal-date";
    date.textContent = "Last updated August 4, 2026";
    const sections = content.sections.map(([heading, body]) => {
      const wrapper = document.createElement("section");
      const h3 = document.createElement("h3");
      h3.textContent = heading;
      const paragraph = document.createElement("p");
      paragraph.textContent = body;
      wrapper.append(h3, paragraph);
      return wrapper;
    });
    els.legalBody.replaceChildren(title, date, ...sections);
    els.legalDialog.showModal();
    if (updateHash) window.history.pushState(null, "", `#${type}`);
  }

  function closeLegal() {
    els.legalDialog.close();
    if (["#privacy", "#terms"].includes(window.location.hash)) window.history.replaceState(null, "", `${window.location.pathname}#top`);
  }

  function setMenu(open) {
    els.header.classList.toggle("menu-active", open);
    document.body.classList.toggle("menu-open", open);
    els.menuButton.setAttribute("aria-expanded", String(open));
    els.menuButton.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
    const icon = els.menuButton.querySelector("svg");
    if (icon) icon.outerHTML = `<i data-lucide="${open ? "x" : "menu"}" aria-hidden="true"></i>`;
    refreshIcons();
  }

  function bindEvents() {
    window.addEventListener("scroll", () => els.header.classList.toggle("is-scrolled", window.scrollY > 36), { passive: true });
    els.menuButton.addEventListener("click", () => setMenu(els.menuButton.getAttribute("aria-expanded") !== "true"));
    els.nav.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => setMenu(false)));

    els.globeSearch.addEventListener("input", renderGlobeResults);
    els.globeSearch.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && state.globeMatches.length) {
        event.preventDefault();
        selectGlobePlace(state.globeMatches[0]);
      }
    });

    els.search.addEventListener("input", (event) => {
      state.query = event.target.value;
      state.visibleCount = 16;
      renderMonuments();
    });

    els.clear.addEventListener("click", () => {
      state.query = "";
      state.filter = "all";
      state.visibleCount = 16;
      els.search.value = "";
      renderFilters();
      renderMonuments();
      els.search.focus();
    });

    els.loadMore.addEventListener("click", () => {
      state.visibleCount += 16;
      renderMonuments();
    });

    document.addEventListener("keydown", (event) => {
      const tag = document.activeElement?.tagName;
      if (event.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA") {
        event.preventDefault();
        const heroBottom = document.querySelector(".globe-hero").getBoundingClientRect().bottom;
        (heroBottom > 200 ? els.globeSearch : els.search).focus();
      }
      if (event.key === "Escape") {
        if (els.header.classList.contains("menu-active")) setMenu(false);
        els.globeResults.hidden = true;
        state.globePinned = false;
        if (state.globe) state.globe.ringsData([]);
        hidePlace(true);
      }
    });

    document.addEventListener("click", (event) => {
      if (!event.target.closest(".globe-search-wrap")) els.globeResults.hidden = true;
    });

    els.placePopover.addEventListener("mouseenter", () => clearTimeout(state.hideTimer));
    els.placePopover.addEventListener("mouseleave", () => hidePlace(false));
    document.querySelector("[data-place-close]").addEventListener("click", () => {
      state.globePinned = false;
      if (state.globe) state.globe.ringsData([]);
      hidePlace(true);
    });

    document.querySelector("[data-dialog-close]").addEventListener("click", () => els.monumentDialog.close());
    document.querySelector("[data-legal-close]").addEventListener("click", closeLegal);
    document.querySelectorAll("[data-legal]").forEach((button) => button.addEventListener("click", () => openLegal(button.dataset.legal)));

    [els.monumentDialog, els.legalDialog].forEach((dialog) => {
      dialog.addEventListener("click", (event) => {
        if (event.target === dialog) dialog === els.legalDialog ? closeLegal() : dialog.close();
      });
    });

    window.addEventListener("popstate", () => {
      const route = window.location.hash.slice(1);
      if (legalContent[route] && !els.legalDialog.open) openLegal(route, false);
      if (!legalContent[route] && els.legalDialog.open) els.legalDialog.close();
    });
  }

  async function init() {
    bindEvents();
    refreshIcons();
    els.header.classList.toggle("is-scrolled", window.scrollY > 36);

    try {
      const response = await fetch("data/monuments.json");
      if (!response.ok) throw new Error(`Catalogue request failed with ${response.status}`);
      const monuments = await response.json();
      if (!Array.isArray(monuments)) throw new Error("Catalogue is not an array");
      state.monuments = monuments.filter((item) => item && item.name && item.country && Number.isFinite(item.lat) && Number.isFinite(item.lng));
      renderFilters();
      renderMonuments();
      renderCountries();
      initGlobe();
    } catch (error) {
      console.error("Unable to load monument catalogue", error);
      els.resultsCopy.textContent = "The monument collection could not be loaded.";
      els.grid.hidden = true;
      els.empty.hidden = false;
      els.empty.querySelector("h3").textContent = "Collection unavailable";
      els.empty.querySelector("p").textContent = "Please refresh the page and try again.";
      els.globeLoading.querySelector("p").textContent = "Monument data unavailable";
    }

    const initialRoute = window.location.hash.slice(1);
    if (legalContent[initialRoute]) openLegal(initialRoute, false);
  }

  init();
})();
