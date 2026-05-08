# SafeRx Logging

SafeRx currently uses Kubernetes logs and GKE/Cloud Logging for application log visibility.

## View Backend Logs

```powershell
kubectl logs -n saferx -l app=saferx-backend --tail=100