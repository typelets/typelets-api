# Grafana & Prometheus Monitoring Setup

This folder contains **optional** configuration files for setting up Prometheus and Grafana monitoring for the Typelets API.

📖 **For complete setup instructions, see [PROMETHEUS.md](PROMETHEUS.md)**

## Important Notes

⚠️ **These files are completely optional** - The API will work perfectly fine without them. The `/metrics` endpoint is built into the API and will always be available.

🔧 **These are example files** - You need to customize them with your own values before use.

## What's Included

- **prometheus.yml.example** - Prometheus server configuration for scraping the API metrics endpoint
- **Dockerfile.prometheus.example** - Docker image for running Prometheus server
- **prometheus-task-definition.json.example** - AWS ECS task definition for deploying Prometheus
- **grafana-dashboard.json.example** - Pre-built Grafana dashboard with API metrics

## Architecture

```
Typelets API (/metrics endpoint)
        ↓
Prometheus Server (scrapes /metrics every 30s)
        ↓
Grafana (queries Prometheus, visualizes data)
```

## When Do You Need This?

You only need these files if you want to:

- Set up a Prometheus server to collect metrics from your API
- Visualize metrics in Grafana dashboards
- Deploy Prometheus in AWS ECS/Docker

## When Don't You Need This?

Skip this folder if you:

- Just want to run the API locally
- Don't need monitoring/observability
- Use a different monitoring solution

The API's `/metrics` endpoint will still work and be available for other Prometheus-compatible tools.

## Setup Instructions

1. **Copy example files and remove `.example` extension:**

   ```bash
   cd grafana
   cp prometheus.yml.example prometheus.yml
   cp Dockerfile.prometheus.example Dockerfile.prometheus
   cp prometheus-task-definition.json.example prometheus-task-definition.json
   cp grafana-dashboard.json.example grafana-dashboard.json
   ```

2. **Update placeholders in the files:**
   - `prometheus.yml`: Replace `YOUR_METRICS_API_KEY_HERE` with your actual API key
   - `prometheus-task-definition.json`: Replace `YOUR_AWS_ACCOUNT_ID` with your AWS account ID
   - `grafana-dashboard.json`: Replace `YOUR_PROMETHEUS_DATASOURCE_UID` with your Grafana data source UID

3. **Deploy Prometheus (if using ECS):**

   ```bash
   # Build and push to ECR
   docker build -f Dockerfile.prometheus -t typelets-prometheus .
   aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin YOUR_AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com
   docker tag typelets-prometheus:latest YOUR_AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/typelets-prometheus:latest
   docker push YOUR_AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/typelets-prometheus:latest

   # Create ECS task
   aws ecs register-task-definition --cli-input-json file://prometheus-task-definition.json
   ```

4. **Import dashboard to Grafana:**
   - Open Grafana
   - Go to Dashboards → Import
   - Upload `grafana-dashboard.json`
   - Select your Prometheus data source

## For More Information

See the main [README.md](../README.md#monitoring-with-prometheus--grafana) for details about:

- Available metrics
- `/metrics` endpoint authentication
- Local testing
- Alternative monitoring setups
