import assert from "node:assert/strict";
import {
  isShareablePagePath,
  markdownPathForPage,
  pagePathFromMarkdownSegments,
} from "../src/lib/markdown-url";
import { htmlPageToMarkdown } from "../src/lib/page-markdown";

assert.equal(markdownPathForPage("/"), "/md/index.md");
assert.equal(markdownPathForPage("/watchlists"), "/md/watchlists.md");
assert.equal(markdownPathForPage("/stock/NVDA"), "/md/stock/NVDA.md");
assert.equal(markdownPathForPage("/watchlists/"), "/md/watchlists.md");
assert.equal(markdownPathForPage("/api/orders"), null);
assert.equal(isShareablePagePath("/stock/BRK.B"), true);
assert.equal(isShareablePagePath("/stock/bad/path"), false);
assert.equal(pagePathFromMarkdownSegments(["index.md"]), "/");
assert.equal(pagePathFromMarkdownSegments(["stock", "NVDA.md"]), "/stock/NVDA");
assert.equal(pagePathFromMarkdownSegments(["api", "orders.md"]), null);
assert.equal(pagePathFromMarkdownSegments(["watchlists"]), null);

const html = `<!doctype html>
<html><head><title>Example — Option Harvester</title></head><body>
<header>Global navigation must not appear</header>
<div id="page-content">
  <main>
    <h1>Example</h1>
    <p>Live <strong>account</strong> data.</p>
    <a href="/stock/NVDA">NVDA</a>
    <table><thead><tr><th>Ticker</th><th>Price</th></tr></thead>
      <tbody><tr><td>NVDA</td><td>$180</td></tr></tbody></table>
    <svg><text>chart internals</text></svg>
    <script>secretHydrationPayload()</script>
  </main>
</div></body></html>`;

const result = htmlPageToMarkdown(
  html,
  new URL("http://example.test/watchlists?list=hivs"),
  new Date("2026-07-21T00:00:00.000Z"),
);
assert.equal(result.title, "Example — Option Harvester");
assert.match(result.markdown, /^---\ntitle:/);
assert.match(result.markdown, /source: "http:\/\/example\.test\/watchlists\?list=hivs"/);
assert.match(result.markdown, /# Example/);
assert.match(result.markdown, /Live \*\*account\*\* data\./);
assert.match(result.markdown, /\[NVDA\]\(http:\/\/example\.test\/stock\/NVDA\)/);
assert.match(result.markdown, /\| Ticker \| Price \|/);
assert.match(result.markdown, /\| NVDA \| \$180 \|/);
assert.doesNotMatch(result.markdown, /Global navigation/);
assert.doesNotMatch(result.markdown, /secretHydrationPayload|chart internals/);

console.log("page markdown self-check OK");
