import { Injectable, computed, signal } from '@angular/core';

import { readJson, writeJson } from './auth.service';

export interface Rate { code: string; label: string; rate: number; fixed: boolean; }
export interface Settings { country: string; currency: string; theme: 'dark' | 'light'; rates: Rate[]; }

/** Valeur d'une unité de chaque devise en FCFA (XOF). Les parités fixes ne changent pas. */
export const DEFAULT_RATES: Rate[] = [
  { code: 'XOF', label: 'Franc CFA (UEMOA)', rate: 1, fixed: true },
  { code: 'XAF', label: 'Franc CFA (CEMAC)', rate: 1, fixed: true },
  { code: 'EUR', label: 'Euro', rate: 655.957, fixed: true },
  { code: 'USD', label: 'Dollar américain', rate: 586, fixed: false },
  { code: 'GNF', label: 'Franc guinéen', rate: 0.0643, fixed: false },
  { code: 'CDF', label: 'Franc congolais', rate: 0.2591, fixed: false },
  { code: 'MAD', label: 'Dirham marocain', rate: 62.6068, fixed: false },
  { code: 'KMF', label: 'Franc comorien', rate: 1.3333, fixed: true },
  { code: 'RWF', label: 'Franc rwandais', rate: 0.3818, fixed: false },
];

export const COUNTRIES: { name: string; currency: string }[] = [
  { name: 'Sénégal', currency: 'XOF' }, { name: 'Côte d\'Ivoire', currency: 'XOF' },
  { name: 'Mali', currency: 'XOF' }, { name: 'Burkina Faso', currency: 'XOF' },
  { name: 'Bénin', currency: 'XOF' }, { name: 'Togo', currency: 'XOF' },
  { name: 'Niger', currency: 'XOF' }, { name: 'Guinée-Bissau', currency: 'XOF' },
  { name: 'Cameroun', currency: 'XAF' }, { name: 'Gabon', currency: 'XAF' },
  { name: 'Congo', currency: 'XAF' }, { name: 'Tchad', currency: 'XAF' },
  { name: 'Centrafrique', currency: 'XAF' }, { name: 'Guinée équatoriale', currency: 'XAF' },
  { name: 'Guinée', currency: 'GNF' }, { name: 'RD Congo', currency: 'CDF' },
  { name: 'Maroc', currency: 'MAD' }, { name: 'Comores', currency: 'KMF' },
  { name: 'Rwanda', currency: 'RWF' }, { name: 'France', currency: 'EUR' },
];

const KEY = 'kb.settings';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  readonly settings = signal<Settings>(this.load());
  readonly currency = computed(() => this.settings().currency);

  constructor() {
    this.applyTheme();
  }

  update(patch: Partial<Settings>): void {
    this.settings.update(s => ({ ...s, ...patch }));
    writeJson(KEY, this.settings());
    this.applyTheme();
  }

  setRate(code: string, rate: number): void {
    this.update({ rates: this.settings().rates.map(r => r.code === code ? { ...r, rate } : r) });
  }

  resetRates(): void {
    this.update({ rates: DEFAULT_RATES.map(r => ({ ...r })) });
  }

  toggleTheme(): void {
    this.update({ theme: this.settings().theme === 'dark' ? 'light' : 'dark' });
  }

  rateOf(code: string): number {
    return this.settings().rates.find(r => r.code === code)?.rate ?? 1;
  }

  /** Convertit un montant d'une devise vers une autre en passant par le FCFA. */
  convert(amount: number, from: string, to: string): number {
    return amount * this.rateOf(from) / this.rateOf(to);
  }

  /** Formate un montant saisi en FCFA dans la devise d'affichage choisie. */
  format(amountXof: number | null | undefined, currency = this.currency()): string {
    const value = this.convert(Number(amountXof ?? 0), 'XOF', currency);
    const label = currency === 'XOF' || currency === 'XAF' ? 'FCFA' : currency;
    const digits = ['XOF', 'XAF', 'GNF', 'KMF', 'RWF', 'CDF'].includes(currency) ? 0 : 2;
    return `${value.toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits })} ${label}`;
  }

  private load(): Settings {
    const saved = readJson<Settings>(KEY);
    const rates = DEFAULT_RATES.map(d => ({ ...d, ...saved?.rates?.find(r => r.code === d.code), fixed: d.fixed }));
    return { country: saved?.country ?? 'Sénégal', currency: saved?.currency ?? 'XOF', theme: saved?.theme ?? 'dark', rates };
  }

  private applyTheme(): void {
    const theme = this.settings().theme;
    document.documentElement.setAttribute('data-bs-theme', theme);
    // Couleur de la barre d'état du téléphone.
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0a1a16' : '#ffffff');
  }
}
