import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ChartConfiguration } from 'chart.js';

import { SalaryPlan, SalaryPlanStore, africaTemplate, rule503020 } from '../../core/salary-plan';
import { SettingsService } from '../../core/settings.service';
import { ChartComponent } from '../../shared/chart';
import { downloadJson, readJsonFile } from '../../shared/file';
import { MoneyPipe } from '../../shared/money.pipe';

@Component({
  selector: 'app-salary-plan',
  imports: [FormsModule, ChartComponent, MoneyPipe],
  template: `
    <div class="page-header">
      <div>
        <div class="eyebrow">Espace Particulier · vos revenus</div>
        <h1 class="page-title">Répartition du salaire</h1>
        <p class="text-body-secondary mb-0">Répartissez votre salaire net, suivez votre épargne et ce qu'il vous reste.</p>
      </div>
      <div class="d-flex gap-2 flex-wrap d-print-none">
        <button class="btn btn-outline-secondary" (click)="exportFile()"><i class="bi bi-download me-1"></i>Sauvegarder</button>
        <label class="btn btn-outline-secondary mb-0"><i class="bi bi-folder2-open me-1"></i>Ouvrir
          <input type="file" accept="application/json" hidden (change)="importFile($event)"></label>
      </div>
    </div>
    @if (message()) { <div class="alert alert-info py-2">{{ message() }}</div> }

    <div class="row g-3">
      <div class="col-xl-8 d-flex flex-column gap-3">
        <div class="card"><div class="card-body">
          <h2 class="h6 card-title">1. Mes revenus du mois</h2>
          <p class="small text-body-secondary">Salaire net (après retenues) et autres entrées régulières.</p>
          <div class="table-responsive"><table class="table align-middle mb-2">
            <thead><tr><th>Source</th><th class="text-end col-amount">Montant (FCFA)</th><th style="width: 40px"></th></tr></thead>
            <tbody>
              @for (inc of store.plan().incomes; track $index) {
                <tr>
                  <td><input class="form-control form-control-sm" [(ngModel)]="inc.label" (ngModelChange)="store.touch()" aria-label="Source"></td>
                  <td><input type="number" min="0" inputmode="decimal" class="form-control form-control-sm text-end" [(ngModel)]="inc.amount" (ngModelChange)="store.touch()" aria-label="Montant"></td>
                  <td><button class="btn btn-sm btn-link text-danger d-print-none" (click)="removeIncome($index)" aria-label="Retirer"><i class="bi bi-x-lg"></i></button></td>
                </tr>
              }
              <tr class="fw-bold"><td>Total des revenus</td><td class="text-end">{{ s().totalIncome | money }}</td><td></td></tr>
            </tbody>
          </table></div>
          <button class="btn btn-sm btn-outline-secondary d-print-none" (click)="addIncome()"><i class="bi bi-plus-lg me-1"></i>Ajouter un revenu</button>
        </div></div>

        <div class="card"><div class="card-body">
          <div class="d-flex justify-content-between flex-wrap gap-2 mb-2">
            <div>
              <h2 class="h6 card-title mb-1">2. Ma répartition</h2>
              <p class="small text-body-secondary mb-0">Pour chaque poste : un pourcentage du revenu ou un montant fixe. Cochez « Épargne » pour l'argent mis de côté.</p>
            </div>
            <div class="d-flex gap-2 flex-wrap align-items-start d-print-none">
              <button class="btn btn-sm btn-accent-soft" (click)="applyAfrica()">Modèle Afrique (conseillé)</button>
              <button class="btn btn-sm btn-accent-soft" (click)="apply503020()">Règle 50 / 30 / 20</button>
              <button class="btn btn-sm btn-outline-danger" (click)="clear()">Tout effacer</button>
            </div>
          </div>
          <div class="table-responsive"><table class="table align-middle plan-table mb-2">
            <thead><tr><th>Poste</th><th>Mode</th><th class="text-end">Valeur</th><th class="text-end">Montant</th>
              <th class="text-end">Part</th><th class="text-center">Épargne</th><th></th></tr></thead>
            <tbody>
              @for (l of s().lines; track $index; let i = $index) {
                <tr>
                  <td><div class="d-flex align-items-center gap-2">
                    <span class="color-dot" [style.background]="l.color"></span>
                    <input class="form-control form-control-sm" [(ngModel)]="store.plan().allocations[i].label" (ngModelChange)="store.touch()" aria-label="Poste">
                  </div></td>
                  <td><div class="btn-group btn-group-sm" role="group" aria-label="Mode">
                    <button class="btn" [class.btn-accent]="l.mode === 'PERCENT'" [class.btn-outline-secondary]="l.mode !== 'PERCENT'" (click)="setMode(i, 'PERCENT')">%</button>
                    <button class="btn" [class.btn-accent]="l.mode === 'AMOUNT'" [class.btn-outline-secondary]="l.mode !== 'AMOUNT'" (click)="setMode(i, 'AMOUNT')">Montant</button>
                  </div></td>
                  <td style="width: 130px"><input type="number" min="0" inputmode="decimal" class="form-control form-control-sm text-end" [(ngModel)]="store.plan().allocations[i].value" (ngModelChange)="store.touch()" aria-label="Valeur"></td>
                  <td class="text-end text-nowrap">{{ l.amount | money }}</td>
                  <td class="text-end text-nowrap">{{ l.share.toFixed(1) }} %</td>
                  <td class="text-center"><input type="checkbox" class="form-check-input" [(ngModel)]="store.plan().allocations[i].saving" (ngModelChange)="store.touch()" aria-label="Épargne"></td>
                  <td><button class="btn btn-sm btn-link text-danger d-print-none" (click)="removeLine(i)" aria-label="Retirer"><i class="bi bi-x-lg"></i></button></td>
                </tr>
              }
            </tbody>
          </table></div>
          <button class="btn btn-sm btn-outline-secondary d-print-none" (click)="addLine()"><i class="bi bi-plus-lg me-1"></i>Ajouter un poste</button>
        </div></div>
      </div>

      <div class="col-xl-4 d-flex flex-column gap-3">
        <div class="card remaining-card sticky-xl-top" style="top: 80px"><div class="card-body text-center">
          <div class="eyebrow">Montant restant après répartition</div>
          <div class="display-6 fw-bold my-1" [class.text-danger]="s().remaining < 0">{{ s().remaining | money }}</div>
          <div class="small mb-2">{{ s().remaining < 0 ? 'Vous dépassez vos revenus : réduisez certains postes.' : 'À affecter : épargne, objectif ou imprévus.' }}</div>
          <div class="stack-bar" role="img" aria-label="Répartition du revenu">
            @for (l of s().lines; track $index) { <span [style.width.%]="l.share" [style.background]="l.color" [title]="l.label"></span> }
          </div>
          <div class="small mt-1">{{ s().allocatedPercent.toFixed(0) }} % du revenu réparti · {{ (100 - s().allocatedPercent).toFixed(0) }} % libre</div>
        </div></div>

        <div class="card"><div class="card-body">
          <h2 class="h6 card-title">Où va mon salaire</h2>
          <app-chart [config]="chart()" [height]="240" />
        </div></div>

        <div class="card"><div class="card-body">
          <h2 class="h6 card-title">Résumé</h2>
          <dl class="row mb-0 small">
            <dt class="col-7 fw-normal">Revenus</dt><dd class="col-5 text-end">{{ s().totalIncome | money }}</dd>
            <dt class="col-7 fw-normal">Dépenses prévues</dt><dd class="col-5 text-end">{{ s().allocated - s().savings | money }}</dd>
            <dt class="col-7 fw-normal">Épargne prévue</dt><dd class="col-5 text-end">{{ s().savings | money }}</dd>
            <dt class="col-7 fw-normal">Taux d'épargne</dt><dd class="col-5 text-end fw-bold text-accent">{{ s().savingsRate.toFixed(1) }} %</dd>
            <dt class="col-7">Reste à affecter</dt><dd class="col-5 text-end fw-bold">{{ s().remaining | money }}</dd>
          </dl>
          <p class="small text-body-secondary mt-2 mb-0">Le taux d'épargne compte l'épargne prévue et le reste non affecté.</p>
        </div></div>
      </div>
    </div>`,
})
export class SalaryPlanPage {
  readonly store = inject(SalaryPlanStore);
  private readonly settings = inject(SettingsService);
  readonly s = this.store.summary;
  readonly message = signal('');

  readonly chart = computed<ChartConfiguration>(() => {
    const lines = this.s().lines.filter(l => l.amount > 0);
    const remaining = Math.max(this.s().remaining, 0);
    return {
      type: 'doughnut',
      data: {
        labels: [...lines.map(l => l.label), 'Reste à affecter'],
        datasets: [{
          data: [...lines.map(l => l.amount), remaining],
          backgroundColor: [...lines.map(l => l.color), '#5b6b64'], borderWidth: 0,
        }],
      },
      options: {
        cutout: '60%',
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => ` ${ctx.label} : ${this.settings.format(ctx.parsed as number)}` } },
        },
      },
    };
  });

  addIncome(): void {
    const p = this.store.plan();
    this.store.set({ ...p, incomes: [...p.incomes, { label: 'Nouveau revenu', amount: 0 }] });
  }

  removeIncome(i: number): void {
    const p = this.store.plan();
    this.store.set({ ...p, incomes: p.incomes.filter((_, k) => k !== i) });
  }

  addLine(): void {
    const p = this.store.plan();
    this.store.set({ ...p, allocations: [...p.allocations,
      { label: 'Nouveau poste', mode: 'AMOUNT', value: 0, saving: false, color: this.store.nextColor() }] });
  }

  removeLine(i: number): void {
    const p = this.store.plan();
    this.store.set({ ...p, allocations: p.allocations.filter((_, k) => k !== i) });
  }

  /** Change le mode en conservant le montant courant du poste. */
  setMode(i: number, mode: 'PERCENT' | 'AMOUNT'): void {
    const p = this.store.plan();
    const line = p.allocations[i];
    if (line.mode === mode) return;
    const amount = this.s().lines[i].amount;
    const total = this.s().totalIncome;
    const value = mode === 'AMOUNT' ? amount : total ? Math.round(amount * 1000 / total) / 10 : 0;
    this.store.set({ ...p, allocations: p.allocations.map((a, k) => k === i ? { ...a, mode, value } : a) });
  }

  applyAfrica(): void {
    if (confirm('Remplacer votre répartition par le Modèle Afrique ? Vos revenus seront aussi remplacés par l\'exemple.')) {
      this.store.set(africaTemplate());
    }
  }

  apply503020(): void {
    if (confirm('Remplacer vos postes par la règle 50 / 30 / 20 ? Vos revenus sont conservés.')) {
      this.store.set(rule503020(this.store.plan().incomes));
    }
  }

  clear(): void {
    if (confirm('Effacer tous les revenus et tous les postes ?')) {
      this.store.set({ incomes: [{ label: 'Salaire net principal', amount: 0 }], allocations: [] });
    }
  }

  exportFile(): void {
    downloadJson({ kind: 'kit-budgetaire/salary-plan', version: 1, plan: this.store.plan() }, 'repartition-salaire.json');
  }

  importFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    readJsonFile<{ kind?: string; plan?: SalaryPlan }>(file).then(data => {
      if (data.kind !== 'kit-budgetaire/salary-plan' || !data.plan?.incomes || !data.plan?.allocations) {
        throw new Error('format');
      }
      this.store.set(data.plan);
      this.message.set(`Répartition « ${file.name} » chargée.`);
    }).catch(() => this.message.set('Ce fichier n\'est pas une sauvegarde de répartition du Kit Budgétaire.'))
      .finally(() => input.value = '');
  }
}
