# H-T-FOOTPRINT

A static single-page memory timeline for **Howie & Tata FOOTPRINT**.

## What is this?

This project is a plain HTML website. The main page is:

```text
index.html
```

You do not need to install a frontend framework to preview it.

## Preview option 1: GitHub Pages, recommended for Codex web users

Use this option if you are using Codex in the browser and cannot see a **Preview** or **Ports** panel.

### Step 1: Merge this PR

After this branch is merged into `main`, GitHub Actions will deploy the site automatically.

Important: because the GitHub Pages workflow is added by this PR, you may not see **Deploy static site to GitHub Pages** in the GitHub **Actions** page before the PR is merged. That is expected. GitHub only lists and runs repository workflows after the workflow file exists on the default branch, such as `main`.

### Step 2: Open the GitHub Pages URL

Go to your GitHub repository page, then open:

```text
Settings → Pages
```

GitHub will show a live website URL after the deployment finishes.

The URL usually looks like one of these:

```text
https://YOUR_USERNAME.github.io/H-T-FOOTPRINT/
```

or, for an organization repository:

```text
https://YOUR_ORG.github.io/H-T-FOOTPRINT/
```

### Step 3: If GitHub asks for a source

Choose:

```text
GitHub Actions
```

This repository includes a GitHub Actions workflow at:

```text
.github/workflows/pages.yml
```

## Preview option 2: local preview on your computer

Use this option if you have downloaded the project to your own computer.

### Step 1: Open a terminal in the project folder

```bash
cd H-T-FOOTPRINT
```

### Step 2: Start a local server

```bash
python3 -m http.server 4173
```

### Step 3: Open the page in your browser

```text
http://localhost:4173
```

If port `4173` is already in use, try another port:

```bash
python3 -m http.server 8080
```

Then open:

```text
http://localhost:8080
```

## Deploy

This repository is ready for any static host. Use the repository root as the publish directory and `index.html` as the entry point.
