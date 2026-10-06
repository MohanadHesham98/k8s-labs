# Lab 04: Service Discovery & Traffic Routing (ClusterIP & NodePort)

This repository contains the complete step-by-step guide and commands for **Lab 4: Service Discovery & Traffic Routing (ClusterIP & NodePort)**.

The purpose of this lab is to familiarize you with:

- Kubernetes Service abstraction concepts
- Label selectors and Endpoints matching
- Creating an internal `ClusterIP` Service for internal communication
- Testing internal DNS resolution and Service discovery using temporary client Pods
- Creating a `NodePort` Service to expose applications externally
- Testing access to the application from a Host Machine via the VM IP and allocated NodePort
- Cleaning up Kubernetes Services and Deployment resources

---

## Prerequisites

Ensure you have a functional Kubernetes cluster (e.g., Minikube, K3s, or a multi-node cluster) and `kubectl` configured on your management machine or VM.

Confirm your cluster node status:

```bash
kubectl get nodes
```
<img width="794" height="91" alt="image" src="https://github.com/user-attachments/assets/15de132d-5137-4201-938b-4812a6bbc9d9" />

---

## Step 1: Deploying the Backend Target Workload

Before creating Services, deploy a target workload (Nginx web deployment with 2 replicas) labeled with `app: web-backend`.

Create a Deployment manifest `backend-deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-backend
  labels:
    app: web-backend
spec:
  replicas: 2
  selector:
    matchLabels:
      app: web-backend
  template:
    metadata:
      labels:
        app: web-backend
    spec:
      containers:
      - name: nginx
        image: nginx:alpine
        ports:
        - containerPort: 80
        resources:
          requests:
            cpu: "50m"
            memory: "32Mi"
          limits:
            cpu: "100m"
            memory: "64Mi"
```

Apply the Deployment to the cluster:

```bash
kubectl apply -f backend-deployment.yaml
```

Verify that the Deployment and underlying Pods are up and running:

```bash
kubectl get deployments
kubectl get pods -l app=web-backend -o wide
```
<img width="1020" height="225" alt="image" src="https://github.com/user-attachments/assets/a2547cd6-79b9-4e6a-be67-b7b3427d013d" />

---

## Step 2: Creating an Internal ClusterIP Service

`ClusterIP` is the default Kubernetes Service type. It exposes the Service on a cluster-internal IP address, making it accessible only from within the cluster network.

Create a ClusterIP Service manifest `clusterip-service.yaml`:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: backend-clusterip-svc
spec:
  type: ClusterIP
  selector:
    app: web-backend
  ports:
  - name: http
    port: 80
    targetPort: 80
```

Apply the ClusterIP Service:

```bash
kubectl apply -f clusterip-service.yaml
```

Inspect the created Service and its assigned cluster IP:

```bash
kubectl get svc backend-clusterip-svc
```
<img width="992" height="157" alt="image" src="https://github.com/user-attachments/assets/90828299-f7d2-45b9-8dea-ee236064cca4" />

Verify that Kubernetes automatically mapped the backend Pod IPs to the Service's Endpoints:

```bash
kubectl get endpoints backend-clusterip-svc
```
<img width="994" height="111" alt="image" src="https://github.com/user-attachments/assets/f80e3c9e-7b16-4f9f-b28f-817852d20df3" />

<img width="1264" height="120" alt="image" src="https://github.com/user-attachments/assets/439227ca-5613-4a0a-8190-6fa95dbebd17" />

---

## Step 3: Testing Internal Service Discovery

To verify internal DNS resolution and traffic routing through `ClusterIP`, launch a temporary client container inside the cluster using `busybox` or `curlimages/curl`.

Run a temporary Pod and execute an internal `curl` request using the Service name:

```bash
kubectl run test-client --image=curlimages/curl -it --rm --restart=Never -- curl -s http://backend-clusterip-svc
```
<img width="1426" height="686" alt="image" src="https://github.com/user-attachments/assets/b4e9a854-092a-47cb-9889-670047ed1e6a" />

Test internal CoreDNS FQDN (Fully Qualified Domain Name) resolution:

```bash
kubectl run dns-test --image=curlimages/curl -it --rm --restart=Never -- curl -s http://backend-clusterip-svc.default.svc.cluster.local
```
<img width="1411" height="705" alt="image" src="https://github.com/user-attachments/assets/2a7ba9c9-e45a-4734-9e10-5c0f03e4bf95" />

Both commands should return the default Nginx welcome HTML response, confirming internal service discovery and load balancing across the backend Pods.

---

## Step 4: Creating a NodePort Service for External Access

`NodePort` exposes the Service on each Node's IP at a static port (in the default range `30000-32767`). This allows external traffic from your Host Machine to reach the application via `<NodeIP>:<NodePort>`.

Create a NodePort Service manifest `nodeport-service.yaml`:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: backend-nodeport-svc
spec:
  type: NodePort
  selector:
    app: web-backend
  ports:
  - name: http
    port: 80
    targetPort: 80
    nodePort: 30080
```

Apply the NodePort Service:

```bash
kubectl apply -f nodeport-service.yaml
```

Verify the NodePort allocation:

```bash
kubectl get service backend-nodeport-svc
```
<img width="1097" height="180" alt="image" src="https://github.com/user-attachments/assets/030a2c1e-c900-40ef-93f1-1f110ec0578a" />

---

## Step 5: Testing Access from the Host Machine

To access the service externally, retrieve your VM or Node IP address.

### 1. Identify Node / VM IP Address

If using a Linux VM or Cloud instance, find your internal/external IP:

```bash
ip addr show
# or
kubectl get nodes -o wide
```
<img width="1049" height="265" alt="image" src="https://github.com/user-attachments/assets/9f9a298f-7317-4ed1-ad86-a2781f3e3d8b" />

<img width="1410" height="138" alt="image" src="https://github.com/user-attachments/assets/2244d551-926a-40a8-b86a-318d71f9f213" />

### 2. Test Access using `curl`

From your host terminal or management machine, run:

```bash
curl http://<VM_OR_NODE_IP>:30080
```
<img width="952" height="644" alt="image" src="https://github.com/user-attachments/assets/78b61b7d-5cf6-48b8-b0f0-1c4b26416850" />

### 3. Test Access via Web Browser

Open your browser on the host machine and navigate to:

```text
http://<VM_OR_NODE_IP>:30080
```
<img width="1365" height="393" alt="image" src="https://github.com/user-attachments/assets/4c638c86-845d-441a-86d4-f1c3df85b4c8" />

You will see the **Welcome to nginx!** landing page served by one of the backend Pods through the NodePort routing pipeline.

---

## Step 6: Resource Cleanup

After completing the lab, remove all created resources to free up cluster capacity:

Delete the Services:

```bash
kubectl delete service backend-clusterip-svc backend-nodeport-svc
```

Delete the backend Deployment:

```bash
kubectl delete deployment web-backend
```

Confirm all resources have been purged:

```bash
kubectl get all -l app=web-backend
```
<img width="983" height="74" alt="image" src="https://github.com/user-attachments/assets/91c50d2b-9105-4315-8923-42f73bf8d508" />

---

## Useful Kubernetes Service Commands

| Command | Description |
|---|---|
| `kubectl get svc` | List all Services in the current namespace |
| `kubectl describe svc <service-name>` | Display detailed metadata, selectors, and endpoints of a Service |
| `kubectl get endpoints <service-name>` | Display active target Pod IP addresses for a Service |
| `kubectl expose deployment <name> --type=NodePort --port=80` | Quickly create a NodePort service imperatively |
| `kubectl delete svc <service-name>` | Remove a Service |

---

## Lab Summary

In this lab, you learned how to:

- Deploy a target workload and configure label selectors for Service routing.
- Create a `ClusterIP` Service to handle internal cluster communications.
- Verify internal DNS resolution (`<service-name>.<namespace>.svc.cluster.local`).
- Check endpoints mapping between Services and target Pods.
- Create a `NodePort` Service with a designated port (`30080`).
- Route traffic from an external Host Machine to the Kubernetes cluster workload using the VM IP and NodePort.
- Safely tear down Services and workload manifests.
