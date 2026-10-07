# Maintenance des dépendances — 7 octobre 2026

Travail réalisé uniquement sur la branche locale `codex/dependency-maintenance`.
Aucun push, workflow GitHub distant ou déploiement Netlify n'a été lancé.
La fusion et la publication nécessitent une nouvelle instruction de l'utilisateur.

## Résultat de l'audit

| Niveau `npm audit` | Avant | Après |
| --- | ---: | ---: |
| Critique | 8 | 0 |
| Élevé | 53 | 20 |
| Modéré | 20 | 4 |
| Faible | 1 | 0 |
| Total de paquets signalés | 82 | 24 |

Le total compte aussi les paquets parents qui dépendent d'un paquet vulnérable.
Les 24 paquets restants correspondent à **trois avis distincts** sans version
corrigée publiée au moment de l'audit, pas à 24 failles indépendantes.

## Modifications

- Eleventy : 3.1.2 → 3.1.6, version stable ; aucun passage à la v4 alpha.
- Eleventy Image : 6.0.4 → 7.0.0 ; Sharp : 0.33.5 → 0.35.5.
- Netlify CLI : dépendance déclarée 23.x → 27.11.2 ; l'installation locale
  initiale était incomplète et ne contenait pas le CLI malgré le lockfile.
- Override `sharp: ^0.35.5` pour corriger aussi la copie ancienne utilisée par
  IPX/Netlify Dev. Le traitement IPX a été vérifié avec une conversion WebP.
- Sass : 1.94.2 → 1.105.1 ; rimraf : 6.1.2 → 6.1.3 ; slugify : 1.6.6 → 1.6.9.
- Suppression de Stripe et Lightning CSS CLI, sans usage dans les sources ni
  dans les scripts de ce projet. La compilation CSS utilise Sass.
- Alpine reste exactement en 3.15.2 pour conserver le JavaScript public existant.
  Dotenv et esbuild restent sur leurs branches majeures/minores compatibles.
- Node 24 indiqué dans `.nvmrc` ; moteurs compatibles : Node 22.13+ ou Node 24.
- Action checkout mise à jour de v4 vers v7.0.1, épinglée par SHA, runtime Node 24.
- Decap CMS épinglé à 3.16.3, la version déjà servie par le CDN pour `@^3.0.0`.
- Caches Netlify Dev et son `deno.lock` généré exclus de Git ; le marqueur
  `.netlify/publication.json` reste explicitement versionné.

## Alertes restantes et exposition

- [braces, gravité élevée](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) :
  récursion excessive dans des motifs glob malveillants. Présent via les outils
  de surveillance/compilation et le CLI ; les motifs du projet sont fixes.
- [node-forge, gravité élevée](https://github.com/advisories/GHSA-86w9-cpqp-85rv) :
  vérification de signature RSA incorrecte. Présent dans la chaîne TLS du
  serveur de développement Netlify, pas dans le JavaScript public compilé.
- [sprintf-js, gravité modérée](https://github.com/advisories/GHSA-hp3w-g68c-fv3c) :
  formatage avec précision non bornée. Présent via gray-matter/js-yaml/argparse,
  donc dans la lecture des sources pendant le build.

Il reste une dette de maintenance ; l'audit n'établit pas l'exploitation de ces
avis dans ce projet. `npm audit fix --force` propose notamment Eleventy 0.6.0
et un ancien CLI : ces rétrogradations ne sont pas des corrections compatibles.
Ne pas remplacer les dépendances par des faux paquets ou masquer leurs avis.

## Vérifications locales

Installation à partir du lockfile avec `npm ci`, 24 tests réussis et build complet
réussi avec Eleventy 3.1.6. Aperçu Netlify Dev hors ligne : 13 sculptures.
Conversion IPX avec Sharp corrigé : image WebP de 80 pixels de large valide.
Le CSS et le JavaScript publics générés sont identiques, octet par octet, à ceux
d'avant la maintenance. Aucun template, style, script ou média source public
n'a été modifié.

244 images optimisées comparées : mêmes largeurs, 162 identiques au décodage,
six variantes ont un arrondi de hauteur différent d'un pixel ; les autres sont
réencodées avec le nouveau moteur. Le HTML de la galerie diffère uniquement par
la suppression du descripteur `320w` d'un `srcset` contenant une seule variante,
correction native d'Eleventy Image v7. Le reste du rendu public est conservé.

Les scripts distants Netlify Identity et les polices Google ne sont pas inclus
dans `npm audit`. Ils n'ont pas été modifiés ; cette maintenance ne constitue
pas un audit complet des services d'authentification/CDN.

## Reprise ultérieure

Recontrôler les trois avis avant toute publication et attendre les versions
corrigées stables. Valider avec `npm ci`, `npm test`, `npm run build`, puis
`npm audit`. La commande d'audit restera non nulle tant que les avis subsistent.
Les changements checkout sont validés statiquement ; aucun nouveau workflow
distant n'a été exécuté afin de respecter la consigne de ne rien publier.

Références des versions : [Eleventy 3.1.6](https://github.com/11ty/buildawesome/releases/tag/v3.1.6),
[Image 7.0.0](https://github.com/11ty/image/releases/tag/v7.0.0),
[Sharp 0.35.5](https://sharp.pixelplumbing.com/changelog/v0.35.5/),
[Netlify CLI 27.11.2](https://github.com/netlify/cli/releases/tag/v27.11.2),
[checkout 7.0.1](https://github.com/actions/checkout/releases/tag/v7.0.1).
