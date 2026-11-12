export type CategoryType = 'INCOME' | 'EXPENSE';
export type AccountType = 'ESPECES' | 'WAVE' | 'ORANGE_MONEY' | 'FREE_MONEY' | 'BANQUE' | 'EPARGNE' | 'AUTRE';

export interface User { id: number; fullName: string; email: string; currency: string; }
export interface AuthResponse { token: string; expiresIn: number; user: User; }

export interface Account {
  id: number; name: string; type: AccountType; initialBalance: number;
  balance: number; color: string; archived: boolean;
}
export interface AccountRequest {
  name: string; type: AccountType; initialBalance: number; color: string; archived: boolean;
}

export interface Category { id: number; name: string; type: CategoryType; icon: string; color: string; }
export type CategoryRequest = Omit<Category, 'id'>;

export interface Transaction {
  id: number; type: CategoryType; amount: number; date: string; description: string | null;
  account: { id: number; name: string; type: string; color: string };
  category: { id: number; name: string; icon: string; color: string };
}
export type DocumentStatus = 'ARCHIVED' | 'EXTRACTED' | 'IMPORTED';
export interface ScannedDocument {
  id: number; fileName: string; contentType: string; sizeBytes: number; title: string | null; note: string | null;
  thumbnail: string | null; status: DocumentStatus; extractedCount: number; importedCount: number; createdAt: string;
}
export interface ExtractedLine {
  date: string; type: string; amount: number; category: string; account: string; description: string;
  rawText: string; uncertain: boolean;
}
export interface Extraction { lines: ExtractedLine[]; notes: string; }
export interface TransactionSummary { income: number; expense: number; net: number; count: number; }
export interface TransactionRequest {
  type: CategoryType; amount: number; date: string; accountId: number; categoryId: number;
  description: string;
}
export interface TransactionFilter {
  from?: string; to?: string; type?: CategoryType | ''; accountId?: number | null;
  categoryId?: number | null; q?: string;
}
export interface Page<T> { content: T[]; page: number; size: number; totalElements: number; totalPages: number; }

export const ACCOUNT_TYPES: { value: AccountType; label: string; icon: string; color: string }[] = [
  { value: 'ESPECES', label: 'Espèces', icon: 'cash-coin', color: '#198754' },
  { value: 'WAVE', label: 'Wave', icon: 'phone', color: '#1dc8ff' },
  { value: 'ORANGE_MONEY', label: 'Orange Money', icon: 'phone', color: '#ff7900' },
  { value: 'FREE_MONEY', label: 'Free Money', icon: 'phone', color: '#cd1e25' },
  { value: 'BANQUE', label: 'Banque', icon: 'bank', color: '#0d6efd' },
  { value: 'EPARGNE', label: 'Épargne', icon: 'piggy-bank', color: '#6f42c1' },
  { value: 'AUTRE', label: 'Autre', icon: 'wallet2', color: '#6c757d' },
];

export function accountTypeLabel(type: string): string {
  return ACCOUNT_TYPES.find(t => t.value === type)?.label ?? type;
}

/** Date du jour au format AAAA-MM-JJ (fuseau local). */
export function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function currentPeriod(): string {
  return today().slice(0, 7);
}

export function periodBounds(period: string): { from: string; to: string } {
  const [y, m] = period.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return { from: `${period}-01`, to: `${period}-${String(last).padStart(2, '0')}` };
}

export function shiftPeriod(period: string, months: number): string {
  const [y, m] = period.split('-').map(Number);
  const d = new Date(y, m - 1 + months, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function periodLabel(period: string): string {
  const [y, m] = period.split('-').map(Number);
  const s = new Date(y, m - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export type BudgetStatus = 'OK' | 'WARNING' | 'EXCEEDED';
export interface BudgetLine {
  id: number; categoryId: number; categoryName: string; icon: string; color: string;
  limitAmount: number; spent: number; remaining: number; percent: number; status: BudgetStatus;
}
export interface BudgetOverview {
  period: string; totalLimit: number; totalSpent: number; remaining: number; percent: number; lines: BudgetLine[];
}
export interface BudgetRequest { categoryId: number; period: string; limitAmount: number; }

export interface Goal {
  id: number; name: string; targetAmount: number; savedAmount: number; remaining: number; percent: number;
  deadline: string | null; monthsLeft: number | null; monthlyNeeded: number | null; icon: string; color: string;
  completed: boolean;
}
export interface GoalRequest {
  name: string; targetAmount: number; savedAmount?: number; deadline: string | null; icon: string; color: string;
}

export interface Dashboard {
  period: string; income: number; expense: number; net: number; savingsRate: number;
  expenseChangePercent: number | null; totalBalance: number;
  expensesByCategory: { categoryId: number; name: string; icon: string; color: string; total: number; percent: number }[];
  trend: { period: string; income: number; expense: number }[];
  budget: { totalLimit: number; totalSpent: number; percent: number; alerts: BudgetLine[] };
  recent: Transaction[];
  goals: Goal[];
}

export function shortPeriodLabel(period: string): string {
  const [y, m] = period.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('fr-FR', { month: 'short' });
}
