import { Routes } from '@angular/router';

import { authGuard } from './core/auth.guard';
import { LoginPage } from './features/auth/login';
import { RegisterPage } from './features/auth/register';
import { LayoutComponent } from './features/layout/layout';

export const routes: Routes = [
  { path: 'login', component: LoginPage, title: 'Connexion · Kit Budgétaire' },
  { path: 'register', component: RegisterPage, title: 'Inscription · Kit Budgétaire' },
  {
    path: '', component: LayoutComponent, canActivate: [authGuard],
    children: [
      { path: '', title: 'Tableau de bord · Kit Budgétaire',
        loadComponent: () => import('./features/dashboard/dashboard').then(m => m.DashboardPage) },
      { path: 'repartition', title: 'Répartition du salaire · Kit Budgétaire',
        loadComponent: () => import('./features/salary-plan/salary-plan').then(m => m.SalaryPlanPage) },
      { path: 'operations', title: 'Dépenses & revenus · Kit Budgétaire',
        loadComponent: () => import('./features/transactions/transactions').then(m => m.TransactionsPage) },
      { path: 'budgets', title: 'Budgets · Kit Budgétaire',
        loadComponent: () => import('./features/budgets/budgets').then(m => m.BudgetsPage) },
      { path: 'objectifs', title: 'Tontines & épargne · Kit Budgétaire',
        loadComponent: () => import('./features/goals/goals').then(m => m.GoalsPage) },
      { path: 'archives', title: 'Copies manuscrites · Kit Budgétaire',
        loadComponent: () => import('./features/archives/archives').then(m => m.ArchivesPage) },
      { path: 'comptes', title: 'Comptes · Kit Budgétaire',
        loadComponent: () => import('./features/accounts/accounts').then(m => m.AccountsPage) },
      { path: 'categories', title: 'Catégories · Kit Budgétaire',
        loadComponent: () => import('./features/categories/categories').then(m => m.CategoriesPage) },
      { path: 'entreprise', title: 'Espace Entreprise · Kit Budgétaire',
        loadComponent: () => import('./features/business/business').then(m => m.BusinessPage) },
      { path: 'parametres', title: 'Paramètres · Kit Budgétaire',
        loadComponent: () => import('./features/settings/settings').then(m => m.SettingsPage) },
      { path: 'guide', title: 'Guide · Kit Budgétaire',
        loadComponent: () => import('./features/guide/guide').then(m => m.GuidePage) },
    ],
  },
  { path: '**', redirectTo: '' },
];
