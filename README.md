# TrackIntern

TrackIntern is an internship tracking and decision-support platform designed to help students discover relevant opportunities, evaluate eligibility, manage applications, maintain supporting evidence, and make better internship decisions.

The project uses a modular monolith backend with MongoDB as the primary data store. The frontend is developed separately and consumes the backend through the documented API contracts.

---

## Project Status

**Current phase:** Backend foundation and API contract implementation.

The repository structure and local development environment are established. Application features are implemented incrementally according to the API, architecture, and database contracts.

---

## Architecture

TrackIntern follows a **modular monolith** architecture. The backend is deployed as a single application while maintaining clear boundaries between business domains. It contains independent domain modules rather than separate microservices.

```text
                        ┌──────────────────────┐
                        │      Frontend         │
                        │   Separate Project    │
                        └──────────┬───────────┘
                                   │
                                   │ HTTP / JSON
                                   ▼
                        ┌──────────────────────┐
                        │   Express Backend     │
                        │                       │
                        │  Routes               │
                        │    ↓                  │
                        │  Controllers          │
                        │    ↓                  │
                        │  Services              │
                        │    ↓                  │
                        │  Repositories          │
                        └──────────┬───────────┘
                                   │
                                   ▼
                        ┌──────────────────────┐
                        │       MongoDB         │
                        └──────────────────────┘
```

---

## Repository Structure

```text
TrackIntern/
│
├── backend/
│   ├── src/
│   │   ├── config/
│   │   ├── core/
│   │   ├── middlewares/
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   ├── users/
│   │   │   ├── internships/
│   │   │   ├── applications/
│   │   │   ├── eligibility/
│   │   │   ├── evidence/
│   │   │   ├── verification/
│   │   │   ├── mentorship/
│   │   │   ├── workflow/
│   │   │   ├── risk/
│   │   │   ├── analytics/
│   │   │   ├── recommendations/
│   │   │   └── notifications/
│   │   └── shared/
│   │
│   ├── tests/
│   │   ├── unit/
│   │   ├── integration/
│   │   └── fixtures/
│   │
│   ├── scripts/
│   ├── Dockerfile
│   ├── package.json
│   └── package-lock.json
│
├── docker/
│
├── docs/
│   ├── api/
│   │   └── API_CONTRACTS.md
│   ├── architecture/
│   │   └── ARCHITECTURE.md
│   ├── database/
│   │   └── DATABASE.md
│   └── development/
│       └── README.md
│
├── scripts/
│
├── .dockerignore
├── .env.example
├── .gitignore
├── docker-compose.yml
└── README.md
```

---

## Backend Modules

| Module | Responsibility |
|---|---|
| auth | Authentication and authorization foundation |
| users | User profiles and account-related data |
| internships | Internship opportunity data and lifecycle |
| applications | Student applications and application state |
| eligibility | Internship eligibility evaluation |
| evidence | Supporting evidence associated with user/application data |
| verification | Verification-related workflows |
| mentorship | Mentorship-related functionality |
| workflow | Application and domain workflow state management |
| risk | Risk and decision-support evaluation |
| analytics | Application and internship analytics |
| recommendations | Internship and skill-overlap recommendations |
| notifications | Notification and event-related functionality |

Each module owns its domain behavior and persistence boundaries.

---

## Technology Stack

**Backend:** Node.js 24, Express, JavaScript (ES Modules)
**Database:** MongoDB, Mongoose
**Validation:** Zod
**Authentication:** JSON Web Tokens, bcrypt
**Security:** Helmet, CORS, HTTP cookie support
**Logging:** Pino, Pino HTTP
**Development:** npm, Node.js native test runner, Docker, Docker Compose

---

## Prerequisites

- Node.js 24+
- npm
- Docker Desktop
- Docker Compose
- Git

When developing through WSL 2, Docker Desktop must have WSL integration enabled for the relevant distribution.

Verify the installation:

```bash
node --version
npm --version
docker --version
docker compose version
git --version
```

---

## Getting Started

### 1. Clone the repository

```bash
git clone git@github.com:dipak0000812/TrackIntern.git
cd TrackIntern
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Update the values in `.env` before running the application. Never commit `.env` to Git.

### 3. Start MongoDB

MongoDB is provided through Docker Compose. From the repository root:

```bash
docker compose up -d mongodb
```

Check the container:

```bash
docker compose ps
```

Stop MongoDB:

```bash
docker compose down
```

MongoDB data is stored in a Docker-managed volume so that restarting the container does not remove the local database.

### 4. Backend setup

```bash
cd backend
npm install
```

### 5. Run the backend

Development (Node.js watch mode):

```bash
npm run dev
```

Normal start:

```bash
npm start
```

---

## Testing

Run the complete test suite:

```bash
npm test
```

Run tests in watch mode:

```bash
npm run test:watch
```

Tests are organized into:

```text
tests/
├── unit/
├── integration/
└── fixtures/
```

Unit tests cover isolated domain behavior. Integration tests cover interactions between application components and external dependencies such as MongoDB.

---

## Environment Variables

Required environment variables are documented in `.env.example`. The local `.env` file must contain environment-specific values.

Typical configuration includes:

```
NODE_ENV
PORT
API_PREFIX
MONGODB_URI
JWT_SECRET
JWT_EXPIRES_IN
JWT_REFRESH_SECRET
JWT_REFRESH_EXPIRES_IN
CORS_ORIGIN
LOG_LEVEL
```

Secrets must never be committed to the repository.

---

## API

The backend API is versioned under `/api/v1`. API behavior is defined in `docs/api/API_CONTRACTS.md`, which is the interface between the backend and the separately developed frontend. Changes to an existing API contract should be reviewed before implementation.

---

## Database

TrackIntern uses MongoDB as its primary application database. Database design principles and domain boundaries are documented in `docs/database/DATABASE.md`. MongoDB access is isolated behind the backend's persistence boundaries rather than being accessed directly from controllers.

---

## Architecture Documentation

The backend architecture is documented in `docs/architecture/ARCHITECTURE.md`. The architecture follows these principles:

- Modular monolith
- Explicit domain boundaries
- Centralized configuration
- Centralized error handling
- Validated external input
- Isolated persistence logic
- Deterministic domain rules where required
- Minimal infrastructure
- Independently testable modules

## Documentation

| Document | Purpose |
|---|---|
| `docs/api/API_CONTRACTS.md` | Backend API interface |
| `docs/architecture/ARCHITECTURE.md` | Application architecture and module boundaries |
| `docs/database/DATABASE.md` | Database design and persistence rules |
| `docs/development/README.md` | Local development workflow |

The codebase remains the primary implementation source of truth. Documentation should be updated when an established contract or architectural decision changes.

---

## Docker

Docker is used primarily to provide a reproducible development environment for infrastructure such as MongoDB.

```bash
docker compose up -d mongodb   # start development database
docker compose down            # stop development environment
docker compose ps              # view running containers
```

The backend also contains a `Dockerfile` so that the application can be containerized for deployment.

---

