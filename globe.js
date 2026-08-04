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
    orbitFrame: null,
    cloudLayer: null,
    stageVisible: true,
    renderProfile: null,
  };

  const refreshIcons = () => window.MonuDexSite?.refreshIcons();
  const { categoryLabel, searchableText, loadMonuments, fetchHistory } = window.MonuDexData;
  const globeTextureUrl = () => state.renderProfile?.tier === "efficient"
    ? "assets/globe/earth-blue-marble-2k.jpg"
    : "assets/earth-blue-marble.jpg";

  function getRenderProfile() {
    const narrowScreen = window.matchMedia("(max-width: 760px)").matches;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const saveData = navigator.connection?.saveData === true;
    const lowMemory = Number(navigator.deviceMemory || 8) <= 4;
    const fewCores = Number(navigator.hardwareConcurrency || 8) <= 4;
    const constrained = saveData || lowMemory || fewCores;
    const maxPixelRatio = constrained || narrowScreen ? 1 : 1.35;

    return {
      advancedTextures: !constrained && !narrowScreen,
      pixelRatio: Math.min(Number(window.devicePixelRatio || 1), maxPixelRatio),
      reducedMotion,
      tier: constrained || narrowScreen ? "efficient" : "balanced",
    };
  }

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
    sync3DAnimationState();
    els.globe.dataset.rotating = String(enabled);
    updateRotationControl();
  }

  function stopCloudOrbit() {
    cancelAnimationFrame(state.orbitFrame);
    state.orbitFrame = null;
  }

  function startCloudOrbit() {
    if (state.orbitFrame || !state.cloudLayer) return;
    let lastFrame = performance.now();

    function orbit(now) {
      const elapsed = Math.min(50, now - lastFrame);
      lastFrame = now;
      state.cloudLayer.rotation.y -= elapsed * 0.000006;
      state.orbitFrame = requestAnimationFrame(orbit);
    }

    state.orbitFrame = requestAnimationFrame(orbit);
  }

  function sync3DAnimationState() {
    if (!state.globe) return;
    const active = state.stageVisible && !document.hidden;
    const shouldRotate = active && state.rotationEnabled && !state.globeInteracting;
    const controls = state.globe.controls();
    els.globe.dataset.animationActive = String(active);
    controls.autoRotate = shouldRotate;

    if (active) state.globe.resumeAnimation?.();
    else state.globe.pauseAnimation?.();

    if (shouldRotate && state.cloudLayer) startCloudOrbit();
    else stopCloudOrbit();
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
      renderFrame: null,
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
    textureImage.src = globeTextureUrl();

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

    function scheduleProject() {
      if (view.renderFrame) return;
      view.renderFrame = requestAnimationFrame(() => {
        view.renderFrame = null;
        project();
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
      view.centerLat = Math.max(-72, Math.min(72, view.centerLat + deltaY * 0.22));
      view.centerLng = ((view.centerLng - deltaX * 0.32 + 540) % 360) - 180;
      scheduleProject();
    });
    sphere.addEventListener("pointerup", finishDrag);
    sphere.addEventListener("pointercancel", finishDrag);

    function animate(now) {
      const elapsed = Math.min(50, now - view.lastFrame);
      view.lastFrame = now;
      const shouldRotate = state.rotationEnabled && state.stageVisible && !document.hidden && !view.dragging;
      if (shouldRotate) view.centerLng += elapsed * 0.0022;
      if (shouldRotate && now - view.lastRender > 66) {
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

  function loadThreeTexture(globe, url, TextureClass) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.decoding = "async";
      image.addEventListener("load", () => {
        const texture = new TextureClass(image);
        texture.anisotropy = Math.min(8, globe.renderer().capabilities.getMaxAnisotropy());
        texture.needsUpdate = true;
        resolve(texture);
      }, { once: true });
      image.addEventListener("error", reject, { once: true });
      image.src = url;
    });
  }

  async function enhance3DGlobe(globe) {
    const surfaceMaterial = globe.globeMaterial();
    const TextureClass = surfaceMaterial.map?.constructor;
    if (!TextureClass) return;

    const [specularTexture, cloudTexture] = await Promise.all([
      state.renderProfile.advancedTextures
        ? loadThreeTexture(globe, "assets/globe/earth-specular.jpg", TextureClass).catch(() => null)
        : Promise.resolve(null),
      state.renderProfile.advancedTextures
        ? loadThreeTexture(globe, "assets/globe/earth-clouds.png", TextureClass).catch(() => null)
        : Promise.resolve(null),
    ]);

    if (specularTexture) {
      surfaceMaterial.specularMap = specularTexture;
      surfaceMaterial.specular?.set("#7EAFC4");
      surfaceMaterial.shininess = 22;
    }
    surfaceMaterial.bumpScale = 3.6;
    surfaceMaterial.needsUpdate = true;

    if (!cloudTexture || state.cloudLayer) return;
    let surfaceMesh = null;
    globe.scene().traverse((object) => {
      if (!surfaceMesh && object.isMesh && object.material === surfaceMaterial) surfaceMesh = object;
    });
    if (!surfaceMesh?.geometry?.clone || !surfaceMesh.parent) return;

    const cloudGeometry = surfaceMesh.geometry.clone();
    cloudGeometry.scale(1.0035, 1.0035, 1.0035);
    const CloudMaterial = surfaceMaterial.constructor;
    const cloudMaterial = new CloudMaterial({
      map: cloudTexture,
      color: "#F4FAFF",
      transparent: true,
      opacity: 0.36,
      depthWrite: false,
      alphaTest: 0.015,
    });
    const CloudMesh = surfaceMesh.constructor;
    const cloudLayer = new CloudMesh(cloudGeometry, cloudMaterial);
    cloudLayer.name = "monudex-cloud-layer";
    cloudLayer.position.copy(surfaceMesh.position);
    cloudLayer.quaternion.copy(surfaceMesh.quaternion);
    cloudLayer.scale.copy(surfaceMesh.scale);
    surfaceMesh.parent.add(cloudLayer);
    state.cloudLayer = cloudLayer;
    els.globe.dataset.cloudLayer = "true";
    sync3DAnimationState();
  }

  function init3DGlobe() {
    if (!window.Globe) {
      initFallback("Globe runtime did not load");
      return;
    }

    try {
      const globe = window.Globe({ animateIn: false })(els.globe)
        .globeImageUrl(globeTextureUrl())
        .bumpImageUrl(state.renderProfile.advancedTextures ? "assets/earth-topology.png" : null)
        .backgroundColor("rgba(0,0,0,0)")
        .showAtmosphere(true)
        .atmosphereColor("#79CFFF")
        .atmosphereAltitude(0.16)
        .pointsData(state.monuments)
        .pointLat("lat")
        .pointLng("lng")
        .pointColor(() => "#18D294")
        .pointAltitude(0.006)
        .pointRadius(0.22)
        .pointResolution(4)
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
          enhance3DGlobe(globe).catch((error) => console.warn("Advanced globe textures unavailable", error));
        });

      state.globe = globe;
      els.globe.dataset.pointCount = String(state.monuments.length);
      els.globe.dataset.performanceTier = state.renderProfile.tier;
      els.globe.dataset.renderPixelRatio = state.renderProfile.pixelRatio.toFixed(2);
      const controls = globe.controls();
      controls.autoRotate = false;
      controls.autoRotateSpeed = 0.36;
      controls.enablePan = false;
      controls.minDistance = 150;
      controls.maxDistance = 520;
      globe.pointOfView({ lat: 18, lng: 10, altitude: 2.28 });

      globe.renderer().setPixelRatio(state.renderProfile.pixelRatio);
      const applySize = () => {
        const rect = els.stage.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) globe.width(rect.width).height(rect.height);
      };
      let resizeFrame = null;
      const size = () => {
        cancelAnimationFrame(resizeFrame);
        resizeFrame = requestAnimationFrame(applySize);
      };
      new ResizeObserver(size).observe(els.stage);
      applySize();

      const updateViewLongitude = () => {
        const view = globe.pointOfView();
        els.globe.dataset.viewLng = Number(view.lng).toFixed(3);
      };
      controls.addEventListener("start", () => {
        state.globeInteracting = true;
        sync3DAnimationState();
      });
      controls.addEventListener("end", () => {
        state.globeInteracting = false;
        updateViewLongitude();
        sync3DAnimationState();
      });
      new IntersectionObserver(([entry]) => {
        state.stageVisible = entry.isIntersecting;
        sync3DAnimationState();
      }, { threshold: 0.01 }).observe(els.stage);
      document.addEventListener("visibilitychange", sync3DAnimationState);
      updateViewLongitude();
      setRotation(state.rotationEnabled);
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
      state.renderProfile = getRenderProfile();
      if (state.renderProfile.reducedMotion) state.rotationEnabled = false;
      state.monuments = await loadMonuments();
      init3DGlobe();
    } catch (error) {
      console.error("Unable to load monument catalogue", error);
      els.loading.querySelector("p").textContent = "The monument data could not be loaded";
    }
  }

  init();
})();
