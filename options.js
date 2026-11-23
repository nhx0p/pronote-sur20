// Page Sites : adresses d'ENT supplémentaires.
// Chaque adresse devient un motif « *://hote/* », demandé comme permission optionnelle.
// background.js enregistre ensuite le script de contenu et traite les onglets ouverts.
'use strict';

const C = globalThis.Sur20Core;

const elAdresse = document.getElementById('adresse');
const elMessage = document.getElementById('message');
const elSites = document.getElementById('sites');

let entOrigines = [];

function erreur(texte) {
  elMessage.textContent = texte;
  elAdresse.setAttribute('aria-invalid', String(!!texte));
}

function enregistrer(liste) {
  entOrigines = liste;
  return chrome.storage.sync.set({ entOrigines });
}

// À appeler directement depuis un clic : le navigateur exige un geste de l'utilisateur.
function demanderAcces(motif) {
  return chrome.permissions.request({ origins: [motif] }).catch(() => false);
}

/* ------------------------------------------------------------------ */
/* Liste                                                               */
/* ------------------------------------------------------------------ */

function elem(balise, classe, ...contenu) {
  const el = document.createElement(balise);
  el.className = classe;
  el.append(...contenu);
  return el;
}

function bouton(libelle, classe, hote, faire) {
  const b = elem('button', 'bouton bouton-petit ' + classe, libelle);
  b.type = 'button';
  b.setAttribute('aria-label', libelle + ' ' + hote);
  b.addEventListener('click', faire);
  return b;
}

function ligneSite(motif, autorise) {
  const hote = C.hoteDuMotif(motif);
  const infos = elem('div', 'site-infos', elem('span', 'site-nom', hote));
  const actions = elem('div', 'site-actions');
  if (!autorise) {
    const etat = elem('span', 'site-etat', elem('span', 'point'), 'Autorisation manquante');
    etat.dataset.ton = 'alerte';
    infos.append(etat);
    actions.append(bouton('Autoriser', '', hote, () => demanderAcces(motif)));
  }
  actions.append(bouton('Retirer', 'bouton-nu', hote, () => retirer(motif)));
  return elem('li', 'site', infos, actions);
}

async function majListe() {
  elSites.replaceChildren(...await Promise.all(entOrigines.map(async (motif) =>
    ligneSite(motif, await chrome.permissions.contains({ origins: [motif] })))));
}

/* ------------------------------------------------------------------ */
/* Actions                                                             */
/* ------------------------------------------------------------------ */

async function retirer(motif) {
  await enregistrer(entOrigines.filter((m) => m !== motif));
  chrome.permissions.remove({ origins: [motif] }).catch(() => false);
}

document.getElementById('formulaire').addEventListener('submit', async (e) => {
  e.preventDefault();
  const motif = C.versMotif(elAdresse.value);
  if (!motif) {
    erreur('Adresse non reconnue. Exemple : ent.monlycee.fr');
    elAdresse.focus();
    return;
  }
  // La demande part avant tout « await », l'enregistrement suit sans attendre.
  const demande = demanderAcces(motif);
  const avant = entOrigines;
  enregistrer([...new Set([...avant, motif])]);
  if (await demande) {
    elAdresse.value = '';
  } else {
    await enregistrer(avant);
    erreur('Autorisation refusée pour ' + C.hoteDuMotif(motif));
  }
});

elAdresse.addEventListener('input', () => erreur(''));

/* ------------------------------------------------------------------ */
/* Démarrage                                                           */
/* ------------------------------------------------------------------ */

chrome.storage.sync.get({ entOrigines: [] }).then((r) => {
  entOrigines = r.entOrigines;
  majListe();
  document.body.classList.add('pret');
});

// Toute modification, ici ou ailleurs (popup, réglages du navigateur), met la liste à jour.
chrome.storage.onChanged.addListener((changements, zone) => {
  if (zone !== 'sync' || !('entOrigines' in changements)) return;
  entOrigines = changements.entOrigines.newValue ?? [];
  majListe();
});
chrome.permissions.onAdded.addListener(majListe);
chrome.permissions.onRemoved.addListener(majListe);
