# Security Policy

## Supported Versions

We actively maintain security updates for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |

## Security Features

### Authentication & Authorization
- **JWT Authentication**: Secure token-based authentication using Clerk
- **User Scoped Access**: All data operations are scoped to authenticated users
- **Session Management**: Automatic token validation and user context

### Input Validation & Sanitization
- **Zod Schema Validation**: Comprehensive input validation on all endpoints
- **SQL Injection Prevention**: Parameterized queries with Drizzle ORM
- **File Upload Security**: Restricted MIME types and filename validation
- **Search Input Sanitization**: Escaped special characters to prevent injection

### API Security
- **Rate Limiting**: Configurable rate limits per user/IP (100 req/15min default)
- **File Upload Limits**: Stricter limits for file operations (10 req/15min)
- **CORS Configuration**: Restricted to specific allowed origins
- **Request Body Limits**: Configurable file size limits with 35% buffer

### Security Headers
- **Content Security Policy (CSP)**: Restrictive policy preventing XSS
- **X-Frame-Options**: DENY to prevent clickjacking
- **X-Content-Type-Options**: nosniff to prevent MIME confusion
- **X-XSS-Protection**: Browser XSS filter enabled
- **Strict-Transport-Security**: HSTS in production environments
- **Referrer-Policy**: Strict referrer policy

### WebSocket Security
- **Authentication Required**: All WS operations require valid JWT
- **Connection Limits**: Maximum 20 connections per user
- **Rate Limiting**: 300 messages per minute per connection
- **Authentication Timeout**: 30 second timeout for unauthenticated connections
- **Message Validation**: All incoming messages validated against schemas
- **HMAC Message Authentication**: Optional cryptographic message signing for enhanced security

### Data Protection
- **Client-Side Encryption**: Optional end-to-end encryption for sensitive data
- **Database Encryption**: SSL/TLS enforced for database connections
- **Environment Variables**: Sensitive configuration externalized
- **Error Sanitization**: Stack traces hidden in production

### Infrastructure Security
- **Database Security**: Foreign key constraints and transaction safety
- **Logging**: Security events logged with unique error IDs
- **Environment Separation**: Development vs production error handling

## Reporting a Vulnerability

We take security seriously. If you discover a security vulnerability, please follow these steps:

### 1. **DO NOT** create a public GitHub issue for security vulnerabilities

### 2. Report privately via:
- **Email**: security@typelets.com
- **GitHub Security Advisories**: Use the private vulnerability reporting feature

### 3. Include in your report:
- Description of the vulnerability
- Steps to reproduce the issue
- Potential impact assessment
- Suggested remediation (if any)

### 4. Response Timeline:
- **Initial Response**: Within 48 hours
- **Assessment**: Within 5 business days
- **Fix Timeline**: Varies by severity
  - Critical: 24-48 hours
  - High: 1 week
  - Medium: 2 weeks
  - Low: Next minor release

### 5. Disclosure Policy:
- We follow coordinated disclosure
- Public disclosure after fix is deployed
- Credit will be given to reporters (unless requested otherwise)

## Security Best Practices for Deployment

### Environment Configuration
```bash
# Required security environment variables
CLERK_SECRET_KEY=your_clerk_secret_key
DATABASE_URL=postgresql://...  # Use SSL in production

# Optional security configuration
WS_RATE_LIMIT_MAX_MESSAGES=300
WS_MAX_CONNECTIONS_PER_USER=20
WS_AUTH_TIMEOUT_MS=30000
MAX_FILE_SIZE_MB=50
CORS_ORIGINS=https://yourdomain.com,https://app.yourdomain.com
```

### Production Deployment
- Use HTTPS only in production
- Configure proper CORS origins
- Set NODE_ENV=production
- Use secure database connections (SSL)
- Implement proper logging and monitoring
- Regular security updates

### Rate Limiting
- Default: 100 requests per 15 minutes per user/IP
- File uploads: 10 operations per 15 minutes
- WebSocket: 300 messages per minute per connection
- Configurable via environment variables

### File Upload Security
- Allowed MIME types: images, PDFs, text files
- Maximum file size: 50MB (configurable)
- Filename validation prevents path traversal
- Client-side encryption recommended for sensitive files

## Security Checklist for Contributors

### Code Review Requirements
- [ ] All user inputs validated with Zod schemas
- [ ] Database queries use parameterized statements
- [ ] No secrets in code or logs
- [ ] Error messages don't expose sensitive information
- [ ] Authentication required for protected endpoints
- [ ] Rate limiting considered for expensive operations

### Testing Requirements
- [ ] Security tests pass
- [ ] Input validation tests included
- [ ] Authentication/authorization tests cover edge cases
- [ ] Error handling tests verify no information leakage

## Known Security Considerations

### Limitations
- In-memory rate limiting (resets on server restart)
- In-memory nonce tracking (resets on server restart)
- No distributed session management
- Client-side encryption keys not managed by server

### Recommendations
- Use Redis for production rate limiting and nonce tracking
- Implement session management for multi-server deployments
- Consider external key management for enterprise use
- Implement LRU cache for nonce management to prevent memory leaks

## Security Dependencies

### Regular Updates
We monitor and update dependencies for security vulnerabilities:
- Automated dependency scanning
- Regular security patches
- Major version updates evaluated for security impact

### Critical Dependencies
- `@clerk/backend` - Authentication
- `drizzle-orm` - Database ORM
- `hono` - Web framework
- `ws` - WebSocket implementation
- `zod` - Input validation

## Compliance

This API implements security controls aligned with:
- OWASP Web Application Security Project guidelines
- Modern web security best practices
- Input validation and output encoding standards
- Secure authentication and session management

For questions about our security practices, please contact security@typelets.com.