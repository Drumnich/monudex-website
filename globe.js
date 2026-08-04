(() => {
  const els = {
    globe: document.querySelector("[data-globe]"),
    stage: document.querySelector("[data-globe-stage]"),
    loading: document.querySelector("[data-globe-loading]"),
    search: document.querySelector("[data-globe-search]"),
    results: document.querySelector("[data-globe-results]"),
    popover: document.querySelector("[data-place-popover]"),
    close: document.querySelector("[data-place-close]"),
  };
  if (!els.globe || !window.MonuDexData) return;

  const state = {
    monuments: [],
    globe: null,
    matches: [],
    pinned: false,
    historyRequest: 0,
    hoverTimer: null,
    hideTimer: null,
    fallbackProjection: null,
  };

  const refreshIcons = () => window.MonuDexSite?.refreshIcons();
  const { categoryLabel, searchableText, loadMonuments, fetchHistory } = window.MonuDexData;

  async function fillHistory(monument, requestId) {
    const history = await fetchHistory(monument);
    if (requestId !== state.historyRequest || els.popover.dataset.monumentId !== monument.id) return;
    els.popover.querySelector("[data-place-history]").textContent = history.text;
    const link = els.popover.querySelector("[data-place-source]");
    link.href = history.url;
    link.hidden = false;
  }

  function showPlace(monument, pinned = false) {
    clearTimeout(state.hideTimer);
    if (pinned) state.pinned = true;
    els.popover.dataset.monumentId = monument.id;
    const image = els.popover.querySelector("[data-place-image]");
    image.src = monument.photo;
    image.alt = `${monument.name} in ${monument.country}`;
    image.onerror = () => { image.hidden = true; };
    image.hidden = false;
    els.popover.querySelector("[data-place-category]").textContent = categoryLabel(monument.category);
    els.popover.querySelector("[data-place-name]").textContent = monument.name;
    els.popover.querySelector("[data-place-country]").textContent = monument.country;
    els.popover.querySelector("[data-place-history]").textContent = "Loading history...";
    els.popover.querySelector("[data-place-source]").hidden = true;
    els.popover.hidden = false;
    refreshIcons();

    const requestId = ++state.historyRequest;
    clearTimeout(state.hoverTimer);
    state.hoverTimer = setTimeout(() => fillHistory(monument, requestId), pinned ? 0 : 220);
  }

  function hidePlace(force = false) {
    if (state.pinned && !force) return;
    clearTimeout(state.hoverTimer);
    state.hideTimer = setTimeout(() => {
      if (!state.pinned || force) els.popover.hidden = true;
    }, force ? 0 : 180);
  }

  function selectPlace(monument) {
    state.pinned = true;
    showPlace(monument, true);
    els.results.hidden = true;
    els.search.value = monument.name;

    if (state.globe) {
      state.globe.pointOfView({ lat: monument.lat, lng: monument.lng, altitude: 1.15 }, 900);
      state.globe.ringsData([monument]);
      try { state.globe.controls().autoRotate = false; } catch (_) {}
    } else if (state.fallbackProjection) {
      state.fallbackProjection(monument.lat, monument.lng, monument.id);
    }
  }

  function renderResults() {
    const query = els.search.value.trim().toLocaleLowerCase();
    if (!query) {
      state.matches = [];
      els.results.hidden = true;
      return;
    }

    state.matches = state.monuments.filter((monument) => searchableText(monument).includes(query)).slice(0, 6);
    if (!state.matches.length) {
      const empty = document.createElement("p");
      empty.className = "globe-result-empty";
      empty.textContent = "No matching place";
      els.results.replaceChildren(empty);
      els.results.hidden = false;
      return;
    }

    els.results.replaceChildren(...state.matches.map((monument) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "globe-result";
      const image = document.createElement("img");
      image.src = monument.photo;
      image.alt = "";
      image.addEventListener("error", () => { image.hidden = true; }, { once: true });
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
      button.addEventListener("click", () => selectPlace(monument));
      return button;
    }));
    els.results.hidden = false;
    refreshIcons();
  }

  function canUseWebGL() {
    try {
      const canvas = document.createElement("canvas");
      return Boolean(window.WebGLRenderingContext && (canvas.getContext("webgl2") || canvas.getContext("webgl")));
    } catch (_) {
      return false;
    }
  }

  function initFallback(reason) {
    console.warn("Using the MonuDex compatibility globe", reason || "WebGL unavailable");
    els.globe.replaceChildren();
    els.stage.classList.add("uses-fallback");
    els.globe.dataset.mode = "compatibility";
    els.globe.dataset.pointCount = String(state.monuments.length);

    const wrap = document.createElement("div");
    wrap.className = "fallback-globe";
    wrap.setAttribute("role", "group");
    wrap.setAttribute("aria-label", `Compatibility globe with ${state.monuments.length} monument locations`);
    const sphere = document.createElement("div");
    sphere.className = "fallback-sphere";
    const points = document.createElement("div");
    points.className = "fallback-points";
    const status = document.createElement("div");
    status.className = "fallback-status";
    status.innerHTML = `<strong>${state.monuments.length}</strong><span>mapped places</span>`;

    const pointNodes = state.monuments.map((monument) => {
      const point = document.createElement("button");
      point.type = "button";
      point.className = "fallback-point";
      point.setAttribute("aria-label", `${monument.name}, ${monument.country}`);
      point.title = `${monument.name}, ${monument.country}`;
      point.addEventListener("mouseenter", () => { if (!state.pinned) showPlace(monument); });
      point.addEventListener("mouseleave", () => hidePlace());
      point.addEventListener("click", () => selectPlace(monument));
      points.append(point);
      return { monument, point };
    });

    function project(centerLat = 12, centerLng = 8, selectedId = "") {
      const lat0 = centerLat * Math.PI / 180;
      sphere.style.setProperty("--fallback-x", `${50 - centerLng / 3.6}%`);
      sphere.style.setProperty("--fallback-y", `${50 + centerLat / 3.6}%`);
      pointNodes.forEach(({ monument, point }) => {
        const lat = monument.lat * Math.PI / 180;
        const delta = (monument.lng - centerLng) * Math.PI / 180;
        const x = Math.cos(lat) * Math.sin(delta);
        const y = Math.cos(lat0) * Math.sin(lat) - Math.sin(lat0) * Math.cos(lat) * Math.cos(delta);
        const z = Math.sin(lat0) * Math.sin(lat) + Math.cos(lat0) * Math.cos(lat) * Math.cos(delta);
        point.hidden = z < 0.02;
        point.style.left = `${50 + x * 46}%`;
        point.style.top = `${50 - y * 46}%`;
        point.style.opacity = String(Math.max(0.42, z));
        point.classList.toggle("is-selected", monument.id === selectedId);
      });
    }

    state.fallbackProjection = project;
    sphere.append(points);
    wrap.append(sphere, status);
    els.globe.append(wrap);
    project();
    els.loading.classList.add("is-ready");
  }

  function init3DGlobe() {
    if (!window.Globe || !canUseWebGL()) {
      initFallback(!window.Globe ? "Globe runtime did not load" : "WebGL is not supported");
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
          if (state.pinned) return;
          if (monument) showPlace(monument);
          else hidePlace();
        })
        .onPointClick((monument) => selectPlace(monument))
        .onGlobeClick(() => {
          if (!state.pinned) return;
          state.pinned = false;
          globe.ringsData([]);
          hidePlace(true);
        })
        .onGlobeReady(() => {
          els.globe.dataset.mode = "3d";
          els.loading.classList.add("is-ready");
        });

      state.globe = globe;
      els.globe.dataset.pointCount = String(state.monuments.length);
      const controls = globe.controls();
      controls.autoRotate = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      controls.autoRotateSpeed = 0.35;
      controls.enablePan = false;
      controls.minDistance = 150;
      controls.maxDistance = 520;
      globe.pointOfView({ lat: 18, lng: 10, altitude: 2.15 });

      const size = () => {
        const rect = els.stage.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) globe.width(rect.width).height(rect.height);
      };
      new ResizeObserver(size).observe(els.stage);
      size();
      els.stage.addEventListener("pointerdown", () => { controls.autoRotate = false; }, { passive: true });
    } catch (error) {
      state.globe = null;
      initFallback(error);
    }
  }

  function bindEvents() {
    els.search.addEventListener("input", renderResults);
    els.search.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && state.matches.length) {
        event.preventDefault();
        selectPlace(state.matches[0]);
      }
    });
    els.close.addEventListener("click", () => {
      state.pinned = false;
      if (state.globe) state.globe.ringsData([]);
      hidePlace(true);
    });
    els.popover.addEventListener("mouseenter", () => clearTimeout(state.hideTimer));
    els.popover.addEventListener("mouseleave", () => hidePlace());
    document.addEventListener("click", (event) => {
      if (!event.target.closest(".globe-search-wrap")) els.results.hidden = true;
    });
    document.addEventListener("keydown", (event) => {
      const tag = document.activeElement?.tagName;
      if (event.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA") {
        event.preventDefault();
        els.search.focus();
      }
      if (event.key === "Escape") {
        els.results.hidden = true;
        state.pinned = false;
        if (state.globe) state.globe.ringsData([]);
        hidePlace(true);
      }
    });
  }

  async function init() {
    bindEvents();
    try {
      state.monuments = await loadMonuments();
      init3DGlobe();
    } catch (error) {
      console.error("Unable to load monument catalogue", error);
      els.loading.querySelector("p").textContent = "The monument data could not be loaded";
    }
  }

  init();
})();
