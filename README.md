# Final Mobile React + Tailwind IDE

A mobile-first React + Tailwind CSS IDE built with Vite, Monaco Editor, offline-friendly persistence, snippets, nested file management, and live preview.

## Overview

This project is a polished in-browser mobile IDE experience focused on:

- React editing
- Tailwind CSS editing
- Mobile usability
- Offline-friendly persistence
- Nested folders and files
- File uploads
- Snippet-driven productivity
- Live preview with error handling

## Core Features

### Editor
- Monaco editor integration
- Syntax-aware editing for JavaScript, JSX, CSS, HTML, and JSON
- Editor tabs for open files
- Dirty indicators per tab
- Manual and auto preview run controls

### File System UX
- Create files
- Create folders
- Create folders inside folders
- Create files inside folders
- Rename files and folders
- Delete files and folders
- Duplicate files
- Search files
- Collapsible folder tree
- Context menu actions
- Touch-friendly action menu

### Upload and Project Data
- Upload text files
- Drag-and-drop upload
- Import project from JSON
- Export project to JSON
- Recent project history
- Local persistence via `localStorage`

### Snippets
- Built-in React snippets
- Built-in Tailwind snippets
- Custom snippets
- Monaco autocomplete integration for snippets

### Preview
- Live preview panel
- Error-safe preview rendering
- Console output panel
- Auto-run toggle
- Manual run button
- Multi-file React import support for common local module patterns

### App Experience
- Mobile-friendly layout
- Theme switcher
- Resizable panes on larger screens
- PWA manifest and service worker

## Tech Stack

- React
- Tailwind CSS
- Vite
- Monaco Editor
- Local browser storage
- Service worker / PWA assets

## Project Structure

```txt
.
├── index.html
├── package.json
├── postcss.config.js
├── public
│   ├── icon.svg
│   ├── manifest.webmanifest
│   └── sw.js
├── src
│   ├── App.jsx
│   ├── index.css
│   ├── main.jsx
│   └── pwa.js
├── tailwind.config.js
└── vite.config.js
```

## Run Locally

Install dependencies:

```bash
npm install
```

Start development server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

Preview production build:

```bash
npm run preview
```

## How to Use

### Create Files and Folders
- Use `+ File` to create a file
- Use `+ Folder` to create a folder
- Choose a parent folder in the modal
- Nested folders and nested files are supported

### Upload Files
- Tap `Upload`
- Or drag and drop files into the app

### Edit Code
- Open a file from the file tree
- Edit it in Monaco
- Use tabs to switch between open files

### Use Snippets
- Tap `Snippets`
- Search by prefix or label
- Insert into the current editor
- Add custom snippets as needed

### Run Preview
- Enable auto-run for live preview updates
- Or disable auto-run and use `Run Preview`
- Use the console panel for logs and errors

### Save State
- The app persists automatically in local storage
- Use `Save Snapshot` to mark the current state as saved
- Export project JSON to keep a portable copy

## Offline Behavior

The app shell is offline-friendly after initial load:

- UI state persists locally
- Service worker and manifest are included
- File/project data is stored in the browser

### Important Preview Note
The preview runtime currently loads React and Babel from CDN URLs inside the sandbox preview iframe. This means:

- The main app works well offline after being loaded
- Preview works best when the preview assets have already been cached/loaded once
- Truly full first-load offline preview would require bundling a local preview runtime/compiler strategy

## Known Limitations

- Uploaded files are currently treated as text files
- Preview focuses on common React component workflows rather than full npm package resolution
- ZIP import/export is not implemented yet
- Drag-and-drop moving of files/folders in the tree is not implemented yet

## Suggested Next Enhancements

- True offline local preview runtime
- ZIP import/export
- Drag-and-drop moving in file tree
- More advanced project templates
- Multi-project workspace management
- Better package/dependency emulation for preview
- Deploy/share workflow

## Deployment

You can deploy the built app to any static hosting provider, including:

- Vercel
- Netlify
- Cloudflare Pages
- GitHub Pages
- Any static file server

Build first:

```bash
npm run build
```

Then deploy the generated `dist/` folder.

## Notes

This project is intended as a strong browser-based mobile IDE shell and prototype with production-style UX patterns.
