import fs from "node:fs/promises";

const cataloguePath = new URL("../data/monuments.json", import.meta.url);
const monuments = JSON.parse(await fs.readFile(cataloguePath, "utf8"));
const results = new Map();

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const normalizeTitle = (value) => value.replace(/^File:/i, "").replaceAll("_", " ").normalize("NFC").toLocaleLowerCase();

function wikimediaFile(monument) {
  const url = new URL(monument.photo);
  if (url.hostname !== "upload.wikimedia.org") return null;
  const parts = url.pathname.split("/").map((part) => decodeURIComponent(part));
  const wikipediaIndex = parts.indexOf("wikipedia");
  const project = parts[wikipediaIndex + 1];
  const isThumbnail = parts[wikipediaIndex + 2] === "thumb";
  const filename = parts[wikipediaIndex + (isThumbnail ? 5 : 4)];
  if (!filename || !["commons", "en"].includes(project)) return null;
  return {
    apiHost: project === "commons" ? "commons.wikimedia.org" : "en.wikipedia.org",
    filename,
  };
}

async function fetchJson(url) {
  let lastError;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const response = await fetch(url, {
      headers: { "user-agent": "MonuDex catalogue image check/1.0 (hello@monudex.app)" },
      signal: AbortSignal.timeout(20_000),
    });
    if (response.ok) return response.json();
    lastError = `${response.status} ${response.statusText}`;
    if (response.status !== 429 && response.status < 500) break;
    await sleep((attempt + 1) * 800);
  }
  throw new Error(lastError || "Metadata request failed");
}

const wikimediaGroups = new Map();
const external = [];
for (const monument of monuments) {
  const file = wikimediaFile(monument);
  if (!file) {
    external.push(monument);
    continue;
  }
  const group = wikimediaGroups.get(file.apiHost) || new Map();
  const key = normalizeTitle(file.filename);
  const entry = group.get(key) || { filename: file.filename, monuments: [] };
  entry.monuments.push(monument);
  group.set(key, entry);
  wikimediaGroups.set(file.apiHost, group);
}

for (const [apiHost, files] of wikimediaGroups) {
  const entries = [...files.values()];
  for (let start = 0; start < entries.length; start += 40) {
    const batch = entries.slice(start, start + 40);
    const url = new URL(`https://${apiHost}/w/api.php`);
    url.search = new URLSearchParams({
      action: "query",
      format: "json",
      prop: "imageinfo",
      iiprop: "mime|size",
      titles: batch.map((entry) => `File:${entry.filename}`).join("|"),
    });
    try {
      const payload = await fetchJson(url);
      const pages = new Map(Object.values(payload.query?.pages || {}).map((page) => [normalizeTitle(page.title || ""), page]));
      for (const entry of batch) {
        const page = pages.get(normalizeTitle(entry.filename));
        const info = page?.imageinfo?.[0];
        const ok = Boolean(info?.mime?.startsWith("image/") && info.width > 0 && info.height > 0);
        for (const monument of entry.monuments) {
          results.set(monument.id, ok
            ? { id: monument.id, ok: true, method: "wikimedia-metadata", mime: info.mime, width: info.width, height: info.height }
            : { id: monument.id, ok: false, photo: monument.photo, error: page?.missing !== undefined ? "Wikimedia file is missing" : "Wikimedia file has no image metadata" });
        }
      }
    } catch (error) {
      for (const entry of batch) {
        for (const monument of entry.monuments) {
          results.set(monument.id, { id: monument.id, ok: false, photo: monument.photo, error: error instanceof Error ? error.message : String(error) });
        }
      }
    }
    await sleep(120);
  }
}

for (const monument of external) {
  try {
    const response = await fetch(monument.photo, {
      redirect: "follow",
      headers: { range: "bytes=0-0", "user-agent": "MonuDex catalogue image check/1.0 (hello@monudex.app)" },
      signal: AbortSignal.timeout(20_000),
    });
    const contentType = response.headers.get("content-type") || "";
    await response.body?.cancel();
    const ok = response.ok && contentType.startsWith("image/");
    results.set(monument.id, ok
      ? { id: monument.id, ok: true, method: "http", mime: contentType }
      : { id: monument.id, ok: false, photo: monument.photo, error: `${response.status} ${contentType || "unknown content type"}` });
  } catch (error) {
    results.set(monument.id, { id: monument.id, ok: false, photo: monument.photo, error: error instanceof Error ? error.message : String(error) });
  }
}

const ordered = monuments.map((monument) => results.get(monument.id) || ({ id: monument.id, ok: false, photo: monument.photo, error: "Image was not checked" }));
const failed = ordered.filter((result) => !result.ok);
process.stdout.write(`${JSON.stringify({ checked: ordered.length, passed: ordered.length - failed.length, failed }, null, 2)}\n`);
process.exitCode = failed.length ? 1 : 0;
