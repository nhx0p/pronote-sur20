/*
 * Pronote sur 20 — script de contenu.
 * Repère les notes « nombre/nombre » par leur texte (pas par les classes CSS),
 * remplace la note par sa valeur sur 20 (ou ajoute un badge « /20 » à côté).
 * Ne lit ni ne gère aucun identifiant ; n'envoie rien à l'extérieur.
 */
(() => {
  'use strict';

  // Évite une double injection (manifest + script enregistré pour l'ENT).
  if (window.__pronoteSur20) return;
  window.__pronoteSur20 = true;

  const C = globalThis.Sur20Core;

  const { REGLAGES_DEFAUT } = C;
  let reglages = { ...REGLAGES_DEFAUT };

  // Marque des éléments déjà traités : empêche de retraiter (et donc de boucler).
  // Valeur « hote » : élément Pronote auquel on a ajouté un badge.
  // Valeur « inline » : <span> créé par nous autour d'une note trouvée dans un texte plus long.
  const ATTR = 'data-sur20';
  const SEL_MARQUE = '[' + ATTR + ']';

  const BALISES_IGNOREES = new Set([
    'SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT', 'SELECT', 'OPTION', 'CODE', 'PRE'
  ]);

  let observateur = null;
  let minuterie = null;
  let dernierPassage = 0;
  let intervalle = 0;

  /* ------------------------------------------------------------------ */
  /* Badges et marquage                                                  */
  /* ------------------------------------------------------------------ */

  function creerBadge(valeur20) {
    const badge = document.createElement('span');
    badge.className = 'sur20-badge';
    badge.textContent = C.formater(valeur20, reglages.decimales) + '/20';
    return badge;
  }

  // Contenu d'origine des notes remplacées, pour pouvoir le remettre (désactivation, changement de mode).
  const contenusOriginaux = new WeakMap();
  // Notes coupées (« 6,93 » et « /10 » dans deux balises) : lien nombre ↔ barème, dans les deux sens.
  const baremes = new WeakMap();
  const notesDuBareme = new WeakMap();

  // Texte d'un élément sans celui de nos badges.
  function texteSource(el) {
    let s = '';
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      if (!n.parentElement.closest('.sur20-badge')) s += n.nodeValue;
    }
    return s.trim();
  }

  /*
   * Mode « remplacer » : le contenu de la note est remplacé par la valeur /20,
   * au même format que les notes Pronote sur 20 (« 10,50 »). Le <span> hérite
   * de la police, de la taille et de la couleur de la note d'origine.
   */
  function remplacer(el, note, origine) {
    contenusOriginaux.set(el, [...el.childNodes]);
    const valeur = document.createElement('span');
    valeur.className = 'sur20-valeur';
    valeur.textContent = C.formaterPronote(note.valeur20, reglages.decimales);
    valeur.title = 'Note d’origine : ' + origine;
    el.replaceChildren(valeur);
    el.dataset.sur20Affiche = valeur.textContent;
  }

  /*
   * Marque l'élément puis remplace la note ou ajoute le badge, sauf si elle est déjà sur 20.
   * Les notes /20 sont marquées sans rien changer : inutile de les analyser à chaque passage.
   */
  function marquer(el, type, note, source) {
    el.setAttribute(ATTR, type);
    el.dataset.sur20Src = source;
    el.dataset.sur20Vingt = note.surVingt ? '1' : '0';
    if (note.surVingt) return;
    const bareme = baremes.get(el);
    if (reglages.mode === 'remplacer') {
      remplacer(el, note, source + (bareme ? bareme.dataset.sur20Texte.trim() : ''));
      // Note coupée : on masque aussi le « /10 » qui est dans un autre nœud.
      if (bareme) bareme.classList.add('sur20-masque');
    } else {
      // Note coupée : le badge va après le « /10 », pas entre le nombre et le barème.
      (bareme || el).append(creerBadge(note.valeur20));
    }
  }

  // Remplace un de nos <span> par son texte, en le recollant aux textes voisins
  // pour retrouver les nœuds d'origine (« Moyenne classe : » + « 6,93 »).
  function remettreTexte(el, texte) {
    const estTexte = (n) => n !== null && n.nodeType === Node.TEXT_NODE;
    const { previousSibling: avant, nextSibling: apres } = el;
    if (estTexte(avant)) {
      avant.appendData(texte + (estTexte(apres) ? apres.data : ''));
      if (estTexte(apres)) apres.remove();
      el.remove();
    } else if (estTexte(apres)) {
      apres.insertData(0, texte);
      el.remove();
    } else {
      el.replaceWith(document.createTextNode(texte));
    }
  }

  // Retire tout ce qu'on a ajouté à un élément et rend la page dans son état d'origine.
  function nettoyer(el) {
    const type = el.getAttribute(ATTR);
    if (type === 'coupee') {
      const bareme = baremes.get(el);
      if (bareme) restaurerBareme(bareme);
      remettreTexte(el, el.dataset.sur20Src);
      return;
    }
    if (type === 'inline') {
      remettreTexte(el, el.dataset.sur20Src);
      return;
    }
    // Si notre valeur est toujours là, on remet le contenu d'origine.
    // Sinon, Pronote a déjà réécrit l'élément : il n'y a rien à restaurer.
    const originaux = contenusOriginaux.get(el);
    if (originaux && el.querySelector(':scope > .sur20-valeur')) el.replaceChildren(...originaux);
    contenusOriginaux.delete(el);
    el.querySelectorAll(':scope > .sur20-badge').forEach((b) => b.remove());
    el.removeAttribute(ATTR);
    delete el.dataset.sur20Src;
    delete el.dataset.sur20Vingt;
    delete el.dataset.sur20Affiche;
  }

  function toutNettoyer() {
    document.querySelectorAll(SEL_MARQUE).forEach(nettoyer);
  }

  // Remet le texte « /10 » d'une note coupée à la place de notre <span>.
  function restaurerBareme(bareme) {
    if (bareme.isConnected) remettreTexte(bareme, bareme.dataset.sur20Texte);
  }

  // L'élément affiche-t-il toujours exactement ce que l'extension y a mis ?
  function estIntact(el) {
    if (el.getAttribute(ATTR) === 'coupee') {
      const bareme = baremes.get(el);
      if (!bareme || !bareme.isConnected) return false;
      if (reglages.mode !== 'remplacer' && el.dataset.sur20Vingt === '0') {
        return texteSource(el) === el.dataset.sur20Src && !!bareme.querySelector('.sur20-badge');
      }
    }
    if (el.dataset.sur20Vingt === '1') return texteSource(el) === el.dataset.sur20Src;
    if (el.dataset.sur20Affiche !== undefined) {
      return el.childNodes.length === 1 &&
        el.firstChild.nodeType === Node.ELEMENT_NODE &&
        el.firstChild.classList.contains('sur20-valeur') &&
        el.textContent.trim() === el.dataset.sur20Affiche;
    }
    return texteSource(el) === el.dataset.sur20Src && !!el.querySelector(':scope > .sur20-badge');
  }

  /*
   * Pronote peut réutiliser un élément en changeant son texte (changement de période…).
   * Si l'élément n'affiche plus ce que l'extension y a mis, on le nettoie pour qu'il soit retraité.
   */
  function verifierExistants() {
    document.querySelectorAll(SEL_MARQUE).forEach((el) => {
      if (!estIntact(el)) nettoyer(el);
    });
    // Barèmes orphelins : Pronote a supprimé le nombre mais laissé le « /10 ».
    document.querySelectorAll('.sur20-bareme').forEach((b) => {
      const el = notesDuBareme.get(b);
      if (!el || !el.isConnected) restaurerBareme(b);
    });
  }

  /* ------------------------------------------------------------------ */
  /* Détection des notes                                                 */
  /* ------------------------------------------------------------------ */

  /*
   * Cas le plus courant : un élément dont tout le texte est une note, éventuellement
   * éclatée en plusieurs balises (<div>7,00<sup>/10</sup></div>).
   * On remonte au plus 4 niveaux depuis le nœud texte.
   */
  function chercherHote(noeud) {
    let el = noeud.parentElement;
    for (let i = 0; el && i < 4 && el !== document.body; i++, el = el.parentElement) {
      if (el.closest(SEL_MARQUE)) return null;
      const t = el.textContent.trim();
      if (t.length > 30) return null;
      const note = C.analyserNoteComplete(t);
      if (note && !el.querySelector(SEL_MARQUE)) return { el, note, source: t };
    }
    return null;
  }

  /*
   * Cas secondaire : la note est au milieu d'un texte court (« Note : 7/10 »).
   * On découpe le nœud texte et on entoure chaque note d'un <span> à nous.
   */
  function envelopperNotes(noeud, occurrences) {
    const texte = noeud.nodeValue;
    const fragment = document.createDocumentFragment();
    let position = 0;
    for (const occ of occurrences) {
      fragment.append(texte.slice(position, occ.index));
      const enveloppe = document.createElement('span');
      enveloppe.textContent = occ.brut;
      marquer(enveloppe, 'inline', occ.note, occ.brut.trim());
      fragment.append(enveloppe);
      position = occ.index + occ.brut.length;
    }
    fragment.append(texte.slice(position));
    noeud.replaceWith(fragment);
  }

  // Isole les caractères [debut, fin[ d'un nœud texte dans un nœud texte à part.
  function isoler(noeud, debut, fin) {
    const milieu = debut > 0 ? noeud.splitText(debut) : noeud;
    if (fin - debut < milieu.nodeValue.length) milieu.splitText(fin - debut);
    return milieu;
  }

  // Nœud texte non vide qui précède `noeud` dans la page (au plus 5 nœuds en arrière).
  function textePrecedent(noeud) {
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    w.currentNode = noeud;
    let n = w.previousNode();
    for (let i = 0; n && i < 5; i++, n = w.previousNode()) {
      if (n.nodeValue.trim()) return n;
    }
    return null;
  }

  /*
   * Cas des moyennes de classe : « Moyenne classe : 6,93 » et « /10 » sont dans
   * deux balises différentes. On entoure le nombre (marqué « coupee ») et le barème
   * (<span class="sur20-bareme">) pour pouvoir les remplacer puis les restaurer.
   */
  function traiterNoteCoupee(noeudBareme) {
    const precedent = textePrecedent(noeudBareme);
    if (!precedent || !precedent.parentElement) return false;
    if (precedent.parentElement.closest(SEL_MARQUE + ', .sur20-badge, .sur20-bareme')) return false;
    const r = C.analyserNoteCoupee(precedent.nodeValue, noeudBareme.nodeValue);
    if (!r) return false;

    const noeudNombre = isoler(precedent, r.debutNombre, r.finNombre);
    const texteBareme = isoler(noeudBareme, 0, r.finBareme);

    const enveloppe = document.createElement('span');
    noeudNombre.replaceWith(enveloppe);
    enveloppe.append(noeudNombre);

    const bareme = document.createElement('span');
    bareme.className = 'sur20-bareme';
    bareme.dataset.sur20Texte = texteBareme.nodeValue;
    texteBareme.replaceWith(bareme);
    bareme.append(texteBareme);

    baremes.set(enveloppe, bareme);
    notesDuBareme.set(bareme, enveloppe);
    marquer(enveloppe, 'coupee', r.note, noeudNombre.nodeValue);
    return true;
  }

  function traiterTexte(noeud) {
    // On préfère marquer l'élément Pronote existant plutôt que découper son texte.
    const hote = chercherHote(noeud);
    if (hote) {
      marquer(hote.el, 'hote', hote.note, hote.source);
      return;
    }
    const occurrences = C.trouverNotes(noeud.nodeValue);
    if (occurrences.length) {
      envelopperNotes(noeud, occurrences);
      return;
    }
    traiterNoteCoupee(noeud);
  }

  // Parcourt la page et traite les nœuds texte contenant « / » non encore traités.
  function scanner() {
    if (!document.body) return;
    verifierExistants();

    const candidats = [];
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
      {
        acceptNode(n) {
          if (n.nodeType === Node.ELEMENT_NODE) {
            if (
              BALISES_IGNOREES.has(n.tagName) ||
              n.hasAttribute(ATTR) ||
              n.classList.contains('sur20-bareme') ||
              n.isContentEditable
            ) {
              return NodeFilter.FILTER_REJECT; // ignore aussi tout le sous-arbre
            }
            return NodeFilter.FILTER_SKIP;
          }
          return n.nodeValue.includes('/') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
        }
      }
    );
    // On collecte d'abord, on modifie ensuite (modifier pendant le parcours le perturberait).
    for (let n = walker.nextNode(); n; n = walker.nextNode()) candidats.push(n);
    for (const n of candidats) {
      if (n.isConnected && n.parentElement && !n.parentElement.closest(SEL_MARQUE)) traiterTexte(n);
    }
  }

  /* ------------------------------------------------------------------ */
  /* Observation des changements (Pronote ne recharge pas la page)       */
  /* ------------------------------------------------------------------ */

  function observer() {
    if (!observateur) {
      observateur = new MutationObserver(planifier);
    }
    observateur.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  /*
   * Traitement : l'observateur est déconnecté pendant nos propres modifications,
   * elles ne peuvent donc pas déclencher un nouveau traitement (pas de boucle infinie).
   */
  function executer() {
    minuterie = null;
    if (!reglages.actif || !document.body) return;
    if (observateur) observateur.disconnect();
    const debut = performance.now();
    try {
      scanner();
    } catch (e) {
      console.warn('[Pronote sur 20]', e);
    } finally {
      dernierPassage = performance.now();
      // Pause proportionnelle au coût du passage : courte sur une page légère,
      // plus longue sur une grosse page pour ne pas ralentir Pronote.
      intervalle = Math.min(600, Math.max(60, (dernierPassage - debut) * 10));
      observer();
      publier();
    }
  }

  /*
   * Un MutationObserver est appelé avant l'affichage : convertir tout de suite évite
   * de voir la note d'origine clignoter. En rafale, on attend la fin de la pause.
   */
  function planifier() {
    if (minuterie !== null) return;
    const attente = intervalle - (performance.now() - dernierPassage);
    if (attente <= 0) executer();
    else minuterie = setTimeout(executer, attente);
  }

  // Remet la page à zéro puis réapplique les réglages courants.
  function appliquer() {
    if (observateur) observateur.disconnect();
    if (minuterie !== null) clearTimeout(minuterie);
    minuterie = null;
    toutNettoyer();
    if (reglages.actif) executer();
    else publier();
  }

  /* ------------------------------------------------------------------ */
  /* État affiché dans le popup                                          */
  /* ------------------------------------------------------------------ */

  // Le popup ouvre un canal vers chaque cadre de l'onglet : on y publie le nombre
  // de notes converties, à l'ouverture puis après chaque passage.
  const canaux = new Set();
  const idCadre = Math.random().toString(36).slice(2);

  function publier() {
    if (!canaux.size) return;
    const converties = document.querySelectorAll(SEL_MARQUE + '[data-sur20-vingt="0"]').length;
    for (const canal of canaux) canal.postMessage({ cadre: idCadre, converties });
  }

  chrome.runtime?.onConnect?.addListener((canal) => {
    if (canal.name !== 'sur20-etat') return;
    canaux.add(canal);
    canal.onDisconnect.addListener(() => canaux.delete(canal));
    publier();
  });

  /* ------------------------------------------------------------------ */
  /* Réglages (chrome.storage)                                           */
  /* ------------------------------------------------------------------ */

  chrome.storage.sync.get(REGLAGES_DEFAUT).then((r) => {
    reglages = { ...REGLAGES_DEFAUT, ...r };
    appliquer();
  });

  chrome.storage.onChanged.addListener((changements, zone) => {
    if (zone !== 'sync') return;
    let modifie = false;
    for (const cle of Object.keys(REGLAGES_DEFAUT)) {
      if (cle in changements) {
        reglages[cle] = changements[cle].newValue ?? REGLAGES_DEFAUT[cle];
        modifie = true;
      }
    }
    if (modifie) appliquer();
  });
})();
