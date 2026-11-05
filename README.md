# RootPulse AI

**Smart Irrigation. Thriving Farms.**

RootPulse AI is a software-only hackathon project for Green Planet challenge GP-02: AI-Based Precision Irrigation Advisory. It aims to help growers make more informed irrigation decisions using crop, soil-moisture, and weather context. The app currently provides a responsive dashboard, crop image analysis, and an initial rule-based irrigation advisory with location-based weather when available. Dashboard overview values remain illustrative, and the irrigation thresholds need agronomic validation.

## Planned features

- Crop health analysis from grower-provided images
- Soil-moisture advisory and irrigation recommendations
- Weather alerts and forecast context
- Crop progress tracking
- Multilingual crop assistance

## Technology

- Frontend: React, TypeScript, Vite, Tailwind CSS, React Router, Axios, Recharts, Lucide React
- Backend: Python 3.11+, Flask, Flask-CORS, python-dotenv, SQLite, Google GenAI Python SDK

## Project layout

```
RootPulseAI/
├── frontend/                 # React application
│   ├── src/components/       # Reusable dashboard components
│   ├── src/pages/            # Route pages
│   ├── src/services/         # API client
│   ├── src/hooks/             # React hooks
│   ├── src/types/             # Shared frontend types
│   └── src/assets/            # Local assets
└── backend/
    ├── app/routes/            # Flask endpoints
    ├── app/services/          # Business services (future)
    ├── app/models/            # Database models (future)
    ├── tests/                 # Backend tests (future)
    └── uploads/                # User uploads (ignored by Git)
```

## Windows PowerShell setup

### Backend

Open a PowerShell terminal in the project folder:

```powershell
cd C:\Users\uvtav\PROJECTS\RootPulseAI
py -3.11 -m venv backend\.venv
.\backend\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r backend\requirements.txt
Copy-Item backend\.env.example backend\.env
python backend\run.py
```

The API health check is at [http://localhost:5000/api/health](http://localhost:5000/api/health). The server reads `PORT` from `backend/.env` and defaults to 5000. `GEMINI_API_KEY` is optional; Ask Your Crop shows a not-configured response until it is set in `backend/.env`.

Set a local session signing secret before using accounts. Generate one in PowerShell with:

```powershell
python -c "import secrets; print(secrets.token_hex(32))"
```

Copy the output into `SESSION_SECRET_KEY` in `backend/.env`. If left as the example placeholder, the development server generates a temporary random secret; sessions will be invalidated when the server restarts. Set `SESSION_COOKIE_SECURE=true` when serving over HTTPS. Keep it `false` for local HTTP development.

### Frontend

In a second PowerShell terminal:

```powershell
cd C:\Users\uvtav\PROJECTS\RootPulseAI\frontend
npm install
Copy-Item .env.example .env
npm run dev
```

The Vite app is at [http://localhost:5173](http://localhost:5173). Vite proxies `/api` requests to the local Flask server.

### Environment variables and secrets

Copy the relevant `.env.example` to `.env` when configuring a local environment. Real API keys must only be stored in the backend environment and must never be committed. Do not add secrets to frontend variables: Vite exposes `VITE_*` values in the browser bundle. No API key is required to run this initial foundation.

## Current scope

The Dashboard, Crop Analysis, Irrigation Advisor, Crop Progress, Ask Your Crop, and farmer authentication are implemented. The dashboard includes illustrative farm overview content. Irrigation thresholds and rainfall triggers remain illustrative and need agronomic validation. Crop analyses and irrigation requests are not stored as history. Chat history is held in browser memory only.

## Crop Analysis model integration

Crop Analysis uses the MIT-licensed [BiernyVR Crop Disease Classifier](https://huggingface.co/BiernyVR/crop-disease-classifier), an EfficientNetV2-S model exported to ONNX. The model class list includes tomato, potato, and maize leaf conditions; Rice is explicitly returned as unsupported. Model weights download from a pinned Hugging Face revision on the first supported analysis, then remain in the local Hugging Face cache. The download is about 82 MB and does not require an API key.

The model card reports evaluation on PlantVillage data. Those images show detached leaves on plain backgrounds, and the model has not been validated on field images. Its confidence field is the raw softmax score, not a calibrated chance that the diagnosis is correct. Results below the configured score/margin thresholds and results whose predicted crop differs from the selected crop are marked uncertain. This closed-set model cannot reliably reject every non-leaf or out-of-distribution photo; treat results as screening guidance and confirm suspected disease with an agronomist or extension expert before treatment.

Optional backend settings:
- CROP_MODEL_REPO: model repository (default: BiernyVR/crop-disease-classifier)
- CROP_MODEL_REVISION: pinned model revision
- CROP_MODEL_MIN_SCORE: minimum raw top-class score before a result is marked uncertain (default: 0.60)
- CROP_MODEL_MIN_MARGIN: minimum gap to the second class before a result is marked uncertain (default: 0.08)


## Irrigation Advisor

Open **Irrigation Advisor** from the sidebar or visit [http://localhost:5173/irrigation-advisor](http://localhost:5173/irrigation-advisor). Enter the crop, stage, soil type, manually measured moisture, and optionally a location. A forecast is requested only when the required field details and location are provided.

Weather is fetched from the Open-Meteo geocoding and forecast APIs. No API key is needed for this non-commercial hackathon use; an internet connection is required. The advisory does not use sensor readings, saved farm profiles, or calculate water quantities. Its configurable thresholds are illustrative only and should not be treated as validated crop-specific advice.

Optional backend settings in `backend/.env`:
- `IRRIGATION_MOISTURE_LOW` and `IRRIGATION_MOISTURE_HIGH`: base illustrative thresholds (defaults 30 and 70).
- `IRRIGATION_<STAGE>_ADJUSTMENT`: illustrative low-threshold adjustment for a growth stage.
- `RAIN_SMART_MIN_MM` and `RAIN_SMART_MIN_PROBABILITY`: rain-smart alert triggers (defaults 5 mm and 60%).
- `OPEN_METEO_TIMEOUT_SECONDS`: request timeout (default 6).

API: `POST /api/irrigation/recommend` accepts a JSON object with crop, stage, soil, moisture and optional location, field size and notes. Missing weather or required inputs produces `review_conditions`; invalid values return a clear 400 error.

## Crop Progress

Open **Crop Progress** from the sidebar or visit [http://localhost:5173/crop-progress](http://localhost:5173/crop-progress). Add a crop and optional field name, then upload JPG/JPEG/PNG progress photos (up to 10 MB) with a capture date and optional note. Photos are listed oldest-to-newest and any two can be selected for a side-by-side reference view.

The backend creates `backend/data/rootpulse.sqlite3` and its tables automatically on startup; there is no separate migration command. Original photo files are stored in `backend/uploads/`, which is excluded from Git. Existing crop-analysis results are not stored against crop records yet, so progress entries show “No linked crop analysis” until that association is implemented.

API: `GET /api/progress/crops` lists farmer-created crops, `POST /api/progress/crops` creates one, `POST /api/progress/upload` saves a dated photo, and `GET /api/progress/<crop_id>` returns that crop’s timeline. Photo files are served through a safe API reference; local filesystem paths are not returned.

## Ask Your Crop

Open **Ask Your Crop** from the sidebar or visit [http://localhost:5173/ask-your-crop](http://localhost:5173/ask-your-crop). Choose English, Tamil, or Hindi, optionally select a saved crop, and send a text question. The assistant uses saved crop type, field name, and recent farmer notes when available. Growth stage, soil moisture, crop-analysis results, weather, and irrigation recommendations are not currently persisted with crop records, so the assistant does not receive them. Conversation history stays in browser memory and is sent only as context for the current chat; it is not saved in the database.

To enable replies, copy `backend/.env.example` to `backend/.env`, set `GEMINI_API_KEY` to a Google AI Studio key, and optionally change `GEMINI_MODEL` (default: `gemini-3.5-flash`). Keep the key in the backend environment only; never put it in frontend variables or commit `backend/.env`. If no key is configured, the chat endpoint returns a clear not-configured response. The assistant uses the Google GenAI Python SDK GenerateContent API with a short timeout and bounded output. If a key was shared in chat or placed in a template, revoke it and create a replacement before use.

API: `POST /api/chat` accepts `message`, `language` (`en`, `ta`, or `hi`), optional `crop_id`, and optional recent `history`. No chat history is persisted.

## Farmer accounts

Visit [http://localhost:5173/register](http://localhost:5173/register) to create an account, then sign in at [http://localhost:5173/login](http://localhost:5173/login). Usernames are case-insensitive and unique. Passwords are hashed with Werkzeug and never returned by the API. The frontend uses an HttpOnly, SameSite=Lax session cookie; no credential or token is stored in browser local storage. Set a strong `SESSION_SECRET_KEY` in `backend/.env` before deploying, and enable `SESSION_COOKIE_SECURE=true` when using HTTPS. New registrations also set two recovery answers: pet name and childhood best friend. Answers are trimmed, case-normalized, and stored as password-style hashes. Use **Forgot Password?** on Login to verify both answers and set a new password. Recovery tokens expire after 10 minutes, are stored only as hashes, and can be used once. Recovery attempts are rate-limited per account identifier and client address. Accounts created before this change have no answers; they will receive the same generic recovery-unavailable message and must contact support or an administrator.

The SQLite database creates the users table and adds a nullable owner ID to crop profiles on backend startup. New crop and progress-photo endpoints enforce ownership in SQL queries. Existing crop rows without an owner remain unassigned and hidden from accounts until explicitly migrated by an administrator. Analysis images are processed in memory and are not retained; irrigation recommendations and chat history are not persisted. `GET /api/health` remains public; the farmer-data API endpoints require a logged-in session.

Auth API: `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, and `GET /api/auth/me`. Recovery uses `POST /api/auth/recovery/questions`, `/api/auth/recovery/verify`, and `/api/auth/recovery/reset`. The backend adds recovery-answer hashes, auth-version, token, and rate-limit tables/columns automatically on startup while preserving existing users. CORS credentials are restricted to the configured local Vite origins.
