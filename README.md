# Typelets API

[![Version](https://img.shields.io/github/package-json/v/typelets/typelets-api)](https://github.com/typelets/typelets-api/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-green.svg)](https://nodejs.org/)
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
- ⚡ **Fast & Type-Safe** with TypeScript and Hono
- 🐘 **PostgreSQL** with Drizzle ORM

## Tech Stack

- **Runtime**: Node.js 20+ (LTS recommended)
- **Framework**: [Hono](https://hono.dev/) - Fast, lightweight web framework
- **Database**: PostgreSQL with [Drizzle ORM](https://orm.drizzle.team/)
- **Authentication**: [Clerk](https://clerk.com/)
- **Validation**: [Zod](https://zod.dev/)
- **TypeScript**: Strict mode enabled for type safety

## Prerequisites

- Node.js 20+ (LTS recommended)
- pnpm 9.15.0+
- PostgreSQL database (local installation or Docker)
- Clerk account for authentication ([sign up here](https://dashboard.clerk.com))

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
   - Update `.env` with your settings:

   ```env
   CLERK_SECRET_KEY=sk_test_your_actual_clerk_secret_key_from_dashboard
   CORS_ORIGINS=http://localhost:5173,http://localhost:3000
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

### Public Endpoints

- `GET /` - API information and health status
- `GET /health` - Health check endpoint

### Authentication

All `/api/*` endpoints require authentication via Bearer token in the Authorization header.

### Users

- `GET /api/users/me` - Get current user profile
- `DELETE /api/users/me` - Delete user account

### Folders

- `GET /api/folders` - List all folders
- `POST /api/folders` - Create new folder
- `GET /api/folders/:id` - Get folder details
- `PUT /api/folders/:id` - Update folder
- `DELETE /api/folders/:id` - Delete folder
- `POST /api/folders/:id/reorder` - Reorder folder position

### Notes

- `GET /api/notes` - List notes (with pagination and filtering)
- `POST /api/notes` - Create new note
- `GET /api/notes/:id` - Get note details
- `PUT /api/notes/:id` - Update note
- `DELETE /api/notes/:id` - Delete note (move to trash)
- `DELETE /api/notes/empty-trash` - Permanently delete trashed notes
- `POST /api/notes/:id/star` - Star/unstar a note
- `POST /api/notes/:id/restore` - Restore note from trash
- `POST /api/notes/:id/hide` - Hide a note
- `POST /api/notes/:id/unhide` - Unhide a note

### File Attachments

- `POST /api/notes/:noteId/files` - Upload file attachment
- `GET /api/notes/:noteId/files` - List note attachments
- `GET /api/files/:id` - Get file details
- `DELETE /api/files/:id` - Delete file attachment

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
- **Rate Limiting**: Configurable file size limits (default: 50MB per file, 1GB total per note)

## Environment Variables

| Variable              | Description                                  | Required | Default     |
| --------------------- | -------------------------------------------- | -------- | ----------- |
| `DATABASE_URL`        | PostgreSQL connection string                 | Yes      | -           |
| `CLERK_SECRET_KEY`    | Clerk secret key for JWT verification        | Yes      | -           |
| `CORS_ORIGINS`        | Comma-separated list of allowed CORS origins | Yes      | -           |
| `PORT`                | Server port                                  | No       | 3000        |
| `NODE_ENV`            | Environment (development/production)         | No       | development |
| `MAX_FILE_SIZE_MB`    | Maximum size per file in MB                  | No       | 50          |
| `MAX_NOTE_SIZE_MB`    | Maximum total attachments per note in MB     | No       | 1024 (1GB)  |
| `FREE_TIER_STORAGE_GB`| Free tier storage limit in GB               | No       | 1           |
| `FREE_TIER_NOTE_LIMIT`| Free tier note count limit                  | No       | 100         |
| `DEBUG`               | Enable debug logging in production           | No       | false       |

## Development

### Project Structure

```
src/
├── db/
│   ├── index.ts        # Database connection
│   └── schema.ts       # Database schema definitions
├── lib/
│   └── validation.ts   # Zod validation schemas
├── middleware/
│   └── auth.ts        # Authentication middleware
├── routes/
│   ├── files.ts       # File attachment routes
│   ├── folders.ts     # Folder management routes
│   ├── notes.ts       # Note management routes
│   └── users.ts       # User profile routes
├── types/
│   └── index.ts       # TypeScript type definitions
└── server.ts          # Application entry point
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
