# SafeRx Monitoring

SafeRx uses `kube-prometheus-stack` for Kubernetes monitoring on GKE.

## Components

- Prometheus: collects and stores metrics
- Grafana: visualizes metrics using dashboards
- Alertmanager: handles alerts
- kube-state-metrics: exposes Kubernetes object metrics such as pods, deployments, resource requests, and pod readiness

## Access Grafana Locally

```powershell
kubectl port-forward svc/monitoring-grafana 3000:80 -n monitoring