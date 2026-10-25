# Plan de projet - Plateforme de gestion de cabinet multidisciplinaire

## Objectif

Concevoir et développer une plateforme web collaborative de gestion des dossiers, procédures, actes, documents, échéances et facturation pour un cabinet regroupant avocats, huissiers de justice, assistants juridiques et fonctions administratives au Sénégal.

## Livrables attendus

- Architecture technique et modèle de données
- Socle sécurisé multi-cabinet (Phase 1)
- Modules métier (dossiers, clients, documents, workflow)
- Module huissier (Phase 3)
- Facturation et espace client (Phase 4)
- Industrialisation (OCR, signature, PWA, API)

## Découpage en phases

| Phase | Nom | Durée estimée | Objectif principal |
|-------|-----|---------------|--------------------|
| 0 | Fondation | 2 semaines | Architecture, stack, maquettes, conformité CDP |
| 1 | Socle sécurisé | 6 semaines | Utilisateurs, rôles, cabinets, clients, dossiers, documents, audit |
| 2 | Travail juridique | 5 semaines | Tâches, échéances, audiences, workflow, modèles d'actes, validation, notifications, espace client |
| 3 | Activités d'huissier | 4 semaines | Missions, significations, constats, PV, saisies, frais, retours |
| 4 | Gestion financière | 4 semaines | Lettres de mission, devis, factures, provisions, paiements, relances, rapports |
| 5 | Industrialisation | 6 semaines | Recherche plein texte, OCR, signature électronique, PWA, API, tableaux de bord, archivage |
| 6 | Recette & déploiement | 4 semaines | Tests, conformité, formation, mise en production, documentation |

**Durée totale estimée : 31 semaines (~8 mois)**

## Jalons clés

| Jalon | Date indicative | Description |
|-------|-----------------|-------------|
| J1 | Semaine 2 | Architecture validée, maquettes approuvées |
| J2 | Semaine 8 | Socle fonctionnel en recette interne |
| J3 | Semaine 13 | Workflow juridique et espace client opérationnels |
| J4 | Semaine 17 | Module huissier et missions intégrés |
| J5 | Semaine 21 | Facturation et paiements en test |
| J6 | Semaine 27 | Version bêta complète avec OCR et signature |
| J7 | Semaine 31 | Mise en production et formation |

## Organisation de l'équipe suggérée

| Rôle | Implication |
|------|-------------|
| Lead tech / architecte | Tout le projet |
| Développeurs backend | 2 ressources dès le socle |
| Développeurs frontend | 2 ressources dès la phase 1 |
| DevSecOps | Phases 0, 1, 5, 6 |
| QA / testeur | À partir de la phase 2 |
| Juriste métier / référent cabinet | Validation métier et conformité |

## Stack recommandée

- **Backend** : Node.js (NestJS) ou PHP (Symfony/Laravel)
- **Base de données** : PostgreSQL (données métier) + S3 ou MinIO (documents)
- **Frontend** : React ou Vue.js, TypeScript
- **Authentification** : OAuth2 / OpenID Connect, MFA via TOTP
- **Chiffrement** : AES-256 au repos, TLS 1.3 en transit
- **Audit** : journal d'événements immuable
- **Hébergement** : VPS/cloud privé avec sauvegardes géo-redondantes

## Risques principaux

| Risque | Mitigation |
|--------|------------|
| Conformité CDP sénégalaise | Audit réglementaire dès la phase 0 |
| Fuite de données confidentielles | Chiffrement, RBAC strict, audit, tests d'intrusion |
| Complexité des workflows | Ateliers métier et prototypage rapide |
| Adoption par les utilisateurs | Formation, ergonomie, espace client simple |

## Budget approximatif (indicatif)

Les postes à prévoir : développement, infrastructure, hébergement sécurisé, prestataire de signature électronique, licence OCR, audits de sécurité, formation et maintenance.

## Prochaines étapes immédiates

1. Valider l'architecture proposée dans `ARCHITECTURE.md`
2. Choisir le stack définitif
3. Planifier l'atelier de collecte des scénarios métier prioritaires
4. Démarrer la phase 0 avec la rédaction des spécifications techniques détaillées
