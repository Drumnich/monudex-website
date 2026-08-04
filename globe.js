(() => {
  const els = {
    globe: document.querySelector("[data-globe]"),
    stage: document.querySelector("[data-globe-stage]"),
    loading: document.querySelector("[data-globe-loading]"),
    search: document.querySelector("[data-globe-search]"),
    results: document.querySelector("[data-globe-results]"),
    popover: document.querySelector("[data-place-popover]"),
    close: document.querySelector("[data-place-close]"),
    rotation: document.querySelector("[data-globe-rotation]"),
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
    fallback: null,
    rotationEnabled: true,
    globeInteracting: false,
    cameraTransitionUntil: 0,
    orbitFrame: null,
  };

  const refreshIcons = () => window.MonuDexSite?.refreshIcons();
  const { categoryLabel, searchableText, loadMonuments, fetchHistory } = window.MonuDexData;

  function updateRotationControl() {
    if (!els.rotation) return;
    const label = state.rotationEnabled ? "Pause globe rotation" : "Resume globe rotation";
    els.rotation.setAttribute("aria-label", label);
    els.rotation.setAttribute("aria-pressed", String(state.rotationEnabled));
    els.rotation.title = label;
    const icon = els.rotation.querySelector("[data-lucide]");
    if (icon) icon.setAttribute("data-lucide", state.rotationEnabled ? "pause" : "play");
    refreshIcons();
  }

  function setRotation(enabled) {
    state.rotationEnabled = enabled;
    if (state.globe) state.globe.controls().autoRotate = false;
    els.globe.dataset.rotating = String(enabled);
    updateRotationControl();
  }

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
      state.cameraTransitionUntil = performance.now() + 950;
      state.globe.pointOfView({ lat: monument.lat, lng: monument.lng, altitude: 1.15 }, 900);
      state.globe.ringsData([monument]);
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

  function initFallback(reason) {
    console.warn("Using the MonuDex software 3D globe", reason || "WebGL unavailable");
    els.globe.replaceChildren();
    els.stage.classList.add("uses-fallback");
    els.globe.dataset.mode = "3d-software";
    els.globe.dataset.pointCount = String(state.monuments.length);

    const wrap = document.createElement("div");
    wrap.className = "fallback-globe";
    wrap.setAttribute("role", "group");
    wrap.setAttribute("aria-label", `Interactive 3D globe with ${state.monuments.length} monument locations`);
    const sphere = document.createElement("div");
    sphere.className = "fallback-sphere";
    const canvas = document.createElement("canvas");
    canvas.className = "fallback-canvas";
    canvas.width = 360;
    canvas.height = 360;
    canvas.setAttribute("aria-hidden", "true");
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

    const view = {
      centerLat: 0,
      centerLng: 8,
      selectedId: "",
      dragging: false,
      lastX: 0,
      lastY: 0,
      lastFrame: performance.now(),
      lastRender: 0,
      texture: null,
    };
    state.fallback = view;

    const context = canvas.getContext("2d");
    const pixelCount = canvas.width * canvas.height;
    const normalX = new Float32Array(pixelCount);
    const normalY = new Float32Array(pixelCount);
    const normalZ = new Float32Array(pixelCount);
    const shade = new Float32Array(pixelCount);
    const sphereImage = context.createImageData(canvas.width, canvas.height);
    normalZ.fill(-1);

    for (let y = 0; y < canvas.height; y += 1) {
      for (let x = 0; x < canvas.width; x += 1) {
        const index = y * canvas.width + x;
        const nx = (x + 0.5) / (canvas.width / 2) - 1;
        const ny = 1 - (y + 0.5) / (canvas.height / 2);
        const radiusSquared = nx * nx + ny * ny;
        if (radiusSquared > 1) continue;
        const nz = Math.sqrt(1 - radiusSquared);
        normalX[index] = nx;
        normalY[index] = ny;
        normalZ[index] = nz;
        shade[index] = Math.max(0.34, Math.min(1, 0.44 + nz * 0.48 - nx * 0.08 + ny * 0.06));
      }
    }

    function drawSphere() {
      if (!view.texture) return;
      const { data, width, height } = view.texture;
      const target = sphereImage.data;
      const centerLat = view.centerLat * Math.PI / 180;
      const centerLng = view.centerLng * Math.PI / 180;
      const sinCenterLat = Math.sin(centerLat);
      const cosCenterLat = Math.cos(centerLat);

      for (let index = 0; index < pixelCount; index += 1) {
        const nz = normalZ[index];
        if (nz < 0) continue;
        const nx = normalX[index];
        const ny = normalY[index];
        const lat = Math.asin(ny * cosCenterLat + nz * sinCenterLat);
        const lng = centerLng + Math.atan2(nx, nz * cosCenterLat - ny * sinCenterLat);
        const textureX = Math.floor((((lng / (2 * Math.PI) + 0.5) % 1 + 1) % 1) * width);
        const textureY = Math.max(0, Math.min(height - 1, Math.floor((0.5 - lat / Math.PI) * height)));
        const sourceIndex = (textureY * width + textureX) * 4;
        const targetIndex = index * 4;
        const light = shade[index];
        target[targetIndex] = data[sourceIndex] * light;
        target[targetIndex + 1] = data[sourceIndex + 1] * light;
        target[targetIndex + 2] = data[sourceIndex + 2] * light;
        target[targetIndex + 3] = 255;
      }
      context.putImageData(sphereImage, 0, 0);
    }

    const textureImage = new Image();
    textureImage.decoding = "async";
    textureImage.addEventListener("load", () => {
      const textureCanvas = document.createElement("canvas");
      textureCanvas.width = 1024;
      textureCanvas.height = 512;
      const textureContext = textureCanvas.getContext("2d", { willReadFrequently: true });
      textureContext.drawImage(textureImage, 0, 0, textureCanvas.width, textureCanvas.height);
      view.texture = {
        data: textureContext.getImageData(0, 0, textureCanvas.width, textureCanvas.height).data,
        width: textureCanvas.width,
        height: textureCanvas.height,
      };
      drawSphere();
    }, { once: true });
    textureImage.src = "assets/earth-blue-marble.jpg";

    function project(centerLat = view.centerLat, centerLng = view.centerLng, selectedId = view.selectedId) {
      view.centerLat = Math.max(-72, Math.min(72, centerLat));
      view.centerLng = ((centerLng + 540) % 360) - 180;
      view.selectedId = selectedId;
      els.globe.dataset.viewLng = view.centerLng.toFixed(3);
      drawSphere();
      const centerLatRadians = view.centerLat * Math.PI / 180;
      const sinCenterLat = Math.sin(centerLatRadians);
      const cosCenterLat = Math.cos(centerLatRadians);
      pointNodes.forEach(({ monument, point }) => {
        const lat = monument.lat * Math.PI / 180;
        const delta = (monument.lng - view.centerLng) * Math.PI / 180;
        const cosLat = Math.cos(lat);
        const x = cosLat * Math.sin(delta);
        const y = cosCenterLat * Math.sin(lat) - sinCenterLat * cosLat * Math.cos(delta);
        const z = sinCenterLat * Math.sin(lat) + cosCenterLat * cosLat * Math.cos(delta);
        point.hidden = z <= 0.02;
        point.style.left = `${50 + x * 49}%`;
        point.style.top = `${50 - y * 49}%`;
        point.style.opacity = String(Math.max(0.45, z));
        point.style.setProperty("--point-depth", String(0.72 + Math.max(0, z) * 0.38));
        point.classList.toggle("is-selected", monument.id === selectedId);
      });
    }

    const finishDrag = (event) => {
      if (!view.dragging) return;
      view.dragging = false;
      if (sphere.hasPointerCapture(event.pointerId)) sphere.releasePointerCapture(event.pointerId);
    };

    sphere.addEventListener("pointerdown", (event) => {
      if (event.target.closest(".fallback-point")) return;
      view.dragging = true;
      view.lastX = event.clientX;
      view.lastY = event.clientY;
      sphere.setPointerCapture(event.pointerId);
    });
    sphere.addEventListener("pointermove", (event) => {
      if (!view.dragging) return;
      const deltaX = event.clientX - view.lastX;
      const deltaY = event.clientY - view.lastY;
      view.lastX = event.clientX;
      view.lastY = event.clientY;
      project(view.centerLat + deltaY * 0.22, view.centerLng - deltaX * 0.32);
    });
    sphere.addEventListener("pointerup", finishDrag);
    sphere.addEventListener("pointercancel", finishDrag);

    function animate(now) {
      const elapsed = Math.min(50, now - view.lastFrame);
      view.lastFrame = now;
      if (state.rotationEnabled && !view.dragging) view.centerLng += elapsed * 0.0022;
      if (now - view.lastRender > 40) {
        project();
        view.lastRender = now;
      }
      requestAnimationFrame(animate);
    }

    state.fallbackProjection = project;
    sphere.append(canvas, points);
    wrap.append(sphere, status);
    els.globe.append(wrap);
    project();
    requestAnimationFrame(animate);
    setRotation(state.rotationEnabled);
    els.loading.classList.add("is-ready");
  }

  function start3DOrbit(globe) {
    let lastFrame = performance.now();
    function orbit(now) {
      const elapsed = Math.min(50, now - lastFrame);
      lastFrame = now;
      if (state.rotationEnabled && !state.globeInteracting && now >= state.cameraTransitionUntil) {
        const view = globe.pointOfView();
        const lng = ((Number(view.lng) - elapsed * 0.0022 + 540) % 360) - 180;
        globe.pointOfView({ lat: view.lat, lng, altitude: view.altitude }, 0);
      }
      state.orbitFrame = requestAnimationFrame(orbit);
    }
    cancelAnimationFrame(state.orbitFrame);
    state.orbitFrame = requestAnimationFrame(orbit);
  }

  function init3DGlobe() {
    if (!window.Globe) {
      initFallback("Globe runtime did not load");
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
        .pointAltitude(0.004)
        .pointRadius(0.22)
        .pointResolution(6)
        .pointsTransitionDuration(0)
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
      controls.autoRotate = false;
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
      controls.addEventListener("start", () => { state.globeInteracting = true; });
      controls.addEventListener("end", () => { state.globeInteracting = false; });
      controls.addEventListener("change", () => {
        const view = globe.pointOfView();
        els.globe.dataset.viewLng = Number(view.lng).toFixed(3);
      });
      setRotation(state.rotationEnabled);
      start3DOrbit(globe);
    } catch (error) {
      state.globe = null;
      initFallback(error);
    }
  }

  function bindEvents() {
    els.rotation?.addEventListener("click", () => setRotation(!state.rotationEnabled));
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
