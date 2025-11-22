# Typelets API

[![Version](https://img.shields.io/github/package-json/v/typelets/typelets-api)](https://github.com/typelets/typelets-api/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-22%2B-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8%2B-blue.svg)](https://www.typescriptlang.org/)
[![Hono](https://img.shields.io/badge/Hono-4.8%2B-orange.svg)](https://hono.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15%2B-blue.svg)](https://www.postgresql.org/)
[![pnpm](https://img.shields.io/badge/pnpm-9.15.0%2B-yellow.svg)](https://pnpm.io/)

The backend API for the [Typelets Application](https://github.com/typelets/typelets-app) - a secure, encrypted notes management system built with TypeScript, Hono, and PostgreSQL. Features end-to-end encryption support, file attachments, and folder organization.

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Local Development Setup](#local-development-setup)
  - [Quick Start](#quick-start)
  - [Development Workflow](#development-workflow)
- [Alternative Installation Methods](#alternative-installation-methods)
- [Available Scripts](#available-scripts)
- [API Endpoints](#api-endpoints)
  - [Public Endpoints](#public-endpoints)
  - [Authentication](#authentication)
  - [Interactive Documentation](#interactive-documentation)
- [Database Schema](#database-schema)
- [Security Features](#security-features)
- [Environment Variables](#environment-variables)
- [Monitoring with Grafana Cloud](#monitoring-with-grafana-cloud)
  - [Features](#features-1)
  - [Configuration](#configuration)
  - [What Gets Monitored](#what-gets-monitored)
- [Development](#development)
  - [Project Structure](#project-structure)
  - [Type Safety](#type-safety)
- [Docker Support](#docker-support)
- [Production Deployment](#production-deployment)
- [Contributing](#contributing)
  - [Getting Started](#getting-started)
  - [Commit Message Format](#commit-message-format)
  - [Pull Request Process](#pull-request-process)
  - [Reporting Issues](#reporting-issues)
  - [Security Vulnerabilities](#security-vulnerabilities)
- [License](#license)
- [Acknowledgments](#acknowledgments)

## Features

- 🔐 **Secure Authentication** via Clerk
- 📝 **Encrypted Notes** with client-side encryption support
- 📁 **Folder Organization** with nested folder support
- 📎 **File Attachments** with encrypted storage
- 🏷️ **Tags & Search** for easy note discovery
- 🗑️ **Trash & Archive** functionality
- ⚡ **Fast & Type-Safe** with TypeScript and Hono
- 🐘 **PostgreSQL** with Drizzle ORM
- 🚀 **Valkey/Redis Caching** for high-performance data access with cluster support
- 📊 **Observability** with Grafana Cloud and OpenTelemetry for distributed tracing, metrics, and logging
- 💻 **Code Execution** via self-hosted Piston engine
- 🛡️ **Comprehensive Rate Limiting** for HTTP, file uploads, and code execution
- 🏥 **Health Checks** with detailed system status and readiness probes
- 📈 **Structured Logging** with automatic event tracking and error capture

## Tech Stack

- **Runtime**: Node.js 22+ (LTS recommended)
- **Framework**: [Hono](https://hono.dev/) - Fast, lightweight web framework
- **Database**: PostgreSQL with [Drizzle ORM](https://orm.drizzle.team/)
- **Cache**: Valkey/Redis Cluster for high-performance caching
- **Authentication**: [Clerk](https://clerk.com/)
- **Validation**: [Zod](https://zod.dev/)
- **Observability**: [Grafana Cloud](https://grafana.com/products/cloud/) with [OpenTelemetry](https://opentelemetry.io/) for tracing, metrics, and logging
- **Logging**: Structured JSON logging with automatic error capture
- **TypeScript**: Strict mode enabled for type safety

## Prerequisites

- Node.js 22+ (LTS recommended)
- pnpm 9.15.0+
- PostgreSQL database (local installation or Docker)
- Clerk account for authentication ([sign up here](https://dashboard.clerk.com))
- Valkey/Redis cluster for caching (optional - improves performance)
- Grafana Cloud account for monitoring (optional - [sign up here](https://grafana.com/products/cloud/))
- Piston code execution engine (optional - [self-hosted](https://github.com/engineer-man/piston))

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
   - (Optional) Set up self-hosted [Piston](https://github.com/engineer-man/piston) for code execution
   - Update `.env` with your settings:

   ```env
   CLERK_SECRET_KEY=sk_test_your_actual_clerk_secret_key_from_dashboard
   CORS_ORIGINS=http://localhost:5173,http://localhost:3000
   # Optional: For code execution features (self-hosted Piston)
   PISTON_API_URL=http://localhost:2000
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

The development server will automatically restart when you make changes to any TypeScript files.

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
- **Code Execution** - Self-hosted Piston engine for running code in multiple languages
- **Health Checks** - System health checks and status monitoring

### Public Endpoints

| Endpoint      | Description                              |
| ------------- | ---------------------------------------- |
| `GET /`       | API information and version              |
| `GET /health` | Enhanced health check with system status |

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
| `OTEL_EXPORTER_OTLP_ENDPOINT`  | Grafana Cloud OTLP endpoint (prod only)          | No       | -                                |
| `GRAFANA_CLOUD_API_KEY`        | Base64 encoded Grafana Cloud credentials         | No       | -                                |
| `OTEL_SERVICE_NAME`            | Service name for OpenTelemetry                   | No       | typelets-api                     |
| `OTEL_ENABLED`                 | Force enable OTEL in dev (not recommended)       | No       | false                            |
| **Rate Limiting**              |                                                  |          |                                  |
| `HTTP_RATE_LIMIT_WINDOW_MS`    | HTTP rate limit window in milliseconds           | No       | 900000 (15 min)                  |
| `HTTP_RATE_LIMIT_MAX_REQUESTS` | Max HTTP requests per window                     | No       | 1000                             |
| `HTTP_FILE_RATE_LIMIT_MAX`     | Max file operations per window                   | No       | 100                              |
| `CODE_EXEC_RATE_LIMIT_MAX`     | Max code executions per window                   | No       | 100 (dev), 50 (prod)             |
| `CODE_EXEC_RATE_WINDOW_MS`     | Code execution rate limit window in milliseconds | No       | 900000 (15 min)                  |
| **File & Storage**             |                                                  |          |                                  |
| `MAX_FILE_SIZE_MB`             | Maximum size per file in MB                      | No       | 50                               |
| `MAX_NOTE_SIZE_MB`             | Maximum total attachments per note in MB         | No       | 1024 (1GB)                       |
| `FREE_TIER_STORAGE_GB`         | Free tier storage limit in GB                    | No       | 1                                |
| `FREE_TIER_NOTE_LIMIT`         | Free tier note count limit                       | No       | 100                              |
| **Code Execution (Optional)**  |                                                  |          |                                  |
| `PISTON_API_URL`               | Self-hosted Piston API URL                       | No\*     | http://localhost:2000            |

\*Required only for code execution features (self-hosted Piston)

## Monitoring with Grafana Cloud

⚠️ **Monitoring is completely optional** - The API works perfectly without it.

The API integrates with [Grafana Cloud](https://grafana.com/products/cloud/) using [OpenTelemetry](https://opentelemetry.io/) for comprehensive observability with distributed tracing, metrics collection, and log aggregation.

### Features

- **Distributed Tracing**: Automatic instrumentation for HTTP requests, database queries, and cache operations
- **Metrics Collection**: Real-time metrics exported every 60 seconds
- **Log Aggregation**: Structured JSON logs sent to Grafana Loki
- **Automatic Instrumentation**: Zero-code instrumentation for:
  - HTTP/HTTPS requests (Hono framework)
  - PostgreSQL database queries
  - Redis/Upstash cache operations
- **Performance Monitoring**: Request duration, latency, and throughput tracking
- **Error Tracking**: Automatic error capture with full context and stack traces
- **User Context**: Requests are automatically tagged with user IDs
- **Environment Tracking**: Separate monitoring for development and production

### Configuration

**Local Development Setup:**

1. **Sign up for Grafana Cloud** (free tier available):
   - Visit https://grafana.com/products/cloud/

2. **Get your credentials:**
   - Go to **Connections** → **Add new connection** → **OpenTelemetry**
   - Copy the OTLP endpoint URL (e.g., `https://otlp-gateway-prod-<region>.grafana.net/otlp`)
   - Generate a token for authentication

3. **Start Grafana Alloy locally:**
   ```bash
   # Set your Grafana Cloud token in .env.local
   echo "GRAFANA_CLOUD_TOKEN=glc_your_token_here" >> .env.local

   # Start Alloy with Docker Compose
   docker compose -f docker-compose.alloy.yml up -d
   ```

4. **Configure your application:**
   Add to `.env.local`:
   ```env
   # Point to local Alloy instance
   OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
   OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
   OTEL_SERVICE_NAME=typelets-api
   OTEL_RESOURCE_ATTRIBUTES=deployment.environment=development,service.name=typelets-api
   ```

5. **Start development server:**
   ```bash
   pnpm run dev
   ```

You should see logs appearing in Grafana Cloud Loki with `service_name="typelets-api"`.

**Production Setup:**

In production (ECS), the Alloy sidecar runs in the same task as the API container. See the [Production Deployment](#production-deployment) section for details.

**Important Notes:**
- Local dev sends to Alloy at `localhost:4318`
- Alloy forwards to Grafana Cloud with authentication
- All telemetry (logs, traces, metrics) flows through Alloy
- If Alloy is not running, the app continues working normally (telemetry is optional)

### What Gets Monitored

**Automatic Instrumentation:**
- HTTP requests (method, path, status code, duration)
- PostgreSQL queries (operation, table, duration)
- Redis/Upstash operations (get, set, delete with cache hit/miss tracking)

**Structured Logging:**
- Authentication events (login, logout, token refresh)
- Rate limiting violations
- Security events (failed auth, suspicious activity)
- Billing limit violations
- File upload events and storage operations
- HTTP request/response logs
- Database query performance
- Cache operations and hit rates
- Business events (note creation, folder operations, etc.)

All logs, traces, and metrics are automatically sent to Grafana Cloud where you can:
- Visualize request traces with flame graphs
- Create custom dashboards for metrics
- Set up alerts for errors and performance issues
- Search and analyze logs with LogQL
- Correlate logs, metrics, and traces in one place

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
│   ├── code.ts         # Code execution routes (Piston engine)
│   ├── files.ts        # File attachment routes
│   ├── folders.ts      # Folder management routes with caching
│   ├── notes.ts        # Note management routes
│   └── users.ts        # User profile routes
├── types/
│   └── index.ts        # TypeScript type definitions
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

This application is designed for production deployment using AWS ECS (Elastic Container Service) with a **Grafana Alloy sidecar** for observability.

### Production Architecture

```
┌─────────────────────────────────────────┐
│         ECS Task (Fargate)              │
│                                         │
│  ┌──────────────┐   ┌──────────────┐  │
│  │ typelets-api │──▶│ grafana-alloy│  │
│  │ (Port 3000)  │   │ (Port 4318)  │  │
│  └──────────────┘   └──────┬───────┘  │
│                             │          │
└─────────────────────────────┼──────────┘
                              │
                              ▼
                    Grafana Cloud OTLP
```

The API sends telemetry (logs, traces, metrics) to a local Alloy sidecar at `http://localhost:4318`, which then forwards to Grafana Cloud.

### Production Infrastructure

- **API**: ECS containers running in AWS
- **Database**: AWS RDS PostgreSQL (not Docker containers)
- **Monitoring**: Grafana Alloy sidecar + Grafana Cloud
- **Environment Variables**: ECS task definitions (not `.env` files)
- **Secrets**: AWS Parameter Store or Secrets Manager
- **Container Registry**: Amazon ECR

### Deployment Steps

#### 1. Build and Push Docker Images

```bash
# Build and push the API image
pnpm run build
docker build -t typelets-api:latest .
docker tag typelets-api:latest YOUR_ECR_REPO/typelets-api:latest
docker push YOUR_ECR_REPO/typelets-api:latest

# Build and push the Alloy sidecar image
docker build -f Dockerfile.alloy -t grafana-alloy:latest .
docker tag grafana-alloy:latest YOUR_ECR_REPO/grafana-alloy:latest
docker push YOUR_ECR_REPO/grafana-alloy:latest
```

#### 2. Create ECS Task Definition

Your ECS task definition should include **two containers**:

**Container 1: typelets-api**
- Image: `YOUR_ECR_REPO/typelets-api:latest`
- Port: 3000
- Essential: `true`
- Environment variables:
  - `OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318`
  - `OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf`
  - `OTEL_SERVICE_NAME=typelets-api`
  - All other app environment variables

**Container 2: grafana-alloy**
- Image: `YOUR_ECR_REPO/grafana-alloy:latest`
- Ports: 4318, 4317
- Essential: `false`
- Environment variables:
  - `GRAFANA_CLOUD_TOKEN=your_grafana_cloud_token`
  - `GRAFANA_CLOUD_ENDPOINT=your_otlp_gateway_endpoint_here`
  - `GRAFANA_CLOUD_INSTANCE_ID=your_instance_id`

**Task Resources:**
- CPU: 1024 (1 vCPU)
- Memory: 2048 (2GB)
- Network Mode: `awsvpc` (required for localhost communication)

#### 3. Register and Deploy

```bash
# Register the task definition
aws ecs register-task-definition \
  --cli-input-json file://ecs-task-definition.json \
  --region us-east-1

# Update the service
aws ecs update-service \
  --cluster YOUR_CLUSTER_NAME \
  --service YOUR_SERVICE_NAME \
  --task-definition typelets-api-td \
  --force-new-deployment \
  --region us-east-1
```

### Important Notes

**Local Development with Grafana:**
- Run Alloy locally: `docker compose -f docker-compose.alloy.yml up -d`
- Set `GRAFANA_CLOUD_TOKEN` in `.env.local`
- Logs will appear in Grafana Cloud Loki

**Production Secrets:**
- Never commit ECS task definitions (they contain secrets)
- Task definition files are in `.gitignore`
- Store sensitive values in AWS Secrets Manager or Parameter Store

**Monitoring:**
- CloudWatch Logs: `/ecs/typelets-backend-td` (app logs)
- CloudWatch Logs: `/ecs/grafana-alloy` (Alloy logs)
- Grafana Cloud Loki: Structured app logs with trace correlation

**Health Checks:**
- App container: Uses `/health` endpoint
- Alloy container: No health check needed (essential: false)

### Troubleshooting

**Container fails with "Cannot find module './instrumentation.js'":**
- This is fixed in the Dockerfile by copying `instrumentation.js` to production
- Rebuild and push the image

**Logs not appearing in Grafana:**
- Check Alloy container logs in CloudWatch
- Verify `GRAFANA_CLOUD_TOKEN` is set correctly
- Ensure app is sending to `http://localhost:4318`

**Production vs Local:**
- **Local**: Uses `.env` files and Docker containers for testing
- **Production**: Uses ECS task definitions and AWS RDS for real deployment
- **Never use**: Local testing setup in production

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
