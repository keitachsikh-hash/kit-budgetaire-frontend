import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ChartConfiguration } from 'chart.js';

import { ApiService, errorMessage } from '../../core/api.service';
import { Dashboard, currentPeriod, periodLabel, shiftPeriod, shortPeriodLabel } from '../../core/models';
import { SalaryPlanStore } from '../../core/salary-plan';
import { SettingsService } from '../../core/settings.service';
import { ChartComponent } from '../../shared/chart';
import { MoneyPipe } from '../../shared/money.pipe';

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, ChartComponent, MoneyPipe],
  template: `
    <div class="page-header">
      <div>
        <div class="eyebrow">Espace Particulier</div>
        <h1 class="page-title">Tableau de bord</h1>
      </div>
      <div class="btn-group">
        <button class="btn btn-outline-secondary" (click)="move(-1)" aria-label="Mois précédent"><i class="bi bi-chevron-left"></i></button>
        <span class="btn btn-outline-secondary disabled period-label">{{ label() }}</span>
        <button class="btn btn-outline-secondary" (click)="move(1)" aria-label="Mois suivant"><i class="bi bi-chevron-right"></i></button>
      </div>
    </div>

    @if (error()) { <div class="alert alert-danger">{{ error() }}</div> }
    @if (data(); as d) {
      <div class="row g-3 mb-3">
        <div class="col-6 col-xl-3"><div class="card stat-card"><div class="card-body">
          <div class="stat-label"><i class="bi bi-wallet2"></i> Solde total</div>
          <div class="stat-value">{{ d.totalBalance | money }}</div>
        </div></div></div>
        <div class="col-6 col-xl-3"><div class="card stat-card"><div class="card-body">
          <div class="stat-label"><i class="bi bi-arrow-down-circle text-success"></i> Revenus du mois</div>
          <div class="stat-value text-success">{{ d.income | money }}</div>
        </div></div></div>
        <div class="col-6 col-xl-3"><div class="card stat-card"><div class="card-body">
          <div class="stat-label"><i class="bi bi-arrow-up-circle text-danger"></i> Dépenses du mois</div>
          <div class="stat-value text-danger">{{ d.expense | money }}</div>
          @if (d.expenseChangePercent !== null) {
            <div class="small" [class.text-danger]="d.expenseChangePercent > 0" [class.text-success]="d.expenseChangePercent <= 0">
              <i class="bi" [class.bi-arrow-up]="d.expenseChangePercent > 0" [class.bi-arrow-down]="d.expenseChangePercent <= 0"></i>
              {{ d.expenseChangePercent }} % vs mois précédent
            </div>
          }
        </div></div></div>
        <div class="col-6 col-xl-3"><div class="card stat-card highlight"><div class="card-body">
          <div class="stat-label"><i class="bi bi-piggy-bank"></i> Taux d'épargne</div>
          <div class="stat-value">{{ d.savingsRate }} %</div>
          <div class="small">Reste : {{ d.net | money }}</div>
        </div></div></div>
      </div>

      <div class="row g-3 mb-3">
        <div class="col-lg-7"><div class="card h-100"><div class="card-body">
          <h2 class="card-title h6">Revenus et dépenses sur 6 mois</h2>
          <app-chart [config]="trendChart()" [height]="280" />
        </div></div></div>
        <div class="col-lg-5"><div class="card h-100"><div class="card-body">
          <h2 class="card-title h6">Où va mon argent ce mois-ci</h2>
          @if (d.expensesByCategory.length) {
            <app-chart [config]="categoryChart()" [height]="280" />
          } @else { <p class="text-body-secondary py-5 text-center">Aucune dépense ce mois-ci.</p> }
        </div></div></div>
      </div>

      <div class="row g-3">
        <div class="col-lg-7"><div class="card h-100"><div class="card-body">
          <div class="d-flex justify-content-between align-items-center mb-2">
            <h2 class="card-title h6 mb-0">Dernières opérations</h2>
            <a routerLink="/operations" class="small">Tout voir</a>
          </div>
          <ul class="list-group list-group-flush">
            @for (t of d.recent; track t.id) {
              <li class="list-group-item d-flex align-items-center gap-3 px-0">
                <span class="cat-icon" [style.background]="t.category.color"><i class="bi bi-{{ t.category.icon }}"></i></span>
                <div class="flex-grow-1 min-w-0">
                  <div class="text-truncate">{{ t.description || t.category.name }}</div>
                  <div class="small text-body-secondary">{{ t.date }} · {{ t.account.name }}</div>
                </div>
                <strong class="text-nowrap" [class.text-success]="t.type === 'INCOME'" [class.text-danger]="t.type === 'EXPENSE'">
                  {{ t.type === 'INCOME' ? '+' : '−' }} {{ t.amount | money }}
                </strong>
              </li>
            } @empty { <li class="list-group-item px-0 text-body-secondary">Aucune opération enregistrée.</li> }
          </ul>
        </div></div></div>
        <div class="col-lg-5 d-flex flex-column gap-3">
          <a routerLink="/repartition" class="card remaining-card text-decoration-none"><div class="card-body">
            <div class="eyebrow">Plan de répartition du salaire</div>
            <div class="fs-4 fw-bold">{{ plan.summary().remaining | money }}</div>
            <div class="small">restant à affecter · épargne prévue {{ plan.summary().savingsRate.toFixed(1) }} %</div>
          </div></a>
          <div class="card"><div class="card-body">
            <div class="d-flex justify-content-between align-items-center mb-2">
              <h2 class="card-title h6 mb-0">Budgets du mois</h2>
              <a routerLink="/budgets" class="small">Gérer</a>
            </div>
            @if (d.budget.totalLimit > 0) {
              <div class="small mb-1">{{ d.budget.totalSpent | money }} / {{ d.budget.totalLimit | money }}</div>
              <div class="progress mb-2" role="progressbar" [attr.aria-valuenow]="d.budget.percent">
                <div class="progress-bar" [class]="barClass(d.budget.percent)" [style.width.%]="min100(d.budget.percent)"></div>
              </div>
              @for (b of d.budget.alerts; track b.id) {
                <div class="small" [class.text-danger]="b.status === 'EXCEEDED'" [class.text-warning]="b.status === 'WARNING'">
                  <i class="bi bi-exclamation-triangle me-1"></i>{{ b.categoryName }} : {{ b.percent }} %
                </div>
              }
            } @else { <p class="small text-body-secondary mb-0">Aucun budget défini pour ce mois.</p> }
          </div></div>
          <div class="card"><div class="card-body">
            <div class="d-flex justify-content-between align-items-center mb-2">
              <h2 class="card-title h6 mb-0">Objectifs d'épargne</h2>
              <a routerLink="/objectifs" class="small">Voir</a>
            </div>
            @for (g of d.goals; track g.id) {
              <div class="mb-2">
                <div class="d-flex justify-content-between small"><span><i class="bi bi-{{ g.icon }} me-1" [style.color]="g.color"></i>{{ g.name }}</span><span>{{ g.percent }} %</span></div>
                <div class="progress" style="height: 6px"><div class="progress-bar" [style.width.%]="g.percent" [style.background]="g.color"></div></div>
              </div>
            } @empty { <p class="small text-body-secondary mb-0">Aucun objectif en cours.</p> }
          </div></div>
        </div>
      </div>
    } @else if (!error()) { <div class="text-center py-5"><div class="spinner-border text-accent"></div></div> }`,
})
export class DashboardPage {
  private readonly api = inject(ApiService);
  private readonly settings = inject(SettingsService);
  readonly plan = inject(SalaryPlanStore);

  readonly period = signal(currentPeriod());
  readonly label = computed(() => periodLabel(this.period()));
  readonly data = signal<Dashboard | null>(null);
  readonly error = signal('');

  readonly categoryChart = computed<ChartConfiguration>(() => {
    const cats = this.data()?.expensesByCategory ?? [];
    return {
      type: 'doughnut',
      data: {
        labels: cats.map(c => c.name),
        datasets: [{ data: cats.map(c => c.total), backgroundColor: cats.map(c => c.color), borderWidth: 0 }],
      },
      options: {
        cutout: '62%',
        plugins: {
          legend: { position: 'right', labels: { boxWidth: 12 } },
          tooltip: { callbacks: { label: ctx => ` ${ctx.label} : ${this.settings.format(ctx.parsed as number)}` } },
        },
      },
    };
  });

  readonly trendChart = computed<ChartConfiguration>(() => {
    const trend = this.data()?.trend ?? [];
    const rate = this.settings.rateOf(this.settings.currency());
    return {
      type: 'bar',
      data: {
        labels: trend.map(m => shortPeriodLabel(m.period)),
        datasets: [
          { label: 'Revenus', data: trend.map(m => m.income / rate), backgroundColor: '#2fa37a', borderRadius: 6 },
          { label: 'Dépenses', data: trend.map(m => m.expense / rate), backgroundColor: '#e8833a', borderRadius: 6 },
        ],
      },
      options: { plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true } } },
    };
  });

  constructor() {
    this.load();
  }

  move(months: number): void {
    this.period.set(shiftPeriod(this.period(), months));
    this.load();
  }

  barClass(percent: number): string {
    return percent > 100 ? 'bg-danger' : percent >= 80 ? 'bg-warning' : 'bg-success';
  }

  min100(percent: number): number {
    return Math.min(100, percent);
  }

  private load(): void {
    this.error.set('');
    this.data.set(null);
    this.api.dashboard(this.period()).subscribe({
      next: d => this.data.set(d),
      error: err => this.error.set(errorMessage(err)),
    });
  }
}
