<div align="center">

# 🌍 CarbonSense

### Multi-Agentic Carbon Intelligence Platform

[![Python](https://img.shields.io/badge/Python-3.9+-3776AB?logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18+-61DAFB?logo=react&logoColor=black)](https://reactjs.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-4169E1?logo=postgresql&logoColor=white)](https://postgresql.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

*AI-powered carbon footprint tracking, reduction, and offset platform for individuals and SMEs*

[Features](#-features) · [Architecture](#-architecture) · [Getting Started](#-getting-started) · [Project Structure](#-project-structure) · [Team](#-team)

</div>

---

## 📌 About

**CarbonSense** is a multi-agentic platform that combines 7+ specialized AI agents to provide comprehensive carbon footprint management. Unlike existing solutions that focus on single categories or offer greenwashed "plant a tree" offsets, CarbonSense provides:

- **Multi-modal carbon tracking** across transport, energy, food, and waste
- **Scientifically honest tree-based offsets** with survival-weighted time-debt modeling
- **Automated policy compliance** with Budget 2026 and CCUS intelligence
- **Explainable AI** so users understand every recommendation

> *We believe in reduction-first, planting-second. Every recommendation shows both options with transparent trade-offs.*

---

## ✨ Features

### 🔢 Carbon Calculation Engine
- Manual emission entry (transport, energy, food, waste)
- Receipt OCR (Tesseract + EasyOCR) with NER-based carbon mapping
- Food image recognition (EfficientNet-B4 fine-tuned on Food-101 + Indian foods)
- Bank transaction categorization (FinBERT NLP)
- Waste classification (YOLO v8)

### 🌳 TEME — Tree-based Emission Mitigation Engine
- Rule-based + ML-enhanced species recommendation
- Survival-weighted offset projections (no instant offsets — honest time-debt curves)
- 20+ Indian tree species with peer-reviewed absorption data
- Optional RandomForest survival adjustment model
- Deterministic core guaranteed — ML failure never breaks TEME

### 📜 Policy & CCUS NLP Module
- Automated policy document ingestion (PDF/HTML)
- BERT NER for clause entity extraction (penalties, deadlines, funding amounts)
- Clause classification (penalty | incentive | reporting | funding | tech-mandate)
- Budget 2026 CCUS allocation tracking (₹20,000 crore)
- Personalized compliance advice with actionable steps

### 📈 Time-Series Forecasting
- Prophet + Temporal Fusion Transformer (TFT)
- Emission trend prediction with confidence intervals
- Anomaly detection for unusual emission spikes
- What-if scenario analysis (reduction vs planting vs mixed)

### 🧠 Explainable AI (XAI)
- SHAP explanations for all ML models
- LIME for text-based NLP predictions
- Attention visualization for transformer models
- "Why was this species recommended?" waterfall charts

### 🤖 Behavioral RL Nudging
- DQN-based personalized intervention timing
- Policy-aware nudging (deadline reminders, urgency-based alerts)
- A/B testing framework for nudge optimization

### ⛓️ Blockchain Integration
- Carbon credit tokenization
- Tree planting verification (GPS-tagged photos → immutable records)
- NFT minting for verified plantings
- Time-based credit vesting (credits unlock as trees grow)

### 🎮 Gamification
- Achievement badges (First Planter, Forest Guardian, Carbon Warrior)
- Leaderboards (individual, organization, city-level)
- Monthly challenges with rewards

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────┐
│              PRESENTATION LAYER                          │
│     React 18 (Web)  |  React Native (Mobile)            │
└───────────────────────────┬─────────────────────────────┘
                            ↕
┌───────────────────────────┴─────────────────────────────┐
│                  API GATEWAY (Express.js)                 │
└───────────────────────────┬─────────────────────────────┘
                            ↕
┌───────────────────────────┴─────────────────────────────┐
│              MICROSERVICES LAYER                          │
│  Carbon Calc | TEME | Policy NLP | Analytics | Blockchain│
└───────────────────────────┬─────────────────────────────┘
                            ↕
┌───────────────────────────┴─────────────────────────────┐
│              AI/ML AGENT LAYER (Python FastAPI)           │
│  Transport | Energy | Food | Waste | TEME | Policy       │
│  Forecasting | XAI | Behavioral RL                       │
└───────────────────────────┬─────────────────────────────┘
                            ↕
┌───────────────────────────┴─────────────────────────────┐
│                    DATA LAYER                             │
│  PostgreSQL+PostGIS | MongoDB | Redis | TimescaleDB       │
│  Blockchain Ledger                                        │
└─────────────────────────────────────────────────────────┘
```

### Key Design Principles
- **ML failure never crashes the platform** — every model has a deterministic fallback
- **Microservice isolation** — services communicate via HTTP APIs only
- **Transparency** — every ML response includes model version, confidence, and enabled status
- **Reduction-first** — always recommend immediate reductions before long-term offsets
- **Scientific rigor** — conservative estimates, peer-reviewed data, honest about uncertainty

---

## 🚀 Getting Started

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
cd packages/ml-services/teme

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

## 📁 Project Structure

```
CarbonSense/
├── packages/
│   ├── ml-services/
│   │   └── teme/                    # TEME Engine
│   │       ├── core/                # Deterministic engine (no ML deps)
│   │       │   ├── engine.py        # run_teme() — main entry
│   │       │   ├── optimizer.py     # Species selection
│   │       │   ├── sequestration.py # α(t) absorption curves
│   │       │   ├── survival.py      # σ(t) survival curves
│   │       │   ├── land.py          # Land constraint calculator
│   │       │   └── exceptions.py    # Custom exceptions
│   │       ├── api/                 # FastAPI service layer
│   │       │   └── app.py           # POST /teme/run
│   │       ├── data/                # Species catalog
│   │       │   └── species_catalog.py
│   │       ├── ml/                  # Optional ML layer
│   │       │   ├── survival.py      # RF survival adjustment
│   │       │   └── models/          # .pkl model files
│   │       ├── tests/               # Test suite
│   │       └── pyproject.toml
│   ├── backend/                     # Express.js API (planned)
│   ├── frontend/                    # React 18 app (planned)
│   └── mobile/                      # React Native app (planned)
├── docs/                            # Documentation
├── .github/                         # CI/CD workflows
└── README.md
```

---

## 🧪 Running Tests

```bash
cd packages/ml-services/teme
pytest -v
```

---

## 📊 Current Status

| Module | Status | Progress |
|--------|--------|----------|
| TEME Core Engine | ✅ Complete | Deterministic engine fully functional |
| TEME ML Layer | ✅ Complete | RF survival model trained and integrated |
| TEME API | ✅ Complete | FastAPI + Swagger UI operational |
| Carbon Calc Engine | 🔧 In Progress | Manual entry + OCR pipeline |
| Policy NLP | 📋 Planned | BERT NER + clause classifier |
| Time-Series Forecasting | 📋 Planned | Prophet + TFT |
| XAI Layer | 📋 Planned | SHAP + LIME |
| Behavioral RL | 📋 Planned | DQN nudging |
| Blockchain | 📋 Planned | Carbon credits + verification |
| Frontend | 📋 Planned | React 18 dashboard |
| Mobile App | 📋 Planned | React Native |

---

## 👥 Team

| Role | Responsibility |
|------|---------------|
| **Member 1** — Frontend & UI/UX Lead | React, data visualization, TEME/Policy UI, mobile app |
| **Member 2** — Backend & Infrastructure Lead | Express.js APIs, PostgreSQL, DevOps, blockchain |
| **Member 3** — AI/ML & Data Science Lead | All ML models, TEME engine, Policy NLP, XAI, RL |

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

## 🔬 Research

This project contributes to 3 research papers:

1. **"Multi-Agentic AI for SME Carbon Management"** — Systems architecture
2. **"Time-Debt Modeling for Tree-Based Carbon Offsets"** — TEME engine (Environmental Science)
3. **"Automated Policy Compliance via NLP"** — Policy module (NLP/AI)

---

<div align="center">

**Built with scientific rigor. No greenwashing. Reduction-first, always.**

🌍 *You're not just tracking carbon. You're making a difference.* 🌱

</div>