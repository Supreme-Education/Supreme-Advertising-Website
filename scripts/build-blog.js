/**
 * Generates static blog listing and post pages from data/blog-posts.json.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const dataPath = path.join(root, "data", "blog-posts.json");
const blogDir = path.join(root, "blog");
const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function siteHeader({ activeBlog = false, depth = 1 }) {
  const p = depth === 1 ? "../" : "";
  const blogHref = depth === 1 ? "index.html" : "../blog/index.html";
  const blogClass = activeBlog ? ' aria-current="page"' : "";
  return `<header class="site-header" id="top">
    <div class="container header-inner">
      <a href="${p}index.html" class="brand" aria-label="Supreme Advertising home">
        <span class="brand-logo-wrap">
          <img
            src="${p}assets/images/logo-supreme.png?v=2"
            alt=""
            class="brand-logo"
            width="96"
            height="96"
            decoding="async"
          />
        </span>
        <img
          src="${p}assets/images/brand-wordmark.png?v=1"
          alt="Supreme Advertising"
          class="brand-wordmark"
          width="280"
          height="72"
          decoding="async"
        />
      </a>
      <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="site-nav" aria-label="Open menu">
        <span></span><span></span><span></span>
      </button>
      <nav class="site-nav" id="site-nav">
        <a href="${p}index.html#about">About</a>
        <a href="${p}index.html#services">Services</a>
        <a href="${blogHref}"${blogClass}>Blog</a>
        <a href="${p}index.html#contact">Contact</a>
      </nav>
    </div>
  </header>`;
}

function siteFooter(depth = 1) {
  const p = depth === 1 ? "../" : "";
  return `<footer class="site-footer">
    <div class="container footer-inner">
      <p>&copy; <span id="year"></span> Supreme Advertising. All rights reserved.</p>
      <nav class="footer-links" aria-label="Footer links">
        <a href="${p}blog/index.html">Blog</a>
        <a href="${p}admin">Resources</a>
      </nav>
    </div>
  </footer>
  <script src="${p}js/main.js"></script>`;
}

function headMeta({ title, description, depth = 1 }) {
  const p = depth === 1 ? "../" : "";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="description" content="${escapeHtml(description)}" />
  <title>${escapeHtml(title)} | Supreme Advertising</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=Outfit:wght@600;700;800&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="${p}css/styles.css" />
  <link rel="icon" href="${p}assets/images/logo-supreme.png?v=2" type="image/png" />
</head>
<body>`;
}

function buildIndex() {
  const cards = data.posts
    .map(
      (post) => `<article class="blog-card">
          <a class="blog-card-link" href="${post.slug}.html">
            <div class="blog-card-media">
              <img src="../${post.image}" alt="${escapeHtml(post.imageAlt)}" loading="lazy" width="640" height="400" />
            </div>
            <div class="blog-card-body">
              <p class="blog-card-category">${escapeHtml(post.category)}</p>
              <h2>${escapeHtml(post.title)}</h2>
              <p>${escapeHtml(post.excerpt)}</p>
              <span class="blog-card-cta">Read article</span>
            </div>
          </a>
        </article>`
    )
    .join("\n        ");

  const html = `${headMeta({
    title: "Blog",
    description: data.intro.description,
    depth: 1,
  })}
  ${siteHeader({ activeBlog: true, depth: 1 })}
  <main>
    <section class="blog-page-hero section">
      <div class="container">
        <p class="section-label">Blog</p>
        <h1>${escapeHtml(data.intro.title)}</h1>
        <p class="blog-page-lead">${escapeHtml(data.intro.description)}</p>
      </div>
    </section>
    <section class="section blog-list-section">
      <div class="container">
        <div class="blog-grid">
        ${cards}
        </div>
      </div>
    </section>
  </main>
  ${siteFooter(1)}
</body>
</html>
`;

  fs.mkdirSync(blogDir, { recursive: true });
  fs.writeFileSync(path.join(blogDir, "index.html"), html, "utf8");
}

function buildPost(post) {
  const paragraphs = post.paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join("\n          ");
  const bullets = post.bullets
    ? `<h2>What we offer</h2>
          <ul class="blog-article-list">
            ${post.bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join("\n            ")}
          </ul>`
    : "";

  const html = `${headMeta({
    title: post.title,
    description: post.excerpt,
    depth: 1,
  })}
  ${siteHeader({ activeBlog: false, depth: 1 })}
  <main>
    <article class="section blog-article">
      <div class="container blog-article-inner">
        <p class="blog-back"><a href="index.html">&larr; All articles</a></p>
        <header class="blog-article-header">
          <p class="section-label">${escapeHtml(post.category)}</p>
          <h1>${escapeHtml(post.title)}</h1>
          <p class="blog-meta">Supreme Advertising · Ragama, Sri Lanka</p>
        </header>
        <figure class="blog-article-hero">
          <img src="../${post.image}" alt="${escapeHtml(post.imageAlt)}" width="1120" height="630" decoding="async" />
        </figure>
        <div class="blog-prose">
          ${paragraphs}
          ${bullets}
          <p>
            See examples on our
            <a href="../index.html#${post.serviceAnchor}">${escapeHtml(post.title.split(":")[0])} gallery</a>
            or
            <a href="../index.html#contact">request a quote</a>
            for your project.
          </p>
        </div>
        <div class="blog-article-actions">
          <a href="../index.html#contact" class="btn btn-primary">Get a quote</a>
          <a href="../index.html#${post.serviceAnchor}" class="btn btn-ghost">View service gallery</a>
        </div>
      </div>
    </article>
  </main>
  ${siteFooter(1)}
</body>
</html>
`;

  fs.writeFileSync(path.join(blogDir, `${post.slug}.html`), html, "utf8");
}

buildIndex();
for (const post of data.posts) {
  buildPost(post);
}
console.log(`Blog: wrote index + ${data.posts.length} posts to blog/`);
