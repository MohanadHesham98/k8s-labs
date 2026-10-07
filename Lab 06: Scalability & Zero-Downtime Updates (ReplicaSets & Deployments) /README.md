# Lab 06: Scalability & Zero-Downtime Updates (ReplicaSets & Deployments)

This repository contains the complete step-by-step guide and commands for **Lab 6: Scalability & Zero-Downtime Updates on Kubernetes**.

The purpose of this lab is to familiarize you with:

- Understanding the relationship between **Deployments, ReplicaSets, and Pods**
- Scaling applications horizontally by changing replica counts
- Performing **Zero-Downtime Rolling Updates**
- Monitoring rollout status and deployment history
- Rolling back deployments to previous versions
- Verifying uninterrupted application availability during update cycles

---

## Deployment Concepts Overview

| Feature | Replicas / ReplicaSet | Rolling Update | Rollback (`rollout undo`) |
|---|---|---|---|
| **Purpose** | High Availability & Load Scaling | Zero-downtime application version updates | Reversal to a previous healthy release |
| **Mechanism** | Maintains the specified number of identical Pods | Incrementally replaces old Pods with new Pods | Reverts the Deployment template to a previous revision |
| **Downtime** | None | **Zero Downtime** | **Zero Downtime** |

### Kubernetes Relationship

```text
Deployment
    │
    ├── ReplicaSet
    │      ├── Pod
    │      ├── Pod
    │      └── Pod
    │
    └── Service
           │
           └── Routes traffic to Pods
```

---

# Step 1: Cluster Preparation & Setup

Verify that your Kubernetes cluster is active and that your node status is `Ready`.

```bash
kubectl get nodes
```

### Create a Dedicated Namespace

Create a namespace for this lab:

```bash
kubectl create namespace lab06
```

Set the current Kubernetes context to use the `lab06` namespace:

```bash
kubectl config set-context --current --namespace=lab06
```

Verify the current namespace:

```bash
kubectl config view --minify --output 'jsonpath={..namespace}'
```
<img width="1221" height="83" alt="image" src="https://github.com/user-attachments/assets/636cc17a-14f4-4ab4-b817-e9cc74e6f4a8" />

---

# Step 2: Creating the Initial Deployment (v1)

Create an initial Deployment named `web-app` running:

```text
nginx:1.21-alpine
```

The Deployment will start with **3 replicas**.

The Deployment uses a `RollingUpdate` strategy with:

- `maxSurge: 1` — allows one additional Pod during the update
- `maxUnavailable: 0` — ensures no existing Pod becomes unavailable during the update

## Create the Deployment Manifest

Create a file named:

```text
deployment-v1.yaml
```

Add the following configuration:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-app
  labels:
    app: web-app
spec:
  replicas: 3

  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0

  selector:
    matchLabels:
      app: web-app

  template:
    metadata:
      labels:
        app: web-app
        version: "v1"

    spec:
      containers:
        - name: nginx
          image: nginx:1.21-alpine
          ports:
            - containerPort: 80

---
apiVersion: v1
kind: Service
metadata:
  name: web-app-service
spec:
  type: ClusterIP

  selector:
    app: web-app

  ports:
    - protocol: TCP
      port: 80
      targetPort: 80
```

## Apply the Deployment and Service

```bash
kubectl apply -f deployment-v1.yaml
```

Expected output:

```text
deployment.apps/web-app created
service/web-app-service created
```

## Verify Deployment, ReplicaSet, Pods, and Service

```bash
kubectl get deployments,rs,pods,svc
```

You should see:

- 1 Deployment
- 1 ReplicaSet
- 3 Pods
- 1 Service
<img width="956" height="348" alt="image" src="https://github.com/user-attachments/assets/7a9be8c4-0bc4-4a2d-abf4-6d45a61ec9e0" />

## Check Rollout Status

```bash
kubectl rollout status deployment/web-app
```

Expected output:

```text
deployment "web-app" successfully rolled out
```
<img width="1039" height="71" alt="image" src="https://github.com/user-attachments/assets/6fe931ed-933b-4fcd-b0d2-85030331fe14" />

---

# Step 3: Scaling the Application

Kubernetes Deployments allow applications to be horizontally scaled by increasing or decreasing the number of replicas.

In this step, we will:

1. Scale from 3 → 5 replicas
2. Scale from 5 → 2 replicas
3. Reset back to 3 replicas

---

## Scale Up to 5 Replicas

```bash
kubectl scale deployment web-app --replicas=5
```

Verify the Pods:

```bash
kubectl get pods -l app=web-app
```
<img width="791" height="177" alt="image" src="https://github.com/user-attachments/assets/52995bcc-d692-400e-88d9-8dddcff50aeb" />

Verify the Deployment:

```bash
kubectl get deployment web-app
```

You should see:

```text
READY   UP-TO-DATE   AVAILABLE
5/5     5            5
```
<img width="831" height="103" alt="image" src="https://github.com/user-attachments/assets/29982594-d06b-43e8-89cb-532f727954b7" />

---

## Scale Down to 2 Replicas

```bash
kubectl scale deployment web-app --replicas=2
```
<img width="1101" height="50" alt="image" src="https://github.com/user-attachments/assets/c2f8df3e-f0d7-4bc5-8fa5-49729faff6fb" />

Verify the Pods:

```bash
kubectl get pods -l app=web-app
```

Verify the Deployment:

```bash
kubectl get deployment web-app
```

The number of running Pods should now be:

```text
2
```
<img width="868" height="180" alt="image" src="https://github.com/user-attachments/assets/990a1cd4-9562-4060-953c-711d1b99a0c7" />

---

## Reset to 3 Replicas

Reset the Deployment to its original replica count:

```bash
kubectl scale deployment web-app --replicas=3
```

Verify:

```bash
kubectl get pods -l app=web-app
```
<img width="1067" height="248" alt="image" src="https://github.com/user-attachments/assets/ca924a8f-36a9-4a9f-a082-1fcc6d9250d2" />

---

# Step 4: Zero-Downtime Rolling Update

Now we will upgrade the application from:

```text
nginx:1.21-alpine
```

to:

```text
nginx:1.25-alpine
```

Because the Deployment uses:

```yaml
strategy:
  type: RollingUpdate
  rollingUpdate:
    maxSurge: 1
    maxUnavailable: 0
```

Kubernetes will gradually replace the old Pods with new Pods.

This allows the application to remain available during the update.

---

## Option A: Update Using `kubectl set image`

Run:

```bash
kubectl set image deployment/web-app nginx=nginx:1.25-alpine
```

> **Note:** The `--record` option used in older Kubernetes examples is deprecated/removed in newer Kubernetes versions. Deployment revision history is still maintained when the Pod template changes.

---

## Option B: Update Using the Manifest

You can also modify the image inside the YAML file:

```yaml
image: nginx:1.25-alpine
```
<img width="1236" height="68" alt="image" src="https://github.com/user-attachments/assets/cfbe7be7-f968-4fc1-8c50-6b7e9b7aaccc" />

Then apply the updated manifest:

```bash
kubectl apply -f deployment-v1.yaml
```

Alternatively, edit the live Deployment:

```bash
kubectl edit deployment web-app
```

Change:

```yaml
image: nginx:1.21-alpine
```

to:

```yaml
image: nginx:1.25-alpine
```

---

# Monitor the Rolling Update

Open a separate terminal and watch the Pods in real time:

```bash
kubectl get pods -w
```
You will see old Pods being terminated while new Pods are created.

<img width="1224" height="133" alt="image" src="https://github.com/user-attachments/assets/a622a1ca-1b5d-4366-b5d4-b1932dd47f16" />

<img width="722" height="278" alt="image" src="https://github.com/user-attachments/assets/a7d80b0e-77ee-43e4-bbb9-881e201bf69f" />
<img width="843" height="142" alt="image" src="https://github.com/user-attachments/assets/dfc6e703-894e-4fda-a345-c5a0c8fab11b" />


Eventually, all Pods should be running the new version.

---

## Check Rollout Status

```bash
kubectl rollout status deployment/web-app
```

Expected output:

```text
deployment "web-app" successfully rolled out
```
<img width="1041" height="68" alt="image" src="https://github.com/user-attachments/assets/23041c0c-9987-47e3-ab87-85e661aebb88" />

---

## Verify ReplicaSets

Check the ReplicaSets associated with the Deployment:

```bash
kubectl get rs -l app=web-app
```

You should see the new ReplicaSet with the active replicas and the previous ReplicaSet scaled down to zero.

Example:

```text
NAME                  DESIRED   CURRENT   READY
web-app-xxxxx         3         3         3
web-app-yyyyy         0         0         0
```
<img width="926" height="115" alt="image" src="https://github.com/user-attachments/assets/9b1a62e8-a82c-440d-934b-767b0a370cde" />

The old ReplicaSet is retained by Kubernetes so that the Deployment can roll back to the previous revision if necessary.

---

# Step 5: Revision History & Rollback

Kubernetes Deployments maintain revision history whenever the Pod template changes.

This allows us to inspect previous versions and roll back if a new release causes problems.

---

## View Rollout History

Run:

```bash
kubectl rollout history deployment/web-app
```
<img width="1037" height="155" alt="image" src="https://github.com/user-attachments/assets/6b9ec9dc-1f4e-4307-b041-40625e80546f" />

Example:

```text
deployment.apps/web-app
REVISION  CHANGE-CAUSE
1         <none>
2         <none>
```

---

## Inspect a Specific Revision

To inspect revision 1:

```bash
kubectl rollout history deployment/web-app --revision=1
```

You can also inspect revision 2:

```bash
kubectl rollout history deployment/web-app --revision=2
```
<img width="1177" height="773" alt="image" src="https://github.com/user-attachments/assets/784e7a79-41d2-45cc-a134-7d80f338cc96" />

---

# Rollback the Deployment

If the new version contains bugs or unexpected behavior, roll back to the previous revision:

```bash
kubectl rollout undo deployment/web-app
```

Kubernetes will gradually replace the current Pods with Pods from the previous revision.

---

## Roll Back to a Specific Revision

To roll back to a specific revision:

```bash
kubectl rollout undo deployment/web-app --to-revision=1
```

Check the rollout:

```bash
kubectl rollout status deployment/web-app
```

Expected output:

```text
deployment "web-app" successfully rolled out
```
<img width="1038" height="69" alt="image" src="https://github.com/user-attachments/assets/53ce15c7-89cb-4334-9b50-c71c47b32cfe" />

---

## Verify the Image Version

Check which image is currently being used:

```bash
kubectl get pods -l app=web-app -o jsonpath='{range .items[*]}{.spec.containers[*].image}{"\n"}{end}'
```

After rolling back to revision 1, the output should contain:

```text
nginx:1.21-alpine
```
<img width="1493" height="141" alt="image" src="https://github.com/user-attachments/assets/64f822a5-3deb-4795-a2f5-4afdace76379" />

---

# Step 6: Testing & Verification

To verify that the application remains available during updates, we can continuously send HTTP requests to the Kubernetes Service.

Run a temporary Alpine Pod:

```bash
kubectl run test-pod \
  --rm \
  -it \
  --image=alpine \
  -- sh -c "apk add --no-cache curl && while true; do curl -s http://web-app-service; sleep 1; done"
```

The command continuously sends requests to:

```text
http://web-app-service
```

While this command is running, you can perform a rolling update from another terminal:

```bash
kubectl set image deployment/web-app nginx=nginx:1.25-alpine
```

Then monitor the rollout:

```bash
kubectl rollout status deployment/web-app
```

Because `maxUnavailable` is set to `0`, Kubernetes maintains the required number of available Pods throughout the rolling update.
<img width="1119" height="163" alt="image" src="https://github.com/user-attachments/assets/e8ae336b-d05b-4d5c-9b9f-f6a312f60e32" />

---

# Step 7: Resource Cleanup

After completing the lab, remove the Deployment and Service:

```bash
kubectl delete -f deployment-v1.yaml
```

Delete the namespace:

```bash
kubectl delete namespace lab06
```

Verify that the namespace has been removed:

```bash
kubectl get namespaces
```

---

# Useful Kubernetes Rollout Commands

| Command | Description |
|---|---|
| `kubectl rollout status deployment/<name>` | Show the current rollout status |
| `kubectl rollout history deployment/<name>` | View Deployment revision history |
| `kubectl rollout history deployment/<name> --revision=N` | Inspect a specific revision |
| `kubectl rollout undo deployment/<name>` | Roll back to the previous revision |
| `kubectl rollout undo deployment/<name> --to-revision=N` | Roll back to a specific revision |
| `kubectl rollout restart deployment/<name>` | Gracefully restart all Pods |
| `kubectl get rs` | List ReplicaSets |
| `kubectl get pods -w` | Watch Pod changes in real time |
| `kubectl scale deployment/<name> --replicas=N` | Change the number of replicas |

---

# Important Kubernetes Commands Used in This Lab

### Check Cluster Nodes

```bash
kubectl get nodes
```

### Check All Resources

```bash
kubectl get deployments,rs,pods,svc
```

### Scale a Deployment

```bash
kubectl scale deployment web-app --replicas=5
```

### Update Container Image

```bash
kubectl set image deployment/web-app nginx=nginx:1.25-alpine
```

### Monitor Pods

```bash
kubectl get pods -w
```

### Check Deployment Status

```bash
kubectl rollout status deployment/web-app
```

### View Deployment History

```bash
kubectl rollout history deployment/web-app
```

### Roll Back

```bash
kubectl rollout undo deployment/web-app
```

---

# Lab Summary

In this lab, you learned how to:

- Deploy containerized applications using Kubernetes **Deployments**
- Understand the relationship between **Deployments, ReplicaSets, and Pods**
- Horizontally scale applications using `kubectl scale`
- Scale applications up and down dynamically
- Perform **Zero-Downtime Rolling Updates**
- Configure `maxSurge` and `maxUnavailable`
- Monitor rolling updates in real time
- Track Deployment revision history
- Roll back failed or faulty releases using `kubectl rollout undo`
- Verify application availability during update cycles
- Clean up Kubernetes resources after completing the lab

---

## Key Takeaway

Kubernetes **Deployments** provide a reliable mechanism for managing application releases.

By combining:

```text
Deployment
    ↓
ReplicaSet
    ↓
Pods
    ↓
Service
```

with a `RollingUpdate` strategy, applications can be **scaled horizontally**, **updated gradually**, and **rolled back safely** while maintaining application availability.

The key configuration for zero-downtime updates in this lab is:

```yaml
strategy:
  type: RollingUpdate
  rollingUpdate:
    maxSurge: 1
    maxUnavailable: 0
```

This ensures Kubernetes creates replacement Pods before terminating the existing available Pods, helping maintain continuous service availability during the update.
