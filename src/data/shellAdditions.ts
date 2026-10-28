import type { FSNode } from '../types';
import { createNode, estimateSize, DESKTOP_ID, DOCUMENTS_ID, type NodeMap } from '../core/FileSystem';

/**
 * Shell content added after the original seed (games folder, editor shortcut
 * and sample source files). Existing installations already persisted their
 * file system, so `ensureShellNodes` merges only the missing ids on hydrate —
 * nobody loses their own files and everybody gets the new content.
 */

const STAMP = Date.now() - 1000 * 60 * 60 * 24 * 2;

const SAMPLE_JS = `// Welcome to the Windows 12 Concept editor.
// This file lives in the virtual file system (IndexedDB) — nothing touches
// your real disk. Edit freely, then press Ctrl+S to save.

function greet(name) {
  return \`Hello, \${name}! From a browser-based desktop.\`;
}

const apps = ['Word', 'Excel', 'PowerPoint', 'Minesweeper', 'Snake', '2048'];
apps.forEach((app, index) => console.log(index + 1, greet(app)));
`;

const SAMPLE_MD = `# Windows 12 Concept

A fan-made desktop simulator that runs entirely in your browser.

## Try this
- Open **Visual Studio Code** from the desktop and edit \`hello.js\`
- Launch a game from the **games** folder
- Search the web from the simulated browser (results are real)

> Not affiliated with Microsoft. No real OS is involved.
`;

const SAMPLE_CSS = `/* Fluent-inspired tokens used across the concept shell */
:root {
  --accent: #0078d4;
  --surface-solid: #f3f3f3;
  --border: rgba(0, 0, 0, 0.08);
  --text: #1b1b1b;
}

.taskbar {
  height: 52px;
  backdrop-filter: blur(24px) saturate(160%);
}
`;

const SAMPLE_JSON = `{
  "name": "windows-12-concept",
  "simulated": true,
  "apps": 22,
  "themes": ["light", "dark"],
  "locales": ["en", "fa"]
}
`;

const SAMPLE_PY = `# Sample Python file for the concept editor's syntax highlighting.
def fibonacci(limit: int) -> list[int]:
    seq = [0, 1]
    while seq[-1] < limit:
        seq.append(seq[-1] + seq[-2])
    return seq


print(fibonacci(100))
`;

function textFile(id: string, name: string, content: string): FSNode {
  return createNode({
    id,
    name,
    kind: 'text',
    parentId: DOCUMENTS_ID,
    createdAt: STAMP,
    updatedAt: STAMP,
    size: estimateSize(content),
    content,
  });
}

function appShortcut(id: string, name: string, appId: string, parentId: string): FSNode {
  return createNode({
    id,
    name,
    kind: 'shortcut',
    parentId,
    createdAt: STAMP,
    updatedAt: STAMP,
    size: 1024,
    content: null,
    metadata: { appId },
    system: true,
  });
}

export function buildShellAdditions(): FSNode[] {
  const gamesFolder = createNode({
    id: 'desk-games',
    name: 'games',
    kind: 'folder',
    parentId: DESKTOP_ID,
    createdAt: STAMP,
    updatedAt: STAMP,
    size: 0,
    content: null,
    metadata: { iconX: 16, iconY: 688 },
    system: true,
  });
  return [
    gamesFolder,
    appShortcut('sc-mines', 'Minesweeper', 'minesweeper', 'desk-games'),
    appShortcut('sc-snake', 'Snake', 'snake', 'desk-games'),
    appShortcut('sc-2048', '2048', 'game2048', 'desk-games'),
    { ...appShortcut('sc-vscode', 'Visual Studio Code', 'vscode', DESKTOP_ID), metadata: { appId: 'vscode', iconX: 128, iconY: 688 } },
    textFile('doc-sample-js', 'hello.js', SAMPLE_JS),
    textFile('doc-sample-md', 'readme.md', SAMPLE_MD),
    textFile('doc-sample-css', 'styles.css', SAMPLE_CSS),
    textFile('doc-sample-json', 'config.json', SAMPLE_JSON),
    textFile('doc-sample-py', 'script.py', SAMPLE_PY),
  ];
}

/** Merge any missing shell nodes into an existing node map. */
export function ensureShellNodes(nodes: NodeMap): { nodes: NodeMap; added: FSNode[] } {
  const missing = buildShellAdditions().filter((node) => !nodes[node.id]);
  if (missing.length === 0) return { nodes, added: [] };
  const next: NodeMap = { ...nodes };
  for (const node of missing) next[node.id] = node;
  return { nodes: next, added: missing };
}
