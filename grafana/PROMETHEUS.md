# Prometheus & Grafana Monitoring Setup

This guide explains how to set up complete monitoring for the Typelets API using Prometheus and Grafana.

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Metrics Endpoint Setup](#metrics-endpoint-setup)
- [Prometheus Server Setup](#prometheus-server-setup)
  - [Option 1: Docker (Local/Testing)](#option-1-docker-localtesting)
  - [Option 2: AWS ECS (Production)](#option-2-aws-ecs-production)
  - [Option 3: Amazon Managed Service for Prometheus](#option-3-amazon-managed-service-for-prometheus)
- [Grafana Setup](#grafana-setup)
- [Dashboard Import](#dashboard-import)
- [Security Best Practices](#security-best-practices)
- [Troubleshooting](#troubleshooting)

## Overview

### Architecture

```
┌─────────────────┐
│  Typelets API   │
│  /metrics       │──┐
│  (Port 3000)    │  │
└─────────────────┘  │
                     │ Scrapes every 30s
                     │ (Basic Auth)
                     ↓
              ┌──────────────┐
              │  Prometheus  │
              │   Server     │
              │  (Port 9090) │
              └──────────────┘
                     │
                     │ Queries metrics
                     ↓
              ┌──────────────┐
              │   Grafana    │
              │  Dashboard   │
              │  (Port 3000) │
              └──────────────┘
```

### What's Included

**Built into the API** (always available):

- `/metrics` endpoint with Prometheus-formatted metrics
- Automatic instrumentation for HTTP, WebSocket, Database operations
- Health checks with detailed system status

**Optional** (in [grafana/](grafana/) folder):

- `prometheus.yml.example` - Prometheus configuration
- `Dockerfile.prometheus.example` - Docker image for Prometheus
- `prometheus-task-definition.json.example` - AWS ECS deployment
- `grafana-dashboard.json.example` - Pre-built Grafana dashboard

## Prerequisites

Before you begin, ensure you have:

1. **Typelets API running** with `METRICS_API_KEY` set in environment variables
2. **One of the following** for Prometheus deployment:
   - Docker installed (for local testing)
   - AWS account with ECS access (for production)
   - Amazon Managed Grafana workspace (for AWS-native setup)
3. **Grafana instance** (AWS Managed Grafana or self-hosted)

## Metrics Endpoint Setup

The `/metrics` endpoint is built into the API and requires Basic Authentication.

### 1. Generate a Secure API Key

```bash
# Generate a secure random key (Linux/macOS)
openssl rand -hex 32

# Or use Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# PowerShell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

### 2. Add to Environment Variables

```env
# .env file
METRICS_API_KEY=your-generated-secure-key-here
```

For production (ECS), add this to your task definition environment variables.

### 3. Test the Endpoint

```bash
# Local testing
curl -u metrics:your-generated-secure-key-here http://localhost:3000/metrics

# Production testing
curl -u metrics:your-generated-secure-key-here https://api.yourdomain.com/metrics
```

You should see Prometheus-formatted metrics output.

## Prometheus Server Setup

Choose one of the following deployment options:

### Option 1: Docker (Local/Testing)

Perfect for local development and testing.

#### Step 1: Prepare Configuration

```bash
# Navigate to grafana folder
cd grafana

# Copy example file
cp prometheus.yml.example prometheus.yml
```

#### Step 2: Edit prometheus.yml

Replace placeholders with your values:

```yaml
global:
  scrape_interval: 30s
  evaluation_interval: 30s

scrape_configs:
  - job_name: "typelets-api"
    scheme: https # Use 'http' for local testing
    basic_auth:
      username: "metrics"
      password: "your-actual-METRICS_API_KEY-here"
    static_configs:
      - targets: ["api.yourdomain.com"] # Or 'host.docker.internal:3000' for local
    metrics_path: "/metrics"
```

**For local testing**, use:

```yaml
scheme: http
targets: ["host.docker.internal:3000"]
```

#### Step 3: Run Prometheus in Docker

```bash
# Run Prometheus with your config
docker run -d \
  --name typelets-prometheus \
  -p 9090:9090 \
  -v $(pwd)/prometheus.yml:/etc/prometheus/prometheus.yml \
  prom/prometheus:latest

# Check logs
docker logs typelets-prometheus

# Access Prometheus UI
# Open http://localhost:9090
```

#### Step 4: Verify Scraping

1. Open http://localhost:9090/targets
2. Ensure your target shows as "UP"
3. Try a query: `typelets_http_requests_total`

### Option 2: AWS ECS (Production)

Recommended for production deployments.

#### Step 1: Prepare Configuration Files

```bash
cd grafana

# Copy all example files
cp prometheus.yml.example prometheus.yml
cp Dockerfile.prometheus.example Dockerfile.prometheus
cp prometheus-task-definition.json.example prometheus-task-definition.json
```

#### Step 2: Update prometheus.yml

```yaml
global:
  scrape_interval: 30s
  evaluation_interval: 30s

scrape_configs:
  - job_name: "typelets-api"
    scheme: https
    basic_auth:
      username: "metrics"
      password: "your-actual-METRICS_API_KEY-here"
    static_configs:
      - targets: ["api.yourdomain.com"]
    metrics_path: "/metrics"
```

#### Step 3: Create ECR Repository

```bash
# Create ECR repository
aws ecr create-repository \
  --repository-name typelets-prometheus \
  --region us-east-1

# Note the repositoryUri from the output
```

#### Step 4: Build and Push Docker Image

```bash
# Authenticate Docker to ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin YOUR_AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com

# Build image
docker build -f Dockerfile.prometheus -t typelets-prometheus .

# Tag image
docker tag typelets-prometheus:latest \
  YOUR_AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/typelets-prometheus:latest

# Push to ECR
docker push YOUR_AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/typelets-prometheus:latest
```

#### Step 5: Update Task Definition

Edit `prometheus-task-definition.json`:

```json
{
  "family": "typelets-prometheus",
  "executionRoleArn": "arn:aws:iam::YOUR_AWS_ACCOUNT_ID:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "image": "YOUR_AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/typelets-prometheus:latest",
      ...
    }
  ]
}
```

#### Step 6: Create CloudWatch Log Group

```bash
aws logs create-log-group \
  --log-group-name /ecs/typelets-prometheus \
  --region us-east-1
```

#### Step 7: Register Task Definition

```bash
aws ecs register-task-definition \
  --cli-input-json file://prometheus-task-definition.json \
  --region us-east-1
```

#### Step 8: Deploy to ECS

```bash
# Run task in your ECS cluster
aws ecs run-task \
  --cluster your-cluster-name \
  --task-definition typelets-prometheus \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx],securityGroups=[sg-xxx],assignPublicIp=ENABLED}" \
  --region us-east-1
```

Or create a service for persistent deployment:

```bash
aws ecs create-service \
  --cluster your-cluster-name \
  --service-name typelets-prometheus \
  --task-definition typelets-prometheus \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx],securityGroups=[sg-xxx],assignPublicIp=ENABLED}" \
  --region us-east-1
```

#### Step 9: Configure Security Groups

**Important**: Lock down access to Prometheus.

```bash
# For AWS Managed Grafana (recommended)
# Only allow Grafana's security group to access port 9090
aws ec2 authorize-security-group-ingress \
  --group-id sg-prometheus \
  --protocol tcp \
  --port 9090 \
  --source-group sg-grafana

# For testing (temporary)
aws ec2 authorize-security-group-ingress \
  --group-id sg-prometheus \
  --protocol tcp \
  --port 9090 \
  --cidr 0.0.0.0/0
```

⚠️ **Security Note**: Never leave port 9090 open to the public in production!

### Option 3: Amazon Managed Service for Prometheus

For AWS-native monitoring without managing Prometheus servers.

#### Step 1: Create AMP Workspace

```bash
aws amp create-workspace \
  --alias typelets-monitoring \
  --region us-east-1
```

#### Step 2: Set Up Remote Write

Instead of deploying Prometheus, configure your API to send metrics directly to AMP using the remote write endpoint.

**Note**: This requires additional setup in the API code (not currently implemented). For now, use Options 1 or 2 with a Prometheus server.

## Grafana Setup

### AWS Managed Grafana

#### Step 1: Create Workspace

1. Go to AWS Console → Amazon Managed Grafana
2. Click "Create workspace"
3. Choose authentication type (AWS SSO or SAML)
4. Select VPC and subnets (if using private Prometheus)

#### Step 2: Add Prometheus Data Source

1. Open Grafana workspace URL
2. Go to Configuration → Data Sources
3. Click "Add data source"
4. Select "Prometheus"
5. Configure:
   - **Name**: Typelets Prometheus
   - **URL**: `http://prometheus-private-ip:9090` (for ECS) or `http://localhost:9090` (for local)
   - **Auth**: None (if in same VPC) or Basic Auth
6. Click "Save & Test"

#### Step 3: Configure VPC Endpoints (if needed)

If Grafana can't reach CloudWatch or other AWS services:

```bash
# Create VPC endpoint for CloudWatch Logs
aws ec2 create-vpc-endpoint \
  --vpc-id vpc-xxx \
  --service-name com.amazonaws.us-east-1.logs \
  --vpc-endpoint-type Interface \
  --subnet-ids subnet-xxx subnet-yyy \
  --security-group-ids sg-xxx

# Create VPC endpoint for CloudWatch Monitoring
aws ec2 create-vpc-endpoint \
  --vpc-id vpc-xxx \
  --service-name com.amazonaws.us-east-1.monitoring \
  --vpc-endpoint-type Interface \
  --subnet-ids subnet-xxx subnet-yyy \
  --security-group-ids sg-xxx
```

### Self-Hosted Grafana

#### Installation

```bash
# Docker
docker run -d \
  --name typelets-grafana \
  -p 3000:3000 \
  grafana/grafana:latest

# Access at http://localhost:3000
# Default credentials: admin / admin
```

#### Add Data Source

Same as AWS Managed Grafana steps above.

## Dashboard Import

### Step 1: Get Dashboard JSON

```bash
cd grafana
cp grafana-dashboard.json.example grafana-dashboard.json
```

### Step 2: Update Data Source UID

1. In Grafana, go to Configuration → Data Sources
2. Click on your Prometheus data source
3. Copy the UID from the URL (e.g., `af1a9ciumo8owd`)
4. Edit `grafana-dashboard.json`:

```bash
# Replace placeholder with your actual UID
# PowerShell
(Get-Content grafana-dashboard.json) -replace 'YOUR_PROMETHEUS_DATASOURCE_UID', 'your-actual-uid' | Set-Content grafana-dashboard.json

# Linux/macOS
sed -i 's/YOUR_PROMETHEUS_DATASOURCE_UID/your-actual-uid/g' grafana-dashboard.json
```

### Step 3: Import Dashboard

1. In Grafana, click "+ " → Import
2. Click "Upload JSON file"
3. Select your edited `grafana-dashboard.json`
4. Click "Load"
5. Select your Prometheus data source
6. Click "Import"

### Dashboard Panels

The included dashboard provides:

- **HTTP Req/s**: Real-time HTTP request rate
- **DB Queries/s**: Database query rate
- **Memory %**: Node.js heap usage percentage
- **WebSocket Connections**: Active WebSocket connections
- **HTTP Status Codes**: Pie chart of response status distribution
- **HTTP Requests by Endpoint**: Time series by endpoint
- **HTTP Response Time (p50, p95)**: Latency percentiles
- **Database Queries by Operation**: Breakdown by SELECT/INSERT/UPDATE/DELETE
- **Database Query Duration (p50, p95)**: Query performance
- **Node.js Memory Usage Over Time**: Heap and external memory trends

## Security Best Practices

### 1. Protect the Metrics Endpoint

```env
# Always set a strong API key
METRICS_API_KEY=use-a-long-random-secure-key-here
```

### 2. Restrict Prometheus Access

- **Never** expose Prometheus port 9090 to the public internet
- Use security groups to restrict access to Grafana only
- Consider VPC-only deployment (no public IP)

### 3. Use HTTPS

For production, always use HTTPS for the metrics endpoint:

```yaml
# prometheus.yml
scrape_configs:
  - job_name: "typelets-api"
    scheme: https # Not http
```

### 4. Rotate API Keys

Periodically rotate your `METRICS_API_KEY`:

1. Generate new key
2. Update API environment variable
3. Update `prometheus.yml`
4. Restart Prometheus
5. Invalidate old key

### 5. Monitor Access Logs

Check for unauthorized access attempts:

```bash
# API logs will show failed auth attempts
# Look for "Unauthorized metrics access attempt" messages
```

## Troubleshooting

### Prometheus Can't Scrape API

**Symptom**: Target shows as "DOWN" in Prometheus

**Solutions**:

1. Check Basic Auth credentials match
2. Verify API is accessible from Prometheus (network connectivity)
3. Check security groups allow traffic
4. Verify `METRICS_API_KEY` is set in API environment
5. Test endpoint manually: `curl -u metrics:key http://api:3000/metrics`

### Grafana Shows "No Data"

**Symptom**: Dashboard panels display "No data"

**Solutions**:

1. Verify Prometheus data source is connected (Save & Test)
2. Check data source UID matches in dashboard JSON
3. Ensure Prometheus is successfully scraping (check /targets)
4. Try a simple query in Explore: `typelets_http_requests_total`
5. Check time range in dashboard (top-right)

### Queries Return Empty Results

**Symptom**: Queries work but return no data

**Solutions**:

1. Check if API has received any traffic (metrics need data)
2. Verify query syntax: use `sum()` for aggregation
3. Check label names match (case-sensitive)
4. Increase time range

### Grafana Can't Reach CloudWatch

**Symptom**: CloudWatch data source shows 504 timeout

**Solutions**:

1. Create VPC endpoints for CloudWatch (see Grafana Setup)
2. Check security groups allow HTTPS outbound
3. Verify IAM role has CloudWatch permissions

### Memory Usage Seems High

**Symptom**: Memory % panel shows 80-90%

**Resolution**: This is normal for Node.js! The heap grows to available memory. Check:

- Actual memory usage in ECS metrics (should be 40-60% of container limit)
- Memory leaks (steadily increasing over days)
- Heap size vs. container size ratio

### Database Metrics Not Appearing

**Symptom**: Database panels show no data

**Solutions**:

1. Verify database instrumentation is deployed (check `src/db/index.ts`)
2. Ensure API has executed database queries
3. Check metric names: `typelets_database_queries_total`
4. Look for errors in API logs

## Additional Resources

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [AWS Managed Grafana](https://docs.aws.amazon.com/grafana/)
- [PromQL Query Language](https://prometheus.io/docs/prometheus/latest/querying/basics/)

## Support

For issues specific to Typelets API monitoring:

- Check the [grafana/README.md](grafana/README.md) for configuration examples
- Review API logs for authentication errors
- Verify environment variables are set correctly

For general Prometheus/Grafana issues:

- Consult official documentation
- Check community forums
