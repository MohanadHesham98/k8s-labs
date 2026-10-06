# Lab 05: Ingress Controller with NGINX (on K3s)

This repository contains the complete step-by-step guide and commands for **Lab 5: Ingress Controller with NGINX on K3s**.

The purpose of this lab is to familiarize you with:

- Installing and configuring NGINX Ingress Controller on K3s (disabling default Traefik).
- Deploying multiple sample backend web applications.
- Exposing backend applications internally via ClusterIP Services.
- Configuring Path-Based Routing using Kubernetes Ingress resources.
- Configuring Host-Based Routing (Domain/Subdomain-based) using Ingress.
- Mapping local domain names via `/etc/hosts`.
- Testing traffic routing, headers, and HTTP responses.
- Cleaning up Kubernetes Ingress resources and deployments.

---

## Prerequisites

Ensure you have K3s running on your Linux VM or node.

K3s comes with **Traefik** as the default Ingress controller. For this lab, we will use **NGINX Ingress Controller**.

---

## Step 1: Installing NGINX Ingress Controller on K3s

### Option A: Clean K3s Installation without Traefik (Recommended)

If you are setting up K3s, disable Traefik during installation:

```bash
curl -sfL https://get.k3s.io | INSTALL_K3S_EXEC="--disable traefik" sh -
```

### Option B: Disabling Traefik on Existing K3s Cluster

If K3s is already installed with Traefik, remove Traefik resources:

```bash
sudo k3s kubectl delete helmcharts.helm.cattle.io traefik -n kube-system
sudo rm -f /var/lib/rancher/k3s/server/manifests/traefik.yaml
```

### Deploy NGINX Ingress Controller

Apply the official NGINX Ingress Controller manifest:

```bash
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.8.2/deploy/static/provider/baremetal/deploy.yaml
```

Verify that the NGINX Ingress Controller Pod and Service are running:

```bash
kubectl get pods -n ingress-nginx
kubectl get svc -n ingress-nginx
```

Ensure the controller Pod reaches `1/1 Running` status before proceeding.

---

## Step 2: Deploying Sample Backend Applications

We will create two separate web applications (`app-one` and `app-two`) to demonstrate traffic routing.

Create a manifest file named `backend-apps.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: app-one-deployment
  labels:
    app: app-one
spec:
  replicas: 2
  selector:
    matchLabels:
      app: app-one
  template:
    metadata:
      labels:
        app: app-one
    spec:
      containers:
      - name: web
        image: nginxdemos/hello
        ports:
        - containerPort: 80
---
apiVersion: v1
kind: Service
metadata:
  name: app-one-svc
spec:
  type: ClusterIP
  selector:
    app: app-one
  ports:
  - port: 80
    targetPort: 80
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: app-two-deployment
  labels:
    app: app-two
spec:
  replicas: 2
  selector:
    matchLabels:
      app: app-two
  template:
    metadata:
      labels:
        app: app-two
    spec:
      containers:
      - name: web
        image: httpd:alpine
        ports:
        - containerPort: 80
---
apiVersion: v1
kind: Service
metadata:
  name: app-two-svc
spec:
  type: ClusterIP
  selector:
    app: app-two
  ports:
  - port: 80
    targetPort: 80
```

Apply the deployments and services:

```bash
kubectl apply -f backend-apps.yaml
```

Verify the status of Deployments, Pods, and Services:

```bash
kubectl get deployments
kubectl get pods -l 'app in (app-one, app-two)'
kubectl get svc
```

---

## Step 3: Configuring Host-Based Ingress Routing

In Host-Based routing, traffic is directed to different backend services based on the incoming HTTP `Host` header (e.g., `app1.lab.local` vs `app2.lab.local`).

Create an Ingress manifest named `host-ingress.yaml`:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: host-based-ingress
  annotations:
    kubernetes.io/ingress.class: "nginx"
spec:
  ingressClassName: nginx
  rules:
  - host: app1.lab.local
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: app-one-svc
            port:
              number: 80
  - host: app2.lab.local
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: app-two-svc
            port:
              number: 80
```

Apply the Ingress rule:

```bash
kubectl apply -f host-ingress.yaml
```

Inspect the Ingress resource:

```bash
kubectl get ingress host-based-ingress
```

---

## Step 4: Configuring Path-Based Ingress Routing

Path-Based routing allows a single domain name to route traffic to multiple backend applications based on URL paths (e.g., `myapp.local/app1` vs `myapp.local/app2`).

Create an Ingress manifest named `path-ingress.yaml`:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: path-based-ingress
  annotations:
    kubernetes.io/ingress.class: "nginx"
    nginx.ingress.kubernetes.io/rewrite-target: /
spec:
  ingressClassName: nginx
  rules:
  - host: myapp.local
    http:
      paths:
      - path: /app1
        pathType: Prefix
        backend:
          service:
            name: app-one-svc
            port:
              number: 80
      - path: /app2
        pathType: Prefix
        backend:
          service:
            name: app-two-svc
            port:
              number: 80
```

Apply the Path-Based Ingress rule:

```bash
kubectl apply -f path-ingress.yaml
```

Verify the active Ingress rules:

```bash
kubectl get ingress
```

---

## Step 5: Local Domain Name Resolution Setup

To test domain names locally from your Host Machine or VM, map the domain names to your Node/K3s IP address in the `/etc/hosts` file.

### 1. Identify Node/K3s IP Address

```bash
kubectl get nodes -o wide
# or
ip addr show
```

### 2. Update `/etc/hosts` File

On Linux/macOS (or Windows `C:\Windows\System32\drivers\etc\hosts`), edit the file with `sudo`:

```bash
sudo nano /etc/hosts
```

Add the following line (replace `192.168.56.10` with your actual K3s Node IP):

```text
192.168.56.10  app1.lab.local app2.lab.local myapp.local
```

---

## Step 6: Testing Traffic Routing

### Test Host-Based Routing

Execute `curl` requests targeting specific hostnames:

```bash
curl http://app1.lab.local
curl http://app2.lab.local
```

Alternatively, test without modifying `/etc/hosts` using `curl` header override:

```bash
curl -H "Host: app1.lab.local" http://<K3S_NODE_IP>
curl -H "Host: app2.lab.local" http://<K3S_NODE_IP>
```

### Test Path-Based Routing

Execute `curl` requests targeting different paths under `myapp.local`:

```bash
curl http://myapp.local/app1
curl http://myapp.local/app2
```

Alternatively, override the Host header:

```bash
curl -H "Host: myapp.local" http://<K3S_NODE_IP>/app1
curl -H "Host: myapp.local" http://<K3S_NODE_IP>/app2
```

### Test via Web Browser

Open your browser and visit:

- `http://app1.lab.local`
- `http://app2.lab.local`
- `http://myapp.local/app1`
- `http://myapp.local/app2`

---

## Step 7: Resource Cleanup

After completing the lab, clean up all created resources:

Delete Ingress resources:

```bash
kubectl delete -f path-ingress.yaml
kubectl delete -f host-ingress.yaml
```

Delete Backend Deployments and Services:

```bash
kubectl delete -f backend-apps.yaml
```

Confirm all resources are removed:

```bash
kubectl get ingress
kubectl get pods -l 'app in (app-one, app-two)'
```

---

## Useful Ingress Commands

| Command | Description |
|---|---|
| `kubectl get ingress` | List all Ingress resources in the current namespace |
| `kubectl describe ingress <ingress-name>` | Display detailed Ingress rules, hosts, paths, and backends |
| `kubectl get pods -n ingress-nginx` | View NGINX Ingress Controller Pod status |
| `kubectl logs -n ingress-nginx -l app.kubernetes.io/name=ingress-nginx` | View NGINX Ingress Controller traffic logs |
| `kubectl delete ingress <ingress-name>` | Delete a specific Ingress rule |

---

## Lab Summary

In this lab, you learned how to:

- Prepare a K3s cluster for NGINX Ingress Controller by disabling Traefik.
- Deploy the NGINX Ingress Controller on bare-metal / K3s nodes.
- Deploy backend microservices and expose them using internal `ClusterIP` Services.
- Configure **Host-Based Routing** to route traffic based on HTTP domain headers.
- Configure **Path-Based Routing** with URL rewrite rules using annotations.
- Map local DNS names in `/etc/hosts` for testing.
- Test and troubleshoot HTTP traffic routing using `curl` and web browsers.
- Tear down Ingress and workload manifests safely.
