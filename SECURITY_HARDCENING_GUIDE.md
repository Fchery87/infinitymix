# Security Hardening Guide

This guide provides instructions for securing the InfinityMix application in production environments.

## Environment Setup

### 1. Generate Secure Secrets

Generate cryptographically secure secrets for production:

```bash
# Generate NextAuth secret
openssl rand -base64 32

# Generate Better Auth secret
openssl rand -hex 32

# Generate database password
openssl rand -base64 24

# Generate Redis password
openssl rand -base64 20
```

### 2. Environment Variables Template

Copy `.env.example` to `.env.production.local` and fill with production values:

```bash
cp .env.example .env.production.local
```

### 3. Database Security

#### PostgreSQL
- Enable SSL connections
- Use strong password authentication
- Configure connection limits
- Enable audit logging

```sql
-- Example secure PostgreSQL configuration
ALTER SYSTEM SET ssl = 'on';
ALTER SYSTEM SET password_encryption = 'scram-sha-256';
ALTER SYSTEM SET log_connections = 'on';
ALTER SYSTEM SET log_disconnections = 'on';
SELECT pg_reload_conf();
```

#### Redis
- Enable password authentication
- Configure max memory policy
- Disable dangerous commands

### 4. Network Security

#### Docker Network Configuration
```bash
# Create isolated network for services
docker network create --driver bridge infinitymix-prod
```

#### Firewall Rules
```bash
# Allow only necessary ports
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw allow 22/tcp    # SSH (from specific IPs only)
ufw enable
```

### 5. Container Security

#### Runtime Security
```bash
# Run containers with limited privileges
docker-compose -f docker-compose.prod.yml up -d

# Use security scanning
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/trivy image infinitymix_app:latest
```

#### Resource Limits
Add to docker-compose.yml:
```yaml
deploy:
  resources:
    limits:
      cpus: '1.0'
      memory: 1G
    reservations:
      cpus: '0.5'
      memory: 512M
```

## Application Security

### 1. Authentication & Authorization
- ✅ Better Auth implemented
- ✅ Rate limiting on auth endpoints
- ✅ Strong password policies
- ✅ Session management

### 2. Input Validation
- ✅ Zod schema validation
- ✅ File upload restrictions
- ✅ SQL injection prevention via parameterized queries

### 3. Security Headers
- ✅ Content Security Policy
- ✅ Strict-Transport-Security
- ✅ X-Frame-Options
- ✅ X-Content-Type-Options

### 4. Error Handling
- ✅ Sanitized error messages
- ✅ Request ID tracking
- ✅ Structured logging

## Monitoring & Logging

### 1. Security Events to Log
- Authentication failures (login attempts)
- Authorization failures (access denied)
- Suspicious API calls
- Rate limit violations
- File upload attempts

### 2. Log Management
```bash
# Configure log rotation
# /etc/logrotate.d/infinitymix
/var/log/infinitymix/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 644 infinitymix infinitymix
}
```

### 3. Monitoring Setup
- Use Prometheus for metrics
- Use Grafana for dashboards
- Set up alerting for:
  - High authentication failure rate
  - Unusual API traffic patterns
  - High error rates
  - Resource exhaustion

## CI/CD Security

### 1. Dependency Scanning
```yaml
# GitHub Actions example
- name: Run security audit
  run: npm audit --audit-level=moderate
```

### 2. Container Security
```yaml
- name: Scan Docker image
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: ${{ env.IMAGE_NAME }}
    format: 'sarif'
    output: 'trivy-results.sarif'
```

### 3. Secret Management
- Use environment variables for secrets
- Integrate with cloud secret managers
- Rotate secrets regularly
- Audit secret access

## Deployment Checklist

### Before Production Deployment
- [ ] All critical vulnerabilities patched
- [ ] Secure secrets generated and configured
- [ ] SSL/TLS certificates installed
- [ ] Database security configured
- [ ] Firewall rules implemented
- [ ] Security monitoring enabled
- [ ] Backup procedures tested
- [ ] Security review completed

### Post-Deployment
- [ ] Security headers verified (securityheaders.com)
- [ ] SSL/TLS configuration tested (ssllabs.com)
- [ ] Load testing completed
- [ ] Monitoring dashboards working
- [ ] Incident response procedures documented

## Security Incident Response

### 1. Detection
- Monitor security alerts
- Review application logs
- Check for unusual traffic patterns

### 2. Response
- Isolate affected systems
- Preserve forensic evidence
- Notify stakeholders
- Begin remediation

### 3. Recovery
- Patch vulnerabilities
- Reset compromised credentials
- Verify system integrity
- Restore normal operations

## Regular Security Maintenance

### Weekly
- Review security logs
- Check for new vulnerabilities
- Monitor resource usage

### Monthly
- Update dependencies
- Rotate secrets
- Test backup recovery

### Quarterly
- Security audit review
- Penetration testing
- Update security policies
- Training sessions

## Contact Information

For security issues, contact:
- Email: security@infinitymix.com
- Use encrypted communication for sensitive information

## Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://github.com/goldbergyoni/nodebestpractices)
- [Docker Security](https://docs.docker.com/engine/security/)
- [Next.js Security](https://nextjs.org/docs/advanced-features/security)
