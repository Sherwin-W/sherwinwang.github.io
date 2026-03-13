# sherwinwang.github.io

Personal portfolio site for [Sherwin Wang](https://sherwinwang.dev) — Machine Learning Engineer.

Live at **[sherwinwang.dev](https://sherwinwang.dev)**

## Stack

Plain HTML, CSS, and vanilla JavaScript. No build step, no framework, no dependencies.

## Structure

```
.
├── index.html                        # Home page
├── projects.html                     # Projects gallery
├── 404.html                          # 404 error page
├── CNAME                             # Custom domain: sherwinwang.dev
│
├── assets/
│   ├── css/styles.css                # Single stylesheet (14 sections)
│   ├── js/main.js                    # Nav toggle + active link (~50 lines)
│   └── images/                       # Static images
│
└── projects/
    ├── llm-inference-engine.html     # LLM inference project detail
    └── ml-projects.html              # ML experiments detail
```

## Deployment

Served via GitHub Pages from the `main` branch, root `/`.

**GitHub Pages settings:** Settings → Pages → Source: Deploy from branch → Branch: `main` / `/ (root)`

## Adding a new project

1. Create `projects/your-project.html` using an existing project page as a template.
2. Add a card to `projects.html` following the `<!-- ADD NEW PROJECT CARDS HERE -->` comment.
