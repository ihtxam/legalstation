/**
 * Builds a search-index.json for the help center — one per language directory.
 * English pages live in docs-site/, translations in docs-site/{fr,de,it,ar}/.
 * Each h2[id] section becomes one searchable entry (page, title, url, text).
 *
 *   node scripts/build-docs-index.mjs
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const DOCS = join(dirname(fileURLToPath(import.meta.url)), "..", "docs-site");
const LANG_DIRS = ["", "fr", "de", "it", "ar"];

function textOf(html) {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

for (const lang of LANG_DIRS) {
  const dir = lang ? join(DOCS, lang) : DOCS;
  if (!existsSync(dir)) continue;

  const entries = [];
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".html")).sort()) {
    const html = readFileSync(join(dir, file), "utf8");
    const pageTitle = textOf((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || file.replace(".html", ""));

    // Page-level entry (intro paragraph before the first h2)
    const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/);
    const article = articleMatch ? articleMatch[1] : html;
    const firstH2 = article.search(/<h2/);
    const intro = textOf(firstH2 >= 0 ? article.slice(0, firstH2) : article).slice(0, 400);
    entries.push({ page: pageTitle, title: pageTitle, url: `./${file}`, text: intro });

    // Section entries
    const sections = [...article.matchAll(/<h2\s+id="([^"]+)"[^>]*>([\s\S]*?)<\/h2>([\s\S]*?)(?=<h2\s|$)/g)];
    for (const [, id, heading, body] of sections) {
      entries.push({
        page: pageTitle,
        title: textOf(heading),
        url: `./${file}#${id}`,
        text: textOf(body).slice(0, 600),
      });
    }
  }

  writeFileSync(join(dir, "search-index.json"), JSON.stringify(entries, null, 1) + "\n");
  console.log(`${lang || "en"}: search-index.json with ${entries.length} entries`);
}
