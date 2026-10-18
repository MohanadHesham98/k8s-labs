# Lab 08: Externalized Configuration Management (ConfigMaps & Secrets) 

This repository contains the complete step-by-step guide and commands for **Lab 8: Externalized Configuration Management on Kubernetes**.

The purpose of this lab is to familiarize you with:

- Separating application configuration and sensitive data from application source code.
- Creating and managing **ConfigMaps** for non-sensitive configuration data (e.g., UI themes, database hosts, feature flags).
- Creating and managing **Secrets** for sensitive credentials (e.g., database passwords, API keys).
- Injecting ConfigMaps and Secrets into Pods as **Environment Variables** (`env` and `envFrom`).
- Mounting ConfigMaps and Secrets as **Volumes** (`volumeMounts`) to present configuration files inside Pods.
- Verifying dynamic configuration updates and observing mounted volume behavior.
- Cleaning up Kubernetes configuration resources.

---

## Configuration Management Concepts Overview

| Resource Type | Primary Purpose | Security Level | Best Usage / Injection Methods |
| :--- | :--- | :--- | :--- |
| **ConfigMap** | Non-sensitive configuration data | Unencrypted plain text | Env vars, command-line arguments, mounted config files |
| **Secret** | Sensitive credentials & keys | Base64 encoded (opaque) | Env vars, mounted file projections (SSH keys, TLS certs) |

### Configuration Injection Methods

```text
ConfigMap / Secret Data
├── Environment Variables (env / envFrom) ──> Injected at container startup
└── Mounted Volumes (volumeMounts)          ──> Mounted as files inside container directory
```

---

## Step 1: Cluster Preparation & Setup

Verify that your Kubernetes cluster is active and that your node status is `Ready`:

```bash
kubectl get nodes
```

### Create a Dedicated Namespace

Create a namespace for this lab:

```bash
kubectl create namespace lab08
```

Set the current Kubernetes context to use the `lab08` namespace:

```bash
kubectl config set-context --current --namespace=lab08
```

Verify the current namespace:

```bash
kubectl config view --minify --output 'jsonpath={..namespace}'
```
<img width="971" height="140" alt="image" src="https://github.com/user-attachments/assets/2d2d77d3-3cb1-4c9e-b4a1-18198c556168" />

---

## Step 2: Creating ConfigMaps and Secrets

Kubernetes resources can be created imperatively via CLI or declaratively using YAML manifests.

### 1. Create ConfigMap (Imperative & Declarative)

Create a ConfigMap containing non-sensitive application settings.

Create a manifest file named `app-configmap.yaml`:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
data:
  APP_COLOR: "blue"
  APP_MODE: "production"
  DATABASE_HOST: "postgres-db-service"
  nginx.conf: |
    server {
        listen 80;
        location / {
            return 200 'ConfigMap Mounted Successfully!\n';
        }
    }
```

Apply the ConfigMap manifest:

```bash
kubectl apply -f app-configmap.yaml
```

Verify the ConfigMap creation:

```bash
kubectl get configmaps
kubectl describe configmap app-config
```
<img width="771" height="652" alt="image" src="https://github.com/user-attachments/assets/7a82ed35-801f-483a-8a1f-5dd78349d4f8" />

### 2. Create Secret (Declarative)

Secrets hold sensitive data. Kubernetes stores Secret values in encoded form when represented in the `data` field.

Create a manifest file named `app-secret.yaml`:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: app-secret
type: Opaque
stringData:
  DB_USER: "admin"
  DB_PASSWORD: "SuperSecretPassword123!"
  API_KEY: "xyz987654321key"
```

> **Note:** Using `stringData` allows writing plain text in the YAML file; Kubernetes automatically converts these values to Base64 in the Secret's stored `data` representation.

Apply the Secret manifest:

```bash
kubectl apply -f app-secret.yaml
```

Verify the Secret creation:

```bash
kubectl get secrets
kubectl describe secret app-secret
```
<img width="723" height="308" alt="image" src="https://github.com/user-attachments/assets/6310d884-5774-40ae-af11-17e2bde0557d" />

---

## Step 3: Injecting ConfigMaps & Secrets as Environment Variables

In this step, we consume ConfigMap and Secret data directly inside a Deployment Pod as environment variables.

### Create Deployment Manifest with Environment Variables

Create a file named `app-env-deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-app-env
spec:
  replicas: 1
  selector:
    matchLabels:
      app: web-app-env
  template:
    metadata:
      labels:
        app: web-app-env
    spec:
      containers:
        - name: web-app
          image: busybox:1.35
          command: ["/bin/sh", "-c", "while true; do echo App Color: $APP_COLOR, DB User: $DB_USER; sleep 10; done"]
          env:
            # Inject individual key from ConfigMap
            - name: APP_COLOR
              valueFrom:
                configMapKeyRef:
                  name: app-config
                  key: APP_COLOR
            # Inject individual key from Secret
            - name: DB_USER
              valueFrom:
                secretKeyRef:
                  name: app-secret
                  key: DB_USER
            - name: DB_PASS
              valueFrom:
                secretKeyRef:
                  name: app-secret
                  key: DB_PASSWORD
```

Apply the Deployment:

```bash
kubectl apply -f app-env-deployment.yaml
```

### Verify Environment Variables Inside the Pod

Check the Pod status:

```bash
kubectl get pods -l app=web-app-env
```
<img width="624" height="80" alt="image" src="https://github.com/user-attachments/assets/10663fb0-dc57-42ed-b0b6-693f9c98f8e1" />

Inspect the container environment variables:

```bash
kubectl describe pod web-app-env-856696f8c4-pk6kx
```
<img width="898" height="250" alt="image" src="https://github.com/user-attachments/assets/cacd1d83-b764-462b-8d57-a1e17ae72abc" />

<img width="998" height="112" alt="image" src="https://github.com/user-attachments/assets/1dcfe916-12d1-4c52-9e65-839d831dbdcc" />

Inspect container logs to see the environment variables in use:

```bash
kubectl logs $POD_NAME
```
<img width="815" height="290" alt="image" src="https://github.com/user-attachments/assets/7b3ea553-94dc-4245-986e-a60f3734359a" />

---

## Step 4: Mounting ConfigMaps and Secrets as Volumes

Mounting configurations as files allows applications to read configuration files dynamically without modifying container images or rebuilding code.

### Create Deployment Manifest with Volume Mounts

Create a file named `app-volume-deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-app-volume
spec:
  replicas: 1
  selector:
    matchLabels:
      app: web-app-volume
  template:
    metadata:
      labels:
        app: web-app-volume
    spec:
      containers:
        - name: web-app
          image: nginx:alpine
          ports:
            - containerPort: 80
          volumeMounts:
            # Mount custom NGINX config file from ConfigMap
            - name: config-volume
              mountPath: /etc/nginx/conf.d/default.conf
              subPath: nginx.conf
            # Mount Secret keys as files inside a secure directory
            - name: secret-volume
              mountPath: /etc/secrets
              readOnly: true
      volumes:
        - name: config-volume
          configMap:
            name: app-config
        - name: secret-volume
          secret:
            secretName: app-secret
```

Apply the volume Deployment:

```bash
kubectl apply -f app-volume-deployment.yaml
```

### Verify Mounted Files Inside the Pod

Check Pod creation status:

```bash
kubectl get pods -l app=web-app-volume
```
<img width="675" height="91" alt="image" src="https://github.com/user-attachments/assets/2f981d0f-50df-4225-ade2-09841d332852" />

Inspect mounted Secret files:

```bash
VOL_POD_NAME=$(kubectl get pod -l app=web-app-volume -o jsonpath="{.items[0].metadata.name}")
kubectl exec $VOL_POD_NAME -- ls -la /etc/secrets
```

Read the mounted Secret file content:

```bash
kubectl exec $VOL_POD_NAME -- cat /etc/secrets/DB_PASSWORD
```
<img width="994" height="269" alt="image" src="https://github.com/user-attachments/assets/13e33d11-78fe-434e-8101-fe6ec2c5ce66" />


---

## Step 5: Testing & Verification

Verify all resources created in the `lab08` namespace:

```bash
kubectl get configmaps,secrets,deployments,pods
```
<img width="769" height="239" alt="image" src="https://github.com/user-attachments/assets/0166e175-2391-427f-8f54-8d8607e0060a" />

Expected resource states:

- **ConfigMap:** `app-config` active with defined configuration keys.
- **Secret:** `app-secret` active containing sensitive keys.
- **Deployments:** `web-app-env` and `web-app-volume` running (`1/1 READY`).
- **Pods:** Operational and successfully consuming externalized configurations.

---

## Step 6: Resource Cleanup

Remove the Deployments, Secrets, and ConfigMaps:

```bash
kubectl delete -f app-volume-deployment.yaml
kubectl delete -f app-env-deployment.yaml
kubectl delete -f app-secret.yaml
kubectl delete -f app-configmap.yaml
```

Delete the lab namespace:

```bash
kubectl delete namespace lab08
```

Verify that the namespace has been completely removed:

```bash
kubectl get namespaces
```
<img width="840" height="310" alt="image" src="https://github.com/user-attachments/assets/d8c24cc2-f407-4287-982a-134965b7fb5f" />

---

## Useful Configuration Commands

| Command | Description |
| :--- | :--- |
| `kubectl create configmap <name> --from-literal=key=value` | Imperatively create a ConfigMap from key-value pairs |
| `kubectl create secret generic <name> --from-literal=key=value` | Imperatively create a generic Secret from a key-value pair |
| `kubectl get configmaps / secrets` | List all ConfigMaps and Secrets in the current namespace |
| `kubectl describe configmap <name>` | Display key-value details of a ConfigMap |
| `kubectl describe secret <name>` | Display keys contained inside a Secret |
| `kubectl get secret <name> -o jsonpath='{.data.key}' \| base64 -d` | Decode a Base64-encoded Secret key value |

---

## Lab Summary

In this lab, you learned how to:

- Externalize application settings to decouple configuration from application code.
- Create ConfigMaps for general application settings and configuration files.
- Create Secrets using `stringData` for sensitive credentials.
- Pass configuration parameters into Pods as Environment Variables using `configMapKeyRef` and `secretKeyRef`.
- Mount configuration files and Secrets into Pod directories using Volumes and `volumeMounts`.
- Inspect and verify environment values and mounted file structures inside running containers.
- Perform clean resource teardown.
