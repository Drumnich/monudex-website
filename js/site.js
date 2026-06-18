// Shared site behaviour: scroll reveals, stat count-up, mobile nav,
// sticky-nav shadow, and the monument popup modal (window.showMonument).
(function () {
  // reveal on scroll
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach((el) => io.observe(el));

  // count-up numbers
  function countUp(el) {
    const target = +el.dataset.count, dur = 1100; let start = null;
    function step(ts) {
      if (!start) start = ts;
      const p = Math.min((ts - start) / dur, 1);
      el.textContent = Math.floor(p * target).toLocaleString();
      if (p < 1) requestAnimationFrame(step); else el.textContent = target.toLocaleString();
    }
    requestAnimationFrame(step);
  }
  const cio = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { countUp(e.target); cio.unobserve(e.target); } });
  }, { threshold: 0.5 });
  document.querySelectorAll('[data-count]').forEach((el) => cio.observe(el));

  // mobile nav
  const toggle = document.querySelector('.nav-toggle');
  if (toggle) toggle.addEventListener('click', () => {
    document.querySelector('.nav-links').classList.toggle('open');
  });

  // sticky nav shadow
  const nav = document.querySelector('.nav');
  if (nav) {
    const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
  }

  // ===== monument popup modal =====
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML =
    '<div class="modal-card">' +
      '<div class="modal-img"><button class="modal-x" aria-label="Close">✕</button></div>' +
      '<div class="modal-body">' +
        '<div class="modal-cat"></div><div class="modal-name"></div><div class="modal-loc"></div>' +
        '<p class="modal-desc"></p>' +
        '<a class="btn btn-accent" href="explore.html">Explore on the globe →</a>' +
      '</div>' +
    '</div>';
  document.body.appendChild(modal);
  const close = () => modal.classList.remove('open');
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
  modal.querySelector('.modal-x').addEventListener('click', close);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

  // FAQ accordion (single-open)
  document.querySelectorAll('.faq-q').forEach((btn) => btn.addEventListener('click', () => {
    const item = btn.closest('.faq-item');
    const isOpen = item.classList.contains('open');
    item.parentElement.querySelectorAll('.faq-item.open').forEach((i) => {
      i.classList.remove('open'); i.querySelector('.faq-a').style.maxHeight = null;
    });
    if (!isOpen) { item.classList.add('open'); const a = item.querySelector('.faq-a'); a.style.maxHeight = a.scrollHeight + 'px'; }
  }));

  window.showMonument = function (m) {
    if (!m) return;
    modal.querySelector('.modal-img').style.backgroundImage = `url('${m.photo}')`;
    modal.querySelector('.modal-cat').textContent = m.category || 'Landmark';
    modal.querySelector('.modal-name').textContent = m.name;
    modal.querySelector('.modal-loc').textContent = '📍 ' + m.country;
    modal.querySelector('.modal-desc').textContent =
      `${m.name} is a ${(m.category || 'landmark').toLowerCase()} in ${m.country} — one of 585 monuments to discover, visit, and collect in MonuDex.`;
    modal.classList.add('open');
  };
})();
