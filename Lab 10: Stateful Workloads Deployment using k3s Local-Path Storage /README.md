# Lab 10: Stateful Workloads Deployment using k3s Local-Path Storage

This repository contains the complete step-by-step guide and commands for **Lab 10: Stateful Workloads Deployment using k3s Local-Path Storage**.

The purpose of this lab is to familiarize you with:

- Understanding Stateless vs. Stateful workloads in Kubernetes.
- Deploying stateful applications using **StatefulSets** (stable network IDs, ordered deployment/scaling, sticky storage).
- Leveraging the default k3s **StorageClass (`local-path`)** for dynamic volume provisioning.
- Requesting persistent storage using **PersistentVolumeClaims (PVCs)** and `volumeClaimTemplates`.
- Ensuring data persistence across Pod restarts, rescheduling, and manual deletions on the underlying VM filesystem.
- Managing Headless Services for StatefulSet network identity and Pod discovery.
- Cleaning up stateful resources and persistent volume claims.

---

## Storage & Stateful Workload Concepts Overview

| Resource / Concept | Primary Purpose | Lifecycle & Behavior | Key Characteristics |
| :--- | :--- | :--- | :--- |
| **StatefulSet** | Manages stateful applications (e.g., MySQL, Redis, MongoDB) | Pods are created sequentially with deterministic names (`pod-0`, `pod-1`) | Stable network identity, sticky persistent storage per replica |
| **StorageClass (`local-path`)** | Defines dynamic volume provisioning rules | Out-of-the-box local storage driver pre-configured in k3s | Provisions hostPath-based volumes dynamically on node disk |
| **PersistentVolumeClaim (PVC)** | Storage request by a user/workload | Binds to a dynamically provisioned PersistentVolume (PV) | Independent of Pod lifecycle; retains data after Pod deletion |
| **Headless Service** | Direct Pod network routing (`clusterIP: None`) | Manages DNS records for individual StatefulSet Pods | Enables direct Pod-to-Pod addressing without load balancing |

### Stateful Storage Architecture Flow

```text
StatefulSet (mysql)
└── Pod: mysql-0
    └── PVC: data-mysql-0
        └── Dynamic PV (Provisioned by StorageClass: local-path)
            └── Local Directory on Host VM
                (/var/lib/rancher/k3s/storage/...)
```

---

## Step 1: Cluster Preparation & Setup

Verify that your Kubernetes cluster is active and that your node status is `Ready`:

```bash
kubectl get nodes
```

### Verify Default StorageClass in k3s

Ensure that the built-in `local-path` StorageClass is present and marked as default:

```bash
kubectl get storageclass
```

Expected output:

```text
NAME                 PROVISIONER             RECLAIMPOLICY   VOLUMEBINDINGMODE      ALLOWVOLUMEEXPANSION   AGE
local-path (default) rancher.io/local-path   Delete          WaitForFirstConsumer   false                  10d
```

> **Note:** Values such as `AGE` will vary depending on your cluster.

<img width="986" height="120" alt="image" src="https://github.com/user-attachments/assets/7d00790c-4ccb-4658-8c49-000675d301c6" />

### Create a Dedicated Namespace

Create a namespace for this lab:

```bash
kubectl create namespace lab10
```

Set the current Kubernetes context to use the `lab10` namespace:

```bash
kubectl config set-context --current --namespace=lab10
```

Verify the current namespace:

```bash
kubectl config view --minify --output 'jsonpath={..namespace}'
```

---

## Step 2: Creating a Headless Service for Network Identity

StatefulSets require a Headless Service (`clusterIP: None`) to provide stable, unique DNS endpoints for each Pod instance.

For example:

```text
mysql-0.mysql-headless.lab10.svc.cluster.local
```

### Create the Headless Service Manifest

Create a file named `mysql-service.yaml`:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: mysql-headless
  namespace: lab10
  labels:
    app: mysql
spec:
  ports:
    - port: 3306
      name: mysql
  clusterIP: None
  selector:
    app: mysql
```

Apply the Headless Service:

```bash
kubectl apply -f mysql-service.yaml
```

Expected output:

```text
service/mysql-headless created
```

---

## Step 3: Deploying MySQL using StatefulSet & Dynamic PVC

We will now deploy MySQL using a StatefulSet.

Instead of creating a PVC manually, we will use `volumeClaimTemplates` to automatically request a `1Gi` volume from the `local-path` StorageClass for each replica.

### Create the StatefulSet Manifest

Create a file named `mysql-statefulset.yaml`:

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: mysql
  namespace: lab10
spec:
  serviceName: "mysql-headless"
  replicas: 1
  selector:
    matchLabels:
      app: mysql
  template:
    metadata:
      labels:
        app: mysql
    spec:
      containers:
        - name: mysql
          image: mysql:8.0
          env:
            - name: MYSQL_ROOT_PASSWORD
              value: "SecretPassword123"
            - name: MYSQL_DATABASE
              value: "company_db"
          ports:
            - containerPort: 3306
              name: mysql
          volumeMounts:
            - name: data
              mountPath: /var/lib/mysql
  volumeClaimTemplates:
    - metadata:
        name: data
      spec:
        accessModes: ["ReadWriteOnce"]
        storageClassName: "local-path"
        resources:
          requests:
            storage: 1Gi
```

Apply the StatefulSet manifest:

```bash
kubectl apply -f mysql-statefulset.yaml
```

Expected output:

```text
statefulset.apps/mysql created
```

---

## Step 4: Verifying StatefulSet, PVC, and PV Binding

Check the StatefulSet, Pods, PVC, and PV created automatically by the k3s `local-path` provisioner.

### Check StatefulSet and Pod Status

```bash
kubectl get statefulset,pods -n lab10
```

Expected output:

```text
NAME                     READY   AGE
statefulset.apps/mysql   1/1     45s

NAME          READY   STATUS    RESTARTS   AGE
pod/mysql-0   1/1     Running   0          45s
```

> **Note:** StatefulSet Pods use ordinal indexing starting from `0` (for example, `mysql-0`).
<img width="783" height="292" alt="image" src="https://github.com/user-attachments/assets/6e0b45cd-e306-4706-9463-c130d8f80176" />

### Check PersistentVolumeClaim (PVC) & PersistentVolume (PV)

```bash
kubectl get pvc,pv -n lab10
```

Expected output:

```text
NAME                                STATUS   VOLUME                                     CAPACITY   ACCESS MODES   STORAGECLASS   AGE
persistentvolumeclaim/data-mysql-0  Bound    pvc-12345678-abcd-1234-ef01-123456789abc   1Gi        RWO            local-path     50s

NAME                                       CAPACITY   ACCESS MODES   RECLAIM POLICY   STATUS   CLAIM                 STORAGECLASS   AGE
persistentvolume/pvc-12345678-abcd-1234   1Gi        RWO            Delete           Bound    lab10/data-mysql-0    local-path     48s
```

> **Note:** PV and PVC names, IDs, and timestamps are generated dynamically and will differ on your cluster.
<img width="993" height="209" alt="image" src="https://github.com/user-attachments/assets/8a039371-880d-4d14-bfa2-05561dfca9b5" />

---

## Step 5: Data Persistence Testing & Verification

To verify that database data persists across Pod deletions and restarts, we will write sample records into MySQL, delete the Pod, and verify that the data remains intact when the new Pod starts.

### 1. Connect to MySQL and Insert Test Data

Execute into the `mysql-0` Pod and create a sample table with data:

```bash
kubectl exec -it mysql-0 -n lab10 -- mysql -u root -pSecretPassword123 company_db -e "
CREATE TABLE employees (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(50));
INSERT INTO employees (name) VALUES ('Alice'), ('Bob');
SELECT * FROM employees;
"
```

Expected output:

```text
+----+-------+
| id | name  |
+----+-------+
|  1 | Alice |
|  2 | Bob   |
+----+-------+
```
<img width="995" height="264" alt="image" src="https://github.com/user-attachments/assets/7aa37399-6349-4819-907d-33605c7a4828" />

### 2. Simulate Container Failure / Pod Deletion

Delete the `mysql-0` Pod to simulate a Pod failure:

```bash
kubectl delete pod mysql-0 -n lab10
```

Watch Kubernetes automatically recreate the `mysql-0` Pod and reattach the same PVC:

```bash
kubectl get pods -n lab10 -w
```

Wait until `mysql-0` returns to the `Running` state with `1/1 READY`.

### 3. Verify Data Persistence After Pod Recreation

Execute a query on the new `mysql-0` Pod to confirm that the database records were retained on the `local-path` storage:

```bash
kubectl exec -it mysql-0 -n lab10 -- mysql -u root -pSecretPassword123 company_db -e "SELECT * FROM employees;"
```

Expected output:

```text
+----+-------+
| id | name  |
+----+-------+
|  1 | Alice |
|  2 | Bob   |
+----+-------+
```
<img width="1001" height="278" alt="image" src="https://github.com/user-attachments/assets/b500d038-ec55-42cb-857e-f2b4acc3e471" />

**Data successfully persisted!**

---

## Step 6: Resource Cleanup

To clean up all stateful resources, execute the following commands.

> **Important:** Deleting a StatefulSet does not automatically delete the associated PVCs/PVs. This behavior helps prevent accidental data loss. Delete the PVC explicitly if storage cleanup is desired.

### Delete StatefulSet, Service, and PVCs

```bash
kubectl delete -f mysql-statefulset.yaml
kubectl delete -f mysql-service.yaml
kubectl delete pvc data-mysql-0 -n lab10
```

Delete the lab namespace:

```bash
kubectl delete namespace lab10
```

Verify complete removal:

```bash
kubectl get namespaces
```

---

## Useful Stateful Workload & Storage Commands

| Command | Description |
| :--- | :--- |
| `kubectl get storageclass` | List available StorageClasses and identify the default provisioner |
| `kubectl get statefulset` | List active StatefulSets in the current namespace |
| `kubectl get pvc,pv` | Inspect the status of storage claims and bound volumes |
| `kubectl describe pvc <pvc-name>` | View binding events and details for a storage claim |
| `kubectl exec -it <pod-name> -- <command>` | Run interactive commands inside a stateful container |
| `kubectl scale statefulset <name> --replicas=N` | Scale StatefulSet replicas up or down in deterministic order |

---

## Lab Summary

In this lab, you learned how to:

- Distinguish **StatefulSets** from standard Deployments for applications requiring stable network identities and persistent storage.
- Utilize the k3s built-in **`local-path` StorageClass** for dynamic local volume provisioning.
- Use `volumeClaimTemplates` inside StatefulSet manifests to automate volume binding.
- Deploy a **Headless Service (`clusterIP: None`)** to enable stable Pod-to-Pod DNS discovery.
- Test and verify data persistence across Pod restarts and manual Pod deletions.
- Perform clean teardown of StatefulSets, Services, PVCs, and Namespaces.
'''

path = Path("/mnt/data/README_Lab10.md")
path.write_text(content, encoding="utf-8")
print(path)
print(f"{len(content):,} characters")
