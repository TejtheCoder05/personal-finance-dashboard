# FinanceIQ

**An end-to-end personal finance analytics dashboard powered by machine learning.**

FinanceIQ transforms raw transaction data into an interactive financial dashboard that automatically cleans transactions, normalizes merchants, predicts spending categories, detects unusual purchases, and surfaces spending insights through a responsive web interface.

The project combines a Python machine learning pipeline, a FastAPI backend, and a Next.js frontend to demonstrate a complete data-to-application workflow.

---

## Features

### Financial Analytics

* Total, average, median, and largest transaction metrics
* Monthly spending trends
* Spending breakdown by category
* Top merchants by total spending
* Recent transaction history
* Category-based transaction filtering
* Anomaly-only transaction filtering
* Adjustable transaction limits

### Machine Learning

* Merchant normalization and transaction preprocessing
* TF-IDF transaction feature engineering
* K-Means clustering
* SentenceTransformer semantic embeddings
* Semantic merchant clustering
* Machine-learning-based transaction categorization
* Isolation Forest anomaly candidate detection
* Merchant-relative anomaly validation

---

## Machine Learning Performance

### Anomaly Detection

FinanceIQ uses a hybrid anomaly-detection pipeline:

1. **Isolation Forest** identifies statistically unusual transaction candidates.
2. **Merchant-relative validation** confirms candidates whose transaction amount is at least 2x the merchant's historical median.

The final model was evaluated on a separate 500-transaction synthetic holdout dataset containing 10 injected anomalies.

| Metric                      |  Result |
| --------------------------- | ------: |
| Accuracy                    |  99.60% |
| Precision                   |  83.33% |
| Recall                      | 100.00% |
| F1 Score                    |  90.91% |
| Injected anomalies detected | 10 / 10 |
| False positives             |       2 |

The anomaly model was not further tuned using the holdout evaluation results.

### Transaction Categorization

Transaction categorization uses:

* SentenceTransformer embeddings
* Logistic Regression
* Merchant and transaction text features

The classifier achieved **100% accuracy on the project's synthetic holdout dataset**.

The holdout dataset uses the same generated merchant catalog as the development dataset, so this result measures performance within the project's controlled synthetic environment and should not be interpreted as universal accuracy on previously unseen real-world merchants.

---

## Dashboard

The responsive dashboard includes:

* Summary metric cards
* Monthly spending area chart
* Spending-by-category donut chart
* Top merchant rankings
* ML-generated anomaly alerts
* Recent transaction history
* Desktop transaction table
* Mobile transaction cards
* Category filtering
* Anomaly-only filtering
* Transaction-limit controls
* CSV upload with explicit purchase-sign handling
* CSV validation, row preview, and column mapping
* Demo Mode and uploaded-data switching
* Account-persisted CSV imports that survive refresh, sign-out, and restarts
* Savings goals with progress tracking, persisted per account when signed in
* Loading states
* API error states

The interface is designed for both desktop and mobile devices.

---

## Tech Stack

### Frontend

* Next.js 16
* React 19
* TypeScript
* Tailwind CSS 4
* Recharts

### Backend

* FastAPI
* Uvicorn
* Python 3.12
* Pandas
* NumPy
* PostgreSQL
* SQLAlchemy 2
* psycopg 3
* Alembic

### Machine Learning

* Scikit-learn
* Sentence Transformers
* Logistic Regression
* Isolation Forest
* K-Means
* TF-IDF
* Joblib

---

## Architecture

```text
Raw Transactions
       |
       v
Data Ingestion
       |
       v
Cleaning + Merchant Normalization
       |
       +----------------------+
       |                      |
       v                      v
TF-IDF Features        Semantic Embeddings
       |                      |
       v                      v
K-Means Clustering     Semantic Clustering
                              |
                              v
                    Category Classification
                              |
                              v
                     Anomaly Detection
                              |
                              v
                       Analytics Layer
                              |
                              v
                         FastAPI API
                              |
                              v
                    Next.js Dashboard
```

---

## Project Structure

```text
personal-finance-dashboard/
├── backend/
│   ├── analytics/
│   │   └── spending.py
│   ├── api/
│   │   ├── goals.py
│   │   ├── imports.py
│   │   └── main.py
│   ├── auth/
│   │   ├── dependencies.py
│   │   ├── router.py
│   │   ├── schemas.py
│   │   └── security.py
│   ├── data/
│   │   ├── analytics/
│   │   ├── processed/
│   │   ├── raw/
│   │   └── generate_synthetic.py
│   ├── ml/
│   │   ├── anomaly_detection.py
│   │   ├── categorize.py
│   │   ├── clustering.py
│   │   ├── embeddings.py
│   │   ├── features.py
│   │   └── semantic_clustering.py
│   ├── models/
│   │   ├── anomaly_detector.joblib
│   │   ├── anomaly_detector_metadata.json
│   │   ├── category_classifier.joblib
│   │   └── category_classifier_metadata.json
│   ├── db/
│   │   ├── database.py
│   │   ├── finance_store.py
│   │   ├── models.py
│   │   └── migrations/
│   ├── pipeline/
│   │   ├── clean.py
│   │   ├── ingest.py
│   │   └── merchant.py
│   └── tests/
│       ├── test_auth.py
│       ├── test_goals.py
│       └── test_imports.py
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   ├── components/
│   │   ├── lib/
│   │   └── types/
│   ├── .env.example
│   └── package.json
├── .gitignore
├── README.md
└── requirements.txt
```

---

## Dataset

FinanceIQ includes synthetic financial transaction data generated specifically for development and evaluation.

The built-in demo includes:

* 500 development transactions
* 500 separate holdout transactions
* 10 intentionally injected anomalies in each dataset
* Merchant, category, amount, and transaction-description variation

Using synthetic data keeps the repository free of real personal financial data and personally identifiable transaction information.

Users can also upload a bank or credit-card CSV from the dashboard. Uploaded
transactions are processed temporarily in memory and are not written into the
repository or used to retrain the saved models.

---

## Example Analytics

The development dataset contains 500 transactions.

| Metric              |      Value |
| ------------------- | ---------: |
| Transactions        |        500 |
| Total spending      | $26,443.22 |
| Average transaction |     $52.89 |
| Median transaction  |     $39.51 |
| Largest transaction |    $434.13 |
| Detected anomalies  |         10 |
| Anomalous spending  |  $2,311.75 |

### Spending by Category

| Category      |   Spending |
| ------------- | ---------: |
| Groceries     | $10,128.12 |
| Shopping      |  $8,845.63 |
| Fuel          |  $4,451.99 |
| Dining        |  $1,941.67 |
| Entertainment |  $1,075.81 |

---

## API

The FastAPI backend exposes the following endpoints:

| Method | Endpoint            | Description              |
| ------ | ------------------- | ------------------------ |
| GET    | `/`                 | API information          |
| GET    | `/health`           | Health check             |
| GET    | `/api/summary`      | Overall spending metrics |
| GET    | `/api/monthly`      | Monthly spending         |
| GET    | `/api/categories`   | Spending by category     |
| GET    | `/api/merchants`    | Merchant spending        |
| GET    | `/api/anomalies`    | Detected anomalies       |
| GET    | `/api/transactions` | Transaction records      |
| POST   | `/api/imports`      | Import a CSV             |
| GET    | `/api/imports`      | List the account's stored imports |
| POST   | `/api/imports/validate` | Preview and map a CSV |
| DELETE | `/api/imports/{dataset_id}` | Remove an imported dataset |
| POST   | `/api/auth/register` | Create a user account |
| POST   | `/api/auth/login` | Issue a JWT access token |
| POST   | `/api/auth/logout` | Clear the session cookie |
| GET    | `/api/auth/me` | Return the authenticated user |
| GET    | `/api/goals` | List the account's savings goals |
| POST   | `/api/goals` | Create a savings goal |
| PATCH  | `/api/goals/{goal_id}` | Update a savings goal |
| DELETE | `/api/goals/{goal_id}` | Delete a savings goal |

The transaction endpoint supports:

* `limit`
* `category`
* `anomalies_only`
* `dataset_id` (optional; defaults to Demo Mode when omitted)

The analytics endpoints also accept an optional `dataset_id` returned by
`POST /api/imports`. Imported data never replaces the synthetic demo,
training, or holdout datasets.

How a request is resolved depends on the caller:

* **Signed in** — the import is processed by the same cleaning, categorization,
  and anomaly pipeline and then persisted to PostgreSQL against the
  authenticated user. Analytics requests without a `dataset_id` return that
  user's active import, and every query is filtered by the user id resolved
  server-side, so a `dataset_id` alone can never reach another account. Users
  with no stored import continue to see the demo dataset.
* **Signed out** — the import is held in backend memory for the demo session
  and disappears when the backend restarts.

Re-uploading a byte-identical CSV with the same column mapping reactivates the
stored import instead of duplicating its transactions.

CSV imports accept a multipart `file` field and an optional `amount_sign` form
field. Files with an `Amount` column must explicitly use `purchase_positive`
or `purchase_negative`, since bank sign conventions differ. `Debit` and
`Debit Amount` columns are treated as positive purchases.

FastAPI also provides interactive Swagger documentation while the backend is running.

---

## Running Locally

### 1. Clone the repository

```bash
git clone <your-repository-url>
cd personal-finance-dashboard
```

### 2. Create a Python virtual environment

```bash
python3.12 -m venv .venv
source .venv/bin/activate
```

### 3. Install backend dependencies

```bash
python -m pip install -r requirements.txt
```

Then fetch the sentence encoder once. CSV imports load it with
`local_files_only=True` so a request never waits on the network, which means
the model must already be cached on every machine, image, or CI runner:

```bash
python -m backend.ml.embeddings --download
```

### 4. Start the FastAPI backend

From the project root:

```bash
python -m uvicorn backend.api.main:app --reload
```

Backend:

```text
http://127.0.0.1:8000
```

Swagger documentation:

```text
http://127.0.0.1:8000/docs
```

The existing Demo Mode and temporary CSV workflow do not require a database.

### PostgreSQL database foundation

Database-backed features use `DATABASE_URL`. FinanceIQ does not provide a
SQLite fallback and does not create tables during application startup.

After installing and starting PostgreSQL, create a development role and
database:

```bash
createuser --createdb --pwprompt financeiq_user
createdb --owner=financeiq_user financeiq
```

Copy the safe environment template and replace `your_password` locally:

```bash
cp .env.example .env
set -a
source .env
set +a
```

Apply and inspect the Alembic-controlled schema:

```bash
alembic upgrade head
alembic current
psql -U financeiq_user -d financeiq -c '\d users'
```

The initial migration creates the `users` table used by backend authentication.

Generate a strong local JWT secret and add it to `.env` together with the
token lifetime:

```bash
openssl rand -hex 32
```

```env
JWT_SECRET_KEY=paste_the_generated_value_here
ACCESS_TOKEN_EXPIRE_MINUTES=30
```

Registration accepts JSON containing `email` and `password`. Login follows
the OAuth2 password form convention: place the email in the `username` field
and the password in the `password` field. Protected requests use
`Authorization: Bearer <access_token>`.

### 5. Configure the frontend

Inside `frontend/`, create a `.env.local` file containing:

```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
```

The session cookie is `SameSite=Lax`, so the browser only stores and returns it
when the API shares a site with the page. Ports are irrelevant to cookies, but
hostnames are not: `localhost` and `127.0.0.1` count as **different sites**.
Browse the dashboard on the same hostname configured here, otherwise logging in
returns 200 and the very next request is still a 401.

### 6. Install frontend dependencies

```bash
cd frontend
npm install
```

### 7. Start the frontend

```bash
npm run dev
```

Open the dashboard on the same hostname as `NEXT_PUBLIC_API_URL`:

```text
http://127.0.0.1:3000
```

---

## Data and ML Pipeline

The project's processing pipeline can also be run manually from the project root.

### Ingestion

```bash
python -m backend.pipeline.ingest
```

### Cleaning

```bash
python -m backend.pipeline.clean
```

### Merchant Normalization

```bash
python -m backend.pipeline.merchant
```

### TF-IDF Feature Engineering

```bash
python -m backend.ml.features
```

### TF-IDF Clustering

```bash
python -m backend.ml.clustering
```

### Semantic Embeddings

```bash
python -m backend.ml.embeddings
```

### Semantic Clustering

```bash
python -m backend.ml.semantic_clustering
```

### Category Classification

```bash
python -m backend.ml.categorize
```

### Anomaly Detection

```bash
python -m backend.ml.anomaly_detection
```

---

## Quality Checks

### Frontend

```bash
cd frontend
npm run lint
npm run build
```

The current frontend passes:

* ESLint
* TypeScript validation
* Next.js production compilation
* Static page generation

### Backend

```bash
python -m pip check
python -m unittest discover -s backend/tests -t . -v
```

The database-backed tests are skipped unless `DATABASE_URL` is exported, and
they create and remove their own temporary accounts.

---

## Design Decisions

### Why semantic embeddings?

Real transaction descriptions can vary even when merchants belong to similar spending categories. Sentence embeddings provide richer semantic representations than keyword matching alone.

### Why combine Isolation Forest with merchant-relative validation?

Isolation Forest can identify statistically unusual transactions, but unusual transactions are not always financially meaningful anomalies.

Merchant-relative validation compares a candidate transaction with typical spending at the same merchant, reducing noise and making the alerts easier to interpret.

### Why use a separate holdout dataset?

A separate holdout dataset provides a more realistic model evaluation than measuring performance exclusively on development data.

The anomaly model was not further tuned using its holdout results.

---

## Current Limitations

* The current datasets are synthetic rather than real bank transactions.
* Category-classification evaluation uses a controlled merchant catalog.
* Anonymous demo uploads are temporary; only signed-in imports are persisted.
* The application does not currently connect directly to financial institutions.
* Model behavior has not yet been evaluated on large-scale real-world transaction data.

---

## Future Improvements

Potential extensions include:

* Plaid or another financial-data integration
* Recurring subscription detection
* Budget creation and tracking
* Spending forecasts
* Personalized financial insights
* Merchant and category correction feedback
* Model retraining from user feedback
* Multi-account support

---

## About

FinanceIQ is an end-to-end machine learning and full-stack engineering project demonstrating:

* Data ingestion and preprocessing
* Feature engineering
* Unsupervised learning
* Semantic embeddings
* Supervised classification
* Anomaly detection
* Model evaluation
* REST API development
* Responsive frontend development
* Data visualization
* Production-oriented project organization
