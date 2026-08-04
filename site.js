(() => {
  const header = document.querySelector("[data-header]");
  const menuButton = document.querySelector("[data-menu-button]");
  const nav = document.querySelector("[data-nav]");

  function refreshIcons(root = document) {
    if (!window.lucide) return;
    window.lucide.createIcons({
      attrs: { "stroke-width": 2 },
      root,
    });
  }

  function setMenu(open) {
    if (!header || !menuButton) return;
    header.classList.toggle("menu-active", open);
    document.body.classList.toggle("menu-open", open);
    menuButton.setAttribute("aria-expanded", String(open));
    menuButton.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
    menuButton.replaceChildren();
    const icon = document.createElement("i");
    icon.dataset.lucide = open ? "x" : "menu";
    icon.setAttribute("aria-hidden", "true");
    menuButton.append(icon);
    refreshIcons(menuButton);
  }

  function updateHeader() {
    if (header) header.classList.toggle("is-scrolled", window.scrollY > 36);
  }

  window.MonuDexSite = { refreshIcons, setMenu };
  refreshIcons();
  updateHeader();

  window.addEventListener("scroll", updateHeader, { passive: true });
  menuButton?.addEventListener("click", () => setMenu(menuButton.getAttribute("aria-expanded") !== "true"));
  nav?.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => setMenu(false)));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && header?.classList.contains("menu-active")) setMenu(false);
  });
})();
