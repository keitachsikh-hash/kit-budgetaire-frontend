import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_URL } from './config';
import {
  Account, AccountRequest, BudgetOverview, BudgetRequest, Category, CategoryRequest, CategoryType, Dashboard, Goal,
  Extraction, GoalRequest, Page, ReportPeriod, ScannedDocument, Transaction, TransactionFilter, TransactionRequest, TransactionSummary,
} from './models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  accounts(): Observable<Account[]> {
    return this.http.get<Account[]>(`${API_URL}/accounts`);
  }
  saveAccount(req: AccountRequest, id?: number): Observable<Account> {
    return id ? this.http.put<Account>(`${API_URL}/accounts/${id}`, req)
      : this.http.post<Account>(`${API_URL}/accounts`, req);
  }
  deleteAccount(id: number): Observable<void> {
    return this.http.delete<void>(`${API_URL}/accounts/${id}`);
  }

  categories(type?: CategoryType): Observable<Category[]> {
    const params = type ? new HttpParams().set('type', type) : undefined;
    return this.http.get<Category[]>(`${API_URL}/categories`, { params });
  }
  saveCategory(req: CategoryRequest, id?: number): Observable<Category> {
    return id ? this.http.put<Category>(`${API_URL}/categories/${id}`, req)
      : this.http.post<Category>(`${API_URL}/categories`, req);
  }
  deleteCategory(id: number): Observable<void> {
    return this.http.delete<void>(`${API_URL}/categories/${id}`);
  }

  transactions(filter: TransactionFilter, page = 0, size = 20): Observable<Page<Transaction>> {
    return this.http.get<Page<Transaction>>(`${API_URL}/transactions`,
      { params: toParams(filter).set('page', page).set('size', size) });
  }
  transactionSummary(filter: TransactionFilter): Observable<TransactionSummary> {
    return this.http.get<TransactionSummary>(`${API_URL}/transactions/summary`, { params: toParams(filter) });
  }
  exportTransactions(filter: TransactionFilter): Observable<Blob> {
    return this.http.get(`${API_URL}/transactions/export`, { params: toParams(filter), responseType: 'blob' });
  }
  /** Relevé PDF des dépenses de la semaine / du mois / de l'année contenant la date. */
  expensesPdf(period: ReportPeriod, date: string): Observable<Blob> {
    return this.http.get(`${API_URL}/transactions/expenses/pdf`,
      { params: new HttpParams().set('period', period).set('date', date), responseType: 'blob' });
  }
  saveTransaction(req: TransactionRequest, id?: number): Observable<Transaction> {
    return id ? this.http.put<Transaction>(`${API_URL}/transactions/${id}`, req)
      : this.http.post<Transaction>(`${API_URL}/transactions`, req);
  }
  /** Saisie multiple : tout est enregistré, ou rien si une ligne est invalide. */
  saveTransactions(items: TransactionRequest[]): Observable<Transaction[]> {
    return this.http.post<Transaction[]>(`${API_URL}/transactions/batch`, { items });
  }
  deleteTransaction(id: number): Observable<void> {
    return this.http.delete<void>(`${API_URL}/transactions/${id}`);
  }

  dashboard(period: string): Observable<Dashboard> {
    return this.http.get<Dashboard>(`${API_URL}/dashboard`, { params: { period } });
  }

  budgets(period: string): Observable<BudgetOverview> {
    return this.http.get<BudgetOverview>(`${API_URL}/budgets`, { params: { period } });
  }
  saveBudget(req: BudgetRequest, id?: number): Observable<void> {
    return id ? this.http.put<void>(`${API_URL}/budgets/${id}`, req)
      : this.http.post<void>(`${API_URL}/budgets`, req);
  }
  deleteBudget(id: number): Observable<void> {
    return this.http.delete<void>(`${API_URL}/budgets/${id}`);
  }
  copyPreviousBudgets(period: string): Observable<{ copied: number }> {
    return this.http.post<{ copied: number }>(`${API_URL}/budgets/copy-previous`, null, { params: { period } });
  }

  goals(): Observable<Goal[]> {
    return this.http.get<Goal[]>(`${API_URL}/goals`);
  }
  saveGoal(req: GoalRequest, id?: number): Observable<Goal> {
    return id ? this.http.put<Goal>(`${API_URL}/goals/${id}`, req) : this.http.post<Goal>(`${API_URL}/goals`, req);
  }
  contribute(id: number, amount: number): Observable<Goal> {
    return this.http.post<Goal>(`${API_URL}/goals/${id}/contributions`, { amount });
  }
  deleteGoal(id: number): Observable<void> {
    return this.http.delete<void>(`${API_URL}/goals/${id}`);
  }

  // Copies manuscrites
  documents(page: number, size = 5): Observable<Page<ScannedDocument>> {
    return this.http.get<Page<ScannedDocument>>(`${API_URL}/documents`, { params: { page, size } });
  }
  aiStatus(): Observable<{ enabled: boolean }> {
    return this.http.get<{ enabled: boolean }>(`${API_URL}/documents/ai-status`);
  }
  uploadDocument(file: Blob, fileName: string, title: string, thumbnail: string | null): Observable<ScannedDocument> {
    const form = new FormData();
    form.append('file', file, fileName);
    if (title) form.append('title', title);
    if (thumbnail) form.append('thumbnail', thumbnail);
    return this.http.post<ScannedDocument>(`${API_URL}/documents`, form);
  }
  updateDocument(id: number, title: string, note: string): Observable<ScannedDocument> {
    return this.http.put<ScannedDocument>(`${API_URL}/documents/${id}`, { title, note });
  }
  documentFile(id: number): Observable<Blob> {
    return this.http.get(`${API_URL}/documents/${id}/file`, { responseType: 'blob' });
  }
  extractDocument(id: number): Observable<Extraction> {
    return this.http.post<Extraction>(`${API_URL}/documents/${id}/extract`, null);
  }
  markDocumentImported(id: number, count: number): Observable<ScannedDocument> {
    return this.http.post<ScannedDocument>(`${API_URL}/documents/${id}/imported`, { count });
  }
  deleteDocument(id: number): Observable<void> {
    return this.http.delete<void>(`${API_URL}/documents/${id}`);
  }
}

function toParams(filter: TransactionFilter): HttpParams {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(filter)) {
    if (value !== undefined && value !== null && value !== '') {
      params = params.set(key, String(value));
    }
  }
  return params;
}

/** Extrait un message lisible d'une erreur ProblemDetail renvoyée par l'API. */
export function errorMessage(err: unknown): string {
  const e = err as { status?: number; error?: { detail?: string; errors?: Record<string, string> } };
  if (e?.status === 0) {
    return 'Serveur injoignable : vérifiez que l\'API Spring Boot tourne sur le port 8080.';
  }
  const fieldErrors = e?.error?.errors ? Object.values(e.error.errors).join(' · ') : '';
  return [e?.error?.detail, fieldErrors].filter(Boolean).join(' — ') || 'Une erreur est survenue.';
}
