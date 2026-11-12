import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-guide',
  imports: [RouterLink],
  template: `
    <div class="page-header">
      <div>
        <div class="eyebrow">Guide d'utilisation</div>
        <h1 class="page-title">Bien démarrer en 5 minutes</h1>
      </div>
    </div>
    <div class="row g-3">
      @for (step of steps; track step.title; let i = $index) {
        <div class="col-md-6"><div class="card h-100"><div class="card-body">
          <div class="d-flex gap-3">
            <span class="step-number">{{ i + 1 }}</span>
            <div>
              <h2 class="h6">{{ step.title }}</h2>
              <p class="small text-body-secondary mb-2">{{ step.text }}</p>
              <a [routerLink]="step.link" class="small">Ouvrir <i class="bi bi-arrow-right"></i></a>
            </div>
          </div>
        </div></div></div>
      }
    </div>
    <div class="card mt-3"><div class="card-body small">
      <h2 class="h6">Où sont mes données ?</h2>
      <ul class="mb-0">
        <li><strong>Comptes, catégories, opérations, budgets et objectifs</strong> : enregistrés sur le serveur, liés à votre compte.</li>
        <li><strong>Répartition du salaire, prévisionnel d'entreprise, devise et taux</strong> : enregistrés dans ce navigateur. Utilisez <em>Sauvegarder</em> pour garder un fichier ou l'envoyer, et <em>Ouvrir</em> pour le recharger sur un autre appareil.</li>
        <li>Le bouton <i class="bi bi-printer"></i> en haut imprime la page affichée, ou l'enregistre en PDF.</li>
      </ul>
    </div></div>`,
})
export class GuidePage {
  readonly steps = [
    { title: 'Répartissez votre salaire', link: '/repartition',
      text: 'Saisissez vos revenus du mois, puis choisissez le Modèle Afrique ou la règle 50/30/20. Chaque poste est en pourcentage ou en montant fixe, et le reste à affecter se met à jour en direct.' },
    { title: 'Déclarez vos comptes', link: '/comptes',
      text: 'Espèces, Wave, Orange Money, Free Money, banque : indiquez le solde de départ de chacun.' },
    { title: 'Notez vos dépenses du mois', link: '/operations',
      text: 'Ajoutez chaque dépense ou revenu avec sa catégorie et son compte. Exportez en CSV pour Excel.' },
    { title: 'Fixez vos budgets', link: '/budgets',
      text: 'Un plafond par catégorie : vous êtes alerté à 80 % et en cas de dépassement.' },
    { title: 'Tontines & épargne', link: '/objectifs',
      text: 'Créez un objectif (Tabaski, rentrée, fonds d\'urgence) et suivez vos versements mois après mois.' },
    { title: 'Espace Entreprise', link: '/entreprise',
      text: 'Chiffre d\'affaires, coût d\'achat, charges fixes : obtenez le prévisionnel sur 12 mois, la trésorerie et le seuil de rentabilité.' },
  ];
}
