/**
 * Windows 12 Concept — Web Desktop Simulator
 * Central type definitions shared by the OS core, stores, shell and applications.
 */

/* ------------------------------------------------------------------ */
/* File system                                                         */
/* ------------------------------------------------------------------ */

export type FileKind =
  | 'folder'
  | 'doc'
  | 'sheet'
  | 'slides'
  | 'text'
  | 'note'
  | 'image'
  | 'audio'
  | 'video'
  | 'pdf'
  | 'shortcut'
  | 'archive'
  | 'other';

export interface FileMetadata {
  /** Application that owns/created the file. */
  appId?: string;
  /** Target node id for shortcuts. */
  targetId?: string;
  /** Desktop icon position (only meaningful for Desktop children). */
  iconX?: number;
  iconY?: number;
  /** Mime type of imported real files. */
  mime?: string;
  /** Data URL payload for imported images. */
  dataUrl?: string;
  /** Original path when the file was deleted (for the Recycle Bin). */
  originalPath?: string;
  /** Note colour / pinned flags etc. */
  color?: string;
  pinned?: boolean;
  tags?: string[];
  [key: string]: unknown;
}

export interface FSNode {
  id: string;
  name: string;
  kind: FileKind;
  /** `null` means the node lives at a virtual root (drive). */
  parentId: string | null;
  createdAt: number;
  updatedAt: number;
  /** Byte-ish size, computed for files, aggregated for folders. */
  size: number;
  /** Structured content (document model, spreadsheet model, text, ...). */
  content: unknown;
  metadata: FileMetadata;
  /** Soft-deleted → visible in the Recycle Bin. */
  deleted: boolean;
  deletedAt?: number;
  /** System nodes cannot be deleted or renamed. */
  system?: boolean;
}

export type SortKey = 'name' | 'updatedAt' | 'createdAt' | 'size' | 'kind';
export type SortDirection = 'asc' | 'desc';
export type ExplorerView = 'grid' | 'list' | 'details';

export interface ClipboardPayload {
  mode: 'copy' | 'cut';
  ids: string[];
}

/* ------------------------------------------------------------------ */
/* Windows                                                             */
/* ------------------------------------------------------------------ */

export interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type SnapPosition = 'none' | 'left' | 'right' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'maximize';

export interface WindowInstance {
  id: string;
  appId: string;
  title: string;
  bounds: WindowBounds;
  /** Bounds to return to after un-maximising / un-snapping. */
  restoreBounds: WindowBounds;
  minimized: boolean;
  maximized: boolean;
  snap: SnapPosition;
  z: number;
  /** Props handed to the application component (e.g. `{ fileId }`). */
  props: Record<string, unknown>;
  openedAt: number;
  /** Set while the open/close animation plays. */
  closing?: boolean;
}

/* ------------------------------------------------------------------ */
/* Applications                                                        */
/* ------------------------------------------------------------------ */

export interface AppDefinition {
  id: string;
  name: string;
  /** Search keywords (both locales) used by Start / Search / Run. */
  keywords?: string[];
  /** Only one window at a time — re-opening focuses the existing one. */
  singleton?: boolean;
  defaultSize: { width: number; height: number };
  minSize: { width: number; height: number };
  /** Show in Start "All apps" and (optionally) pin to taskbar/desktop. */
  listed?: boolean;
  /** Category used by the Start menu grouping. */
  category?: 'system' | 'productivity' | 'media' | 'web' | 'utilities' | 'business' | 'development' | 'games';
  /** Accent colour used by tiles and the taskbar indicator. */
  accent?: string;
  /** File kinds this app can open (used by "Open with"). */
  handles?: FileKind[];
}

/* ------------------------------------------------------------------ */
/* Notifications                                                       */
/* ------------------------------------------------------------------ */

export type NotificationKind = 'info' | 'success' | 'warning' | 'error';

export interface SystemNotification {
  id: string;
  appId: string;
  appName: string;
  title: string;
  body?: string;
  kind: NotificationKind;
  createdAt: number;
  /** Toast is currently on screen. */
  active: boolean;
}

/* ------------------------------------------------------------------ */
/* Power / session                                                     */
/* ------------------------------------------------------------------ */

export type PowerState =
  | 'off'
  | 'booting'
  | 'lock'
  | 'desktop'
  | 'locking'
  | 'signing-out'
  | 'restarting'
  | 'shutting-down';

export type BootStage = 'blank' | 'logo' | 'dots' | 'welcome' | 'done';

export interface UserAccount {
  id: string;
  displayName: string;
  /** Demo credential — hashed, never a real secret. */
  passwordHash: string;
  avatar: string;
  avatarColor: string;
  autoSignIn: boolean;
  hint?: string;
}

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

export type LanguageCode = 'en' | 'fa';
export type ThemeMode = 'light' | 'dark' | 'auto';
export type TaskbarPosition = 'bottom' | 'top';

export interface DisplaySettings {
  brightness: number;
  nightLight: boolean;
  nightLightStrength: number;
  scale: number;
  reduceMotion: boolean;
  animations: boolean;
}

export interface SoundSettings {
  /** Simulated system volume (0-100). It does NOT control the real device volume. */
  volume: number;
  muted: boolean;
  systemSounds: boolean;
}

export interface NetworkSettings {
  wifiEnabled: boolean;
  airplaneMode: boolean;
  bluetoothEnabled: boolean;
  connectedNetwork: string | null;
  /** Purely simulated link state. */
  status: 'connected' | 'limited' | 'disconnected';
}

export interface PersonalizationSettings {
  wallpaperId: string;
  lockWallpaperId: string;
  theme: ThemeMode;
  accent: string;
  transparency: boolean;
  taskbarPosition: TaskbarPosition;
  taskbarAlignment: 'center' | 'left';
  taskbarIconSize: 'small' | 'medium' | 'large';
  autoHideTaskbar: boolean;
  desktopIconSize: 'small' | 'medium' | 'large';
  desktopIconsVisible: boolean;
  desktopIconLayout: 'auto' | 'free';
}

export interface LocaleSettings {
  language: LanguageCode;
  /** Calendar system used for date rendering. */
  calendar: 'gregory' | 'persian';
  numberSystem: 'latn' | 'arabext';
  currency: string;
  firstDayOfWeek: 0 | 1 | 6;
  dateFormat: 'auto' | 'iso' | 'local';
}

export interface PowerSettings {
  showBootAnimation: boolean;
  bootDuration: 'fast' | 'normal';
  screenTimeoutMinutes: number;
  batterySaver: boolean;
}

export interface PrivacySettings {
  notificationsEnabled: boolean;
  focusAssist: boolean;
  activityHistory: boolean;
  locationEnabled: boolean;
  cameraEnabled: boolean;
  microphoneEnabled: boolean;
  analyticsEnabled: boolean;
}

export interface AppsSettings {
  /** File kind → app id used by "Open" when a file is double-clicked. */
  defaultApps: Partial<Record<FileKind, string>>;
  /** Apps the shell offers to launch right after sign-in (simulated). */
  startupApps: string[];
  launchStartupOnSignIn: boolean;
}

export interface MultitaskingSettings {
  snapEnabled: boolean;
  snapAssist: boolean;
  altTabShowsTabs: boolean;
  desktopGrouping: boolean;
}

export interface SystemSettings {
  display: DisplaySettings;
  sound: SoundSettings;
  network: NetworkSettings;
  personalization: PersonalizationSettings;
  locale: LocaleSettings;
  power: PowerSettings;
  privacy: PrivacySettings;
  apps: AppsSettings;
  multitasking: MultitaskingSettings;
  storageQuotaMB: number;
}

/* ------------------------------------------------------------------ */
/* Accounting                                                          */
/* ------------------------------------------------------------------ */

export type InvoiceStatus = 'draft' | 'unpaid' | 'partial' | 'paid';
export type PartyKind = 'customer' | 'supplier';
export type TransactionType = 'income' | 'expense';

export interface Party {
  id: string;
  kind: PartyKind;
  name: string;
  contact?: string;
  email?: string;
  phone?: string;
  address?: string;
  balance: number;
  createdAt: number;
  demo?: boolean;
}

export interface Account {
  id: string;
  name: string;
  type: 'asset' | 'liability' | 'equity' | 'income' | 'expense';
  balance: number;
  currency: string;
  demo?: boolean;
}

export interface InvoiceLine {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  /** Percent */
  discount: number;
}

export interface Invoice {
  id: string;
  number: string;
  customerId: string;
  issueDate: string;
  dueDate: string;
  lines: InvoiceLine[];
  /** Percent, applied after line discounts. */
  taxRate: number;
  /** Flat amount subtracted from the total. */
  extraDiscount: number;
  paid: number;
  status: InvoiceStatus;
  notes?: string;
  currency: string;
  createdAt: number;
  demo?: boolean;
}

export interface LedgerEntry {
  id: string;
  date: string;
  type: TransactionType;
  amount: number;
  category: string;
  accountId: string;
  partyId?: string;
  invoiceId?: string;
  description: string;
  method: 'cash' | 'bank' | 'card' | 'cheque' | 'other';
  createdAt: number;
  demo?: boolean;
}

export interface Category {
  id: string;
  name: string;
  type: TransactionType;
  color: string;
  demo?: boolean;
}

export interface AccountingSettings {
  companyName: string;
  currency: string;
  taxRate: number;
  invoicePrefix: string;
  nextInvoiceNumber: number;
  fiscalYearStart: number;
}

/* ------------------------------------------------------------------ */
/* Browser (simulated Chrome)                                          */
/* ------------------------------------------------------------------ */

export interface BrowserTab {
  id: string;
  title: string;
  url: string;
  /** Internal simulated pages use `win://` schemes. */
  internal: boolean;
  history: string[];
  historyIndex: number;
  loading: boolean;
  error?: string;
  favicon?: string;
  pinned?: boolean;
}

export interface BrowserDownload {
  id: string;
  name: string;
  url: string;
  at: number;
  size?: number;
  status: 'done' | 'simulated';
  note?: string;
}

export interface BrowserSettings {
  homepage: string;
  /** Search template used for address-bar queries (ends with the query prefix). */
  searchEngine: string;
  showBookmarksBar: boolean;
  blockThirdPartyFrames: boolean;
  confirmOnClose: boolean;
}

export interface Bookmark {
  id: string;
  title: string;
  url: string;
}

export interface HistoryEntry {
  id: string;
  title: string;
  url: string;
  visitedAt: number;
}

/* ------------------------------------------------------------------ */
/* Document models                                                     */
/* ------------------------------------------------------------------ */

export interface WordDocument {
  version: 1;
  /** Sanitised HTML produced by the editor. */
  html: string;
  title: string;
  pageSize: 'A4' | 'Letter';
  margins: { top: number; right: number; bottom: number; left: number };
  wordCount: number;
  updatedAt: number;
}

export type CellFormat = 'general' | 'number' | 'currency' | 'percent' | 'date' | 'text';

export interface CellStyle {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color?: string;
  background?: string;
  align?: 'left' | 'center' | 'right';
  format?: CellFormat;
  decimals?: number;
  borders?: { top?: boolean; bottom?: boolean; left?: boolean; right?: boolean };
}

export interface SheetCell {
  /** Raw user input. Leading `=` marks a formula. */
  v: string;
  s?: CellStyle;
}

export interface SheetChart {
  id: string;
  type: 'bar' | 'line' | 'pie';
  title: string;
  /** Range the chart reads, e.g. "A1:B8". */
  range: string;
  /** Column holding the labels (defaults to the first column of the range). */
  labelColumn?: string;
}

export interface SpreadsheetSheet {
  id: string;
  name: string;
  rows: number;
  cols: number;
  cells: Record<string, SheetCell>;
  colWidths: Record<string, number>;
  rowHeights: Record<string, number>;
  frozenRows: number;
  frozenCols: number;
  charts?: SheetChart[];
}

export interface SpreadsheetDocument {
  version: 1;
  sheets: SpreadsheetSheet[];
  activeSheetId: string;
  updatedAt: number;
}

export type SlideElementType = 'text' | 'image' | 'shape' | 'title';

export interface SlideElement {
  id: string;
  type: SlideElementType;
  x: number;
  y: number;
  w: number;
  h: number;
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  align?: 'left' | 'center' | 'right';
  bold?: boolean;
  src?: string;
  shape?: 'rect' | 'ellipse' | 'triangle' | 'line';
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  rotation?: number;
  z?: number;
}

export interface Slide {
  id: string;
  layout: 'title' | 'title-content' | 'blank' | 'two-column' | 'section';
  background: string;
  elements: SlideElement[];
  notes?: string;
}

export interface PresentationDocument {
  version: 1;
  slides: Slide[];
  theme: string;
  updatedAt: number;
}

export interface NoteDocument {
  version: 1;
  title: string;
  body: string;
  color: string;
  pinned: boolean;
  tags: string[];
  updatedAt: number;
}

/* ------------------------------------------------------------------ */
/* Misc                                                                */
/* ------------------------------------------------------------------ */

export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: string;
  shortcut?: string;
  disabled?: boolean;
  danger?: boolean;
  checked?: boolean;
  separator?: boolean;
  submenu?: ContextMenuItem[];
  action?: () => void;
}

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  time?: string;
  durationMinutes?: number;
  color: string;
  notes?: string;
}

export interface PhotoItem {
  id: string;
  title: string;
  src: string;
  width: number;
  height: number;
  createdAt: number;
  favorite?: boolean;
  album?: string;
}
