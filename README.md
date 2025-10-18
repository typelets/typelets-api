# Typelets API

[![Version](https://img.shields.io/github/package-json/v/typelets/typelets-api)](https://github.com/typelets/typelets-api/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-22%2B-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8%2B-blue.svg)](https://www.typescriptlang.org/)
[![Hono](https://img.shields.io/badge/Hono-4.8%2B-orange.svg)](https://hono.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15%2B-blue.svg)](https://www.postgresql.org/)
[![pnpm](https://img.shields.io/badge/pnpm-9.15.0%2B-yellow.svg)](https://pnpm.io/)

The backend API for the [Typelets Application](https://github.com/typelets/typelets-app) - a secure, encrypted notes management system built with TypeScript, Hono, and PostgreSQL. Features end-to-end encryption support, file attachments, and folder organization.

## Features

- 🔐 **Secure Authentication** via Clerk
- 📝 **Encrypted Notes** with client-side encryption support
- 📁 **Folder Organization** with nested folder support
- 📎 **File Attachments** with encrypted storage
- 🏷️ **Tags & Search** for easy note discovery
- 🗑️ **Trash & Archive** functionality
- 🔄 **Real-time Sync** via WebSockets for multi-device support
- ⚡ **Fast & Type-Safe** with TypeScript and Hono
- 🐘 **PostgreSQL** with Drizzle ORM
- 🚀 **Valkey/Redis Caching** for high-performance data access with cluster support
- 📊 **Error Tracking & Monitoring** with Sentry.io for observability and performance monitoring
- 💻 **Code Execution** via secure Judge0 API proxy
- 🛡️ **Comprehensive Rate Limiting** for HTTP, WebSocket, file uploads, and code execution
- 🏥 **Health Checks** with detailed system status and readiness probes
- 📈 **Structured Logging** with automatic event tracking and error capture

## Tech Stack

- **Runtime**: Node.js 22+ (LTS recommended)
- **Framework**: [Hono](https://hono.dev/) - Fast, lightweight web framework
- **Database**: PostgreSQL with [Drizzle ORM](https://orm.drizzle.team/)
- **Cache**: Valkey/Redis Cluster for high-performance caching
- **Authentication**: [Clerk](https://clerk.com/)
- **Validation**: [Zod](https://zod.dev/)
- **Monitoring**: [Sentry.io](https://sentry.io/) for error tracking and performance monitoring
- **Logging**: Structured JSON logging with automatic error capture
- **TypeScript**: Strict mode enabled for type safety

## Prerequisites

- Node.js 22+ (LTS recommended)
- pnpm 9.15.0+
- PostgreSQL database (local installation or Docker)
- Clerk account for authentication ([sign up here](https://dashboard.clerk.com))
- Valkey/Redis cluster for caching (optional - improves performance)
- Sentry.io account for monitoring (optional - [sign up here](https://sentry.io/signup/))
- Judge0 API key for code execution (optional - [get from RapidAPI](https://rapidapi.com/judge0-official/api/judge0-ce))

## Local Development Setup

**Recommended approach for development: PostgreSQL in Docker + API with npm for hot reload and easy debugging**

### Quick Start

1. **Clone and install dependencies:**

```bash
git clone https://github.com/typelets/typelets-api.git
cd typelets-api
pnpm install
```

2. **Start PostgreSQL with Docker:**

```bash
# Start PostgreSQL database for local development
docker run --name typelets-postgres \
  -e POSTGRES_PASSWORD=devpassword \
  -e POSTGRES_DB=typelets_local \
  -p 5432:5432 -d postgres:15
```

3. **Set up environment variables:**

```bash
cp .env.example .env
```

4. **Configure environment variables:**
   - Create a free account at [Clerk Dashboard](https://dashboard.clerk.com)
   - Create a new application
   - (Optional) Get Judge0 API key from [RapidAPI](https://rapidapi.com/judge0-official/api/judge0-ce)
   - Update `.env` with your settings:

   ```env
   CLERK_SECRET_KEY=sk_test_your_actual_clerk_secret_key_from_dashboard
   CORS_ORIGINS=http://localhost:5173,http://localhost:3000
   # Optional: For code execution features
   JUDGE0_API_KEY=your_judge0_rapidapi_key_here
   ```

5. **Set up database schema:**

```bash
pnpm run db:push
```

6. **Start development server:**

```bash
pnpm run dev
```

🎉 **Your API is now running at `http://localhost:3000`**

**WebSocket connection available at: `ws://localhost:3000`**

The development server will automatically restart when you make changes to any TypeScript files.

### Why This Setup?

✅ **PostgreSQL in Docker**: Easy to start/stop, no local PostgreSQL installation needed  
✅ **API with pnpm**: Hot reload, easy debugging, faster development cycle  
✅ **Clean separation**: Matches production architecture (API + external database)

### Development Workflow

```bash
# Start/stop database
docker start typelets-postgres    # Start existing container
docker stop typelets-postgres     # Stop when done

# API development
pnpm run dev                      # Auto-restart development server
pnpm run build                    # Test production build
pnpm run lint                     # Check code quality
```

**Development Features:**

- ⚡ **Auto-restart**: Server automatically restarts when you save TypeScript files
- 📝 **Terminal history preserved**: See all your logs and errors
- 🚀 **Fast compilation**: Uses tsx with esbuild for quick rebuilds

## Alternative Installation Methods

### Full Docker Setup (for testing production-like environment)

```bash
# 1. Start PostgreSQL
docker run --name typelets-postgres -e POSTGRES_PASSWORD=devpassword -e POSTGRES_DB=typelets_local -p 5432:5432 -d postgres:15

# 2. Build and run API in Docker
docker build -t typelets-api .
docker run -p 3000:3000 --env-file .env typelets-api
```

### Local PostgreSQL Installation

If you prefer to install PostgreSQL locally instead of Docker:

- Install PostgreSQL on your machine
- Create database: `createdb typelets_local`
- Update `.env`: `DATABASE_URL=postgresql://postgres:your_password@localhost:5432/typelets_local`

## Available Scripts

- `pnpm run dev` - Start development server with auto-restart
- `pnpm run build` - Build for production
- `pnpm start` - Start production server
- `pnpm run lint` - Run ESLint
- `pnpm run format` - Format code with Prettier
- `pnpm run db:generate` - Generate database migrations
- `pnpm run db:push` - Apply database schema changes
- `pnpm run db:studio` - Open Drizzle Studio for database management

## API Endpoints

📚 **Complete API documentation with interactive examples: [https://api.typelets.com/docs](https://api.typelets.com/docs)** (Swagger/OpenAPI)

The API provides comprehensive REST endpoints for:

- **Users** - Profile management and account deletion
- **Folders** - Hierarchical folder organization with nested support
- **Notes** - Full CRUD with encryption support, pagination, filtering, and search
- **File Attachments** - Encrypted file uploads and downloads
- **Code Execution** - Secure Judge0 API proxy for running code in multiple languages
- **Health Checks** - System health checks and status monitoring

### Public Endpoints

| Endpoint                | Description                              |
| ----------------------- | ---------------------------------------- |
| `GET /`                 | API information and version              |
| `GET /health`           | Enhanced health check with system status |
| `GET /websocket/status` | WebSocket server statistics              |

### Authentication

All `/api/*` endpoints require authentication via Bearer token:

```
Authorization: Bearer <clerk_jwt_token>
```

### Interactive Documentation

Visit the Swagger UI at [/docs](https://api.typelets.com/docs) for:

- Complete endpoint reference with request/response schemas
- Interactive "Try it out" functionality
- Example requests and responses
- Schema definitions and validation rules

### WebSocket Real-time Sync

Connect to `ws://localhost:3000` (or your deployment URL) for real-time synchronization.

**Features:**

- JWT authentication required
- Real-time note and folder updates
- Rate limiting (300 msg/min per connection)
- Connection limits (20 connections per user)

**Message types:** `auth`, `ping`/`pong`, `join_note`/`leave_note`, `note_update`, `note_created`/`note_deleted`, `folder_created`/`folder_updated`/`folder_deleted`

## Database Schema

The application uses the following main tables:

- `users` - User profiles synced from Clerk
- `folders` - Hierarchical folder organization
- `notes` - Encrypted notes with metadata
- `file_attachments` - Encrypted file attachments

## Security Features

- **Authentication**: All endpoints protected with Clerk JWT verification
- **Encryption Ready**: Schema supports client-side encryption for notes and files
- **Input Validation**: Comprehensive Zod schemas for all inputs
- **SQL Injection Protection**: Parameterized queries via Drizzle ORM
- **CORS Configuration**: Configurable allowed origins
- **File Size Limits**: Configurable limits (default: 50MB per file, 1GB total per note)
- **WebSocket Security**: JWT authentication, rate limiting, and connection limits
- **Real-time Authorization**: Database-level ownership validation for all WebSocket operations

## Environment Variables

| Variable                       | Description                                      | Required | Default                          |
| ------------------------------ | ------------------------------------------------ | -------- | -------------------------------- |
| `DATABASE_URL`                 | PostgreSQL connection string                     | Yes      | -                                |
| `CLERK_SECRET_KEY`             | Clerk secret key for JWT verification            | Yes      | -                                |
| `CORS_ORIGINS`                 | Comma-separated list of allowed CORS origins     | Yes      | -                                |
| `PORT`                         | Server port                                      | No       | 3000                             |
| `NODE_ENV`                     | Environment (development/production)             | No       | development                      |
| **Caching (Optional)**         |                                                  |          |                                  |
| `VALKEY_HOST`                  | Valkey/Redis cluster hostname                    | No       | -                                |
| `VALKEY_PORT`                  | Valkey/Redis cluster port                        | No       | 6379                             |
| **Monitoring (Optional)**      |                                                  |          |                                  |
| `SENTRY_DSN`                   | Sentry.io DSN for error tracking                 | No       | -                                |
| **Rate Limiting**              |                                                  |          |                                  |
| `HTTP_RATE_LIMIT_WINDOW_MS`    | HTTP rate limit window in milliseconds           | No       | 900000 (15 min)                  |
| `HTTP_RATE_LIMIT_MAX_REQUESTS` | Max HTTP requests per window                     | No       | 1000                             |
| `HTTP_FILE_RATE_LIMIT_MAX`     | Max file operations per window                   | No       | 100                              |
| `WS_RATE_LIMIT_WINDOW_MS`      | WebSocket rate limit window in milliseconds      | No       | 60000 (1 min)                    |
| `WS_RATE_LIMIT_MAX_MESSAGES`   | Max WebSocket messages per window                | No       | 300                              |
| `WS_MAX_CONNECTIONS_PER_USER`  | Max WebSocket connections per user               | No       | 20                               |
| `WS_AUTH_TIMEOUT_MS`           | WebSocket authentication timeout in milliseconds | No       | 30000 (30 sec)                   |
| `CODE_EXEC_RATE_LIMIT_MAX`     | Max code executions per window                   | No       | 100 (dev), 50 (prod)             |
| `CODE_EXEC_RATE_WINDOW_MS`     | Code execution rate limit window in milliseconds | No       | 900000 (15 min)                  |
| **File & Storage**             |                                                  |          |                                  |
| `MAX_FILE_SIZE_MB`             | Maximum size per file in MB                      | No       | 50                               |
| `MAX_NOTE_SIZE_MB`             | Maximum total attachments per note in MB         | No       | 1024 (1GB)                       |
| `FREE_TIER_STORAGE_GB`         | Free tier storage limit in GB                    | No       | 1                                |
| `FREE_TIER_NOTE_LIMIT`         | Free tier note count limit                       | No       | 100                              |
| **Code Execution (Optional)**  |                                                  |          |                                  |
| `JUDGE0_API_KEY`               | Judge0 API key for code execution                | No\*     | -                                |
| `JUDGE0_API_URL`               | Judge0 API base URL                              | No       | https://judge0-ce.p.rapidapi.com |
| `JUDGE0_API_HOST`              | Judge0 API host header                           | No       | judge0-ce.p.rapidapi.com         |

\*Required only for code execution features

## Monitoring with Sentry.io

⚠️ **Monitoring is completely optional** - The API works perfectly without it.

The API integrates with [Sentry.io](https://sentry.io/) for comprehensive error tracking, performance monitoring, and logging.

### Features

- **Error Tracking**: Automatic exception capture with full stack traces and context
- **Source Maps**: Production builds automatically upload source maps for readable stack traces
- **Performance Monitoring**: 100% transaction sampling for performance analysis
- **Database Monitoring**: Automatic PostgreSQL query tracking and performance analysis
- **Profiling**: CPU and memory profiling during active traces
- **Structured Logging**: Automatic capture of console.log, console.warn, and console.error
- **User Context**: Errors are automatically associated with authenticated users
- **Environment Tracking**: Separate error tracking for development and production
- **Release Tracking**: Errors automatically linked to code releases via GitHub Actions

### Configuration

Sentry is configured in the application with:

- Profiling integration enabled
- Console logging integration
- 100% trace sampling rate
- PII data collection for better debugging
- Environment-based configuration

**Setup**: Add your Sentry DSN to `.env`:

```env
SENTRY_DSN=https://your-key@your-org-id.ingest.us.sentry.io/your-project-id
```

Get your DSN from: [Sentry.io Project Settings](https://sentry.io/settings/bata-labs/projects/typelets-api/keys/)

Once configured, all errors are automatically captured and sent to Sentry with contextual information including:

- Error ID for tracking
- User ID (if authenticated)
- Request URL and method
- Stack traces

If `SENTRY_DSN` is not set, the application will run normally with error tracking disabled.

### Source Maps

Source maps are automatically generated during builds and uploaded to Sentry in production:

**Development builds:**

- Source maps are generated locally for debugging
- Not uploaded to Sentry (saves bandwidth and quota)

**Production builds:**

- Source maps are generated and uploaded to Sentry
- Requires `SENTRY_AUTH_TOKEN` environment variable
- Stack traces in Sentry show your original TypeScript code, not bundled JavaScript
- Source maps are deleted after upload to keep deployments clean

**Setup:**

1. Create a Sentry Auth Token: [Sentry Settings → Auth Tokens](https://sentry.io/settings/account/api/auth-tokens/)
2. Required scopes: `project:releases`, `project:write`
3. Add to your environment:
   ```bash
   export SENTRY_AUTH_TOKEN=your-token-here
   NODE_ENV=production pnpm run build
   ```

The build will automatically upload source maps when both `NODE_ENV=production` and `SENTRY_AUTH_TOKEN` are set.

### Automated Release Tracking

The repository includes automated Sentry release tracking via GitHub Actions. When a new release is published:

1. **Automatic Release Creation**: A Sentry release is created with the version tag
2. **Commit Association**: All commits are automatically associated with the release
3. **Error Attribution**: Errors can be traced back to specific releases

**Setup Required (One-time)**:

To enable automated release tracking and source map uploads, add your Sentry Auth Token as a GitHub secret:

1. Go to **Sentry.io** → **Settings** → **Auth Tokens**
2. Create a new token with `project:releases` and `project:write` scopes
3. In GitHub, go to **Settings** → **Secrets and variables** → **Actions**
4. Create a new secret named `SENTRY_AUTH_TOKEN` with your token value

**Note**: The same token is used for both release tracking and source map uploads during CI/CD builds.

The workflow automatically triggers on every release and:

- Creates a new Sentry release with the version tag
- Associates all commits since the last release
- Finalizes the release for tracking

## Development

### Project Structure

```
src/
├── db/
│   ├── index.ts        # Database connection
│   └── schema.ts       # Database schema definitions
├── lib/
│   ├── cache.ts        # Valkey/Redis cluster caching layer
│   ├── cache-keys.ts   # Centralized cache key patterns and TTL values
│   ├── logger.ts       # Structured logging with automatic error capture
│   └── validation.ts   # Zod validation schemas
├── middleware/
│   ├── auth.ts         # Authentication middleware
│   ├── rate-limit.ts   # Rate limiting middleware
│   ├── security.ts     # Security headers middleware
│   └── usage.ts        # Storage and usage limit enforcement
├── routes/
│   ├── code.ts         # Code execution routes (Judge0 proxy)
│   ├── files.ts        # File attachment routes
│   ├── folders.ts      # Folder management routes with caching
│   ├── notes.ts        # Note management routes
│   └── users.ts        # User profile routes
├── types/
│   └── index.ts        # TypeScript type definitions
├── websocket/
│   ├── auth/
│   │   └── handler.ts  # JWT authentication and HMAC verification
│   ├── handlers/
│   │   ├── base.ts     # Base handler for resource operations
│   │   ├── notes.ts    # Note sync operations
│   │   └── folders.ts  # Folder sync operations
│   ├── middleware/
│   │   ├── connection-manager.ts  # Connection tracking and cleanup
│   │   └── rate-limiter.ts        # WebSocket rate limiting
│   ├── types.ts        # WebSocket message types
│   └── index.ts        # Main WebSocket server manager
└── server.ts           # Application entry point
```

### Type Safety

This project uses TypeScript in strict mode with comprehensive type definitions. All database operations, API inputs, and responses are fully typed.

## Docker Support

### For Local Testing with Docker Containers

The API can be run in Docker containers for local testing. The architecture separates the API from the database:

```bash
# 1. Start PostgreSQL container for local testing
docker run --name typelets-postgres -e POSTGRES_PASSWORD=devpassword -e POSTGRES_DB=typelets_local -p 5432:5432 -d postgres:15

# 2. Build your API container
docker build -t typelets-api .

# 3. Run API container for local testing
docker run -p 3000:3000 --env-file .env typelets-api

# Run with environment file
docker run -p 3000:3000 \
  -e NODE_ENV=development \
  --env-file .env \
  typelets-api
```

**This Docker setup is for local development and testing only.**

### Production vs Local Architecture

| Environment       | API                         | Database                    | Configuration       |
| ----------------- | --------------------------- | --------------------------- | ------------------- |
| **Local Testing** | Docker container OR npm dev | Docker PostgreSQL container | `.env` file         |
| **Production**    | ECS container               | AWS RDS PostgreSQL          | ECS task definition |

## Production Deployment

**⚠️ Important: Production deployment is completely different from local testing setup.**

This application is designed for production deployment using AWS ECS (Elastic Container Service):

### Production Infrastructure:

- **API**: ECS containers running in AWS
- **Database**: AWS RDS PostgreSQL (not Docker containers)
- **Environment Variables**: ECS task definitions (not `.env` files)
- **Secrets**: AWS Parameter Store or Secrets Manager
- **Container Registry**: Amazon ECR

### Production vs Local Testing:

- **Local**: Uses `.env` files and Docker containers for testing
- **Production**: Uses ECS task definitions and AWS RDS for real deployment
- **Never use**: Local testing setup in production

For production deployment, configure the same environment variables in your ECS task definition that you use locally in `.env`.

## Contributing

We welcome contributions from the community!

### Getting Started

1. **Fork** the repository on GitHub
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/your-username/typelets-api.git
   cd typelets-api
   ```
3. **Install dependencies**: `pnpm install`
4. **Set up environment**: `cp .env.example .env`
5. **Start PostgreSQL**:
   ```bash
   docker run --name typelets-postgres \
     -e POSTGRES_PASSWORD=devpassword \
     -e POSTGRES_DB=typelets_local \
     -p 5432:5432 -d postgres:15
   ```
6. **Apply database schema**: `pnpm run db:push`
7. **Start development**: `pnpm run dev`

### Commit Message Format

We use [Conventional Commits](https://www.conventionalcommits.org/) for automatic versioning and changelog generation:

- `feat:` New feature (minor version bump)
- `fix:` Bug fix (patch version bump)
- `docs:` Documentation changes
- `style:` Code style changes (formatting, etc.)
- `refactor:` Code refactoring
- `perf:` Performance improvements
- `test:` Adding or updating tests
- `chore:` Maintenance tasks
- `ci:` CI/CD changes

**Examples:**

```bash
feat(auth): add refresh token rotation
fix(files): resolve file upload size validation
feat(api)!: change authentication header format
```

### Pull Request Process

1. Create a feature branch: `git checkout -b feature/your-feature-name`
2. Make your changes and commit using conventional commits
3. Run linting and tests: `pnpm run lint && pnpm run build`
4. Push to your fork and create a Pull Request
5. Ensure all CI checks pass
6. Wait for review and address any feedback

### Reporting Issues

When reporting bugs, please include:

- Clear description of the issue
- Steps to reproduce
- Expected vs actual behavior
- Environment details (OS, Node version)
- Error messages or logs if applicable

### Security Vulnerabilities

**DO NOT** report security vulnerabilities through public GitHub issues. Please use GitHub's private vulnerability reporting feature or contact the maintainers directly.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Hono](https://hono.dev/) for the excellent web framework
- [Drizzle ORM](https://orm.drizzle.team/) for type-safe database operations
- [Clerk](https://clerk.com/) for authentication services
