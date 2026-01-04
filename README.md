# Cover Flow

This project was converted to use SCSS for component styles.

Quick setup

1. Install dev dependencies (adds `sass` for `.scss` support):

```bash
npm install
```

2. If you don't already have `sass`, it's added as a devDependency in `package.json`.
   Vite will compile `.scss` imports automatically when `sass` is installed.

Notes

- Main style files:
  - `src/styles.scss` — layout and coverflow styles (converted from `styles.css`).
  - `src/index.scss` — global base styles (converted from `index.css`).

- `src/styles.css` has been replaced with a deprecation note to avoid confusion.
  You can safely remove the file once your environment is confirmed working.

- If you want variables/mixins in SCSS, I can refactor `styles.scss` to use SCSS variables (e.g. `$cover-size`) and a small set of utility mixins.

If you'd like, I can:
- Remove the deprecated `src/styles.css` entirely,
- Refactor `styles.scss` to use SCSS variables and mixins,
- Run `npm install` for you (I can't run network installs without permission).
