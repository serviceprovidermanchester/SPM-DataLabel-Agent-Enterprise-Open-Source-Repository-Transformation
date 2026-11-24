# DataLabel Architecture & Engineering Design

**Product:** DataLabel — Enterprise Annotation & Agreement Studio  
**Service Line:** AI Development (Platform Infrastructure)  
**Author:** Sayed Mudassar Akbar  
**Company:** [SPManchester Private Limited](https://www.spmanchester.com)  
**Support:** [info@spmanchester.com](mailto:info@spmanchester.com)

---

## 1. Architectural Philosophy

High-performing Machine Learning models require reliable training and evaluation datasets. However, label quality in production pipelines is often assumed rather than rigorously quantified. Two annotators can disagree on 20% of an evaluation dataset without detection if only raw agreement is monitored, especially when majority-class bias skews casual perception.

DataLabel provides a deterministic, zero-external-dependency platform designed to:
1. **Quantify Inter-Annotator Reliability:** Calculate chance-corrected agreement using Cohen's Kappa ($\kappa$).
2. **Expose Disagreement as Actionable Workflows:** Transform divergent labels into prioritized adjudication queues.
3. **Guarantee Transparent Data Exports:** Categorize every item's provenance (Adjudicated, Agreed, Single-annotation, Disagreement, or Unresolved).

```
   ┌────────────────────────────────────────────────────────┐
   │                   Web SPA Console                      │
   │      (Hash-routed, pure vanilla JS, 10 views)          │
   └───────────────────────────┬────────────────────────────┘
                               │ HTTP JSON REST API
   ┌───────────────────────────▼────────────────────────────┐
   │                Node.js Native Server                   │
   │      node:http Router · Token Scoping Middleware       │
   └─────────────┬────────────────────────────┬─────────────┘
                 │                            │
   ┌─────────────▼──────────────┐  ┌──────────▼─────────────┐
   │    Agreement AI Engine     │  │  Embedded SQLite Store │
   │  Pure Deterministic Math   │  │   node:sqlite Driver   │
   │  Marginals · po · pe · κ   │  │  11 Multi-tenant Tables│
   └────────────────────────────┘  └────────────────────────┘
```

---

## 2. Agreement Mathematics & Algorithms

All statistical functions are isolated in `backend/src/ai/engine.js` as pure functions with zero side-effects.

### 2.1 Cohen's Kappa Formulation
Let $N$ denote the total count of items evaluated by both annotator $A$ and annotator $B$.
Let $L$ denote the ordered set of permissible labels $\{l_1, l_2, \dots, l_k\}$.

#### 1. Observed Agreement ($p_o$)
$$p_o = \frac{\sum_{i=1}^N \mathbb{I}(y_{A,i} = y_{B,i})}{N}$$
Where $\mathbb{I}$ is the indicator function. If $N = 0$, $p_o = 0$.

#### 2. Label Marginals & Chance Expected Agreement ($p_e$)
For each label $l \in L$:
$$\text{marginal}_A(l) = \frac{\text{count}_A(l)}{N}, \quad \text{marginal}_B(l) = \frac{\text{count}_B(l)}{N}$$
The overall probability of agreement occurring purely by chance is:
$$p_e = \sum_{l \in L} \left( \text{marginal}_A(l) \times \text{marginal}_B(l) \right)$$

#### 3. Cohen's Kappa Coefficient ($\kappa$)
$$\kappa = \frac{p_o - p_e}{1 - p_e}$$

#### 4. Boundary & Edge Case Handling
- If $N = 0$: $p_o = 0, p_e = 0, \kappa = 0$ (no interpretation band assigned).
- If $p_e = 1$: The denominator equals zero. If $p_o = 1$, $\kappa = 1.0$; otherwise $\kappa = 0.0$.
- All returned values are rounded strictly to 4 decimal places ($0.0001$).

### 2.2 Landis & Koch Qualitative Interpretation Bands
| Rounded $\kappa$ Value Range | Agreement Strength |
| :--- | :--- |
| $\kappa < 0.00$ | Poor |
| $0.00 \le \kappa \le 0.20$ | Slight |
| $0.21 \le \kappa \le 0.40$ | Fair |
| $0.41 \le \kappa \le 0.60$ | Moderate |
| $0.61 \le \kappa \le 0.80$ | Substantial |
| $0.81 \le \kappa \le 1.00$ | Almost Perfect |

---

## 3. Final Label Resolution Hierarchy

When exporting a dataset or generating summary distributions, final labels are resolved through an unambiguous four-tier precedence hierarchy:

```mermaid
flowchart TD
    Start[Item Label Resolution] --> Q1{Adjudication Record Exists?}
    Q1 -- Yes --> A1[Final Label = Adjudicated Value<br>Source: 'adjudicated']
    Q1 -- No --> Q2{≥ 2 Annotations and All Match?}
    Q2 -- Yes --> A2[Final Label = Unanimous Value<br>Source: 'agreed']
    Q2 -- No --> Q3{Exactly 1 Annotation Exists?}
    Q3 -- Yes --> A3[Final Label = Single Label<br>Source: 'single-annotation']
    Q3 -- No --> Q4{≥ 2 Annotations That Conflict?}
    Q4 -- Yes --> A4[No Final Label<br>Source: 'disagreement' (Open Queue)]
    Q4 -- No --> A5[No Final Label<br>Source: 'unresolved' (0 Annotations)]
```

No item is ever assigned a speculative or default label. Unresolved shares are stated explicitly in audit records.

---

## 4. Multi-Tenant Database Architecture

Storage is powered by SQLite via Node's native `node:sqlite`. Every table enforces row-level tenant boundary isolation via `project_id`.

```
users (project_id) ────────┐
sessions (user_id)         │
projects (id) ◄────────────┼──────────────────────────────┐
                           │                              │
label_schemas (project_id) ┼──────────────┐               │
items (project_id, schema_id) ◄───────────┼──────────┐    │
annotators (project_id)    │              │          │    │
assignments (project_id, schema_id, item_id, annotator_id) │
annotations (assignment_id, item_id, annotator_id)        │
adjudications (item_id, schema_id) ───────────────────────┘
exports (project_id, schema_id)
notifications (user_id)
```

---
*SPManchester Private Limited — AI Engineering & Research*  
*Website: [www.spmanchester.com](https://www.spmanchester.com) · Contact: [info@spmanchester.com](mailto:info@spmanchester.com)*
