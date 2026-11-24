"use strict";
// DataLabel agreement engine — deterministic annotation-quality maths over
// labelled items. Plain JavaScript, no network calls, no API keys. Every
// number the API returns is produced here from the two annotators' labels,
// and every response carries the counts behind it (marginals, per-label
// agreement counts, the disagreement list) so each figure can be recomputed
// by hand.
//
// Inter-annotator agreement (computeAgreement) — exactly as implemented:
//   Input: pairs = [{ itemRef, labelA, labelB }] — the items that BOTH
//   annotators have labelled — and labels, the schema's ordered label list.
//     N          = number of doubly-labelled items
//     agreed     = pairs where labelA === labelB
//     po         = agreed / N                        (observed agreement)
//     For each label L:
//       countA(L) = pairs where labelA = L;  countB(L) = pairs where labelB = L
//       marginalA(L) = countA(L) / N;        marginalB(L) = countB(L) / N
//       pe contribution of L = marginalA(L) * marginalB(L)
//     pe         = sum over L of marginalA(L) * marginalB(L)
//                  (expected agreement by chance, from the two annotators'
//                  own label marginals)
//     Cohen's kappa  kappa = (po - pe) / (1 - pe)
//                  When pe = 1 the denominator is 0: kappa is defined as 1
//                  when po = 1 (both annotators used one label throughout
//                  and agree) and 0 otherwise. When N = 0, po, pe and kappa
//                  are all 0 and no interpretation is offered.
//   All reported figures are rounded to 4 decimal places (round4).
//   Per-label agreement: for each label L, agreedOn(L) = pairs where both
//   annotators chose L, plus each annotator's solo counts on disagreements.
//   Interpretation bands (Landis & Koch, applied to the rounded kappa):
//     kappa < 0 → "poor" · 0–0.20 → "slight" · 0.21–0.40 → "fair" ·
//     0.41–0.60 → "moderate" · 0.61–0.80 → "substantial" ·
//     0.81–1.00 → "almost perfect".
//
// Annotator progress (annotatorProgress): done = assignments that carry an
// annotation, total = assignments, percent = round4(100 * done / total)
// (0 when total = 0).
//
// Final labels (summariseFinalLabels): one final label per item, resolved
// in this documented order —
//   1. an adjudication's final label, when one exists;
//   2. the agreed label, when at least two annotations exist and they all
//      carry the same label;
//   3. the single annotation's label, when exactly one annotation exists;
//   4. otherwise the item is "unresolved" (disagreement with no
//      adjudication yet, or no annotations at all).
// The export summary reports, per label, the count of items whose final
// label is that label and its percentage of ALL items in the schema
// (round4), plus the unresolved count and percentage.

function round4(n) { return Math.round((Number(n) + Number.EPSILON) * 10000) / 10000; }

function kappaBand(kappa, n) {
  if (!n) return null;
  if (kappa < 0) return "poor";
  if (kappa <= 0.2) return "slight";
  if (kappa <= 0.4) return "fair";
  if (kappa <= 0.6) return "moderate";
  if (kappa <= 0.8) return "substantial";
  return "almost perfect";
}

// pairs: [{ itemRef, labelA, labelB }]; labels: ordered label list.
function computeAgreement(pairs, labels) {
  const n = pairs.length;
  let agreed = 0;
  const disagreements = [];
  const perLabel = labels.map((label) => ({
    label, countA: 0, countB: 0, agreedOn: 0, aOnly: 0, bOnly: 0,
  }));
  const byLabel = Object.fromEntries(perLabel.map((r) => [r.label, r]));
  for (const p of pairs) {
    if (byLabel[p.labelA]) byLabel[p.labelA].countA++;
    if (byLabel[p.labelB]) byLabel[p.labelB].countB++;
    if (p.labelA === p.labelB) {
      agreed++;
      if (byLabel[p.labelA]) byLabel[p.labelA].agreedOn++;
    } else {
      disagreements.push({ itemRef: p.itemRef, labelA: p.labelA, labelB: p.labelB });
      if (byLabel[p.labelA]) byLabel[p.labelA].aOnly++;
      if (byLabel[p.labelB]) byLabel[p.labelB].bOnly++;
    }
  }
  const po = n === 0 ? 0 : agreed / n;
  let peRaw = 0;
  for (const r of perLabel) {
    r.marginalA = n === 0 ? 0 : round4(r.countA / n);
    r.marginalB = n === 0 ? 0 : round4(r.countB / n);
    r.peContribution = n === 0 ? 0 : round4((r.countA / n) * (r.countB / n));
    if (n > 0) peRaw += (r.countA / n) * (r.countB / n);
  }
  const pe = round4(peRaw);
  let kappa;
  if (n === 0) kappa = 0;
  else if (peRaw >= 1) kappa = po >= 1 ? 1 : 0;
  else kappa = round4((po - peRaw) / (1 - peRaw));
  return {
    items: n, agreed, disagreed: n - agreed,
    po: round4(po), pe, kappa,
    interpretation: kappaBand(kappa, n),
    formula: "kappa = (po - pe) / (1 - pe), pe = sum over labels of marginalA(label) * marginalB(label)",
    perLabel, disagreements,
  };
}

function annotatorProgress(done, total) {
  return { done, total, percent: total === 0 ? 0 : round4((100 * done) / total) };
}

// items: [{ ref }]; annotationsByRef: { ref: [label, ...] };
// adjudicationsByRef: { ref: finalLabel }. labels: ordered label list.
function summariseFinalLabels(items, annotationsByRef, adjudicationsByRef, labels) {
  const counts = Object.fromEntries(labels.map((l) => [l, 0]));
  let unresolved = 0;
  const finals = items.map((it) => {
    let finalLabel = null, source = "unresolved";
    const anns = annotationsByRef[it.ref] || [];
    if (adjudicationsByRef[it.ref]) { finalLabel = adjudicationsByRef[it.ref]; source = "adjudicated"; }
    else if (anns.length >= 2 && anns.every((l) => l === anns[0])) { finalLabel = anns[0]; source = "agreed"; }
    else if (anns.length === 1) { finalLabel = anns[0]; source = "single-annotation"; }
    else if (anns.length >= 2) { source = "disagreement"; }
    if (finalLabel && counts[finalLabel] !== undefined) counts[finalLabel]++;
    else if (!finalLabel) unresolved++;
    return { itemRef: it.ref, finalLabel, source };
  });
  const total = items.length;
  const distribution = labels.map((label) => ({
    label, count: counts[label],
    percent: total === 0 ? 0 : round4((100 * counts[label]) / total),
  }));
  return {
    totalItems: total, resolved: total - unresolved, unresolved,
    unresolvedPercent: total === 0 ? 0 : round4((100 * unresolved) / total),
    distribution, finals,
  };
}

module.exports = { computeAgreement, annotatorProgress, summariseFinalLabels, kappaBand, round4 };
