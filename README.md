# Nos liens, notre histoire

Next.js 16 / React 19, en français : récit familial anonymisé situé en Asie, ressources sourcées, sondage citoyen, statistiques modérées et préparation d’une pétition.

## Architecture

- **Vercel** pour Next.js et les fonctions serveur ; aucune réponse n’est stockée sur le disque éphémère.
- **PostgreSQL Neon** via Vercel Marketplace, **Prisma ORM 7** et l’adaptateur PostgreSQL avec un petit pool par instance.
- **Better Auth** pour l’authentification e-mail/mot de passe, sessions en base et cookies HttpOnly/SameSite. Inscription publique désactivée ; les routes d’authentification exposées se limitent à la connexion, la déconnexion et la lecture de session.
- Administration dans `/admin`, connexion dans `/admin/connexion`. Chaque lecture privée et chaque Server Action vérifie la session **et** le compte actif en base. Aucun contrôle ne repose uniquement sur la présence d’un cookie.
- Statistiques publiques dans `/statistiques`, publication désactivée par défaut.

Node.js **22.18+** est requis. Les commandes de test et les scripts utilisent le support TypeScript natif de Node.

## Développement local

1. Copier `.env.example` vers `.env` (ce dernier est ignoré par Git).
2. Renseigner `DATABASE_URL` et `DIRECT_URL` avec une base PostgreSQL de développement.
3. Définir `SITE_ORIGIN=http://localhost:3000` et `BETTER_AUTH_URL` avec la même valeur.
4. Générer deux secrets différents d’au moins 32 caractères pour `BETTER_AUTH_SECRET` et `CRON_SECRET` : par exemple avec `openssl rand -base64 48`. Ne jamais les commiter.

```sh
npm ci
npm run db:migrate
npm run dev
```

L’accueil et le récit sont statiques ; la collecte, les statistiques et l’authentification nécessitent la base et les variables renseignées. Les erreurs de base sont affichées explicitement, sans fausses statistiques à zéro ni faux succès de collecte.

### Premier administrateur

Renseigner temporairement `BOOTSTRAP_ADMIN_EMAIL` et `BOOTSTRAP_ADMIN_PASSWORD` dans le fichier `.env`, avec un mot de passe unique de **16 à 128 caractères** :

```sh
npm run admin:bootstrap
```

Cette commande refuse de fonctionner dès qu’un compte existe et utilise un verrou transactionnel pour éviter deux initialisations concurrentes. Elle n’affiche jamais le mot de passe. Retirer ensuite ces deux variables ; ne pas les ajouter à Vercel.

Les administrateurs créent d’autres administrateurs dans l’espace privé, peuvent les désactiver/réactiver, réinitialiser leurs mots de passe et changer leur propre mot de passe après vérification du précédent. La réinitialisation et la désactivation révoquent les sessions du compte. Il n’existe ni inscription publique ni récupération automatique par courriel : conserver au moins deux comptes habilités et un accès d’exploitation sécurisé à la base.

## Déploiement Vercel + Neon

1. Importer le dépôt dans Vercel, preset **Next.js**, Node.js 22.x.
2. Ajouter **Neon Postgres** depuis Vercel Marketplace. Choisir des régions cohérentes, idéalement européennes, et vérifier les engagements contractuels et transferts.
3. Utiliser une branche/base **distincte** pour les Preview et le développement. Ne pas connecter des déploiements non validés aux réponses de production.
4. Définir les variables Vercel :
   - `DATABASE_URL` : URL Neon **poolée**, TLS activé ;
   - `DIRECT_URL` : URL **directe** pour les migrations ;
   - `SITE_ORIGIN` : origine publique exacte, par exemple `https://votre-site.fr`, sans barre finale ;
   - `BETTER_AUTH_URL` : même origine ;
   - `BETTER_AUTH_SECRET` : secret aléatoire, stable, au moins 32 caractères ;
   - `CRON_SECRET` : secret aléatoire distinct, au moins 32 caractères.
5. Appliquer `npm run db:migrate` **depuis un environnement d’exploitation sécurisé**, avec `DIRECT_URL` de la base cible, avant le déploiement de la nouvelle version. Les migrations sont versionnées. Elles ne sont pas exécutées automatiquement par les builds Preview.
6. Le build Vercel exécute `npm run build` (génération Prisma puis compilation Next.js). Le `postinstall` génère également le client Prisma.
7. Exécuter une fois le bootstrap depuis un environnement sécurisé connecté à la bonne base, sans exposer les variables de bootstrap au déploiement.
8. Tester `/admin/connexion`, une contribution de test, la modération, le retrait par code et `/statistiques` avant d’ouvrir le site.

`vercel.json` prévoit le cron de rétention quotidien à 03:00 UTC et les en-têtes de protection des pages privées. Vercel transmet `CRON_SECRET` comme Bearer token ; sans secret valide, la maintenance est refusée. Vérifier dans le tableau de bord que le cron est réellement exécuté et superviser les échecs.

Les sessions durent douze heures, sans cache de session côté client. Les limites d’écriture du sondage et les quotas de connexion sont stockés en PostgreSQL et partagés entre les instances serverless. Une protection de trafic supplémentaire par Vercel Firewall reste nécessaire pour une ouverture publique ; le sondage n’a pas de CAPTCHA et ne garantit pas une seule réponse par personne.

## Collecte, confidentialité et publication

### Réponses

`POST /api/sondage` valide les 101 départements, les options de non-réponse, les limites de texte et les consentements :

- département de résidence et ASE distincts ;
- juridiction déclarée facultative (200 caractères) ;
- juges et intervenants sociaux facultatifs (600 caractères par champ), strictement privés ;
- consentement général à la collecte et aux statistiques, accord distinct lorsque des noms professionnels sont fournis ;
- aucun document de procédure, récit d’accusation, identité de mineur ou donnée de santé ne doit être saisi.

Un code aléatoire de suppression est généré dans le navigateur. Seule son empreinte SHA-256 est stockée ; l’identifiant interne de la contribution est différent. Une nouvelle tentative identique avec le même code est idempotente, même en concurrence. Les doublons entre plusieurs visites restent possibles.

`DELETE /api/sondage` retire la réponse et ses champs privés avec le code. La page `/confidentialite` contient ce formulaire. Aucun endpoint public ne liste les réponses, les noms ou les empreintes. Aucun export public de données brutes n’est proposé.

### Modération et statistiques

- Statuts `PENDING`, `APPROVED`, `REJECTED` ; seuls `APPROVED` et les enregistrements non expirés sont comptés.
- Les juridictions saisies par les participants ne deviennent **jamais** automatiquement des libellés publics. L’administrateur vérifie un nom institutionnel, l’ajoute au référentiel et effectue le rattachement.
- Les juridictions peuvent être renommées ou supprimées ; leur suppression détache les contributions sans les effacer.
- Le seuil public est fixe à **10 réponses par groupe**, avec résidence, ASE et juridiction affichées séparément, sans tableau croisé, petit effectif ou total général.
- Les options « inconnu », « hors de France », « non-réponse » ne sont pas affichées comme départements.
- Les noms des juges et intervenants ne participent à aucune requête de statistiques publiques. Aucun classement de personnes.
- La publication est activée explicitement dans l’administration. Les requêtes publiques sont effectuées à la demande et dans une transaction cohérente ; un retrait est pris en compte lors du prochain chargement.
- La modération ne certifie **ni une faute, ni un abus, ni la représentativité** des déclarations. Les statistiques ne mesurent pas le taux de placement abusif.
- Le lien de pétition et son titre sont configurables dans l’administration. HTTPS uniquement. Tant qu’aucun lien n’est défini, la pétition est « en préparation ». Le sondage ne constitue pas une signature et n’envoie aucune donnée à une plateforme de pétition.

### Rétention

Les réponses expirent après 365 jours et sont exclues des requêtes dès l’expiration. Le cron supprime les réponses expirées, sessions et vérifications expirées, quotas périmés et journaux anciens. La maintenance manuelle utilise :

```sh
npm run survey:prune
```

Prévoir une politique d’effacement des sauvegardes Neon et de traitement des demandes concernant les tiers nommés. Supprimer une réponse du serveur ne peut pas effacer rétroactivement les copies de chiffres déjà publiées.

### Avant ouverture publique — indispensable

- Compléter l’identité de l’éditeur, le responsable de traitement, son contact, les prestataires, les localisations et les durées des sauvegardes dans la page de confidentialité.
- Faire valider la nécessité, la proportionnalité et la **base légale du traitement de noms de tiers**. L’accord du participant ne vaut pas consentement des professionnels cités. Documenter l’information de ces personnes, les contestations, leurs droits et, si nécessaire, une analyse d’impact.
- Faire relire le témoignage et les contenus éditoriaux. L’anonymisation des noms n’empêche pas toute reconnaissance indirecte.
- Former les modérateurs, limiter les accès à Neon et Vercel, protéger les comptes de ces plateformes par MFA et définir une procédure d’incident.
- Ne pas considérer le seuil de dix comme une garantie absolue contre la réidentification : évaluer aussi les petits territoires et les publications successives.
- Les métadonnées restent en `noindex` tant que ces éléments ne sont pas validés. Ce n’est pas un contrôle d’accès : garder les Preview et la préparation derrière une protection de déploiement Vercel.
- Le passage de l’ancienne collecte sur fichiers à PostgreSQL ne migre pas automatiquement d’éventuelles anciennes réponses. La nouvelle finalité et les champs nominatifs exigent un consentement à jour ; ne pas importer les anciennes réponses dans les statistiques sans base légale appropriée.

## Sources et ligne éditoriale

Le site distingue le vécu familial, les abus dénoncés et les constats institutionnels :

- [Rapport de l’Assemblée nationale n° 1200, tome I, 1er avril 2025](https://www.assemblee-nationale.fr/dyn/17/rapports/cease/l17b1200-ti_rapport-enquete), sur les manquements des politiques publiques de protection de l’enfance.
- [UNICEF, Pathways to Better Protection](https://www.unicef.org/eca/reports/pathways-better-protection), notamment sur les limites des statistiques de prise en charge et des comparaisons internationales.

Aucune étude comparative vérifiable établissant un classement européen des **placements abusifs** en France n’a été identifiée pendant cette réalisation. Un taux de placement n’est pas un taux d’abus. Le site ne présente pas de classement non étayé comme un fait.

Le partage Facebook partage l’adresse du site ; le lien presse pointe explicitement vers l’accueil du journal tant que l’adresse de l’article précis n’a pas été fournie.

## Vérifications

```sh
npm test
npm run lint
npm run build
```

Tests PostgreSQL et HTTP avec des données entièrement synthétiques, sur une base **locale jetable distincte** nommée `ase_app_test`, au port de votre choix :

```sh
DATABASE_URL=postgresql://USER@127.0.0.1:PORT/ase_app_test npm run db:migrate
TEST_DATABASE_URL=postgresql://USER@127.0.0.1:PORT/ase_app_test npm run test:http
```

Le port HTTP 3118 doit être libre. Ce test démarre et arrête son propre serveur Next.js de production, vérifie les limites d’entrée, les consentements, l’authentification, les accès refusés, les véritables Server Actions de modération, la confidentialité des noms, les seuils 9/10, le retrait, les écritures concurrentes, la persistance après redémarrage et la rétention. Il supprime ses fixtures et les tables de maintenance de la base de test. **Ne jamais utiliser une base réelle.**

Le plan `.tsupgrader/runtime-validation/eval-plan.json` rejoue build, lint, tests unitaires et sondes HTTP. Le test PostgreSQL demande une base isolée et s’exécute séparément.
