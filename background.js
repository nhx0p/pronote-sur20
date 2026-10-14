// Service worker (Chrome) / script d'arrière-plan (Firefox).
// Seul rôle : enregistrer le script de contenu sur les adresses d'ENT ajoutées
// dans les options, uniquement si l'utilisateur a accordé la permission.
'use strict';

const ID_SCRIPT_ENT = 'sur20-ent';

async function synchroniserScriptsEnt() {
  const { entOrigines = [] } = await chrome.storage.sync.get('entOrigines');

  // Ne garder que les adresses réellement autorisées
  const autorisees = [];
  for (const motif of entOrigines) {
    if (await chrome.permissions.contains({ origins: [motif] })) autorisees.push(motif);
  }

  const existants = await chrome.scripting.getRegisteredContentScripts({ ids: [ID_SCRIPT_ENT] });
  if (existants.length) await chrome.scripting.unregisterContentScripts({ ids: [ID_SCRIPT_ENT] });
  if (!autorisees.length) return;

  await chrome.scripting.registerContentScripts([{
    id: ID_SCRIPT_ENT,
    matches: autorisees,
    js: ['core.js', 'content.js'],
    css: ['styles.css'],
    allFrames: true,
    runAt: 'document_idle'
  }]);
}

function synchroniser() {
  synchroniserScriptsEnt().catch((e) => console.warn('[Pronote sur 20]', e));
}

chrome.runtime.onInstalled.addListener(synchroniser);
chrome.runtime.onStartup.addListener(synchroniser);
chrome.permissions.onAdded.addListener(synchroniser);
chrome.permissions.onRemoved.addListener(synchroniser);
chrome.storage.onChanged.addListener((changements, zone) => {
  if (zone === 'sync' && 'entOrigines' in changements) synchroniser();
});
