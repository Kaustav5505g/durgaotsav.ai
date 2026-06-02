# DurgotsavAI — Smart Crowd Safety System for Durga Puja

"Celebrate safely, the smart way"
আসুন নিরাপদে পূজো উপভোগ করুন

## Live Demo
[durgotsavai.onrender.com](https://durgotsavai.onrender.com)

---

## Problem
Every Durga Puja, millions of people flood Kolkata's streets to visit pandals like Bagbazar, College Square and Deshapriya Park. These pandals become dangerously crowded with no warning system in place — no alerts, no safe route suggestions, nothing.

---

## Solution
DurgotsavAI is an AI-powered crowd safety platform built specifically for Durga Puja. It uses a Machine Learning model to predict crowd density and risk levels in real time, displayed on a live interactive map of Kolkata.

---

## Features
- Live Risk Map — Color-coded pandal indicators (Green / Yellow / Red)
- ML Crowd Prediction — 81.67% accurate Random Forest model
- 6-Hour Forecast — See crowd levels before you leave home
- Pandal Hopping Planner — AI suggests safest route through multiple pandals
- Safe Alternatives — Suggests nearby safer pandals when one is too crowded
- Weather Simulation — See how rain affects crowd patterns
- Works on any browser — No app install needed

---

## Tech Stack
| Layer | Technology |
|---|---|
| Machine Learning | Random Forest Classifier (scikit-learn) |
| Backend | Python + Flask |
| Frontend | HTML + CSS + JavaScript + Leaflet.js |
| Data | Synthetic crowd data (1800+ records) |
| Routing | OSRM API |
| Deployment | Render Cloud |

---

## Project Structure

    durgaotsav.ai/
    ├── app/
    │   ├── templates/
    │   │   └── index.html
    │   └── app.py
    ├── model/
    │   ├── durgotsavai_model.pkl
    │   ├── le_pandal.pkl
    │   └── le_weather.pkl
    ├── data/
    │   └── durgotsavai_crowd_data.csv
    ├── requirements.txt
    └── render.yaml

---

## Run Locally

    git clone https://github.com/Kaustav5505g/durgaotsav.ai.git
    pip install -r requirements.txt
    cd app
    python app.py

Then open http://127.0.0.1:5000 in your browser.

---

## How It Works
1. Synthetic crowd data generated from real Puja patterns
2. Random Forest ML model trained with 81.67% accuracy
3. Live predictions mapped on Kolkata pandals
4. User gets safe route and crowd forecast instantly

---

## Team
Neozen — Kaustav Paul
Built solo — end to end

---

## Built For
Tradition Hacks 2026 — Where Heritage Meets Innovation
Organized by Miro Meetups Kolkata