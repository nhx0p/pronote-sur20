# Pronote sur 20

Extension Chrome / Firefox (Manifest V3) qui convertit les notes Pronote sur 20.
Par défaut, la note est remplacée directement (`5,25/10` → `10,50`, même style que les autres notes).
Les moyennes de classe/groupe et les notes la plus haute/basse affichées avec un barème sont aussi converties.
Aucune donnée envoyée, aucune bibliothèque externe.

Le popup permet d'afficher plutôt un badge à côté (`7/10 14/20`), de choisir les décimales et de mettre en pause.

## Arborescence

```
pronote-sur20/
├── manifest.json        Déclaration de l'extension (MV3, compatible Firefox)
├── core.js              Fonctions pures : détection, conversion, format
├── content.js           Script injecté dans Pronote (remplacement/badges, MutationObserver)
├── styles.css           Styles injectés dans Pronote
├── background.js        Sites ajoutés (ENT) et icône grise en pause
├── ui.css               Couleurs et contrôles communs (thème sombre/clair)
├── popup.html/.css/.js  Réglages rapides et état de l'onglet
├── options.html/.css/.js  Ajout des adresses d'ENT
├── icons/               icon16/32/48/128.png, versions grises + generer-icones.ps1
└── tests/
    ├── core.test.js     Tests unitaires (node tests/core.test.js)
    ├── page-test.html   Page imitant Pronote pour tester sans extension
    └── popup-test.html  Aperçu du popup hors extension
```

## Installation

### Chrome / Edge / Brave
1. Ouvrir `chrome://extensions`.
2. Activer **Mode développeur** (en haut à droite).
3. **Charger l'extension non empaquetée** → choisir le dossier `pronote-sur20`.
4. Recharger l'onglet Pronote.

(Chrome peut afficher un avertissement sur `background.scripts` : c'est la clé utilisée par Firefox, il suffit de l'ignorer.)

### Firefox (128 ou plus récent)
1. Ouvrir `about:debugging#/runtime/this-firefox`.
2. **Charger un module complémentaire temporaire…** → choisir `manifest.json`.
3. Dans `about:addons` → Pronote sur 20 → onglet **Permissions**, vérifier que l'accès à
   `index-education.net` est autorisé (Firefox peut le demander en MV3).
4. Recharger l'onglet Pronote.

Un module temporaire disparaît quand Firefox se ferme. Pour une installation permanente, il faut le signer via addons.mozilla.org (possible en mode « non listé »).

### Pronote via un ENT ou une autre adresse
Ouvrir Pronote, cliquer sur l'icône de l'extension → **Activer** → accepter la permission. La page est convertie
sans la recharger. On peut aussi saisir l'adresse à la main : popup → **Sites et ENT** → `ent.monlycee.fr` → **Ajouter**.
Si l'ENT affiche Pronote dans un cadre venant de `index-education.net`, cette étape n'est pas nécessaire :
le script est déjà injecté dans tous les cadres.

## Tests

```
node tests/core.test.js
```

## Limites connues
- Une date au format `j/m` sans zéro (ex. `5/10`) serait prise pour une note ; Pronote écrit les dates `05/10`.
- Un élément qui ne contient que `1/2` (une pagination, par exemple) est pris pour une note.
