// Popup de réglages : lit et écrit dans chrome.storage.sync.
// Le script de contenu écoute storage.onChanged et se met à jour tout seul.
'use strict';

const REGLAGES_DEFAUT = { actif: true, mode: 'remplacer', decimales: 2 };
const C = globalThis.Sur20Core;

const elActif = document.getElementById('actif');
const elStatut = document.getElementById('statut');
const elReglages = document.getElementById('reglages');
const elApercuNote = document.getElementById('apercuNote');
const elApercuMoyenne = document.getElementById('apercuMoyenne');
const radiosMode = document.querySelectorAll('input[name="mode"]');
const radiosDecimales = document.querySelectorAll('input[name="decimales"]');

let reglages = { ...REGLAGES_DEFAUT };

// Aperçu : un devoir noté 7,25/10, moyenne de classe 6,93/10
function majApercu() {
  const { actif, mode, decimales } = reglages;
  elApercuNote.replaceChildren();
  elApercuMoyenne.replaceChildren();

  if (!actif) {
    elApercuNote.textContent = '7,25/10';
    elApercuMoyenne.textContent = '6,93/10';
  } else if (mode === 'remplacer') {
    elApercuNote.textContent = C.formaterPronote(14.5, decimales);
    elApercuMoyenne.textContent = C.formaterPronote(13.86, decimales);
  } else {
    const badge = (v) => {
      const b = document.createElement('span');
      b.className = 'badge';
      b.textContent = C.formater(v, decimales) + '/20';
      return b;
    };
    elApercuNote.append('7,25/10', badge(14.5));
    elApercuMoyenne.append('6,93/10', badge(13.86));
  }

  elStatut.textContent = actif ? 'Activée sur Pronote' : 'Désactivée';
  elStatut.classList.toggle('eteint', !actif);
  elReglages.classList.toggle('desactive', !actif);
}

function afficher() {
  elActif.checked = reglages.actif;
  radiosMode.forEach((r) => { r.checked = r.value === reglages.mode; });
  radiosDecimales.forEach((r) => { r.checked = Number(r.value) === reglages.decimales; });
  majApercu();
}

function enregistrer(changement) {
  Object.assign(reglages, changement);
  chrome.storage.sync.set(changement);
  majApercu();
}

chrome.storage.sync.get(REGLAGES_DEFAUT).then((r) => {
  reglages = { ...REGLAGES_DEFAUT, ...r };
  afficher();
});

elActif.addEventListener('change', () => enregistrer({ actif: elActif.checked }));
radiosMode.forEach((r) => r.addEventListener('change', () => {
  if (r.checked) enregistrer({ mode: r.value });
}));
radiosDecimales.forEach((r) => r.addEventListener('change', () => {
  if (r.checked) enregistrer({ decimales: Number(r.value) });
}));

document.getElementById('lienOptions').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});
