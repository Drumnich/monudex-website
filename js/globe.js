// Shared interactive globe (globe.gl) for the MonuDex site.
async function loadMonuments() {
  const res = await fetch('data/monuments.json');
  return res.json();
}

function makeGlobe(el, monuments, opts = {}) {
  const g = Globe()(el)
    .globeImageUrl('https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg')
    .bumpImageUrl('https://unpkg.com/three-globe/example/img/earth-topology.png')
    .backgroundColor('rgba(0,0,0,0)')
    .showAtmosphere(true)
    .atmosphereColor('#9ec9ff')
    .atmosphereAltitude(0.18)
    .pointsData(monuments)
    .pointLat('lat').pointLng('lng')
    .pointColor(() => '#19D58C')
    .pointAltitude(0.01)
    .pointRadius(opts.pointRadius || 0.28)
    .pointsMerge(false)
    .pointLabel(d => `<div class="g-tip"><b>${d.name}</b><span>${d.country}</span></div>`);

  if (opts.onPin) g.onPointClick(opts.onPin);

  const c = g.controls();
  c.autoRotate = opts.autoRotate !== false;
  c.autoRotateSpeed = opts.autoRotateSpeed || 0.5;
  c.enablePan = false;
  c.minDistance = 140;
  c.maxDistance = 1400;
  c.zoomSpeed = 1.1;
  if (opts.interactive === false) { c.enableZoom = false; c.enableRotate = false; }
  if (opts.zoom === false) c.enableZoom = false;
  if (opts.altitude) g.pointOfView({ lat: 18, lng: 8, altitude: opts.altitude });

  // stop auto-rotate on interaction
  el.addEventListener('pointerdown', () => { c.autoRotate = false; }, { passive: true });

  function size() {
    g.width(el.clientWidth).height(el.clientHeight);
  }
  window.addEventListener('resize', size);
  size();
  return g;
}
