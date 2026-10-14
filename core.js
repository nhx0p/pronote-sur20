/*
 * Pronote sur 20 — fonctions « pures » (aucun accès au DOM).
 * Partagées entre le script de contenu (content.js) et les tests Node (tests/core.test.js).
 */
(function (racine) {
  'use strict';

  // Mentions sans valeur numérique : jamais converties.
  const RE_MENTION = /^(abs\.?|absent(e)?|disp\.?|dispens[ée](e)?|nnot|non\s*not[ée]|inap\.?|inapte|n\.?\s*rdu|non\s*rendu|fraude?)$/i;

  // Note complète : tout le texte doit être « nombre/nombre » (virgule ou point acceptés).
  const RE_NOTE_COMPLETE = /^\s*(\d{1,3}(?:[.,]\d{1,2})?)\s*\/\s*(\d{1,3}(?:[.,]\d{1,2})?)\s*$/;

  // Note au milieu d'un texte. Les assertions évitent de couper un nombre
  // ou de prendre un morceau de date (06/10/2026).
  const RE_NOTE_GLOBALE = /(?<![\d.,\/])(\d{1,3}(?:[.,]\d{1,2})?)\s*\/\s*(\d{1,3}(?:[.,]\d{1,2})?)(?![\d\/]|[.,]\d)/g;

  // Au-delà de cette longueur, un texte n'est pas une cellule de note : on l'ignore
  // (limite les faux positifs dans les paragraphes, les commentaires du professeur…).
  const LONGUEUR_MAX_TEXTE = 60;

  // « 9,5 » → 9.5
  function versNombre(brut) {
    return parseFloat(String(brut).replace(',', '.'));
  }

  function estMention(texte) {
    return RE_MENTION.test(String(texte).trim());
  }

  /*
   * Valide un couple (note, barème) et calcule la valeur sur 20.
   * Renvoie null si ce n'est vraisemblablement pas une note.
   */
  function analyser(numBrut, denBrut) {
    // Un zéro en tête (« 06/10 ») évoque une date, pas une note.
    if (/^0\d/.test(numBrut) || /^0\d/.test(denBrut)) return null;
    const note = versNombre(numBrut);
    const bareme = versNombre(denBrut);
    if (!Number.isFinite(note) || !Number.isFinite(bareme)) return null;
    // Une note ne dépasse pas son barème (15/09 est une date, pas une note).
    if (bareme <= 0 || note > bareme) return null;
    return {
      note,
      bareme,
      valeur20: (note / bareme) * 20,
      surVingt: bareme === 20
    };
  }

  // Analyse un texte qui doit être entièrement une note (« 7,00 / 10 »).
  function analyserNoteComplete(texte) {
    const t = String(texte).trim();
    if (!t || estMention(t)) return null;
    const m = RE_NOTE_COMPLETE.exec(t);
    return m ? analyser(m[1], m[2]) : null;
  }

  // Trouve toutes les notes dans un texte court. Renvoie [{ index, brut, note }].
  function trouverNotes(texte) {
    const t = String(texte);
    if (t.trim().length > LONGUEUR_MAX_TEXTE || estMention(t)) return [];
    const resultats = [];
    for (const m of t.matchAll(RE_NOTE_GLOBALE)) {
      const note = analyser(m[1], m[2]);
      if (note) resultats.push({ index: m.index, brut: m[0], note });
    }
    return resultats;
  }

  /*
   * Note coupée en deux nœuds texte : « Moyenne classe : 6,93 » puis « /10 ».
   * avant = texte qui se termine par le nombre, apres = texte qui commence par « /barème ».
   * Renvoie la note et les positions à isoler dans chaque texte, ou null.
   */
  const RE_FIN_NOMBRE = /(?<![\d.,\/])(\d{1,3}(?:[.,]\d{1,2})?)\s*$/;
  const RE_DEBUT_BAREME = /^(\s*\/\s*(\d{1,3}(?:[.,]\d{1,2})?))(?![\d\/]|[.,]\d)/;

  function analyserNoteCoupee(avant, apres) {
    if (String(avant).trim().length > LONGUEUR_MAX_TEXTE) return null;
    const mA = RE_FIN_NOMBRE.exec(String(avant));
    const mB = RE_DEBUT_BAREME.exec(String(apres));
    if (!mA || !mB) return null;
    const note = analyser(mA[1], mB[2]);
    if (!note) return null;
    return {
      note,
      debutNombre: mA.index,
      finNombre: mA.index + mA[1].length,
      finBareme: mB[1].length
    };
  }

  /*
   * Formate au format français : arrondi à n décimales, zéros inutiles retirés.
   * 14 → « 14 » ; 15.5 → « 15,5 » ; 13.3333 → « 13,33 ».
   */
  function formater(valeur, decimales) {
    const facteur = 10 ** decimales;
    const arrondi = Math.round((valeur + Number.EPSILON) * facteur) / facteur;
    return String(arrondi).replace('.', ',');
  }

  /*
   * Format des notes Pronote : nombre de décimales fixe.
   * 10.5 → « 10,50 » ; 17 → « 17,00 » (avec 2 décimales).
   */
  function formaterPronote(valeur, decimales) {
    const facteur = 10 ** decimales;
    const arrondi = Math.round((valeur + Number.EPSILON) * facteur) / facteur;
    return arrondi.toFixed(decimales).replace('.', ',');
  }

  const api = {
    estMention,
    analyser,
    analyserNoteComplete,
    trouverNotes,
    analyserNoteCoupee,
    formater,
    formaterPronote
  };

  // Node (tests) ou navigateur (script de contenu)
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else racine.Sur20Core = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
