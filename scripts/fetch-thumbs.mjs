// Downloads every thumbnail still hosted on Squarespace into img/ and points
// data/videos.json at the local copy. Run once before cancelling Squarespace:
//   node scripts/fetch-thumbs.mjs
import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const dataPath = path.join(root, "data/videos.json");
const data = JSON.parse(await readFile(dataPath, "utf8"));
await mkdir(path.join(root, "img"), { recursive: true });

let fetched = 0, kept = 0;
for (const page of data.pages) for (const s of page.sections || []) for (const v of s.items) {
  if (!v.thumb || !v.thumb.includes("squarespace-cdn.com")) { kept++; continue; }
  const id = v.thumb.split("/").at(-2).split("-")[0];
  const ext = path.extname(new URL(v.thumb).pathname) || ".jpg";
  const rel = `img/${id}${ext}`;
  try { await access(path.join(root, rel)); }
  catch {
    const res = await fetch(v.thumb + "?format=1000w");
    if (!res.ok) { console.warn("skip", res.status, v.title); continue; }
    await writeFile(path.join(root, rel), Buffer.from(await res.arrayBuffer()));
  }
  v.thumb = rel;
  fetched++;
}
await writeFile(dataPath, JSON.stringify(data, null, 2) + "\n");
console.log(`${fetched} thumbnails saved to img/, ${kept} left as-is`);
