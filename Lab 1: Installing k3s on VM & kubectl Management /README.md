# Lab 01: Installing k3s on VM & kubectl Management

This repository contains the complete step-by-step guide and commands for **Lab 1: Installing k3s on VM & kubectl Management**.

The purpose of this lab is to familiarize you with:

- Light-weight Kubernetes (`k3s`) installation on a Linux Virtual Machine (VM)
- Setting up non-root / non-`sudo` access for `kubectl`
- Testing cluster connectivity using `kubectl`
- Inspecting Kubernetes cluster nodes
- Exploring system pods (CoreDNS, Traefik, Metrics-Server, Local-path-provisioner)

---

## Step 1: Installing k3s on the VM

Run the official quick-install script provided by Rancher to download, install, and start the `k3s` service automatically:

```bash
curl -sfL https://get.k3s.io | sh -
```

### Verify Service Status

Check if the `k3s` service is active and running via `systemctl`:

```bash
sudo systemctl status k3s
```
<img width="1017" height="222" alt="image" src="https://github.com/user-attachments/assets/3d00983e-9cf6-4f62-aa1d-8278d37ee4d9" />

---

## Step 2: Configuring non-sudo Access for `kubectl`

By default, the kubeconfig file created at `/etc/rancher/k3s/k3s.yaml` is only readable by the `root` user. To run `kubectl` commands without `sudo`:

### Method 1: Set Read Permissions on `k3s.yaml`

Grant read access to the default kubeconfig file:

```bash
sudo chmod 644 /etc/rancher/k3s/k3s.yaml
```

Set the `KUBECONFIG` environment variable so `kubectl` knows where to find the configuration:

```bash
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
```

To make this persistent across terminal sessions, add it to your `~/.bashrc`:

```bash
echo "export KUBECONFIG=/etc/rancher/k3s/k3s.yaml" >> ~/.bashrc
source ~/.bashrc
```

---

### Method 2: Copy Kubeconfig to User Directory (Recommended)

Alternatively, copy the configuration file to your user's home directory under `.kube/config`:

```bash
mkdir -p ~/.kube
sudo cp /etc/rancher/k3s/k3s.yaml ~/.kube/config
sudo chown $(id -u):$(id -g) ~/.kube/config
chmod 600 ~/.kube/config
```

---

## Step 3: Testing Cluster Connection & Inspecting Nodes

Verify that `kubectl` can communicate with the `k3s` Kubernetes API server without `sudo`:

```bash
kubectl cluster-info
```
<img width="1264" height="153" alt="image" src="https://github.com/user-attachments/assets/c9a1eb6f-6b17-442b-9a95-eb63c63c6ece" />

### View Cluster Nodes

List all available nodes in the cluster and check their status:

```bash
kubectl get nodes
```
<img width="584" height="90" alt="image" src="https://github.com/user-attachments/assets/adf9efd5-6e60-4094-bf38-98b941975a56" />

To view more detailed information about the node (IP address, OS, kernel, container runtime):

```bash
kubectl get nodes -o wide
```
<img width="1400" height="130" alt="image" src="https://github.com/user-attachments/assets/b4261a3a-9a18-4781-a7fe-3dd08790d070" />

---

## Step 4: Inspecting Built-in System Pods

`k3s` comes pre-bundled with essential system components running as pods inside the `kube-system` namespace.

List all system pods running in the `kube-system` namespace:

```bash
kubectl get pods -n kube-system
```
<img width="944" height="356" alt="image" src="https://github.com/user-attachments/assets/9e8e79ad-77ca-4f08-89b4-02deb78877d6" />

### Key System Components Overview

| Component | Description |
|---|---|
| **coredns** | Internal DNS service for service discovery inside the cluster |
| **traefik** | Ingress controller for routing external HTTP/HTTPS traffic |
| **metrics-server** | Collects resource metrics (CPU/Memory) for nodes and pods |
| **local-path-provisioner** | Provides persistent storage volumes on local disk |

---

### Inspect Specific System Resources

View all resources (Pods, Services, Deployments, DaemonSets) in `kube-system`:

```bash
kubectl get all -n kube-system
```
<img width="1225" height="749" alt="image" src="https://github.com/user-attachments/assets/6d587d65-44af-4a93-b3cc-d30320eb23aa" />

Check cluster resource usage using `metrics-server`:

```bash
kubectl top nodes
kubectl top pods -n kube-system
```
<img width="760" height="245" alt="image" src="https://github.com/user-attachments/assets/1996507a-e2a7-49ab-bdf2-5f5830e0e7b2" />

---

## Step 5: Useful kubectl Commands Cheat Sheet

| Command | Description |
|---|---|
| `kubectl cluster-info` | Display cluster master and service endpoints |
| `kubectl get nodes` | List all nodes in the cluster |
| `kubectl get pods -A` | List all pods in all namespaces |
| `kubectl get pods -n kube-system` | List system pods running in `kube-system` namespace |
| `kubectl describe node <node_name>` | Detailed status and events for a node |
| `kubectl logs -n kube-system <pod_name>` | View logs of a specific system pod |

---

## Lab Summary

In this lab, you learned how to:

- Install lightweight Kubernetes (`k3s`) using the automated script.
- Configure permissions on `/etc/rancher/k3s/k3s.yaml` for non-root execution.
- Validate `kubectl` connectivity to the API server.
- Inspect cluster nodes and verify `Ready` state.
- Identify and inspect built-in system components (CoreDNS, Traefik, Metrics-Server).
