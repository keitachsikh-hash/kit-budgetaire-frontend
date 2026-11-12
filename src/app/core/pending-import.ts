import { Injectable, signal } from '@angular/core';

import { TransactionRequest } from './models';

/** Opérations lues sur une copie manuscrite, en attente de vérification dans la saisie multiple. */
export interface PendingImport {
  documentId: number;
  documentName: string;
  lines: TransactionRequest[];
  notes: Map<TransactionRequest, string>;
  aiNotes: string;
}

@Injectable({ providedIn: 'root' })
export class PendingImportStore {
  readonly pending = signal<PendingImport | null>(null);

  take(): PendingImport | null {
    const p = this.pending();
    this.pending.set(null);
    return p;
  }
}
