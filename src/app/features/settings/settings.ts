import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { COUNTRIES, SettingsService } from '../../core/settings.service';

@Component({
  selector: 'app-settings',
  imports: [FormsModule],
  template: `
    <div class="page-header">
      <div>
        <div class="eyebrow">Paramètres</div>
        <h1 class="page-title">Pays, devises & taux de change</h1>
      </div>
    </div>
    <div class="row g-3">
      <div class="col-lg-5 d-flex flex-column gap-3">
        <div class="card"><div class="card-body">
          <h2 class="h6 card-title">Votre pays, votre devise</h2>
          <p class="small text-body-secondary">Les montants sont saisis en FCFA et affichés dans la devise choisie.</p>
          <div class="mb-3"><label class="form-label" for="country">Pays</label>
            <select id="country" class="form-select" [ngModel]="settings.settings().country" (ngModelChange)="setCountry($event)">
              @for (c of countries; track c.name) { <option [value]="c.name">{{ c.name }}</option> }
            </select></div>
          <div class="mb-3"><label class="form-label" for="cur">Devise d'affichage</label>
            <select id="cur" class="form-select" [ngModel]="settings.currency()" (ngModelChange)="settings.update({ currency: $event })">
              @for (r of settings.settings().rates; track r.code) { <option [value]="r.code">{{ r.code }} — {{ r.label }}</option> }
            </select></div>
          <div><span class="form-label d-block">Thème</span>
            <div class="btn-group">
              <button class="btn" [class.btn-accent]="settings.settings().theme === 'dark'" [class.btn-outline-secondary]="settings.settings().theme !== 'dark'" (click)="settings.update({ theme: 'dark' })"><i class="bi bi-moon-stars me-1"></i>Sombre</button>
              <button class="btn" [class.btn-accent]="settings.settings().theme === 'light'" [class.btn-outline-secondary]="settings.settings().theme !== 'light'" (click)="settings.update({ theme: 'light' })"><i class="bi bi-sun me-1"></i>Clair</button>
            </div></div>
        </div></div>

        <div class="card"><div class="card-body">
          <h2 class="h6 card-title">Convertisseur rapide</h2>
          <div class="row g-2 align-items-end">
            <div class="col-12"><label class="form-label" for="amt">Montant</label>
              <input id="amt" type="number" class="form-control" [ngModel]="amount()" (ngModelChange)="amount.set($event)"></div>
            <div class="col-5"><label class="form-label" for="from">De</label>
              <select id="from" class="form-select" [ngModel]="from()" (ngModelChange)="from.set($event)">
                @for (r of settings.settings().rates; track r.code) { <option [value]="r.code">{{ r.code }}</option> }
              </select></div>
            <div class="col-2 text-center pb-1"><button class="btn btn-link" (click)="swap()" aria-label="Inverser"><i class="bi bi-arrow-left-right"></i></button></div>
            <div class="col-5"><label class="form-label" for="to">Vers</label>
              <select id="to" class="form-select" [ngModel]="to()" (ngModelChange)="to.set($event)">
                @for (r of settings.settings().rates; track r.code) { <option [value]="r.code">{{ r.code }}</option> }
              </select></div>
          </div>
          <div class="converter-result mt-3">{{ result() }}</div>
        </div></div>
      </div>

      <div class="col-lg-7"><div class="card"><div class="card-body">
        <div class="d-flex justify-content-between align-items-start">
          <div>
            <h2 class="h6 card-title">Taux de change</h2>
            <p class="small text-body-secondary">Valeur d'une unité en FCFA (XOF). Les parités fixes ne changent pas : actualisez les devises flottantes chaque mois.</p>
          </div>
          <button class="btn btn-sm btn-outline-secondary" (click)="resetRates()">Réinitialiser</button>
        </div>
        <table class="table align-middle mb-2">
          <thead><tr><th>Code</th><th>Devise</th><th class="text-end">1 unité = ? FCFA</th><th>Régime</th></tr></thead>
          <tbody>
            @for (r of settings.settings().rates; track r.code) {
              <tr>
                <td class="fw-semibold">{{ r.code }}</td>
                <td>{{ r.label }}</td>
                <td style="width: 160px">
                  @if (r.fixed) { <div class="text-end">{{ r.rate.toLocaleString('fr-FR') }}</div> }
                  @else { <input type="number" step="any" min="0" class="form-control form-control-sm text-end" [ngModel]="r.rate" (ngModelChange)="setRate(r.code, $event)" [attr.aria-label]="'Taux ' + r.code"> }
                </td>
                <td><span class="badge" [class.text-bg-secondary]="r.fixed" [class.text-bg-warning]="!r.fixed">{{ r.fixed ? 'Fixe' : 'Flottant' }}</span></td>
              </tr>
            }
          </tbody>
        </table>
        <p class="small text-body-secondary mb-0">Taux indicatifs par défaut : parités officielles BCEAO pour XOF, XAF, EUR et KMF ; cotations à mettre à jour pour les autres.</p>
      </div></div></div>
    </div>`,
})
export class SettingsPage {
  readonly settings = inject(SettingsService);
  readonly countries = COUNTRIES;
  readonly amount = signal(100);
  readonly from = signal('EUR');
  readonly to = signal('XOF');
  readonly result = computed(() => {
    this.settings.settings();
    const value = this.settings.convert(Number(this.amount()) || 0, this.from(), this.to());
    const label = this.to() === 'XOF' || this.to() === 'XAF' ? 'FCFA' : this.to();
    return `${value.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} ${label}`;
  });

  setCountry(name: string): void {
    const country = COUNTRIES.find(c => c.name === name);
    this.settings.update({ country: name, currency: country?.currency ?? this.settings.currency() });
  }

  setRate(code: string, value: number): void {
    if (Number(value) > 0) this.settings.setRate(code, Number(value));
  }

  resetRates(): void {
    if (confirm('Revenir aux taux par défaut ?')) this.settings.resetRates();
  }

  swap(): void {
    const from = this.from();
    this.from.set(this.to());
    this.to.set(from);
  }
}
