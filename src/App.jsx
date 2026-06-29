import React, { useEffect, useMemo, useRef, useState } from 'react'
import Editor from '@monaco-editor/react'

const STORAGE_KEY = 'arena-mobile-ide-final-v1'
const SNIPPET_KEY = 'arena-mobile-ide-custom-snippets-v1'
const PREFS_KEY = 'arena-mobile-ide-prefs-final-v1'
const RECENTS_KEY = 'arena-mobile-ide-recents-v1'

const defaultFiles = {
  'src/App.jsx': {
    type: 'file',
    name: 'App.jsx',
    path: 'src/App.jsx',
    content: `import React from 'react'

export default function App() {
  return (
    <main className="min-h-screen bg-slate-950 text-white p-6 flex items-center justify-center">
      <div className="max-w-md rounded-2xl bg-slate-900 p-6 shadow-2xl border border-slate-700">
        <h1 className="text-3xl font-bold text-cyan-400">Final Mobile IDE</h1>
        <p className="mt-3 text-slate-300">Touch-friendly React + Tailwind mobile IDE with preview.</p>
        <button className="mt-5 rounded-xl bg-cyan-500 px-4 py-2 font-semibold text-slate-950 hover:bg-cyan-400">
          Tailwind Button
        </button>
      </div>
    </main>
  )
}
`,
  },
  'src/index.css': {
    type: 'file',
    name: 'index.css',
    path: 'src/index.css',
    content: `@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  margin: 0;
  font-family: Arial, sans-serif;
}
`,
  },
  'src/components/.keep': {
    type: 'file',
    name: '.keep',
    path: 'src/components/.keep',
    content: '',
  },
}

const BUILTIN_SNIPPETS = [
  { id: 'rfc', label: 'React component', prefix: 'rfc', scope: 'javascript', insert: `export default function ComponentName() {\n  return (\n    <div className="p-4">\n      ComponentName\n    </div>\n  )\n}\n` },
  { id: 'usf', label: 'useState', prefix: 'usf', scope: 'javascript', insert: `const [state, setState] = useState('')` },
  { id: 'uef', label: 'useEffect', prefix: 'uef', scope: 'javascript', insert: `useEffect(() => {\n  return () => {}\n}, [])` },
  { id: 'twbtn', label: 'Tailwind button', prefix: 'twbtn', scope: 'css', insert: `rounded-xl bg-cyan-500 px-4 py-2 font-semibold text-slate-950 hover:bg-cyan-400` },
  { id: 'twgrid', label: 'Tailwind grid', prefix: 'twgrid', scope: 'css', insert: `grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3` },
]

const THEMES = {
  dark: { app: 'bg-slate-950 text-slate-100', panel: 'bg-slate-900 border-slate-800', editor: 'vs-dark', previewHeader: 'bg-slate-100 text-slate-700 border-slate-200' },
  midnight: { app: 'bg-black text-slate-100', panel: 'bg-slate-950 border-slate-800', editor: 'vs-dark', previewHeader: 'bg-slate-100 text-slate-700 border-slate-200' },
}

const REACT_UMD = 'https://unpkg.com/react@18/umd/react.development.js'
const REACT_DOM_UMD = 'https://unpkg.com/react-dom@18/umd/react-dom.development.js'
const BABEL_STANDALONE = 'https://unpkg.com/@babel/standalone/babel.min.js'

function fileName(path) {
  const parts = path.split('/')
  return parts[parts.length - 1]
}

function parentDir(path) {
  const idx = path.lastIndexOf('/')
  return idx === -1 ? '' : path.slice(0, idx)
}

function getLanguage(path) {
  if (path.endsWith('.css')) return 'css'
  if (path.endsWith('.json')) return 'json'
  if (path.endsWith('.html')) return 'html'
  return 'javascript'
}

function buildTree(files) {
  const root = { name: 'root', path: '', type: 'folder', children: {} }
  Object.values(files).forEach((item) => {
    const parts = item.path.split('/')
    let node = root
    parts.forEach((part, index) => {
      const currentPath = parts.slice(0, index + 1).join('/')
      const isFile = index === parts.length - 1
      if (!node.children[part]) {
        node.children[part] = { name: part, path: currentPath, type: isFile ? 'file' : 'folder', children: isFile ? undefined : {} }
      }
      node = node.children[part]
    })
  })
  return root
}

function flattenFolders(tree, acc = ['']) {
  Object.values(tree.children || {}).forEach((node) => {
    if (node.type === 'folder') {
      acc.push(node.path)
      flattenFolders(node, acc)
    }
  })
  return acc
}

function escapeScript(str) {
  return str.replace(/<\//g, '<\\/')
}

function collectProjectFiles(files) {
  return Object.values(files).filter((file) => file.type === 'file' && file.name !== '.keep').map((file) => ({ path: file.path, content: file.content }))
}

function makePreviewHtml(files) {
  const cssCode = files['src/index.css']?.content || ''
  const projectFiles = collectProjectFiles(files)
  return `<!doctype html>
<html>
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<style>${cssCode}</style>
<script src="${REACT_UMD}"></script>
<script src="${REACT_DOM_UMD}"></script>
<script src="${BABEL_STANDALONE}"></script>
</head>
<body>
<div id="root"></div>
<script>
(function () {
  const files = ${escapeScript(JSON.stringify(projectFiles))};
  const fileMap = Object.fromEntries(files.map((f) => [f.path, f.content]));
  const logs = [];
  const originalLog = console.log;
  const originalError = console.error;
  console.log = (...args) => { logs.push({ type: 'log', message: args.map(String).join(' ') }); originalLog(...args); };
  console.error = (...args) => { logs.push({ type: 'error', message: args.map(String).join(' ') }); originalError(...args); };
  function publish(status, errorText) {
    parent.postMessage({ source: 'mobile-ide-preview', logs, status, error: errorText || '' }, '*');
  }
  function normalizeModule(code) {
    return code
      .replace(/import\s+React\s+from\s+['\"]react['\"];?/g, 'const React = window.React;')
      .replace(/import\s+\{([^}]+)\}\s+from\s+['\"]react['\"];?/g, 'const {$1} = window.React;')
      .replace(/import\s+([A-Za-z0-9_]+)\s+from\s+['\"](.+?)['\"];?/g, 'const $1 = __require("$2").default || __require("$2");')
      .replace(/import\s+\{([^}]+)\}\s+from\s+['\"](.+?)['\"];?/g, 'const {$1} = __require("$2");')
      .replace(/export default /g, 'exports.default = ')
      .replace(/export const\s+([A-Za-z0-9_]+)\s+=/g, 'exports.$1 =')
      .replace(/export function\s+([A-Za-z0-9_]+)\s*\(/g, 'exports.$1 = function $1(')
  }
  const cache = {};
  function resolvePath(base, target) {
    if (target.startsWith('.')) {
      const baseParts = base.split('/');
      baseParts.pop();
      const parts = target.split('/');
      for (const part of parts) {
        if (!part || part === '.') continue;
        if (part === '..') baseParts.pop();
        else baseParts.push(part);
      }
      const resolved = baseParts.join('/');
      const guesses = [resolved, resolved + '.jsx', resolved + '.js', resolved + '.css', resolved + '/index.jsx', resolved + '/index.js'];
      return guesses.find((g) => fileMap[g]) || resolved;
    }
    return target;
  }
  function __require(request, base = 'src/App.jsx') {
    const resolved = resolvePath(base, request);
    if (resolved.endsWith('.css')) return {};
    if (cache[resolved]) return cache[resolved].exports;
    const code = fileMap[resolved];
    if (!code) throw new Error('Module not found: ' + request + ' from ' + base);
    const module = { exports: {} };
    cache[resolved] = module;
    const transformed = Babel.transform(normalizeModule(code), { presets: ['react'] }).code;
    const fn = new Function('exports', 'module', '__require', 'React', 'ReactDOM', transformed);
    fn(module.exports, module, (path) => __require(path, resolved), window.React, window.ReactDOM);
    return module.exports;
  }
  try {
    const entry = __require('src/App.jsx', 'src/App.jsx');
    const App = entry.default || entry.App;
    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(React.createElement(App || (() => React.createElement('div', null, 'No App export found'))));
    publish('ok', '');
  } catch (error) {
    document.body.innerHTML = '<pre style="white-space:pre-wrap;padding:16px;color:#b91c1c;background:#fff1f2;font-family:monospace">Preview Error\n\n' + String(error && error.stack || error) + '</pre>';
    publish('error', String(error && error.stack || error));
  }
})();
</script>
</body>
</html>`
}

function Modal({ title, children, onClose, onSubmit }) {
  return (
    <div className="absolute inset-0 z-50 flex items-end bg-black/60 lg:items-center lg:justify-center">
      <div className="w-full rounded-t-2xl border border-slate-800 bg-slate-900 p-4 lg:max-w-lg lg:rounded-2xl">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button className="rounded-lg bg-slate-800 px-3 py-2 text-sm" onClick={onClose}>Close</button>
        </div>
        <form onSubmit={onSubmit}>{children}</form>
      </div>
    </div>
  )
}

function App() {
  const [files, setFiles] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      return saved ? JSON.parse(saved) : defaultFiles
    } catch {
      return defaultFiles
    }
  })
  const [lastSaved, setLastSaved] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      return saved || JSON.stringify(defaultFiles)
    } catch {
      return JSON.stringify(defaultFiles)
    }
  })
  const [customSnippets, setCustomSnippets] = useState(() => {
    try {
      const saved = localStorage.getItem(SNIPPET_KEY)
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })
  const [prefs, setPrefs] = useState(() => {
    try {
      const saved = localStorage.getItem(PREFS_KEY)
      return saved ? JSON.parse(saved) : { theme: 'dark', filePane: 24, previewPane: 36, openTabs: ['src/App.jsx', 'src/index.css'], activePath: 'src/App.jsx', collapsedFolders: {}, autoRun: true }
    } catch {
      return { theme: 'dark', filePane: 24, previewPane: 36, openTabs: ['src/App.jsx', 'src/index.css'], activePath: 'src/App.jsx', collapsedFolders: {}, autoRun: true }
    }
  })
  const [recentProjects, setRecentProjects] = useState(() => {
    try {
      const saved = localStorage.getItem(RECENTS_KEY)
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })
  const [mobileTab, setMobileTab] = useState('files')
  const [showSnippets, setShowSnippets] = useState(false)
  const [snippetFilter, setSnippetFilter] = useState('')
  const [search, setSearch] = useState('')
  const [dragActive, setDragActive] = useState(false)
  const [contextMenu, setContextMenu] = useState(null)
  const [resizing, setResizing] = useState(null)
  const [consoleState, setConsoleState] = useState({ logs: [], status: 'idle', error: '' })
  const [showConsole, setShowConsole] = useState(true)
  const [modal, setModal] = useState(null)
  const iframeRef = useRef(null)
  const fileInputRef = useRef(null)
  const importProjectRef = useRef(null)
  const monacoRef = useRef(null)
  const editorRef = useRef(null)

  const activePath = prefs.activePath || 'src/App.jsx'
  const openTabs = prefs.openTabs || ['src/App.jsx']
  const collapsedFolders = prefs.collapsedFolders || {}
  const theme = THEMES[prefs.theme] || THEMES.dark
  const currentSerialized = JSON.stringify(files)
  const projectDirty = currentSerialized !== lastSaved

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(files))
  }, [files])

  useEffect(() => {
    localStorage.setItem(SNIPPET_KEY, JSON.stringify(customSnippets))
  }, [customSnippets])

  useEffect(() => {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
  }, [prefs])

  useEffect(() => {
    localStorage.setItem(RECENTS_KEY, JSON.stringify(recentProjects))
  }, [recentProjects])

  function runPreview() {
    const html = makePreviewHtml(files)
    setConsoleState({ logs: [], status: 'running', error: '' })
    if (iframeRef.current) iframeRef.current.srcdoc = html
  }

  useEffect(() => {
    if (prefs.autoRun) runPreview()
  }, [files])

  useEffect(() => {
    const handler = (event) => {
      if (event.data?.source === 'mobile-ide-preview') {
        setConsoleState({ logs: event.data.logs || [], status: event.data.status || 'idle', error: event.data.error || '' })
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  useEffect(() => {
    function onMove(e) {
      if (!resizing) return
      const width = window.innerWidth
      const percent = Math.max(18, Math.min(55, (e.clientX / width) * 100))
      if (resizing === 'files') setPrefs((p) => ({ ...p, filePane: percent }))
      if (resizing === 'preview') setPrefs((p) => ({ ...p, previewPane: Math.max(20, Math.min(60, 100 - percent)) }))
    }
    function onUp() { setResizing(null) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [resizing])

  const tree = useMemo(() => buildTree(files), [files])
  const folders = useMemo(() => flattenFolders(tree), [tree])
  const activeFile = files[activePath]
  const snippets = useMemo(() => {
    const all = [...BUILTIN_SNIPPETS, ...customSnippets]
    const q = snippetFilter.toLowerCase().trim()
    return q ? all.filter((s) => s.label.toLowerCase().includes(q) || s.prefix.toLowerCase().includes(q)) : all
  }, [snippetFilter, customSnippets])

  function setActivePath(path) {
    setPrefs((p) => ({ ...p, activePath: path, openTabs: p.openTabs.includes(path) ? p.openTabs : [...p.openTabs, path] }))
  }

  function tabDirty(path) {
    const oldFiles = JSON.parse(lastSaved)
    return (oldFiles[path]?.content || '') !== (files[path]?.content || '')
  }

  function updateFile(path, content) {
    setFiles((prev) => ({ ...prev, [path]: { ...prev[path], content } }))
  }

  function ensureUniquePath(path) {
    if (!files[path]) return path
    const base = path.replace(/(\.[^.]+)?$/, '')
    const extMatch = path.match(/(\.[^.]+)$/)
    const ext = extMatch ? extMatch[1] : ''
    let i = 1
    while (files[`${base}-${i}${ext}`]) i += 1
    return `${base}-${i}${ext}`
  }

  function openFile(path) {
    setActivePath(path)
    setMobileTab('editor')
  }

  function closeTab(path) {
    setPrefs((p) => {
      const nextTabs = p.openTabs.filter((tab) => tab !== path)
      const nextActive = p.activePath === path ? nextTabs[nextTabs.length - 1] || '' : p.activePath
      return { ...p, openTabs: nextTabs, activePath: nextActive }
    })
  }

  function toggleFolder(path) {
    setPrefs((p) => ({ ...p, collapsedFolders: { ...p.collapsedFolders, [path]: !p.collapsedFolders[path] } }))
  }

  function saveProjectSnapshot() {
    const serialized = JSON.stringify(files)
    localStorage.setItem(STORAGE_KEY, serialized)
    setLastSaved(serialized)
  }

  function openCreateModal(kind, parentPath = parentDir(activePath)) {
    setModal({ kind, parentPath, name: '', scope: 'javascript', insert: '', label: '', prefix: '' })
  }

  function renameWithModal(path) {
    setModal({ kind: 'rename', path, name: fileName(path) })
  }

  function deleteItem(path) {
    const ok = confirm(`Delete ${path}? Files in nested folders will also be removed.`)
    if (!ok) return
    setFiles((prev) => {
      const next = { ...prev }
      Object.keys(next).forEach((key) => {
        if (key === path || key.startsWith(`${path}/`)) delete next[key]
      })
      return next
    })
    setPrefs((p) => {
      const nextTabs = p.openTabs.filter((tab) => !(tab === path || tab.startsWith(`${path}/`)))
      const nextActive = p.activePath === path || p.activePath.startsWith(`${path}/`) ? nextTabs[0] || '' : p.activePath
      return { ...p, openTabs: nextTabs, activePath: nextActive }
    })
  }

  function duplicateFile(path) {
    const source = files[path]
    if (!source || source.type !== 'file') return
    const ext = path.includes('.') ? path.slice(path.lastIndexOf('.')) : ''
    const bare = ext ? path.slice(0, -ext.length) : path
    const nextPath = ensureUniquePath(`${bare}-copy${ext}`)
    setFiles((prev) => ({ ...prev, [nextPath]: { ...source, path: nextPath, name: fileName(nextPath) } }))
    openFile(nextPath)
  }

  function readTextFiles(list) {
    Array.from(list || []).forEach((file) => {
      const reader = new FileReader()
      reader.onload = () => {
        const base = parentDir(activePath)
        const rawPath = [base, file.webkitRelativePath || file.name].filter(Boolean).join('/')
        const path = ensureUniquePath(rawPath.replace(/^\/+/, ''))
        setFiles((prev) => ({ ...prev, [path]: { type: 'file', name: fileName(path), path, content: String(reader.result || '') } }))
      }
      reader.readAsText(file)
    })
  }

  function handleUpload(event) {
    readTextFiles(event.target.files)
    event.target.value = ''
  }

  function insertSnippet(snippet) {
    const editor = editorRef.current
    if (editor && monacoRef.current) {
      const selection = editor.getSelection()
      editor.executeEdits('snippet-insert', [{ range: selection, text: snippet.insert }])
      editor.focus()
    } else if (activeFile) {
      updateFile(activePath, `${activeFile.content}${activeFile.content.endsWith('\n') ? '' : '\n'}${snippet.insert}\n`)
    }
    setShowSnippets(false)
    setMobileTab('editor')
  }

  function removeCustomSnippet(id) {
    setCustomSnippets((prev) => prev.filter((s) => s.id !== id))
  }

  function exportProject() {
    const payload = { files, customSnippets, prefs }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'final-mobile-ide-project.json'
    a.click()
    URL.revokeObjectURL(a.href)
    setRecentProjects((prev) => [{ name: a.download, date: new Date().toISOString() }, ...prev].slice(0, 8))
  }

  function importProject(event) {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || '{}'))
        if (parsed.files) setFiles(parsed.files)
        if (parsed.customSnippets) setCustomSnippets(parsed.customSnippets)
        if (parsed.prefs) setPrefs(parsed.prefs)
        setRecentProjects((prev) => [{ name: file.name, date: new Date().toISOString() }, ...prev].slice(0, 8))
      } catch {
        alert('Invalid project file')
      }
    }
    reader.readAsText(file)
    event.target.value = ''
  }

  function filteredChildren(node) {
    const q = search.toLowerCase().trim()
    if (!q) return Object.values(node.children || {})
    return Object.values(node.children || {}).filter((child) => child.path.toLowerCase().includes(q))
  }

  function onNodeContextMenu(e, child) {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, node: child })
  }

  function renderNode(node, depth = 0) {
    return filteredChildren(node)
      .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'folder' ? -1 : 1))
      .map((child) => (
        <div key={child.path} className="min-w-0" onContextMenu={(e) => onNodeContextMenu(e, child)}>
          <div className={`flex items-center justify-between gap-2 rounded-lg px-2 py-2 ${activePath === child.path ? 'bg-slate-800' : 'hover:bg-slate-800/70'}`}>
            <button className="min-w-0 flex-1 truncate text-left text-sm" style={{ paddingLeft: depth * 12 }} onClick={() => child.type === 'folder' ? toggleFolder(child.path) : openFile(child.path)}>
              {child.type === 'folder' ? (collapsedFolders[child.path] ? '📁' : '📂') : child.path.endsWith('.css') ? '🎨' : '📄'} {child.name}
            </button>
            <div className="flex gap-1 lg:hidden">
              <button className="rounded bg-slate-700 px-2 py-1 text-xs text-slate-200" onClick={() => setContextMenu({ x: 20, y: 120, node: child })}>⋯</button>
            </div>
          </div>
          {child.type === 'folder' && !collapsedFolders[child.path] && <div>{renderNode(child, depth + 1)}</div>}
        </div>
      ))
  }

  function onMount(editor, monaco) {
    editorRef.current = editor
    monacoRef.current = monaco
    monaco.languages.registerCompletionItemProvider('javascript', {
      provideCompletionItems: () => ({
        suggestions: [...BUILTIN_SNIPPETS, ...customSnippets].filter((s) => s.scope === 'javascript').map((snippet) => ({
          label: snippet.prefix,
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: snippet.insert,
          documentation: snippet.label,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        })),
      }),
    })
    monaco.languages.registerCompletionItemProvider('css', {
      provideCompletionItems: () => ({
        suggestions: [...BUILTIN_SNIPPETS, ...customSnippets].filter((s) => s.scope === 'css').map((snippet) => ({
          label: snippet.prefix,
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: snippet.insert,
          documentation: snippet.label,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        })),
      }),
    })
  }

  function submitModal(e) {
    e.preventDefault()
    if (!modal) return

    if (modal.kind === 'file') {
      const uniquePath = ensureUniquePath([modal.parentPath, modal.name].filter(Boolean).join('/'))
      const content = uniquePath.endsWith('.css') ? '/* New CSS file */\n' : uniquePath.endsWith('.jsx') ? 'export default function NewComponent() {\n  return <div>NewComponent</div>\n}\n' : '// New file\n'
      setFiles((prev) => ({ ...prev, [uniquePath]: { type: 'file', name: fileName(uniquePath), path: uniquePath, content } }))
      openFile(uniquePath)
    }

    if (modal.kind === 'folder') {
      const folderPath = [modal.parentPath, modal.name].filter(Boolean).join('/')
      const placeholder = ensureUniquePath(`${folderPath}/.keep`)
      setFiles((prev) => ({ ...prev, [placeholder]: { type: 'file', name: '.keep', path: placeholder, content: '' } }))
    }

    if (modal.kind === 'rename') {
      const path = modal.path
      const nextName = modal.name
      const base = parentDir(path)
      const nextPath = [base, nextName].filter(Boolean).join('/')
      setFiles((prev) => {
        const next = {}
        Object.values(prev).forEach((item) => {
          if (item.path === path || item.path.startsWith(`${path}/`)) {
            const replaced = item.path.replace(path, nextPath)
            next[replaced] = { ...item, path: replaced, name: fileName(replaced) }
          } else next[item.path] = item
        })
        return next
      })
      setPrefs((p) => ({
        ...p,
        openTabs: p.openTabs.map((tab) => (tab === path || tab.startsWith(`${path}/`) ? tab.replace(path, nextPath) : tab)),
        activePath: p.activePath === path || p.activePath.startsWith(`${path}/`) ? p.activePath.replace(path, nextPath) : p.activePath,
      }))
    }

    if (modal.kind === 'snippet') {
      setCustomSnippets((prev) => [...prev, { id: `${Date.now()}`, label: modal.label, prefix: modal.prefix, scope: modal.scope, insert: modal.insert }])
    }

    setModal(null)
  }

  return (
    <div className={`flex h-full flex-col ${theme.app}`} onClick={() => contextMenu && setContextMenu(null)} onDragOver={(e) => { e.preventDefault(); setDragActive(true) }} onDragLeave={() => setDragActive(false)} onDrop={(e) => { e.preventDefault(); setDragActive(false); readTextFiles(e.dataTransfer.files) }}>
      <header className={`shrink-0 border-b ${theme.panel} p-3`}>
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-lg font-bold">Final Mobile React + Tailwind IDE</h1>
            <p className="text-xs text-slate-400">Touch-friendly, offline-friendly, Monaco-powered mobile IDE.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <select className="rounded-lg bg-slate-800 px-3 py-2 text-sm" value={prefs.theme} onChange={(e) => setPrefs((p) => ({ ...p, theme: e.target.value }))}>
              {Object.keys(THEMES).map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
            <button className="rounded-lg bg-slate-800 px-3 py-2 text-sm" onClick={() => setPrefs((p) => ({ ...p, autoRun: !p.autoRun }))}>{prefs.autoRun ? 'Auto Run On' : 'Auto Run Off'}</button>
            <button className="rounded-lg bg-cyan-500 px-3 py-2 text-sm font-semibold text-slate-950" onClick={() => setShowSnippets((v) => !v)}>Snippets</button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <span>{projectDirty ? '● Unsaved changes' : '● Saved'}</span>
          <span>Open tabs: {openTabs.length}</span>
          <span>Files: {Object.keys(files).length}</span>
          <button className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-200" onClick={() => editorRef.current?.trigger('toolbar', 'undo', null)}>Undo</button>
          <button className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-200" onClick={() => editorRef.current?.trigger('toolbar', 'redo', null)}>Redo</button>
          <button className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-200" onClick={saveProjectSnapshot}>Save Snapshot</button>
          <button className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-200" onClick={runPreview}>Run Preview</button>
          <button className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-200" onClick={() => setShowConsole((v) => !v)}>{showConsole ? 'Hide Console' : 'Show Console'}</button>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-sm lg:hidden">
          <button className={`rounded-lg px-3 py-2 ${mobileTab === 'files' ? 'bg-slate-700' : 'bg-slate-800'}`} onClick={() => setMobileTab('files')}>Files</button>
          <button className={`rounded-lg px-3 py-2 ${mobileTab === 'editor' ? 'bg-slate-700' : 'bg-slate-800'}`} onClick={() => setMobileTab('editor')}>Editor</button>
          <button className={`rounded-lg px-3 py-2 ${mobileTab === 'preview' ? 'bg-slate-700' : 'bg-slate-800'}`} onClick={() => setMobileTab('preview')}>Preview</button>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
        <aside className={`${mobileTab === 'files' ? 'flex' : 'hidden'} min-h-0 flex-col border-r ${theme.panel} lg:flex`} style={{ width: `${prefs.filePane}%` }}>
          <div className="flex flex-wrap gap-2 border-b border-slate-800 p-3">
            <button className="rounded-lg bg-slate-800 px-3 py-2 text-sm" onClick={() => openCreateModal('folder')}>+ Folder</button>
            <button className="rounded-lg bg-slate-800 px-3 py-2 text-sm" onClick={() => openCreateModal('file')}>+ File</button>
            <button className="rounded-lg bg-slate-800 px-3 py-2 text-sm" onClick={() => fileInputRef.current?.click()}>Upload</button>
            <button className="rounded-lg bg-slate-800 px-3 py-2 text-sm" onClick={exportProject}>Export</button>
            <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleUpload} />
            <label className="cursor-pointer rounded-lg bg-slate-800 px-3 py-2 text-sm">
              Import
              <input ref={importProjectRef} type="file" accept="application/json" className="hidden" onChange={importProject} />
            </label>
          </div>
          <div className="border-b border-slate-800 p-3">
            <input className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none" placeholder="Search files..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="border-b border-slate-800 p-3 text-xs text-slate-400">
            <div className="mb-2 font-semibold text-slate-300">Recent Projects</div>
            <div className="space-y-1">{recentProjects.length ? recentProjects.map((item, i) => <div key={`${item.name}-${i}`}>{item.name}</div>) : <div>No recent imports/exports yet</div>}</div>
          </div>
          <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-2">{renderNode(tree)}</div>
        </aside>

        <div className="hidden w-1 cursor-col-resize bg-slate-800 lg:block" onMouseDown={() => setResizing('files')} />

        <section className={`${mobileTab === 'editor' ? 'flex' : 'hidden'} min-h-0 flex-1 flex-col lg:flex`} style={{ width: `${100 - prefs.filePane - prefs.previewPane}%` }}>
          <div className="flex shrink-0 gap-2 overflow-x-auto border-b border-slate-800 bg-slate-900 p-2">
            {openTabs.map((tab) => (
              <div key={tab} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${activePath === tab ? 'bg-slate-700' : 'bg-slate-800'}`}>
                <button onClick={() => openFile(tab)}>{fileName(tab)} {tabDirty(tab) ? '•' : ''}</button>
                <button className="text-slate-400 hover:text-white" onClick={() => closeTab(tab)}>×</button>
              </div>
            ))}
          </div>
          <div className="min-h-0 flex-1 bg-slate-950">
            <Editor
              height="100%"
              path={activePath}
              language={getLanguage(activePath || '')}
              value={activeFile?.content || ''}
              theme={theme.editor}
              onMount={onMount}
              onChange={(value) => updateFile(activePath, value || '')}
              options={{ minimap: { enabled: false }, fontSize: 14, wordWrap: 'on', automaticLayout: true, scrollBeyondLastLine: false, tabSize: 2, quickSuggestions: true, suggestOnTriggerCharacters: true, padding: { top: 12 } }}
            />
          </div>
          {showConsole && (
            <div className="max-h-52 overflow-auto border-t border-slate-800 bg-black p-3 text-xs text-slate-300">
              <div className="mb-2 flex items-center justify-between">
                <span>Status: {consoleState.status}</span>
                <button className="rounded bg-slate-800 px-2 py-1 text-xs" onClick={() => setConsoleState({ logs: [], status: 'idle', error: '' })}>Clear</button>
              </div>
              {consoleState.error ? <pre className="whitespace-pre-wrap text-rose-300">{consoleState.error}</pre> : null}
              {consoleState.logs.map((log, i) => <div key={i} className={log.type === 'error' ? 'text-rose-300' : 'text-emerald-300'}>{log.message}</div>)}
              {!consoleState.logs.length && !consoleState.error ? <div className="text-slate-500">No console output yet.</div> : null}
            </div>
          )}
        </section>

        <div className="hidden w-1 cursor-col-resize bg-slate-800 lg:block" onMouseDown={() => setResizing('preview')} />

        <section className={`${mobileTab === 'preview' ? 'flex' : 'hidden'} min-h-0 flex-col border-l border-slate-800 bg-white lg:flex`} style={{ width: `${prefs.previewPane}%` }}>
          <div className={`border-b px-3 py-2 text-sm ${theme.previewHeader}`}>Live Preview</div>
          <div className="min-h-0 flex-1">
            <iframe ref={iframeRef} title="preview" className="preview-frame" sandbox="allow-scripts allow-same-origin" />
          </div>
        </section>
      </main>

      {contextMenu && (
        <div className="fixed z-40 min-w-44 rounded-lg border border-slate-700 bg-slate-900 p-1 shadow-2xl" style={{ left: contextMenu.x, top: contextMenu.y }} onClick={(e) => e.stopPropagation()}>
          <button className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-slate-800" onClick={() => { contextMenu.node.type === 'folder' ? openCreateModal('file', contextMenu.node.path) : duplicateFile(contextMenu.node.path); setContextMenu(null) }}>
            {contextMenu.node.type === 'folder' ? 'New file here' : 'Duplicate file'}
          </button>
          <button className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-slate-800" onClick={() => { if (contextMenu.node.type === 'folder') openCreateModal('folder', contextMenu.node.path); setContextMenu(null) }}>
            New folder here
          </button>
          <button className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-slate-800" onClick={() => { renameWithModal(contextMenu.node.path); setContextMenu(null) }}>
            Rename
          </button>
          <button className="block w-full rounded px-3 py-2 text-left text-sm text-rose-300 hover:bg-slate-800" onClick={() => { deleteItem(contextMenu.node.path); setContextMenu(null) }}>
            Delete
          </button>
        </div>
      )}

      {dragActive && (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-cyan-500/10">
          <div className="rounded-2xl border border-cyan-400 bg-slate-900/90 px-6 py-4 text-cyan-300 shadow-2xl">Drop files to upload</div>
        </div>
      )}

      {showSnippets && (
        <div className="absolute inset-0 z-20 flex items-end bg-black/60 lg:items-center lg:justify-center">
          <div className="max-h-[80vh] w-full rounded-t-2xl border border-slate-800 bg-slate-900 p-4 lg:max-w-2xl lg:rounded-2xl">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">Snippets & Autofill</h2>
              <button className="rounded-lg bg-slate-800 px-3 py-2 text-sm" onClick={() => setShowSnippets(false)}>Close</button>
            </div>
            <input className="mb-3 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 outline-none" placeholder="Search snippets..." value={snippetFilter} onChange={(e) => setSnippetFilter(e.target.value)} />
            <div className="mb-3 flex justify-end">
              <button className="rounded-lg bg-slate-800 px-3 py-2 text-sm" onClick={() => setModal({ kind: 'snippet', label: '', prefix: '', scope: 'javascript', insert: '' })}>Add Custom Snippet</button>
            </div>
            <div className="scrollbar-thin max-h-[55vh] space-y-2 overflow-y-auto">
              {snippets.map((snippet) => (
                <div key={snippet.id} className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                  <button className="w-full text-left" onClick={() => insertSnippet(snippet)}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{snippet.label}</span>
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-cyan-500/20 px-2 py-1 text-xs text-cyan-300">{snippet.prefix}</span>
                        <span className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-300">{snippet.scope}</span>
                      </div>
                    </div>
                    <pre className="code-font mt-2 overflow-x-auto whitespace-pre-wrap text-xs text-slate-400">{snippet.insert}</pre>
                  </button>
                  {!BUILTIN_SNIPPETS.find((s) => s.id === snippet.id) && <div className="mt-2 flex justify-end"><button className="rounded bg-rose-500/20 px-2 py-1 text-xs text-rose-300" onClick={() => removeCustomSnippet(snippet.id)}>Remove</button></div>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {modal && (
        <Modal title={modal.kind === 'file' ? 'Create File' : modal.kind === 'folder' ? 'Create Folder' : modal.kind === 'rename' ? 'Rename Item' : 'Add Custom Snippet'} onClose={() => setModal(null)} onSubmit={submitModal}>
          {(modal.kind === 'file' || modal.kind === 'folder') && (
            <>
              <label className="mb-2 block text-sm text-slate-300">Parent Folder</label>
              <select className="mb-3 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2" value={modal.parentPath} onChange={(e) => setModal((m) => ({ ...m, parentPath: e.target.value }))}>
                {folders.map((folder) => <option key={folder} value={folder}>{folder || '(root)'}</option>)}
              </select>
              <label className="mb-2 block text-sm text-slate-300">Name</label>
              <input className="mb-3 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2" value={modal.name} onChange={(e) => setModal((m) => ({ ...m, name: e.target.value }))} required />
            </>
          )}
          {modal.kind === 'rename' && (
            <>
              <label className="mb-2 block text-sm text-slate-300">New Name</label>
              <input className="mb-3 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2" value={modal.name} onChange={(e) => setModal((m) => ({ ...m, name: e.target.value }))} required />
            </>
          )}
          {modal.kind === 'snippet' && (
            <>
              <label className="mb-2 block text-sm text-slate-300">Label</label>
              <input className="mb-3 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2" value={modal.label} onChange={(e) => setModal((m) => ({ ...m, label: e.target.value }))} required />
              <label className="mb-2 block text-sm text-slate-300">Prefix</label>
              <input className="mb-3 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2" value={modal.prefix} onChange={(e) => setModal((m) => ({ ...m, prefix: e.target.value }))} required />
              <label className="mb-2 block text-sm text-slate-300">Scope</label>
              <select className="mb-3 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2" value={modal.scope} onChange={(e) => setModal((m) => ({ ...m, scope: e.target.value }))}>
                <option value="javascript">javascript</option>
                <option value="css">css</option>
              </select>
              <label className="mb-2 block text-sm text-slate-300">Snippet</label>
              <textarea className="mb-3 min-h-28 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2" value={modal.insert} onChange={(e) => setModal((m) => ({ ...m, insert: e.target.value }))} required />
            </>
          )}
          <div className="flex justify-end">
            <button className="rounded-lg bg-cyan-500 px-4 py-2 font-semibold text-slate-950" type="submit">Save</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

export default App
