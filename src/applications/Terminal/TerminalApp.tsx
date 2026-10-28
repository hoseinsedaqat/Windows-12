import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useT } from '../../i18n';
import { useFileSystemStore } from '../../stores/fileSystemStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useSystemStore } from '../../stores/systemStore';
import { useWindowStore } from '../../stores/windowStore';
import { getChildren, nodeSize, relativePath, resolveRelativePath, ROOT_ID, type NodeMap } from '../../core/FileSystem';
import { formatBytes, formatDate } from '../../services/format';
import { listedApps } from '../../core/ApplicationRegistry';
import { launchApp } from '../../services/launcher';
import { notify } from '../../stores/notificationStore';

interface Line {
  id: number;
  text: string;
  tone: 'out' | 'err' | 'info' | 'cmd';
}

const VERSION = 'Windows 12 Concept [Version 12.0.26100.concept] (simulated shell)';

const COMMANDS = [
  'help', 'ls', 'dir', 'cd', 'pwd', 'cat', 'type', 'mkdir', 'md', 'touch', 'new',
  'rm', 'del', 'cp', 'copy', 'mv', 'move', 'rename', 'open', 'apps', 'tree', 'find',
  'echo', 'clear', 'cls', 'date', 'time', 'ver', 'whoami', 'uname', 'df', 'history',
  'theme', 'brightness', 'volume', 'notify', 'tasklist', 'kill', 'exit',
];

export function TerminalApp() {
  const { t } = useT();
  const nodes = useFileSystemStore((state) => state.nodes);
  const [cwd, setCwd] = useState<string>(ROOT_ID);
  const [input, setInput] = useState('');
  const [lines, setLines] = useState<Line[]>([
    { id: 1, text: VERSION, tone: 'info' },
    { id: 2, text: t('term.welcome'), tone: 'info' },
    { id: 3, text: t('term.welcomeHint'), tone: 'info' },
  ]);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const nextId = useRef(4);
  const bodyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const path = useMemo(() => relativePath(nodes, cwd) || '/', [nodes, cwd]);

  const write = useCallback((entries: { text: string; tone?: Line['tone'] }[]) => {
    setLines((current) => [...current, ...entries.map((entry) => ({ id: nextId.current++, text: entry.text, tone: entry.tone ?? 'out' }))]);
  }, []);

  useEffect(() => {
    const body = bodyRef.current;
    if (body) body.scrollTop = body.scrollHeight;
  }, [lines]);

  /* ---------------- commands ---------------- */
  const resolve = useCallback(
    (argument: string): string | null => resolveRelativePath(useFileSystemStore.getState().nodes, cwd, argument),
    [cwd],
  );

  const run = useCallback(
    (raw: string) => {
      const trimmed = raw.trim();
      write([{ text: `${path}> ${raw}`, tone: 'cmd' }]);
      if (!trimmed) return;
      setHistory((current) => [...current, trimmed]);
      setHistoryIndex(-1);

      const [command, ...args] = trimmed.split(/\s+/);
      const name = command.toLowerCase();
      const target = args[0] ?? '';
      const fs = useFileSystemStore.getState();
      const map: NodeMap = fs.nodes;

      switch (name) {
        case 'help': {
          write([
            { text: t('term.helpIntro'), tone: 'info' },
            { text: '  ls / dir [path]        — list files', tone: 'out' },
            { text: '  cd <path>              — change folder (.. and / supported)', tone: 'out' },
            { text: '  pwd                    — print current path', tone: 'out' },
            { text: '  cat / type <file>      — show a text file', tone: 'out' },
            { text: '  mkdir <name>           — create a folder here', tone: 'out' },
            { text: '  touch <name.ext>       — create an empty file here', tone: 'out' },
            { text: '  rm / del <name>        — move to Recycle Bin', tone: 'out' },
            { text: '  cp <src> <dst>         — copy a file or folder', tone: 'out' },
            { text: '  mv <src> <dst>         — move / rename', tone: 'out' },
            { text: '  tree [path]            — print a folder tree', tone: 'out' },
            { text: '  find <text>            — search file names', tone: 'out' },
            { text: '  open <app|path>        — launch an app or open a file', tone: 'out' },
            { text: '  apps                   — list installed apps', tone: 'out' },
            { text: '  tasklist / kill <id>   — running windows / end task', tone: 'out' },
            { text: '  theme <light|dark>     — change the simulated theme', tone: 'out' },
            { text: '  brightness <0-100>     — change the simulated brightness', tone: 'out' },
            { text: '  volume <0-100|mute>    — change the simulated volume', tone: 'out' },
            { text: '  notify <text>          — push a notification', tone: 'out' },
            { text: '  df                     — virtual storage usage', tone: 'out' },
            { text: '  echo <text> · date · time · ver · whoami · uname', tone: 'out' },
            { text: '  history · clear/cls · exit', tone: 'out' },
            { text: t('term.helpNote'), tone: 'info' },
          ]);
          return;
        }
        case 'ls':
        case 'dir': {
          const id = target ? resolve(target) : cwd;
          if (!id) {
            write([{ text: `'${target}' — ${t('term.notFound')}`, tone: 'err' }]);
            return;
          }
          const children = getChildren(map, id);
          if (!children.length) {
            write([{ text: t('term.emptyFolder'), tone: 'info' }]);
            return;
          }
          children
            .slice()
            .sort((a, b) => Number(a.kind !== 'folder') - Number(b.kind !== 'folder') || a.name.localeCompare(b.name))
            .forEach((node) => {
              const type = node.kind === 'folder' ? '<DIR> ' : '      ';
              const size = node.kind === 'folder' ? '' : formatBytes(nodeSize(map, node));
              write([{ text: `${formatDate(node.updatedAt)}  ${type} ${size.padStart(9)}  ${node.name}` }]);
            });
          write([{ text: `${children.length} item(s)`, tone: 'info' }]);
          return;
        }
        case 'cd': {
          if (!target || target === '/') {
            setCwd(ROOT_ID);
            return;
          }
          const id = resolve(target);
          if (!id) {
            write([{ text: `'${target}' — ${t('term.notFound')}`, tone: 'err' }]);
            return;
          }
          if (map[id]?.kind !== 'folder') {
            write([{ text: `'${target}' is not a folder`, tone: 'err' }]);
            return;
          }
          setCwd(id);
          return;
        }
        case 'pwd':
          write([{ text: path }]);
          return;
        case 'cat':
        case 'type': {
          const id = resolve(target);
          if (!id || !map[id]) {
            write([{ text: `'${target}' — ${t('term.notFound')}`, tone: 'err' }]);
            return;
          }
          const node = map[id];
          if (node.kind === 'folder') {
            write([{ text: `'${target}' is a folder`, tone: 'err' }]);
            return;
          }
          const content = node.content;
          if (typeof content === 'string') {
            content.split('\n').forEach((line) => write([{ text: line }]));
            return;
          }
          if (content && typeof content === 'object') {
            if ('html' in (content as Record<string, unknown>)) {
              String((content as { html: string }).html)
                .replace(/<[^>]*>/g, ' ')
                .replace(/\s{2,}/g, ' ')
                .trim()
                .split(/(?<=\.|\?)\s/)
                .forEach((line) => write([{ text: line }]));
              return;
            }
            write([{ text: JSON.stringify(content, null, 2).split('\n').slice(0, 200).join('\n') }]);
            return;
          }
          write([{ text: t('term.binary'), tone: 'info' }]);
          return;
        }
        case 'mkdir':
        case 'md': {
          if (!target) {
            write([{ text: 'usage: mkdir <name>', tone: 'err' }]);
            return;
          }
          const id = fs.createFolder(cwd, target);
          write([{ text: `Created ${relativePath(fs.nodes, id)}`, tone: 'info' }]);
          return;
        }
        case 'touch':
        case 'new': {
          if (!target) {
            write([{ text: 'usage: touch <name.ext>', tone: 'err' }]);
            return;
          }
          const id = fs.createFile('text', cwd, target, '');
          write([{ text: `Created ${fs.nodes[id]?.name ?? target}`, tone: 'info' }]);
          return;
        }
        case 'rm':
        case 'del': {
          const id = resolve(target);
          if (!id) {
            write([{ text: `'${target}' — ${t('term.notFound')}`, tone: 'err' }]);
            return;
          }
          if (fs.nodes[id]?.system) {
            write([{ text: t('term.systemProtected'), tone: 'err' }]);
            return;
          }
          fs.softDelete([id]);
          write([{ text: `Moved '${target}' to the Recycle Bin`, tone: 'info' }]);
          return;
        }
        case 'cp':
        case 'copy': {
          const source = resolve(args[0] ?? '');
          const destination = resolve(args[1] ?? '.');
          if (!source || !destination) {
            write([{ text: 'usage: cp <source> <destination-folder>', tone: 'err' }]);
            return;
          }
          fs.copyTo([source], destination);
          write([{ text: `Copied '${args[0]}' → '${args[1]}'`, tone: 'info' }]);
          return;
        }
        case 'mv':
        case 'move':
        case 'rename': {
          const source = resolve(args[0] ?? '');
          if (!source) {
            write([{ text: 'usage: mv <source> <destination>', tone: 'err' }]);
            return;
          }
          const destinationArg = args[1] ?? '';
          const destination = resolve(destinationArg);
          if (destination && fs.nodes[destination]?.kind === 'folder') {
            fs.move([source], destination);
            write([{ text: `Moved '${args[0]}' → '${destinationArg}'`, tone: 'info' }]);
            return;
          }
          const newName = destinationArg.split('/').pop() ?? destinationArg;
          if (!newName) {
            write([{ text: 'usage: mv <source> <folder|new-name>', tone: 'err' }]);
            return;
          }
          const ok = fs.rename(source, newName);
          write([{ text: ok ? `Renamed to '${newName}'` : t('term.renameFailed'), tone: ok ? 'info' : 'err' }]);
          return;
        }
        case 'tree': {
          const id = target ? resolve(target) : cwd;
          if (!id) {
            write([{ text: `'${target}' — ${t('term.notFound')}`, tone: 'err' }]);
            return;
          }
          const print = (nodeId: string, prefix: string, depth: number) => {
            if (depth > 4) return;
            const children = getChildren(fs.nodes, nodeId);
            children.forEach((node, index) => {
              const last = index === children.length - 1;
              write([{ text: `${prefix}${last ? '└─ ' : '├─ '}${node.name}${node.kind === 'folder' ? '/' : ''}` }]);
              if (node.kind === 'folder') print(node.id, `${prefix}${last ? '   ' : '│  '}`, depth + 1);
            });
          };
          write([{ text: `${fs.nodes[id]?.name ?? path}/`, tone: 'info' }]);
          print(id, '', 0);
          return;
        }
        case 'find': {
          if (!target) {
            write([{ text: 'usage: find <text>', tone: 'err' }]);
            return;
          }
          const needle = target.toLowerCase();
          const hits = Object.values(map).filter((node) => !node.deleted && node.name.toLowerCase().includes(needle)).slice(0, 40);
          if (!hits.length) {
            write([{ text: t('term.noResults'), tone: 'info' }]);
            return;
          }
          hits.forEach((node) => write([{ text: `${relativePath(map, node.parentId)}/${node.name}` }]));
          write([{ text: `${hits.length} match(es)`, tone: 'info' }]);
          return;
        }
        case 'open': {
          const app = listedApps().find((item) => item.id === target.toLowerCase() || item.name.toLowerCase() === target.toLowerCase());
          if (app) {
            launchApp(app.id);
            write([{ text: `Opening ${app.name}…`, tone: 'info' }]);
            return;
          }
          const id = resolve(target);
          if (id && map[id]) {
            const node = map[id];
            if (node.kind === 'folder') launchApp('explorer', { path: id });
            else launchApp('explorer', { path: node.parentId ?? ROOT_ID, fileId: id });
            write([{ text: `Opening '${target}'…`, tone: 'info' }]);
            return;
          }
          write([{ text: `'${target}' — ${t('term.notFound')}`, tone: 'err' }]);
          return;
        }
        case 'apps':
          listedApps().forEach((app) => write([{ text: `${app.id.padEnd(14)} ${app.name}` }]));
          return;
        case 'tasklist': {
          const windows = useWindowStore.getState().windows;
          if (!windows.length) {
            write([{ text: t('term.noWindows'), tone: 'info' }]);
            return;
          }
          write([{ text: 'ID                APP             STATE      TITLE', tone: 'info' }]);
          windows.forEach((win) =>
            write([{ text: `${win.id.padEnd(17)} ${win.appId.padEnd(15)} ${(win.minimized ? 'minimized' : win.maximized ? 'maximized' : 'running').padEnd(10)} ${win.title}` }]),
          );
          return;
        }
        case 'kill': {
          const windows = useWindowStore.getState();
          const victim = windows.windows.find((win) => win.id === target || win.appId === target.toLowerCase());
          if (!victim) {
            write([{ text: `'${target}' — no such window or app`, tone: 'err' }]);
            return;
          }
          windows.closeWindow(victim.id);
          write([{ text: `Ended ${victim.appId} (${victim.id})`, tone: 'info' }]);
          return;
        }
        case 'echo':
          write([{ text: args.join(' ') }]);
          return;
        case 'clear':
        case 'cls':
          setLines([]);
          return;
        case 'date':
          write([{ text: new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) }]);
          return;
        case 'time':
          write([{ text: new Date().toLocaleTimeString() }]);
          return;
        case 'ver':
          write([{ text: VERSION }]);
          return;
        case 'whoami': {
          const account = useSystemStore.getState().account;
          write([{ text: `concept\\${account.displayName.toLowerCase().replace(/\s+/g, '')}` }]);
          return;
        }
        case 'uname':
          write([{ text: 'Windows12Concept 12.0 browser-sandbox simulated' }]);
          return;
        case 'df': {
          const used = useFileSystemStore.getState().usedBytes;
          const quota = useSettingsStore.getState().settings.storageQuotaMB * 1024 * 1024;
          write([
            { text: `File system   Virtual (IndexedDB, this browser only)`, tone: 'info' },
            { text: `Used          ${formatBytes(used)}` },
            { text: `Quota         ${formatBytes(quota)}` },
            { text: `Free          ${formatBytes(Math.max(0, quota - used))}` },
            { text: `${Object.keys(map).filter((id) => !map[id].deleted).length} node(s) total` },
          ]);
          return;
        }
        case 'history':
          history.forEach((entry, index) => write([{ text: `${String(index + 1).padStart(3)}  ${entry}` }]));
          return;
        case 'theme': {
          const mode = args[0]?.toLowerCase();
          if (mode !== 'light' && mode !== 'dark') {
            write([{ text: 'usage: theme <light|dark>', tone: 'err' }]);
            return;
          }
          useSettingsStore.getState().setPersonalization({ theme: mode });
          write([{ text: `Theme set to ${mode}`, tone: 'info' }]);
          return;
        }
        case 'brightness': {
          const value = Number(args[0]);
          if (!Number.isFinite(value) || value < 0 || value > 100) {
            write([{ text: 'usage: brightness <0-100>', tone: 'err' }]);
            return;
          }
          useSettingsStore.getState().setDisplay({ brightness: Math.round(value) });
          write([{ text: `Brightness set to ${Math.round(value)}%`, tone: 'info' }]);
          return;
        }
        case 'volume': {
          const arg = args[0]?.toLowerCase();
          if (arg === 'mute') {
            useSettingsStore.getState().setSound({ muted: true });
            write([{ text: 'Muted', tone: 'info' }]);
            return;
          }
          const value = Number(arg);
          if (!Number.isFinite(value) || value < 0 || value > 100) {
            write([{ text: 'usage: volume <0-100|mute>', tone: 'err' }]);
            return;
          }
          useSettingsStore.getState().setSound({ volume: Math.round(value), muted: false });
          write([{ text: `Volume set to ${Math.round(value)}%`, tone: 'info' }]);
          return;
        }
        case 'notify':
          if (!args.length) {
            write([{ text: 'usage: notify <message>', tone: 'err' }]);
            return;
          }
          notify(t('term.fromTerminal'), args.join(' '), 'info', 'terminal');
          write([{ text: 'Notification sent', tone: 'info' }]);
          return;
        case 'exit':
          write([{ text: t('term.exitHint'), tone: 'info' }]);
          useWindowStore.getState().closeWindow(useWindowStore.getState().windows.find((win) => win.appId === 'terminal')?.id ?? '');
          return;
        default:
          write([
            { text: `'${command}' is not recognised as a command.`, tone: 'err' },
            { text: `Type 'help' for the list of ${COMMANDS.length} supported commands.`, tone: 'info' },
          ]);
      }
    },
    [cwd, history, path, resolve, t, write],
  );

  /* ---------------- input handling ---------------- */
  const complete = () => {
    const parts = input.split(/\s+/);
    const last = parts[parts.length - 1] ?? '';
    if (parts.length <= 1) {
      const match = COMMANDS.find((command) => command.startsWith(last.toLowerCase()));
      if (match) setInput(match);
      return;
    }
    const fs = useFileSystemStore.getState();
    const children = getChildren(fs.nodes, cwd);
    const match = children.find((node) => node.name.toLowerCase().startsWith(last.toLowerCase()));
    if (match) {
      parts[parts.length - 1] = match.name;
      setInput(parts.join(' '));
    }
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    event.stopPropagation();
    if (event.key === 'Enter') {
      event.preventDefault();
      run(input);
      setInput('');
      return;
    }
    if (event.key === 'Tab') {
      event.preventDefault();
      complete();
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (!history.length) return;
      const index = historyIndex < 0 ? history.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(index);
      setInput(history[index]);
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (historyIndex < 0) return;
      const index = historyIndex + 1;
      if (index >= history.length) {
        setHistoryIndex(-1);
        setInput('');
      } else {
        setHistoryIndex(index);
        setInput(history[index]);
      }
      return;
    }
    if (event.key === 'l' && event.ctrlKey) {
      event.preventDefault();
      setLines([]);
    }
  };

  return (
    <div
      className="flex h-full flex-col bg-[#0b0f14] font-mono text-[12.5px] text-[#d6e2f0]"
      onPointerDown={() => inputRef.current?.focus()}
    >
      <div ref={bodyRef} className="scroll-thin min-h-0 flex-1 overflow-y-auto px-3 py-2">
        {lines.map((line) => (
          <pre
            key={line.id}
            className={`whitespace-pre-wrap break-words leading-[1.45] ${
              line.tone === 'err' ? 'text-[#fca5a5]' : line.tone === 'info' ? 'text-[#93c5fd]' : line.tone === 'cmd' ? 'text-[#a7f3d0]' : ''
            }`}
          >
            {line.text}
          </pre>
        ))}
        <div className="flex items-center gap-1">
          <span className="shrink-0 text-[#a7f3d0]" dir="ltr">
            {path}&gt;
          </span>
          <input
            ref={inputRef}
            className="min-w-0 flex-1 border-none bg-transparent font-mono text-[12.5px] text-[#d6e2f0] caret-[#a7f3d0] outline-none"
            value={input}
            spellCheck={false}
            autoComplete="off"
            dir="ltr"
            aria-label={t('term.inputLabel')}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={onKeyDown}
          />
        </div>
      </div>
      <footer className="flex items-center gap-3 border-t border-white/10 px-3 py-1 text-[10.5px] text-white/45">
        <span>{t('term.simulatedNote')}</span>
        <span className="ms-auto">{history.length} commands · Tab to complete · ↑↓ history</span>
      </footer>
    </div>
  );
}

export default TerminalApp;
