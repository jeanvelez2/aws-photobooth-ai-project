# Security Implementation

This document outlines the comprehensive security measures implemented in the AI Photobooth backend API.

## Overview

The backend implements multiple layers of security to protect against common web application vulnerabilities and attacks. All security measures are designed to meet the requirements specified in NFR-3.3, NFR-3.4, NFR-3.5, and NFR-3.6.

## Security Features

### 1. Rate Limiting

**Implementation**: `src/middleware/rateLimiting.ts`

- **General API Rate Limiting**: 10 requests per minute per IP address
- **Processing Endpoint Rate Limiting**: 3 requests per minute per IP address
- **Upload Endpoint Rate Limiting**: 5 requests per minute per IP address
- **Health Check Rate Limiting**: 60 requests per minute per IP address (lenient)
- **Progressive Rate Limiting**: Adaptive rate limiting based on suspicious activity detection

**Features**:
- IP-based rate limiting with proxy trust configuration
- Different limits for different endpoint types
- Enhanced logging and monitoring of rate limit violations
- Automatic security alerts for potential abuse
- Memory-based store with cleanup for single-instance deployments

### 2. Input Validation and Sanitization

**Implementation**: `src/middleware/validation.ts`

**Input Sanitization**:
- Removes null bytes and control characters
- Normalizes Unicode strings
- Trims whitespace
- Recursively sanitizes nested objects and arrays
- Sanitizes request body, query parameters, and URL parameters

**Security Validation**:
- SQL injection pattern detection
- XSS (Cross-Site Scripting) prevention
- Path traversal attack prevention
- Command injection detection
- LDAP injection prevention
- NoSQL injection detection

**Content Type Validation**:
- Enforces allowed content types (`application/json`, `application/x-www-form-urlencoded`)
- Blocks unsupported media types
- Skips validation for GET requests appropriately

**Common Validation Rules**:
- UUID validation
- String length validation
- Email validation with normalization
- URL validation
- File type validation for images
- File size validation
- Enum validation
- Pagination parameter validation

### 3. Security Headers

**Implementation**: `src/middleware/security.ts`

**Headers Applied**:
- **Strict-Transport-Security (HSTS)**: Forces HTTPS connections
- **Content-Security-Policy (CSP)**: Prevents XSS and code injection
- **X-Content-Type-Options**: Prevents MIME type sniffing
- **X-Frame-Options**: Prevents clickjacking attacks
- **X-XSS-Protection**: Enables browser XSS filtering
- **Referrer-Policy**: Controls referrer information leakage
- **Permissions-Policy**: Restricts access to browser features
- **Server**: Custom server identification (removes version info)

**Content Security Policy**:
```
default-src 'self';
script-src 'self' 'unsafe-inline';
style-src 'self' 'unsafe-inline';
img-src 'self' data: https: blob:;
font-src 'self' data:;
connect-src 'self' https://api.amazonaws.com https://*.amazonaws.com;
media-src 'self' blob:;
object-src 'none';
frame-src 'none';
base-uri 'self';
form-action 'self';
frame-ancestors 'none';
upgrade-insecure-requests
```

### 4. HTTPS Enforcement

**Implementation**: `src/middleware/security.ts`

- Enforces HTTPS connections in production environments
- Supports proxy configurations (x-forwarded-proto, x-forwarded-ssl)
- Returns 426 Upgrade Required for HTTP requests in production
- Bypasses enforcement in development environments

### 5. Secure Cookie Configuration

**Implementation**: `src/middleware/security.ts`

**Cookie Security Flags**:
- `HttpOnly`: Prevents JavaScript access to cookies
- `Secure`: Ensures cookies are only sent over HTTPS (in production)
- `SameSite=Strict`: Prevents CSRF attacks
- Default expiration: 24 hours
- Automatic security flag application to all cookies

### 6. Request Size Limiting

**Implementation**: `src/middleware/security.ts`

- Default limit: 10MB for file uploads
- Configurable per endpoint
- Early rejection of oversized requests
- Comprehensive logging of size violations
- Protection against DoS attacks via large payloads

### 7. Security Monitoring

**Implementation**: `src/middleware/security.ts`

**Suspicious Pattern Detection**:
- Real-time monitoring of request content
- Pattern matching for common attack vectors
- Comprehensive logging of security events
- Integration with external monitoring services (configurable)

**Monitored Patterns**:
- SQL injection attempts
- XSS attack patterns
- Path traversal attempts
- Command injection patterns
- JavaScript/VBScript injection
- Event handler injection

### 8. Error Handling and Information Disclosure Prevention

**Implementation**: `src/middleware/errorHandler.ts`

**Security Features**:
- Sanitized error messages in production
- Request ID tracking for security correlation
- Severity-based error classification
- Sensitive data redaction in logs
- Generic error messages for non-operational errors
- Stack trace hiding in production

## Security Testing

### Unit Tests

**Files**:
- `src/middleware/security.test.ts`
- `src/middleware/validation.test.ts`
- `src/middleware/rateLimiting.test.ts`

**Coverage**:
- All security middleware functions
- Input sanitization edge cases
- Rate limiting behavior
- Security header application
- HTTPS enforcement logic

### Integration Tests

**File**: `src/security.integration.test.ts`

**Test Categories**:
1. **Security Headers**: Verification of all security headers
2. **Request Size Limiting**: Payload size enforcement
3. **Content Type Validation**: Media type restrictions
4. **Input Sanitization**: Malicious input handling
5. **Security Validation**: Attack pattern detection
6. **Rate Limiting**: Rate limit enforcement across endpoints
7. **Secure Cookies**: Cookie security flag verification

### Penetration Testing Scenarios

**Attack Vectors Tested**:
- SQL Injection (UNION, Boolean Blind)
- Cross-Site Scripting (Script tags, Event handlers, JavaScript protocol)
- Path Traversal (Unix and Windows variants)
- Command Injection (Semicolon, Pipe, Backticks)
- LDAP Injection
- NoSQL Injection
- Header Injection (CRLF, Response Splitting)
- DoS Attacks (Large payloads, Nested objects, Large arrays)
- Encoding Bypass Attempts (URL, Double URL, HTML Entity, Unicode, Base64)

## Configuration

### Environment Variables

```bash
# HTTPS Enforcement
NODE_ENV=production  # Enables HTTPS enforcement

# Error Monitoring
ERROR_MONITORING_ENDPOINT=https://monitoring.example.com/errors
ERROR_MONITORING_TOKEN=your-monitoring-token

# Frontend URL for CORS
FRONTEND_URL=https://your-frontend-domain.com
```

### Rate Limiting Configuration

Rate limits can be customized by modifying the values in `src/middleware/rateLimiting.ts`:

```typescript
// General API rate limiting
windowMs: 60 * 1000,  // 1 minute
max: 10,              // 10 requests per minute per IP

// Processing rate limiting
max: 3,               // 3 processing requests per minute per IP

// Upload rate limiting
max: 5,               // 5 upload requests per minute per IP
```

## Security Best Practices

### 1. Regular Security Updates
- Keep all dependencies updated
- Monitor security advisories
- Regular security audits

### 2. Monitoring and Alerting
- Monitor rate limit violations
- Track suspicious activity patterns
- Set up alerts for security events

### 3. Input Validation
- Validate all user inputs
- Use whitelist validation where possible
- Sanitize data before processing

### 4. Error Handling
- Never expose sensitive information in errors
- Log security events for analysis
- Use generic error messages for users

### 5. Authentication and Authorization
- Implement proper session management
- Use secure authentication mechanisms
- Apply principle of least privilege

## Compliance

This security implementation addresses the following security requirements:

- **NFR-3.3**: Rate limiting (10 requests/minute/IP)
- **NFR-3.4**: Input validation and sanitization
- **NFR-3.5**: Security headers (CSP, HSTS, etc.)
- **NFR-3.6**: HTTPS enforcement and secure cookies

## Security Incident Response

### 1. Detection
- Automated monitoring alerts
- Log analysis for suspicious patterns
- Rate limit violation tracking

### 2. Response
- Automatic blocking of malicious requests
- Enhanced logging for investigation
- Escalation procedures for critical incidents

### 3. Recovery
- Request retry mechanisms for legitimate users
- Temporary IP blocking for severe violations
- System health monitoring

## Future Enhancements

### 1. Distributed Rate Limiting
- Redis-based rate limiting for multi-instance deployments
- Shared rate limit state across instances

### 2. Advanced Threat Detection
- Machine learning-based anomaly detection
- Behavioral analysis for user patterns

### 3. Enhanced Monitoring
- Real-time security dashboards
- Integration with SIEM systems
- Automated threat response

### 4. Additional Security Measures
- Web Application Firewall (WAF) integration
- DDoS protection
- Bot detection and mitigation