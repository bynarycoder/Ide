# Project Handoff Notes

## Delivered

A mobile-first React + Tailwind IDE with:

- Monaco editor
- Undo / Redo controls
- File and folder creation
- Nested folders and files
- Upload support
- Drag-and-drop upload
- Snippet insertion and custom snippets
- Open tabs
- Dirty indicators
- Live preview
- Console panel
- Theme switcher
- PWA support
- Local persistence

## Main Entry Files

- `src/App.jsx`
- `src/main.jsx`
- `src/index.css`
- `src/pwa.js`

## Build Commands

```bash
npm install
npm run dev
npm run build
npm run preview
```

## Important Technical Note

The app shell is offline-friendly, but the preview iframe currently relies on CDN React/Babel scripts. For fully local first-load preview, a deeper local bundling/runtime strategy would be needed.

## Suggested Future Work

- True offline preview runtime
- ZIP import/export
- Tree drag-and-drop moving
- Better dependency emulation
- Share/export templates
- Deploy from inside the app
