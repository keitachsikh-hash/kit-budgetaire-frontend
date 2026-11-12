import { Pipe, PipeTransform, inject } from '@angular/core';

import { SettingsService } from '../core/settings.service';

/** Affiche un montant (stocké en FCFA) dans la devise choisie dans les paramètres. */
@Pipe({ name: 'money', pure: false })
export class MoneyPipe implements PipeTransform {
  private readonly settings = inject(SettingsService);

  transform(value: number | null | undefined): string {
    return this.settings.format(value);
  }
}
