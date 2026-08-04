(() => {
  const historyCache = new Map();
  let monumentPromise;

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

  function compactHistory(text, limit = 720) {
    const clean = String(text || "").replace(/\s+/g, " ").trim();
    if (clean.length <= limit) return clean;
    const shortened = clean.slice(0, limit);
    const end = Math.max(shortened.lastIndexOf(". "), shortened.lastIndexOf("; "));
    return `${shortened.slice(0, end > limit * 0.6 ? end + 1 : limit).trim()}...`;
  }

  function wikipediaSearchUrl(monument) {
    return `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(`${monument.name} ${monument.country}`)}`;
  }

  async function loadMonuments() {
    if (!monumentPromise) {
      monumentPromise = fetch("data/monuments.json")
        .then((response) => {
          if (!response.ok) throw new Error(`Catalogue request failed with ${response.status}`);
          return response.json();
        })
        .then((items) => {
          if (!Array.isArray(items)) throw new Error("Catalogue is not an array");
          return items.filter((item) => item && item.id && item.name && item.country && Number.isFinite(item.lat) && Number.isFinite(item.lng));
        });
    }
    return monumentPromise;
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

  window.MonuDexData = {
    categoryKey,
    categoryLabel,
    searchableText,
    loadMonuments,
    fetchHistory,
  };
})();
