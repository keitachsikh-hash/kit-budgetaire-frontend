import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { SettingsService } from './core/settings.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: '<router-outlet />',
})
export class App {
  // Instancié au démarrage pour appliquer le thème enregistré.
  private readonly settings = inject(SettingsService);
}
