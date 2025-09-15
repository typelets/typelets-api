# [1.1.0](https://github.com/typelets/typelets-api/compare/v1.0.4...v1.1.0) (2025-09-15)


### Features

* **websocket:** implement real-time sync with HMAC authentication and fix folder moves ([8de85b7](https://github.com/typelets/typelets-api/commit/8de85b7eae38b9af76154e40cdeff53d771f6e92))

## [1.0.4](https://github.com/typelets/typelets-api/compare/v1.0.3...v1.0.4) (2025-09-10)


### Bug Fixes

* bundle API with esbuild to resolve directory import errors ([4644c0e](https://github.com/typelets/typelets-api/commit/4644c0e3d2de2eb5796abab36b931615dc81eead))

## [1.0.3](https://github.com/typelets/typelets-api/compare/v1.0.2...v1.0.3) (2025-09-10)


### Bug Fixes

* include root-level TypeScript files in esbuild output ([cf9bb4f](https://github.com/typelets/typelets-api/commit/cf9bb4fda0fa19925122b816d0375c88c4f39e05))

## [1.0.2](https://github.com/typelets/typelets-api/compare/v1.0.1...v1.0.2) (2025-09-10)


### Bug Fixes

* replace tsc with esbuild to resolve build hanging issue ([235fce7](https://github.com/typelets/typelets-api/commit/235fce77cdde4e2287fe8b25acc7bcb96deb6ff8))

## [1.0.1](https://github.com/typelets/typelets-api/compare/v1.0.0...v1.0.1) (2025-09-10)


### Bug Fixes

* update Dockerfile to use pnpm instead of npm ([13e9639](https://github.com/typelets/typelets-api/commit/13e963965c7e5fa0e060ba8a0d8995eee761620b))

# 1.0.0 (2025-09-09)


### Bug Fixes

* remove ES module configuration to fix semantic-release scripts ([f869d14](https://github.com/typelets/typelets-api/commit/f869d14cf42b35d119d11e3e25daff98060b7129))


### Features

* initial open source release of Typelets API ([66a3d30](https://github.com/typelets/typelets-api/commit/66a3d30dcbc0a33c4118c6948d9537e885298039))

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Real-time WebSocket Sync**: Complete WebSocket implementation for real-time note and folder synchronization
  - JWT authentication for WebSocket connections
  - Optional HMAC-SHA256 message authentication for enhanced security
  - Rate limiting (300 messages/min) and connection limits (20 per user)
  - Connection management with automatic cleanup
  - Note and folder sync across multiple devices/sessions
  - Support for note folder moves via WebSocket
- **Security Enhancements**:
  - Comprehensive security headers middleware (CSP, HSTS, XSS protection)
  - Enhanced rate limiting middleware
  - Production-ready security configuration
- **TypeScript Improvements**: Fixed iterator compatibility and module import issues
- **Documentation**: Complete WebSocket integration documentation and updated security policy

### Fixed

- WebSocket note sync issue where `folderId` changes weren't being broadcast
- TypeScript compilation issues with Map iterators and postgres module imports
- Memory leak prevention in nonce storage with automatic cleanup

### Previous Releases

- Initial open source release
- TypeScript API with Hono framework
- PostgreSQL database with Drizzle ORM
- Clerk authentication integration
- End-to-end encryption support for notes and files
- Folder organization with nested folder support
- File attachments with encrypted storage
- Tags and search functionality
- Trash and archive features
- Comprehensive API documentation
- GitHub Actions CI/CD pipeline with semantic versioning
- Environment-based configuration for CORS and file upload limits
- Production-ready logging with debug mode support
