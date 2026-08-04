(() => {
  const state = {
    monuments: [],
    query: "",
    filter: "all",
    visibleCount: 14,
  };

  const els = {
    header: document.querySelector("[data-header]"),
    menuButton: document.querySelector("[data-menu-button]"),
    nav: document.querySelector("[data-nav]"),
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

  const featuredNames = [
    "Eiffel Tower",
    "Taj Mahal",
    "Colosseum",
    "Great Wall of China",
    "Christ the Redeemer",
    "Sydney Opera House",
    "Machu Picchu",
    "Petra",
    "Angkor Wat",
    "Statue of Liberty",
  ];

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
    "France",
    "Italy",
    "India",
    "Japan",
    "Egypt",
    "Mexico",
    "Peru",
    "Jordan",
    "Cambodia",
    "Brazil",
    "United States",
    "Australia",
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
    if (window.lucide) window.lucide.createIcons({ attrs: { "stroke-width": 1.8 } });
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
    if (category === "Visit-worthy landmark") return "Landmark";
    return category || "Landmark";
  }

  function searchableText(monument) {
    return `${monument.name} ${monument.country} ${monument.category}`.toLocaleLowerCase();
  }

  function filteredMonuments() {
    const query = state.query.trim().toLocaleLowerCase();
    const filtered = state.monuments.filter((monument) => {
      const categoryMatch = state.filter === "all" || categoryKey(monument.category) === state.filter;
      const queryMatch = !query || searchableText(monument).includes(query);
      return categoryMatch && queryMatch;
    });

    if (!query && state.filter === "all") {
      const priority = new Map(featuredNames.map((name, index) => [name, index]));
      return filtered.sort((a, b) => {
        const aRank = priority.has(a.name) ? priority.get(a.name) : 999;
        const bRank = priority.has(b.name) ? priority.get(b.name) : 999;
        return aRank - bRank || a.country.localeCompare(b.country) || a.name.localeCompare(b.name);
      });
    }

    return filtered.sort((a, b) => a.country.localeCompare(b.country) || a.name.localeCompare(b.name));
  }

  function formatIndex(monument) {
    const index = state.monuments.findIndex((item) => item.id === monument.id) + 1;
    return `#${String(index).padStart(3, "0")}`;
  }

  function createMonumentCard(monument, index, useFeaturedLayout) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "monument-card";
    card.setAttribute("aria-label", `View ${monument.name} in ${monument.country}`);
    if (useFeaturedLayout && index < 2) card.classList.add("featured-card");

    const imageWrap = document.createElement("span");
    imageWrap.className = "monument-card-image";

    const image = document.createElement("img");
    image.src = monument.photo;
    image.alt = monument.name;
    image.loading = index < 4 ? "eager" : "lazy";
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
        state.visibleCount = 14;
        renderFilters();
        renderMonuments();
      });
      return button;
    }));
  }

  function renderMonuments() {
    const monuments = filteredMonuments();
    const visible = monuments.slice(0, state.visibleCount);
    const defaultView = !state.query.trim() && state.filter === "all";

    els.grid.replaceChildren(...visible.map((monument, index) => createMonumentCard(monument, index, defaultView)));
    els.grid.hidden = monuments.length === 0;
    els.empty.hidden = monuments.length !== 0;
    els.loadMore.hidden = visible.length >= monuments.length || monuments.length === 0;
    els.clear.hidden = !state.query && state.filter === "all";

    if (monuments.length === 0) {
      els.resultsCopy.textContent = "No matches in the 585-place atlas";
    } else if (visible.length < monuments.length) {
      els.resultsCopy.textContent = `Showing ${visible.length} of ${monuments.length} matching monuments`;
    } else {
      els.resultsCopy.textContent = `${monuments.length} ${monuments.length === 1 ? "monument" : "monuments"}`;
    }

    refreshIcons();
  }

  function renderCountries() {
    const counts = state.monuments.reduce((result, monument) => {
      result[monument.country] = (result[monument.country] || 0) + 1;
      return result;
    }, {});

    const buttons = countryPicks.filter((country) => counts[country]).map((country) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "country-button";
      button.innerHTML = `<span></span><span>${counts[country]} places</span>`;
      button.firstElementChild.textContent = country;
      button.addEventListener("click", () => {
        state.query = country;
        state.filter = "all";
        state.visibleCount = 14;
        els.search.value = country;
        renderFilters();
        renderMonuments();
        document.querySelector("#explore").scrollIntoView({ behavior: "smooth" });
      });
      return button;
    });

    els.countries.replaceChildren(...buttons);
  }

  function coordinate(value, positive, negative) {
    const direction = value >= 0 ? positive : negative;
    return `${Math.abs(value).toFixed(4)}° ${direction}`;
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
    dialog.showModal();
    refreshIcons();
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
    if (["#privacy", "#terms"].includes(window.location.hash)) {
      window.history.replaceState(null, "", `${window.location.pathname}#top`);
    }
  }

  function setMenu(open) {
    els.header.classList.toggle("menu-active", open);
    document.body.classList.toggle("menu-open", open);
    els.menuButton.setAttribute("aria-expanded", String(open));
    els.menuButton.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
    const icon = els.menuButton.querySelector("svg");
    if (icon) {
      icon.outerHTML = `<i data-lucide="${open ? "x" : "menu"}" aria-hidden="true"></i>`;
      refreshIcons();
    }
  }

  function bindEvents() {
    window.addEventListener("scroll", () => {
      els.header.classList.toggle("is-scrolled", window.scrollY > 24);
    }, { passive: true });

    els.menuButton.addEventListener("click", () => {
      setMenu(els.menuButton.getAttribute("aria-expanded") !== "true");
    });

    els.nav.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => setMenu(false));
    });

    els.search.addEventListener("input", (event) => {
      state.query = event.target.value;
      state.visibleCount = 14;
      renderMonuments();
    });

    document.addEventListener("keydown", (event) => {
      const tag = document.activeElement?.tagName;
      if (event.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA") {
        event.preventDefault();
        els.search.focus();
      }
      if (event.key === "Escape" && els.header.classList.contains("menu-active")) setMenu(false);
    });

    els.clear.addEventListener("click", () => {
      state.query = "";
      state.filter = "all";
      state.visibleCount = 14;
      els.search.value = "";
      renderFilters();
      renderMonuments();
      els.search.focus();
    });

    els.loadMore.addEventListener("click", () => {
      state.visibleCount += 16;
      renderMonuments();
    });

    document.querySelector("[data-dialog-close]").addEventListener("click", () => els.monumentDialog.close());
    document.querySelector("[data-legal-close]").addEventListener("click", closeLegal);
    document.querySelectorAll("[data-legal]").forEach((button) => {
      button.addEventListener("click", () => openLegal(button.dataset.legal));
    });

    [els.monumentDialog, els.legalDialog].forEach((dialog) => {
      dialog.addEventListener("click", (event) => {
        if (event.target === dialog) {
          if (dialog === els.legalDialog) closeLegal();
          else dialog.close();
        }
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
    els.header.classList.toggle("is-scrolled", window.scrollY > 24);

    try {
      const response = await fetch("data/monuments.json");
      if (!response.ok) throw new Error(`Catalogue request failed with ${response.status}`);
      const monuments = await response.json();
      if (!Array.isArray(monuments)) throw new Error("Catalogue is not an array");
      state.monuments = monuments.filter((item) => item && item.name && item.country && Number.isFinite(item.lat) && Number.isFinite(item.lng));
      renderFilters();
      renderMonuments();
      renderCountries();
    } catch (error) {
      console.error("Unable to load monument catalogue", error);
      els.resultsCopy.textContent = "The monument atlas could not be loaded.";
      els.grid.hidden = true;
      els.empty.hidden = false;
      els.empty.querySelector("h3").textContent = "Atlas unavailable";
      els.empty.querySelector("p").textContent = "Please refresh the page and try again.";
    }

    const initialRoute = window.location.hash.slice(1);
    if (legalContent[initialRoute]) openLegal(initialRoute, false);
  }

  init();
})();
