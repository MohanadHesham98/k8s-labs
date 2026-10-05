# Lab 03: Managing Labels, Annotations, and Pod Storage (Volumes)

This repository contains the complete step-by-step guide, Kubernetes manifests, and verification commands for **Lab 03: Managing Labels, Annotations, and Pod Storage (Volumes)**.

The purpose of this lab is to familiarize you with:

- Organizing Kubernetes objects using key-value pair **Labels** and **Selectors**
- Attaching non-identifying metadata using **Annotations**
- Sharing data dynamically between multi-container Pods using an **`emptyDir`** volume
- Persisting data on the underlying host node/VM file system using a **`hostPath`** volume
- Validating volume lifecycle behavior and data persistence

---

## Step 1: Understanding Concepts (Labels, Annotations & Volumes)

### Labels & Selectors
- **Labels**: Key-value pairs attached to Kubernetes objects (such as Pods) to group, organize, and select subsets of objects.
- **Label Selectors**: Used by users and controllers (e.g., Services, Deployments) to query and filter resources based on labels.

### Annotations
- **Annotations**: Key-value pairs used to attach arbitrary non-identifying metadata to objects (e.g., build information, owner email, release notes, or tool configurations). Unlike labels, annotations are not used to select or query objects.

### Volumes (`emptyDir` vs `hostPath`)
- **`emptyDir`**: A temporary volume created when a Pod is assigned to a Node. It starts empty and is shared among all containers within that Pod. **Lifetime**: Deleted permanently when the Pod is removed.
- **`hostPath`**: Mounts a file or directory from the host node’s (VM) file system directly into the Pod. **Lifetime**: Data persists on the host VM even if the Pod is deleted.

---

## Step 2: Setting Up Project Directory

Create a dedicated directory for Lab 3 and navigate into it:

```bash
mkdir -p kubernetes-labs/lab03-labels-volumes
cd kubernetes-labs/lab03-labels-volumes
```

---

## Step 3: Working with Labels and Annotations

### Create a Pod Manifest with Labels and Annotations

Create a manifest file named `pod-labels-annotations.yaml`:

```bash
nano pod-labels-annotations.yaml
```

Paste the following configuration into the file:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: labeled-demo-pod
  labels:
    environment: production
    app: backend-api
    tier: frontend
    team: devops
  annotations:
    buildVersion: "v1.4.2"
    contact: "admin@devops.local"
    description: "Sample pod demonstrating labels and annotations management"
spec:
  containers:
  - name: nginx-app
    image: nginx:alpine
    ports:
    - containerPort: 80
```

Deploy the Pod:

```bash
kubectl apply -f pod-labels-annotations.yaml
```
<img width="1199" height="57" alt="image" src="https://github.com/user-attachments/assets/255e616d-051d-4cae-a3a2-943d6ec44355" />

---

### Managing and Querying Labels via CLI

#### 1. List Pods showing their labels
```bash
kubectl get pods --show-labels
```
<img width="1350" height="99" alt="image" src="https://github.com/user-attachments/assets/b1d7c9e1-8fe4-4d2f-a36e-14a6a4eb46d0" />

#### 2. Query Pods using Label Selectors (`-l`)
```bash
# Filter by exact match
kubectl get pods -l environment=production

# Filter by multiple labels
kubectl get pods -l environment=production,tier=frontend

# Filter using set-based criteria
kubectl get pods -l 'environment in (production, staging)'
```
<img width="1394" height="249" alt="image" src="https://github.com/user-attachments/assets/8c2308ac-9d1a-47e4-b197-e40bf716f143" />

#### 3. Dynamically Add or Update Labels on a Running Pod
Add a new label `owner=security`:
```bash
kubectl label pod labeled-demo-pod owner=security
```

Overwrite an existing label `environment` to `staging`:
```bash
kubectl label pod labeled-demo-pod environment=staging --overwrite
```
<img width="1461" height="139" alt="image" src="https://github.com/user-attachments/assets/bc7f9985-e32d-42e9-ac33-9ce7679a4549" />

Verify updated labels:
```bash
kubectl get pod labeled-demo-pod --show-labels
```
<img width="1343" height="99" alt="image" src="https://github.com/user-attachments/assets/45c7a178-3687-4810-8d51-8200a2f3bff5" />

#### 4. Inspect Annotations
Inspect the metadata and annotations attached to the Pod:
```bash
kubectl describe pod labeled-demo-pod
```
<img width="1174" height="329" alt="image" src="https://github.com/user-attachments/assets/1e603623-980c-4b38-9e34-ecec8247d1c6" />

---

## Step 4: Multi-Container Data Sharing using `emptyDir` Volume

In this step, we build a multi-container Pod where a **writer container** generates data into a shared volume, and a **web-server container** serves that data over HTTP.

### Create `pod-emptydir-volume.yaml`

```bash
nano pod-emptydir-volume.yaml
```

Paste the following YAML manifest:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: pod-shared-emptydir
  labels:
    app: log-generator
spec:
  volumes:
  # 1. Define the shared emptyDir volume
  - name: shared-data-volume
    emptyDir: {}

  containers:
  # Container 1: Writer / Data Generator
  - name: log-writer
    image: alpine
    command: ["/bin/sh", "-c"]
    args:
    - while true; do
        echo "$(date) - Application operational check" >> /var/log/app/index.html;
        sleep 5;
      done
    volumeMounts:
    - name: shared-data-volume
      mountPath: /var/log/app

  # Container 2: Nginx Reader / Web Server
  - name: web-server
    image: nginx:alpine
    ports:
    - containerPort: 80
    volumeMounts:
    - name: shared-data-volume
      mountPath: /usr/share/nginx/html
```
Detailed Code Explanation
1. Pod Metadata & Specifications (metadata & spec)
```
apiVersion: v1
kind: Pod
metadata:
  name: pod-shared-emptydir
  labels:
    app: log-generator
```
- apiVersion: v1: Specifies the core Kubernetes API version used for Pod definitions.
- kind: Pod: Tells Kubernetes to instantiate a Pod resource (the smallest deployable computing unit).
- metadata: Sets the name (pod-shared-emptydir) and attaches the label app: log-generator for identification and selection by Services or replica controllers.

2. Volume Definition (volumes)
```
spec:
  volumes:
  - name: shared-data-volume
  emptyDir: {}
```
- shared-data-volume: Gives a logical name to the volume so containers inside the Pod can reference and mount it.
- emptyDir: {}: Creates an empty volume directly on the node hosting the Pod when the Pod is assigned to that node.
- Lifecycle: The volume lives as long as the Pod runs on that node. If a container crashes, the data persists; if the Pod is deleted or evicted, the volume is permanently deleted.
- Use Case: Enables fast, local filesystem sharing between co-located containers in the same Pod.

3. Container 1: Log Writer (log-writer)
```
  containers:
  - name: log-writer
    image: alpine
    command: ["/bin/sh", "-c"]
    args:
    - while true; do
        echo "$(date) - Application operational check" >> /var/log/app/index.html;
        sleep 5;
      done
    volumeMounts:
    - name: shared-data-volume
      mountPath: /var/log/app
```
- image: alpine: Uses a minimal Linux image to run shell commands.
- command & args: Overrides the entrypoint to execute a continuous shell loop (while true). Every 5 seconds, it appends the current date and timestamp to /var/log/app/index.html.
- volumeMounts: Mounts shared-data-volume into the container's local directory path /var/log/app.
- Function: Acts as a producer/writer by populating the shared volume with web content.

4. Container 2: Nginx Web Server (web-server)
```
  - name: web-server
    image: nginx:alpine
    ports:
    - containerPort: 80
    volumeMounts:
    - name: shared-data-volume
      mountPath: /usr/share/nginx/html
```
- image: nginx:alpine: Uses a lightweight Nginx web server.
- ports: Exposes container port 80 inside the Pod network space.
- volumeMounts: Mounts the exact same shared-data-volume into Nginx's default root directory /usr/share/nginx/html.
- Function: Acts as a consumer/reader. Because it mounts the shared volume to its root web folder, Nginx serves the index.html file created and updated by log-writer.

### Deploy the Pod:

```bash
kubectl apply -f pod-emptydir-volume.yaml
```

Verify Pod execution status:

```bash
kubectl get pods pod-shared-emptydir
```
<img width="1158" height="97" alt="image" src="https://github.com/user-attachments/assets/17fd336b-1533-40ea-80d0-8f81be68ebf7" />

<img width="1554" height="72" alt="image" src="https://github.com/user-attachments/assets/0c4ca6ce-772b-4f9a-b2e8-c758d07e4a10" />

---

### Verify Data Sharing in `emptyDir`

Execute an HTTP GET request inside the `web-server` container to confirm it reads the file written by `log-writer`:

```bash
kubectl exec -it pod-shared-emptydir -c web-server -- curl http://localhost
```

**Expected Output:**
```text
Mon Oct  5 16:15:00 EEST 2026 - Application operational check
Mon Oct  5 16:15:05 EEST 2026 - Application operational check
```
<img width="1511" height="247" alt="image" src="https://github.com/user-attachments/assets/6014e353-5069-4dc8-9c6f-df83972a2883" />

---

## Step 5: Persistent Host Storage using `hostPath` Volume

In this step, we configure a Pod to mount a host directory on the VM/Node filesystem to ensure data persists across Pod recreation.

### Prepare the Host VM Directory

Create a storage directory on the host VM filesystem:

```bash
sudo mkdir -p /mnt/node-data
sudo chmod 777 /mnt/node-data
echo "Hello from Host VM File System" | sudo tee /mnt/node-data/index.html
```

---

### Create `pod-hostpath-volume.yaml`

```bash
nano pod-hostpath-volume.yaml
```

Paste the following YAML manifest:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: pod-hostpath-demo
  labels:
    storage: hostpath-test
spec:
  volumes:
  # Define hostPath volume pointing to VM directory
  - name: vm-storage
    hostPath:
      path: /mnt/node-data
      type: DirectoryOrCreate

  containers:
  - name: web-server
    image: nginx:alpine
    ports:
    - containerPort: 80
    volumeMounts:
    - name: vm-storage
      mountPath: /usr/share/nginx/html
```

Deploy the Pod:

```bash
kubectl apply -f pod-hostpath-volume.yaml
```

---

### Verify Data Persistence on `hostPath`

#### 1. Read existing host file from inside the Pod
```bash
kubectl exec -it pod-hostpath-demo -- cat /usr/share/nginx/html/index.html
```
**Expected Output:** `Hello from Host VM File System`
<img width="1499" height="129" alt="image" src="https://github.com/user-attachments/assets/a4f75ff2-ed73-44e9-bb18-fb2a91fc9c88" />

#### 2. Write new data from inside the Pod container
```bash
kubectl exec -it pod-hostpath-demo -- sh -c 'echo "Data added by Pod container" >> /usr/share/nginx/html/index.html'
```

#### 3. Verify file on the Host VM directly
```bash
cat /mnt/node-data/index.html
```
<img width="1550" height="147" alt="image" src="https://github.com/user-attachments/assets/b7792521-36d7-4759-8a86-2b599bf88cb4" />

<img width="1095" height="110" alt="image" src="https://github.com/user-attachments/assets/7f2a2598-9aa4-4b32-a435-5db41c072752" />

#### 4. Test Persistence after deleting the Pod
Delete the Pod:
```bash
kubectl delete pod pod-hostpath-demo
```

Check the host directory on the VM to confirm the file remains intact:
```bash
cat /mnt/node-data/index.html
```

**Expected Output:**
```text
Hello from Host VM File System
Data added by Pod container
```
<img width="1133" height="162" alt="image" src="https://github.com/user-attachments/assets/4a412ae3-a731-4129-8662-7d23c7d13a18" />

---

## Useful Kubernetes Commands Cheat Sheet

| Command | Description |
| :--- | :--- |
| `kubectl get pods --show-labels` | Display running Pods along with all assigned labels |
| `kubectl get pods -l key=value` | Filter Pods matching specific label selectors |
| `kubectl label pod <pod_name> key=value` | Add a new label to an existing running Pod |
| `kubectl label pod <pod_name> key=value --overwrite` | Modify/Update an existing label value |
| `kubectl describe pod <pod_name>` | View detailed metadata including Annotations and Volumes |
| `kubectl exec -it <pod> -c <container> -- <cmd>` | Execute a command inside a specific container in a multi-container Pod |

---

## Lab Summary

In this lab, you learned how to:

- Organize and filter Kubernetes Pods using **Labels** and **Label Selectors**
- Modify labels dynamically on running resources using `kubectl label`
- Add descriptive metadata using **Annotations**
- Configure **`emptyDir`** volumes to share temporary in-memory/disk data between containers in a multi-container Pod
- Implement **`hostPath`** volumes to persist data directly on the underlying VM/host node file system
- Validate data persistence across Pod termination events
