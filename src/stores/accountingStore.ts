import { create } from 'zustand';
import type { Account, AccountingSettings, Category, Invoice, InvoiceLine, LedgerEntry, Party, TransactionType } from '../types';
import { db, initDatabase, safeWrite } from '../services/db';
import { uid } from '../services/id';
import { isoDate } from '../services/format';
import { notify } from './notificationStore';

/**
 * Accounting ledger.
 *
 * All numbers are computed from the stored records — nothing is faked. Every
 * write goes through `safeWrite`, so a full or blocked IndexedDB degrades to
 * in-memory state with a visible warning instead of losing the session.
 */

export interface InvoiceTotals {
  subtotal: number;
  discount: number;
  taxable: number;
  tax: number;
  total: number;
  paid: number;
  due: number;
}

/** Money is kept at cent precision so totals never drift through float noise. */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function lineTotal(line: InvoiceLine): number {
  const gross = line.quantity * line.unitPrice;
  return round2(gross * (1 - (line.discount || 0) / 100));
}

export function invoiceTotals(invoice: Pick<Invoice, 'lines' | 'taxRate' | 'extraDiscount' | 'paid'>): InvoiceTotals {
  const subtotal = round2(invoice.lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0));
  const afterLineDiscounts = round2(invoice.lines.reduce((sum, line) => sum + lineTotal(line), 0));
  const extra = round2(invoice.extraDiscount || 0);
  const discount = round2(subtotal - afterLineDiscounts + extra);
  const taxable = round2(Math.max(0, afterLineDiscounts - extra));
  const tax = round2(taxable * ((invoice.taxRate || 0) / 100));
  const total = round2(taxable + tax);
  const paid = Math.min(round2(invoice.paid || 0), total);
  return { subtotal, discount, taxable, tax, total, paid, due: round2(Math.max(0, total - paid)) };
}

export function invoiceStatus(invoice: Invoice): Invoice['status'] {
  if (invoice.status === 'draft') return 'draft';
  const totals = invoiceTotals(invoice);
  if (totals.paid <= 0) return 'unpaid';
  if (totals.due <= 0.005) return 'paid';
  return 'partial';
}

export function isOverdue(invoice: Invoice, today = isoDate(new Date())): boolean {
  return invoice.status !== 'draft' && invoiceStatus(invoice) !== 'paid' && invoice.dueDate < today;
}

export const DEFAULT_SETTINGS: AccountingSettings = {
  companyName: 'Concept Studio',
  currency: 'USD',
  taxRate: 9,
  invoicePrefix: 'INV-',
  nextInvoiceNumber: 1001,
  fiscalYearStart: 1,
};

export interface AccountingState {
  hydrated: boolean;
  storageOk: boolean;
  parties: Party[];
  accounts: Account[];
  invoices: Invoice[];
  transactions: LedgerEntry[];
  categories: Category[];
  settings: AccountingSettings;

  hydrate: () => Promise<void>;
  resetDemo: () => Promise<void>;
  clearAll: () => Promise<void>;

  saveParty: (party: Partial<Party> & { name: string; kind: Party['kind'] }) => Promise<string>;
  removeParty: (id: string) => Promise<void>;
  saveAccount: (account: Partial<Account> & { name: string; type: Account['type'] }) => Promise<string>;
  removeAccount: (id: string) => Promise<void>;
  saveCategory: (category: Partial<Category> & { name: string; type: TransactionType }) => Promise<string>;
  removeCategory: (id: string) => Promise<void>;

  saveInvoice: (invoice: Partial<Invoice> & { customerId: string }) => Promise<string>;
  removeInvoice: (id: string) => Promise<void>;
  issueInvoice: (id: string) => Promise<void>;
  recordPayment: (invoiceId: string, amount: number, accountId: string, date: string, method: LedgerEntry['method']) => Promise<void>;

  saveTransaction: (entry: Partial<LedgerEntry> & { type: TransactionType; amount: number; category: string }) => Promise<string>;
  removeTransaction: (id: string) => Promise<void>;

  updateSettings: (patch: Partial<AccountingSettings>) => Promise<void>;
}

/* ------------------------------------------------------------------ */
/* Demo seed                                                           */
/* ------------------------------------------------------------------ */

function demoSeed() {
  const today = new Date();
  const daysAgo = (days: number) => {
    const date = new Date(today);
    date.setDate(date.getDate() - days);
    return isoDate(date);
  };
  const daysAhead = (days: number) => {
    const date = new Date(today);
    date.setDate(date.getDate() + days);
    return isoDate(date);
  };

  const accounts: Account[] = [
    { id: 'acc-cash', name: 'Cash', type: 'asset', balance: 4200, currency: 'USD', demo: true },
    { id: 'acc-bank', name: 'Bank (demo)', type: 'asset', balance: 28750, currency: 'USD', demo: true },
    { id: 'acc-ap', name: 'Accounts payable', type: 'liability', balance: 3100, currency: 'USD', demo: true },
    { id: 'acc-sales', name: 'Sales revenue', type: 'income', balance: 0, currency: 'USD', demo: true },
    { id: 'acc-exp', name: 'Operating expenses', type: 'expense', balance: 0, currency: 'USD', demo: true },
  ];

  const parties: Party[] = [
    { id: 'cus-north', kind: 'customer', name: 'Northwind Traders', contact: 'Dana Rezaei', email: 'dana@northwind.demo', phone: '+1 555 0100', balance: 5830, createdAt: Date.now() - 86400000 * 40, demo: true },
    { id: 'cus-lumen', kind: 'customer', name: 'Lumen Labs', contact: 'Sam Okafor', email: 'sam@lumen.demo', balance: 2160, createdAt: Date.now() - 86400000 * 25, demo: true },
    { id: 'cus-atlas', kind: 'customer', name: 'Atlas Retail', contact: 'Mia Chen', email: 'mia@atlas.demo', balance: 0, createdAt: Date.now() - 86400000 * 12, demo: true },
    { id: 'sup-cloud', kind: 'supplier', name: 'Cloudhost Ltd', contact: 'Billing', email: 'billing@cloudhost.demo', balance: 1800, createdAt: Date.now() - 86400000 * 60, demo: true },
    { id: 'sup-print', kind: 'supplier', name: 'Printworks', contact: 'Orders', balance: 1300, createdAt: Date.now() - 86400000 * 30, demo: true },
  ];

  const categories: Category[] = [
    { id: 'cat-sales', name: 'Product sales', type: 'income', color: '#16a34a', demo: true },
    { id: 'cat-services', name: 'Services', type: 'income', color: '#0891b2', demo: true },
    { id: 'cat-other', name: 'Other income', type: 'income', color: '#7c3aed', demo: true },
    { id: 'cat-hosting', name: 'Hosting & software', type: 'expense', color: '#dc2626', demo: true },
    { id: 'cat-office', name: 'Office', type: 'expense', color: '#ea580c', demo: true },
    { id: 'cat-payroll', name: 'Payroll', type: 'expense', color: '#db2777', demo: true },
    { id: 'cat-marketing', name: 'Marketing', type: 'expense', color: '#ca8a04', demo: true },
  ];

  const line = (description: string, quantity: number, unitPrice: number, discount = 0): InvoiceLine => ({
    id: uid('line'),
    description,
    quantity,
    unitPrice,
    discount,
  });

  const invoices: Invoice[] = [
    {
      id: 'inv-1001',
      number: 'INV-1001',
      customerId: 'cus-north',
      issueDate: daysAgo(24),
      dueDate: daysAgo(4),
      lines: [line('Design system audit', 1, 3200), line('Component library', 12, 180, 5)],
      taxRate: 9,
      extraDiscount: 0,
      paid: 1500,
      status: 'partial',
      currency: 'USD',
      createdAt: Date.now() - 86400000 * 24,
      notes: 'Deposit received, remainder overdue.',
      demo: true,
    },
    {
      id: 'inv-1002',
      number: 'INV-1002',
      customerId: 'cus-lumen',
      issueDate: daysAgo(11),
      dueDate: daysAhead(3),
      lines: [line('Monthly retainer', 1, 2400)],
      taxRate: 9,
      extraDiscount: 200,
      paid: 0,
      status: 'unpaid',
      currency: 'USD',
      createdAt: Date.now() - 86400000 * 11,
      demo: true,
    },
    {
      id: 'inv-1003',
      number: 'INV-1003',
      customerId: 'cus-atlas',
      issueDate: daysAgo(30),
      dueDate: daysAgo(10),
      lines: [line('Store launch package', 1, 4800)],
      taxRate: 9,
      extraDiscount: 0,
      paid: 5232,
      status: 'paid',
      currency: 'USD',
      createdAt: Date.now() - 86400000 * 30,
      demo: true,
    },
    {
      id: 'inv-1004',
      number: 'INV-1004',
      customerId: 'cus-north',
      issueDate: daysAgo(2),
      dueDate: daysAhead(28),
      lines: [line('Accessibility review', 8, 220)],
      taxRate: 9,
      extraDiscount: 0,
      paid: 0,
      status: 'draft',
      currency: 'USD',
      createdAt: Date.now() - 86400000 * 2,
      demo: true,
    },
  ];

  const transactions: LedgerEntry[] = [
    { id: uid('tx'), date: daysAgo(20), type: 'income', amount: 1500, category: 'Services', accountId: 'acc-bank', partyId: 'cus-north', invoiceId: 'inv-1001', description: 'Deposit for INV-1001', method: 'bank', createdAt: Date.now() - 86400000 * 20, demo: true },
    { id: uid('tx'), date: daysAgo(10), type: 'income', amount: 5232, category: 'Product sales', accountId: 'acc-bank', partyId: 'cus-atlas', invoiceId: 'inv-1003', description: 'INV-1003 settled', method: 'bank', createdAt: Date.now() - 86400000 * 10, demo: true },
    { id: uid('tx'), date: daysAgo(15), type: 'expense', amount: 1800, category: 'Hosting & software', accountId: 'acc-bank', partyId: 'sup-cloud', description: 'Cloud hosting Q3', method: 'card', createdAt: Date.now() - 86400000 * 15, demo: true },
    { id: uid('tx'), date: daysAgo(8), type: 'expense', amount: 1300, category: 'Office', accountId: 'acc-cash', partyId: 'sup-print', description: 'Printed collateral', method: 'cash', createdAt: Date.now() - 86400000 * 8, demo: true },
    { id: uid('tx'), date: daysAgo(5), type: 'expense', amount: 6400, category: 'Payroll', accountId: 'acc-bank', description: 'Salaries', method: 'bank', createdAt: Date.now() - 86400000 * 5, demo: true },
    { id: uid('tx'), date: daysAgo(3), type: 'income', amount: 900, category: 'Other income', accountId: 'acc-cash', description: 'Workshop tickets', method: 'cash', createdAt: Date.now() - 86400000 * 3, demo: true },
  ];

  return { accounts, parties, categories, invoices, transactions, settings: { ...DEFAULT_SETTINGS, nextInvoiceNumber: 1005 } };
}

/* ------------------------------------------------------------------ */
/* Store                                                               */
/* ------------------------------------------------------------------ */

export const useAccountingStore = create<AccountingState>()((set, get) => ({
  hydrated: false,
  storageOk: true,
  parties: [],
  accounts: [],
  invoices: [],
  transactions: [],
  categories: [],
  settings: DEFAULT_SETTINGS,

  hydrate: async () => {
    if (get().hydrated) return;
    const storageOk = await initDatabase();
    try {
      const [parties, accounts, invoices, transactions, categories, settingsRow] = await Promise.all([
        db.parties.toArray(),
        db.accounts.toArray(),
        db.invoices.toArray(),
        db.transactions.toArray(),
        db.categories.toArray(),
        db.accountingSettings.get('current'),
      ]);

      if (!parties.length && !invoices.length && !accounts.length) {
        const seed = demoSeed();
        await Promise.all([
          db.parties.bulkPut(seed.parties),
          db.accounts.bulkPut(seed.accounts),
          db.invoices.bulkPut(seed.invoices),
          db.transactions.bulkPut(seed.transactions),
          db.categories.bulkPut(seed.categories),
          db.accountingSettings.put({ key: 'current', ...seed.settings }),
        ]);
        set({
          hydrated: true,
          storageOk,
          parties: seed.parties,
          accounts: seed.accounts,
          invoices: seed.invoices,
          transactions: seed.transactions,
          categories: seed.categories,
          settings: seed.settings,
        });
        return;
      }

      set({
        hydrated: true,
        storageOk,
        parties,
        accounts,
        invoices,
        transactions,
        categories,
        settings: settingsRow ? { ...DEFAULT_SETTINGS, ...settingsRow } : DEFAULT_SETTINGS,
      });
    } catch (error) {
      console.warn('[Accounting] hydrate failed, starting from demo data in memory', error);
      const seed = demoSeed();
      set({ hydrated: true, storageOk: false, ...seed });
      notify('Accounting storage unavailable', 'Running in memory — changes will not survive a reload.', 'warning', 'accounting');
    }
  },

  resetDemo: async () => {
    const seed = demoSeed();
    await safeWrite(async () => {
      await Promise.all([db.parties.clear(), db.accounts.clear(), db.invoices.clear(), db.transactions.clear(), db.categories.clear()]);
      await Promise.all([
        db.parties.bulkPut(seed.parties),
        db.accounts.bulkPut(seed.accounts),
        db.invoices.bulkPut(seed.invoices),
        db.transactions.bulkPut(seed.transactions),
        db.categories.bulkPut(seed.categories),
        db.accountingSettings.put({ key: 'current', ...seed.settings }),
      ]);
    });
    set({ ...seed });
  },

  clearAll: async () => {
    await safeWrite(async () => {
      await Promise.all([db.parties.clear(), db.accounts.clear(), db.invoices.clear(), db.transactions.clear(), db.categories.clear()]);
      await db.accountingSettings.put({ key: 'current', ...DEFAULT_SETTINGS, nextInvoiceNumber: 1001 });
    });
    set({ parties: [], accounts: [], invoices: [], transactions: [], categories: [], settings: DEFAULT_SETTINGS });
  },

  saveParty: async (party) => {
    const record: Party = {
      id: party.id ?? uid('party'),
      kind: party.kind,
      name: party.name.trim(),
      contact: party.contact,
      email: party.email,
      phone: party.phone,
      address: party.address,
      balance: party.balance ?? 0,
      createdAt: party.createdAt ?? Date.now(),
      demo: party.demo,
    };
    await safeWrite(() => db.parties.put(record));
    set((state) => {
      const exists = state.parties.some((item) => item.id === record.id);
      return { parties: exists ? state.parties.map((item) => (item.id === record.id ? record : item)) : [...state.parties, record] };
    });
    return record.id;
  },

  removeParty: async (id) => {
    const used = get().invoices.some((invoice) => invoice.customerId === id) || get().transactions.some((entry) => entry.partyId === id);
    if (used) {
      notify('Cannot delete', 'This party is referenced by invoices or transactions.', 'warning', 'accounting');
      return;
    }
    await safeWrite(() => db.parties.delete(id));
    set((state) => ({ parties: state.parties.filter((party) => party.id !== id) }));
  },

  saveAccount: async (account) => {
    const record: Account = {
      id: account.id ?? uid('acc'),
      name: account.name.trim(),
      type: account.type,
      balance: account.balance ?? 0,
      currency: account.currency ?? get().settings.currency,
      demo: account.demo,
    };
    await safeWrite(() => db.accounts.put(record));
    set((state) => {
      const exists = state.accounts.some((item) => item.id === record.id);
      return { accounts: exists ? state.accounts.map((item) => (item.id === record.id ? record : item)) : [...state.accounts, record] };
    });
    return record.id;
  },

  removeAccount: async (id) => {
    const used = get().transactions.some((entry) => entry.accountId === id);
    if (used) {
      notify('Cannot delete', 'This account has transactions.', 'warning', 'accounting');
      return;
    }
    await safeWrite(() => db.accounts.delete(id));
    set((state) => ({ accounts: state.accounts.filter((account) => account.id !== id) }));
  },

  saveCategory: async (category) => {
    const record: Category = {
      id: category.id ?? uid('cat'),
      name: category.name.trim(),
      type: category.type,
      color: category.color ?? '#2563eb',
      demo: category.demo,
    };
    await safeWrite(() => db.categories.put(record));
    set((state) => {
      const exists = state.categories.some((item) => item.id === record.id);
      return { categories: exists ? state.categories.map((item) => (item.id === record.id ? record : item)) : [...state.categories, record] };
    });
    return record.id;
  },

  removeCategory: async (id) => {
    await safeWrite(() => db.categories.delete(id));
    set((state) => ({ categories: state.categories.filter((category) => category.id !== id) }));
  },

  saveInvoice: async (invoice) => {
    const state = get();
    const id = invoice.id ?? uid('inv');
    const existing = state.invoices.find((item) => item.id === id);
    const number = invoice.number ?? existing?.number ?? `${state.settings.invoicePrefix}${state.settings.nextInvoiceNumber}`;
    const record: Invoice = {
      id,
      number,
      customerId: invoice.customerId,
      issueDate: invoice.issueDate ?? isoDate(new Date()),
      dueDate: invoice.dueDate ?? isoDate(new Date(Date.now() + 30 * 86400000)),
      lines: invoice.lines ?? [],
      taxRate: invoice.taxRate ?? state.settings.taxRate,
      extraDiscount: invoice.extraDiscount ?? 0,
      paid: invoice.paid ?? existing?.paid ?? 0,
      status: invoice.status ?? existing?.status ?? 'draft',
      notes: invoice.notes,
      currency: invoice.currency ?? state.settings.currency,
      createdAt: existing?.createdAt ?? Date.now(),
      demo: invoice.demo ?? existing?.demo,
    };
    await safeWrite(async () => {
      await db.invoices.put(record);
      if (!existing) {
        const nextNumber = Number(record.number.replace(/\D/g, '')) + 1;
        if (Number.isFinite(nextNumber) && nextNumber > state.settings.nextInvoiceNumber) {
          await db.accountingSettings.put({ key: 'current', ...state.settings, nextInvoiceNumber: nextNumber });
        }
      }
    });
    set((current) => ({
      invoices: existing ? current.invoices.map((item) => (item.id === id ? record : item)) : [...current.invoices, record],
      settings: existing
        ? current.settings
        : { ...current.settings, nextInvoiceNumber: Math.max(current.settings.nextInvoiceNumber, Number(record.number.replace(/\D/g, '')) + 1 || current.settings.nextInvoiceNumber) },
    }));
    return id;
  },

  removeInvoice: async (id) => {
    const related = get().transactions.filter((entry) => entry.invoiceId === id);
    await safeWrite(async () => {
      await db.invoices.delete(id);
      if (related.length) await db.transactions.bulkDelete(related.map((entry) => entry.id));
    });
    set((state) => ({
      invoices: state.invoices.filter((invoice) => invoice.id !== id),
      transactions: state.transactions.filter((entry) => entry.invoiceId !== id),
    }));
  },

  issueInvoice: async (id) => {
    const invoice = get().invoices.find((item) => item.id === id);
    if (!invoice || invoice.status !== 'draft') return;
    const totals = invoiceTotals(invoice);
    const updated: Invoice = { ...invoice, status: totals.paid > 0 ? 'partial' : 'unpaid' };
    await safeWrite(async () => {
      await db.invoices.put(updated);
      await db.parties.bulkPut(
        get().parties.map((party) => (party.id === updated.customerId ? { ...party, balance: party.balance + totals.due } : party)),
      );
    });
    set((state) => ({
      invoices: state.invoices.map((item) => (item.id === id ? updated : item)),
      parties: state.parties.map((party) => (party.id === updated.customerId ? { ...party, balance: party.balance + totals.due } : party)),
    }));
    notify('Invoice issued', `${updated.number} · due ${updated.dueDate}`, 'success', 'accounting');
  },

  recordPayment: async (invoiceId, amount, accountId, date, method) => {
    const state = get();
    const invoice = state.invoices.find((item) => item.id === invoiceId);
    if (!invoice) return;
    const totals = invoiceTotals(invoice);
    const payment = Math.max(0, Math.min(amount, totals.due));
    if (payment <= 0) {
      notify('Nothing to record', 'The payment amount must be between 0 and the outstanding balance.', 'warning', 'accounting');
      return;
    }
    const updated: Invoice = { ...invoice, paid: totals.paid + payment };
    updated.status = invoiceStatus(updated);
    const entry: LedgerEntry = {
      id: uid('tx'),
      date,
      type: 'income',
      amount: payment,
      category: 'Product sales',
      accountId,
      partyId: invoice.customerId,
      invoiceId: invoice.id,
      description: `Payment for ${invoice.number}`,
      method,
      createdAt: Date.now(),
    };
    await safeWrite(async () => {
      await db.invoices.put(updated);
      await db.transactions.put(entry);
      await db.accounts.bulkPut(
        state.accounts.map((account) => (account.id === accountId ? { ...account, balance: account.balance + payment } : account)),
      );
      await db.parties.bulkPut(
        state.parties.map((party) => (party.id === invoice.customerId ? { ...party, balance: party.balance - payment } : party)),
      );
    });
    set((current) => ({
      invoices: current.invoices.map((item) => (item.id === invoiceId ? updated : item)),
      transactions: [entry, ...current.transactions],
      accounts: current.accounts.map((account) => (account.id === accountId ? { ...account, balance: account.balance + payment } : account)),
      parties: current.parties.map((party) => (party.id === invoice.customerId ? { ...party, balance: party.balance - payment } : party)),
    }));
    notify('Payment recorded', `${invoice.number} · ${payment.toFixed(2)}`, 'success', 'accounting');
  },

  saveTransaction: async (entry) => {
    const state = get();
    const id = entry.id ?? uid('tx');
    const existing = state.transactions.find((item) => item.id === id);
    const record: LedgerEntry = {
      id,
      date: entry.date ?? isoDate(new Date()),
      type: entry.type,
      amount: Math.abs(entry.amount),
      category: entry.category,
      accountId: entry.accountId ?? state.accounts[0]?.id ?? '',
      partyId: entry.partyId,
      invoiceId: entry.invoiceId,
      description: entry.description ?? '',
      method: entry.method ?? 'bank',
      createdAt: existing?.createdAt ?? Date.now(),
      demo: entry.demo ?? existing?.demo,
    };

    const delta = record.type === 'income' ? record.amount : -record.amount;
    const previousDelta = existing ? (existing.type === 'income' ? existing.amount : -existing.amount) : 0;
    const accountDelta = delta - previousDelta;
    // An expense raises what a supplier is owed; an income entry lowers a customer balance.
    const partyEffect = (partyId: string | undefined, type: TransactionType, amount: number) =>
      partyId ? (type === 'expense' ? amount : -amount) : 0;
    const adjustments = new Map<string, number>();
    if (existing?.partyId) {
      adjustments.set(existing.partyId, -partyEffect(existing.partyId, existing.type, existing.amount));
    }
    const nextEffect = partyEffect(record.partyId, record.type, record.amount);
    if (record.partyId && nextEffect !== 0) {
      adjustments.set(record.partyId, (adjustments.get(record.partyId) ?? 0) + nextEffect);
    }
    const partyChanges = [...adjustments.entries()].filter(([, amount]) => amount !== 0);

    await safeWrite(async () => {
      await db.transactions.put(record);
      await db.accounts.bulkPut(state.accounts.map((account) => (account.id === record.accountId ? { ...account, balance: account.balance + accountDelta } : account)));
      if (partyChanges.length) {
        await db.parties.bulkPut(
          state.parties.map((party) => {
            const change = adjustments.get(party.id);
            return change ? { ...party, balance: party.balance + change } : party;
          }),
        );
      }
    });

    set((current) => ({
      transactions: existing ? current.transactions.map((item) => (item.id === id ? record : item)) : [record, ...current.transactions],
      accounts: current.accounts.map((account) => (account.id === record.accountId ? { ...account, balance: account.balance + accountDelta } : account)),
      parties: partyChanges.length
        ? current.parties.map((party) => {
            const change = adjustments.get(party.id);
            return change ? { ...party, balance: party.balance + change } : party;
          })
        : current.parties,
    }));
    return id;
  },

  removeTransaction: async (id) => {
    const state = get();
    const entry = state.transactions.find((item) => item.id === id);
    if (!entry) return;
    const delta = entry.type === 'income' ? -entry.amount : entry.amount;
    const partyDelta = entry.partyId ? (entry.type === 'expense' ? -entry.amount : entry.amount) : 0;
    await safeWrite(async () => {
      await db.transactions.delete(id);
      await db.accounts.bulkPut(state.accounts.map((account) => (account.id === entry.accountId ? { ...account, balance: account.balance + delta } : account)));
      if (entry.partyId && partyDelta !== 0) {
        await db.parties.bulkPut(state.parties.map((party) => (party.id === entry.partyId ? { ...party, balance: party.balance + partyDelta } : party)));
      }
    });
    set((current) => ({
      transactions: current.transactions.filter((item) => item.id !== id),
      accounts: current.accounts.map((account) => (account.id === entry.accountId ? { ...account, balance: account.balance + delta } : account)),
      parties: entry.partyId && partyDelta !== 0
        ? current.parties.map((party) => (party.id === entry.partyId ? { ...party, balance: party.balance + partyDelta } : party))
        : current.parties,
    }));
  },

  updateSettings: async (patch) => {
    const next = { ...get().settings, ...patch };
    await safeWrite(() => db.accountingSettings.put({ key: 'current', ...next }));
    set({ settings: next });
  },
}));

/* ------------------------------------------------------------------ */
/* Reporting helpers (pure)                                            */
/* ------------------------------------------------------------------ */

export interface PeriodRange {
  from: string;
  to: string;
  label: string;
}

export function periodRange(period: 'thisMonth' | 'lastMonth' | 'quarter' | 'year' | 'all'): PeriodRange {
  const now = new Date();
  const iso = (date: Date) => isoDate(date);
  if (period === 'all') return { from: '0000-01-01', to: '9999-12-31', label: 'All time' };
  if (period === 'thisMonth') return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: iso(new Date(now.getFullYear(), now.getMonth() + 1, 0)), label: now.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) };
  if (period === 'lastMonth') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    return { from: iso(start), to: iso(end), label: start.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) };
  }
  if (period === 'quarter') {
    const start = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
    const end = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3 + 3, 0);
    return { from: iso(start), to: iso(end), label: `Q${Math.floor(now.getMonth() / 3) + 1} ${now.getFullYear()}` };
  }
  return { from: iso(new Date(now.getFullYear(), 0, 1)), to: iso(new Date(now.getFullYear(), 11, 31)), label: String(now.getFullYear()) };
}

export function inRange(date: string, range: PeriodRange): boolean {
  return date >= range.from && date <= range.to;
}

export interface ReportSummary {
  income: number;
  expense: number;
  profit: number;
  margin: number;
  invoiceTotal: number;
  invoicePaid: number;
  invoiceDue: number;
  overdue: number;
  receivables: number;
  payables: number;
  cash: number;
  byCategory: { name: string; value: number; type: TransactionType }[];
  byMonth: { month: string; income: number; expense: number }[];
}

export function summarise(
  transactions: LedgerEntry[],
  invoices: Invoice[],
  parties: Party[],
  accounts: Account[],
  range: PeriodRange,
): ReportSummary {
  const scoped = transactions.filter((entry) => inRange(entry.date, range));
  const income = scoped.filter((entry) => entry.type === 'income').reduce((sum, entry) => sum + entry.amount, 0);
  const expense = scoped.filter((entry) => entry.type === 'expense').reduce((sum, entry) => sum + entry.amount, 0);

  const byCategoryMap = new Map<string, { name: string; value: number; type: TransactionType }>();
  for (const entry of scoped) {
    const key = `${entry.type}:${entry.category}`;
    const existing = byCategoryMap.get(key) ?? { name: entry.category || 'Uncategorised', value: 0, type: entry.type };
    existing.value += entry.amount;
    byCategoryMap.set(key, existing);
  }

  const byMonthMap = new Map<string, { month: string; income: number; expense: number }>();
  for (const entry of scoped) {
    const month = entry.date.slice(0, 7);
    const existing = byMonthMap.get(month) ?? { month, income: 0, expense: 0 };
    if (entry.type === 'income') existing.income += entry.amount;
    else existing.expense += entry.amount;
    byMonthMap.set(month, existing);
  }

  const today = isoDate(new Date());
  let invoiceTotal = 0;
  let invoicePaid = 0;
  let overdue = 0;
  for (const invoice of invoices) {
    if (invoice.status === 'draft') continue;
    if (!inRange(invoice.issueDate, range)) continue;
    const totals = invoiceTotals(invoice);
    invoiceTotal += totals.total;
    invoicePaid += totals.paid;
    if (isOverdue(invoice, today)) overdue += totals.due;
  }

  const cash = accounts.filter((account) => account.type === 'asset').reduce((sum, account) => sum + account.balance, 0);

  return {
    income,
    expense,
    profit: income - expense,
    margin: income ? ((income - expense) / income) * 100 : 0,
    invoiceTotal,
    invoicePaid,
    invoiceDue: Math.max(0, invoiceTotal - invoicePaid),
    overdue,
    receivables: parties.filter((party) => party.kind === 'customer').reduce((sum, party) => sum + Math.max(0, party.balance), 0),
    payables: parties.filter((party) => party.kind === 'supplier').reduce((sum, party) => sum + Math.max(0, party.balance), 0),
    cash,
    byCategory: [...byCategoryMap.values()].sort((a, b) => b.value - a.value),
    byMonth: [...byMonthMap.values()].sort((a, b) => a.month.localeCompare(b.month)),
  };
}
