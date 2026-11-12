import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';

import { API_URL } from './config';
import { AuthResponse, User } from './models';

const TOKEN_KEY = 'kb.token';
const USER_KEY = 'kb.user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  readonly user = signal<User | null>(readJson<User>(USER_KEY));
  readonly isLoggedIn = computed(() => this.user() !== null && this.token() !== null);

  token(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  }

  login(email: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${API_URL}/auth/login`, { email, password })
      .pipe(tap(r => this.store(r)));
  }

  register(fullName: string, email: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${API_URL}/auth/register`, { fullName, email, password })
      .pipe(tap(r => this.store(r)));
  }

  logout(): void {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    } catch { /* stockage indisponible */ }
    this.user.set(null);
    this.router.navigate(['/login']);
  }

  private store(r: AuthResponse): void {
    try {
      localStorage.setItem(TOKEN_KEY, r.token);
      localStorage.setItem(USER_KEY, JSON.stringify(r.user));
    } catch { /* stockage indisponible */ }
    this.user.set(r.user);
  }
}

export function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : null;
  } catch {
    return null;
  }
}

export function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch { /* stockage indisponible */ }
}
