// Tests unitaires des fonctions de conversion. Lancer avec : node tests/core.test.js
'use strict';
const assert = require('node:assert/strict');
const C = require('../core.js');

let ok = 0;
function test(nom, fn) {
  try { fn(); ok++; console.log('  ✔ ' + nom); }
  catch (e) { console.error('  ✘ ' + nom + '\n    ' + e.message); process.exitCode = 1; }
}
const sur20 = (texte, dec = 2) => {
  const n = C.analyserNoteComplete(texte);
  return n && !n.surVingt ? C.formater(n.valeur20, dec) : n;
};

console.log('Conversions demandées');
test('7/10 → 14', () => assert.equal(sur20('7/10'), '14'));
test('9/12 → 15', () => assert.equal(sur20('9/12'), '15'));
test('3,5/5 → 14', () => assert.equal(sur20('3,5/5'), '14'));
test('32/40 → 16', () => assert.equal(sur20('32/40'), '16'));
test('18/20 → inchangé (aucun badge)', () => assert.equal(C.analyserNoteComplete('18/20').surVingt, true));
test('Abs → ignoré', () => assert.equal(C.analyserNoteComplete('Abs'), null));

console.log('Format Pronote (mode remplacer)');
test('5,25/10 → 10,50', () => assert.equal(C.formaterPronote(C.analyserNoteComplete('5,25/10').valeur20, 2), '10,50'));
test('9,00/10 → 18,00', () => assert.equal(C.formaterPronote(C.analyserNoteComplete('9,00/10').valeur20, 2), '18,00'));
test('8,50/10 → 17,00', () => assert.equal(C.formaterPronote(C.analyserNoteComplete('8,50/10').valeur20, 2), '17,00'));
test('9,5/12 → 15,83', () => assert.equal(C.formaterPronote(C.analyserNoteComplete('9,5/12').valeur20, 2), '15,83'));

console.log('Moyennes de classe');
test('« Moyenne classe : 6,93 » + « /10 » → 13,86', () => {
  const r = C.analyserNoteCoupee('Moyenne classe : 6,93', '/10');
  assert.equal(C.formaterPronote(r.note.valeur20, 2), '13,86');
  assert.equal('Moyenne classe : 6,93'.slice(r.debutNombre, r.finNombre), '6,93');
  assert.equal(r.finBareme, 3);
});
test('« 14,92 » + « /18 » → 16,58', () => {
  const r = C.analyserNoteCoupee('14,92', '/18');
  assert.equal(C.formaterPronote(r.note.valeur20, 2), '16,58');
});
test('moyenne dans un seul texte « Moyenne classe : 8,11/10 »', () => {
  const r = C.trouverNotes('Moyenne classe : 8,11/10');
  assert.equal(C.formaterPronote(r[0].note.valeur20, 2), '16,22');
});
test('« Note la plus haute : 9,50/10 » → 19,00', () => {
  const r = C.trouverNotes('Note la plus haute : 9,50/10');
  assert.equal(C.formaterPronote(r[0].note.valeur20, 2), '19,00');
});
test('« Note la plus basse : 2,25 » + « /10 » → 4,50', () => {
  const r = C.analyserNoteCoupee('Note la plus basse : 2,25', '/10');
  assert.equal(C.formaterPronote(r.note.valeur20, 2), '4,50');
});
test('« Moyenne classe : 5,39 » sans barème → rien', () => {
  assert.deepEqual(C.trouverNotes('Moyenne classe : 5,39'), []);
});
test('date coupée « le 06 » + « /10 » → rien', () => {
  assert.equal(C.analyserNoteCoupee('le 06', '/10'), null);
});

console.log('Cas supplémentaires');
test('9,5/12 → 15,83', () => assert.equal(sur20('9,5/12'), '15,83'));
test('9,5/12 avec 1 décimale → 15,8', () => assert.equal(sur20('9,5/12', 1), '15,8'));
test('4/5 → 16', () => assert.equal(sur20('4/5'), '16'));
test('format Pronote « 7,00 /10 »', () => assert.equal(sur20('7,00 /10'), '14'));
test('point décimal « 3.5/5 »', () => assert.equal(sur20('3.5/5'), '14'));
test('2/3 → 13,33', () => assert.equal(sur20('2/3'), '13,33'));
test('mentions ignorées', () => {
  for (const m of ['Abs', 'Disp', 'NNot', 'Inap', 'Absent', 'Dispensé', 'Non noté', 'N.Rdu']) {
    assert.equal(C.estMention(m), true, m);
    assert.deepEqual(C.trouverNotes(m), [], m);
  }
});
test('date 06/10 ignorée', () => assert.equal(C.analyserNoteComplete('06/10'), null));
test('date 15/09 ignorée (note > barème)', () => assert.equal(C.analyserNoteComplete('15/09'), null));
test('date complète 06/10/2026 ignorée', () => assert.deepEqual(C.trouverNotes('le 06/10/2026'), []));
test('barème nul ignoré', () => assert.equal(C.analyserNoteComplete('3/0'), null));
test('note dans un texte court', () => {
  const r = C.trouverNotes('Note : 7/10 (coef 2)');
  assert.equal(r.length, 1);
  assert.equal(r[0].brut, '7/10');
});

console.log('Numérotations (ne sont pas des notes)');
for (const t of ['Groupe 1/2', 'Exercice n° 3/4', 'Séance 2/5', 'DM de maths (1/2)', 'p. 4/12']) {
  test('« ' + t + ' » → rien', () => assert.deepEqual(C.trouverNotes(t), []));
}
test('« Groupe 1 » + « /2 » → rien', () => assert.equal(C.analyserNoteCoupee('Groupe 1', '/2'), null));
test('« Moyenne groupe 3,72/10 » reste une note', () => assert.equal(C.trouverNotes('Moyenne groupe 3,72/10').length, 1));
test('« Note : 2/3 » reste une note', () => assert.equal(C.trouverNotes('Note : 2/3').length, 1));
test('« TP 7/10 » reste une note', () => assert.equal(C.trouverNotes('TP 7/10').length, 1));

console.log('Adresses de sites');
test('adresse complète', () => assert.equal(C.versMotif('https://ent.monlycee.fr/accueil?x=1'), '*://ent.monlycee.fr/*'));
test('adresse sans https', () => assert.equal(C.versMotif(' ent.monlycee.fr '), '*://ent.monlycee.fr/*'));
test('adresses refusées', () => {
  for (const a of ['', 'monlycee', '*.monlycee.fr', 'ftp://monlycee.fr', 'mon lycee.fr']) assert.equal(C.versMotif(a), null, a);
});
test('motif → nom du site', () => assert.equal(C.hoteDuMotif('*://ent.monlycee.fr/*'), 'ent.monlycee.fr'));
test('reconnaît Pronote', () => {
  assert.equal(C.estPronote('https://0750001a.index-education.net/pronote/eleve.html'), true);
  assert.equal(C.estPronote('https://exemple.fr/?u=index-education.net/pronote/'), false);
});

console.log(`\n${ok} test(s) réussi(s)` + (process.exitCode ? ' — des tests ont échoué' : ''));
