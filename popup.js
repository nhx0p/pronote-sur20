// Popup de réglages : lit et écrit dans chrome.storage.sync.
// Le script de contenu écoute storage.onChanged et se met à jour tout seul.
'use strict';

const C = globalThis.Sur20Core;

const elActif = document.getElementById('actif');
const elReglages = document.getElementById('reglages');
const elEtat = document.getElementById('etat');
const elEtatTexte = document.getElementById('etatTexte');
const elEtatAction = document.getElementById('etatAction');
const radiosMode = document.querySelectorAll('input[name="mode"]');
const radiosDecimales = document.querySelectorAll('input[name="decimales"]');

let reglages = { ...C.REGLAGES_DEFAUT };
let entOrigines = [];

/* ------------------------------------------------------------------ */
/* État de l'onglet                                                    */
/* ------------------------------------------------------------------ */

let onglet = null;
let canal = null;
let etatConnu = false;         // le script de l'onglet a répondu, ou on sait qu'il est absent
const cadres = new Map();      // identifiant du cadre → notes converties

// Ouvre un canal vers le script de contenu (tous les cadres répondent).
function connecter() {
  if (canal) canal.disconnect();
  cadres.clear();
  const c = chrome.tabs.connect(onglet.id, { name: 'sur20-etat' });
  canal = c;
  c.onMessage.addListener((m) => {
    if (canal !== c) return;
    cadres.set(m.cadre, m.converties);
    etatConnu = true;
    majEtat();
  });
  c.onDisconnect.addListener(() => {
    void chrome.runtime.lastError; // aucun script dans cet onglet : attendu
    if (canal !== c) return;
    canal = null;
    cadres.clear();
    etatConnu = true;
    majEtat();
  });
}

// Après une activation, le script met un instant à s'installer.
function reessayer(essais = 8) {
  if (cadres.size || essais <= 0) return;
  connecter();
  setTimeout(reessayer, 300, essais - 1);
}

function hoteOnglet() {
  try {
    const url = new URL(onglet.url);
    return /^https?:$/.test(url.protocol) ? url.hostname : null;
  } catch {
    return null;
  }
}

function poserEtat(ton, texte, action) {
  elEtat.dataset.ton = ton;
  elEtatTexte.textContent = texte;
  elEtatAction.hidden = !action;
  if (action) {
    elEtatAction.textContent = action.libelle;
    elEtatAction.onclick = action.faire;
  }
}

function majEtat() {
  if (!etatConnu) return;
  if (!reglages.actif) {
    poserEtat('pause', 'En pause');
    return;
  }
  if (cadres.size) {
    const n = [...cadres.values()].reduce((a, b) => a + b, 0);
    poserEtat('actif', n === 0 ? 'Aucune note à convertir' : n === 1 ? '1 note convertie' : n + ' notes converties');
    return;
  }
  const hote = hoteOnglet();
  if (hote === null) {
    poserEtat('pause', 'Ouvrez Pronote');
  } else if (C.estPronote(onglet.url) || entOrigines.some((m) => C.hoteDuMotif(m) === hote)) {
    poserEtat('alerte', 'Page à recharger', { libelle: 'Recharger', faire: () => chrome.tabs.reload(onglet.id) });
  } else {
    poserEtat('pause', 'Non activée sur ' + hote, { libelle: 'Activer', faire: () => activerSite(hote) });
  }
}

/*
 * Ajoute le site de l'onglet. La demande de permission doit partir du clic ; le site est
 * enregistré en même temps, car le navigateur peut fermer le popup pendant la demande
 * (background.js termine alors le travail).
 */
async function activerSite(hote) {
  const motif = C.versMotif(hote);
  if (!motif) return;
  const avant = entOrigines;
  const demande = chrome.permissions.request({ origins: [motif] });
  entOrigines = [...new Set([...avant, motif])];
  chrome.storage.sync.set({ entOrigines });
  const accorde = await demande.catch(() => false);
  if (accorde) {
    reessayer();
  } else {
    entOrigines = avant;
    chrome.storage.sync.set({ entOrigines });
    majEtat();
  }
}

async function demarrerEtat() {
  [onglet] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!onglet) return;
  connecter();
  chrome.tabs.onUpdated.addListener((id, info) => {
    if (id === onglet.id && info.status === 'complete') reessayer();
  });
}

/* ------------------------------------------------------------------ */
/* Réglages                                                            */
/* ------------------------------------------------------------------ */

function afficher() {
  elActif.checked = reglages.actif;
  radiosMode.forEach((r) => { r.checked = r.value === reglages.mode; });
  radiosDecimales.forEach((r) => { r.checked = Number(r.value) === reglages.decimales; });
  elReglages.inert = !reglages.actif;
  majEtat();
}

function enregistrer(changement) {
  Object.assign(reglages, changement);
  chrome.storage.sync.set(changement);
  afficher();
}

elActif.addEventListener('change', () => enregistrer({ actif: elActif.checked }));
radiosMode.forEach((r) => r.addEventListener('change', () => {
  if (r.checked) enregistrer({ mode: r.value });
}));
radiosDecimales.forEach((r) => r.addEventListener('change', () => {
  if (r.checked) enregistrer({ decimales: Number(r.value) });
}));

document.getElementById('lienOptions').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
  window.close();
});

chrome.storage.sync.get({ ...C.REGLAGES_DEFAUT, entOrigines: [] }).then((r) => {
  ({ entOrigines, ...reglages } = r);
  afficher();
  demarrerEtat();
  // Les transitions ne s'activent qu'après le premier affichage.
  requestAnimationFrame(() => requestAnimationFrame(() => document.body.classList.add('pret')));
});
