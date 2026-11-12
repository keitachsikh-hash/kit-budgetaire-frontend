# Kit Budgétaire — frontend (Angular 20 + Bootstrap 5)

Interface web du Kit Budgétaire. L'API Spring Boot se trouve dans `../budget-api`.

## Lancer

```bash
# 1. Backend (port 8080, profil dev avec base H2 et compte de démo)
cd ../budget-api && ./mvnw spring-boot:run

# 2. Frontend (port 4200)
npm install
npm start            # ou : npx ng serve
```

Ouvrir http://localhost:4200 et se connecter avec `demo@kit.sn` / `demo1234`.

L'URL de l'API est définie dans `src/app/core/config.ts`.

## Écrans

| Menu | Route | Données |
|---|---|---|
| Tableau de bord | `/` | API `/api/dashboard` |
| Répartition du salaire | `/repartition` | navigateur (+ fichier JSON) |
| Dépenses & revenus | `/operations` | API `/api/transactions` (export CSV) |
| Budgets du mois | `/budgets` | API `/api/budgets` |
| Tontines & épargne | `/objectifs` | API `/api/goals` |
| Comptes & Mobile Money | `/comptes` | API `/api/accounts` |
| Catégories | `/categories` | API `/api/categories` |
| Espace Entreprise | `/entreprise` | navigateur (+ fichier JSON) |
| Pays, devises & taux | `/parametres` | navigateur |

La répartition du salaire, le prévisionnel d'entreprise, la devise et les taux sont enregistrés dans le
`localStorage` du navigateur. Les boutons **Sauvegarder / Ouvrir** permettent de les exporter en fichier JSON et de les recharger.

Les montants sont saisis en FCFA ; la devise choisie en haut de l'écran ne change que l'affichage.

## Structure

```
src/app/
  core/       services (auth, API, paramètres), modèles, calculs (salary-plan.ts, business-plan.ts)
  shared/     pipe money, composant graphique Chart.js, téléchargement de fichiers
  features/   une page par dossier
```
