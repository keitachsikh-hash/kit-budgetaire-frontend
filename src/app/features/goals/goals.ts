import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ApiService, errorMessage } from '../../core/api.service';
import { Goal, GoalRequest } from '../../core/models';
import { MoneyPipe } from '../../shared/money.pipe';

const ICONS = ['piggy-bank', 'shield-check', 'house', 'car-front', 'airplane', 'mortarboard', 'laptop', 'stars',
  'heart', 'gift', 'shop', 'phone'];

@Component({
  selector: 'app-goals',
  imports: [FormsModule, MoneyPipe],
  template: `
    <div class="page-header">
      <div>
        <div class="eyebrow">Espace Particulier</div>
        <h1 class="page-title">Objectifs d'épargne</h1>
      </div>
      <button class="btn btn-accent d-print-none" (click)="openForm()"><i class="bi bi-plus-lg me-1"></i>Nouvel objectif</button>
    </div>
    @if (error()) { <div class="alert alert-danger">{{ error() }}</div> }
    <div class="row g-3">
      @for (g of goals(); track g.id) {
        <div class="col-md-6 col-xl-4"><div class="card h-100" [class.border-success]="g.completed"><div class="card-body d-flex flex-column">
          <div class="d-flex align-items-center gap-2 mb-3">
            <span class="cat-icon" [style.background]="g.color"><i class="bi bi-{{ g.icon }}"></i></span>
            <strong class="flex-grow-1">{{ g.name }}</strong>
            @if (g.completed) { <span class="badge text-bg-success">Atteint</span> }
            <button class="btn btn-sm btn-link d-print-none" (click)="openForm(g)" aria-label="Modifier"><i class="bi bi-pencil"></i></button>
            <button class="btn btn-sm btn-link text-danger d-print-none" (click)="remove(g)" aria-label="Supprimer"><i class="bi bi-trash"></i></button>
          </div>
          <div class="fs-5 fw-bold">{{ g.savedAmount | money }} <span class="fs-6 fw-normal text-body-secondary">/ {{ g.targetAmount | money }}</span></div>
          <div class="progress my-2" style="height: 10px"><div class="progress-bar" [style.width.%]="g.percent" [style.background]="g.color"></div></div>
          <div class="small text-body-secondary mb-3">
            {{ g.percent }} % · reste {{ g.remaining | money }}
            @if (g.deadline) { <br>Échéance {{ g.deadline }}@if (g.monthlyNeeded) { · {{ g.monthlyNeeded | money }} / mois } }
          </div>
          <div class="input-group input-group-sm mt-auto d-print-none">
            <input type="number" class="form-control" placeholder="Montant" [(ngModel)]="amounts[g.id]" [attr.aria-label]="'Montant pour ' + g.name">
            <button class="btn btn-outline-success" (click)="contribute(g, 1)" title="Verser"><i class="bi bi-plus-lg"></i></button>
            <button class="btn btn-outline-danger" (click)="contribute(g, -1)" title="Retirer"><i class="bi bi-dash-lg"></i></button>
          </div>
        </div></div></div>
      } @empty {
        <div class="col-12 text-center text-body-secondary py-5">Aucun objectif : fonds d'urgence, Tabaski, rentrée scolaire, voyage…</div>
      }
    </div>

    @if (form(); as fm) {
      <div class="modal d-block" tabindex="-1" (click)="form.set(null)">
        <div class="modal-dialog modal-dialog-centered" (click)="$event.stopPropagation()">
          <form class="modal-content" (ngSubmit)="save()" #f="ngForm">
            <div class="modal-header">
              <h2 class="modal-title h5">{{ editId ? 'Modifier l\\'' : 'Nouvel ' }}objectif</h2>
              <button type="button" class="btn-close" (click)="form.set(null)" aria-label="Fermer"></button>
            </div>
            <div class="modal-body row g-3">
              @if (formError()) { <div class="col-12"><div class="alert alert-danger py-2 mb-0">{{ formError() }}</div></div> }
              <div class="col-12"><label class="form-label" for="name">Nom</label>
                <input id="name" class="form-control" name="name" [(ngModel)]="fm.name" required maxlength="80"></div>
              <div class="col-6"><label class="form-label" for="target">Objectif (FCFA)</label>
                <input id="target" type="number" min="1" inputmode="decimal" class="form-control" name="targetAmount" [(ngModel)]="fm.targetAmount" required></div>
              <div class="col-6"><label class="form-label" for="deadline">Échéance</label>
                <input id="deadline" type="date" class="form-control" name="deadline" [(ngModel)]="fm.deadline"></div>
              @if (!editId) {
                <div class="col-6"><label class="form-label" for="saved">Déjà épargné</label>
                  <input id="saved" type="number" min="0" inputmode="decimal" class="form-control" name="savedAmount" [(ngModel)]="fm.savedAmount"></div>
              }
              <div class="col-6"><label class="form-label" for="color">Couleur</label>
                <input id="color" type="color" class="form-control form-control-color w-100" name="color" [(ngModel)]="fm.color"></div>
              <div class="col-12"><div class="form-label">Icône</div>
                <div class="d-flex flex-wrap gap-2">
                  @for (i of icons; track i) {
                    <button type="button" class="btn btn-sm icon-choice" [class.active]="fm.icon === i" (click)="fm.icon = i" [attr.aria-label]="i"><i class="bi bi-{{ i }}"></i></button>
                  }
                </div></div>
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
export class GoalsPage {
  private readonly api = inject(ApiService);
  readonly icons = ICONS;
  readonly goals = signal<Goal[]>([]);
  readonly error = signal('');
  readonly form = signal<GoalRequest | null>(null);
  readonly formError = signal('');
  amounts: Record<number, number | null> = {};
  editId?: number;

  constructor() {
    this.load();
  }

  openForm(g?: Goal): void {
    this.editId = g?.id;
    this.formError.set('');
    this.form.set(g
      ? { name: g.name, targetAmount: g.targetAmount, deadline: g.deadline, icon: g.icon, color: g.color }
      : { name: '', targetAmount: 0, savedAmount: 0, deadline: null, icon: 'piggy-bank', color: '#2fa37a' });
  }

  save(): void {
    const fm = this.form()!;
    this.api.saveGoal({ ...fm, deadline: fm.deadline || null }, this.editId).subscribe({
      next: () => { this.form.set(null); this.load(); },
      error: err => this.formError.set(errorMessage(err)),
    });
  }

  contribute(g: Goal, sign: 1 | -1): void {
    const amount = Number(this.amounts[g.id]);
    if (!amount) return;
    this.api.contribute(g.id, sign * Math.abs(amount)).subscribe({
      next: () => { this.amounts[g.id] = null; this.load(); },
      error: err => this.error.set(errorMessage(err)),
    });
  }

  remove(g: Goal): void {
    if (!confirm(`Supprimer l'objectif « ${g.name} » ?`)) return;
    this.api.deleteGoal(g.id).subscribe({ next: () => this.load(), error: err => this.error.set(errorMessage(err)) });
  }

  private load(): void {
    this.error.set('');
    this.api.goals().subscribe({ next: g => this.goals.set(g), error: err => this.error.set(errorMessage(err)) });
  }
}
