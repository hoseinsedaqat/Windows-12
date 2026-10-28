import { useEffect, useMemo, useState } from 'react';
import {
  LayoutDashboard,
  Users,
  Truck,
  Landmark,
  FileText,
  ArrowDownCircle,
  ArrowUpCircle,
  ArrowLeftRight,
  Scale,
  TrendingUp,
  Tags,
  Settings as SettingsIcon,
  Plus,
  Pencil,
  Trash2,
  Search,
  Download,
  Printer,
  Wallet,
  AlertTriangle,
  CheckCircle2,
  X,
  Banknote,
} from 'lucide-react';
import type { Account, Category, Invoice, InvoiceLine, LedgerEntry, Party, TransactionType } from '../../types';
import {
  useAccountingStore,
  invoiceTotals,
  invoiceStatus,
  isOverdue,
  summarise,
  periodRange,
  DEFAULT_SETTINGS,
  type PeriodRange,
} from '../../stores/accountingStore';
import { useT } from '../../i18n';
import { Toolbar, ToolButton, Modal, Field, Select, Badge, EmptyState, BarChart as BarChartView, LineChart, PieChart, type ChartPoint } from '../../components/ui/Controls';
import { formatCurrency, formatMoney, isoDate } from '../../services/format';
import { downloadText } from '../../services/files';
import { useShellStore } from '../../stores/shellStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { uid } from '../../services/id';

type Section =
  | 'dashboard'
  | 'customers'
  | 'suppliers'
  | 'accounts'
  | 'invoices'
  | 'income'
  | 'expenses'
  | 'transactions'
  | 'pl'
  | 'cashflow'
  | 'categories'
  | 'settings';

type Period = 'thisMonth' | 'lastMonth' | 'quarter' | 'year' | 'all';

const NAV: { id: Section; labelKey: string; icon: React.ReactNode; group: 'overview' | 'records' | 'reports' | 'system' }[] = [
  { id: 'dashboard', labelKey: 'acc.dashboard', icon: <LayoutDashboard size={15} />, group: 'overview' },
  { id: 'invoices', labelKey: 'acc.invoices', icon: <FileText size={15} />, group: 'records' },
  { id: 'customers', labelKey: 'acc.customers', icon: <Users size={15} />, group: 'records' },
  { id: 'suppliers', labelKey: 'acc.suppliers', icon: <Truck size={15} />, group: 'records' },
  { id: 'income', labelKey: 'acc.income', icon: <ArrowDownCircle size={15} />, group: 'records' },
  { id: 'expenses', labelKey: 'acc.expenses', icon: <ArrowUpCircle size={15} />, group: 'records' },
  { id: 'transactions', labelKey: 'acc.transactions', icon: <ArrowLeftRight size={15} />, group: 'records' },
  { id: 'accounts', labelKey: 'acc.accounts', icon: <Landmark size={15} />, group: 'records' },
  { id: 'categories', labelKey: 'acc.categories', icon: <Tags size={15} />, group: 'records' },
  { id: 'pl', labelKey: 'acc.profitLoss', icon: <Scale size={15} />, group: 'reports' },
  { id: 'cashflow', labelKey: 'acc.cashFlow', icon: <TrendingUp size={15} />, group: 'reports' },
  { id: 'settings', labelKey: 'acc.settings', icon: <SettingsIcon size={15} />, group: 'system' },
];

const CURRENCIES = ['USD', 'EUR', 'GBP', 'SEK', 'NOK', 'DKK', 'CHF', 'CAD', 'AUD', 'JPY', 'TRY', 'AED', 'IRR'];
const METHODS: LedgerEntry['method'][] = ['cash', 'bank', 'card', 'cheque', 'other'];

export function AccountingApp({ props }: { props?: Record<string, unknown> }) {
  const { t } = useT();
  const store = useAccountingStore();
  const openDialog = useShellStore((state) => state.openDialog);
  const accent = useSettingsStore((state) => state.settings.personalization.accent);

  const [section, setSection] = useState<Section>(((props?.section as Section) ?? 'dashboard'));
  const [period, setPeriod] = useState<Period>('thisMonth');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [invoiceDraft, setInvoiceDraft] = useState<Invoice | null>(null);
  const [partyDraft, setPartyDraft] = useState<Party | null>(null);
  const [accountDraft, setAccountDraft] = useState<Account | null>(null);
  const [categoryDraft, setCategoryDraft] = useState<Category | null>(null);
  const [txDraft, setTxDraft] = useState<LedgerEntry | null>(null);
  const [paymentFor, setPaymentFor] = useState<Invoice | null>(null);
  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);

  useEffect(() => {
    if (!store.hydrated) void store.hydrate();
  }, [store.hydrated, store]);

  useEffect(() => setPage(0), [section, query, period]);

  const range: PeriodRange = useMemo(() => periodRange(period), [period]);
  const report = useMemo(() => summarise(store.transactions, store.invoices, store.parties, store.accounts, range), [range, store.accounts, store.invoices, store.parties, store.transactions]);
  const currency = store.settings.currency;
  const money = (value: number) => formatCurrency(value, currency);

  const customers = store.parties.filter((party) => party.kind === 'customer');
  const partyName = (id?: string) => store.parties.find((party) => party.id === id)?.name ?? '—';
  const accountName = (id?: string) => store.accounts.find((account) => account.id === id)?.name ?? '—';

  const outstandingInvoices = useMemo(
    () =>
      store.invoices
        .filter((invoice) => invoice.status !== 'draft')
        .map((invoice) => ({ invoice, totals: invoiceTotals(invoice) }))
        .filter((entry) => entry.totals.due > 0.005)
        .sort((a, b) => a.invoice.dueDate.localeCompare(b.invoice.dueDate)),
    [store.invoices],
  );

  const overdueInvoices = outstandingInvoices.filter((entry) => isOverdue(entry.invoice));

  const exportCsv = (name: string, headers: string[], rows: (string | number)[][]) => {
    const escape = (value: string | number) => {
      const text = String(value ?? '');
      return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    const csv = [headers.map(escape).join(','), ...rows.map((row) => row.map(escape).join(','))].join('\n');
    downloadText(csv, `${name}-${isoDate(new Date())}.csv`, 'text/csv;charset=utf-8');
  };

  const matches = (text: string) => !query.trim() || text.toLowerCase().includes(query.trim().toLowerCase());

  /* ---------------- section content ---------------- */

  const renderDashboard = () => (
    <div className="space-y-4">
      {overdueInvoices.length ? (
        <div className="flex items-start gap-2 rounded-lg border border-red-500/35 bg-red-500/10 p-3">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-red-500" />
          <div className="min-w-0">
            <p className="text-[12.5px] font-semibold text-red-500">{t('acc.overdueAlert', { n: overdueInvoices.length })}</p>
            <p className="mt-0.5 text-[11.5px] opacity-75">
              {overdueInvoices
                .slice(0, 3)
                .map((entry) => `${entry.invoice.number} (${money(entry.totals.due)})`)
                .join(' · ')}
              {overdueInvoices.length > 3 ? ' …' : ''}
            </p>
          </div>
          <button type="button" className="win-button ms-auto shrink-0 px-2 py-1 text-[11.5px]" onClick={() => setSection('invoices')}>
            {t('acc.review')}
          </button>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={<Wallet size={16} />} label={t('acc.cashBalance')} value={money(report.cash)} tone="accent" />
        <StatCard icon={<ArrowDownCircle size={16} />} label={t('acc.income')} value={money(report.income)} tone="success" />
        <StatCard icon={<ArrowUpCircle size={16} />} label={t('acc.expenses')} value={money(report.expense)} tone="danger" />
        <StatCard icon={<Scale size={16} />} label={t('acc.netProfit')} value={money(report.profit)} tone={report.profit >= 0 ? 'success' : 'danger'} hint={`${formatMoney(report.margin)}% ${t('acc.margin')}`} />
        <StatCard icon={<Users size={16} />} label={t('acc.receivables')} value={money(report.receivables)} />
        <StatCard icon={<Truck size={16} />} label={t('acc.payables')} value={money(report.payables)} />
        <StatCard icon={<FileText size={16} />} label={t('acc.unpaidInvoices')} value={money(report.invoiceDue)} hint={`${outstandingInvoices.length} ${t('acc.open')}`} />
        <StatCard icon={<AlertTriangle size={16} />} label={t('acc.overdue')} value={money(report.overdue)} tone={report.overdue > 0 ? 'danger' : 'neutral'} />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title={t('acc.incomeVsExpense')} icon={<TrendingUp size={15} />}>
          {report.byMonth.length ? (
            <BarChartView
              height={170}
              data={report.byMonth.map((month) => ({ label: month.month.slice(5), value: month.income, value2: month.expense }))}
              color={accent}
              color2="#ef4444"
              formatValue={(value) => money(value)}
            />
          ) : (
            <EmptyState icon={<TrendingUp size={28} />} title={t('acc.noData')} message={t('acc.noDataHint')} />
          )}
          <p className="mt-2 flex items-center gap-3 text-[10.5px] opacity-60">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-sm" style={{ background: accent }} /> {t('acc.income')}
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-sm bg-[#ef4444]" /> {t('acc.expenses')}
            </span>
          </p>
        </Panel>

        <Panel title={t('acc.byCategory')} icon={<Tags size={15} />}>
          {report.byCategory.length ? (
            <div className="flex items-center gap-4">
              <PieChart
                size={150}
                data={report.byCategory.slice(0, 6).map((entry, index) => ({
                  label: entry.name,
                  value: entry.value,
                  color: ['#2563eb', '#16a34a', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'][index % 6],
                }))}
              />
              <ul className="min-w-0 flex-1 space-y-1">
                {report.byCategory.slice(0, 6).map((entry, index) => (
                  <li key={`${entry.type}-${entry.name}`} className="flex items-center gap-2 text-[11.5px]">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: ['#2563eb', '#16a34a', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'][index % 6] }} />
                    <span className="min-w-0 flex-1 truncate">{entry.name}</span>
                    <span className="shrink-0 tabular-nums opacity-70">{money(entry.value)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <EmptyState icon={<Tags size={28} />} title={t('acc.noData')} />
          )}
        </Panel>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel
          title={t('acc.unpaidInvoices')}
          icon={<FileText size={15} />}
          action={
            <button type="button" className="win-button px-2 py-1 text-[11.5px]" onClick={() => setSection('invoices')}>
              {t('acc.viewAll')}
            </button>
          }
        >
          {outstandingInvoices.length ? (
            <table className="w-full text-[12px]">
              <tbody>
                {outstandingInvoices.slice(0, 6).map(({ invoice, totals }) => (
                  <tr key={invoice.id} className="border-b border-[var(--border)] last:border-0">
                    <td className="py-1.5">
                      <button type="button" className="font-medium hover:underline" onClick={() => setViewInvoice(invoice)}>
                        {invoice.number}
                      </button>
                      <span className="ms-2 opacity-60">{partyName(invoice.customerId)}</span>
                    </td>
                    <td className={`py-1.5 text-end tabular-nums ${isOverdue(invoice) ? 'font-semibold text-red-500' : ''}`}>{money(totals.due)}</td>
                    <td className="py-1.5 text-end text-[11px] opacity-60" dir="ltr">
                      {invoice.dueDate}
                    </td>
                    <td className="py-1.5 ps-2 text-end">
                      <button type="button" className="win-button win-button-accent px-2 py-0.5 text-[11px]" onClick={() => setPaymentFor(invoice)}>
                        {t('acc.recordPayment')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyState icon={<CheckCircle2 size={28} />} title={t('acc.allPaid')} message={t('acc.allPaidHint')} />
          )}
        </Panel>

        <Panel title={t('acc.recentActivity')} icon={<ArrowLeftRight size={15} />}>
          {store.transactions.length ? (
            <ul className="space-y-1">
              {[...store.transactions]
                .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
                .slice(0, 7)
                .map((entry) => (
                  <li key={entry.id} className="flex items-center gap-2 text-[11.5px]">
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${entry.type === 'income' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                    <span className="min-w-0 flex-1 truncate">{entry.description || entry.category}</span>
                    <span className="shrink-0 text-[10.5px] opacity-50" dir="ltr">
                      {entry.date}
                    </span>
                    <span className={`w-24 shrink-0 text-end tabular-nums ${entry.type === 'income' ? 'text-emerald-500' : 'text-red-500'}`}>
                      {entry.type === 'income' ? '+' : '−'}
                      {money(entry.amount)}
                    </span>
                  </li>
                ))}
            </ul>
          ) : (
            <EmptyState icon={<ArrowLeftRight size={28} />} title={t('acc.noTransactions')} />
          )}
        </Panel>
      </div>

      <p className="text-[10.5px] leading-relaxed opacity-55">{t('acc.demoNote')}</p>
    </div>
  );

  const renderParties = (kind: 'customer' | 'supplier') => {
    const list = store.parties.filter((party) => party.kind === kind && matches(`${party.name} ${party.email ?? ''} ${party.contact ?? ''} ${party.phone ?? ''}`));
    const rows = paginate(list, page);
    return (
      <>
        <Table
          headers={[t('acc.name'), t('acc.contact'), t('acc.email'), t('acc.phone'), t('acc.balance'), '']}
          empty={t('acc.noParties')}
          rows={rows.map((party) => [
            <span key="name" className="flex items-center gap-2">
              <span className="font-medium">{party.name}</span>
              {party.demo ? <Badge tone="neutral">{t('common.demo')}</Badge> : null}
            </span>,
            party.contact ?? '—',
            party.email ?? '—',
            party.phone ?? '—',
            <span key="balance" className={`tabular-nums ${party.balance > 0 ? 'text-amber-500' : ''}`}>
              {money(party.balance)}
            </span>,
            <RowActions
              key="actions"
              onEdit={() => setPartyDraft(party)}
              onDelete={() =>
                openDialog({
                  kind: 'confirm',
                  title: t('common.confirmTitle'),
                  message: t('acc.deletePartyConfirm', { name: party.name }),
                  danger: true,
                  onConfirm: () => store.removeParty(party.id),
                })
              }
              extra={
                kind === 'customer'
                  ? [
                      {
                        label: t('acc.newInvoice'),
                        onClick: () => setInvoiceDraft(blankInvoice(store.settings, party.id)),
                      },
                    ]
                  : []
              }
            />
          ])}
        />
        <Pager count={list.length} page={page} onPage={setPage} />
      </>
    );
  };

  const renderAccounts = () => {
    const list = store.accounts.filter((account) => matches(`${account.name} ${account.type}`));
    const grouped = (['asset', 'liability', 'equity', 'income', 'expense'] as const).map((type) => ({
      type,
      items: list.filter((account) => account.type === type),
      total: list.filter((account) => account.type === type).reduce((sum, account) => sum + account.balance, 0),
    }));
    return (
      <div className="space-y-3">
        {grouped.map((group) => (
          <Panel key={group.type} title={`${t(`acc.accountType.${group.type}`)} · ${group.items.length}`} icon={<Landmark size={15} />} action={<span className="text-[12px] font-semibold tabular-nums">{money(group.total)}</span>}>
            {group.items.length ? (
              <table className="w-full text-[12px]">
                <tbody>
                  {group.items.map((account) => (
                    <tr key={account.id} className="border-b border-[var(--border)] last:border-0">
                      <td className="py-1.5">
                        <span className="font-medium">{account.name}</span>
                        {account.demo ? <span className="ms-2 text-[10px] opacity-50">{t('common.demo')}</span> : null}
                      </td>
                      <td className="py-1.5 text-end tabular-nums">{money(account.balance)}</td>
                      <td className="py-1.5 text-end">
                        <RowActions
                          onEdit={() => setAccountDraft(account)}
                          onDelete={() =>
                            openDialog({
                              kind: 'confirm',
                              title: t('common.confirmTitle'),
                              message: t('acc.deleteAccountConfirm', { name: account.name }),
                              danger: true,
                              onConfirm: () => store.removeAccount(account.id),
                            })
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="py-2 text-[11.5px] opacity-50">{t('acc.noAccounts')}</p>
            )}
          </Panel>
        ))}
      </div>
    );
  };

  const renderInvoices = () => {
    const list = store.invoices
      .filter((invoice) => matches(`${invoice.number} ${partyName(invoice.customerId)} ${invoice.status}`))
      .sort((a, b) => b.issueDate.localeCompare(a.issueDate));
    const rows = paginate(list, page);
    return (
      <>
        <Table
          headers={[t('acc.number'), t('acc.customer'), t('acc.issueDate'), t('acc.dueDate'), t('acc.total'), t('acc.paid'), t('acc.balance'), t('acc.status'), '']}
          empty={t('acc.noInvoices')}
          rows={rows.map((invoice) => {
            const totals = invoiceTotals(invoice);
            const status = invoiceStatus(invoice);
            const overdue = isOverdue(invoice);
            return [
              <button key="n" type="button" className="font-medium hover:underline" onClick={() => setViewInvoice(invoice)}>
                {invoice.number}
              </button>,
              partyName(invoice.customerId),
              <span key="i" dir="ltr">
                {invoice.issueDate}
              </span>,
              <span key="d" dir="ltr" className={overdue ? 'font-semibold text-red-500' : ''}>
                {invoice.dueDate}
              </span>,
              <span key="t" className="tabular-nums">
                {money(totals.total)}
              </span>,
              <span key="p" className="tabular-nums opacity-70">
                {money(totals.paid)}
              </span>,
              <span key="b" className="tabular-nums font-medium">
                {money(totals.due)}
              </span>,
              <StatusBadge key="s" status={status} overdue={overdue} />,
              <RowActions
                key="a"
                onEdit={() => setInvoiceDraft(invoice)}
                onDelete={() =>
                  openDialog({
                    kind: 'confirm',
                    title: t('common.confirmTitle'),
                    message: t('acc.deleteInvoiceConfirm', { number: invoice.number }),
                    danger: true,
                    onConfirm: () => store.removeInvoice(invoice.id),
                  })
                }
                extra={[
                  { label: t('acc.recordPayment'), onClick: () => setPaymentFor(invoice), disabled: status === 'draft' || totals.due <= 0 },
                  ...(status === 'draft' ? [{ label: t('acc.issue'), onClick: () => void store.issueInvoice(invoice.id) }] : []),
                  { label: t('acc.view'), onClick: () => setViewInvoice(invoice) },
                ]}
              />
            ];
          })}
        />
        <Pager count={list.length} page={page} onPage={setPage} />
      </>
    );
  };

  const renderTransactions = (filter?: TransactionType) => {
    const list = store.transactions
      .filter((entry) => (filter ? entry.type === filter : true))
      .filter((entry) => matches(`${entry.description} ${entry.category} ${partyName(entry.partyId)} ${accountName(entry.accountId)}`))
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
    const rows = paginate(list, page);
    const total = rows.reduce((sum, entry) => sum + (entry.type === 'income' ? entry.amount : -entry.amount), 0);
    return (
      <>
        <Table
          headers={[t('acc.date'), t('acc.description'), t('acc.category'), t('acc.account'), t('acc.party'), t('acc.method'), t('acc.amount'), '']}
          empty={t('acc.noTransactions')}
          rows={rows.map((entry) => [
            <span key="d" dir="ltr">
              {entry.date}
            </span>,
            <span key="desc" className="truncate">
              {entry.description || '—'}
              {entry.demo ? <span className="ms-2 text-[10px] opacity-50">{t('common.demo')}</span> : null}
            </span>,
            entry.category || '—',
            accountName(entry.accountId),
            partyName(entry.partyId),
            t(`acc.method.${entry.method}`),
            <span key="a" className={`tabular-nums font-medium ${entry.type === 'income' ? 'text-emerald-500' : 'text-red-500'}`}>
              {entry.type === 'income' ? '+' : '−'}
              {money(entry.amount)}
            </span>,
            <RowActions
              key="act"
              onEdit={() => setTxDraft(entry)}
              onDelete={() =>
                openDialog({
                  kind: 'confirm',
                  title: t('common.confirmTitle'),
                  message: t('acc.deleteTxConfirm'),
                  danger: true,
                  onConfirm: () => store.removeTransaction(entry.id),
                })
              }
            />,
          ])}
        />
        <div className="mt-2 flex items-center justify-between text-[12px]">
          <span className="opacity-60">
            {list.length} {t('acc.records')}
          </span>
          <span className="font-semibold tabular-nums">
            {t('acc.pageTotal')}: {money(total)}
          </span>
        </div>
        <Pager count={list.length} page={page} onPage={setPage} />
      </>
    );
  };

  const renderProfitLoss = () => {
    const income = report.byCategory.filter((entry) => entry.type === 'income');
    const expense = report.byCategory.filter((entry) => entry.type === 'expense');
    return (
      <div className="space-y-3">
        <Panel title={`${t('acc.profitLoss')} · ${range.label}`} icon={<Scale size={15} />} action={<button type="button" className="win-button px-2 py-1 text-[11.5px]" onClick={() => exportCsv('profit-loss', ['Section', 'Amount'], [['Income', report.income], ['Expenses', report.expense], ['Net profit', report.profit], ...income.map((entry) => [`income:${entry.name}`, entry.value]), ...expense.map((entry) => [`expense:${entry.name}`, entry.value])])}>{t('acc.exportCsv')}</button>}>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="mb-1 text-[12px] font-semibold text-emerald-500">{t('acc.income')}</p>
              {income.map((entry) => (
                <div key={entry.name} className="flex items-center justify-between border-b border-[var(--border)] py-1 text-[12px] last:border-0">
                  <span>{entry.name}</span>
                  <span className="tabular-nums">{money(entry.value)}</span>
                </div>
              ))}
              <div className="mt-1 flex items-center justify-between text-[12.5px] font-semibold">
                <span>{t('acc.totalIncome')}</span>
                <span className="tabular-nums">{money(report.income)}</span>
              </div>
            </div>
            <div>
              <p className="mb-1 text-[12px] font-semibold text-red-500">{t('acc.expenses')}</p>
              {expense.map((entry) => (
                <div key={entry.name} className="flex items-center justify-between border-b border-[var(--border)] py-1 text-[12px] last:border-0">
                  <span>{entry.name}</span>
                  <span className="tabular-nums">{money(entry.value)}</span>
                </div>
              ))}
              <div className="mt-1 flex items-center justify-between text-[12.5px] font-semibold">
                <span>{t('acc.totalExpenses')}</span>
                <span className="tabular-nums">{money(report.expense)}</span>
              </div>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2">
            <span className="text-[13px] font-semibold">{t('acc.netProfit')}</span>
            <span className={`text-[16px] font-bold tabular-nums ${report.profit >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>{money(report.profit)}</span>
            <span className="text-[11.5px] opacity-60">
              {t('acc.margin')}: {formatMoney(report.margin)}%
            </span>
          </div>
        </Panel>
      </div>
    );
  };

  const renderCashFlow = () => {
    const months = report.byMonth;
    let running = 0;
    const rows = months.map((month) => {
      const net = month.income - month.expense;
      running += net;
      return { ...month, net, closing: running };
    });
    const points: ChartPoint[] = rows.map((row) => ({ label: row.month.slice(5), value: row.closing }));
    return (
      <div className="space-y-3">
        <Panel title={`${t('acc.cashFlow')} · ${range.label}`} icon={<TrendingUp size={15} />} action={<button type="button" className="win-button px-2 py-1 text-[11.5px]" onClick={() => exportCsv('cash-flow', ['Month', 'Income', 'Expense', 'Net', 'Closing'], rows.map((row) => [row.month, row.income, row.expense, row.net, row.closing]))}>{t('acc.exportCsv')}</button>}>
          {rows.length ? (
            <>
              <LineChart data={points} height={150} color={accent} />
              <table className="mt-3 w-full text-[12px]">
                <thead>
                  <tr className="border-b border-[var(--border)] text-[11px] uppercase tracking-wide opacity-55">
                    <th className="py-1 text-start">{t('acc.month')}</th>
                    <th className="py-1 text-end">{t('acc.income')}</th>
                    <th className="py-1 text-end">{t('acc.expenses')}</th>
                    <th className="py-1 text-end">{t('acc.net')}</th>
                    <th className="py-1 text-end">{t('acc.closing')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.month} className="border-b border-[var(--border)] last:border-0">
                      <td className="py-1.5" dir="ltr">
                        {row.month}
                      </td>
                      <td className="py-1.5 text-end tabular-nums text-emerald-500">{money(row.income)}</td>
                      <td className="py-1.5 text-end tabular-nums text-red-500">{money(row.expense)}</td>
                      <td className={`py-1.5 text-end tabular-nums font-medium ${row.net >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>{money(row.net)}</td>
                      <td className="py-1.5 text-end tabular-nums">{money(row.closing)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <EmptyState icon={<TrendingUp size={28} />} title={t('acc.noData')} message={t('acc.noDataHint')} />
          )}
        </Panel>
        <p className="text-[10.5px] opacity-55">{t('acc.cashFlowNote')}</p>
      </div>
    );
  };

  const renderCategories = () => {
    const list = store.categories.filter((category) => matches(category.name));
    return (
      <div className="grid gap-2 md:grid-cols-2">
        {list.map((category) => (
          <div key={category.id} className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2">
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: category.color }} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12.5px] font-medium">{category.name}</span>
              <span className="block text-[10.5px] opacity-55">{category.type === 'income' ? t('acc.income') : t('acc.expenses')}</span>
            </span>
            <RowActions
              onEdit={() => setCategoryDraft(category)}
              onDelete={() =>
                openDialog({
                  kind: 'confirm',
                  title: t('common.confirmTitle'),
                  message: t('acc.deleteCategoryConfirm', { name: category.name }),
                  danger: true,
                  onConfirm: () => store.removeCategory(category.id),
                })
              }
            />
          </div>
        ))}
        {!list.length ? <EmptyState icon={<Tags size={30} />} title={t('acc.noCategories')} /> : null}
      </div>
    );
  };

  const renderSettings = () => (
    <div className="space-y-3">
      <Panel title={t('acc.company')} icon={<SettingsIcon size={15} />}>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label={t('acc.companyName')}>
            <input className="win-input" value={store.settings.companyName} onChange={(event) => void store.updateSettings({ companyName: event.target.value })} />
          </Field>
          <Field label={t('acc.currency')}>
            <Select value={store.settings.currency} onChange={(value) => void store.updateSettings({ currency: value })} options={[...new Set(CURRENCIES)].map((code) => ({ value: code, label: code }))} />
          </Field>
          <Field label={t('acc.defaultTax')} hint={t('acc.defaultTaxHint')}>
            <input type="number" min={0} max={100} step={0.5} className="win-input" value={store.settings.taxRate} onChange={(event) => void store.updateSettings({ taxRate: Number(event.target.value) })} />
          </Field>
          <Field label={t('acc.invoicePrefix')}>
            <input className="win-input" dir="ltr" value={store.settings.invoicePrefix} onChange={(event) => void store.updateSettings({ invoicePrefix: event.target.value })} />
          </Field>
          <Field label={t('acc.nextNumber')}>
            <input type="number" className="win-input" value={store.settings.nextInvoiceNumber} onChange={(event) => void store.updateSettings({ nextInvoiceNumber: Number(event.target.value) })} />
          </Field>
          <Field label={t('acc.fiscalYearStart')}>
            <Select
              value={String(store.settings.fiscalYearStart)}
              onChange={(value) => void store.updateSettings({ fiscalYearStart: Number(value) })}
              options={Array.from({ length: 12 }, (_, index) => ({ value: String(index + 1), label: new Date(2024, index, 1).toLocaleDateString(undefined, { month: 'long' }) }))}
            />
          </Field>
        </div>
      </Panel>

      <Panel title={t('acc.data')} icon={<Banknote size={15} />}>
        <p className="mb-3 text-[11.5px] leading-relaxed opacity-70">{t('acc.dataNote')}</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="win-button flex items-center gap-1.5 px-2.5 py-1.5 text-[12px]"
            onClick={() =>
              exportCsv('parties', ['Kind', 'Name', 'Contact', 'Email', 'Phone', 'Balance'], store.parties.map((party) => [party.kind, party.name, party.contact ?? '', party.email ?? '', party.phone ?? '', party.balance]))
            }
          >
            <Download size={13} /> {t('acc.exportParties')}
          </button>
          <button
            type="button"
            className="win-button flex items-center gap-1.5 px-2.5 py-1.5 text-[12px]"
            onClick={() =>
              exportCsv(
                'invoices',
                ['Number', 'Customer', 'Issue', 'Due', 'Subtotal', 'Tax', 'Total', 'Paid', 'Balance', 'Status'],
                store.invoices.map((invoice) => {
                  const totals = invoiceTotals(invoice);
                  return [invoice.number, partyName(invoice.customerId), invoice.issueDate, invoice.dueDate, totals.taxable, totals.tax, totals.total, totals.paid, totals.due, invoiceStatus(invoice)];
                }),
              )
            }
          >
            <Download size={13} /> {t('acc.exportInvoices')}
          </button>
          <button
            type="button"
            className="win-button flex items-center gap-1.5 px-2.5 py-1.5 text-[12px]"
            onClick={() =>
              exportCsv('transactions', ['Date', 'Type', 'Amount', 'Category', 'Account', 'Party', 'Method', 'Description'], store.transactions.map((entry) => [entry.date, entry.type, entry.amount, entry.category, accountName(entry.accountId), partyName(entry.partyId), entry.method, entry.description]))
            }
          >
            <Download size={13} /> {t('acc.exportTransactions')}
          </button>
          <button type="button" className="win-button flex items-center gap-1.5 px-2.5 py-1.5 text-[12px]" onClick={() => openDialog({ kind: 'confirm', title: t('acc.resetDemo'), message: t('acc.resetDemoConfirm'), danger: true, onConfirm: () => store.resetDemo() })}>
            {t('acc.resetDemo')}
          </button>
          <button type="button" className="win-button flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] text-red-500" onClick={() => openDialog({ kind: 'confirm', title: t('acc.clearAll'), message: t('acc.clearAllConfirm'), danger: true, onConfirm: () => store.clearAll() })}>
            <Trash2 size={13} /> {t('acc.clearAll')}
          </button>
        </div>
        {!store.storageOk ? (
          <p className="mt-3 flex items-center gap-2 rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11.5px] text-amber-500">
            <AlertTriangle size={14} /> {t('acc.storageWarning')}
          </p>
        ) : null}
        <p className="mt-3 text-[10.5px] leading-relaxed opacity-55">{t('acc.disclaimer')}</p>
      </Panel>
    </div>
  );

  const sectionActions: Partial<Record<Section, React.ReactNode>> = {
    customers: <button type="button" className="win-button win-button-accent flex items-center gap-1.5 px-2.5 py-1 text-[12px]" onClick={() => setPartyDraft(blankParty('customer'))}><Plus size={13} /> {t('acc.newCustomer')}</button>,
    suppliers: <button type="button" className="win-button win-button-accent flex items-center gap-1.5 px-2.5 py-1 text-[12px]" onClick={() => setPartyDraft(blankParty('supplier'))}><Plus size={13} /> {t('acc.newSupplier')}</button>,
    accounts: <button type="button" className="win-button win-button-accent flex items-center gap-1.5 px-2.5 py-1 text-[12px]" onClick={() => setAccountDraft(blankAccount(currency))}><Plus size={13} /> {t('acc.newAccount')}</button>,
    categories: <button type="button" className="win-button win-button-accent flex items-center gap-1.5 px-2.5 py-1 text-[12px]" onClick={() => setCategoryDraft(blankCategory())}><Plus size={13} /> {t('acc.newCategory')}</button>,
    invoices: <button type="button" className="win-button win-button-accent flex items-center gap-1.5 px-2.5 py-1 text-[12px]" onClick={() => setInvoiceDraft(blankInvoice(store.settings))}><Plus size={13} /> {t('acc.newInvoice')}</button>,
    income: <button type="button" className="win-button win-button-accent flex items-center gap-1.5 px-2.5 py-1 text-[12px]" onClick={() => setTxDraft(blankTx('income', store))}><Plus size={13} /> {t('acc.newIncome')}</button>,
    expenses: <button type="button" className="win-button win-button-accent flex items-center gap-1.5 px-2.5 py-1 text-[12px]" onClick={() => setTxDraft(blankTx('expense', store))}><Plus size={13} /> {t('acc.newExpense')}</button>,
    transactions: <button type="button" className="win-button win-button-accent flex items-center gap-1.5 px-2.5 py-1 text-[12px]" onClick={() => setTxDraft(blankTx('income', store))}><Plus size={13} /> {t('acc.newTransaction')}</button>,
  };

  const title = t(`acc.${section === 'pl' ? 'profitLoss' : section === 'cashflow' ? 'cashFlow' : section}`);

  return (
    <div className="flex h-full bg-[var(--surface-solid)] text-[var(--text)]">
      {/* Sidebar */}
      <aside className="scroll-thin flex w-52 shrink-0 flex-col overflow-y-auto border-e border-[var(--border)] bg-[var(--surface-2)]">
        <div className="border-b border-[var(--border)] px-3 py-2.5">
          <p className="truncate text-[13px] font-semibold">{store.settings.companyName}</p>
          <p className="text-[10.5px] opacity-55">
            {store.settings.currency} · {range.label}
          </p>
        </div>
        <nav className="flex-1 p-1.5">
          {(['overview', 'records', 'reports', 'system'] as const).map((group) => (
            <div key={group} className="mb-2">
              <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide opacity-45">{t(`acc.group.${group}`)}</p>
              {NAV.filter((item) => item.group === group).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`list-row w-full gap-2 text-[12px] ${section === item.id ? 'bg-[var(--accent-soft)] text-[var(--accent)]' : ''}`}
                  onClick={() => setSection(item.id)}
                >
                  {item.icon}
                  <span className="truncate">{t(item.labelKey)}</span>
                  {item.id === 'invoices' && outstandingInvoices.length ? <span className="ms-auto rounded-full bg-[var(--accent)] px-1.5 text-[10px] font-semibold text-white">{outstandingInvoices.length}</span> : null}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <p className="border-t border-[var(--border)] px-3 py-2 text-[10px] leading-relaxed opacity-50">{t('acc.simulatedNote')}</p>
      </aside>

      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col">
        <Toolbar>
          <h2 className="text-[14px] font-semibold">{title}</h2>
          <div className="relative ms-2">
            <Search size={13} className="pointer-events-none absolute start-2 top-1/2 -translate-y-1/2 opacity-50" />
            <input className="win-input h-8 w-48 ps-7 text-[12px]" placeholder={t('acc.search')} value={query} onChange={(event) => setQuery(event.target.value)} />
          </div>
          <span className="mx-1 h-5 w-px bg-[var(--border)]" />
          <Select
            value={period}
            ariaLabel={t('acc.period')}
            className="h-8 w-36 py-0 text-[12px]"
            onChange={(value) => setPeriod(value as Period)}
            options={[
              { value: 'thisMonth', label: t('acc.thisMonth') },
              { value: 'lastMonth', label: t('acc.lastMonth') },
              { value: 'quarter', label: t('acc.thisQuarter') },
              { value: 'year', label: t('acc.thisYear') },
              { value: 'all', label: t('acc.allTime') },
            ]}
          />
          <span className="ms-auto flex items-center gap-1 pe-1">
            {sectionActions[section]}
            <ToolButton icon={<Printer size={15} />} title={t('acc.print')} onClick={() => window.print()} />
            <ToolButton
              icon={<Download size={15} />}
              title={t('acc.exportCsv')}
              onClick={() => {
                if (section === 'invoices') {
                  exportCsv('invoices', ['Number', 'Customer', 'Issue', 'Due', 'Total', 'Paid', 'Balance', 'Status'], store.invoices.map((invoice) => { const totals = invoiceTotals(invoice); return [invoice.number, partyName(invoice.customerId), invoice.issueDate, invoice.dueDate, totals.total, totals.paid, totals.due, invoiceStatus(invoice)]; }));
                } else if (section === 'transactions' || section === 'income' || section === 'expenses') {
                  exportCsv('transactions', ['Date', 'Type', 'Amount', 'Category', 'Account', 'Party', 'Description'], store.transactions.map((entry) => [entry.date, entry.type, entry.amount, entry.category, accountName(entry.accountId), partyName(entry.partyId), entry.description]));
                } else {
                  exportCsv('summary', ['Metric', 'Value'], [['Cash', report.cash], ['Income', report.income], ['Expenses', report.expense], ['Profit', report.profit], ['Receivables', report.receivables], ['Payables', report.payables], ['Overdue', report.overdue]]);
                }
              }}
            />
          </span>
        </Toolbar>

        <div className="print-area scroll-thin min-h-0 flex-1 overflow-y-auto p-3">
          {section === 'dashboard' ? renderDashboard() : null}
          {section === 'customers' ? renderParties('customer') : null}
          {section === 'suppliers' ? renderParties('supplier') : null}
          {section === 'accounts' ? renderAccounts() : null}
          {section === 'invoices' ? renderInvoices() : null}
          {section === 'income' ? renderTransactions('income') : null}
          {section === 'expenses' ? renderTransactions('expense') : null}
          {section === 'transactions' ? renderTransactions() : null}
          {section === 'pl' ? renderProfitLoss() : null}
          {section === 'cashflow' ? renderCashFlow() : null}
          {section === 'categories' ? renderCategories() : null}
          {section === 'settings' ? renderSettings() : null}
        </div>

        <footer className="flex shrink-0 items-center gap-4 border-t border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-[11px]">
          <span>
            {t('acc.cash')}: <strong className="tabular-nums">{money(report.cash)}</strong>
          </span>
          <span>
            {t('acc.receivables')}: <strong className="tabular-nums">{money(report.receivables)}</strong>
          </span>
          <span>
            {t('acc.payables')}: <strong className="tabular-nums">{money(report.payables)}</strong>
          </span>
          <span className="ms-auto opacity-60">{t('acc.simulatedNote')}</span>
        </footer>
      </div>

      {/* ---------------- dialogs ---------------- */}

      {partyDraft ? (
        <EntityModal
          title={partyDraft.id && store.parties.some((party) => party.id === partyDraft.id) ? t('acc.editParty') : t('acc.newParty')}
          onClose={() => setPartyDraft(null)}
          onSave={async () => {
            await store.saveParty({ ...partyDraft, id: partyDraft.id || undefined });
            setPartyDraft(null);
          }}
        >
          <div className="grid gap-3 md:grid-cols-2">
            <Field label={t('acc.name')}>
              <input className="win-input" value={partyDraft.name} autoFocus onChange={(event) => setPartyDraft({ ...partyDraft, name: event.target.value })} />
            </Field>
            <Field label={t('acc.kind')}>
              <Select
                value={partyDraft.kind}
                onChange={(value) => setPartyDraft({ ...partyDraft, kind: value as Party['kind'] })}
                options={[
                  { value: 'customer', label: t('acc.customer') },
                  { value: 'supplier', label: t('acc.supplier') },
                ]}
              />
            </Field>
            <Field label={t('acc.contact')}>
              <input className="win-input" value={partyDraft.contact ?? ''} onChange={(event) => setPartyDraft({ ...partyDraft, contact: event.target.value })} />
            </Field>
            <Field label={t('acc.email')}>
              <input className="win-input" dir="ltr" value={partyDraft.email ?? ''} onChange={(event) => setPartyDraft({ ...partyDraft, email: event.target.value })} />
            </Field>
            <Field label={t('acc.phone')}>
              <input className="win-input" dir="ltr" value={partyDraft.phone ?? ''} onChange={(event) => setPartyDraft({ ...partyDraft, phone: event.target.value })} />
            </Field>
            <Field label={t('acc.openingBalance')} hint={t('acc.openingBalanceHint')}>
              <input type="number" className="win-input" value={partyDraft.balance} onChange={(event) => setPartyDraft({ ...partyDraft, balance: Number(event.target.value) })} />
            </Field>
            <div className="md:col-span-2">
              <Field label={t('acc.address')}>
                <textarea className="win-input min-h-16 resize-y" value={partyDraft.address ?? ''} onChange={(event) => setPartyDraft({ ...partyDraft, address: event.target.value })} />
              </Field>
            </div>
          </div>
        </EntityModal>
      ) : null}

      {accountDraft ? (
        <EntityModal
          title={accountDraft.id && store.accounts.some((account) => account.id === accountDraft.id) ? t('acc.editAccount') : t('acc.newAccount')}
          onClose={() => setAccountDraft(null)}
          onSave={async () => {
            await store.saveAccount({ ...accountDraft, id: accountDraft.id || undefined });
            setAccountDraft(null);
          }}
        >
          <div className="grid gap-3 md:grid-cols-2">
            <Field label={t('acc.name')}>
              <input className="win-input" value={accountDraft.name} autoFocus onChange={(event) => setAccountDraft({ ...accountDraft, name: event.target.value })} />
            </Field>
            <Field label={t('acc.accountTypeLabel')}>
              <Select
                value={accountDraft.type}
                onChange={(value) => setAccountDraft({ ...accountDraft, type: value as Account['type'] })}
                options={['asset', 'liability', 'equity', 'income', 'expense'].map((type) => ({ value: type, label: t(`acc.accountType.${type}`) }))}
              />
            </Field>
            <Field label={t('acc.openingBalance')}>
              <input type="number" className="win-input" value={accountDraft.balance} onChange={(event) => setAccountDraft({ ...accountDraft, balance: Number(event.target.value) })} />
            </Field>
            <Field label={t('acc.currency')}>
              <input className="win-input" dir="ltr" value={accountDraft.currency} onChange={(event) => setAccountDraft({ ...accountDraft, currency: event.target.value })} />
            </Field>
          </div>
        </EntityModal>
      ) : null}

      {categoryDraft ? (
        <EntityModal
          title={t('acc.newCategory')}
          onClose={() => setCategoryDraft(null)}
          onSave={async () => {
            await store.saveCategory({ ...categoryDraft, id: categoryDraft.id || undefined });
            setCategoryDraft(null);
          }}
        >
          <div className="grid gap-3 md:grid-cols-2">
            <Field label={t('acc.name')}>
              <input className="win-input" value={categoryDraft.name} autoFocus onChange={(event) => setCategoryDraft({ ...categoryDraft, name: event.target.value })} />
            </Field>
            <Field label={t('acc.kind')}>
              <Select
                value={categoryDraft.type}
                onChange={(value) => setCategoryDraft({ ...categoryDraft, type: value as TransactionType })}
                options={[
                  { value: 'income', label: t('acc.income') },
                  { value: 'expense', label: t('acc.expenses') },
                ]}
              />
            </Field>
            <Field label={t('acc.color')}>
              <input type="color" className="h-9 w-full cursor-pointer rounded border border-[var(--border)] bg-transparent" value={categoryDraft.color} onChange={(event) => setCategoryDraft({ ...categoryDraft, color: event.target.value })} />
            </Field>
          </div>
        </EntityModal>
      ) : null}

      {txDraft ? (
        <EntityModal
          title={txDraft.id && store.transactions.some((entry) => entry.id === txDraft.id) ? t('acc.editTransaction') : t('acc.newTransaction')}
          onClose={() => setTxDraft(null)}
          onSave={async () => {
            await store.saveTransaction({ ...txDraft, id: txDraft.id || undefined });
            setTxDraft(null);
          }}
        >
          <div className="grid gap-3 md:grid-cols-2">
            <Field label={t('acc.type')}>
              <Select
                value={txDraft.type}
                onChange={(value) => setTxDraft({ ...txDraft, type: value as TransactionType })}
                options={[
                  { value: 'income', label: t('acc.income') },
                  { value: 'expense', label: t('acc.expenses') },
                ]}
              />
            </Field>
            <Field label={t('acc.amount')}>
              <input type="number" step="0.01" className="win-input" value={txDraft.amount} onChange={(event) => setTxDraft({ ...txDraft, amount: Number(event.target.value) })} />
            </Field>
            <Field label={t('acc.date')}>
              <input type="date" className="win-input" value={txDraft.date} onChange={(event) => setTxDraft({ ...txDraft, date: event.target.value })} />
            </Field>
            <Field label={t('acc.category')}>
              <input
                className="win-input"
                list="acc-categories"
                value={txDraft.category}
                onChange={(event) => setTxDraft({ ...txDraft, category: event.target.value })}
              />
              <datalist id="acc-categories">
                {store.categories.filter((category) => category.type === txDraft.type).map((category) => (
                  <option key={category.id} value={category.name} />
                ))}
              </datalist>
            </Field>
            <Field label={t('acc.account')}>
              <Select value={txDraft.accountId} onChange={(value) => setTxDraft({ ...txDraft, accountId: value })} options={store.accounts.map((account) => ({ value: account.id, label: `${account.name} (${money(account.balance)})` }))} />
            </Field>
            <Field label={t('acc.party')} hint={t('acc.partyHint')}>
              <Select
                value={txDraft.partyId ?? ''}
                onChange={(value) => setTxDraft({ ...txDraft, partyId: value || undefined })}
                options={[{ value: '', label: t('acc.none') }, ...store.parties.map((party) => ({ value: party.id, label: party.name }))]}
              />
            </Field>
            <Field label={t('acc.method')}>
              <Select value={txDraft.method} onChange={(value) => setTxDraft({ ...txDraft, method: value as LedgerEntry['method'] })} options={METHODS.map((method) => ({ value: method, label: t(`acc.method.${method}`) }))} />
            </Field>
            <Field label={t('acc.description')}>
              <input className="win-input" value={txDraft.description} onChange={(event) => setTxDraft({ ...txDraft, description: event.target.value })} />
            </Field>
          </div>
        </EntityModal>
      ) : null}

      {invoiceDraft ? (
        <InvoiceEditor
          invoice={invoiceDraft}
          customers={customers}
          settings={store.settings}
          currency={currency}
          onClose={() => setInvoiceDraft(null)}
          onSave={async (issue) => {
            const id = await store.saveInvoice({ ...invoiceDraft, id: invoiceDraft.id || undefined });
            if (issue) await store.issueInvoice(id);
            setInvoiceDraft(null);
          }}
          t={t}
        />
      ) : null}

      {paymentFor ? (
        <PaymentDialog
          invoice={paymentFor}
          accounts={store.accounts.filter((account) => account.type === 'asset')}
          onClose={() => setPaymentFor(null)}
          onConfirm={async (amount, accountId, date, method) => {
            await store.recordPayment(paymentFor.id, amount, accountId, date, method);
            setPaymentFor(null);
          }}
          money={money}
          t={t}
        />
      ) : null}

      {viewInvoice ? (
        <InvoiceView invoice={viewInvoice} partyName={partyName} money={money} company={store.settings.companyName} onClose={() => setViewInvoice(null)} onPay={() => { setPaymentFor(viewInvoice); setViewInvoice(null); }} onEdit={() => { setInvoiceDraft(viewInvoice); setViewInvoice(null); }} t={t} />
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Pieces                                                              */
/* ------------------------------------------------------------------ */

function StatCard({ icon, label, value, tone = 'neutral', hint }: { icon: React.ReactNode; label: string; value: string; tone?: 'neutral' | 'accent' | 'success' | 'danger'; hint?: string }) {
  const toneClass = tone === 'success' ? 'text-emerald-500' : tone === 'danger' ? 'text-red-500' : tone === 'accent' ? 'text-[var(--accent)]' : '';
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3">
      <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide opacity-55">
        <span className={toneClass}>{icon}</span>
        <span className="truncate">{label}</span>
      </p>
      <p className={`mt-1 truncate text-[19px] font-semibold tabular-nums ${toneClass}`}>{value}</p>
      {hint ? <p className="mt-0.5 text-[10.5px] opacity-55">{hint}</p> : null}
    </div>
  );
}

function Panel({ title, icon, action, children }: { title: string; icon?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3">
      <header className="mb-2 flex items-center gap-2">
        {icon ? <span className="opacity-60">{icon}</span> : null}
        <h3 className="text-[12.5px] font-semibold">{title}</h3>
        <div className="ms-auto">{action}</div>
      </header>
      {children}
    </section>
  );
}

function StatusBadge({ status, overdue }: { status: Invoice['status']; overdue: boolean }) {
  const tone = status === 'paid' ? 'success' : status === 'draft' ? 'neutral' : overdue ? 'danger' : 'warning';
  return (
    <Badge tone={tone}>
      {overdue && status !== 'paid' ? 'Overdue · ' : ''}
      {status}
    </Badge>
  );
}

function Table({ headers, rows, empty }: { headers: React.ReactNode[]; rows: React.ReactNode[][]; empty: string }) {
  if (!rows.length) return <EmptyState icon={<FileText size={30} />} title={empty} />;
  return (
    <div className="scroll-thin overflow-x-auto rounded-lg border border-[var(--border)]">
      <table className="w-full min-w-[640px] border-collapse text-[12px]">
        <thead>
          <tr className="bg-[var(--surface-2)] text-[10.5px] uppercase tracking-wide opacity-60">
            {headers.map((header, index) => (
              <th key={index} className={`whitespace-nowrap px-3 py-2 font-semibold ${index === 0 ? 'text-start' : 'text-start'}`}>
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-t border-[var(--border)] transition hover:bg-[var(--hover)]">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="max-w-56 truncate px-3 py-1.5 align-middle">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RowActions({ onEdit, onDelete, extra }: { onEdit: () => void; onDelete: () => void; extra?: { label: string; onClick: () => void; disabled?: boolean }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative flex items-center justify-end gap-1">
      {extra?.map((item) =>
        item.label.length < 18 ? (
          <button key={item.label} type="button" className="win-button px-2 py-0.5 text-[11px]" disabled={item.disabled} onClick={item.onClick}>
            {item.label}
          </button>
        ) : null,
      )}
      <button type="button" className="icon-button h-6 w-6" onClick={onEdit} aria-label="Edit">
        <Pencil size={12} />
      </button>
      <button type="button" className="icon-button h-6 w-6 text-red-500" onClick={onDelete} aria-label="Delete">
        <Trash2 size={12} />
      </button>
      {extra?.some((item) => item.label.length >= 18) ? (
        <>
          <button type="button" className="icon-button h-6 w-6" onClick={() => setOpen((value) => !value)} aria-label="More">
            ⋯
          </button>
          {open ? (
            <div className="panel absolute end-0 top-full z-40 mt-1 w-44 p-1">
              {extra
                .filter((item) => item.label.length >= 18)
                .map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    className="list-row w-full text-[12px]"
                    disabled={item.disabled}
                    onClick={() => {
                      item.onClick();
                      setOpen(false);
                    }}
                  >
                    {item.label}
                  </button>
                ))}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

const PAGE_SIZE = 25;

function paginate<T>(items: T[], page: number): T[] {
  return items.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
}

function Pager({ count, page, onPage }: { count: number; page: number; onPage: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  if (pages <= 1) return null;
  return (
    <div className="mt-2 flex items-center justify-end gap-2 text-[11.5px]">
      <button type="button" className="win-button px-2 py-0.5" disabled={page === 0} onClick={() => onPage(page - 1)}>
        ‹
      </button>
      <span className="tabular-nums opacity-60">
        {page + 1} / {pages}
      </span>
      <button type="button" className="win-button px-2 py-0.5" disabled={page >= pages - 1} onClick={() => onPage(page + 1)}>
        ›
      </button>
    </div>
  );
}

function EntityModal({ title, children, onClose, onSave }: { title: string; children: React.ReactNode; onClose: () => void; onSave: () => Promise<void> }) {
  const { t } = useT();
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      open
      title={title}
      onClose={onClose}
      width="max-w-2xl"
      footer={
        <>
          <button type="button" className="win-button" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className="win-button win-button-accent"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await onSave();
              setBusy(false);
            }}
          >
            {t('common.save')}
          </button>
        </>
      }
    >
      {children}
    </Modal>
  );
}

function InvoiceEditor({
  invoice,
  customers,
  settings,
  currency,
  onClose,
  onSave,
  t,
}: {
  invoice: Invoice;
  customers: Party[];
  settings: typeof DEFAULT_SETTINGS;
  currency: string;
  onClose: () => void;
  onSave: (issue: boolean) => Promise<void>;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const [draft, setDraft] = useState<Invoice>(invoice);
  const totals = invoiceTotals(draft);
  const money = (value: number) => formatCurrency(value, currency);

  const setLine = (id: string, patch: Partial<InvoiceLine>) =>
    setDraft((current) => ({ ...current, lines: current.lines.map((line) => (line.id === id ? { ...line, ...patch } : line)) }));

  const addLine = () =>
    setDraft((current) => ({ ...current, lines: [...current.lines, { id: uid('line'), description: '', quantity: 1, unitPrice: 0, discount: 0 }] }));

  const removeLine = (id: string) => setDraft((current) => ({ ...current, lines: current.lines.filter((line) => line.id !== id) }));

  return (
    <Modal
      open
      title={draft.id ? `${t('acc.editInvoice')} · ${draft.number}` : t('acc.newInvoice')}
      onClose={onClose}
      width="max-w-4xl"
      footer={
        <>
          <button type="button" className="win-button" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="button" className="win-button" onClick={() => void onSave(false)}>
            {t('acc.saveDraft')}
          </button>
          <button type="button" className="win-button win-button-accent" disabled={!draft.customerId || !draft.lines.length} onClick={() => void onSave(true)}>
            {t('acc.saveAndIssue')}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid gap-3 md:grid-cols-4">
          <Field label={t('acc.customer')}>
            <Select value={draft.customerId} onChange={(value) => setDraft({ ...draft, customerId: value })} options={[{ value: '', label: t('acc.selectCustomer') }, ...customers.map((customer) => ({ value: customer.id, label: customer.name }))]} />
          </Field>
          <Field label={t('acc.number')}>
            <input className="win-input" dir="ltr" value={draft.number} onChange={(event) => setDraft({ ...draft, number: event.target.value })} />
          </Field>
          <Field label={t('acc.issueDate')}>
            <input type="date" className="win-input" value={draft.issueDate} onChange={(event) => setDraft({ ...draft, issueDate: event.target.value })} />
          </Field>
          <Field label={t('acc.dueDate')}>
            <input type="date" className="win-input" value={draft.dueDate} onChange={(event) => setDraft({ ...draft, dueDate: event.target.value })} />
          </Field>
        </div>

        <div className="overflow-hidden rounded-lg border border-[var(--border)]">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-[var(--surface-2)] text-[10.5px] uppercase tracking-wide opacity-60">
                <th className="px-2 py-1.5 text-start">{t('acc.description')}</th>
                <th className="w-20 px-2 py-1.5 text-end">{t('acc.qty')}</th>
                <th className="w-28 px-2 py-1.5 text-end">{t('acc.unitPrice')}</th>
                <th className="w-20 px-2 py-1.5 text-end">{t('acc.discount')}</th>
                <th className="w-28 px-2 py-1.5 text-end">{t('acc.lineTotal')}</th>
                <th className="w-10 px-2 py-1.5" />
              </tr>
            </thead>
            <tbody>
              {draft.lines.map((line) => (
                <tr key={line.id} className="border-t border-[var(--border)]">
                  <td className="px-2 py-1">
                    <input className="win-input h-7 px-2 text-[12px]" value={line.description} placeholder={t('acc.itemDescription')} onChange={(event) => setLine(line.id, { description: event.target.value })} />
                  </td>
                  <td className="px-2 py-1">
                    <input type="number" min={0} step="0.01" className="win-input h-7 px-2 text-end text-[12px]" value={line.quantity} onChange={(event) => setLine(line.id, { quantity: Number(event.target.value) })} />
                  </td>
                  <td className="px-2 py-1">
                    <input type="number" min={0} step="0.01" className="win-input h-7 px-2 text-end text-[12px]" value={line.unitPrice} onChange={(event) => setLine(line.id, { unitPrice: Number(event.target.value) })} />
                  </td>
                  <td className="px-2 py-1">
                    <input type="number" min={0} max={100} className="win-input h-7 px-2 text-end text-[12px]" value={line.discount} onChange={(event) => setLine(line.id, { discount: Number(event.target.value) })} />
                  </td>
                  <td className="px-2 py-1 text-end tabular-nums">{money(line.quantity * line.unitPrice * (1 - line.discount / 100))}</td>
                  <td className="px-1 py-1 text-center">
                    <button type="button" className="icon-button h-6 w-6 text-red-500" onClick={() => removeLine(line.id)} aria-label={t('common.remove')}>
                      <X size={12} />
                    </button>
                  </td>
                </tr>
              ))}
              {!draft.lines.length ? (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-center text-[11.5px] opacity-55">
                    {t('acc.noLines')}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-start gap-4">
          <button type="button" className="win-button flex items-center gap-1.5 px-2.5 py-1 text-[12px]" onClick={addLine}>
            <Plus size={13} /> {t('acc.addLine')}
          </button>
          <label className="flex w-32 flex-col gap-1 text-[11.5px]">
            <span className="opacity-60">{t('acc.taxRate')} (%)</span>
            <input type="number" min={0} max={100} step={0.5} className="win-input h-8" value={draft.taxRate} onChange={(event) => setDraft({ ...draft, taxRate: Number(event.target.value) })} />
          </label>
          <label className="flex w-36 flex-col gap-1 text-[11.5px]">
            <span className="opacity-60">{t('acc.extraDiscount')}</span>
            <input type="number" min={0} step="0.01" className="win-input h-8" value={draft.extraDiscount} onChange={(event) => setDraft({ ...draft, extraDiscount: Number(event.target.value) })} />
          </label>
          <label className="flex w-36 flex-col gap-1 text-[11.5px]">
            <span className="opacity-60">{t('acc.paidSoFar')}</span>
            <input type="number" min={0} step="0.01" className="win-input h-8" value={draft.paid} onChange={(event) => setDraft({ ...draft, paid: Number(event.target.value) })} />
          </label>
          <div className="ms-auto min-w-56 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-2.5 text-[12px]">
            <Row label={t('acc.subtotal')} value={money(totals.subtotal)} />
            <Row label={t('acc.discount')} value={`− ${money(totals.discount)}`} />
            <Row label={`${t('acc.tax')} (${draft.taxRate}%)`} value={money(totals.tax)} />
            <Row label={t('acc.total')} value={money(totals.total)} strong />
            <Row label={t('acc.paid')} value={money(totals.paid)} />
            <Row label={t('acc.balance')} value={money(totals.due)} strong tone={totals.due > 0 ? 'danger' : 'success'} />
          </div>
        </div>

        <Field label={t('acc.notes')}>
          <textarea className="win-input min-h-16 resize-y text-[12px]" value={draft.notes ?? ''} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} />
        </Field>
        <p className="text-[10.5px] opacity-55">
          {settings.companyName} · {t('acc.simulatedNote')}
        </p>
      </div>
    </Modal>
  );
}

function Row({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: 'danger' | 'success' }) {
  return (
    <div className="flex items-center justify-between gap-3 py-0.5">
      <span className="opacity-65">{label}</span>
      <span className={`tabular-nums ${strong ? 'font-semibold' : ''} ${tone === 'danger' ? 'text-red-500' : tone === 'success' ? 'text-emerald-500' : ''}`}>{value}</span>
    </div>
  );
}

function PaymentDialog({
  invoice,
  accounts,
  onClose,
  onConfirm,
  money,
  t,
}: {
  invoice: Invoice;
  accounts: Account[];
  onClose: () => void;
  onConfirm: (amount: number, accountId: string, date: string, method: LedgerEntry['method']) => Promise<void>;
  money: (value: number) => string;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const totals = invoiceTotals(invoice);
  const [amount, setAmount] = useState(totals.due);
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '');
  const [date, setDate] = useState(isoDate(new Date()));
  const [method, setMethod] = useState<LedgerEntry['method']>('bank');
  const [busy, setBusy] = useState(false);

  return (
    <Modal
      open
      title={`${t('acc.recordPayment')} · ${invoice.number}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="win-button" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className="win-button win-button-accent"
            disabled={busy || amount <= 0 || amount > totals.due + 0.001 || !accountId}
            onClick={async () => {
              setBusy(true);
              await onConfirm(amount, accountId, date, method);
              setBusy(false);
            }}
          >
            {t('acc.recordPayment')}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3 text-[12px]">
          <Row label={t('acc.total')} value={money(totals.total)} />
          <Row label={t('acc.paid')} value={money(totals.paid)} />
          <Row label={t('acc.balance')} value={money(totals.due)} strong tone="danger" />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label={t('acc.amount')}>
            <input type="number" min={0} step="0.01" className="win-input" value={amount} onChange={(event) => setAmount(Number(event.target.value))} />
          </Field>
          <Field label={t('acc.account')}>
            <Select value={accountId} onChange={setAccountId} options={accounts.map((account) => ({ value: account.id, label: `${account.name} (${money(account.balance)})` }))} />
          </Field>
          <Field label={t('acc.date')}>
            <input type="date" className="win-input" value={date} onChange={(event) => setDate(event.target.value)} />
          </Field>
          <Field label={t('acc.method')}>
            <Select value={method} onChange={(value) => setMethod(value as LedgerEntry['method'])} options={METHODS.map((item) => ({ value: item, label: t(`acc.method.${item}`) }))} />
          </Field>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {[0.25, 0.5, 1].map((fraction) => (
            <button key={fraction} type="button" className="win-button px-2 py-0.5 text-[11.5px]" onClick={() => setAmount(Math.round(totals.due * fraction * 100) / 100)}>
              {fraction === 1 ? t('acc.fullAmount') : `${fraction * 100}%`}
            </button>
          ))}
        </div>
        <p className="text-[10.5px] leading-relaxed opacity-55">{t('acc.paymentNote')}</p>
      </div>
    </Modal>
  );
}

function InvoiceView({
  invoice,
  partyName,
  money,
  company,
  onClose,
  onPay,
  onEdit,
  t,
}: {
  invoice: Invoice;
  partyName: (id?: string) => string;
  money: (value: number) => string;
  company: string;
  onClose: () => void;
  onPay: () => void;
  onEdit: () => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const totals = invoiceTotals(invoice);
  const status = invoiceStatus(invoice);
  return (
    <Modal
      open
      title={`${invoice.number} · ${partyName(invoice.customerId)}`}
      onClose={onClose}
      width="max-w-2xl"
      footer={
        <>
          <button type="button" className="win-button flex items-center gap-1.5" onClick={() => window.print()}>
            <Printer size={13} /> {t('acc.print')}
          </button>
          <button type="button" className="win-button flex items-center gap-1.5" onClick={onEdit}>
            <Pencil size={13} /> {t('common.edit')}
          </button>
          <button type="button" className="win-button win-button-accent" disabled={status === 'draft' || totals.due <= 0} onClick={onPay}>
            {t('acc.recordPayment')}
          </button>
        </>
      }
    >
      <div className="print-area space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[15px] font-semibold">{company}</p>
            <p className="text-[11.5px] opacity-60">{t('acc.invoice')}</p>
          </div>
          <div className="text-end text-[11.5px]">
            <p className="font-mono" dir="ltr">
              {invoice.number}
            </p>
            <p className="opacity-60" dir="ltr">
              {t('acc.issueDate')}: {invoice.issueDate}
            </p>
            <p className="opacity-60" dir="ltr">
              {t('acc.dueDate')}: {invoice.dueDate}
            </p>
            <div className="mt-1">
              <StatusBadge status={status} overdue={isOverdue(invoice)} />
            </div>
          </div>
        </div>

        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-[var(--border)] text-[10.5px] uppercase tracking-wide opacity-55">
              <th className="py-1.5 text-start">{t('acc.description')}</th>
              <th className="py-1.5 text-end">{t('acc.qty')}</th>
              <th className="py-1.5 text-end">{t('acc.unitPrice')}</th>
              <th className="py-1.5 text-end">{t('acc.discount')}</th>
              <th className="py-1.5 text-end">{t('acc.lineTotal')}</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((line) => (
              <tr key={line.id} className="border-b border-[var(--border)] last:border-0">
                <td className="py-1.5">{line.description}</td>
                <td className="py-1.5 text-end tabular-nums">{formatMoney(line.quantity)}</td>
                <td className="py-1.5 text-end tabular-nums">{money(line.unitPrice)}</td>
                <td className="py-1.5 text-end tabular-nums">{line.discount}%</td>
                <td className="py-1.5 text-end tabular-nums">{money(line.quantity * line.unitPrice * (1 - line.discount / 100))}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="ms-auto w-64 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3 text-[12px]">
          <Row label={t('acc.subtotal')} value={money(totals.subtotal)} />
          <Row label={t('acc.discount')} value={`− ${money(totals.discount)}`} />
          <Row label={`${t('acc.tax')} (${invoice.taxRate}%)`} value={money(totals.tax)} />
          <Row label={t('acc.total')} value={money(totals.total)} strong />
          <Row label={t('acc.paid')} value={money(totals.paid)} />
          <Row label={t('acc.balance')} value={money(totals.due)} strong tone={totals.due > 0 ? 'danger' : 'success'} />
        </div>

        {invoice.notes ? <p className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-2.5 text-[11.5px] opacity-75">{invoice.notes}</p> : null}
        <p className="text-[10.5px] opacity-50">{t('acc.simulatedNote')}</p>
      </div>
    </Modal>
  );
}

/* ---------------- factories ---------------- */

function blankParty(kind: Party['kind']): Party {
  return { id: '', kind, name: '', balance: 0, createdAt: Date.now() };
}

function blankAccount(currency: string): Account {
  return { id: '', name: '', type: 'asset', balance: 0, currency };
}

function blankCategory(): Category {
  return { id: '', name: '', type: 'expense', color: '#2563eb' };
}

function blankTx(type: TransactionType, state: { accounts: Account[]; categories: Category[] }): LedgerEntry {
  return {
    id: '',
    date: isoDate(new Date()),
    type,
    amount: 0,
    category: state.categories.find((category) => category.type === type)?.name ?? '',
    accountId: state.accounts.find((account) => account.type === 'asset')?.id ?? state.accounts[0]?.id ?? '',
    description: '',
    method: 'bank',
    createdAt: Date.now(),
  };
}

function blankInvoice(settings: typeof DEFAULT_SETTINGS, customerId = ''): Invoice {
  const today = new Date();
  const due = new Date(today);
  due.setDate(due.getDate() + 30);
  return {
    id: '',
    number: `${settings.invoicePrefix}${settings.nextInvoiceNumber}`,
    customerId,
    issueDate: isoDate(today),
    dueDate: isoDate(due),
    lines: [{ id: uid('line'), description: '', quantity: 1, unitPrice: 0, discount: 0 }],
    taxRate: settings.taxRate,
    extraDiscount: 0,
    paid: 0,
    status: 'draft',
    currency: settings.currency,
    createdAt: Date.now(),
  };
}

export default AccountingApp;
