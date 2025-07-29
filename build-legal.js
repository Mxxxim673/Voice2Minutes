// build-legal.js
import fs from "node:fs";
import MarkdownIt from "markdown-it";

const md = new MarkdownIt({ html: true, linkify: true });
const src = fs.readFileSync("legal.md", "utf8");
const html = md.render(src);
const out = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Voice2Minutes - 利用規約・プライバシーポリシー</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; }
    table { border-collapse: collapse; width: 100%; margin: 20px 0; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #f5f5f5; }
    h1, h2, h3 { color: #333; }
  </style>
</head>
<body>
  <section id="legal">
    ${html}
  </section>
</body>
</html>`;

fs.mkdirSync("dist", { recursive: true });
fs.writeFileSync("dist/legal.html", out);
console.log("✅ legal.html generated");