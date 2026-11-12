import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnDestroy, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';

import { ApiService, errorMessage } from '../../core/api.service';
import { Page, ScannedDocument } from '../../core/models';
import { PendingImportStore } from '../../core/pending-import';
import { blobToDataUrl, resizeImage } from '../../shared/image';
import { fromExtraction } from '../transactions/transaction-import';

interface UploadItem { name: string; state: 'pending' | 'sending' | 'done' | 'error'; error?: string; }

@Component({
  selector: 'app-archives',
  imports: [FormsModule, DatePipe, DecimalPipe],
  template: `
    <div class="page-header">
      <div>
        <div class="eyebrow">Espace Particulier · anciennes données</div>
        <h1 class="page-title">Copies manuscrites</h1>
        <p class="text-body-secondary mb-0">Photographiez vos cahiers de comptes : ils sont archivés en lieu sûr, puis lus pour créer vos opérations.</p>
      </div>
    </div>

    @if (error()) { <div class="alert alert-danger d-flex"><span class="flex-grow-1">{{ error() }}</span>
      <button type="button" class="btn-close" (click)="error.set('')" aria-label="Fermer"></button></div> }
    @if (aiEnabled() === false) {
      <div class="alert alert-warning small"><i class="bi bi-info-circle me-1"></i>
        La lecture automatique n'est pas activée sur ce serveur (clé <code>ANTHROPIC_API_KEY</code> manquante).
        Vos copies sont tout de même archivées et vous pouvez saisir les lignes en les regardant.</div>
    }

    <!-- Envoi -->
    <div class="card mb-3 d-print-none"><div class="card-body">
      <div class="upload-zone" [class.dragging]="dragging()"
           (dragover)="$event.preventDefault(); dragging.set(true)" (dragleave)="dragging.set(false)"
           (drop)="onDrop($event)">
        <i class="bi bi-journal-text upload-icon"></i>
        <div class="fw-semibold mb-1">Ajoutez une ou plusieurs pages</div>
        <div class="small text-body-secondary mb-3">Photo (JPEG, PNG, HEIC) ou PDF · 15 Mo maximum par fichier · une page par photo, bien éclairée et à plat</div>
        <div class="d-flex gap-2 justify-content-center flex-wrap">
          <button class="btn btn-accent d-lg-none" (click)="camera.click()" [disabled]="busy()"><i class="bi bi-camera me-1"></i>Prendre une photo</button>
          <button class="btn btn-outline-secondary" (click)="picker.click()" [disabled]="busy()"><i class="bi bi-images me-1"></i>Choisir des fichiers</button>
        </div>
        <input #camera type="file" hidden accept="image/*" capture="environment" (change)="onPick($event)">
        <input #picker type="file" hidden multiple accept="image/*,application/pdf" (change)="onPick($event)">
        <input class="form-control form-control-sm mt-3 mx-auto upload-title" [(ngModel)]="title"
               placeholder="Titre (facultatif), ex. « Cahier boutique – mars 2024 »" aria-label="Titre des copies">
      </div>
      @if (uploads().length) {
        <ul class="list-unstyled small mt-3 mb-0">
          @for (u of uploads(); track $index) {
            <li class="d-flex align-items-center gap-2 py-1">
              @switch (u.state) {
                @case ('sending') { <span class="spinner-border spinner-border-sm text-accent"></span> }
                @case ('done') { <i class="bi bi-check-circle-fill text-success"></i> }
                @case ('error') { <i class="bi bi-x-circle-fill text-danger"></i> }
                @default { <i class="bi bi-clock text-body-secondary"></i> }
              }
              <span class="text-truncate">{{ u.name }}</span>
              @if (u.error) { <span class="text-danger">— {{ u.error }}</span> }
            </li>
          }
        </ul>
      }
    </div></div>

    <!-- Liste -->
    @if (page(); as pg) {
      <div class="d-flex flex-column gap-2">
        @for (d of pg.content; track d.id) {
          <div class="card doc-card"><div class="card-body d-flex gap-3 align-items-center">
            <button class="doc-thumb" (click)="view(d)" [attr.aria-label]="'Voir ' + (d.title || d.fileName)">
              @if (d.thumbnail) { <img [src]="d.thumbnail" alt=""> }
              @else { <i class="bi" [class.bi-file-earmark-pdf]="isPdf(d)" [class.bi-image]="!isPdf(d)"></i> }
            </button>
            <div class="flex-grow-1 min-w-0">
              <div class="fw-semibold text-truncate">{{ d.title || d.fileName }}</div>
              <div class="small text-body-secondary text-truncate">
                {{ d.createdAt | date: 'd MMM y, HH:mm' }} · {{ d.sizeBytes / 1024 | number: '1.0-0' }} Ko
              </div>
              <div class="mt-1">
                @switch (d.status) {
                  @case ('ARCHIVED') { <span class="badge text-bg-secondary">Archivée</span> }
                  @case ('EXTRACTED') { <span class="badge text-bg-warning">Lue · {{ d.extractedCount }} ligne(s)</span> }
                  @case ('IMPORTED') { <span class="badge text-bg-success">{{ d.importedCount }} opération(s) enregistrée(s)</span> }
                }
              </div>
            </div>
            <div class="d-flex flex-column flex-sm-row gap-1 align-items-stretch">
              <button class="btn btn-sm btn-accent text-nowrap" (click)="read(d)" [disabled]="reading() !== null || aiEnabled() === false"
                      title="Lire les opérations de cette copie">
                @if (reading() === d.id) { <span class="spinner-border spinner-border-sm me-1"></span>Lecture… }
                @else { <i class="bi bi-magic me-1"></i>Lire }
              </button>
              <div class="d-flex gap-1">
                <button class="btn btn-sm btn-outline-secondary flex-fill" (click)="view(d)" aria-label="Voir"><i class="bi bi-eye"></i></button>
                <button class="btn btn-sm btn-outline-danger flex-fill" (click)="remove(d)" aria-label="Supprimer"><i class="bi bi-trash"></i></button>
              </div>
            </div>
          </div></div>
        } @empty {
          <div class="card"><div class="card-body text-center text-body-secondary py-4">
            Aucune copie archivée pour l'instant.</div></div>
        }
      </div>
      @if (reading() !== null) {
        <p class="small text-body-secondary mt-2"><i class="bi bi-hourglass-split me-1"></i>La lecture d'une page prend en général 20 à 60 secondes.</p>
      }
      @if (pg.totalPages > 1) {
        <nav class="pager" aria-label="Pages des copies">
          <span class="small text-body-secondary">{{ pg.page * pg.size + 1 }}–{{ pg.page * pg.size + pg.content.length }} sur {{ pg.totalElements }}</span>
          <div class="btn-group btn-group-sm">
            <button class="btn btn-outline-secondary" [disabled]="pg.page === 0" (click)="load(pg.page - 1)" aria-label="Page précédente"><i class="bi bi-chevron-left"></i></button>
            @for (n of pageNumbers(pg.page, pg.totalPages); track n) {
              <button class="btn" [class.btn-accent]="n === pg.page" [class.btn-outline-secondary]="n !== pg.page" (click)="load(n)">{{ n + 1 }}</button>
            }
            <button class="btn btn-outline-secondary" [disabled]="pg.page + 1 >= pg.totalPages" (click)="load(pg.page + 1)" aria-label="Page suivante"><i class="bi bi-chevron-right"></i></button>
          </div>
        </nav>
      }
    } @else if (!error()) { <div class="text-center py-5"><div class="spinner-border text-accent"></div></div> }

    <!-- Visionneuse -->
    @if (viewer(); as v) {
      <div class="modal d-block" tabindex="-1" (click)="closeViewer()">
        <div class="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable" (click)="$event.stopPropagation()">
          <div class="modal-content">
            <div class="modal-header">
              <h2 class="modal-title h6 text-truncate">{{ v.doc.title || v.doc.fileName }}</h2>
              <button type="button" class="btn-close" (click)="closeViewer()" aria-label="Fermer"></button>
            </div>
            <div class="modal-body text-center p-2">
              @if (!v.url) { <div class="spinner-border text-accent my-5"></div> }
              @else if (isPdf(v.doc)) { <object [attr.data]="v.url" type="application/pdf" class="doc-pdf">
                <a [href]="v.url" target="_blank" rel="noopener">Ouvrir le PDF</a></object> }
              @else { <img [src]="v.url" class="doc-full" [alt]="v.doc.fileName"> }
            </div>
            <div class="modal-footer">
              @if (v.url) { <a class="btn btn-outline-secondary" [href]="v.url" [download]="v.doc.fileName"><i class="bi bi-download me-1"></i>Télécharger</a> }
              <button class="btn btn-accent" (click)="closeViewer(); read(v.doc)" [disabled]="aiEnabled() === false"><i class="bi bi-magic me-1"></i>Lire les opérations</button>
            </div>
          </div>
        </div>
      </div>
      <div class="modal-backdrop show"></div>
    }`,
})
export class ArchivesPage implements OnDestroy {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly pendingImport = inject(PendingImportStore);

  readonly page = signal<Page<ScannedDocument> | null>(null);
  readonly error = signal('');
  readonly aiEnabled = signal<boolean | null>(null);
  readonly uploads = signal<UploadItem[]>([]);
  readonly busy = signal(false);
  readonly dragging = signal(false);
  readonly reading = signal<number | null>(null);
  readonly viewer = signal<{ doc: ScannedDocument; url: string | null } | null>(null);
  title = '';

  constructor() {
    this.api.aiStatus().subscribe({ next: s => this.aiEnabled.set(s.enabled), error: () => this.aiEnabled.set(null) });
    this.load(0);
  }

  ngOnDestroy(): void {
    this.closeViewer();
  }

  load(page: number): void {
    this.api.documents(page).subscribe({
      next: p => {
        if (!p.content.length && p.page > 0) { this.load(p.page - 1); return; }
        this.page.set(p);
      },
      error: err => this.error.set(errorMessage(err)),
    });
  }

  onPick(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    this.send(files);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    this.send(Array.from(event.dataTransfer?.files ?? []));
  }

  /** Envoie les fichiers un par un : les photos sont réduites (2000 px) avant l'envoi pour aller plus vite. */
  async send(files: File[]): Promise<void> {
    if (!files.length || this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    const items: UploadItem[] = files.map(f => ({ name: f.name, state: 'pending' }));
    this.uploads.set(items);
    const refresh = () => this.uploads.set([...items]);
    for (const [i, file] of files.entries()) {
      items[i].state = 'sending'; refresh();
      try {
        let body: Blob = file;
        let name = file.name;
        let thumbnail: string | null = null;
        if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
          body = file.type ? file : new Blob([file], { type: 'application/pdf' });
        } else {
          body = await resizeImage(file, 2000, 0.85);
          name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
          thumbnail = await blobToDataUrl(await resizeImage(file, 240, 0.7));
        }
        const title = files.length > 1 && this.title ? `${this.title} (${i + 1}/${files.length})` : this.title;
        await new Promise<void>((resolve, reject) => this.api.uploadDocument(body, name, title, thumbnail)
          .subscribe({ next: () => resolve(), error: reject }));
        items[i].state = 'done';
      } catch (err) {
        items[i].state = 'error';
        items[i].error = err instanceof Error ? err.message : errorMessage(err);
      }
      refresh();
    }
    this.busy.set(false);
    this.title = '';
    this.load(0);
  }

  view(doc: ScannedDocument): void {
    this.closeViewer();
    this.viewer.set({ doc, url: null });
    this.api.documentFile(doc.id).subscribe({
      next: blob => {
        if (this.viewer()?.doc.id === doc.id) this.viewer.set({ doc, url: URL.createObjectURL(blob) });
      },
      error: err => { this.viewer.set(null); this.error.set(errorMessage(err)); },
    });
  }

  closeViewer(): void {
    const url = this.viewer()?.url;
    if (url) URL.revokeObjectURL(url);
    this.viewer.set(null);
  }

  /** Lecture par Claude, puis ouverture de la saisie multiple pré-remplie pour vérification. */
  read(doc: ScannedDocument): void {
    if (this.reading() !== null) return;
    this.reading.set(doc.id);
    this.error.set('');
    forkJoin({
      extraction: this.api.extractDocument(doc.id),
      categories: this.api.categories(),
      accounts: this.api.accounts(),
    }).subscribe({
      next: ({ extraction, categories, accounts }) => {
        this.reading.set(null);
        const lines = fromExtraction(extraction.lines ?? [], categories, accounts);
        if (!lines.length) {
          this.error.set(`Aucune opération reconnue sur « ${doc.title || doc.fileName} ».`
            + (extraction.notes ? ` ${extraction.notes}` : ''));
          this.load(this.page()?.page ?? 0);
          return;
        }
        const notes = new Map(lines.filter(l => l.warning).map(l => [l.line, l.warning!]));
        this.pendingImport.pending.set({
          documentId: doc.id, documentName: doc.title || doc.fileName,
          lines: lines.map(l => l.line), notes, aiNotes: extraction.notes ?? '',
        });
        this.router.navigate(['/operations'], { queryParams: { copie: doc.id } });
      },
      error: err => { this.reading.set(null); this.error.set(errorMessage(err)); },
    });
  }

  remove(doc: ScannedDocument): void {
    if (!confirm(`Supprimer définitivement la copie « ${doc.title || doc.fileName} » ? Les opérations déjà enregistrées sont conservées.`)) return;
    this.api.deleteDocument(doc.id).subscribe({
      next: () => this.load(this.page()?.page ?? 0),
      error: err => this.error.set(errorMessage(err)),
    });
  }

  isPdf(doc: ScannedDocument): boolean {
    return doc.contentType === 'application/pdf';
  }

  pageNumbers(current: number, total: number): number[] {
    const from = Math.max(0, Math.min(current - 2, total - 5));
    return Array.from({ length: Math.min(5, total) }, (_, k) => from + k);
  }
}
