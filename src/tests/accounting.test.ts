import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  inRange,
  invoiceStatus,
  invoiceTotals,
  isOverdue,
  lineTotal,
  periodRange,
  summarise,
  useAccountingStore,
} from '../stores/accountingStore';
import { db } from '../services/db';
import { isoDate } from '../services/format';
import type { Account, Invoice, InvoiceLine, LedgerEntry, Party } from '../types';

function line(description: string, quantity: number, unitPrice: number, discount = 0): InvoiceLine {
  return { id: `l-${description}`, description, quantity, unitPrice, discount };
}

function invoice(partial: Partial<Invoice>): Invoice {
  return {
    id: partial.id ?? 'inv-1',
    number: partial.number ?? 'INV-1001',
    customerId: partial.customerId ?? 'c1',
    issueDate: partial.issueDate ?? isoDate(new Date()),
    dueDate: partial.dueDate ?? isoDate(new Date(Date.now() + 30 * 86400000)),
    lines: partial.lines ?? [],
    taxRate: partial.taxRate ?? 0,
    extraDiscount: partial.extraDiscount ?? 0,
    paid: partial.paid ?? 0,
    status: partial.status ?? 'draft',
    currency: partial.currency ?? 'USD',
    createdAt: partial.createdAt ?? Date.now(),
    ...partial,
  } as Invoice;
}

function store() {
  return useAccountingStore.getState();
}

describe('invoice mathematics', () => {
  it('applies per-line discounts', () => {
    expect(lineTotal(line('Design', 2, 100))).toBe(200);
    expect(lineTotal(line('Design', 2, 100, 10))).toBe(180);
    expect(lineTotal(line('Design', 1, 99.99, 100))).toBe(0);
    expect(lineTotal(line('Design', 0, 500))).toBe(0);
  });

  it('computes subtotal, discount, tax, total, paid and due', () => {
    const totals = invoiceTotals({
      lines: [line('Website', 1, 1000, 10), line('Hosting', 12, 20)],
      taxRate: 25,
      extraDiscount: 40,
      paid: 0,
    });
    // 1000*0.9 = 900, 12*20 = 240 → 1140 gross after line discounts
    expect(totals.subtotal).toBe(1240);
    expect(totals.taxable).toBe(1100);
    expect(totals.discount).toBe(140);
    expect(totals.tax).toBe(275);
    expect(totals.total).toBe(1375);
    expect(totals.due).toBe(1375);

    const partPaid = invoiceTotals({ lines: [line('A', 1, 100)], taxRate: 0, extraDiscount: 0, paid: 40 });
    expect(partPaid.paid).toBe(40);
    expect(partPaid.due).toBe(60);

    // Overpayment never produces a negative balance.
    const overPaid = invoiceTotals({ lines: [line('A', 1, 100)], taxRate: 0, extraDiscount: 0, paid: 500 });
    expect(overPaid.paid).toBe(100);
    expect(overPaid.due).toBe(0);

    // An extra discount larger than the lines cannot create negative tax.
    const heavyDiscount = invoiceTotals({ lines: [line('A', 1, 50)], taxRate: 10, extraDiscount: 90, paid: 0 });
    expect(heavyDiscount.taxable).toBe(0);
    expect(heavyDiscount.tax).toBe(0);
    expect(heavyDiscount.total).toBe(0);
  });

  it('rounds money to cents', () => {
    const totals = invoiceTotals({ lines: [line('A', 3, 33.33)], taxRate: 9, extraDiscount: 0, paid: 0 });
    expect(totals.subtotal).toBe(99.99);
    expect(totals.tax).toBe(9);
    expect(totals.total).toBe(108.99);
    expect(totals.due).toBe(108.99);
    // Float noise never leaks into money values.
    const thirds = invoiceTotals({ lines: [line('A', 3, 0.1)], taxRate: 0, extraDiscount: 0, paid: 0 });
    expect(thirds.total).toBe(0.3);
  });

  it('derives draft / unpaid / partial / paid statuses', () => {
    expect(invoiceStatus(invoice({ status: 'draft', paid: 0, lines: [line('A', 1, 100)] }))).toBe('draft');
    expect(invoiceStatus(invoice({ status: 'unpaid', lines: [line('A', 1, 100)] }))).toBe('unpaid');
    expect(invoiceStatus(invoice({ status: 'unpaid', paid: 25, lines: [line('A', 1, 100)] }))).toBe('partial');
    expect(invoiceStatus(invoice({ status: 'unpaid', paid: 100, lines: [line('A', 1, 100)] }))).toBe('paid');
    expect(invoiceStatus(invoice({ status: 'partial', paid: 100, lines: [line('A', 1, 100)] }))).toBe('paid');
  });

  it('flags overdue invoices but never drafts or settled ones', () => {
    const yesterday = isoDate(new Date(Date.now() - 86400000));
    const tomorrow = isoDate(new Date(Date.now() + 86400000));
    expect(isOverdue(invoice({ status: 'unpaid', dueDate: yesterday }))).toBe(true);
    expect(isOverdue(invoice({ status: 'unpaid', dueDate: tomorrow }))).toBe(false);
    expect(isOverdue(invoice({ status: 'draft', dueDate: yesterday }))).toBe(false);
    expect(isOverdue(invoice({ status: 'paid', paid: 100, dueDate: yesterday, lines: [line('A', 1, 100)] }))).toBe(false);
    expect(isOverdue(invoice({ status: 'partial', paid: 100, dueDate: yesterday, lines: [line('A', 1, 100)] }))).toBe(false);
  });
});

describe('periods and reports', () => {
  it('builds inclusive period ranges', () => {
    const all = periodRange('all');
    expect(all.from).toBe('0000-01-01');
    expect(all.to).toBe('9999-12-31');

    const month = periodRange('thisMonth');
    const now = new Date();
    expect(month.from.slice(0, 7)).toBe(isoDate(now).slice(0, 7));
    expect(month.to.slice(0, 7)).toBe(isoDate(now).slice(0, 7));

    const last = periodRange('lastMonth');
    expect(last.from < month.from).toBe(true);
    expect(last.to < month.from).toBe(true);

    const year = periodRange('year');
    expect(inRange(isoDate(now), year)).toBe(true);
    expect(inRange(isoDate(now), month)).toBe(true);
    expect(inRange('1999-01-01', year)).toBe(false);
    expect(inRange(isoDate(now), periodRange('quarter'))).toBe(true);
  });

  it('summarises income, expense, margin, invoices and balances', () => {
    const today = isoDate(new Date());
    const transactions: LedgerEntry[] = [
      { id: 't1', date: today, type: 'income', amount: 1000, category: 'Sales', accountId: 'bank', method: 'bank', description: 'Sale', createdAt: Date.now() },
      { id: 't2', date: today, type: 'expense', amount: 250, category: 'Rent', accountId: 'bank', method: 'bank', description: 'Rent', createdAt: Date.now() },
      { id: 't3', date: '2000-01-01', type: 'income', amount: 5000, category: 'Old', accountId: 'bank', method: 'bank', description: 'Old sale', createdAt: Date.now() },
    ];
    const invoices: Invoice[] = [
      invoice({ id: 'i1', status: 'unpaid', issueDate: today, dueDate: isoDate(new Date(Date.now() - 86400000)), lines: [line('A', 1, 400)], paid: 100 }),
      invoice({ id: 'i2', status: 'draft', issueDate: today, lines: [line('B', 1, 999)] }),
    ];
    const parties: Party[] = [
      { id: 'c1', kind: 'customer', name: 'Acme', balance: 300, createdAt: Date.now() },
      { id: 'c2', kind: 'customer', name: 'Nordic', balance: -50, createdAt: Date.now() },
      { id: 's1', kind: 'supplier', name: 'Supplies', balance: 120, createdAt: Date.now() },
    ];
    const accounts: Account[] = [
      { id: 'bank', name: 'Bank', type: 'asset', balance: 750, currency: 'USD' },
      { id: 'cash', name: 'Cash', type: 'asset', balance: 250, currency: 'USD' },
      { id: 'loan', name: 'Loan', type: 'liability', balance: -400, currency: 'USD' },
    ];

    const summary = summarise(transactions, invoices, parties, accounts, periodRange('thisMonth'));
    expect(summary.income).toBe(1000);
    expect(summary.expense).toBe(250);
    expect(summary.profit).toBe(750);
    expect(summary.margin).toBe(75);
    expect(summary.invoiceTotal).toBe(400);
    expect(summary.invoicePaid).toBe(100);
    expect(summary.invoiceDue).toBe(300);
    expect(summary.overdue).toBe(300);
    expect(summary.receivables).toBe(300);
    expect(summary.payables).toBe(120);
    expect(summary.cash).toBe(1000);
    expect(summary.byCategory.map((entry) => entry.name)).toEqual(['Sales', 'Rent']);
    expect(summary.byMonth[0].month).toBe(today.slice(0, 7));

    // The old transaction is excluded from this month but included in "all time".
    const all = summarise(transactions, invoices, parties, accounts, periodRange('all'));
    expect(all.income).toBe(6000);
  });
});

describe('accounting store (IndexedDB backed)', () => {
  beforeEach(async () => {
    await Promise.all([db.parties.clear(), db.accounts.clear(), db.invoices.clear(), db.transactions.clear(), db.categories.clear(), db.accountingSettings.clear()]);
    useAccountingStore.setState({
      hydrated: false,
      storageOk: true,
      parties: [],
      accounts: [],
      invoices: [],
      transactions: [],
      categories: [],
      settings: DEFAULT_SETTINGS,
    });
    await store().hydrate();
  });

  it('seeds labelled demo data on first run', () => {
    expect(store().parties.length).toBeGreaterThan(0);
    expect(store().accounts.length).toBeGreaterThan(0);
    expect(store().invoices.length).toBeGreaterThan(0);
    expect(store().transactions.length).toBeGreaterThan(0);
    expect(store().categories.length).toBeGreaterThan(0);
    expect(store().parties.every((party) => party.demo === true)).toBe(true);
    expect(store().settings.companyName).toBeTruthy();
  });

  it('creates, updates and deletes customers and suppliers', async () => {
    const id = await store().saveParty({ name: '  Test Kund  ', kind: 'customer', email: 'test@example.com', balance: 0 });
    expect(store().parties.find((party) => party.id === id)?.name).toBe('Test Kund');
    expect((await db.parties.get(id))?.email).toBe('test@example.com');

    await store().saveParty({ id, name: 'Test Kund AB', kind: 'customer', balance: 0 });
    expect(store().parties.filter((party) => party.id === id)).toHaveLength(1);
    expect(store().parties.find((party) => party.id === id)?.name).toBe('Test Kund AB');

    await store().removeParty(id);
    expect(store().parties.some((party) => party.id === id)).toBe(false);
    expect(await db.parties.get(id)).toBeUndefined();
  });

  it('refuses to delete records that are still referenced', async () => {
    const supplier = await store().saveParty({ name: 'Referenced Supplier', kind: 'supplier' });
    const account = await store().saveAccount({ name: 'Referenced Account', type: 'asset' });
    await store().saveTransaction({ type: 'expense', amount: 10, category: 'Office', accountId: account, partyId: supplier, date: isoDate(new Date()) });

    await store().removeParty(supplier);
    expect(store().parties.some((party) => party.id === supplier)).toBe(true);

    await store().removeAccount(account);
    expect(store().accounts.some((item) => item.id === account)).toBe(true);

    // An unreferenced account can be removed.
    const spare = await store().saveAccount({ name: 'Spare', type: 'asset' });
    await store().removeAccount(spare);
    expect(store().accounts.some((item) => item.id === spare)).toBe(false);
  });

  it('manages categories', async () => {
    const id = await store().saveCategory({ name: 'Consulting', type: 'income', color: '#22c55e' });
    expect(store().categories.find((category) => category.id === id)).toMatchObject({ name: 'Consulting', type: 'income', color: '#22c55e' });
    expect((await db.categories.get(id))?.name).toBe('Consulting');

    await store().saveCategory({ id, name: 'Consulting fees', type: 'income' });
    expect(store().categories.filter((category) => category.id === id)).toHaveLength(1);
    expect(store().categories.find((category) => category.id === id)?.name).toBe('Consulting fees');

    await store().removeCategory(id);
    expect(store().categories.some((category) => category.id === id)).toBe(false);
  });

  it('runs the full customer → invoice → payment → report scenario', async () => {
    const customerId = await store().saveParty({ name: 'Scenario Customer', kind: 'customer' });
    const bankId = await store().saveAccount({ name: 'Scenario Bank', type: 'asset', balance: 0 });

    const nextNumber = store().settings.nextInvoiceNumber;
    const invoiceId = await store().saveInvoice({
      customerId,
      lines: [line('Consulting days', 4, 1000, 10), line('Travel', 1, 200)],
      taxRate: 25,
      extraDiscount: 100,
    });
    const saved = store().invoices.find((item) => item.id === invoiceId)!;
    expect(saved.status).toBe('draft');
    expect(saved.number).toBe(`${store().settings.invoicePrefix}${nextNumber}`);
    // The next number is reserved as soon as the invoice exists.
    expect(store().settings.nextInvoiceNumber).toBe(nextNumber + 1);

    const totals = invoiceTotals(saved);
    expect(totals.subtotal).toBe(4200);
    expect(totals.taxable).toBe(3700);
    expect(totals.tax).toBe(925);
    expect(totals.total).toBe(4625);
    expect(store().parties.find((party) => party.id === customerId)?.balance).toBe(0);

    await store().issueInvoice(invoiceId);
    const issued = store().invoices.find((item) => item.id === invoiceId)!;
    expect(issued.status).toBe('unpaid');
    expect(store().parties.find((party) => party.id === customerId)?.balance).toBe(4625);

    // Issuing twice must not double the receivable.
    await store().issueInvoice(invoiceId);
    expect(store().parties.find((party) => party.id === customerId)?.balance).toBe(4625);

    await store().recordPayment(invoiceId, 1000, bankId, isoDate(new Date()), 'bank');
    let current = store().invoices.find((item) => item.id === invoiceId)!;
    expect(current.status).toBe('partial');
    expect(invoiceTotals(current).due).toBe(3625);
    expect(store().parties.find((party) => party.id === customerId)?.balance).toBe(3625);
    expect(store().accounts.find((account) => account.id === bankId)?.balance).toBe(1000);
    const payment = store().transactions.find((entry) => entry.invoiceId === invoiceId)!;
    expect(payment).toMatchObject({ type: 'income', amount: 1000, partyId: customerId, accountId: bankId, method: 'bank' });

    // Paying the rest settles the invoice.
    await store().recordPayment(invoiceId, 3625, bankId, isoDate(new Date()), 'bank');
    current = store().invoices.find((item) => item.id === invoiceId)!;
    expect(current.status).toBe('paid');
    expect(invoiceTotals(current).due).toBe(0);
    expect(store().parties.find((party) => party.id === customerId)?.balance).toBe(0);
    expect(store().accounts.find((account) => account.id === bankId)?.balance).toBe(4625);

    // Reports reflect the recorded activity for the current period.
    const summary = summarise(store().transactions, store().invoices, store().parties, store().accounts, periodRange('all'));
    expect(summary.invoiceTotal).toBeGreaterThanOrEqual(4625);
    expect(summary.cash).toBeGreaterThanOrEqual(4625);
    // Our settled invoice is no longer overdue (the demo ledger keeps its own).
    expect(isOverdue(store().invoices.find((item) => item.id === invoiceId)!)).toBe(false);
    expect(invoiceTotals(store().invoices.find((item) => item.id === invoiceId)!).due).toBe(0);

    // Everything survived a write to IndexedDB.
    expect((await db.invoices.get(invoiceId))?.status).toBe('paid');
    expect((await db.parties.get(customerId))?.balance).toBe(0);
    expect(await db.transactions.count()).toBe(store().transactions.length);
  });

  it('clamps payments and rejects empty ones', async () => {
    const customerId = await store().saveParty({ name: 'Clamp Customer', kind: 'customer' });
    const bankId = await store().saveAccount({ name: 'Clamp Bank', type: 'asset', balance: 0 });
    const invoiceId = await store().saveInvoice({ customerId, lines: [line('Item', 1, 100)], taxRate: 0 });
    await store().issueInvoice(invoiceId);

    const before = store().transactions.length;
    await store().recordPayment(invoiceId, 0, bankId, isoDate(new Date()), 'cash');
    await store().recordPayment(invoiceId, -50, bankId, isoDate(new Date()), 'cash');
    expect(store().transactions).toHaveLength(before);
    expect(store().invoices.find((item) => item.id === invoiceId)?.status).toBe('unpaid');

    // An overpayment is clamped to the outstanding balance.
    await store().recordPayment(invoiceId, 9999, bankId, isoDate(new Date()), 'cash');
    const current = store().invoices.find((item) => item.id === invoiceId)!;
    expect(current.paid).toBe(100);
    expect(current.status).toBe('paid');
    expect(store().accounts.find((account) => account.id === bankId)?.balance).toBe(100);
    expect(store().parties.find((party) => party.id === customerId)?.balance).toBe(0);
  });

  it('updates account and party balances for income and expense entries', async () => {
    const accountId = await store().saveAccount({ name: 'Ops Account', type: 'asset', balance: 100 });
    const supplierId = await store().saveParty({ name: 'Ops Supplier', kind: 'supplier', balance: 0 });

    const incomeId = await store().saveTransaction({ type: 'income', amount: 500, category: 'Sales', accountId, date: isoDate(new Date()) });
    expect(store().accounts.find((account) => account.id === accountId)?.balance).toBe(600);

    const expenseId = await store().saveTransaction({ type: 'expense', amount: 200, category: 'Rent', accountId, partyId: supplierId, date: isoDate(new Date()) });
    expect(store().accounts.find((account) => account.id === accountId)?.balance).toBe(400);
    expect(store().parties.find((party) => party.id === supplierId)?.balance).toBe(200);

    // Editing the amount corrects both balances by the difference.
    await store().saveTransaction({ id: expenseId, type: 'expense', amount: 350, category: 'Rent', accountId, partyId: supplierId, date: isoDate(new Date()) });
    expect(store().accounts.find((account) => account.id === accountId)?.balance).toBe(250);
    expect(store().parties.find((party) => party.id === supplierId)?.balance).toBe(350);

    // Moving the entry to another party reverses the old one.
    const otherId = await store().saveParty({ name: 'Other Supplier', kind: 'supplier', balance: 0 });
    await store().saveTransaction({ id: expenseId, type: 'expense', amount: 350, category: 'Rent', accountId, partyId: otherId, date: isoDate(new Date()) });
    expect(store().parties.find((party) => party.id === supplierId)?.balance).toBe(0);
    expect(store().parties.find((party) => party.id === otherId)?.balance).toBe(350);

    // Deleting reverses the account and the party.
    await store().removeTransaction(expenseId);
    expect(store().accounts.find((account) => account.id === accountId)?.balance).toBe(600);
    expect(store().parties.find((party) => party.id === otherId)?.balance).toBe(0);

    await store().removeTransaction(incomeId);
    expect(store().accounts.find((account) => account.id === accountId)?.balance).toBe(100);
    expect(store().transactions.some((entry) => entry.id === incomeId)).toBe(false);
  });

  it('deleting an invoice removes its payments from the ledger', async () => {
    const customerId = await store().saveParty({ name: 'Delete Customer', kind: 'customer' });
    const bankId = await store().saveAccount({ name: 'Delete Bank', type: 'asset', balance: 0 });
    const invoiceId = await store().saveInvoice({ customerId, lines: [line('Item', 1, 500)], taxRate: 0 });
    await store().issueInvoice(invoiceId);
    await store().recordPayment(invoiceId, 200, bankId, isoDate(new Date()), 'bank');
    expect(store().transactions.some((entry) => entry.invoiceId === invoiceId)).toBe(true);

    await store().removeInvoice(invoiceId);
    expect(store().invoices.some((item) => item.id === invoiceId)).toBe(false);
    expect(store().transactions.some((entry) => entry.invoiceId === invoiceId)).toBe(false);
    expect(await db.invoices.get(invoiceId)).toBeUndefined();
  });

  it('persists accounting settings and reloads everything from IndexedDB', async () => {
    await store().updateSettings({ companyName: 'Nordic Concept AB', currency: 'SEK', taxRate: 12, invoicePrefix: 'F-', nextInvoiceNumber: 2000 });
    const customerId = await store().saveParty({ name: 'Persisted Customer', kind: 'customer' });
    const invoiceId = await store().saveInvoice({ customerId, lines: [line('Retainer', 1, 10000)], taxRate: 12 });
    await store().issueInvoice(invoiceId);

    expect(store().invoices.find((item) => item.id === invoiceId)?.number).toBe('F-2000');

    // Simulate a reload.
    useAccountingStore.setState({ hydrated: false, parties: [], accounts: [], invoices: [], transactions: [], categories: [], settings: DEFAULT_SETTINGS });
    await store().hydrate();

    expect(store().settings).toMatchObject({ companyName: 'Nordic Concept AB', currency: 'SEK', taxRate: 12, invoicePrefix: 'F-' });
    expect(store().parties.some((party) => party.id === customerId)).toBe(true);
    expect(store().invoices.find((item) => item.id === invoiceId)?.status).toBe('unpaid');
    expect(store().parties.find((party) => party.id === customerId)?.balance).toBe(11200);
  });

  it('restores demo data and clears everything', async () => {
    await store().clearAll();
    expect(store().parties).toHaveLength(0);
    expect(store().accounts).toHaveLength(0);
    expect(store().invoices).toHaveLength(0);
    expect(store().transactions).toHaveLength(0);
    expect(store().settings.nextInvoiceNumber).toBe(DEFAULT_SETTINGS.nextInvoiceNumber);
    expect(await db.parties.count()).toBe(0);

    await store().resetDemo();
    expect(store().parties.length).toBeGreaterThan(0);
    expect(store().invoices.length).toBeGreaterThan(0);
    expect(store().parties.every((party) => party.demo === true)).toBe(true);
    expect(await db.invoices.count()).toBe(store().invoices.length);
  });
});
