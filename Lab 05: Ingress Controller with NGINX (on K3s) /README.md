# Lab 05: Host-Based and Path-Based Ingress Routing on K3s

This repository contains the complete step-by-step guide and commands for **Lab 5: Ingress Routing with NGINX Ingress Controller on K3s**.

The purpose of this lab is to familiarize you with:

- Setting up a lightweight K3s Kubernetes cluster without the default Traefik controller.
- Deploying the NGINX Ingress Controller on K3s.
- Deploying multi-tier application workloads (NGINX as app1 and Apache HTTPD as app2).
- Configuring Host-Based Ingress Routing (`app1.lab.local`, `app2.lab.local`).
- Configuring Path-Based Ingress Routing (`myapp.local/app1`, `myapp.local/app2`) with URL rewriting.
- Configuring local DNS resolution using `/etc/hosts`.
- Verifying and testing Ingress traffic routing with `curl`.
- Cleaning up Kubernetes resources and environment configurations.


## Host-Based vs. Path-Based Ingress Routing

| Feature | Host-Based Routing | Path-Based Routing |
|---|---|---|
| **Routing Metric** | Distinct Domain / Host Header | URL Path Prefix on a Shared Host |
| **URL Example** | http://app1.lab.local, http://app2.lab.local | http://myapp.local/app1, http://myapp.local/app2 |
| **Use Case** | Multi-domain setups or separate microservice portals | Single-domain microservices routing (API gateways) |
| **URL Rewriting** | Usually not required | Requires `rewrite-target` annotation to strip prefix |
| **DNS Requirements** | Unique DNS mapping for every domain | Single DNS entry mapping to the Ingress controller |

---

## Step 1: Cluster Setup & NGINX Ingress Controller Installation

### Install K3s (Disabling Traefik)

By default, K3s installs Traefik as its default Ingress Controller. Disable Traefik during cluster initialization to use NGINX Ingress Controller:

```bash
curl -sfL https://get.k3s.io | INSTALL_K3S_EXEC="--disable=traefik" sh -
```

### Configure Kubeconfig Access

Set up kubeconfig access for non-root management:

```bash
mkdir -p ~/.kube
sudo cp /etc/rancher/k3s/k3s.yaml ~/.kube/config
sudo chown $(id -u):$(id -g) ~/.kube/config
export KUBECONFIG=~/.kube/config
```

Verify that the node is active and ready:

```bash
kubectl get nodes
```

### Deploy NGINX Ingress Controller

Deploy the official NGINX Ingress Controller manifest:

```bash
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.8.2/deploy/static/provider/cloud/deploy.yaml
```

Verify that the Ingress controller pods are running:

```bash
kubectl get pods -n ingress-nginx
```
<img width="913" height="137" alt="image" src="https://github.com/user-attachments/assets/5b4fc4ba-5740-42ea-9f49-7636abef7056" />

---

## Step 2: Deploying Sample Workloads (app1 & app2)

Deploy two separate web applications to represent backend services:
- **App1:** NGINX Web Server (`app1-service`)
- **App2:** Apache HTTPD Server (`app2-service`)

### Create Application Deployments & Services

Create the `apps.yaml` manifest:

```bash
cat <<EOF > apps.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: app1-deployment
  labels:
    app: app1
spec:
  replicas: 1
  selector:
    matchLabels:
      app: app1
  template:
    metadata:
      labels:
        app: app1
    spec:
      containers:
      - name: nginx
        image: nginx:alpine
        ports:
        - containerPort: 80
---
apiVersion: v1
kind: Service
metadata:
  name: app1-service
spec:
  selector:
    app: app1
  ports:
  - protocol: TCP
    port: 80
    targetPort: 80
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: app2-deployment
  labels:
    app: app2
spec:
  replicas: 1
  selector:
    matchLabels:
      app: app2
  template:
    metadata:
      labels:
        app: app2
    spec:
      containers:
      - name: httpd
        image: httpd:alpine
        ports:
        - containerPort: 80
---
apiVersion: v1
kind: Service
metadata:
  name: app2-service
spec:
  selector:
    app: app2
  ports:
  - protocol: TCP
    port: 80
    targetPort: 80
EOF
```

Apply the applications manifest:

```bash
kubectl apply -f apps.yaml
```

Verify that all pods and services are operational:

```bash
kubectl get pods,svc
```
<img width="825" height="334" alt="image" src="https://github.com/user-attachments/assets/aa8a9ed7-3b7d-45d0-a38c-19f36cfa025a" />

---

## Step 3: Configuring Ingress Routing Rules

### Configure Host-Based Ingress Routing

Create `ingress-host.yaml` to route traffic based on HTTP Host headers (`app1.lab.local` and `app2.lab.local`):

```bash
cat <<EOF > ingress-host.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: host-based-ingress
  annotations:
    kubernetes.io/ingress.class: "nginx"
spec:
  rules:
  - host: app1.lab.local
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: app1-service
            port:
              number: 80
  - host: app2.lab.local
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: app2-service
            port:
              number: 80
EOF
```

Apply the host-based Ingress configuration:

```bash
kubectl apply -f ingress-host.yaml
```

### Configure Path-Based Ingress Routing

Create `ingress-path.yaml` to route traffic based on URL paths (`/app1` and `/app2`) using the `rewrite-target` annotation:

```bash
cat <<EOF > ingress-path.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: path-based-ingress
  annotations:
    kubernetes.io/ingress.class: "nginx"
    nginx.ingress.kubernetes.io/rewrite-target: /
spec:
  rules:
  - host: myapp.local
    http:
      paths:
      - path: /app1
        pathType: Prefix
        backend:
          service:
            name: app1-service
            port:
              number: 80
      - path: /app2
        pathType: Prefix
        backend:
          service:
            name: app2-service
            port:
              number: 80
EOF
```

Apply the path-based Ingress configuration:

```bash
kubectl apply -f ingress-path.yaml
```

Verify that both Ingress resources are created:

```bash
kubectl get ingress
```
<img width="1096" height="244" alt="image" src="https://github.com/user-attachments/assets/2dcb2ee4-a36e-42d0-83c3-0b062db14e4f" />

---

## Step 4: Local DNS Resolution Setup

Map the domain names to `127.0.0.1` in `/etc/hosts` to enable local hostname resolution:

```bash
echo "<vm-ip> app1.lab.local app2.lab.local myapp.local" | sudo tee -a /etc/hosts
```
<img width="1213" height="160" alt="image" src="https://github.com/user-attachments/assets/3ac7b37a-263d-4be7-b83e-a571ede93e06" />

Confirm entry addition:

```bash
cat /etc/hosts
```
<img width="841" height="266" alt="image" src="https://github.com/user-attachments/assets/72f7248f-8626-4bf6-b908-8ad7f09c99ad" />

---

## Step 5: Verification & Traffic Routing Testing

### Test Host-Based Routing

Send a request to `app1.lab.local`:

```bash
curl http://app1.lab.local
```
*Expected Output:* NGINX welcome page (`Welcome to nginx!`).
<img width="826" height="642" alt="image" src="https://github.com/user-attachments/assets/dfe1715d-78d0-4b13-986c-85e28ccad202" />

Send a request to `app2.lab.local`:

```bash
curl http://app2.lab.local
```
*Expected Output:* Apache index response (`It works!`).
<img width="975" height="251" alt="image" src="https://github.com/user-attachments/assets/56af62c5-4588-449b-804e-70c544e17425" />

### Test Path-Based Routing

Send a request to `myapp.local/app1`:

```bash
curl http://myapp.local/app1
```
*Expected Output:* NGINX response from `app1-service`.
<img width="931" height="642" alt="image" src="https://github.com/user-attachments/assets/dd78e2a9-b229-4906-a709-2673a7fb9f40" />

Send a request to `myapp.local/app2`:

```bash
curl http://myapp.local/app2
```
*Expected Output:* Apache response from `app2-service`.
<img width="950" height="245" alt="image" src="https://github.com/user-attachments/assets/261d8db9-6447-4569-b7a1-5c87894dd891" />

---

## Step 6: Resource Cleanup

### Delete Ingress and Application Resources

```bash
kubectl delete -f ingress-path.yaml
kubectl delete -f ingress-host.yaml
kubectl delete -f apps.yaml
```

### Remove NGINX Ingress Controller

```bash
kubectl delete -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.8.2/deploy/static/provider/cloud/deploy.yaml
```

### Uninstall K3s Cluster (Optional)

To remove K3s and clean up host system modifications completely:

```bash
/usr/local/bin/k3s-uninstall.sh
```

---

## Useful Kubernetes Ingress Commands

| Command | Description |
|---|---|
| `kubectl get ingress` | List all Ingress rules in the current namespace |
| `kubectl describe ingress <ingress-name>` | Display detailed routing paths, backends, and status |
| `kubectl get pods -n ingress-nginx` | Check operational status of NGINX Ingress controller pods |
| `kubectl logs -n ingress-nginx -l app.kubernetes.io/name=ingress-nginx` | View real-time HTTP access and proxy logs of the controller |
| `kubectl delete ingress <ingress-name>` | Remove a specific Ingress routing rule |

---

## Lab Summary

In this lab, you learned how to:

- Deploy K3s with custom Ingress controller configurations (disabling Traefik).
- Install and configure the NGINX Ingress Controller.
- Expose multiple backend applications using ClusterIP Services.
- Implement Host-Based Ingress routing across multiple hostnames.
- Implement Path-Based Ingress routing using URL path rewriting (`rewrite-target`).
- Configure local hostname resolution via `/etc/hosts`.
- Test, verify, and debug HTTP traffic routing using `curl`.
- Perform resource teardown and environment cleanup.
