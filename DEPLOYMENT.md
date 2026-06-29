# Deployment Guide

## Build

```bash
npm install
npm run build
```

The production-ready files will be created in:

```txt
dist/
```

## Vercel

1. Push the project to GitHub
2. Import the repo into Vercel
3. Framework preset: `Vite`
4. Build command:

```bash
npm run build
```

5. Output directory:

```txt
dist
```

## Netlify

1. Push the project to GitHub
2. Import into Netlify
3. Build command:

```bash
npm run build
```

4. Publish directory:

```txt
dist
```

## Cloudflare Pages

1. Connect the repository
2. Framework preset: `Vite`
3. Build command:

```bash
npm run build
```

4. Build output directory:

```txt
dist
```

## Static Hosting

Any static hosting service can host the `dist/` directory.

## Notes

- The app shell is static-host friendly.
- PWA files are already included.
- Preview runtime uses CDN React/Babel inside the iframe, so internet may still be required for first preview runtime load unless those assets are cached.
