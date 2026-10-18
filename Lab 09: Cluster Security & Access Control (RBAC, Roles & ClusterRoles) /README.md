# Lab 09: Cluster Security & Access Control (RBAC, Roles & ClusterRoles)

This repository contains the complete step-by-step guide and commands for **Lab 9: Cluster Security & Access Control on Kubernetes**.

The purpose of this lab is to familiarize you with:

- Understanding Kubernetes Role-Based Access Control (RBAC) principles (Authentication vs. Authorization).
- Creating **ServiceAccounts** to provide identity for workloads running inside the cluster.
- Defining namespace-scoped permissions using **Roles** (verbs, resources, API groups).
- Defining cluster-wide permissions using **ClusterRoles**.
- Binding permissions to identities using **RoleBindings** and **ClusterRoleBindings**.
- Verifying access control using `kubectl auth can-i`.
- Testing restricted permissions directly from within a Pod running under a custom ServiceAccount.
- Cleaning up security and access control resources.

---

## RBAC Concepts Overview

| Resource Type | Scope | Primary Purpose | Key Components |
| :--- | :--- | :--- | :--- |
| **ServiceAccount** | Namespace | Provides an identity for processes running inside Pods | `metadata.name`, `metadata.namespace` |
| **Role** | Namespace | Sets rules/permissions for specific resources in a single namespace | `apiGroups`, `resources`, `verbs` |
| **ClusterRole** | Cluster-wide | Sets rules/permissions for cluster-scoped or all-namespace resources | `apiGroups`, `resources`, `verbs` |
| **RoleBinding** | Namespace | Grants permissions defined in a Role/ClusterRole to a subject within a namespace | `subjects`, `roleRef` |
| **ClusterRoleBinding** | Cluster-wide | Grants permissions defined in a ClusterRole to a subject across all namespaces | `subjects`, `roleRef` |

### Access Control Authorization Flow

```text
Subject (ServiceAccount / User / Group)
 └── RoleBinding (Namespace-scoped) / ClusterRoleBinding (Cluster-scoped)
      └── Role / ClusterRole (Rules: apiGroups + resources + verbs)
           └── Granted API Operations (e.g., get, list, watch, create, delete)
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
kubectl create namespace lab09
```

Set the current Kubernetes context to use the `lab09` namespace:

```bash
kubectl config set-context --current --namespace=lab09
```

Verify the current namespace:

```bash
kubectl config view --minify --output 'jsonpath={..namespace}'
```

---

## Step 2: Creating a ServiceAccount

A ServiceAccount provides a distinct identity for Pods to authenticate with the Kubernetes API server.

### Create the ServiceAccount Manifest

Create a file named `app-serviceaccount.yaml`:

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: pod-reader-sa
  namespace: lab09
```

### Apply the ServiceAccount

```bash
kubectl apply -f app-serviceaccount.yaml
```

Expected output:

```text
serviceaccount/pod-reader-sa created
```

### Verify ServiceAccount Creation

Check the status of the ServiceAccount:

```bash
kubectl get serviceaccount pod-reader-sa
```

Expected output:

```text
NAME            SECRETS   AGE
pod-reader-sa   0         10s
```
<img width="664" height="103" alt="image" src="https://github.com/user-attachments/assets/e6b69e37-5732-4069-864b-05b8565d3b81" />

---

## Step 3: Defining Permissions with Roles & ClusterRoles

In this step, we define what actions can be performed on specific Kubernetes resources.

### 1. Create a Namespace-Scoped Role

Create a file named `pod-reader-role.yaml` to allow reading Pods within the `lab09` namespace:

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: pod-reader
  namespace: lab09
rules:
  - apiGroups: [""] # "" indicates the core API group
    resources: ["pods", "pods/log"]
    verbs: ["get", "list", "watch"]
```

Apply the Role manifest:

```bash
kubectl apply -f pod-reader-role.yaml
```

Expected output:

```text
role.rbac.authorization.k8s.io/pod-reader created
```

### 2. Create a Cluster-Wide ClusterRole (Optional Read-Only Node Access)

Create a file named `node-reader-clusterrole.yaml` to allow listing nodes across the cluster:

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: node-reader
rules:
  - apiGroups: [""]
    resources: ["nodes"]
    verbs: ["get", "list"]
```

Apply the ClusterRole manifest:

```bash
kubectl apply -f node-reader-clusterrole.yaml
```

Expected output:

```text
clusterrole.rbac.authorization.k8s.io/node-reader created
```
<img width="564" height="77" alt="image" src="https://github.com/user-attachments/assets/83480e56-fedf-4ece-8401-ce6403557aff" />

> **Note:** This ClusterRole is created to demonstrate cluster-scoped permissions, but it is not bound to the `pod-reader-sa` ServiceAccount in this lab.

---

## Step 4: Binding Roles to ServiceAccounts

Permissions defined in Roles or ClusterRoles take effect only after they are bound to a subject using a RoleBinding or ClusterRoleBinding.

### Create the RoleBinding Manifest

Create a file named `pod-reader-rolebinding.yaml` to bind the `pod-reader` Role to the `pod-reader-sa` ServiceAccount:

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: read-pods-binding
  namespace: lab09
subjects:
  - kind: ServiceAccount
    name: pod-reader-sa
    namespace: lab09
roleRef:
  kind: Role
  name: pod-reader
  apiGroup: rbac.authorization.k8s.io
```

Apply the RoleBinding:

```bash
kubectl apply -f pod-reader-rolebinding.yaml
```

Expected output:

```text
rolebinding.rbac.authorization.k8s.io/read-pods-binding created
```

### Verify Roles and Bindings

```bash
kubectl get roles,rolebindings -n lab09
```
<img width="806" height="132" alt="image" src="https://github.com/user-attachments/assets/8eb73edd-2ab8-418e-b90c-7071d5bf8798" />

---

## Step 5: Testing & Authorization Verification

Kubernetes provides built-in tools to test RBAC permissions without switching contexts.

### 1. Test Permissions Using `kubectl auth can-i`

Check if `pod-reader-sa` can list Pods in the `lab09` namespace:

```bash
kubectl auth can-i list pods --as=system:serviceaccount:lab09:pod-reader-sa
```

Expected output:

```text
yes
```
<img width="996" height="64" alt="image" src="https://github.com/user-attachments/assets/da286cb4-0409-42e7-9920-b87e06dc84fa" />

Check if `pod-reader-sa` can delete Pods in the `lab09` namespace:

```bash
kubectl auth can-i delete pods --as=system:serviceaccount:lab09:pod-reader-sa
```

Expected output:

```text
no
```
<img width="997" height="80" alt="image" src="https://github.com/user-attachments/assets/2340286d-c3be-4dcd-8d1b-b05547287aba" />

Check if `pod-reader-sa` can list Deployments in the `lab09` namespace:

```bash
kubectl auth can-i list deployments --as=system:serviceaccount:lab09:pod-reader-sa
```

Expected output:

```text
no
```
<img width="1000" height="78" alt="image" src="https://github.com/user-attachments/assets/05176c96-74e7-4e12-a051-e9972e41ceab" />

### 2. Verify Access Inside a Running Pod

Deploy a Pod configured with the custom `pod-reader-sa` ServiceAccount to test in-cluster authorization.

Create a file named `rbac-test-pod.yaml`:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: rbac-test-pod
  namespace: lab09
spec:
  serviceAccountName: pod-reader-sa
  containers:
    - name: kubectl-container
      image: bitnami/kubectl:latest
      command: ["/bin/sh", "-c", "sleep 3600"]
```

Apply the Pod manifest:

```bash
kubectl apply -f rbac-test-pod.yaml
```

Wait until the Pod is in the `Running` state:

```bash
kubectl get pod rbac-test-pod -w
```
<img width="536" height="84" alt="image" src="https://github.com/user-attachments/assets/d8c42165-dc68-482a-bb82-94a9f1d3d3c6" />

### Test API Operations from Inside the Container

#### Attempt Listing Pods (Allowed)

```bash
kubectl exec -it rbac-test-pod -- kubectl get pods -n lab09
```
<img width="901" height="77" alt="image" src="https://github.com/user-attachments/assets/7878b19b-231d-4078-b65a-cf335f444aab" />

Expected result: Successfully lists Pods in `lab09`.

#### Attempt Listing Deployments (Forbidden)

```bash
kubectl exec -it rbac-test-pod -- kubectl get deployments -n lab09
```

Expected result:

```text
Error from server (Forbidden): deployments.apps is forbidden
```
<img width="989" height="98" alt="image" src="https://github.com/user-attachments/assets/5ad4cfaf-aa3e-46bd-adc8-269732e36d5d" />

#### Attempt Deleting a Pod (Forbidden)

```bash
kubectl exec -it rbac-test-pod -- kubectl delete pod rbac-test-pod -n lab09
```

Expected result:

```text
Error from server (Forbidden): pods "rbac-test-pod" is forbidden
```

---

## Step 6: Resource Cleanup

Delete all RBAC testing Pods and authorization resources:

```bash
kubectl delete -f rbac-test-pod.yaml
kubectl delete -f pod-reader-rolebinding.yaml
kubectl delete -f pod-reader-role.yaml
kubectl delete -f node-reader-clusterrole.yaml
kubectl delete -f app-serviceaccount.yaml
```

Delete the lab namespace:

```bash
kubectl delete namespace lab09
```

Verify that the namespace has been completely removed:

```bash
kubectl get namespaces
```

---

## Useful RBAC Management Commands

| Command | Description |
| :--- | :--- |
| `kubectl get serviceaccounts` | List ServiceAccounts in the current namespace |
| `kubectl get roles,rolebindings` | List Roles and RoleBindings in the current namespace |
| `kubectl get clusterroles,clusterrolebindings` | List cluster-wide ClusterRoles and ClusterRoleBindings |
| `kubectl describe role <role-name>` | Display rules and allowed verbs for a Role |
| `kubectl auth can-i <verb> <resource>` | Test current user permissions for an action |
| `kubectl auth can-i <verb> <resource> --as=system:serviceaccount:<namespace>:<sa-name>` | Test specific ServiceAccount permissions |
| `kubectl create role <name> --verb=get,list --resource=pods` | Imperatively create a Role |
| `kubectl create rolebinding <name> --role=<role-name> --serviceaccount=<ns>:<sa-name>` | Imperatively create a RoleBinding |

---

## Lab Summary

In this lab, you learned how to:

- Decouple access privileges from default admin roles using Kubernetes RBAC.
- Create custom ServiceAccounts to establish dedicated workload identities.
- Configure namespace-scoped Roles and cluster-scoped ClusterRoles using explicit API groups, resources, and verbs.
- Associate permissions to ServiceAccounts using RoleBindings.
- Validate active permissions declaratively using `kubectl auth can-i`.
- Execute in-Pod authorization testing using a container bound to a restricted ServiceAccount.
- Safely clean up custom RBAC definitions and namespaces.
'''
path='/mnt/data/README_Lab09.md'
open(path,'w',encoding='utf-8').write(content)
print(path)
