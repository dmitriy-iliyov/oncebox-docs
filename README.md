# oncebox-docs

Documentation site for [oncebox](https://github.com/dmitriy-iliyov/oncebox), a transactional outbox and inbox for
Spring Boot. Built with [Docusaurus](https://docusaurus.io/) and published to GitHub Pages at
https://dmitriy-iliyov.github.io/oncebox-docs/.

## Local development

Requires Node.js 18 or newer.

```bash
npm ci
npm start        # dev server with live reload at http://localhost:3000/oncebox-docs/
npm run build    # production build into build/, fails on broken links and anchors
npm run serve    # serve the production build locally
```

## Layout

| Path                     | Contents                                              |
|--------------------------|-------------------------------------------------------|
| `docs/`                  | Pages: introduction, quickstart, reference, examples  |
| `docs/reference/`        | Reference: one page per topic                         |
| `src/pages/index.js`     | Landing page                                          |
| `static/img/`            | Images                                                |
| `sidebars.js`            | Sidebar order                                         |
| `docusaurus.config.js`   | Site configuration                                    |

## Deployment

`.github/workflows/deploy.yml` builds every pull request and deploys `main` to GitHub Pages. In the repository
settings, set Pages > Source to **GitHub Actions** once.

## Keeping it in sync

The pages describe the library's code. When a change in oncebox is visible to users - a property, a default, a
behaviour - update the matching page here in the same release.
