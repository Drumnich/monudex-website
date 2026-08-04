(function () {
  const list = document.querySelector('[data-credits-list]');
  const status = document.querySelector('[data-credits-status]');
  const search = document.querySelector('[data-credits-search]');
  if (!list || !status || !search) return;

  const sourcePage = (photo) => {
    try {
      const parts = new URL(photo).pathname.split('/').filter(Boolean);
      const thumb = parts.indexOf('thumb');
      const encodedName = thumb >= 0 ? parts[thumb + 3] : parts[parts.length - 1];
      return `https://commons.wikimedia.org/wiki/File:${encodedName}`;
    } catch (_error) {
      return photo;
    }
  };

  let monuments = [];
  const render = () => {
    const query = search.value.trim().toLowerCase();
    const shown = monuments.filter((item) => `${item.name} ${item.country}`.toLowerCase().includes(query));
    list.replaceChildren(...shown.map((item) => {
      const row = document.createElement('article');
      const copy = document.createElement('div');
      const title = document.createElement('strong');
      const country = document.createElement('span');
      const link = document.createElement('a');
      title.textContent = item.name;
      country.textContent = item.country;
      link.href = sourcePage(item.photo);
      link.target = '_blank';
      link.rel = 'noreferrer';
      link.textContent = 'View source and license';
      copy.append(title, country);
      row.append(copy, link);
      return row;
    }));
    status.textContent = `${shown.length} of ${monuments.length} image sources`;
  };

  fetch('data/monuments.json')
    .then((response) => {
      if (!response.ok) throw new Error('Unable to load credits');
      return response.json();
    })
    .then((data) => {
      monuments = data.filter((item) => item.photo);
      render();
    })
    .catch(() => {
      status.textContent = 'Image credits are temporarily unavailable. Please contact support@monudex.com.';
    });
  search.addEventListener('input', render);
})();
