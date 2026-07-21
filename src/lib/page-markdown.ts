import * as cheerio from "cheerio";
import type { CheerioAPI } from "cheerio";
import type { AnyNode, Element } from "domhandler";

const SKIP_TAGS = new Set(["script", "style", "noscript", "template", "svg", "canvas"]);
const BLOCK_TAGS = new Set([
  "address", "article", "aside", "div", "fieldset", "figcaption", "figure", "footer", "form", "header",
  "main", "nav", "section",
]);

function cleanText(value: string): string {
  return value.replace(/\u00a0/g, " ").replace(/[\t\r\n ]+/g, " ");
}

function escapeInline(value: string): string {
  return value.replace(/([\\`*_[\]])/g, "\\$1");
}

function visibleText($: CheerioAPI, node: AnyNode): string {
  return cleanText($(node).text()).trim();
}

function absoluteHref(href: string, sourceUrl: URL): string {
  if (!href || href.startsWith("javascript:") || href.startsWith("data:")) return "";
  try {
    return new URL(href, sourceUrl).toString();
  } catch {
    return href;
  }
}

function markdownTable($: CheerioAPI, table: Element): string {
  const rowEls = $(table).find("tr").toArray();
  const rows = rowEls
    .map((row) =>
      $(row)
        .children("th, td")
        .toArray()
        .map((cell) => visibleText($, cell).replace(/\|/g, "\\|").replace(/\n/g, " ")),
    )
    .filter((row) => row.length > 0);
  if (!rows.length) return "";

  const width = Math.max(...rows.map((row) => row.length));
  const hasHeader = $(rowEls[0]).children("th").length > 0;
  const header = hasHeader ? rows[0] : Array.from({ length: width }, (_, i) => `Column ${i + 1}`);
  const body = hasHeader ? rows.slice(1) : rows;
  const pad = (row: string[]) => [...row, ...Array(Math.max(0, width - row.length)).fill("")].slice(0, width);
  const line = (row: string[]) => `| ${pad(row).join(" | ")} |`;

  return [line(header), line(Array(width).fill("---")), ...body.map(line)].join("\n");
}

function isHidden($: CheerioAPI, el: Element): boolean {
  const wrapped = $(el);
  const classes = new Set((wrapped.attr("class") ?? "").split(/\s+/));
  const style = (wrapped.attr("style") ?? "").replace(/\s+/g, "").toLowerCase();
  return (
    wrapped.attr("aria-hidden") === "true" ||
    wrapped.attr("hidden") !== undefined ||
    classes.has("hidden") ||
    classes.has("sr-only") ||
    style.includes("display:none") ||
    style.includes("visibility:hidden")
  );
}

function renderChildren($: CheerioAPI, children: AnyNode[], sourceUrl: URL): string {
  return children.map((child) => renderNode($, child, sourceUrl)).join("");
}

function renderList($: CheerioAPI, el: Element, sourceUrl: URL, ordered: boolean): string {
  const items = $(el).children("li").toArray();
  const lines = items.map((item, index) => {
    const content = renderChildren($, item.children, sourceUrl)
      .replace(/\n{2,}/g, "\n")
      .trim()
      .replace(/\n/g, "\n  ");
    return `${ordered ? `${index + 1}.` : "-"} ${content}`;
  });
  return `\n\n${lines.join("\n")}\n\n`;
}

function renderNode($: CheerioAPI, node: AnyNode, sourceUrl: URL): string {
  if (node.type === "text") return cleanText(node.data);
  if (node.type !== "tag") return "";

  const el = node as Element;
  const tag = el.name.toLowerCase();
  if (SKIP_TAGS.has(tag) || isHidden($, el)) return "";

  if (/^h[1-6]$/.test(tag)) {
    const level = Number(tag[1]);
    return `\n\n${"#".repeat(level)} ${renderChildren($, el.children, sourceUrl).trim()}\n\n`;
  }
  if (tag === "table") return `\n\n${markdownTable($, el)}\n\n`;
  if (tag === "ul") return renderList($, el, sourceUrl, false);
  if (tag === "ol") return renderList($, el, sourceUrl, true);
  if (tag === "br") return "\n";
  if (tag === "hr") return "\n\n---\n\n";
  if (tag === "p") return `\n\n${renderChildren($, el.children, sourceUrl).trim()}\n\n`;
  if (tag === "blockquote") {
    const value = renderChildren($, el.children, sourceUrl).trim().replace(/^/gm, "> ");
    return `\n\n${value}\n\n`;
  }
  if (tag === "pre") return `\n\n\`\`\`\n${$(el).text().trim()}\n\`\`\`\n\n`;
  if (tag === "code") return `\`${visibleText($, el).replace(/`/g, "\\`")}\``;
  if (tag === "strong" || tag === "b") return `**${renderChildren($, el.children, sourceUrl).trim()}**`;
  if (tag === "em" || tag === "i") return `*${renderChildren($, el.children, sourceUrl).trim()}*`;
  if (tag === "del" || tag === "s") return `~~${renderChildren($, el.children, sourceUrl).trim()}~~`;
  if (tag === "a") {
    const label = renderChildren($, el.children, sourceUrl).trim() || visibleText($, el);
    const href = absoluteHref($(el).attr("href") ?? "", sourceUrl);
    return href && label ? `[${label}](${href})` : label;
  }
  if (tag === "img") {
    const alt = escapeInline($(el).attr("alt") ?? "image");
    const src = absoluteHref($(el).attr("src") ?? "", sourceUrl);
    return src ? `![${alt}](${src})` : alt;
  }
  if (tag === "input") {
    const value = $(el).attr("value") ?? "";
    return value ? escapeInline(value) : "";
  }
  if (tag === "dt") return `\n\n**${renderChildren($, el.children, sourceUrl).trim()}**\n`;
  if (tag === "dd") return `${renderChildren($, el.children, sourceUrl).trim()}\n\n`;

  const content = renderChildren($, el.children, sourceUrl);
  return BLOCK_TAGS.has(tag) ? `\n${content}\n` : content;
}

function tidyMarkdown(markdown: string): string {
  const lines = markdown
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd());

  return lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^ +$/gm, "")
    .trim();
}

export type PageMarkdown = { title: string; markdown: string };

export function htmlPageToMarkdown(html: string, sourceUrl: URL, generatedAt = new Date()): PageMarkdown {
  const $ = cheerio.load(html);
  const title = cleanText($("title").first().text()).trim() || "Option Harvester";
  const root = $("#page-content").first();
  if (!root.length) throw new Error("Rendered page is missing #page-content");

  root.find("script, style, noscript, template, svg, canvas").remove();
  const body = tidyMarkdown(renderChildren($, root.get(0)!.children, sourceUrl));
  const frontMatter = [
    "---",
    `title: ${JSON.stringify(title)}`,
    `source: ${JSON.stringify(sourceUrl.toString())}`,
    `generated_at: ${JSON.stringify(generatedAt.toISOString())}`,
    "---",
  ].join("\n");
  const note = "> Read-only Markdown mirror of the live Option Harvester page. Data may change when this URL is fetched again.";

  return { title, markdown: `${frontMatter}\n\n${note}\n\n${body}\n` };
}
