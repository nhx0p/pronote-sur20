/*
 * Pronote sur 20 — fonctions « pures » (aucun accès au DOM).
 * Partagées entre le script de contenu (content.js) et les tests Node (tests/core.test.js).
 */
(function (racine) {
  'use strict';

  // Réglages par défaut, communs au script de contenu et au popup.
  const REGLAGES_DEFAUT = Object.freeze({
    actif: true,
    mode: 'remplacer',     // 'remplacer' = la note /20 prend la place de la note, 'cote' = badge à côté
    decimales: 2           // 1 ou 2
  });

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

  // Mot suivi d'une numérotation, pas d'une note : « Groupe 1/2 », « Exercice n° 3/4 ».
  const RE_NUMEROTATION = /(?<!\p{L})(?:groupes?|gr|exercices?|exos?|ex|pages?|p|parties?|chapitres?|chap|s[ée]ances?|s[ée]quences?|semaines?|sem|fiches?|feuilles?|activit[ée]s?|questions?|[ée]tapes?|cours|tome|niveau)\.?\s*(?:n°\s*)?\(?\s*$/iu;

  // Texte qui annonce clairement une note.
  const RE_CONTEXTE_NOTE = /note|moy/i;

  // avant = texte qui précède le nombre. Une numérotation n'a jamais de décimales.
  function estNumerotation(avant, numBrut) {
    return /^\d+$/.test(numBrut) && RE_NUMEROTATION.test(avant) && !/moy/i.test(avant);
  }

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
      if (!note || estNumerotation(t.slice(0, m.index), m[1])) continue;
      // « DM de maths (1/2) » : un petit entier sur un petit entier, au milieu d'un texte,
      // est une numérotation, sauf si le texte parle d'une note.
      if (note.bareme < 5 && Number.isInteger(note.note) && !RE_CONTEXTE_NOTE.test(t)) continue;
      resultats.push({ index: m.index, brut: m[0], note });
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
    if (!mA || !mB || estNumerotation(String(avant).slice(0, mA.index), mA[1])) return null;
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

  /*
   * Adresse saisie → motif d'hôte pour les permissions.
   * « https://ent.monlycee.fr/xyz » ou « ent.monlycee.fr » → « *://ent.monlycee.fr/* ».
   * Renvoie null si l'adresse n'est pas celle d'un site web.
   */
  const RE_HOTE = /^(?:[a-z0-9-]+\.)+[a-z0-9-]+$|^localhost$/i;

  function versMotif(saisie) {
    let texte = String(saisie).trim();
    if (!texte) return null;
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(texte)) texte = 'https://' + texte;
    try {
      const url = new URL(texte);
      if (!/^https?:$/.test(url.protocol) || !RE_HOTE.test(url.hostname)) return null;
      return '*://' + url.hostname + '/*';
    } catch {
      return null;
    }
  }

  // « *://ent.monlycee.fr/* » → « ent.monlycee.fr »
  function hoteDuMotif(motif) {
    return String(motif).replace(/^.*?:\/\//, '').replace(/\/.*$/, '');
  }

  // Page Pronote hébergée par Index Éducation (prise en charge d'office par le manifeste).
  function estPronote(url) {
    return /^https?:\/\/(?:[^/]+\.)?index-education\.net\/pronote\//i.test(String(url));
  }

  const api = {
    REGLAGES_DEFAUT,
    versMotif,
    hoteDuMotif,
    estPronote,
    estMention,
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
