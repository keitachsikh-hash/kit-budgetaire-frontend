import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { errorMessage } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-login',
  imports: [FormsModule, RouterLink],
  template: `
    <div class="auth-page">
      <div class="auth-card card shadow-lg">
        <div class="card-body p-4 p-md-5">
          <div class="text-center mb-4">
            <div class="brand-mark mx-auto mb-3"><i class="bi bi-wallet2"></i></div>
            <h1 class="h3 brand-title mb-1">Kit Budgétaire</h1>
            <p class="text-body-secondary mb-0">Où va chaque franc de votre salaire ?</p>
          </div>
          @if (error()) { <div class="alert alert-danger py-2">{{ error() }}</div> }
          <form (ngSubmit)="submit()" #f="ngForm">
            <div class="mb-3">
              <label class="form-label" for="email">Email</label>
              <input id="email" class="form-control" type="email" name="email" [(ngModel)]="email" required autocomplete="username">
            </div>
            <div class="mb-4">
              <label class="form-label" for="password">Mot de passe</label>
              <input id="password" class="form-control" type="password" name="password" [(ngModel)]="password" required autocomplete="current-password">
            </div>
            <button class="btn btn-accent w-100" [disabled]="loading() || f.invalid">
              @if (loading()) { <span class="spinner-border spinner-border-sm me-2"></span> }
              Se connecter
            </button>
          </form>
          <div class="small text-body-secondary text-center mt-3">
            Compte de démonstration : <code>demo&#64;kit.sn</code> / <code>demo1234</code>
          </div>
          <hr>
          <p class="text-center mb-0">Pas encore de compte ? <a routerLink="/register">Créer un compte</a></p>
        </div>
      </div>
    </div>`,
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  email = '';
  password = '';
  readonly loading = signal(false);
  readonly error = signal('');

  submit(): void {
    this.loading.set(true);
    this.error.set('');
    this.auth.login(this.email, this.password).subscribe({
      next: () => this.router.navigate(['/']),
      error: err => { this.error.set(errorMessage(err)); this.loading.set(false); },
    });
  }
}
