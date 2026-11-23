// Service worker (Chrome) / script d'arrière-plan (Firefox).
// 1. Enregistre le script de contenu sur les sites ajoutés (ENT, serveur du lycée),
//    uniquement si l'utilisateur a accordé la permission.
// 2. Grise l'icône de la barre d'outils quand la conversion est en pause.
'use strict';

const ID_SCRIPT_ENT = 'sur20-ent';
const FICHIERS_JS = ['core.js', 'content.js'];
const FICHIERS_CSS = ['styles.css'];

// Les événements arrivent parfois groupés (permission + réglage) : on les traite un par un
// pour ne pas enregistrer deux fois le même script.
let file = Promise.resolve();
function enFile(tache) {
  file = file.then(tache).catch((e) => console.warn('[Pronote sur 20]', e));
}

/* ------------------------------------------------------------------ */
/* Sites ajoutés                                                       */
/* ------------------------------------------------------------------ */

async function sitesAutorises() {
  const { entOrigines = [] } = await chrome.storage.sync.get('entOrigines');
  const autorises = [];
  for (const motif of entOrigines) {
    if (await chrome.permissions.contains({ origins: [motif] })) autorises.push(motif);
  }
  return autorises;
}

async function synchroniserScripts() {
  const autorises = await sitesAutorises();
  const existants = await chrome.scripting.getRegisteredContentScripts({ ids: [ID_SCRIPT_ENT] });
  if (existants.length) await chrome.scripting.unregisterContentScripts({ ids: [ID_SCRIPT_ENT] });
  if (!autorises.length) return;

  await chrome.scripting.registerContentScripts([{
    id: ID_SCRIPT_ENT,
    matches: autorises,
    js: FICHIERS_JS,
    css: FICHIERS_CSS,
    allFrames: true,
    runAt: 'document_idle'
  }]);
}

// Les onglets déjà ouverts sont traités tout de suite : pas besoin de les recharger.
// content.js ignore une seconde injection.
async function injecterOngletsOuverts() {
  const autorises = await sitesAutorises();
  if (!autorises.length) return;
  for (const onglet of await chrome.tabs.query({ url: autorises })) {
    const target = { tabId: onglet.id, allFrames: true };
    try {
      await chrome.scripting.insertCSS({ target, files: FICHIERS_CSS });
      await chrome.scripting.executeScript({ target, files: FICHIERS_JS });
    } catch {
      // Onglet en veille ou page protégée : il sera traité à son prochain chargement.
    }
  }
}

/* ------------------------------------------------------------------ */
/* Icône de la barre d'outils                                          */
/* ------------------------------------------------------------------ */

async function majIcone() {
  const { actif } = await chrome.storage.sync.get({ actif: true });
  const suffixe = actif ? '' : '-off';
  await chrome.action.setIcon({
    path: { 16: `/icons/icon16${suffixe}.png`, 32: `/icons/icon32${suffixe}.png` }
  });
  await chrome.action.setTitle({ title: actif ? 'Pronote sur 20' : 'Pronote sur 20 (en pause)' });
}

/* ------------------------------------------------------------------ */
/* Événements                                                          */
/* ------------------------------------------------------------------ */

function demarrer() {
  enFile(synchroniserScripts);
  enFile(majIcone);
}

chrome.runtime.onInstalled.addListener(demarrer);
chrome.runtime.onStartup.addListener(demarrer);

chrome.permissions.onAdded.addListener(() => {
  enFile(synchroniserScripts);
  enFile(injecterOngletsOuverts);
});
chrome.permissions.onRemoved.addListener(() => enFile(synchroniserScripts));

chrome.storage.onChanged.addListener((changements, zone) => {
  if (zone !== 'sync') return;
  if ('actif' in changements) enFile(majIcone);
  if ('entOrigines' in changements) {
    enFile(synchroniserScripts);
    enFile(injecterOngletsOuverts);
  }
});
