<div align="center">

# ðŸŒ CarbonSense

### Multi-Agentic Carbon Intelligence Platform

[![Python](https://img.shields.io/badge/Python-3.9+-3776AB?logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18+-61DAFB?logo=react&logoColor=black)](https://reactjs.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-4169E1?logo=postgresql&logoColor=white)](https://postgresql.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

*AI-powered carbon footprint tracking, reduction, and offset platform for individuals and SMEs*

[Features](#-features) Â· [Architecture](#-architecture) Â· [Getting Started](#-getting-started) Â· [Project Structure](#-project-structure) Â· [Team](#-team)

</div>

---

## ðŸ“Œ About

**CarbonSense** is a multi-agentic platform that combines 7+ specialized AI agents to provide comprehensive carbon footprint management. Unlike existing solutions that focus on single categories or offer greenwashed "plant a tree" offsets, CarbonSense provides:

- **Multi-modal carbon tracking** across transport, energy, food, and waste
- **Scientifically honest tree-based offsets** with survival-weighted time-debt modeling
- **Automated policy compliance** with Budget 2026 and CCUS intelligence
- **Explainable AI** so users understand every recommendation

> *We believe in reduction-first, planting-second. Every recommendation shows both options with transparent trade-offs.*

---

## âœ¨ Features

### ðŸ”¢ Carbon Calculation Engine
- Manual emission entry (transport, energy, food, waste)
- Receipt OCR (Tesseract + EasyOCR) with NER-based carbon mapping
- Food image recognition (EfficientNet-B4 fine-tuned on Food-101 + Indian foods)
- Bank transaction categorization (FinBERT NLP)
- Waste classification (YOLO v8)

### ðŸŒ³ TEME â€” Tree-based Emission Mitigation Engine
- Rule-based + ML-enhanced species recommendation
- Survival-weighted offset projections (no instant offsets â€” honest time-debt curves)
- 20+ Indian tree species with peer-reviewed absorption data
- Optional RandomForest survival adjustment model
- Deterministic core guaranteed â€” ML failure never breaks TEME

### ðŸ“œ Policy & CCUS NLP Module
- Automated policy document ingestion (PDF/HTML)
- BERT NER for clause entity extraction (penalties, deadlines, funding amounts)
- Clause classification (penalty | incentive | reporting | funding | tech-mandate)
- Budget 2026 CCUS allocation tracking (â‚¹20,000 crore)
- Personalized compliance advice with actionable steps

### ðŸ“ˆ Time-Series Forecasting
- Prophet + Temporal Fusion Transformer (TFT)
- Emission trend prediction with confidence intervals
- Anomaly detection for unusual emission spikes
- What-if scenario analysis (reduction vs planting vs mixed)

### ðŸ§  Explainable AI (XAI)
- SHAP explanations for all ML models
- LIME for text-based NLP predictions
- Attention visualization for transformer models
- "Why was this species recommended?" waterfall charts

### ðŸ¤– Behavioral RL Nudging
- DQN-based personalized intervention timing
- Policy-aware nudging (deadline reminders, urgency-based alerts)
- A/B testing framework for nudge optimization

### â›“ï¸ Blockchain Integration
- Carbon credit tokenization
- Tree planting verification (GPS-tagged photos â†’ immutable records)
- NFT minting for verified plantings
- Time-based credit vesting (credits unlock as trees grow)

### ðŸŽ® Gamification
- Achievement badges (First Planter, Forest Guardian, Carbon Warrior)
- Leaderboards (individual, organization, city-level)
- Monthly challenges with rewards

---

## ðŸ— Architecture

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚              PRESENTATION LAYER                          â”‚
â”‚     React 18 (Web)  |  React Native (Mobile)            â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                            â†•
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                  API GATEWAY (Express.js)                 â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                            â†•
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚              MICROSERVICES LAYER                          â”‚
â”‚  Carbon Calc | TEME | Policy NLP | Analytics | Blockchainâ”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                            â†•
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚              AI/ML AGENT LAYER (Python FastAPI)           â”‚
â”‚  Transport | Energy | Food | Waste | TEME | Policy       â”‚
â”‚  Forecasting | XAI | Behavioral RL                       â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                            â†•
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                    DATA LAYER                             â”‚
â”‚  PostgreSQL+PostGIS | MongoDB | Redis | TimescaleDB       â”‚
â”‚  Blockchain Ledger                                        â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

### Key Design Principles
- **ML failure never crashes the platform** â€” every model has a deterministic fallback
- **Microservice isolation** â€” services communicate via HTTP APIs only
- **Transparency** â€” every ML response includes model version, confidence, and enabled status
- **Reduction-first** â€” always recommend immediate reductions before long-term offsets
- **Scientific rigor** â€” conservative estimates, peer-reviewed data, honest about uncertainty

---

## ðŸš€ Getting Started

### Prerequisites
- Python 3.9+
- Node.js 18+
- PostgreSQL 15+
- Redis 7+
- Git

### TEME Service (Quick Start)

```bash
# Clone the repository
git clone https://github.com/Daksh1119/CarbonSense.git
cd CarbonSense

# Navigate to TEME service
cd packages/ml_services/teme

# Install Python dependencies
pip install fastapi uvicorn joblib numpy scikit-learn

# Install TEME in editable mode
pip install -e .

# Run the TEME service
uvicorn teme.api.app:app --host 127.0.0.1 --port 8000 --reload
```

Open Swagger UI at: **http://127.0.0.1:8000/docs**

### Test Payload

```json
{
  "emission_kg": 1000,
  "activity_breakdown": {
    "transport": 400,
    "energy": 350,
    "food": 250
  },
  "location": "India",
  "start_year": 2026,
  "time_horizon_years": 20,
  "constraints": {
    "max_land_area_hectare": 5
  },
  "ml": {
    "enabled": true
  }
}
```

---

## ðŸ“ Project Structure

```
CarbonSense/
â”œâ”€â”€ packages/
â”‚   â”œâ”€â”€ ml_services/
â”‚   â”‚   â””â”€â”€ teme/                    # TEME Engine
â”‚   â”‚       â”œâ”€â”€ core/                # Deterministic engine (no ML deps)
â”‚   â”‚       â”‚   â”œâ”€â”€ engine.py        # run_teme() â€” main entry
â”‚   â”‚       â”‚   â”œâ”€â”€ optimizer.py     # Species selection
â”‚   â”‚       â”‚   â”œâ”€â”€ sequestration.py # Î±(t) absorption curves
â”‚   â”‚       â”‚   â”œâ”€â”€ survival.py      # Ïƒ(t) survival curves
â”‚   â”‚       â”‚   â”œâ”€â”€ land.py          # Land constraint calculator
â”‚   â”‚       â”‚   â””â”€â”€ exceptions.py    # Custom exceptions
â”‚   â”‚       â”œâ”€â”€ api/                 # FastAPI service layer
â”‚   â”‚       â”‚   â””â”€â”€ app.py           # POST /teme/run
â”‚   â”‚       â”œâ”€â”€ data/                # Species catalog
â”‚   â”‚       â”‚   â””â”€â”€ species_catalog.py
â”‚   â”‚       â”œâ”€â”€ ml/                  # Optional ML layer
â”‚   â”‚       â”‚   â”œâ”€â”€ survival.py      # RF survival adjustment
â”‚   â”‚       â”‚   â””â”€â”€ models/          # .pkl model files
â”‚   â”‚       â”œâ”€â”€ tests/               # Test suite
â”‚   â”‚       â””â”€â”€ pyproject.toml
â”‚   â”œâ”€â”€ backend/                     # Express.js API (planned)
â”‚   â”œâ”€â”€ frontend/                    # React 18 app (planned)
â”‚   â””â”€â”€ mobile/                      # React Native app (planned)
â”œâ”€â”€ docs/                            # Documentation
â”œâ”€â”€ .github/                         # CI/CD workflows
â””â”€â”€ README.md
```

---

## ðŸ§ª Running Tests

```bash
cd packages/ml_services/teme
pytest -v
```

---

## ðŸ“Š Current Status

| Module | Status | Progress |
|--------|--------|----------|
| TEME Core Engine | âœ… Complete | Deterministic engine fully functional |
| TEME ML Layer | âœ… Complete | RF survival model trained and integrated |
| TEME API | âœ… Complete | FastAPI + Swagger UI operational |
| Carbon Calc Engine | ðŸ”§ In Progress | Manual entry + OCR pipeline |
| Policy NLP | ðŸ“‹ Planned | BERT NER + clause classifier |
| Time-Series Forecasting | ðŸ“‹ Planned | Prophet + TFT |
| XAI Layer | ðŸ“‹ Planned | SHAP + LIME |
| Behavioral RL | ðŸ“‹ Planned | DQN nudging |
| Blockchain | ðŸ“‹ Planned | Carbon credits + verification |
| Frontend | ðŸ“‹ Planned | React 18 dashboard |
| Mobile App | ðŸ“‹ Planned | React Native |

---

## ðŸ‘¥ Team

| Role | Responsibility |
|------|---------------|
| **Member 1** â€” Frontend & UI/UX Lead | React, data visualization, TEME/Policy UI, mobile app |
| **Member 2** â€” Backend & Infrastructure Lead | Express.js APIs, PostgreSQL, DevOps, blockchain |
| **Member 3** â€” AI/ML & Data Science Lead | All ML models, TEME engine, Policy NLP, XAI, RL |

---

## ðŸ“„ License

This project is licensed under the MIT License â€” see the [LICENSE](LICENSE) file for details.

---

## ðŸ”¬ Research

This project contributes to 3 research papers:

1. **"Multi-Agentic AI for SME Carbon Management"** â€” Systems architecture
2. **"Time-Debt Modeling for Tree-Based Carbon Offsets"** â€” TEME engine (Environmental Science)
3. **"Automated Policy Compliance via NLP"** â€” Policy module (NLP/AI)

---

<div align="center">

**Built with scientific rigor. No greenwashing. Reduction-first, always.**

ðŸŒ *You're not just tracking carbon. You're making a difference.* ðŸŒ±

</div>
