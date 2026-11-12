import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ApiService, errorMessage } from '../../core/api.service';
import { Category, CategoryRequest } from '../../core/models';

const ICONS = ['tag', 'basket', 'bus-front', 'house', 'lightning-charge', 'phone', 'heart-pulse', 'mortarboard',
  'people', 'gift', 'controller', 'bag', 'briefcase', 'shop', 'laptop', 'arrow-down-circle', 'cash-coin',
  'car-front', 'airplane', 'cup-hot', 'droplet', 'fuel-pump', 'stars', 'three-dots', 'plus-circle'];

@Component({
  selector: 'app-categories',
  imports: [FormsModule],
  template: `
    <div class="page-header">
      <div>
        <div class="eyebrow">Espace Particulier</div>
        <h1 class="page-title">Catégories</h1>
      </div>
      <button class="btn btn-accent" (click)="openForm()"><i class="bi bi-plus-lg me-1"></i>Nouvelle catégorie</button>
    </div>
    @if (error()) { <div class="alert alert-danger">{{ error() }}</div> }
    <div class="row g-3">
      @for (group of groups(); track group.title) {
        <div class="col-lg-6"><div class="card h-100"><div class="card-body">
          <h2 class="h6 card-title">{{ group.title }} <span class="badge text-bg-secondary">{{ group.items.length }}</span></h2>
          <ul class="list-group list-group-flush">
            @for (c of group.items; track c.id) {
              <li class="list-group-item d-flex align-items-center gap-3 px-0">
                <span class="cat-icon" [style.background]="c.color"><i class="bi bi-{{ c.icon }}"></i></span>
                <span class="flex-grow-1">{{ c.name }}</span>
                <button class="btn btn-sm btn-link" (click)="openForm(c)" aria-label="Modifier"><i class="bi bi-pencil"></i></button>
                <button class="btn btn-sm btn-link text-danger" (click)="remove(c)" aria-label="Supprimer"><i class="bi bi-trash"></i></button>
              </li>
            }
          </ul>
        </div></div></div>
      }
    </div>

    @if (form()) {
      <div class="modal d-block" tabindex="-1" (click)="form.set(null)">
        <div class="modal-dialog modal-dialog-centered" (click)="$event.stopPropagation()">
          <form class="modal-content" (ngSubmit)="save()" #f="ngForm">
            <div class="modal-header">
              <h2 class="modal-title h5">{{ editId ? 'Modifier la' : 'Nouvelle' }} catégorie</h2>
              <button type="button" class="btn-close" (click)="form.set(null)" aria-label="Fermer"></button>
            </div>
            <div class="modal-body row g-3">
              @if (formError()) { <div class="col-12"><div class="alert alert-danger py-2 mb-0">{{ formError() }}</div></div> }
              <div class="col-8"><label class="form-label" for="name">Nom</label>
                <input id="name" class="form-control" name="name" [(ngModel)]="form()!.name" required maxlength="60"></div>
              <div class="col-4"><label class="form-label" for="type">Type</label>
                <select id="type" class="form-select" name="type" [(ngModel)]="form()!.type">
                  <option value="EXPENSE">Dépense</option><option value="INCOME">Revenu</option>
                </select></div>
              <div class="col-12"><label class="form-label" for="color">Couleur</label>
                <input id="color" type="color" class="form-control form-control-color" name="color" [(ngModel)]="form()!.color"></div>
              <div class="col-12"><div class="form-label">Icône</div>
                <div class="d-flex flex-wrap gap-2">
                  @for (i of icons; track i) {
                    <button type="button" class="btn btn-sm icon-choice" [class.active]="form()!.icon === i"
                            (click)="form()!.icon = i" [attr.aria-label]="i"><i class="bi bi-{{ i }}"></i></button>
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
export class CategoriesPage {
  private readonly api = inject(ApiService);
  readonly icons = ICONS;
  readonly categories = signal<Category[]>([]);
  readonly groups = computed(() => [
    { title: 'Dépenses', items: this.categories().filter(c => c.type === 'EXPENSE') },
    { title: 'Revenus', items: this.categories().filter(c => c.type === 'INCOME') },
  ]);
  readonly error = signal('');
  readonly form = signal<CategoryRequest | null>(null);
  readonly formError = signal('');
  editId?: number;

  constructor() {
    this.load();
  }

  openForm(c?: Category): void {
    this.editId = c?.id;
    this.formError.set('');
    this.form.set(c ? { name: c.name, type: c.type, icon: c.icon, color: c.color }
      : { name: '', type: 'EXPENSE', icon: 'tag', color: '#e8833a' });
  }

  save(): void {
    this.api.saveCategory(this.form()!, this.editId).subscribe({
      next: () => { this.form.set(null); this.load(); },
      error: err => this.formError.set(errorMessage(err)),
    });
  }

  remove(c: Category): void {
    if (!confirm(`Supprimer la catégorie « ${c.name} » ?`)) return;
    this.api.deleteCategory(c.id).subscribe({ next: () => this.load(), error: err => this.error.set(errorMessage(err)) });
  }

  private load(): void {
    this.api.categories().subscribe({ next: c => this.categories.set(c), error: err => this.error.set(errorMessage(err)) });
  }
}
