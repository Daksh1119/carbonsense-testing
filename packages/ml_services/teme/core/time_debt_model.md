# TEME Time-Debt Mathematical Model

This document defines the **formal mathematical model** used by the
TEME (Time-based Ecological Mitigation Engine) core.

The model is **deterministic**, **rule-based**, and **conservative by design**.
It explicitly models *time debt* — the delay between carbon emission and
ecological mitigation via afforestation.

This document is the **single source of truth** for TEME core logic.

---

## 1. Definitions and Notation

Let:

- \( E \) = total carbon emissions to mitigate (kg CO₂e)
- \( t \) = discrete year index, where:
  - \( t = 0 \) denotes the planting year
- \( T \) = time horizon in years
- \( s \) = species index

For each species \( s \):

- \( N_s \) = number of trees planted
- \( \alpha_s(t) \) = per-tree annual carbon sequestration rate at year \( t \)
  (kg CO₂ / tree / year)
- \( \sigma_s(t) \) = survival fraction at year \( t \),
  where \( 0 \le \sigma_s(t) \le 1 \)
- \( A_s \) = land required per tree (hectares / tree)

---

## 2. Survival Model

Tree survival is modeled as a **monotonically non-increasing function**:

\[
\sigma_s(t+1) \le \sigma_s(t)
\]

Survival curves are:
- species-specific
- location-dependent
- derived from empirical or literature-based data

Survival **must never increase** over time.
Any model violating monotonicity is invalid.

---

## 3. Sequestration Curve Model

For each species \( s \), the per-tree sequestration rate \( \alpha_s(t) \)
follows these rules:

- \( \alpha_s(0) = 0 \) (no sequestration in planting year)
- \( \alpha_s(t) \ge 0 \) for all \( t \)
- \( \alpha_s(t) \) increases during early growth years
- \( \alpha_s(t) \) plateaus after maturity
- Declining sequestration is allowed only if supported by data

This prevents unrealistic early carbon offset claims.

---

## 4. Annual Effective Sequestration

For a given species \( s \) at year \( t \), the **effective annual sequestration**
is defined as:

\[
Q_s(t) = N_s \cdot \alpha_s(t) \cdot \sigma_s(t)
\]

This represents the **net carbon absorbed** by species \( s \) during year \( t \).

---

## 5. Total Annual Sequestration

Summing across all selected species:

\[
Q(t) = \sum_s Q_s(t)
\]

This is the total carbon absorbed by the mitigation plan in year \( t \).

---

## 6. Cumulative Sequestration (Time-Debt Core)

Cumulative sequestration up to year \( t \) is defined as:

\[
C(t) = \sum_{k=0}^{t} Q(k)
\]

Carbon neutrality is achieved at the earliest year \( t \) such that:

\[
C(t) \ge E
\]

Define the **offset year**:

\[
t_{\text{offset}} = \min \{ t \mid C(t) \ge E \}
\]

If no such \( t \le T \) exists, the mitigation plan is **infeasible**.

---

## 7. Land Constraint (Hard Constraint)

Total land required by the plan must satisfy:

\[
\sum_s N_s \cdot A_s \le A_{\text{max}}
\]

Where:
- \( A_{\text{max}} \) is the maximum available land (hectares)

Violation of this constraint results in immediate infeasibility.

This constraint is **non-negotiable** and cannot be softened.

---

## 8. Time Horizon Handling

- All calculations are performed for \( t \in [0, T] \)
- If sequestration or survival data ends before \( T \),
  values are assumed to **plateau at the final known value**
- No extrapolation beyond plateau is permitted

---

## 9. Warning Generation Logic

Warnings are generated deterministically based on model outcomes:

- If \( t_{\text{offset}} > 10 \):  
  `"Offset not achieved in first 10 years"`

- If \( \min_t \sigma_s(t) < 0.85 \) for any species:  
  `"Survival drops below 85%"`

- If land usage exceeds 90% of \( A_{\text{max}} \):  
  `"Land constraint nearly saturated"`

Warnings do not invalidate the plan but must be surfaced to the user.

---

## 10. Confidence Score (Heuristic)

TEME computes a heuristic confidence score:

\[
\text{confidence} =
w_1 \cdot \text{survival\_stability}
+ w_2 \cdot \text{data\_quality}
+ w_3 \cdot \text{constraint\_margin}
\]

Where:
- \( w_1 + w_2 + w_3 = 1 \)
- Each component is normalized to \([0,1]\)

This score is **not probabilistic** and is used only for interpretability.

---

## 11. Failure Conditions

The TEME core must fail explicitly if:

- No \( t_{\text{offset}} \le T \) exists
- Land constraints are violated
- No viable species exist for the given location

Silent degradation or fabricated mitigation plans are prohibited.

---

## 12. Design Principles

- Deterministic: identical input yields identical output
- Conservative: avoids optimistic offset assumptions
- Explainable: every output traceable to a rule or equation
- Auditable: all decisions defensible in review or viva

---

## 13. Scope Boundaries

This model explicitly excludes:
- soil carbon sequestration
- biodiversity impact
- ecosystem services valuation
- climate feedback loops
- economic cost modeling

These exclusions are intentional.