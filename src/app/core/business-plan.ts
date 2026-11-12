import { Injectable, computed, signal } from '@angular/core';

import { readJson, writeJson } from './auth.service';

export interface Charge { label: string; amount: number; }
export interface BusinessPlan {
  name: string; startYear: number; startMonth: number;
  monthlyRevenue: number; monthlyGrowthPct: number; purchaseCostPct: number;
  cashSalesPct: number; taxRatePct: number; openingCash: number; openingReceivables: number;
  charges: Charge[];
}

export interface ForecastMonth {
  label: string; revenue: number; purchases: number; grossMargin: number; fixedCharges: number;
  operatingResult: number; tax: number; netResult: number;
  cashIn: number; cashOut: number; cashEnd: number; receivablesEnd: number;
}
export interface Forecast {
  months: ForecastMonth[]; totals: Omit<ForecastMonth, 'label' | 'cashEnd' | 'receivablesEnd'>;
  breakEvenRevenue: number; marginRatePct: number; lowestCash: ForecastMonth; finalCash: number;
}

export function defaultBusinessPlan(): BusinessPlan {
  const now = new Date();
  return {
    name: 'Ma Boutique', startYear: now.getFullYear() + 1, startMonth: 1,
    monthlyRevenue: 1500000, monthlyGrowthPct: 2, purchaseCostPct: 55, cashSalesPct: 70,
    taxRatePct: 25, openingCash: 600000, openingReceivables: 300000,
    charges: [
      { label: 'Loyer du local', amount: 100000 },
      { label: 'Salaires & cotisations (CNSS)', amount: 180000 },
      { label: 'Électricité & eau', amount: 25000 },
      { label: 'Transport & livraison', amount: 40000 },
      { label: 'Communication & internet', amount: 15000 },
      { label: 'Marketing (réseaux sociaux, affiches)', amount: 20000 },
      { label: 'Frais Mobile Money & bancaires', amount: 10000 },
      { label: 'Entretien & réparations', amount: 10000 },
      { label: 'Comptabilité & conseil', amount: 15000 },
      { label: 'Impôts & taxes (patente)', amount: 12500 },
    ],
  };
}

/**
 * Prévisionnel sur 12 mois. Hypothèses simplifiées :
 * - les achats et les charges sont payés le mois même ;
 * - la part non encaissée comptant est encaissée le mois suivant ;
 * - l'impôt est provisionné chaque mois sur le résultat positif.
 */
export function computeForecast(p: BusinessPlan): Forecast {
  const fixed = p.charges.reduce((s, c) => s + (Number(c.amount) || 0), 0);
  const cost = (Number(p.purchaseCostPct) || 0) / 100;
  const cashShare = (Number(p.cashSalesPct) || 0) / 100;
  const growth = (Number(p.monthlyGrowthPct) || 0) / 100;
  const tax = (Number(p.taxRatePct) || 0) / 100;

  let cash = Number(p.openingCash) || 0;
  let receivables = Number(p.openingReceivables) || 0;
  const months: ForecastMonth[] = [];
  for (let i = 0; i < 12; i++) {
    const date = new Date(p.startYear, p.startMonth - 1 + i, 1);
    const revenue = Math.round((Number(p.monthlyRevenue) || 0) * Math.pow(1 + growth, i));
    const purchases = Math.round(revenue * cost);
    const grossMargin = revenue - purchases;
    const operatingResult = grossMargin - fixed;
    const taxAmount = Math.round(Math.max(0, operatingResult) * tax);
    const netResult = operatingResult - taxAmount;
    const cashSales = Math.round(revenue * cashShare);
    const cashIn = cashSales + receivables;
    const cashOut = purchases + fixed + taxAmount;
    receivables = revenue - cashSales;
    cash += cashIn - cashOut;
    months.push({
      label: date.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }),
      revenue, purchases, grossMargin, fixedCharges: fixed, operatingResult, tax: taxAmount, netResult,
      cashIn, cashOut, cashEnd: cash, receivablesEnd: receivables,
    });
  }
  const sum = (k: keyof ForecastMonth) => months.reduce((s, m) => s + (m[k] as number), 0);
  const totals = {
    revenue: sum('revenue'), purchases: sum('purchases'), grossMargin: sum('grossMargin'),
    fixedCharges: sum('fixedCharges'), operatingResult: sum('operatingResult'), tax: sum('tax'),
    netResult: sum('netResult'), cashIn: sum('cashIn'), cashOut: sum('cashOut'),
  };
  return {
    months, totals,
    breakEvenRevenue: cost < 1 ? Math.round(fixed / (1 - cost)) : Infinity,
    marginRatePct: totals.revenue ? totals.netResult * 100 / totals.revenue : 0,
    lowestCash: months.reduce((min, m) => m.cashEnd < min.cashEnd ? m : min, months[0]),
    finalCash: cash,
  };
}

const KEY = 'kb.businessPlan';

@Injectable({ providedIn: 'root' })
export class BusinessPlanStore {
  readonly plan = signal<BusinessPlan>(readJson<BusinessPlan>(KEY) ?? defaultBusinessPlan());
  readonly forecast = computed(() => computeForecast(this.plan()));

  set(plan: BusinessPlan): void {
    this.plan.set(plan);
    writeJson(KEY, plan);
  }

  touch(): void {
    this.set({ ...this.plan(), charges: [...this.plan().charges] });
  }
}
