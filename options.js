// Page d'options : gestion des adresses d'ENT supplémentaires.
// Chaque adresse est convertie en motif « *://hote/* » puis demandée comme
// permission optionnelle. background.js enregistre ensuite le script de contenu.
'use strict';

const elAdresses = document.getElementById('adresses');
const elStatut = document.getElementById('statut');

// « https://ent.monlycee.fr/xyz » → « *://ent.monlycee.fr/* » (null si invalide)
function versMotif(ligne) {
  let texte = ligne.trim();
  if (!texte) return null;
  if (!/^[a-z]+:\/\//i.test(texte)) texte = 'https://' + texte;
  try {
    const url = new URL(texte);
    if (!/^https?:$/.test(url.protocol) || !url.hostname) return null;
    return '*://' + url.hostname + '/*';
  } catch {
    return null;
  }
}

chrome.storage.sync.get({ entOrigines: [] }).then(({ entOrigines }) => {
  elAdresses.value = entOrigines.map((m) => m.replace('*://', 'https://').replace(/\/\*$/, '')).join('\n');
});

document.getElementById('enregistrer').addEventListener('click', () => {
  const lignes = elAdresses.value.split('\n').filter((l) => l.trim());
  const motifs = [...new Set(lignes.map(versMotif).filter(Boolean))];
  const invalides = lignes.filter((l) => !versMotif(l));

  const enregistrer = (accorde) => {
    chrome.storage.sync.set({ entOrigines: motifs }).then(() => {
      let msg = motifs.length ? 'Enregistré : ' + motifs.join(', ') : 'Aucune adresse supplémentaire.';
      if (!accorde) msg += '\nAutorisation refusée : l’extension ne pourra pas agir sur ces sites.';
      if (invalides.length) msg += '\nIgnoré (adresse invalide) : ' + invalides.join(', ');
      msg += '\nRechargez l’onglet Pronote pour appliquer.';
      elStatut.textContent = msg;
    });
  };

  if (!motifs.length) {
    enregistrer(true);
    return;
  }
  // La demande de permission doit partir directement du clic (geste utilisateur).
  chrome.permissions.request({ origins: motifs }).then(enregistrer, () => enregistrer(false));
});
