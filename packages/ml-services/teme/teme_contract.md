# TEME (Time-based Ecological Mitigation Engine) Contract

This document defines the **input/output contract** for the TEME engine.

TEME is a deterministic, time-aware decision engine for estimating
long-term ecological mitigation of carbon emissions via afforestation.
The engine prioritizes realism, conservatism, and explainability over
optimistic offset claims.

This contract is **frozen** and must be adhered to by all consuming services.

---

## Input Schema

TEME accepts the following input as a JSON object.
All values are mandatory unless explicitly stated.

### Fields

- `emission_kg` (float)  
  Total carbon emissions in **kg CO₂e** to be mitigated.

- `activity_breakdown` (object)  
  Sector-wise emission split (e.g., transport, energy, food).  
  Used **only for explainability and reporting**.  
  Values must sum approximately to `emission_kg`.

- `location` (string)  
  Geographic region determining species viability, survival probability,
  and sequestration rates (e.g., country or ecological zone).

- `start_year` (int)  
  Calendar year in which mitigation actions (planting) begin.

- `time_horizon_years` (int)  
  Maximum number of years over which mitigation is modeled.

- `constraints` (object)  
  Physical and policy constraints applied to the mitigation plan:
  - `max_land_area_hectare` (float):  
    Upper bound on land available for afforestation.
  - `preferred_species` (array of strings, optional):  
    Species that should be prioritized if feasible.
  - `exclude_species` (array of strings, optional):  
    Species that must not be selected.

---

## Output Schema

TEME guarantees the following outputs **if and only if**
a feasible mitigation plan exists within the provided constraints.

### Fields

- `offset_plan` (array of objects)  
  Species-wise mitigation plan. Each entry contains:
  - `species` (string)
  - `count` (int): number of trees planted
  - `annual_sequestration_kg` (array of floats)
  - `survival_curve` (array of floats ∈ [0,1])
  - `offset_year` (int): year offset at which cumulative neutrality is achieved

- `total_trees` (int)  
  Total number of trees proposed across all species.

- `land_required_hectare` (float)  
  Estimated land area required to execute the offset plan.

- `time_to_neutral_years` (int)  
  Number of years required to reach cumulative carbon neutrality.
  Must be ≤ `time_horizon_years`.

- `confidence_score` (float ∈ [0,1])  
  Heuristic confidence level of the proposed mitigation plan.

- `warnings` (array of strings)  
  Risk indicators, assumptions, or limitations associated with the plan.

---

## Infeasible Plans

If no feasible mitigation plan exists within the given constraints,
TEME must return:

- `offset_plan`: empty array
- `time_to_neutral_years`: null
- `total_trees`: 0
- `land_required_hectare`: null
- `confidence_score`: ≤ 0.3
- `warnings`: populated with explicit reasons for infeasibility  
  (e.g., land constraint too restrictive, unsuitable species for location)

TEME must **never fabricate** a mitigation plan.

---

## Temporal Semantics

- All time-series arrays are indexed by **year offset from `start_year`**.
- Index `0` represents the planting year.
- Annual sequestration values represent **net carbon absorbed during that year**.
- Survival curves represent the **fraction of surviving trees** at the end of each year.
- If time-series arrays end before `time_horizon_years`,
  values are assumed to **plateau at the final value**.

---

## Confidence Score Definition

`confidence_score` is a **heuristic indicator**, not a statistical measure.

It is derived from:
- stability of species survival curves
- availability and quality of regional sequestration data
- margin by which constraints (land, species availability) are satisfied

It **must not** be interpreted as a probabilistic confidence interval.

---

## Assumptions

- Sequestration rates are averaged from peer-reviewed or authoritative datasets.
- Climate feedback loops and extreme climate events are not modeled.
- Tree growth and survival are assumed independent between individuals.
- Soil carbon, biodiversity gain, and socio-economic effects are excluded.

---

## Non-Goals

- TEME does **not** guarantee net-zero emissions.
- TEME does **not** optimize for maximum tree count.
- TEME does **not** model soil carbon, biodiversity, or ecosystem services.
- TEME does **not** replace verified carbon offset standards.

---

## Contract Stability

Any change to this contract:
- requires a major version increment
- must be approved by the AI/ML lead
- must trigger downstream service review
