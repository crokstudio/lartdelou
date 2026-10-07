# Publication CMS

Le CMS conserve son fonctionnement simple : un seul bouton « Publier ».
Toutes les écritures sur `main`, y compris l'ajout ou la suppression de médias,
relancent une attente de trois minutes. La cliente peut fermer le navigateur :
l'attente s'exécute sur GitHub Actions, pas dans le CMS ni dans une fonction Netlify.

Le workflow `publication.yml` annule l'attente précédente à chaque push. Il vérifie
aussi la révision distante pendant l'attente et avant la publication. Après trois
minutes sans changement, il ajoute uniquement `.netlify/publication.json` avec la
révision à publier. Une écriture concurrente empêche ce commit d'être poussé ;
aucune sauvegarde CMS n'est écrasée. GitHub peut ajouter un délai de démarrage
du runner : les trois minutes sont un minimum, pas une heure exacte garantie.

Netlify annule les pushes ordinaires via son `ignore` **avant** les tests et le
build. Il ne continue que pour le commit de publication, dont le marqueur doit
correspondre au parent et être le seul fichier modifié. Les annulations peuvent
apparaître dans son historique ; elles ne produisent pas de déploiement de
production. Le build autorisé exécute `npm test && npm run build`. En cas d'échec,
la dernière version publiée reste disponible. Aucun build hook, fonction, cron,
nouveau service payant ou secret supplémentaire n'est utilisé. Le dépôt est
public et utilise un runner GitHub standard gratuit.

## Vérification et reprise

- Consulter GitHub Actions → « Publish after three quiet minutes » pour l'attente.
- Consulter Netlify pour les tests, le build et le déploiement final.
- Après une erreur de build, corriger puis publier à nouveau depuis le CMS.
- Sans nouveau changement, relancer le job GitHub échoué. Pour une révision
  ordinaire restée en attente, « Run workflow » sur `main` relance le délai.
- Pour une erreur Netlify transitoire après le marqueur, réessayer le déploiement
  de ce marqueur dans Netlify.

Une modification après le démarrage du build ouvre une nouvelle période
d'attente ; elle n'annule pas un déploiement Netlify déjà commencé. Les build
hooks contournent la règle `ignore` de Netlify : ne pas en ajouter pour le CMS.

Références :
- https://docs.netlify.com/build/configure-builds/ignore-builds/
- https://docs.github.com/en/actions/concepts/workflows-and-actions/concurrency
- https://docs.github.com/en/actions/concepts/billing-and-usage
