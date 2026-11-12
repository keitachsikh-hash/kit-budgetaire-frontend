import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ApiService, errorMessage } from '../../core/api.service';
import { BudgetLine, BudgetOverview, Category, currentPeriod, periodLabel, shiftPeriod } from '../../core/models';
import { MoneyPipe } from '../../shared/money.pipe';

@Component({
  selector: 'app-budgets',
  imports: [FormsModule, MoneyPipe],
  template: `
    <div class="page-header">
      <div>
        <div class="eyebrow">Espace Particulier</div>
        <h1 class="page-title">Budgets du mois</h1>
      </div>
      <div class="d-flex gap-2 flex-wrap">
        <div class="btn-group">
          <button class="btn btn-outline-secondary" (click)="move(-1)" aria-label="Mois précédent"><i class="bi bi-chevron-left"></i></button>
          <span class="btn btn-outline-secondary disabled period-label">{{ label() }}</span>
          <button class="btn btn-outline-secondary" (click)="move(1)" aria-label="Mois suivant"><i class="bi bi-chevron-right"></i></button>
        </div>
        <button class="btn btn-outline-secondary d-print-none" (click)="copyPrevious()"><i class="bi bi-copy me-1"></i>Reprendre le mois précédent</button>
        <button class="btn btn-accent d-print-none" (click)="openForm()"><i class="bi bi-plus-lg me-1"></i>Nouveau budget</button>
      </div>
    </div>
    @if (message()) { <div class="alert alert-info py-2">{{ message() }}</div> }
    @if (error()) { <div class="alert alert-danger">{{ error() }}</div> }

    @if (overview(); as o) {
      <div class="card stat-card highlight mb-3"><div class="card-body">
        <div class="d-flex justify-content-between flex-wrap gap-2">
          <div><div class="stat-label">Dépensé / prévu</div>
            <div class="stat-value">{{ o.totalSpent | money }} <span class="fs-6 fw-normal">/ {{ o.totalLimit | money }}</span></div></div>
          <div class="text-end"><div class="stat-label">Reste</div><div class="stat-value">{{ o.remaining | money }}</div></div>
        </div>
        <div class="progress mt-2" style="height: 10px"><div class="progress-bar" [class]="barClass(o.percent)" [style.width.%]="min100(o.percent)"></div></div>
      </div></div>
      <div class="row g-3">
        @for (b of o.lines; track b.id) {
          <div class="col-md-6 col-xl-4"><div class="card h-100"><div class="card-body">
            <div class="d-flex align-items-center gap-2 mb-2">
              <span class="cat-icon" [style.background]="b.color"><i class="bi bi-{{ b.icon }}"></i></span>
              <strong class="flex-grow-1">{{ b.categoryName }}</strong>
              <button class="btn btn-sm btn-link d-print-none" (click)="openForm(b)" aria-label="Modifier"><i class="bi bi-pencil"></i></button>
              <button class="btn btn-sm btn-link text-danger d-print-none" (click)="remove(b)" aria-label="Supprimer"><i class="bi bi-trash"></i></button>
            </div>
            <div class="d-flex justify-content-between small mb-1">
              <span>{{ b.spent | money }} / {{ b.limitAmount | money }}</span>
              <span class="fw-semibold" [class.text-danger]="b.status === 'EXCEEDED'" [class.text-warning]="b.status === 'WARNING'">{{ b.percent }} %</span>
            </div>
            <div class="progress"><div class="progress-bar" [class]="barClass(b.percent)" [style.width.%]="min100(b.percent)"></div></div>
            <div class="small mt-2" [class.text-danger]="b.remaining < 0">
              {{ b.remaining < 0 ? 'Dépassement : ' : 'Reste : ' }}{{ abs(b.remaining) | money }}
            </div>
          </div></div></div>
        } @empty {
          <div class="col-12 text-center text-body-secondary py-5">
            Aucun budget pour {{ label() }}. Fixez un plafond par catégorie de dépense pour être alerté avant de le dépasser.
          </div>
        }
      </div>
    }

    @if (form(); as fm) {
      <div class="modal d-block" tabindex="-1" (click)="form.set(null)">
        <div class="modal-dialog modal-dialog-centered" (click)="$event.stopPropagation()">
          <form class="modal-content" (ngSubmit)="save()" #f="ngForm">
            <div class="modal-header">
              <h2 class="modal-title h5">Budget — {{ label() }}</h2>
              <button type="button" class="btn-close" (click)="form.set(null)" aria-label="Fermer"></button>
            </div>
            <div class="modal-body row g-3">
              @if (formError()) { <div class="col-12"><div class="alert alert-danger py-2 mb-0">{{ formError() }}</div></div> }
              <div class="col-12"><label class="form-label" for="cat">Catégorie de dépense</label>
                <select id="cat" class="form-select" name="categoryId" [(ngModel)]="fm.categoryId" [disabled]="!!editId" required>
                  <option [ngValue]="0" disabled>Choisir…</option>
                  @for (c of expenseCategories(); track c.id) { <option [ngValue]="c.id">{{ c.name }}</option> }
                </select></div>
              <div class="col-12"><label class="form-label" for="limit">Plafond mensuel (FCFA)</label>
                <input id="limit" type="number" min="0" inputmode="decimal" class="form-control" name="limitAmount" [(ngModel)]="fm.limitAmount" required></div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-outline-secondary" (click)="form.set(null)">Annuler</button>
              <button class="btn btn-accent" [disabled]="f.invalid || !fm.categoryId">Enregistrer</button>
            </div>
          </form>
        </div>
      </div>
      <div class="modal-backdrop show"></div>
    }`,
})
export class BudgetsPage {
  private readonly api = inject(ApiService);
  readonly period = signal(currentPeriod());
  readonly label = computed(() => periodLabel(this.period()));
  readonly overview = signal<BudgetOverview | null>(null);
  readonly categories = signal<Category[]>([]);
  readonly expenseCategories = computed(() => this.categories().filter(c => c.type === 'EXPENSE'));
  readonly error = signal('');
  readonly message = signal('');
  readonly form = signal<{ categoryId: number; limitAmount: number } | null>(null);
  readonly formError = signal('');
  editId?: number;

  constructor() {
    this.api.categories('EXPENSE').subscribe(c => this.categories.set(c));
    this.load();
  }

  move(months: number): void {
    this.period.set(shiftPeriod(this.period(), months));
    this.message.set('');
    this.load();
  }

  barClass(percent: number): string {
    return percent > 100 ? 'bg-danger' : percent >= 80 ? 'bg-warning' : 'bg-success';
  }

  min100(percent: number): number {
    return Math.min(100, percent);
  }

  abs(n: number): number {
    return Math.abs(n);
  }

  openForm(b?: BudgetLine): void {
    this.editId = b?.id;
    this.formError.set('');
    this.form.set({ categoryId: b?.categoryId ?? 0, limitAmount: b?.limitAmount ?? 0 });
  }

  save(): void {
    const fm = this.form()!;
    this.api.saveBudget({ ...fm, period: this.period() }, this.editId).subscribe({
      next: () => { this.form.set(null); this.load(); },
      error: err => this.formError.set(errorMessage(err)),
    });
  }

  copyPrevious(): void {
    this.api.copyPreviousBudgets(this.period()).subscribe({
      next: r => { this.message.set(`${r.copied} budget(s) repris du mois précédent.`); this.load(); },
      error: err => this.error.set(errorMessage(err)),
    });
  }

  remove(b: BudgetLine): void {
    if (!confirm(`Supprimer le budget « ${b.categoryName} » ?`)) return;
    this.api.deleteBudget(b.id).subscribe({ next: () => this.load(), error: err => this.error.set(errorMessage(err)) });
  }

  private load(): void {
    this.error.set('');
    this.api.budgets(this.period()).subscribe({
      next: o => this.overview.set(o),
      error: err => this.error.set(errorMessage(err)),
    });
  }
}
