import { Injectable, computed, signal } from '@angular/core';

import { readJson, writeJson } from './auth.service';

export interface IncomeLine { label: string; amount: number; }
export interface AllocationLine {
  label: string; mode: 'PERCENT' | 'AMOUNT'; value: number; saving: boolean; color: string;
}
export interface SalaryPlan { incomes: IncomeLine[]; allocations: AllocationLine[]; }

export interface ComputedLine extends AllocationLine { amount: number; share: number; }
export interface PlanSummary {
  lines: ComputedLine[]; totalIncome: number; allocated: number; savings: number;
  remaining: number; allocatedPercent: number; savingsRate: number;
}

const COLORS = ['#e8833a', '#2fa37a', '#3aa0e8', '#9b6be8', '#e8c13a', '#e85a5a', '#3ad1c4',
  '#c46be8', '#7fbf3a', '#e86bb0', '#5a7be8', '#b0a07a'];

const line = (label: string, mode: AllocationLine['mode'], value: number, saving: boolean, i: number):
  AllocationLine => ({ label, mode, value, saving, color: COLORS[i % COLORS.length] });

/** Modèle adapté aux foyers d'Afrique de l'Ouest (exemple de la vidéo). */
export function africaTemplate(): SalaryPlan {
  return {
    incomes: [
      { label: 'Salaire net principal', amount: 400000 },
      { label: 'Salaire du conjoint', amount: 180000 },
      { label: 'Commerce / activité secondaire', amount: 90000 },
    ],
    allocations: [
      line('Loyer', 'AMOUNT', 85000, false, 0),
      line('Électricité & eau', 'AMOUNT', 30000, false, 1),
      line('Alimentation & marché', 'PERCENT', 20, false, 2),
      line('Transport', 'PERCENT', 8, false, 3),
      line('Communication & Mobile Money', 'AMOUNT', 18000, false, 4),
      line('Scolarité & fournitures', 'PERCENT', 8, false, 5),
      line('Santé', 'AMOUNT', 20000, false, 6),
      line('Famille élargie & cérémonies', 'PERCENT', 8, false, 7),
      line('Tontine du quartier', 'AMOUNT', 50000, true, 8),
      line('Épargne (banque / mobile money)', 'AMOUNT', 40000, true, 9),
      line('Remboursement de dettes', 'AMOUNT', 35000, false, 10),
      line('Loisirs & personnel', 'PERCENT', 4, false, 11),
    ],
  };
}

/** Règle 50/30/20 : besoins, envies, épargne. */
export function rule503020(incomes: IncomeLine[]): SalaryPlan {
  return {
    incomes,
    allocations: [
      line('Besoins : loyer & charges', 'PERCENT', 25, false, 0),
      line('Besoins : alimentation', 'PERCENT', 15, false, 2),
      line('Besoins : transport & communication', 'PERCENT', 10, false, 3),
      line('Envies : loisirs & sorties', 'PERCENT', 10, false, 11),
      line('Envies : famille & cérémonies', 'PERCENT', 10, false, 7),
      line('Envies : shopping', 'PERCENT', 10, false, 9),
      line('Épargne & tontine', 'PERCENT', 20, true, 8),
    ],
  };
}

/**
 * Calcule le montant de chaque poste et les totaux.
 * Le taux d'épargne compte l'épargne prévue et le reste non affecté.
 */
export function computePlan(plan: SalaryPlan): PlanSummary {
  const totalIncome = plan.incomes.reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const lines = plan.allocations.map(a => {
    const value = Number(a.value) || 0;
    const amount = Math.round(a.mode === 'PERCENT' ? totalIncome * value / 100 : value);
    return { ...a, amount, share: totalIncome ? amount * 100 / totalIncome : 0 };
  });
  const allocated = lines.reduce((s, l) => s + l.amount, 0);
  const savings = lines.filter(l => l.saving).reduce((s, l) => s + l.amount, 0);
  const remaining = totalIncome - allocated;
  return {
    lines, totalIncome, allocated, savings, remaining,
    allocatedPercent: totalIncome ? allocated * 100 / totalIncome : 0,
    savingsRate: totalIncome ? (savings + Math.max(remaining, 0)) * 100 / totalIncome : 0,
  };
}

const KEY = 'kb.salaryPlan';

@Injectable({ providedIn: 'root' })
export class SalaryPlanStore {
  readonly plan = signal<SalaryPlan>(readJson<SalaryPlan>(KEY) ?? africaTemplate());
  readonly summary = computed(() => computePlan(this.plan()));

  set(plan: SalaryPlan): void {
    this.plan.set(plan);
    writeJson(KEY, plan);
  }

  /** À appeler après une modification en place (ngModel) des lignes. */
  touch(): void {
    this.set({ incomes: [...this.plan().incomes], allocations: [...this.plan().allocations] });
  }

  nextColor(): string {
    return COLORS[this.plan().allocations.length % COLORS.length];
  }
}
