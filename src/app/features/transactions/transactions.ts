import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { ApiService, errorMessage } from '../../core/api.service';
import {
  Account, Category, CategoryType, Page, Transaction, TransactionSummary, TransactionFilter, TransactionRequest, currentPeriod,
  periodBounds, periodLabel, shiftPeriod, today,
} from '../../core/models';
import { PendingImportStore } from '../../core/pending-import';
import { downloadBlob } from '../../shared/file';
import { readSpreadsheet } from '../../shared/spreadsheet';
import { csvTemplate, toTransactions, xlsxTemplate } from './transaction-import';
import { MoneyPipe } from '../../shared/money.pipe';

@Component({
  selector: 'app-transactions',
  imports: [FormsModule, MoneyPipe, RouterLink],
  template: `
    <div class="page-header">
      <div>
        <div class="eyebrow">Espace Particulier</div>
        <h1 class="page-title">Dépenses & revenus</h1>
      </div>
      <div class="d-flex gap-2 flex-wrap">
        <div class="dropdown">
          <button class="btn btn-outline-secondary dropdown-toggle" data-bs-toggle="dropdown" aria-expanded="false">
            <i class="bi bi-file-earmark-spreadsheet me-1"></i>Fichier
          </button>
          <ul class="dropdown-menu">
            <li><h6 class="dropdown-header">Saisir depuis un fichier</h6></li>
            <li><button class="dropdown-item" (click)="downloadTemplate('xlsx')"><i class="bi bi-file-earmark-excel me-2 text-success"></i>Télécharger le modèle Excel</button></li>
            <li><button class="dropdown-item" (click)="downloadTemplate('csv')"><i class="bi bi-filetype-csv me-2"></i>Télécharger le modèle CSV</button></li>
            <li><button class="dropdown-item" (click)="fileInput.click()"><i class="bi bi-upload me-2 text-accent"></i>Importer un fichier rempli…</button></li>
            <li><a class="dropdown-item" routerLink="/archives"><i class="bi bi-journal-text me-2 text-accent"></i>Depuis une copie manuscrite…</a></li>
            <li><hr class="dropdown-divider"></li>
            <li><button class="dropdown-item" (click)="exportCsv()"><i class="bi bi-download me-2"></i>Exporter les opérations (CSV)</button></li>
          </ul>
        </div>
        <input #fileInput type="file" hidden accept=".xlsx,.csv,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
               (change)="importFile($event)">
        <button class="btn btn-accent d-none d-lg-inline-block" (click)="openBatch()"><i class="bi bi-plus-lg me-1"></i>Ajouter des opérations</button>
      </div>
    </div>

    <div class="card mb-3 d-print-none"><div class="card-body row g-2 align-items-end">
      <div class="col-12 col-md-auto">
        <div class="btn-group w-100">
          <button class="btn btn-outline-secondary" (click)="move(-1)" aria-label="Mois précédent"><i class="bi bi-chevron-left"></i></button>
          <span class="btn btn-outline-secondary disabled period-label">{{ periodText() }}</span>
          <button class="btn btn-outline-secondary" (click)="move(1)" aria-label="Mois suivant"><i class="bi bi-chevron-right"></i></button>
        </div>
      </div>
      <div class="col-6 col-md-2">
        <select class="form-select" [(ngModel)]="filter.type" (ngModelChange)="search(0)" aria-label="Type">
          <option value="">Tous types</option><option value="INCOME">Revenus</option><option value="EXPENSE">Dépenses</option>
        </select>
      </div>
      <div class="col-6 col-md-2">
        <select class="form-select" [(ngModel)]="filter.accountId" (ngModelChange)="search(0)" aria-label="Compte">
          <option [ngValue]="null">Tous comptes</option>
          @for (a of accounts(); track a.id) { <option [ngValue]="a.id">{{ a.name }}</option> }
        </select>
      </div>
      <div class="col-6 col-md-2">
        <select class="form-select" [(ngModel)]="filter.categoryId" (ngModelChange)="search(0)" aria-label="Catégorie">
          <option [ngValue]="null">Toutes catégories</option>
          @for (c of categories(); track c.id) { <option [ngValue]="c.id">{{ c.name }}</option> }
        </select>
      </div>
      <div class="col-6 col-md">
        <input class="form-control" placeholder="Rechercher…" [(ngModel)]="filter.q" (keyup.enter)="search(0)" aria-label="Recherche">
      </div>
    </div></div>

    <div class="row g-3 mb-3">
      <div class="col-4"><div class="card stat-card"><div class="card-body py-2">
        <div class="stat-label">Revenus</div><div class="fw-bold text-success">{{ (summary()?.income ?? 0) | money }}</div></div></div></div>
      <div class="col-4"><div class="card stat-card"><div class="card-body py-2">
        <div class="stat-label">Dépenses</div><div class="fw-bold text-danger">{{ (summary()?.expense ?? 0) | money }}</div></div></div></div>
      <div class="col-4"><div class="card stat-card"><div class="card-body py-2">
        <div class="stat-label">Solde</div><div class="fw-bold" [class.text-danger]="(summary()?.net ?? 0) < 0">{{ (summary()?.net ?? 0) | money }}</div></div></div></div>
    </div>

    @if (error()) { <div class="alert alert-danger">{{ error() }}</div> }
    @if (message()) { <div class="alert alert-info py-2 d-flex align-items-center"><span class="flex-grow-1">{{ message() }}</span>
      <button type="button" class="btn-close" (click)="message.set('')" aria-label="Fermer"></button></div> }
    <div class="card op-list overflow-hidden"><ul class="list-group list-group-flush">
      @for (t of page()?.content ?? []; track t.id) {
        <li class="list-group-item list-group-item-action d-flex align-items-center gap-3" (click)="openForm(t)">
          <span class="cat-icon" [style.background]="t.category.color"><i class="bi bi-{{ t.category.icon }}"></i></span>
          <div class="flex-grow-1 min-w-0">
            <div class="fw-semibold text-truncate">{{ t.description || t.category.name }}</div>
            <div class="small text-body-secondary text-truncate">{{ t.date }} · {{ t.account.name }}</div>
          </div>
          <strong class="text-nowrap" [class.text-success]="t.type === 'INCOME'" [class.text-danger]="t.type === 'EXPENSE'">
            {{ t.type === 'INCOME' ? '+' : '−' }} {{ t.amount | money }}</strong>
        </li>
      } @empty {
        <li class="list-group-item text-center text-body-secondary py-4">Aucune opération pour ces critères.</li>
      }
    </ul></div>
    <div class="card op-table"><div class="table-responsive">
      <table class="table table-hover align-middle mb-0">
        <thead><tr><th>Date</th><th>Catégorie</th><th class="d-none d-md-table-cell">Description</th>
          <th class="d-none d-sm-table-cell">Compte</th><th class="text-end">Montant</th><th class="d-print-none"></th></tr></thead>
        <tbody>
          @for (t of page()?.content ?? []; track t.id) {
            <tr>
              <td class="text-nowrap">{{ t.date }}</td>
              <td><span class="cat-icon sm me-2" [style.background]="t.category.color"><i class="bi bi-{{ t.category.icon }}"></i></span>{{ t.category.name }}</td>
              <td class="d-none d-md-table-cell text-body-secondary">{{ t.description }}</td>
              <td class="d-none d-sm-table-cell"><i class="bi bi-circle-fill small me-1" [style.color]="t.account.color"></i>{{ t.account.name }}</td>
              <td class="text-end fw-semibold text-nowrap" [class.text-success]="t.type === 'INCOME'" [class.text-danger]="t.type === 'EXPENSE'">
                {{ t.type === 'INCOME' ? '+' : '−' }} {{ t.amount | money }}</td>
              <td class="text-end text-nowrap d-print-none">
                <button class="btn btn-sm btn-link" (click)="openForm(t)" aria-label="Modifier"><i class="bi bi-pencil"></i></button>
                <button class="btn btn-sm btn-link text-danger" (click)="remove(t)" aria-label="Supprimer"><i class="bi bi-trash"></i></button>
              </td>
            </tr>
          } @empty {
            <tr><td colspan="6" class="text-center text-body-secondary py-4">Aucune opération pour ces critères.</td></tr>
          }
        </tbody>
      </table>
    </div></div>
    @if (page(); as pg) {
      @if (pg.totalElements > 0) {
        <nav class="pager d-print-none" aria-label="Pagination des opérations">
          <span class="small text-body-secondary">{{ pg.page * pg.size + 1 }}–{{ pg.page * pg.size + pg.content.length }} sur {{ pg.totalElements }}</span>
          @if (pg.totalPages > 1) {
            <div class="btn-group btn-group-sm">
              <button class="btn btn-outline-secondary" [disabled]="pg.page === 0" (click)="search(0)" aria-label="Première page"><i class="bi bi-chevron-double-left"></i></button>
              <button class="btn btn-outline-secondary" [disabled]="pg.page === 0" (click)="search(pg.page - 1)" aria-label="Page précédente"><i class="bi bi-chevron-left"></i></button>
              @for (n of pageNumbers(pg.page, pg.totalPages); track n) {
                <button class="btn" [class.btn-accent]="n === pg.page" [class.btn-outline-secondary]="n !== pg.page" (click)="search(n)">{{ n + 1 }}</button>
              }
              <button class="btn btn-outline-secondary" [disabled]="pg.page + 1 >= pg.totalPages" (click)="search(pg.page + 1)" aria-label="Page suivante"><i class="bi bi-chevron-right"></i></button>
              <button class="btn btn-outline-secondary" [disabled]="pg.page + 1 >= pg.totalPages" (click)="search(pg.totalPages - 1)" aria-label="Dernière page"><i class="bi bi-chevron-double-right"></i></button>
            </div>
          }
        </nav>
      }
    }

    @if (form()) {
      <div class="modal d-block" tabindex="-1" (click)="closeForm()">
        <div class="modal-dialog modal-dialog-centered" (click)="$event.stopPropagation()">
          <form class="modal-content" (ngSubmit)="save()" #f="ngForm">
            <div class="modal-header">
              <h2 class="modal-title h5">Modifier l'opération</h2>
              <button type="button" class="btn-close" (click)="closeForm()" aria-label="Fermer"></button>
            </div>
            <div class="modal-body">
              @if (formError()) { <div class="alert alert-danger py-2">{{ formError() }}</div> }
              <div class="btn-group w-100 mb-3" role="group">
                <input type="radio" class="btn-check" id="t-exp" name="type" value="EXPENSE" [(ngModel)]="form()!.type" (ngModelChange)="form()!.categoryId = 0">
                <label class="btn btn-outline-danger" for="t-exp">Dépense</label>
                <input type="radio" class="btn-check" id="t-inc" name="type" value="INCOME" [(ngModel)]="form()!.type" (ngModelChange)="form()!.categoryId = 0">
                <label class="btn btn-outline-success" for="t-inc">Revenu</label>
              </div>
              <div class="row g-3">
                <div class="col-7"><label class="form-label" for="amount">Montant (FCFA)</label>
                  <input id="amount" type="number" min="1" inputmode="decimal" class="form-control" name="amount" [(ngModel)]="form()!.amount" required></div>
                <div class="col-5"><label class="form-label" for="date">Date</label>
                  <input id="date" type="date" class="form-control" name="date" [(ngModel)]="form()!.date" required></div>
                <div class="col-6"><label class="form-label" for="cat">Catégorie</label>
                  <select id="cat" class="form-select" name="categoryId" [(ngModel)]="form()!.categoryId" required>
                    <option [ngValue]="0" disabled>Choisir…</option>
                    @for (c of categoriesOf(form()!.type); track c.id) { <option [ngValue]="c.id">{{ c.name }}</option> }
                  </select></div>
                <div class="col-6"><label class="form-label" for="acc">Compte</label>
                  <select id="acc" class="form-select" name="accountId" [(ngModel)]="form()!.accountId" required>
                    @for (a of activeAccounts(); track a.id) { <option [ngValue]="a.id">{{ a.name }}</option> }
                  </select></div>
                <div class="col-12"><label class="form-label" for="desc">Description</label>
                  <input id="desc" class="form-control" name="description" maxlength="255" [(ngModel)]="form()!.description"></div>
              </div>
            </div>
            <div class="modal-footer">
              @if (editId) {
                <button type="button" class="btn btn-outline-danger d-lg-none" (click)="removeEditing()" aria-label="Supprimer"><i class="bi bi-trash"></i></button>
              }
              <button type="button" class="btn btn-outline-secondary" (click)="closeForm()">Annuler</button>
              <button class="btn btn-accent" [disabled]="f.invalid || !form()!.categoryId || saving()">Enregistrer</button>
            </div>
          </form>
        </div>
      </div>
      <div class="modal-backdrop show"></div>
    }

    <!-- Saisie multiple : plusieurs dépenses et/ou revenus enregistrés en une fois -->
    @if (lines(); as items) {
      <div class="modal d-block" tabindex="-1" (click)="closeBatch()">
        <div class="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable" (click)="$event.stopPropagation()">
          <form class="modal-content" (ngSubmit)="saveBatch()" #bf="ngForm">
            <div class="modal-header">
              <h2 class="modal-title h5">Nouvelles opérations</h2>
              <button type="button" class="btn-close" (click)="closeBatch()" aria-label="Fermer"></button>
            </div>
            <div class="modal-body">
              <div class="d-flex align-items-start gap-2 mb-3">
                <p class="small text-body-secondary mb-0 flex-grow-1">Ajoutez autant de dépenses et de revenus que vous voulez, puis enregistrez tout d'un coup.</p>
                <button type="button" class="btn btn-sm btn-accent-soft text-nowrap" (click)="fileInput.click()"><i class="bi bi-upload me-1"></i>Importer</button>
              </div>
              @if (source(); as src) {
                <div class="alert alert-info py-2 small">
                  <div class="d-flex align-items-center gap-2">
                    <i class="bi bi-journal-text"></i>
                    <span class="flex-grow-1">Lu depuis la copie « {{ src.documentName }} ». Comparez avec l'original avant d'enregistrer.</span>
                    <button type="button" class="btn btn-sm btn-link p-0 text-nowrap" (click)="openSource()">Voir la copie</button>
                  </div>
                  @if (src.aiNotes) { <div class="mt-1 text-body-secondary"><i class="bi bi-chat-left-text me-1"></i>{{ src.aiNotes }}</div> }
                </div>
              }
              @if (incompleteCount(); as n) {
                <div class="alert alert-warning py-2 small d-flex align-items-center gap-2">
                  <i class="bi bi-exclamation-triangle"></i>
                  <span class="flex-grow-1">{{ n }} ligne{{ n > 1 ? 's' : '' }} à compléter avant d'enregistrer.</span>
                  <button type="button" class="btn btn-sm btn-link p-0" (click)="goToFirstIncomplete()">Voir</button>
                </div>
              }
              @if (formError()) { <div class="alert alert-danger py-2">{{ formError() }}</div> }
              @for (l of pageLines(items); track l; let k = $index) {
                @let i = batchPage() * BATCH_SIZE + k;
                <div class="batch-line" [class.income]="l.type === 'INCOME'" [class.incomplete]="!isComplete(l)">
                  <div class="d-flex align-items-center gap-2 mb-2">
                    <span class="batch-num">{{ i + 1 }}</span>
                    <div class="btn-group btn-group-sm flex-grow-1" role="group" aria-label="Type">
                      <input type="radio" class="btn-check" [id]="'b-exp' + i" [name]="'type' + i" value="EXPENSE" [(ngModel)]="l.type" (ngModelChange)="l.categoryId = 0">
                      <label class="btn btn-outline-danger" [for]="'b-exp' + i"><i class="bi bi-dash-lg me-1"></i>Dépense</label>
                      <input type="radio" class="btn-check" [id]="'b-inc' + i" [name]="'type' + i" value="INCOME" [(ngModel)]="l.type" (ngModelChange)="l.categoryId = 0">
                      <label class="btn btn-outline-success" [for]="'b-inc' + i"><i class="bi bi-plus-lg me-1"></i>Revenu</label>
                    </div>
                    <button type="button" class="btn btn-sm btn-link text-body-secondary" (click)="duplicateLine(i)" title="Dupliquer" aria-label="Dupliquer la ligne"><i class="bi bi-copy"></i></button>
                    <button type="button" class="btn btn-sm btn-link text-danger" (click)="removeLine(i)" [disabled]="items.length === 1" title="Retirer" aria-label="Retirer la ligne"><i class="bi bi-x-lg"></i></button>
                  </div>
                  <div class="row g-2">
                    <div class="col-5 col-md-3">
                      <input type="number" min="1" inputmode="decimal" class="form-control batch-amount" [name]="'amount' + i" [(ngModel)]="l.amount" placeholder="Montant" aria-label="Montant (FCFA)" required>
                    </div>
                    <div class="col-7 col-md-3">
                      <select class="form-select" [name]="'cat' + i" [(ngModel)]="l.categoryId" aria-label="Catégorie" required>
                        <option [ngValue]="0" disabled>Catégorie…</option>
                        @for (c of categoriesOf(l.type); track c.id) { <option [ngValue]="c.id">{{ c.name }}</option> }
                      </select>
                    </div>
                    <div class="col-5 col-md-3">
                      <input type="date" class="form-control" [name]="'date' + i" [(ngModel)]="l.date" aria-label="Date" required>
                    </div>
                    <div class="col-7 col-md-3">
                      <select class="form-select" [name]="'acc' + i" [(ngModel)]="l.accountId" aria-label="Compte" required>
                        @for (a of activeAccounts(); track a.id) { <option [ngValue]="a.id">{{ a.name }}</option> }
                      </select>
                    </div>
                    <div class="col-12">
                      <input class="form-control" [name]="'desc' + i" maxlength="255" [(ngModel)]="l.description" placeholder="Description (facultatif)" aria-label="Description">
                    </div>
                    @if (importNotes.get(l); as note) {
                      <div class="col-12 small text-warning"><i class="bi bi-info-circle me-1"></i>Import : {{ note }}</div>
                    }
                  </div>
                </div>
              }
              @if (batchPages(items) > 1) {
                <nav class="pager mb-3" aria-label="Pages de la saisie">
                  <span class="small text-body-secondary">Lignes {{ batchPage() * BATCH_SIZE + 1 }}–{{ batchPage() * BATCH_SIZE + pageLines(items).length }} sur {{ items.length }}</span>
                  <div class="btn-group btn-group-sm">
                    <button type="button" class="btn btn-outline-secondary" [disabled]="batchPage() === 0" (click)="batchPage.set(batchPage() - 1)" aria-label="Page précédente"><i class="bi bi-chevron-left"></i></button>
                    @for (n of pageNumbers(batchPage(), batchPages(items)); track n) {
                      <button type="button" class="btn" [class.btn-accent]="n === batchPage()" [class.btn-outline-secondary]="n !== batchPage()" (click)="batchPage.set(n)">{{ n + 1 }}</button>
                    }
                    <button type="button" class="btn btn-outline-secondary" [disabled]="batchPage() + 1 >= batchPages(items)" (click)="batchPage.set(batchPage() + 1)" aria-label="Page suivante"><i class="bi bi-chevron-right"></i></button>
                  </div>
                </nav>
              }
              <div class="d-flex gap-2">
                <button type="button" class="btn btn-outline-danger flex-fill" (click)="addLine('EXPENSE')"><i class="bi bi-plus-lg me-1"></i>Dépense</button>
                <button type="button" class="btn btn-outline-success flex-fill" (click)="addLine('INCOME')"><i class="bi bi-plus-lg me-1"></i>Revenu</button>
              </div>
            </div>
            <div class="modal-footer flex-column align-items-stretch gap-2">
              <div class="d-flex justify-content-between small fw-semibold">
                <span>{{ items.length }} opération{{ items.length > 1 ? 's' : '' }}</span>
                <span>
                  <span class="text-danger">− {{ batchTotal('EXPENSE') | money }}</span>
                  <span class="mx-1 text-body-secondary">·</span>
                  <span class="text-success">+ {{ batchTotal('INCOME') | money }}</span>
                </span>
              </div>
              <div class="d-flex gap-2">
                <button type="button" class="btn btn-outline-secondary flex-fill" (click)="closeBatch()">Annuler</button>
                <button class="btn btn-accent flex-fill" [disabled]="!batchReady() || saving()">
                  @if (saving()) { <span class="spinner-border spinner-border-sm me-1"></span> }
                  Enregistrer {{ items.length > 1 ? 'les ' + items.length : '' }}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
      <div class="modal-backdrop show"></div>
    }`,
})
export class TransactionsPage {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly period = signal(currentPeriod());
  readonly periodText = computed(() => periodLabel(this.period()));
  readonly accounts = signal<Account[]>([]);
  readonly activeAccounts = computed(() => this.accounts().filter(a => !a.archived));
  readonly categories = signal<Category[]>([]);
  readonly page = signal<Page<Transaction> | null>(null);
  readonly error = signal('');
  readonly summary = signal<TransactionSummary | null>(null);
  readonly message = signal('');

  filter: TransactionFilter = { type: '', accountId: null, categoryId: null, q: '' };

  readonly form = signal<TransactionRequest | null>(null);
  readonly formError = signal('');
  readonly saving = signal(false);
  /** Lignes de la saisie multiple (null = fenêtre fermée). */
  readonly lines = signal<TransactionRequest[] | null>(null);
  /** Remarques d'import par ligne (compte introuvable, date invalide…). */
  importNotes = new WeakMap<TransactionRequest, string>();
  readonly PAGE_SIZE = 5;
  readonly BATCH_SIZE = 5;
  readonly batchPage = signal(0);
  /** Copie manuscrite d'où viennent les lignes de la saisie en cours. */
  readonly source = signal<{ documentId: number; documentName: string; aiNotes: string } | null>(null);
  private readonly pendingImport = inject(PendingImportStore);
  editId?: number;

  constructor() {
    this.api.accounts().subscribe(a => {
      this.accounts.set(a);
      // Formulaire ouvert avant le chargement des comptes : on choisit le premier compte actif.
      const first = this.activeAccounts()[0]?.id ?? 0;
      const f = this.form();
      if (f && !f.accountId) f.accountId = first;
      this.lines()?.forEach(l => { if (!l.accountId) l.accountId = first; });
    });
    // Bouton « + » de l'app mobile (ou raccourci de l'icône) : /operations?nouveau=…
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe(params => {
      if (params.has('copie')) {
        const pending = this.pendingImport.take();
        if (pending) {
          this.openBatch(pending.lines);
          pending.notes.forEach((note, line) => this.importNotes.set(line, note));
          this.source.set({ documentId: pending.documentId, documentName: pending.documentName, aiNotes: pending.aiNotes });
          this.goToFirstIncomplete();
        }
        this.router.navigate([], { relativeTo: this.route, queryParams: {}, replaceUrl: true });
        return;
      }
      if (!params.has('nouveau')) return;
      this.openBatch();
      this.router.navigate([], { relativeTo: this.route, queryParams: {}, replaceUrl: true });
    });
    this.api.categories().subscribe(c => this.categories.set(c));
    this.search(0);
  }

  move(months: number): void {
    this.period.set(shiftPeriod(this.period(), months));
    this.search(0);
  }

  search(page: number): void {
    this.error.set('');
    this.api.transactions(this.currentFilter(), page, this.PAGE_SIZE).subscribe({
      next: p => {
        // Page devenue vide (ex. après suppression de la dernière ligne) : on revient à la précédente.
        if (!p.content.length && p.page > 0) { this.search(p.page - 1); return; }
        this.page.set(p);
      },
      error: err => this.error.set(errorMessage(err)),
    });
    this.api.transactionSummary(this.currentFilter()).subscribe({ next: s => this.summary.set(s), error: () => {} });
  }

  exportCsv(): void {
    this.api.exportTransactions(this.currentFilter()).subscribe({
      next: blob => downloadBlob(blob, `operations-${this.period()}.csv`),
      error: err => this.error.set(errorMessage(err)),
    });
  }

  categoriesOf(type: CategoryType): Category[] {
    return this.categories().filter(c => c.type === type);
  }

  /** Modification d'une opération existante. */
  openForm(t: Transaction): void {
    this.editId = t.id;
    this.formError.set('');
    // Le formulaire est mis à jour en place par ngModel : on le recrée pour chaque ouverture.
    this.form.set({ type: t.type, amount: t.amount, date: t.date, accountId: t.account.id, categoryId: t.category.id,
      description: t.description ?? '' });
  }

  openBatch(lines?: TransactionRequest[]): void {
    this.formError.set('');
    this.batchPage.set(0);
    this.lines.set(lines?.length ? lines : [this.newLine('EXPENSE')]);
  }

  downloadTemplate(format: 'xlsx' | 'csv'): void {
    const accounts = this.activeAccounts();
    const blob = format === 'xlsx' ? xlsxTemplate(this.categories(), accounts) : csvTemplate(this.categories(), accounts);
    downloadBlob(blob, `modele-operations.${format}`);
  }

  /** Import d'un fichier Excel/CSV : les lignes sont ouvertes dans la saisie multiple pour vérification. */
  async importFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.error.set('');
    try {
      const rows = await readSpreadsheet(file);
      const result = toTransactions(rows, this.categories(), this.accounts());
      if (!result.lines.length) {
        this.error.set('Aucune opération trouvée dans ce fichier. Utilisez le modèle (Fichier → Télécharger le modèle).');
        return;
      }
      // Si une saisie est déjà ouverte, les lignes importées s'ajoutent (en retirant une ligne vide de départ).
      const current = (this.lines() ?? []).filter(l => l.amount || l.categoryId || l.description);
      result.lines.forEach(r => r.warning && this.importNotes.set(r.line, r.warning));
      this.openBatch([...current, ...result.lines.map(r => r.line)]);
      const toFix = result.lines.filter(r => !this.isComplete(r.line)).length;
      this.formError.set('');
      this.message.set(`${result.lines.length} opération(s) importée(s) depuis « ${file.name} »`
        + (result.skipped ? `, ${result.skipped} ligne(s) d'exemple ignorée(s)` : '')
        + (toFix ? ` · ${toFix} à compléter` : '') + '. Vérifiez puis enregistrez.');
      if (toFix) this.goToFirstIncomplete();
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Fichier illisible.');
    }
  }

  isComplete(l: TransactionRequest): boolean {
    return Number(l.amount) > 0 && !!l.categoryId && !!l.accountId && !!l.date;
  }

  incompleteCount(): number {
    return (this.lines() ?? []).filter(l => !this.isComplete(l)).length;
  }

  goToFirstIncomplete(): void {
    const i = (this.lines() ?? []).findIndex(l => !this.isComplete(l));
    if (i >= 0) this.batchPage.set(Math.floor(i / this.BATCH_SIZE));
  }

  pageLines(items: TransactionRequest[]): TransactionRequest[] {
    return items.slice(this.batchPage() * this.BATCH_SIZE, (this.batchPage() + 1) * this.BATCH_SIZE);
  }

  batchPages(items: TransactionRequest[]): number {
    return Math.max(1, Math.ceil(items.length / this.BATCH_SIZE));
  }

  /** Numéros de pages affichés autour de la page courante (5 au maximum). */
  pageNumbers(current: number, total: number): number[] {
    const from = Math.max(0, Math.min(current - 2, total - 5));
    return Array.from({ length: Math.min(5, total) }, (_, k) => from + k);
  }

  closeBatch(): void {
    this.lines.set(null);
    this.source.set(null);
  }

  openSource(): void {
    const src = this.source();
    if (!src) return;
    // Ouverture immédiate de l'onglet (sinon bloquée par le navigateur), puis chargement du fichier.
    const tab = window.open('', '_blank');
    this.api.documentFile(src.documentId).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        if (tab) tab.location.href = url; else window.location.assign(url);
      },
      error: err => { tab?.close(); this.formError.set(errorMessage(err)); },
    });
  }

  /** Nouvelle ligne : reprend la date et le compte de la dernière ligne saisie. */
  addLine(type: CategoryType): void {
    const items = this.lines() ?? [];
    const next = [...items, this.newLine(type, items.at(-1))];
    this.lines.set(next);
    this.batchPage.set(this.batchPages(next) - 1);
    this.focusLastAmount();
  }

  duplicateLine(i: number): void {
    const items = this.lines() ?? [];
    this.lines.set([...items.slice(0, i + 1), { ...items[i] }, ...items.slice(i + 1)]);
  }

  removeLine(i: number): void {
    const items = this.lines() ?? [];
    if (items.length <= 1) return;
    const next = items.filter((_, k) => k !== i);
    this.lines.set(next);
    this.batchPage.set(Math.min(this.batchPage(), this.batchPages(next) - 1));
  }

  batchTotal(type: CategoryType): number {
    return (this.lines() ?? []).filter(l => l.type === type).reduce((s, l) => s + (Number(l.amount) || 0), 0);
  }

  batchReady(): boolean {
    const items = this.lines() ?? [];
    return items.length > 0 && items.every(l => this.isComplete(l));
  }

  saveBatch(): void {
    const items = this.lines();
    if (!items?.length || !this.batchReady()) return;
    this.saving.set(true);
    this.formError.set('');
    this.api.saveTransactions(items.map(l => ({ ...l, amount: Number(l.amount) }))).subscribe({
      next: saved => {
        const src = this.source();
        this.saving.set(false); this.closeBatch(); this.search(0);
        this.message.set(`${saved.length} opération${saved.length > 1 ? 's enregistrées' : ' enregistrée'}`
          + (src ? ` depuis la copie « ${src.documentName} ».` : '.'));
        if (src) this.api.markDocumentImported(src.documentId, saved.length).subscribe({ error: () => {} });
      },
      error: err => { this.saving.set(false); this.formError.set(errorMessage(err)); },
    });
  }

  private newLine(type: CategoryType, previous?: TransactionRequest): TransactionRequest {
    return {
      type, amount: null as unknown as number, categoryId: 0, description: '',
      date: previous?.date ?? today(), accountId: previous?.accountId ?? this.activeAccounts()[0]?.id ?? 0,
    };
  }

  private focusLastAmount(): void {
    setTimeout(() => {
      const inputs = document.querySelectorAll<HTMLInputElement>('.batch-amount');
      const last = inputs[inputs.length - 1];
      last?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      last?.focus();
    });
  }

  closeForm(): void {
    this.form.set(null);
  }

  save(): void {
    const req = this.form();
    if (!req) return;
    this.saving.set(true);
    this.api.saveTransaction(req, this.editId).subscribe({
      next: () => { this.saving.set(false); this.closeForm(); this.search(this.page()?.page ?? 0); },
      error: err => { this.saving.set(false); this.formError.set(errorMessage(err)); },
    });
  }

  remove(t: Transaction): void {
    if (!confirm(`Supprimer l'opération « ${t.description || t.category.name} » ?`)) return;
    this.api.deleteTransaction(t.id).subscribe({
      next: () => this.search(this.page()?.page ?? 0),
      error: err => this.error.set(errorMessage(err)),
    });
  }

  removeEditing(): void {
    const t = this.page()?.content.find(x => x.id === this.editId);
    if (t) { this.closeForm(); this.remove(t); }
  }

  private currentFilter(): TransactionFilter {
    return { ...this.filter, ...periodBounds(this.period()) };
  }
}
