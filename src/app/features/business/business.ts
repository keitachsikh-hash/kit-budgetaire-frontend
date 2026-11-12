import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ChartConfiguration } from 'chart.js';

import { BusinessPlan, BusinessPlanStore, defaultBusinessPlan } from '../../core/business-plan';
import { SettingsService } from '../../core/settings.service';
import { ChartComponent } from '../../shared/chart';
import { downloadJson, readJsonFile } from '../../shared/file';
import { MoneyPipe } from '../../shared/money.pipe';

type Tab = 'hypotheses' | 'previsionnel' | 'tresorerie' | 'bord';

@Component({
  selector: 'app-business',
  imports: [FormsModule, ChartComponent, MoneyPipe],
  template: `
    <div class="page-header">
      <div>
        <div class="eyebrow">Espace Entreprise</div>
        <h1 class="page-title">{{ p().name || 'Mon entreprise' }} — prévisionnel {{ p().startYear }}</h1>
        <p class="text-body-secondary mb-0">Compte de résultat et trésorerie sur 12 mois, pour une boutique, un commerce ou une PME.</p>
      </div>
      <div class="d-flex gap-2 flex-wrap d-print-none">
        <button class="btn btn-outline-secondary" (click)="exportFile()"><i class="bi bi-download me-1"></i>Sauvegarder</button>
        <label class="btn btn-outline-secondary mb-0"><i class="bi bi-folder2-open me-1"></i>Ouvrir
          <input type="file" accept="application/json" hidden (change)="importFile($event)"></label>
        <button class="btn btn-outline-danger" (click)="reset()"><i class="bi bi-arrow-counterclockwise me-1"></i>Exemple</button>
      </div>
    </div>
    @if (message()) { <div class="alert alert-info py-2">{{ message() }}</div> }

    <ul class="nav nav-pills mb-3 d-print-none">
      @for (t of tabs; track t.id) {
        <li class="nav-item"><button class="nav-link" [class.active]="tab() === t.id" (click)="tab.set(t.id)"><i class="bi bi-{{ t.icon }} me-1"></i>{{ t.label }}</button></li>
      }
    </ul>

    @switch (tab()) {
      @case ('hypotheses') {
        <div class="row g-3">
          <div class="col-lg-6"><div class="card h-100"><div class="card-body">
            <h2 class="h6 card-title">Hypothèses clés</h2>
            <p class="small text-body-secondary">Ces cinq réglages pilotent tout le prévisionnel.</p>
            <div class="row g-3">
              <div class="col-8"><label class="form-label" for="bn">Nom de l'entreprise</label>
                <input id="bn" class="form-control" [(ngModel)]="p().name" (ngModelChange)="store.touch()"></div>
              <div class="col-4"><label class="form-label" for="by">Année</label>
                <input id="by" type="number" class="form-control" [(ngModel)]="p().startYear" (ngModelChange)="store.touch()"></div>
              <div class="col-6"><label class="form-label" for="rev">CA mensuel de départ (HT)</label>
                <input id="rev" type="number" min="0" inputmode="decimal" class="form-control" [(ngModel)]="p().monthlyRevenue" (ngModelChange)="store.touch()"></div>
              <div class="col-6"><label class="form-label" for="gr">Croissance mensuelle (%)</label>
                <input id="gr" type="number" step="0.5" class="form-control" [(ngModel)]="p().monthlyGrowthPct" (ngModelChange)="store.touch()"></div>
              <div class="col-6"><label class="form-label" for="cost">Coût d'achat (% du CA)</label>
                <input id="cost" type="number" min="0" inputmode="decimal" max="100" class="form-control" [(ngModel)]="p().purchaseCostPct" (ngModelChange)="store.touch()"></div>
              <div class="col-6"><label class="form-label" for="tax">Impôt estimé sur bénéfice (%)</label>
                <input id="tax" type="number" min="0" inputmode="decimal" max="100" class="form-control" [(ngModel)]="p().taxRatePct" (ngModelChange)="store.touch()"></div>
              <div class="col-6"><label class="form-label" for="cash">Ventes encaissées comptant (%)</label>
                <input id="cash" type="number" min="0" inputmode="decimal" max="100" class="form-control" [(ngModel)]="p().cashSalesPct" (ngModelChange)="store.touch()"></div>
              <div class="col-6"><label class="form-label" for="open">Trésorerie au 1er mois</label>
                <input id="open" type="number" class="form-control" [(ngModel)]="p().openingCash" (ngModelChange)="store.touch()"></div>
              <div class="col-6"><label class="form-label" for="rec">Créances clients à encaisser au 1er mois</label>
                <input id="rec" type="number" min="0" inputmode="decimal" class="form-control" [(ngModel)]="p().openingReceivables" (ngModelChange)="store.touch()"></div>
            </div>
            <p class="small text-body-secondary mt-3 mb-0"><i class="bi bi-info-circle me-1"></i>Impôt : adaptez le taux à votre régime (IS, TPS, impôt synthétique…). Vérifiez auprès de l'administration fiscale de votre pays.</p>
          </div></div></div>
          <div class="col-lg-6"><div class="card h-100"><div class="card-body">
            <h2 class="h6 card-title">Charges fixes mensuelles</h2>
            <p class="small text-body-secondary">Les charges qui reviennent chaque mois, quel que soit le niveau des ventes.</p>
            <table class="table align-middle mb-2">
              <thead><tr><th>Charge</th><th class="text-end col-amount">Montant / mois</th><th style="width: 40px"></th></tr></thead>
              <tbody>
                @for (c of p().charges; track $index; let i = $index) {
                  <tr>
                    <td><input class="form-control form-control-sm" [(ngModel)]="p().charges[i].label" (ngModelChange)="store.touch()" aria-label="Charge"></td>
                    <td><input type="number" min="0" inputmode="decimal" class="form-control form-control-sm text-end" [(ngModel)]="p().charges[i].amount" (ngModelChange)="store.touch()" aria-label="Montant"></td>
                    <td><button class="btn btn-sm btn-link text-danger" (click)="removeCharge(i)" aria-label="Retirer"><i class="bi bi-x-lg"></i></button></td>
                  </tr>
                }
                <tr class="fw-bold"><td>Total charges fixes</td><td class="text-end">{{ f().months[0].fixedCharges | money }}</td><td></td></tr>
              </tbody>
            </table>
            <button class="btn btn-sm btn-outline-secondary" (click)="addCharge()"><i class="bi bi-plus-lg me-1"></i>Ajouter une charge</button>
          </div></div></div>
        </div>
      }
      @case ('previsionnel') {
        <div class="card"><div class="table-responsive">
          <table class="table table-sm table-hover align-middle mb-0 forecast-table">
            <thead><tr><th>Compte de résultat</th>@for (m of f().months; track $index) { <th class="text-end">{{ m.label }}</th> }<th class="text-end">Total</th></tr></thead>
            <tbody>
              @for (row of resultRows; track row.key) {
                <tr [class.fw-bold]="row.bold">
                  <td class="text-nowrap">{{ row.label }}</td>
                  @for (m of f().months; track $index) { <td class="text-end" [class.text-danger]="$any(m)[row.key] < 0">{{ short($any(m)[row.key]) }}</td> }
                  <td class="text-end fw-bold" [class.text-danger]="$any(f().totals)[row.key] < 0">{{ short($any(f().totals)[row.key]) }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div></div>
        <p class="small text-body-secondary mt-2">Montants en {{ settings.currency() === 'XOF' ? 'FCFA' : settings.currency() }}, arrondis.</p>
      }
      @case ('tresorerie') {
        <div class="card mb-3"><div class="card-body">
          <h2 class="h6 card-title">Trésorerie fin de mois</h2>
          <app-chart [config]="cashChart()" [height]="260" />
        </div></div>
        <div class="card"><div class="table-responsive">
          <table class="table table-sm table-hover align-middle mb-0 forecast-table">
            <thead><tr><th>Trésorerie</th>@for (m of f().months; track $index) { <th class="text-end">{{ m.label }}</th> }</tr></thead>
            <tbody>
              @for (row of cashRows; track row.key) {
                <tr [class.fw-bold]="row.bold">
                  <td class="text-nowrap">{{ row.label }}</td>
                  @for (m of f().months; track $index) { <td class="text-end" [class.text-danger]="$any(m)[row.key] < 0">{{ short($any(m)[row.key]) }}</td> }
                </tr>
              }
            </tbody>
          </table>
        </div></div>
        <p class="small text-body-secondary mt-2">Hypothèses : achats, charges et impôt payés le mois même ; ventes à crédit encaissées le mois suivant.</p>
      }
      @case ('bord') {
        <div class="row g-3 mb-3">
          <div class="col-6 col-xl-3"><div class="card stat-card"><div class="card-body">
            <div class="stat-label">Chiffre d'affaires annuel</div><div class="stat-value">{{ f().totals.revenue | money }}</div></div></div></div>
          <div class="col-6 col-xl-3"><div class="card stat-card"><div class="card-body">
            <div class="stat-label">Résultat net annuel</div>
            <div class="stat-value" [class.text-danger]="f().totals.netResult < 0" [class.text-success]="f().totals.netResult >= 0">{{ f().totals.netResult | money }}</div>
            <div class="small">Marge nette {{ f().marginRatePct.toFixed(1) }} %</div></div></div></div>
          <div class="col-6 col-xl-3"><div class="card stat-card"><div class="card-body">
            <div class="stat-label">Seuil de rentabilité mensuel</div><div class="stat-value">{{ f().breakEvenRevenue | money }}</div>
            <div class="small">CA minimum pour couvrir les charges</div></div></div></div>
          <div class="col-6 col-xl-3"><div class="card stat-card highlight"><div class="card-body">
            <div class="stat-label">Trésorerie fin d'année</div><div class="stat-value">{{ f().finalCash | money }}</div>
            <div class="small">Point bas : {{ f().lowestCash.cashEnd | money }} ({{ f().lowestCash.label }})</div></div></div></div>
        </div>
        @if (f().lowestCash.cashEnd < 0) {
          <div class="alert alert-warning"><i class="bi bi-exclamation-triangle me-2"></i>La trésorerie devient négative en {{ f().lowestCash.label }} : prévoyez un apport, un crédit ou réduisez les ventes à crédit.</div>
        }
        <div class="card"><div class="card-body">
          <h2 class="h6 card-title">Chiffre d'affaires et résultat net</h2>
          <app-chart [config]="resultChart()" [height]="280" />
        </div></div>
      }
    }`,
})
export class BusinessPage {
  readonly store = inject(BusinessPlanStore);
  readonly settings = inject(SettingsService);
  readonly p = this.store.plan;
  readonly f = this.store.forecast;
  readonly tab = signal<Tab>('hypotheses');
  readonly message = signal('');

  readonly tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'hypotheses', label: 'Hypothèses & charges', icon: 'sliders' },
    { id: 'previsionnel', label: 'Prévisionnel 12 mois', icon: 'table' },
    { id: 'tresorerie', label: 'Trésorerie', icon: 'cash-stack' },
    { id: 'bord', label: 'Tableau de bord', icon: 'speedometer2' },
  ];

  readonly resultRows = [
    { key: 'revenue', label: 'Chiffre d\'affaires', bold: true },
    { key: 'purchases', label: 'Achats consommés', bold: false },
    { key: 'grossMargin', label: 'Marge brute', bold: true },
    { key: 'fixedCharges', label: 'Charges fixes', bold: false },
    { key: 'operatingResult', label: 'Résultat avant impôt', bold: true },
    { key: 'tax', label: 'Impôt estimé', bold: false },
    { key: 'netResult', label: 'Résultat net', bold: true },
  ];

  readonly cashRows = [
    { key: 'cashIn', label: 'Encaissements', bold: false },
    { key: 'cashOut', label: 'Décaissements', bold: false },
    { key: 'cashEnd', label: 'Trésorerie fin de mois', bold: true },
    { key: 'receivablesEnd', label: 'Créances clients restantes', bold: false },
  ];

  readonly cashChart = computed<ChartConfiguration>(() => {
    const rate = this.settings.rateOf(this.settings.currency());
    const months = this.f().months;
    return {
      type: 'line',
      data: {
        labels: months.map(m => m.label),
        datasets: [{
          label: 'Trésorerie', data: months.map(m => m.cashEnd / rate), borderColor: '#e8833a',
          backgroundColor: 'rgba(232,131,58,.15)', fill: true, tension: .3,
        }],
      },
      options: { plugins: { legend: { display: false } } },
    };
  });

  readonly resultChart = computed<ChartConfiguration>(() => {
    const rate = this.settings.rateOf(this.settings.currency());
    const months = this.f().months;
    return {
      type: 'bar',
      data: {
        labels: months.map(m => m.label),
        datasets: [
          { label: 'Chiffre d\'affaires', data: months.map(m => m.revenue / rate), backgroundColor: '#2fa37a', borderRadius: 6 },
          { label: 'Résultat net', data: months.map(m => m.netResult / rate), backgroundColor: '#e8833a', borderRadius: 6 },
        ],
      },
      options: { plugins: { legend: { position: 'bottom' } } },
    };
  });

  /** Montant converti dans la devise d'affichage, sans symbole (tableaux larges). */
  short(value: number): string {
    const v = this.settings.convert(value, 'XOF', this.settings.currency());
    return Math.round(v).toLocaleString('fr-FR');
  }

  addCharge(): void {
    this.store.set({ ...this.p(), charges: [...this.p().charges, { label: 'Nouvelle charge', amount: 0 }] });
  }

  removeCharge(i: number): void {
    this.store.set({ ...this.p(), charges: this.p().charges.filter((_, k) => k !== i) });
  }

  reset(): void {
    if (confirm('Remplacer votre prévisionnel par l\'exemple « Ma Boutique » ?')) {
      this.store.set(defaultBusinessPlan());
    }
  }

  exportFile(): void {
    downloadJson({ kind: 'kit-budgetaire/business-plan', version: 1, plan: this.p() }, 'previsionnel-entreprise.json');
  }

  importFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    readJsonFile<{ kind?: string; plan?: BusinessPlan }>(file).then(data => {
      if (data.kind !== 'kit-budgetaire/business-plan' || !Array.isArray(data.plan?.charges)) {
        throw new Error('format');
      }
      this.store.set({ ...defaultBusinessPlan(), ...data.plan });
      this.message.set(`Prévisionnel « ${file.name} » chargé.`);
    }).catch(() => this.message.set('Ce fichier n\'est pas une sauvegarde de prévisionnel du Kit Budgétaire.'))
      .finally(() => input.value = '');
  }
}
