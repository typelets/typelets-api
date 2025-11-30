# [1.18.0](https://github.com/typelets/typelets-api/compare/v1.17.0...v1.18.0) (2025-11-30)


### Features

* optimize notes counts endpoint and add sheets note type ([6500247](https://github.com/typelets/typelets-api/commit/6500247ba534dbaa72eefe0cee33e6c7cd26871f))

# [1.17.0](https://github.com/typelets/typelets-api/compare/v1.16.7...v1.17.0) (2025-11-24)


### Features

* add public notes caching and public count to notes endpoint ([6436058](https://github.com/typelets/typelets-api/commit/64360585fac92fcf477550e3da74064dc46ad45f))

## [1.16.7](https://github.com/typelets/typelets-api/compare/v1.16.6...v1.16.7) (2025-11-24)


### Bug Fixes

* update color regex to allow lowercase hex in OpenAPI schema ([87dd2bc](https://github.com/typelets/typelets-api/commit/87dd2bc312c46142aa7d803107d31cbc32a92706))

## [1.16.6](https://github.com/typelets/typelets-api/compare/v1.16.5...v1.16.6) (2025-11-23)


### Bug Fixes

* add auth tests and fix test database setup ([c71be50](https://github.com/typelets/typelets-api/commit/c71be50d433a9a2351cdecffdbaa45062ff18798))

## [1.16.5](https://github.com/typelets/typelets-api/compare/v1.16.4...v1.16.5) (2025-11-23)


### Bug Fixes

* correct Jest 30 mock type casting syntax ([92a192a](https://github.com/typelets/typelets-api/commit/92a192ad312c77d00a9058a8b9c95564d82001e1))

## [1.16.4](https://github.com/typelets/typelets-api/compare/v1.16.3...v1.16.4) (2025-11-23)


### Bug Fixes

* add type annotations to auth test mocks for Jest 30 compatibility ([6c38045](https://github.com/typelets/typelets-api/commit/6c38045a8896d7755d5f6172798fa83838012324))

## [1.16.3](https://github.com/typelets/typelets-api/compare/v1.16.2...v1.16.3) (2025-11-23)


### Bug Fixes

* use createClerkClient for Clerk SDK v2.13.0 compatibility ([e15fbd7](https://github.com/typelets/typelets-api/commit/e15fbd77aa86c82f2e27a8b581384d8ce70014da))
* use createClerkClient for Clerk SDK v2.13.0 compatibility ([87d16d9](https://github.com/typelets/typelets-api/commit/87d16d9f7b42619ec7246b5e3d284528b8c89992))

## [1.16.2](https://github.com/typelets/typelets-api/compare/v1.16.1...v1.16.2) (2025-11-23)


### Bug Fixes

* update clerkClient usage for Clerk SDK v2.13.0 ([38aa913](https://github.com/typelets/typelets-api/commit/38aa91307cde69ac3c6fee9d1aa1c41f6fe570f6))

## [1.16.1](https://github.com/typelets/typelets-api/compare/v1.16.0...v1.16.1) (2025-11-23)


### Bug Fixes

* add style attribute support and logging for public notes ([bc831ef](https://github.com/typelets/typelets-api/commit/bc831efb070db550e8d4afe3ade0e6f4f7e33cb3))

# [1.16.0](https://github.com/typelets/typelets-api/compare/v1.15.10...v1.16.0) (2025-11-22)


### Features

* add public notes API for publishing encrypted notes ([76061b7](https://github.com/typelets/typelets-api/commit/76061b74fc27fb671b6399d9d2f4e4dbcbfa71b8))

## [1.15.10](https://github.com/typelets/typelets-api/compare/v1.15.9...v1.15.10) (2025-11-22)


### Bug Fixes

* add comprehensive database/cache logging and update Grafana dashboard ([5931c0f](https://github.com/typelets/typelets-api/commit/5931c0f5f3e665a82c13c2c45ed049eda238e266))

## [1.15.9](https://github.com/typelets/typelets-api/compare/v1.15.8...v1.15.9) (2025-11-22)


### Bug Fixes

* include http.client_ip in all auth event logs ([a313aa9](https://github.com/typelets/typelets-api/commit/a313aa9b96b12473df986f182ab4f88cac12c7ad))

## [1.15.8](https://github.com/typelets/typelets-api/compare/v1.15.7...v1.15.8) (2025-11-22)


### Bug Fixes

* **security:** add CSWSH protection, header redaction, and patch CVEs ([59a8262](https://github.com/typelets/typelets-api/commit/59a8262e2694e50a98f86d6e1448134b3708a0e7))

## [1.15.7](https://github.com/typelets/typelets-api/compare/v1.15.6...v1.15.7) (2025-11-20)


### Bug Fixes

* use standard OTEL environment variables ([6e877a0](https://github.com/typelets/typelets-api/commit/6e877a01e0ab464ac2bb2012d49006c50e97d875))

## [1.15.6](https://github.com/typelets/typelets-api/compare/v1.15.5...v1.15.6) (2025-11-19)


### Bug Fixes

* use logRecordProcessors array and lazy-load OTEL logger ([5b1eef3](https://github.com/typelets/typelets-api/commit/5b1eef3845a03961773ecb0a76fa2107db0a310d))

## [1.15.5](https://github.com/typelets/typelets-api/compare/v1.15.4...v1.15.5) (2025-11-19)


### Bug Fixes

* import SeverityNumber from @opentelemetry/api-logs ([9c717c4](https://github.com/typelets/typelets-api/commit/9c717c444e3d202f41847798fd02f577cef12ed9))

## [1.15.4](https://github.com/typelets/typelets-api/compare/v1.15.3...v1.15.4) (2025-11-19)


### Bug Fixes

* integrate logger with OpenTelemetry Logs API ([a916f2f](https://github.com/typelets/typelets-api/commit/a916f2f81988bdfd33a39a9594a3ff439bbcd253))

## [1.15.3](https://github.com/typelets/typelets-api/compare/v1.15.2...v1.15.3) (2025-11-19)


### Bug Fixes

* correct OpenTelemetry SDK initialization - start() is synchronous ([b56b768](https://github.com/typelets/typelets-api/commit/b56b768831b2f96d1382c962dc938dc87c5ace52))

## [1.15.2](https://github.com/typelets/typelets-api/compare/v1.15.1...v1.15.2) (2025-11-19)


### Bug Fixes

* use resourceFromAttributes instead of Resource constructor ([223a523](https://github.com/typelets/typelets-api/commit/223a5233b58676d23a93f20b36ba9529bc0fa891))

## [1.15.1](https://github.com/typelets/typelets-api/compare/v1.15.0...v1.15.1) (2025-11-19)


### Bug Fixes

* add missing OpenTelemetry dependencies for production build ([587c295](https://github.com/typelets/typelets-api/commit/587c2951a4ab61d45b9414b4bac03970c83f46e3))

# [1.15.0](https://github.com/typelets/typelets-api/compare/v1.14.1...v1.15.0) (2025-11-19)


### Features

* migrate from Sentry to Grafana Cloud with OpenTelemetry ([7c49f36](https://github.com/typelets/typelets-api/commit/7c49f3602a6babde92f3ed4d2c9dd5dd17417028))

## [1.14.1](https://github.com/typelets/typelets-api/compare/v1.14.0...v1.14.1) (2025-11-05)


### Bug Fixes

* return fake token from Piston for frontend compatibility ([e216257](https://github.com/typelets/typelets-api/commit/e2162571ffdccf59f5983b330a05c2c3b92b517e))
* return fake token from Piston for frontend compatibility ([2df254d](https://github.com/typelets/typelets-api/commit/2df254d5ba20a4756e5a12ca2f485b1337c55cf8))

# [1.14.0](https://github.com/typelets/typelets-api/compare/v1.13.0...v1.14.0) (2025-11-05)


### Features

* add code note type and migrate to Upstash Redis + Piston ([01d5b32](https://github.com/typelets/typelets-api/commit/01d5b324eb297c20182d3a4337488a2b5297b144))

# [1.13.0](https://github.com/typelets/typelets-api/compare/v1.12.0...v1.13.0) (2025-11-05)


### Features

* migrate to Upstash Redis and Piston code execution ([3abe305](https://github.com/typelets/typelets-api/commit/3abe305763c0addb793976241da2f1c52cfb74b7))

# [1.12.0](https://github.com/typelets/typelets-api/compare/v1.11.11...v1.12.0) (2025-11-03)


### Features

* add diagram type support with filtering and tests ([d47c0d4](https://github.com/typelets/typelets-api/commit/d47c0d448e3c149e50c5049f93f80e4635161ac5))

## [1.11.11](https://github.com/typelets/typelets-api/compare/v1.11.10...v1.11.11) (2025-10-29)


### Bug Fixes

* expand allowed file upload types to support office docs and Apple formats ([f3e3cea](https://github.com/typelets/typelets-api/commit/f3e3cea9ef485cdea72af1cb3a6ca534f943a111))

## [1.11.10](https://github.com/typelets/typelets-api/compare/v1.11.9...v1.11.10) (2025-10-28)


### Bug Fixes

* install @jest/globals to fix CI test compilation ([6c5acec](https://github.com/typelets/typelets-api/commit/6c5acece8985382823360f331632a8787a6f3a29))
* install @jest/globals to fix CI test compilation ([1e7fcea](https://github.com/typelets/typelets-api/commit/1e7fceae23cfe379891bc3447d3583c1e844a912))

## [1.11.9](https://github.com/typelets/typelets-api/compare/v1.11.8...v1.11.9) (2025-10-28)


### Bug Fixes

* enable database migrations for CI tests ([17c4490](https://github.com/typelets/typelets-api/commit/17c44908373e85d29190e7e8afdd16097b1a350d))

## [1.11.8](https://github.com/typelets/typelets-api/compare/v1.11.7...v1.11.8) (2025-10-28)


### Bug Fixes

* include drizzle migrations in git for CI tests ([fb65dca](https://github.com/typelets/typelets-api/commit/fb65dcaa54a769c243e99ce91174e337b5a05704))

## [1.11.7](https://github.com/typelets/typelets-api/compare/v1.11.6...v1.11.7) (2025-10-28)


### Bug Fixes

* **test:** use absolute path for migrations in globalSetup ([8da367a](https://github.com/typelets/typelets-api/commit/8da367ae510aaed103faca84ce089f3fa51aa17c))

## [1.11.6](https://github.com/typelets/typelets-api/compare/v1.11.5...v1.11.6) (2025-10-28)


### Bug Fixes

* optimize notes API performance and add test infrastructure ([ab8e902](https://github.com/typelets/typelets-api/commit/ab8e90277fb71194d25164196341ce2b6d56d7f7))

## [1.11.5](https://github.com/typelets/typelets-api/compare/v1.11.4...v1.11.5) (2025-10-18)

### Bug Fixes

- send logs as Sentry events using captureMessage/captureException ([422a23c](https://github.com/typelets/typelets-api/commit/422a23cb02b80084a79f7f81f9d60121ec76a5a7))

## [1.11.4](https://github.com/typelets/typelets-api/compare/v1.11.3...v1.11.4) (2025-10-18)

### Bug Fixes

- send logs as Sentry events using captureMessage/captureException ([3133f21](https://github.com/typelets/typelets-api/commit/3133f21de3319f642d4cfbde889e978d6ed4745a))

## [1.11.3](https://github.com/typelets/typelets-api/compare/v1.11.2...v1.11.3) (2025-10-18)

### Bug Fixes

- use Sentry breadcrumbs for proper structured logging field extraction ([f26f3e6](https://github.com/typelets/typelets-api/commit/f26f3e6249b19f91cd52fe39b53a7fcd215ec1a8))

## [1.11.2](https://github.com/typelets/typelets-api/compare/v1.11.1...v1.11.2) (2025-10-18)

### Bug Fixes

- standardize logging with structured data and add cache monitoring support ([534bbe9](https://github.com/typelets/typelets-api/commit/534bbe9f476d3fb92fa40897cbcc68838df66dc7))

## [1.11.1](https://github.com/typelets/typelets-api/compare/v1.11.0...v1.11.1) (2025-10-18)

### Bug Fixes

- reduce log noise and prevent sensitive data logging ([df00e25](https://github.com/typelets/typelets-api/commit/df00e2523f1f04016bc18536858cbd600632f003))

# [1.11.0](https://github.com/typelets/typelets-api/compare/v1.10.0...v1.11.0) (2025-10-18)

### Features

- migrate to Sentry.io monitoring, upgrade to Node 22, add folders to Swagger docs ([f2189fd](https://github.com/typelets/typelets-api/commit/f2189fde28d8995623a3a7af178ec284062d357e))

# [1.10.0](https://github.com/typelets/typelets-api/compare/v1.9.0...v1.10.0) (2025-10-18)

### Features

- add Folders to Swagger and organize monitoring configs ([a483df0](https://github.com/typelets/typelets-api/commit/a483df02a05c9cc0251ee66533a0a326484a2218))

# [1.9.0](https://github.com/typelets/typelets-api/compare/v1.8.2...v1.9.0) (2025-10-17)

### Features

- migrate from New Relic to Prometheus/Grafana metrics ([236b1c4](https://github.com/typelets/typelets-api/commit/236b1c49e36809caeefbbc376f640b4ea1569e27))

## [1.8.2](https://github.com/typelets/typelets-api/compare/v1.8.1...v1.8.2) (2025-10-17)

### Bug Fixes

- resolve Redis Cluster CROSSSLOT error in cache deletions ([862d796](https://github.com/typelets/typelets-api/commit/862d796a684a45f7ca76affe8480633d8dc6220a))

## [1.8.1](https://github.com/typelets/typelets-api/compare/v1.8.0...v1.8.1) (2025-10-16)

### Features

- add comprehensive OpenAPI documentation and refactor routes ([5ca9cc6](https://github.com/typelets/typelets-api/commit/5ca9cc6397b8054c41a2be5575d7233757fc9a53))

## [1.7.2](https://github.com/typelets/typelets-api/compare/v1.7.1...v1.7.2) (2025-10-15)

### Bug Fixes

- restore JSON string format for CloudWatch compatibility ([dc2b7aa](https://github.com/typelets/typelets-api/commit/dc2b7aa8474ade322fcc383db7b103f1796ef6c4))

## [1.7.1](https://github.com/typelets/typelets-api/compare/v1.7.0...v1.7.1) (2025-10-15)

### Bug Fixes

- output structured logs for New Relic log forwarding ([9d004a4](https://github.com/typelets/typelets-api/commit/9d004a406b0de701a09fac9b3e9fdff767e75133))

# [1.7.0](https://github.com/typelets/typelets-api/compare/v1.6.2...v1.7.0) (2025-10-15)

### Features

- add optimized notes counts endpoint for mobile app ([225691d](https://github.com/typelets/typelets-api/commit/225691d305a99251f3eeeafbd794a1e392ee2210))

## [1.6.2](https://github.com/typelets/typelets-api/compare/v1.6.1...v1.6.2) (2025-10-15)

### Bug Fixes

- replace GITHUB_TOKEN with PAT_TOKEN in release workflow ([6327365](https://github.com/typelets/typelets-api/commit/632736522b75a68d0e268d0a649d5ec6b5367db3))
- replace GITHUB_TOKEN with PAT_TOKEN in release workflow ([844f9d9](https://github.com/typelets/typelets-api/commit/844f9d997391bda0ffe4b7788efa019cddf5d982))

## [1.6.1](https://github.com/typelets/typelets-api/compare/v1.6.0...v1.6.1) (2025-10-15)

### Bug Fixes

- replace single quotes with double ([906abaa](https://github.com/typelets/typelets-api/commit/906abaa269787052493886235f8a21c06e561a36))
- replace single quotes with double ([cb49dd4](https://github.com/typelets/typelets-api/commit/cb49dd4f32a658792de0552b4ac12309fa61b334))

# [1.6.0](https://github.com/typelets/typelets-api/compare/v1.5.0...v1.6.0) (2025-10-15)

### Features

- add Valkey caching layer with New Relic monitoring and structured logging ([14ada06](https://github.com/typelets/typelets-api/commit/14ada06917931812f8736515a5bbc9c40cde77cc))

# [1.5.0](https://github.com/typelets/typelets-api/compare/v1.4.0...v1.5.0) (2025-10-13)

### Features

- add configurable database connection pooling ([18507b1](https://github.com/typelets/typelets-api/commit/18507b1632ee5ebf9e04acbc4a37a2453b97a5c2))

# [1.4.0](https://github.com/typelets/typelets-api/compare/v1.3.1...v1.4.0) (2025-10-12)

### Features

- add attachment count to notes list and enhance monitoring ([136ad40](https://github.com/typelets/typelets-api/commit/136ad401e0552644ffac1c0e378805e3bbfb5833))

## [1.3.1](https://github.com/typelets/typelets-api/compare/v1.3.0...v1.3.1) (2025-09-25)

### Bug Fixes

- enforce encrypted data validation to prevent plaintext exposure ([0cc6f77](https://github.com/typelets/typelets-api/commit/0cc6f77fcbf9def845e1fae0b871c27f7b1fad95))

# [1.3.0](https://github.com/typelets/typelets-api/compare/v1.2.0...v1.3.0) (2025-09-23)

### Features

- add comprehensive Sentry monitoring and fix 429 rate limiting error ([6ba5744](https://github.com/typelets/typelets-api/commit/6ba5744022d075216e8053b6c2127cbb38a4824e))

# [1.2.0](https://github.com/typelets/typelets-api/compare/v1.1.1...v1.2.0) (2025-09-20)

### Features

- **ci:** add Husky pre-commit hooks to prevent CI failures ([346bc2b](https://github.com/typelets/typelets-api/commit/346bc2bcd087d5000b7cc21032561c60baf43dda))
- **ci:** add Husky pre-commit hooks to prevent CI failures ([e2b1017](https://github.com/typelets/typelets-api/commit/e2b1017d1bbb133dd1067ef9234fb463ad89f15d))
- **code:** add secure API proxy for code execution ([8d599b5](https://github.com/typelets/typelets-api/commit/8d599b5c6c72e3ae871a9cf71b9304fb8541828e))

## [1.1.1](https://github.com/typelets/typelets-api/compare/v1.1.0...v1.1.1) (2025-09-16)

### Bug Fixes

- make note title field optional for encrypted notes ([ec19a48](https://github.com/typelets/typelets-api/commit/ec19a48954a10eb2a2531c3195fc5fe6b3430d70))

# [1.1.0](https://github.com/typelets/typelets-api/compare/v1.0.4...v1.1.0) (2025-09-15)

### Features

- **websocket:** implement real-time sync with HMAC authentication and fix folder moves ([8de85b7](https://github.com/typelets/typelets-api/commit/8de85b7eae38b9af76154e40cdeff53d771f6e92))

## [1.0.4](https://github.com/typelets/typelets-api/compare/v1.0.3...v1.0.4) (2025-09-10)

### Bug Fixes

- bundle API with esbuild to resolve directory import errors ([4644c0e](https://github.com/typelets/typelets-api/commit/4644c0e3d2de2eb5796abab36b931615dc81eead))

## [1.0.3](https://github.com/typelets/typelets-api/compare/v1.0.2...v1.0.3) (2025-09-10)

### Bug Fixes

- include root-level TypeScript files in esbuild output ([cf9bb4f](https://github.com/typelets/typelets-api/commit/cf9bb4fda0fa19925122b816d0375c88c4f39e05))

## [1.0.2](https://github.com/typelets/typelets-api/compare/v1.0.1...v1.0.2) (2025-09-10)

### Bug Fixes

- replace tsc with esbuild to resolve build hanging issue ([235fce7](https://github.com/typelets/typelets-api/commit/235fce77cdde4e2287fe8b25acc7bcb96deb6ff8))

## [1.0.1](https://github.com/typelets/typelets-api/compare/v1.0.0...v1.0.1) (2025-09-10)

### Bug Fixes

- update Dockerfile to use pnpm instead of npm ([13e9639](https://github.com/typelets/typelets-api/commit/13e963965c7e5fa0e060ba8a0d8995eee761620b))

# 1.0.0 (2025-09-09)

### Bug Fixes

- remove ES module configuration to fix semantic-release scripts ([f869d14](https://github.com/typelets/typelets-api/commit/f869d14cf42b35d119d11e3e25daff98060b7129))

### Features

- initial open source release of Typelets API ([66a3d30](https://github.com/typelets/typelets-api/commit/66a3d30dcbc0a33c4118c6948d9537e885298039))

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
