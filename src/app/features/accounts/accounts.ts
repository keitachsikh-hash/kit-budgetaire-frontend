import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ApiService, errorMessage } from '../../core/api.service';
import { ACCOUNT_TYPES, Account, AccountRequest, accountTypeLabel } from '../../core/models';
import { MoneyPipe } from '../../shared/money.pipe';

@Component({
  selector: 'app-accounts',
  imports: [FormsModule, MoneyPipe],
  template: `
    <div class="page-header">
      <div>
        <div class="eyebrow">Espace Particulier</div>
        <h1 class="page-title">Comptes & Mobile Money</h1>
      </div>
      <button class="btn btn-accent" (click)="openForm()"><i class="bi bi-plus-lg me-1"></i>Nouveau compte</button>
    </div>
    @if (error()) { <div class="alert alert-danger">{{ error() }}</div> }
    <div class="card stat-card highlight mb-3"><div class="card-body">
      <div class="stat-label">Solde total des comptes actifs</div>
      <div class="stat-value">{{ total() | money }}</div>
    </div></div>
    <div class="row g-3">
      @for (a of accounts(); track a.id) {
        <div class="col-sm-6 col-xl-4">
          <div class="card account-card h-100" [class.opacity-50]="a.archived" [style.border-left-color]="a.color">
            <div class="card-body">
              <div class="d-flex justify-content-between align-items-start">
                <div>
                  <div class="fw-semibold">{{ a.name }}</div>
                  <span class="badge text-bg-secondary">{{ typeLabel(a.type) }}</span>
                  @if (a.archived) { <span class="badge text-bg-warning ms-1">Archivé</span> }
                </div>
                <div class="d-print-none">
                  <button class="btn btn-sm btn-link" (click)="openForm(a)" aria-label="Modifier"><i class="bi bi-pencil"></i></button>
                  <button class="btn btn-sm btn-link text-danger" (click)="remove(a)" aria-label="Supprimer"><i class="bi bi-trash"></i></button>
                </div>
              </div>
              <div class="fs-4 fw-bold mt-3">{{ a.balance | money }}</div>
              <div class="small text-body-secondary">Solde initial : {{ a.initialBalance | money }}</div>
            </div>
          </div>
        </div>
      }
    </div>

    @if (form()) {
      <div class="modal d-block" tabindex="-1" (click)="form.set(null)">
        <div class="modal-dialog modal-dialog-centered" (click)="$event.stopPropagation()">
          <form class="modal-content" (ngSubmit)="save()" #f="ngForm">
            <div class="modal-header">
              <h2 class="modal-title h5">{{ editId ? 'Modifier le' : 'Nouveau' }} compte</h2>
              <button type="button" class="btn-close" (click)="form.set(null)" aria-label="Fermer"></button>
            </div>
            <div class="modal-body row g-3">
              @if (formError()) { <div class="col-12"><div class="alert alert-danger py-2 mb-0">{{ formError() }}</div></div> }
              <div class="col-12"><label class="form-label" for="type">Type</label>
                <select id="type" class="form-select" name="type" [(ngModel)]="form()!.type" (ngModelChange)="onType($event)">
                  @for (t of types; track t.value) { <option [value]="t.value">{{ t.label }}</option> }
                </select></div>
              <div class="col-12"><label class="form-label" for="name">Nom</label>
                <input id="name" class="form-control" name="name" [(ngModel)]="form()!.name" required maxlength="80"></div>
              <div class="col-8"><label class="form-label" for="init">Solde initial (FCFA)</label>
                <input id="init" type="number" class="form-control" name="initialBalance" [(ngModel)]="form()!.initialBalance"></div>
              <div class="col-4"><label class="form-label" for="color">Couleur</label>
                <input id="color" type="color" class="form-control form-control-color w-100" name="color" [(ngModel)]="form()!.color"></div>
              @if (editId) {
                <div class="col-12 form-check ms-2">
                  <input id="arch" class="form-check-input" type="checkbox" name="archived" [(ngModel)]="form()!.archived">
                  <label class="form-check-label" for="arch">Archivé (masqué des soldes et des formulaires)</label>
                </div>
              }
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-outline-secondary" (click)="form.set(null)">Annuler</button>
              <button class="btn btn-accent" [disabled]="f.invalid">Enregistrer</button>
            </div>
          </form>
        </div>
      </div>
      <div class="modal-backdrop show"></div>
    }`,
})
export class AccountsPage {
  private readonly api = inject(ApiService);
  readonly types = ACCOUNT_TYPES;
  readonly accounts = signal<Account[]>([]);
  readonly total = computed(() => this.accounts().filter(a => !a.archived).reduce((s, a) => s + a.balance, 0));
  readonly error = signal('');
  readonly form = signal<AccountRequest | null>(null);
  readonly formError = signal('');
  editId?: number;

  constructor() {
    this.load();
  }

  typeLabel(type: string): string {
    return accountTypeLabel(type);
  }

  onType(type: string): void {
    const t = ACCOUNT_TYPES.find(x => x.value === type);
    const f = this.form()!;
    if (t && !this.editId) {
      f.color = t.color;
      if (!f.name || ACCOUNT_TYPES.some(x => x.label === f.name)) f.name = t.label;
    }
  }

  openForm(a?: Account): void {
    this.editId = a?.id;
    this.formError.set('');
    this.form.set(a
      ? { name: a.name, type: a.type, initialBalance: a.initialBalance, color: a.color, archived: a.archived }
      : { name: 'Wave', type: 'WAVE', initialBalance: 0, color: '#1dc8ff', archived: false });
  }

  save(): void {
    this.api.saveAccount(this.form()!, this.editId).subscribe({
      next: () => { this.form.set(null); this.load(); },
      error: err => this.formError.set(errorMessage(err)),
    });
  }

  remove(a: Account): void {
    if (!confirm(`Supprimer le compte « ${a.name} » ?`)) return;
    this.api.deleteAccount(a.id).subscribe({ next: () => this.load(), error: err => this.error.set(errorMessage(err)) });
  }

  private load(): void {
    this.api.accounts().subscribe({ next: a => this.accounts.set(a), error: err => this.error.set(errorMessage(err)) });
  }
}
