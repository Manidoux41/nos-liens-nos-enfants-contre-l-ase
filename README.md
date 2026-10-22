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
2. Renseigner `DATABASE_URL`, `POSTGRES_URL` ou `PRISMA_DATABASE_URL` avec une URL PostgreSQL de développement. `DIRECT_URL` reste une surcharge facultative pour les migrations.
3. Définir `SITE_ORIGIN=http://localhost:3000` et `BETTER_AUTH_URL` avec la même valeur.
4. Générer trois secrets différents d’au moins 32 caractères pour `BETTER_AUTH_SECRET`, `CRON_SECRET` et `SURVEY_EMAIL_SECRET` : par exemple avec `openssl rand -base64 48`. Ne jamais les commiter.
5. Configurer `RESEND_API_KEY` et `SURVEY_EMAIL_FROM` avec un expéditeur sur un domaine vérifié dans Resend. Sans ces variables, l’envoi de code est explicitement indisponible ; aucun contournement de vérification n’est proposé.

```sh
npm ci
npm run db:migrate
npm run dev
```

Le récit est pré-rendu ; le sondage (année actuelle) et les résultats de l’accueil sont chargés à la demande derrière des limites Suspense. La collecte, les statistiques et l’authentification nécessitent la base et les variables renseignées. Les erreurs de base sont affichées explicitement, sans fausses statistiques à zéro ni faux succès de collecte ; les cadres des graphiques restent visibles.

### Premier administrateur

Renseigner temporairement `BOOTSTRAP_ADMIN_EMAIL` et `BOOTSTRAP_ADMIN_PASSWORD` dans le fichier `.env`, avec un mot de passe unique de **16 à 128 caractères** :

```sh
npm run admin:bootstrap
```

Cette commande accepte également les variables injectées par l’environnement sans fichier `.env`. Elle refuse de fonctionner dès qu’un compte existe et utilise un verrou transactionnel pour éviter deux initialisations concurrentes. Elle n’affiche jamais le mot de passe. Retirer ensuite ces deux variables ; ne pas les ajouter à Vercel.

Se connecter ensuite sur `/admin/connexion` avec **l’adresse e-mail et le mot de passe choisis ci-dessus**. Il n’existe aucun identifiant ou mot de passe par défaut. En local : `http://localhost:3000/admin`. En production : `https://votre-site.fr/admin`.

Les administrateurs créent d’autres administrateurs dans la section **Sondage & comptes**, peuvent les désactiver/réactiver, réinitialiser leurs mots de passe et changer leur propre mot de passe après vérification du précédent. La réinitialisation et la désactivation révoquent les sessions du compte. Il n’existe ni inscription publique ni récupération automatique par courriel : conserver au moins deux comptes habilités et un accès d’exploitation sécurisé à la base.

### Tableau de bord et journal

- `/admin` : accueil personnalisé, nombre de brouillons/articles publiés/médias/réponses à modérer, derniers articles et raccourcis.
- `/admin/categories` : créer, renommer et supprimer les catégories. Une catégorie utilisée ne peut pas être supprimée : réaffecter ses articles d’abord.
- `/admin/articles` : recherche par titre, filtres catégorie/statut et pagination. L’éditeur simple propose titre, adresse publique, résumé, paragraphes, catégorie et jusqu’à 20 médias associés.
- **Enregistrer en brouillon / dépublier** retire l’article du journal ; **Enregistrer et publier** rend le texte et ses médias associés accessibles. La suppression d’article demande confirmation et conserve les fichiers dans la médiathèque. Les modifications concurrentes sont refusées plutôt que d’écraser un travail plus récent.
- `/admin/medias` : importer des images **JPEG, PNG, WebP** et des **PDF**, de **4 Mio maximum** (4 194 304 octets), modifier titre/description accessible/légende, voir les articles liés et supprimer les fichiers inutilisés. Pas de SVG, HTML ou éditeur HTML. La vérification de signature ne remplace pas un antivirus ni une revue du document.
- `/admin/sondage` : modération, juridictions, publication statistique, pétition, comptes et journal d’audit.
- `/admin/sondages` : créer des sondages reprenant les questions existantes avec titre, adresse et présentation personnalisés ; conserver en brouillon, publier, clôturer ou masquer les résultats. Les réponses ne sont jamais copiées. La modération permet de filtrer par sondage.
- `/sondages` et `/sondages/[slug]` : catalogue et participation aux sondages publiés ; les sondages clôturés restent consultables sans accepter de réponses, les brouillons sont invisibles.
- `/articles` et `/articles/[slug]` : journal public par catégorie ; seuls les articles publiés sont accessibles. Le récit initial de l’accueil reste indépendant du journal.

Pour la médiathèque, créer un **store Vercel Blob privé** et définir son `BLOB_READ_WRITE_TOKEN` dans les variables serveur (et dans `.env` pour les imports locaux). Ne jamais utiliser `NEXT_PUBLIC_` pour ce secret, ni un store public. Sans token, l’interface signale la configuration manquante, sans simuler un import réussi.

Les fichiers sont servis via `/medias/[id]`, sans exposer le chemin Blob au navigateur. Chaque demande vérifie une session administrateur active ou l’association actuelle à au moins un article publié ; les réponses ne sont pas mises en cache. Dépublier tous les articles qui utilisent un média retire donc les **futurs accès anonymes**. Une copie déjà téléchargée ne peut pas être révoquée. Les PDF sont téléchargés comme pièces jointes. Retirer les métadonnées personnelles des images avant import, vérifier les droits et anonymiser tout document ; aucun document judiciaire confidentiel ni identité de mineur ne doit être publié.

Un média lié ne peut pas être supprimé ; le détacher de tous ses articles d’abord. Si le stockage est indisponible pendant une suppression, le fichier est marqué en cours de suppression et la médiathèque propose de réessayer. Ne pas supprimer manuellement ses lignes en base. En cas d’échec de nettoyage après un import non confirmé, l’erreur `media-upload-orphan-cleanup` est journalisée : contrôler les fichiers orphelins dans le store privé.

La migration additive `20261022060000_editorial` doit être appliquée avant cette version avec `npm run db:migrate`. Aucun compte administrateur n’est créé par la migration.

### Participation vérifiée par e-mail

Appliquer également la migration additive **`20261022080000_verified_polls` avant le déploiement**. Elle rattache les réponses existantes au sondage initial, sans effacement et sans inventer d’adresse ou de vérification. Le sondage initial reste publié ; le réglage général de publication des statistiques n’est pas modifié.

Chaque nouvelle réponse requiert un code Resend de huit chiffres (dix minutes, cinq essais maximum). Seule une empreinte HMAC de l’adresse normalisée en minuscules est conservée par sondage, avec une contrainte unique en base. Les adresses en clair et les codes ne sont ni stockés ni montrés dans l’administration. Le consentement passe en version `2026-10-22-email-v4` ; les anciens onglets doivent être rechargés, ils ne peuvent pas envoyer une réponse non vérifiée. Les réponses historiques restent non vérifiées.

Une adresse peut répondre à plusieurs sondages, mais une seule fois à chacun, même si sa réponse est rejetée ou en attente. La suppression complète ou l’expiration libère cette possibilité ; le code privé de **suppression** reste indispensable et ne doit pas être confondu avec le code e-mail. Ce contrôle ne prouve pas une personne unique : les alias et boîtes distinctes ne sont pas fusionnés. Ne jamais présenter ces contributions comme des électeurs uniques.

**Garder `SURVEY_EMAIL_SECRET` stable**, distinct du secret administrateur : changer cette clé change les empreintes, rend les vérifications en cours inutilisables et empêche de reconnaître les anciennes participations. L’application n’ayant pas conservé les e-mails, une rotation transparente est impossible ; planifier une transition spécifique avant toute rotation. Les quotas d’envoi sont partagés en PostgreSQL (une demande/minute et cinq/heure par adresse et sondage, cinquante/heure globalement). Les codes expirés sont purgés quotidiennement. Les résultats exigent à la fois l’autorisation générale, l’autorisation du sondage et dix réponses approuvées non expirées par groupe ; aucune agrégation entre sondages.

Avant ouverture, vérifier le domaine expéditeur, les engagements et transferts éventuels de Resend, et compléter la politique de confidentialité. Les tests locaux ne doivent jamais envoyer de vrais e-mails.

## Déploiement Vercel + Neon

1. Importer le dépôt dans Vercel, preset **Next.js**, Node.js 22.x.
2. Ajouter **Neon Postgres** depuis Vercel Marketplace. Choisir des régions cohérentes, idéalement européennes, et vérifier les engagements contractuels et transferts.
3. Utiliser une branche/base **distincte** pour les Preview et le développement. Ne pas connecter des déploiements non validés aux réponses de production.
4. Définir les variables Vercel :
   - `DATABASE_URL` : URL Neon **poolée**, TLS activé ;
   - `DIRECT_URL` : URL **directe** pour les migrations, facultative si l’une des variables ci-dessous fournit déjà une connexion adaptée ;
   - `POSTGRES_URL` ou `PRISMA_DATABASE_URL` : alternatives à `DATABASE_URL`, au format PostgreSQL ;
   - `SITE_ORIGIN` : origine publique exacte, par exemple `https://votre-site.fr`, sans barre finale ;
   - `BETTER_AUTH_URL` : même origine ;
   - `BETTER_AUTH_SECRET` : secret aléatoire, stable, au moins 32 caractères ;
   - `CRON_SECRET` : secret aléatoire distinct, au moins 32 caractères ;
   - `SURVEY_EMAIL_SECRET` : clé HMAC aléatoire dédiée et stable, au moins 32 caractères ;
   - `RESEND_API_KEY` et `SURVEY_EMAIL_FROM` : clé serveur Resend et expéditeur vérifié ;
   - `BLOB_READ_WRITE_TOKEN` : token du store Vercel Blob **privé** pour la médiathèque.
5. Appliquer `npm run db:migrate` **depuis un environnement d’exploitation sécurisé**, avec `DIRECT_URL` de la base cible, avant le déploiement de la nouvelle version. Les migrations sont versionnées. Elles ne sont pas exécutées automatiquement par les builds Preview.
6. Le build Vercel exécute `npm run build` (génération Prisma puis compilation Next.js). Le `postinstall` génère également le client Prisma.
7. Exécuter une fois le bootstrap depuis un environnement sécurisé connecté à la bonne base, sans exposer les variables de bootstrap au déploiement.
8. Tester `/admin/connexion`, une contribution de test, la modération, le retrait par code et `/statistiques` avant d’ouvrir le site.

### Choix de l’URL pour les migrations

La commande reste `npm run db:migrate`. Prisma charge le fichier `.env` et utilise aussi les variables déjà présentes dans l’environnement (notamment celles de Vercel).

- **Migrations :** première URL PostgreSQL disponible dans l’ordre `DIRECT_URL`, `DATABASE_URL`, `POSTGRES_URL`, `PRISMA_DATABASE_URL`.
- **Application, bootstrap et maintenance :** ordre `DATABASE_URL`, `POSTGRES_URL`, `PRISMA_DATABASE_URL`, `DIRECT_URL`.
- Les variables vides sont ignorées. Une URL mal formée ou de protocole incorrect produit une erreur explicite, sans afficher ses identifiants ni basculer silencieusement sur une autre base.
- `PRISMA_DATABASE_URL` est parfois une URL proxy `prisma://` ou `prisma+postgres://`, et non une connexion PostgreSQL. Ces URL sont ignorées au profit d’une URL `postgres://` ou `postgresql://` disponible dans les autres variables. Si seule une URL proxy est fournie, une erreur demande la connexion PostgreSQL du fournisseur. L’adaptateur actuel n’utilise pas Prisma Accelerate.
- Pour migrer, privilégier l’URL **directe**, pas une URL PgBouncer transactionnelle : la placer dans `DIRECT_URL` si l’application utilise par ailleurs une URL poolée. Ne pas transformer manuellement une URL proxy en URL directe.
- Si plusieurs variables sont définies, vérifier qu’elles ciblent bien la même base, ou ne conserver que celles nécessaires. La commande ne migre qu’une base, jamais toutes les URL successivement.

`vercel.json` prévoit le cron de rétention quotidien à 03:00 UTC et les en-têtes de protection des pages privées. Vercel transmet `CRON_SECRET` comme Bearer token ; sans secret valide, la maintenance est refusée. Vérifier dans le tableau de bord que le cron est réellement exécuté et superviser les échecs.

Les sessions durent douze heures, sans cache de session côté client. Les limites d’écriture du sondage et les quotas de connexion sont stockés en PostgreSQL et partagés entre les instances serverless. Une protection de trafic supplémentaire par Vercel Firewall reste nécessaire pour une ouverture publique ; le sondage n’a pas de CAPTCHA et ne garantit pas une seule réponse par personne.

## Collecte, confidentialité et publication

### Réponses

`POST /api/sondage/code` reçoit `{ email, pollId }` et retourne uniquement `{ challengeId }` après acceptation de l’envoi par Resend. `POST /api/sondage` exige l’enveloppe `{ answer, pollId, email, challengeId, code }`, avec le consentement e-mail v4, et valide les 101 départements, les options de non-réponse, les limites de texte et les consentements :

- département de résidence et ASE distincts ;
- année du **premier placement parmi les enfants** facultative (`placementYear`, entier de 1900 à l’année UTC actuelle, ou `null`) ;
- retour au foyer au moment de la réponse facultatif (`returnHome` : `ALL`, `SOME`, `NONE`, `NOT_APPLICABLE`, `UNDISCLOSED`, ou `null`). Le choix non concerné exige une année vide. Aucun nombre d’enfants ni date de naissance n’est collecté ;
- juridiction déclarée facultative (200 caractères) ;
- juges et intervenants sociaux facultatifs (600 caractères par champ), strictement privés ;
- consentement général à la collecte et aux statistiques, accord distinct lorsque des noms professionnels sont fournis ;
- aucun document de procédure, récit d’accusation, identité de mineur ou donnée de santé ne doit être saisi.

Un code aléatoire de suppression est généré dans le navigateur. Seule son empreinte SHA-256 est stockée ; l’identifiant interne de la contribution est différent. Une nouvelle tentative identique avec le même code est idempotente. La contrainte unique `(pollId, emailHash)` empêche les doublons de la même adresse, y compris en concurrence, sans prétendre reconnaître une personne utilisant plusieurs adresses.

`DELETE /api/sondage` retire la réponse et ses champs privés avec le code. La page `/confidentialite` contient ce formulaire. Aucun endpoint public ne liste les réponses, les noms ou les empreintes. Aucun export public de données brutes n’est proposé.

### Modération et statistiques

- Statuts `PENDING`, `APPROVED`, `REJECTED` ; seuls `APPROVED` et les enregistrements non expirés sont comptés.
- Les juridictions saisies par les participants ne deviennent **jamais** automatiquement des libellés publics. L’administrateur vérifie un nom institutionnel, l’ajoute au référentiel et effectue le rattachement.
- Les juridictions peuvent être renommées ou supprimées ; leur suppression détache les contributions sans les effacer.
- Le seuil public est fixe à **10 réponses par groupe**, avec résidence, ASE, juridiction, année du premier placement et retour au foyer affichés séparément, sans tableau croisé, petit effectif ou total général.
- L’accueil, sous le formulaire, affiche déjà les cadres des graphiques ASE / années / retours. `/statistiques` ajoute résidence et juridictions. Chaque vue propose un graphique et un tableau accessible : barres horizontales, années classées chronologiquement et anneau des retours. Aucun graphique ne fabrique d’effectif lorsque la publication est fermée, la base indisponible ou le seuil non atteint.
- Les graphiques comptent des **contributions**, pas des enfants. L’anneau représente uniquement les catégories publiables ; ce n’est pas un taux global de retour. Ni les groupes masqués, ni les non-réponses, ni les options `NOT_APPLICABLE` / `UNDISCLOSED` ne sont déduits d’un total. Une année absente n’équivaut pas à zéro et l’année du premier placement ne mesure pas la durée continue d’un placement.
- Les vues année/retour exigent le consentement `2026-10-22-parcours-v3` ou `2026-10-22-email-v4`. Les anciennes lignes `2026-10-22-statistiques-v2` ne peuvent autoriser implicitement les nouveaux comptages et conservent `null` pour ces champs. Seul le consentement v4 est accepté pour les nouvelles soumissions HTTP ; aucun ancien onglet ne contourne la vérification e-mail.
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
DATABASE_URL=postgresql://USER@127.0.0.1:PORT/ase_app_test DIRECT_URL=postgresql://USER@127.0.0.1:PORT/ase_app_test npm run db:migrate
TEST_DATABASE_URL=postgresql://USER@127.0.0.1:PORT/ase_app_test npm run test:http
```

Le port HTTP 3118 doit être libre. Ce test démarre et arrête son propre serveur Next.js de production, vérifie les limites d’entrée, les consentements, l’authentification, les accès refusés, les véritables Server Actions de modération, la confidentialité des noms, les seuils 9/10, le retrait, les écritures concurrentes, la persistance après redémarrage et la rétention. Il supprime ses fixtures et les tables de maintenance de la base de test. **Ne jamais utiliser une base réelle.**

### Déployer les questions de placement et les graphiques

Appliquer la migration additive `20261022070000_survey_placement` avec `npm run db:migrate` sur la base cible **avant** de déployer cette version. Elle ajoute un enum et deux colonnes nullables, sans effacer ni compléter artificiellement les réponses existantes.

Pour publier des résultats réels : dans `/admin/sondage`, activer « Ouvrir les statistiques publiques » et approuver les contributions. Chaque groupe doit ensuite atteindre dix réponses non expirées ; les graphiques apparaissent sans chiffres tant que ces conditions ne sont pas remplies.

Si la production affiche « statistiques momentanément indisponibles », ce n’est pas l’état normal d’une collecte vide ou fermée. Vérifier les **variables Vercel Production**, la base effectivement ciblée, les migrations et les logs de la fonction. Une connexion locale réussie ne prouve pas que Vercel utilise cette même configuration. Ne pas publier de valeurs fictives ni désactiver les contrôles pour masquer cette erreur. Les cadres graphiques restent visibles avec une erreur explicite.

Le bouton « Réessayer la lecture des résultats » relance la lecture serveur après une panne ; « Actualiser les résultats » recharge les données et l’état de publication sans perdre les réponses en cours de saisie sur l’accueil. Une lecture réussie remplace l’ancienne erreur. Le message « publication non ouverte » indique une lecture réussie, pas une panne : l’administration doit explicitement activer la publication et approuver les contributions. Ni l’actualisation ni le passage au tableau ne contournent ces contrôles ou le seuil de dix.

Le plan `.tsupgrader/runtime-validation/eval-plan.json` rejoue build, lint, tests unitaires et sondes HTTP. Le test PostgreSQL demande une base isolée et s’exécute séparément.
