import fs from "node:fs/promises";

const cataloguePath = new URL("../data/monuments.json", import.meta.url);
const monuments = JSON.parse(await fs.readFile(cataloguePath, "utf8"));
const apply = process.argv.includes("--apply");
const includeWeak = process.argv.includes("--include-weak");
const reviewedExceptions = new Set(["sierra-leone-cotton-tree-freetown"]);

const stopWords = new Set([
  "about", "ancient", "archaeological", "building", "center", "centre", "city", "cultural",
  "historic", "historical", "landmark", "memorial", "monument", "museum", "national", "park",
  "place", "site", "square", "the", "and", "from", "with", "of", "in", "at", "de", "del",
  "du", "la", "le", "el", "al", "old", "great", "saint", "st",
]);
const rejectedImageTerms = [
  "flag", "coat of arms", "coat_of_arms", "emblem", "logo", "locator map", "location map",
  "political map", "satellite", "portrait", "manuscript", ".pdf", ".svg", "blank", "placeholder",
  "diocese gitega", "fifa world cup", "hotel de federaciones", "kutchprant",
  "mandeville courthouse", "middleburg bertius", "mq 9 reaper", "samuel coleridge taylor",
  "lossy page", "h c fassett ellice", "visite du musee de civilisation", "kona",
];

function normalize(value = "") {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function tokens(value = "") {
  return new Set(normalize(value).split(/\s+/).filter((token) => token.length > 2 && !stopWords.has(token)));
}

function imageLabel(url = "") {
  try { return decodeURIComponent(new URL(url).pathname.split("/").pop() || ""); }
  catch { return url; }
}

function rejectedImage(value = "") {
  const normalized = normalize(value);
  const words = new Set(normalized.split(/\s+/));
  return words.has("map") || rejectedImageTerms.some((term) => normalized.includes(normalize(term)));
}

function overlapScore(monument, value) {
  const expected = tokens(monument.name);
  const candidate = tokens(value);
  if (!expected.size) return 0;
  const overlap = [...expected].filter((token) => candidate.has(token)).length;
  return overlap / expected.size;
}

function reasonsFor(monument) {
  const label = imageLabel(monument.photo);
  const reasons = [];
  if (!monument.photo) reasons.push("missing");
  if (!reviewedExceptions.has(monument.id) && rejectedImage(label)) reasons.push("generic-or-nonphotographic");
  if (overlapScore(monument, label) === 0) reasons.push("weak-filename-match");
  return reasons;
}

async function api(host, params) {
  const url = new URL(`https://${host}/w/api.php`);
  url.search = new URLSearchParams({ action: "query", format: "json", origin: "*", ...params });
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await fetch(url, { headers: { "user-agent": "MonuDex image audit/1.0 (hello@monudex.app)" } });
    if (response.ok) return response.json();
    if (response.status !== 429 && response.status < 500) throw new Error(`${host} returned ${response.status}`);
    const retryAfter = Number(response.headers.get("retry-after")) || attempt + 1;
    await new Promise((resolve) => setTimeout(resolve, retryAfter * 700));
  }
  throw new Error(`${host} remained unavailable after retries`);
}

function bestWikipediaCandidate(monument, pages) {
  return pages
    .filter((page) => page.thumbnail?.source && !rejectedImage(`${page.title} ${imageLabel(page.thumbnail.source)}`))
    .map((page, index) => {
      const titleScore = overlapScore(monument, page.title);
      const imageScore = overlapScore(monument, imageLabel(page.thumbnail.source));
      const exactBonus = normalize(page.title) === normalize(monument.name) ? 1 : 0;
      return {
        source: "wikipedia",
        pageTitle: page.title,
        pageUrl: page.fullurl,
        photo: page.thumbnail.source,
        score: exactBonus * 100 + titleScore * 70 + imageScore * 25 - index,
      };
    })
    .sort((a, b) => b.score - a.score)[0];
}

function bestCommonsCandidate(monument, pages) {
  return pages
    .map((page, index) => {
      const info = page.imageinfo?.[0];
      return info ? {
        source: "commons",
        pageTitle: page.title,
        pageUrl: info.descriptionurl,
        photo: info.thumburl || info.url,
        score: overlapScore(monument, page.title) * 100 - index,
      } : null;
    })
    .filter((candidate) => candidate && !rejectedImage(`${candidate.pageTitle} ${imageLabel(candidate.photo)}`))
    .sort((a, b) => b.score - a.score)[0];
}

async function findCandidate(monument) {
  const query = `"${monument.name}" ${monument.country}`;
  const wikipedia = await api("en.wikipedia.org", {
    generator: "search",
    gsrsearch: query,
    gsrnamespace: "0",
    gsrlimit: "5",
    prop: "pageimages|info",
    piprop: "thumbnail",
    pithumbsize: "1280",
    inprop: "url",
  });
  const wikiCandidate = bestWikipediaCandidate(monument, Object.values(wikipedia.query?.pages || {}));
  if (wikiCandidate?.score >= 45) return wikiCandidate;

  const commons = await api("commons.wikimedia.org", {
    generator: "search",
    gsrsearch: query,
    gsrnamespace: "6",
    gsrlimit: "8",
    prop: "imageinfo",
    iiprop: "url",
    iiurlwidth: "1280",
  });
  const commonsCandidate = bestCommonsCandidate(monument, Object.values(commons.query?.pages || {}));
  return commonsCandidate?.score >= 25 ? commonsCandidate : wikiCandidate || commonsCandidate;
}

const targets = monuments.filter((monument) => {
  const reasons = reasonsFor(monument);
  return reasons.includes("generic-or-nonphotographic") || reasons.includes("missing") || (includeWeak && reasons.includes("weak-filename-match"));
});
const results = [];
let cursor = 0;

async function worker() {
  while (cursor < targets.length) {
    const monument = targets[cursor++];
    const reasons = reasonsFor(monument);
    try {
      const candidate = await findCandidate(monument);
      results.push({ id: monument.id, name: monument.name, country: monument.country, reasons, current: monument.photo, candidate });
    } catch (error) {
      results.push({ id: monument.id, name: monument.name, country: monument.country, reasons, current: monument.photo, error: String(error) });
    }
  }
}

await worker();
results.sort((a, b) => a.country.localeCompare(b.country) || a.name.localeCompare(b.name));

if (apply) {
  const replacements = new Map(results.filter((result) => result.candidate?.photo).map((result) => [result.id, result.candidate.photo]));
  const updated = monuments.map((monument) => replacements.has(monument.id) ? { ...monument, photo: replacements.get(monument.id) } : monument);
  await fs.writeFile(cataloguePath, `${JSON.stringify(updated, null, 2)}\n`);
}

process.stdout.write(`${JSON.stringify({ checked: monuments.length, targets: targets.length, applied: apply, results }, null, 2)}\n`);
