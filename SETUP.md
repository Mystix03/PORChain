# SETUP.md – Quick Start Guide for ColdStart‑PoR

## Overview
This repository contains two main parts:
1. **Backend (`backend/`)** – a Python FastAPI node that runs the PoR‑Chain.
2. **Web frontend (`apps/web/`)** – a React application built with Vite and `react‑router`.

The goal of this guide is to let a new developer get the whole system running on a **single machine** with minimal friction.

---

## 1. Prerequisites
| Tool | Version | Installation Command |
|------|---------|----------------------|
| **Python** | `>=3.12` | Use [pyenv](https://github.com/pyenv/pyenv) or the official installer. |
| **Node.js** | `>=20` | `nvm install 20 && nvm use 20` |
| **Yarn** (or npm) | `>=1.22` | `npm install -g yarn` |
| **Git** | any recent version | Pre‑installed on most systems. |
| **Docker** *(optional but recommended for a one‑command setup)* | `>=24` | Follow instructions on https://docs.docker.com/engine/install/ |

> **Tip:** On Windows, use **WSL2** or **Git Bash** to avoid path‑related quirks.

---

## 2. Clone the Repository
```bash
# Choose a location you like
cd ~/projects
git clone https://github.com/a-malware/Ascent.git
cd Ascent
```

---

## 3. Backend Setup (Python)
### 3.1 Create a virtual environment
```bash
python -m venv .venv
source .venv/bin/activate   # On Windows: .venv\Scripts\activate
```
### 3.2 Install dependencies
```bash
pip install -r backend/requirements.txt
```
> The `requirements.txt` pins stable versions of `scikit‑learn`, `numpy` and `requests`.
### 3.3 Environment variables
Create a `.env` file in the repository root (or set variables in your shell). Only a few values are needed – the defaults already match the paper.
```
# .env (optional)
NODE_PORT=5000                 # Port the FastAPI server will listen on
PEERS=                         # Comma‑separated list of peer URLs (empty for a solo node)
DATA_DIR=backend/data          # Where chain JSON files are stored
```
The backend reads these variables via `backend/config.py`.
### 3.4 Run the node
```bash
uvicorn backend.main:app --host 0.0.0.0 --port $NODE_PORT
```
You should see log output like:
```
⚡ POR‑Chain node starting up...
✅ Node ready on port 5000
```
The API is now available at `http://localhost:5000`.

---

## 4. Frontend Setup (React)
```bash
cd apps/web
# Install Node dependencies (yarn works, npm is fine as well)
yarn install   # or: npm ci
```
### 4.1 Configure the API endpoint
The frontend expects the backend at the same origin (`/api/...`). If you run the backend on a different host/port, set the environment variable before starting the dev server:
```bash
export VITE_API_URL="http://localhost:5000"
```
(For Windows PowerShell: `$env:VITE_API_URL="http://localhost:5000"`)
### 4.2 Start the development server
```bash
yarn dev   # or: npm run dev
```
The app will launch automatically at `http://localhost:4000` (Vite chooses the first free port).  Clicking the logo opens the Settings overlay – the issue we fixed earlier.

---

## 5. Docker‑Compose (One‑Command Alternative)
If Docker is installed, you can spin up both services with a single command. A minimal `docker-compose.yml` is already in the repo.
```bash
# From the repository root
docker compose up --build
```
This builds two images:
- `backend` – runs the Python node on port `5000`.
- `web` – runs the Vite dev server on port `4000`.
Both containers share a Docker volume (`ascent-data`) so the chain JSON state persists across restarts.

---

## 6. Running the ML Oracle (optional)
The ML side‑car lives in `scripts/ml-oracle/`.
```bash
cd scripts/ml-oracle
# Re‑use the same virtual environment as the backend
pip install -r requirements.txt
python oracle.py   # Starts the detector, connects to the Python node via REST
```
Make sure the backend is running; the oracle will poll `/api/node/state` and issue penalise calls when an anomaly is detected.

---

## 7. Testing
### Backend unit tests
```bash
cd backend
pytest   # or: python -m unittest discover
```
### Frontend component tests (Vitest)
```bash
cd apps/web
yarn test   # or: npm run test
```
All tests should pass on a clean checkout.

---

## 8. Common Troubleshooting
| Symptom | Fix |
|---------|-----|
| `Port 5000 already in use` | Stop the existing process or change `NODE_PORT` in `.env`. |
| `ImportError: cannot import name 'requests'` | Ensure you activated the virtual environment and installed `requirements.txt`. |
| Frontend cannot reach backend (CORS error) | Verify that `backend/main.py` includes the CORS middleware (it does) and that the ports match. |
| Docker compose hangs at "Building web" | Make sure Docker has enough memory (≥2 GB) and that the `node_modules` directory is not mounted from the host on Windows. |
| UI crashes after opening Settings | The pointer‑logic bug is fixed; run `git pull` to get the latest commit (`1db3392`). |

---

## 9. Quick Summary (One‑Liner)
```bash
# Clone → backend → frontend → enjoy
git clone https://github.com/a-malware/Ascent.git && cd Ascent && \ 
python -m venv .venv && source .venv/bin/activate && pip install -r backend/requirements.txt && \ 
uvicorn backend.main:app --port 5000 & cd apps/web && yarn install && yarn dev
```
*(or simply `docker compose up --build` for Docker users.)*

---

**Happy hacking!** If you run into any issues, feel free to open an issue on GitHub or ping the maintainer.
