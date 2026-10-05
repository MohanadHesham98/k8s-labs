# Lab 02: Creating Pods with Probes, Requests & Limits

This repository contains the complete step-by-step guide, Kubernetes manifests, and verification commands for **Lab 2: Creating Pods with Probes, Requests & Limits**.

The purpose of this lab is to familiarize you with:

- Configuring container resource requests and limits (`cpu` and `memory`) matching single-node or VM capabilities
- Setting up **Startup Probes**, **Readiness Probes**, and **Liveness Probes**
- Observing Pod lifecycles during health check initialization
- Simulating probe failures and analyzing Kubernetes self-healing behavior

---

## Step 1: Understanding Resource Requests & Limits and Health Probes

### Resource Management Overview
- **Requests (`requests`)**: The minimum amount of CPU and Memory guaranteed by Kubernetes to schedule the Pod on a node.
- **Limits (`limits`)**: The maximum ceiling of CPU and Memory the container is allowed to consume.
  - If Memory exceeds `limits`, the kernel terminates the container with an **OOMKilled** status.
  - If CPU exceeds `limits`, Kubernetes throttles CPU consumption.

### Kubernetes Health Probes Overview
- **Startup Probe**: Determines whether the application inside the container has started. All other probes are disabled until the startup probe succeeds.
- **Readiness Probe**: Determines whether the container is ready to accept user traffic. If it fails, Kubernetes removes the Pod IP from Service endpoints.
- **Liveness Probe**: Determines if the container is still alive and healthy. If it fails, `kubelet` restarts the container according to its `restartPolicy`.

---

## Step 2: Creating the Application Directory and Manifest

Create a working directory for Lab 2:

```bash
mkdir -p kubernetes-labs/lab02-probes-resources
cd kubernetes-labs/lab02-probes-resources
```

Create a YAML manifest file named `pod-probes-resources.yaml`:

```bash
nano pod-probes-resources.yaml
```

Paste the following Pod configuration into the file:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: demo-probes-pod
  labels:
    app: probe-demo
spec:
  containers:
  - name: web-app
    image: nginx:alpine
    ports:
    - containerPort: 80
    
    # 1. Resource Requests and Limits tailored for small VMs / K3s nodes
    resources:
      requests:
        memory: "64Mi"
        cpu: "100m"
      limits:
        memory: "128Mi"
        cpu: "250m"

    # 2. Startup Probe: Ensures initialization complete before checking readiness/liveness
    startupProbe:
      httpGet:
        path: /
        port: 80
      initialDelaySeconds: 5
      periodSeconds: 5
      failureThreshold: 10

    # 3. Readiness Probe: Controls service traffic routing
    readinessProbe:
      httpGet:
        path: /
        port: 80
      initialDelaySeconds: 5
      periodSeconds: 5
      successThreshold: 1
      failureThreshold: 3

    # 4. Liveness Probe: Triggers container restarts upon application crash/freeze
    livenessProbe:
      httpGet:
        path: /
        port: 80
      initialDelaySeconds: 10
      periodSeconds: 10
      failureThreshold: 3
```

---

## Step 3: Deploying the Pod to Kubernetes

Apply the manifest using `kubectl`:

```bash
kubectl apply -f pod-probes-resources.yaml
```
<img width="1035" height="80" alt="image" src="https://github.com/user-attachments/assets/41d1365f-e0b5-49fc-a214-0afaba0c8d08" />

Verify Pod status and watch the startup progression:

```bash
kubectl get pods -w
```
Expected output:

```text
NAME              READY   STATUS    RESTARTS   AGE
demo-probes-pod   0/1     ContainerCreating   0          2s
demo-probes-pod   0/1     Running             0          8s
demo-probes-pod   1/1     Running             0          15s
```
<img width="854" height="196" alt="image" src="https://github.com/user-attachments/assets/edb23a68-483a-4cb0-8131-cff16d0363f6" />

---

## Step 4: Verifying Resource Limits and Health Probes

Inspect detailed metadata and runtime probe status of the running Pod:

```bash
kubectl describe pod demo-probes-pod
```

Look for the following sections in the command output:

```text
    Limits:
      cpu:     250m
      memory:  128Mi
    Requests:
      cpu:     100m
      memory:  64Mi
    Liveness:     http-get http://:80/ delay=10s timeout=1s period=10s #success=1 #failure=3
    Readiness:    http-get http://:80/ delay=5s timeout=1s period=5s #success=1 #failure=3
    Startup:      http-get http://:80/ delay=5s timeout=1s period=5s #success=1 #failure=10
```
<img width="1171" height="137" alt="image" src="https://github.com/user-attachments/assets/ac14367c-af31-4150-881f-fbe1201f88bb" />


<img width="1402" height="205" alt="image" src="https://github.com/user-attachments/assets/8b5f37d4-ca40-42ee-a4a9-725b899c7c4b" />

Verify resource utilization metrics (requires Metrics Server enabled):

```bash
kubectl top pod demo-probes-pod
```
<img width="973" height="94" alt="image" src="https://github.com/user-attachments/assets/2d292aae-abe1-47d4-b0ec-4bfb4527b07d" />

---

## Step 5: Testing Readiness and Liveness Probe Failure Behavior

In this step, we will simulate application failures inside the container to observe how Kubernetes independently reacts to **Readiness** (removing traffic) and **Liveness** (restarting the container) probe failures.

---

### Phase 1: Testing Readiness Probe Failure

Simulate a temporary application outage by renaming the `index.html` file inside the running container. This causes HTTP `404 Not Found` errors for the Readiness endpoint `/`:
```bash
kubectl exec -it demo-probes-pod -- mv /usr/share/nginx/html/index.html /usr/share/nginx/html/index.html.bak
```
Observe the Pod readiness state:

```bash
kubectl get pods
```

Expected output after 15–20 seconds (Readiness fails, `READY` becomes `0/1`, but container is NOT restarted):

```text
NAME              READY   STATUS    RESTARTS   AGE
demo-probes-pod   0/1     Running   0          2m10s
```
<img width="838" height="88" alt="image" src="https://github.com/user-attachments/assets/9e7c7349-dcd6-4edf-9ad2-fd705157538c" />

Check the generated failure events:
```bash
kubectl describe pod demo-probes-pod
```
<img width="1505" height="382" alt="image" src="https://github.com/user-attachments/assets/235fd65d-b61c-43ad-85d2-eb506ae21f08" />

---
### Phase 2: Testing Liveness Probe Failure & Auto-Healing
If the Liveness probe is configured to monitor the same failing endpoint / (or if we manually remove the Liveness health check file /healthz), Kubernetes determines that the application is unhealthy and unrecoverable.

```bash
kubectl get pods -w
```
<img width="1407" height="250" alt="image" src="https://github.com/user-attachments/assets/13283cac-2416-4a65-9947-23cd060b05c9" />

Because a new container instance was started, Nginx resets its default file system, restoring /usr/share/nginx/html/index.html and returning the Pod to a fully 1/1 Running healthy status.

Check the failure events in event logs:

```bash
kubectl get events --field-selector involvedObject.name=demo-probes-pod
```
<img width="1406" height="336" alt="image" src="https://github.com/user-attachments/assets/182631a8-f62c-466d-8676-aa1af2f11ac4" />

---

## Step 7: Cleanup Resources

Delete the lab Pod:

```bash
kubectl delete -f pod-probes-resources.yaml --ignore-not-found=true
kubectl delete pod demo-probes-pod --ignore-not-found=true
```

Confirm that the Pod has been removed:

```bash
kubectl get pods
```
<img width="1355" height="135" alt="image" src="https://github.com/user-attachments/assets/4c96c785-3b51-42ec-b484-56db192cb08b" />

---

## Useful Kubernetes Commands for Probes & Resources

| Command | Description |
|---|---|
| `kubectl apply -f <file.yaml>` | Deploy or update Kubernetes resources from a YAML manifest |
| `kubectl get pods` | Display running Pods, readiness state, and restart counts |
| `kubectl describe pod <pod_name>` | Display detailed events, probe specifications, and resource allocations |
| `kubectl top pod <pod_name>` | Monitor real-time CPU and Memory consumption |
| `kubectl exec -it <pod_name> -- <command>` | Run diagnostic commands directly inside a running container |
| `kubectl logs <pod_name>` | Stream stdout/stderr container logs |
| `kubectl delete -f <file.yaml>` | Delete Pods and resources defined in a manifest |

---

## Lab Summary

In this lab, you learned how to:

- Configure container **CPU and Memory requests/limits** sized for small VMs and K3s nodes
- Implement **Startup**, **Readiness**, and **Liveness** probes using HTTP endpoints
- Observe how **Readiness Probes** remove unhealthy containers from service endpoints without restarting them
- Verify how **Liveness Probes** trigger automated container restarts upon unrecoverable application failures
- Inspect Pod status and diagnostic events using `kubectl describe` and `kubectl get events`
