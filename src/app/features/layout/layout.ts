import { Component, HostListener, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthService } from '../../core/auth.service';
import { SettingsService } from '../../core/settings.service';

interface NavItem { path: string; label: string; icon: string; }

@Component({
  selector: 'app-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, FormsModule],
  template: `
    <nav class="navbar app-topbar sticky-top px-3 flex-nowrap d-print-none">
      <a class="navbar-brand d-flex align-items-center gap-2" routerLink="/">
        <span class="brand-mark sm"><i class="bi bi-wallet2"></i></span>
        <span class="brand-title">Kit Budgétaire</span>
      </a>
      <div class="d-flex align-items-center gap-1 gap-sm-2 ms-auto">
        <select class="form-select form-select-sm w-auto" aria-label="Devise d'affichage"
                [ngModel]="settings.currency()" (ngModelChange)="settings.update({ currency: $event })">
          @for (r of settings.settings().rates; track r.code) { <option [value]="r.code">{{ r.code }}</option> }
        </select>
        <button class="btn btn-sm btn-outline-secondary d-none d-lg-inline-block" (click)="print()" title="Imprimer"><i class="bi bi-printer"></i></button>
        <button class="btn btn-sm btn-outline-secondary" (click)="settings.toggleTheme()" title="Thème clair / sombre">
          <i class="bi" [class.bi-sun]="settings.settings().theme === 'dark'" [class.bi-moon-stars]="settings.settings().theme === 'light'"></i>
        </button>
        <button class="user-avatar d-lg-none" (click)="sheetOpen.set(true)"
                [attr.aria-label]="'Compte de ' + (auth.user()?.fullName ?? '')">{{ initials() }}</button>
        <div class="dropdown d-none d-lg-block">
          <button class="user-avatar" data-bs-toggle="dropdown" aria-expanded="false"
                  [attr.aria-label]="'Compte de ' + (auth.user()?.fullName ?? '')" [title]="auth.user()?.fullName ?? ''">{{ initials() }}</button>
          <ul class="dropdown-menu dropdown-menu-end">
            <li><span class="dropdown-item-text fw-semibold">{{ auth.user()?.fullName }}</span></li>
            <li><span class="dropdown-item-text small text-body-secondary">{{ auth.user()?.email }}</span></li>
            <li><hr class="dropdown-divider"></li>
            <li><button class="dropdown-item" (click)="auth.logout()"><i class="bi bi-box-arrow-right me-2"></i>Déconnexion</button></li>
          </ul>
        </div>
      </div>
    </nav>

    <div class="d-flex">
      <aside class="app-sidebar d-none d-lg-block d-print-none">
        @for (section of sections; track section.title) {
          <div class="sidebar-section">{{ section.title }}</div>
          @for (item of section.items; track item.path) {
            <a class="sidebar-link" [routerLink]="item.path" routerLinkActive="active"
               [routerLinkActiveOptions]="{ exact: item.path === '/' }">
              <i class="bi bi-{{ item.icon }}"></i>{{ item.label }}
            </a>
          }
        }
      </aside>
      <main class="app-main flex-grow-1"><router-outlet /></main>
    </div>

    <!-- Navigation mobile : barre d'onglets façon application native -->
    <nav class="tabbar d-lg-none d-print-none" aria-label="Navigation principale">
      @for (tab of tabs.slice(0, 2); track tab.path) {
        <a class="tabbar-item" [routerLink]="tab.path" routerLinkActive="active"
           [routerLinkActiveOptions]="{ exact: tab.path === '/' }" (click)="sheetOpen.set(false)">
          <i class="bi bi-{{ tab.icon }}"></i><span>{{ tab.label }}</span>
        </a>
      }
      <button class="tabbar-fab" (click)="quickAdd()" aria-label="Nouvelle opération"><i class="bi bi-plus-lg"></i></button>
      @for (tab of tabs.slice(2); track tab.path) {
        <a class="tabbar-item" [routerLink]="tab.path" routerLinkActive="active" (click)="sheetOpen.set(false)">
          <i class="bi bi-{{ tab.icon }}"></i><span>{{ tab.label }}</span>
        </a>
      }
      <button class="tabbar-item" [class.active]="sheetOpen()" (click)="sheetOpen.set(!sheetOpen())" aria-label="Plus">
        <i class="bi bi-grid"></i><span>Plus</span>
      </button>
    </nav>

    @if (sheetOpen()) {
      <div class="sheet-backdrop d-lg-none" (click)="sheetOpen.set(false)"></div>
      <div class="sheet d-lg-none" role="dialog" aria-label="Menu">
        <div class="sheet-handle"></div>
        <div class="d-flex align-items-center gap-3 mb-3">
          <span class="sheet-avatar">{{ initials() }}</span>
          <div class="min-w-0">
            <div class="fw-bold text-truncate">{{ auth.user()?.fullName }}</div>
            <div class="small text-body-secondary text-truncate">{{ auth.user()?.email }}</div>
          </div>
        </div>
        @for (section of sections; track section.title) {
          <div class="sidebar-section mx-0">{{ section.title }}</div>
          <div class="sheet-grid">
            @for (item of section.items; track item.path) {
              <a class="sheet-tile" [routerLink]="item.path" routerLinkActive="active"
                 [routerLinkActiveOptions]="{ exact: item.path === '/' }" (click)="sheetOpen.set(false)">
                <i class="bi bi-{{ item.icon }}"></i><span>{{ item.label }}</span>
              </a>
            }
          </div>
        }
        <button class="btn btn-outline-danger w-100 mt-3" (click)="auth.logout()">
          <i class="bi bi-box-arrow-right me-2"></i>Déconnexion
        </button>
      </div>
    }`,
})
export class LayoutComponent {
  readonly auth = inject(AuthService);
  readonly settings = inject(SettingsService);
  private readonly router = inject(Router);
  readonly sheetOpen = signal(false);

  readonly tabs: NavItem[] = [
    { path: '/', label: 'Accueil', icon: 'house-door' },
    { path: '/operations', label: 'Opérations', icon: 'arrow-left-right' },
    { path: '/budgets', label: 'Budgets', icon: 'bullseye' },
  ];

  readonly sections: { title: string; items: NavItem[] }[] = [
    {
      title: 'Espace Particulier', items: [
        { path: '/', label: 'Tableau de bord', icon: 'speedometer2' },
        { path: '/repartition', label: 'Répartition du salaire', icon: 'pie-chart' },
        { path: '/operations', label: 'Dépenses & revenus', icon: 'arrow-left-right' },
        { path: '/budgets', label: 'Budgets du mois', icon: 'bullseye' },
        { path: '/objectifs', label: 'Tontines & épargne', icon: 'piggy-bank' },
        { path: '/comptes', label: 'Comptes & Mobile Money', icon: 'wallet2' },
        { path: '/archives', label: 'Copies manuscrites', icon: 'journal-text' },
        { path: '/categories', label: 'Catégories', icon: 'tags' },
      ],
    },
    {
      title: 'Espace Entreprise', items: [
        { path: '/entreprise', label: 'Prévisionnel 12 mois', icon: 'shop' },
      ],
    },
    {
      title: 'Outils', items: [
        { path: '/parametres', label: 'Pays, devises & taux', icon: 'currency-exchange' },
        { path: '/guide', label: 'Guide d\'utilisation', icon: 'book' },
      ],
    },
  ];

  /** Initiales du prénom et du nom de famille : « Mame Fatou Thiam » → « MT ». */
  initials(): string {
    const words = (this.auth.user()?.fullName ?? '').trim().split(/\s+/).filter(Boolean);
    if (!words.length) return '?';
    const first = words[0], last = words.length > 1 ? words[words.length - 1] : '';
    return (first[0] + (last ? last[0] : first[1] ?? '')).toUpperCase();
  }

  /** Bouton « + » : ouvre directement le formulaire de nouvelle opération. */
  quickAdd(): void {
    this.sheetOpen.set(false);
    this.router.navigate(['/operations'], { queryParams: { nouveau: Date.now() } });
  }

  @HostListener('document:keydown.escape')
  closeSheet(): void {
    this.sheetOpen.set(false);
  }

  print(): void {
    window.print();
  }
}
