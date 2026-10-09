# Lab 07: Node-Level Operations & Batch Processing (DaemonSets, Jobs & CronJobs)

This repository contains the complete step-by-step guide and commands for **Lab 7: Node-Level Operations & Batch Processing on Kubernetes**.

The purpose of this lab is to familiarize you with:

- Understanding node-level workloads vs. batch processing workloads.
- Deploying **DaemonSets** to ensure a Pod runs on every cluster node (e.g., node monitoring and log collection).
- Executing one-off batch tasks using **Jobs**.
- Automating recurring scheduled tasks using **CronJobs**.
- Managing Job completion criteria, restart policies, and concurrency policies.
- Inspecting pod logs, active execution states, and cleaning up batch resources.

## Workload Concepts Overview

| Resource Type | Primary Purpose | Lifecycle & Target State | Use Cases |
| :--- | :--- | :--- | :--- |
| **DaemonSet** | Node-level background service | Runs one copy per eligible node indefinitely | Fluentd log collector, Prometheus Node Exporter |
| **Job** | One-off batch execution | Runs until tasks complete successfully (`Completed`) | Database migrations, data processing, backups |
| **CronJob** | Scheduled batch execution | Creates Jobs automatically on a time schedule | Nightly cleanups, hourly reporting, automated backups |

## Workload Execution Flow

```text
Cluster Nodes
├── Node 1 ──> DaemonSet Pod (Node Exporter / Log Agent)
├── Node 2 ──> DaemonSet Pod (Node Exporter / Log Agent)
└── Node 3 ──> DaemonSet Pod (Node Exporter / Log Agent)

Batch / Scheduled Tasks
├── Job ──────> Spawns Pod ──> Executes Task ──> Status: Completed
└── CronJob ──> Triggers Job on Schedule ──> Spawns Pod ──> Status: Completed
```

## Step 1: Cluster Preparation & Setup

Verify that your Kubernetes cluster is active and that your node status is `Ready`:

```bash
kubectl get nodes
```

### Create a Dedicated Namespace

Create a namespace for this lab:

```bash
kubectl create namespace lab07
```

Set the current Kubernetes context to use the `lab07` namespace:

```bash
kubectl config set-context --current --namespace=lab07
```

Verify the current namespace:

```bash
kubectl config view --minify --output 'jsonpath={..namespace}'
```
<img width="951" height="75" alt="image" src="https://github.com/user-attachments/assets/2914efec-3905-4897-b7c4-512f4a90c6b9" />

## Step 2: Deploying Node-Level Workloads (DaemonSet)

A DaemonSet ensures that all (or some) nodes run a copy of a Pod. As nodes are added to the cluster, Pods are added to them automatically.

In this step, we will deploy a background log collector/system monitor agent across all eligible cluster nodes.

### Create the DaemonSet Manifest

Create a file named `node-exporter-ds.yaml`:

```yaml
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: node-exporter
  labels:
    app: node-exporter
spec:
  selector:
    matchLabels:
      app: node-exporter
  template:
    metadata:
      labels:
        app: node-exporter
    spec:
      containers:
        - name: node-exporter
          image: prom/node-exporter:v1.7.0
          ports:
            - containerPort: 9100
              name: metrics
          resources:
            requests:
              cpu: 50m
              memory: 50Mi
            limits:
              cpu: 100m
              memory: 100Mi
```

### Apply the DaemonSet

```bash
kubectl apply -f node-exporter-ds.yaml
```

Expected output:

```text
daemonset.apps/node-exporter created
```

### Verify DaemonSet and Pod Distribution

Check the status of the DaemonSet:

```bash
kubectl get daemonset
```

Example output (values such as `AGE` may differ):

```text
NAME            DESIRED   CURRENT   READY   UP-TO-DATE   AVAILABLE   NODE SELECTOR   AGE
node-exporter   1         1         1       1            1           <none>          10s
```
<img width="823" height="119" alt="image" src="https://github.com/user-attachments/assets/2fe13d22-269c-42c6-af9a-c071f3523b3c" />

Check that a Pod is scheduled on every eligible cluster node:

```bash
kubectl get pods -o wide -l app=node-exporter
```
<img width="546" height="87" alt="image" src="https://github.com/user-attachments/assets/8d7947ca-7136-4c30-971f-7be839d6b789" />

## Step 3: Running One-Off Batch Tasks (Jobs)

A Job creates one or more Pods and ensures that a specified number of them successfully terminate. Unlike Deployments, Jobs are designed to run a task to completion and stop.

In this step, we will run a data-processing job that computes Pi to 2,000 decimal places.

### Create the Job Manifest

Create a file named `pi-job.yaml`:

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: pi-job
spec:
  completions: 1
  backoffLimit: 3
  template:
    metadata:
      name: pi-job
    spec:
      containers:
        - name: pi
          image: perl:5.34.0
          command: ["perl", "-Mbignum=bpi", "-wle", "print bpi(2000)"]
      restartPolicy: Never
```

**Note:** For Jobs, `restartPolicy` must be set explicitly to either `Never` or `OnFailure`.

### Apply the Job

```bash
kubectl apply -f pi-job.yaml
```

Expected output:

```text
job.batch/pi-job created
```

### Monitor Job Execution and Logs

Check the status of the Job:

```bash
kubectl get jobs
```

Example output (duration and age may differ):

```text
NAME     COMPLETIONS   DURATION   AGE
pi-job   1/1           8s         12s
```
<img width="703" height="96" alt="image" src="https://github.com/user-attachments/assets/9840cbff-be2e-4e70-92c8-75b2d808ec1c" />

Verify that the Job Pod status is `Completed`:

```bash
kubectl get pods -l job-name=pi-job
```
<img width="593" height="78" alt="image" src="https://github.com/user-attachments/assets/0b123818-213c-469b-9601-df328840face" />

Inspect the output log generated by the completed Job Pod:

```bash
kubectl logs -l job-name=pi-job
```
<img width="997" height="376" alt="image" src="https://github.com/user-attachments/assets/d2190eb8-9981-4140-9757-7a4a95f9eb5d" />

## Step 4: Scheduling Recurring Tasks (CronJobs)

A **CronJob** manages time-based Jobs, running a task periodically on a schedule written in standard Cron format, such as `* * * * *`.

In this step, we will deploy a CronJob that executes a cleanup/health-check script every minute.

### Create the CronJob Manifest

Create a file named `healthcheck-cronjob.yaml`:

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: system-healthcheck
spec:
  schedule: "*/1 * * * *"
  concurrencyPolicy: Forbid
  successfulJobsHistoryLimit: 3
  failedJobsHistoryLimit: 1
  jobTemplate:
    spec:
      template:
        metadata:
          labels:
            app: system-healthcheck
        spec:
          containers:
            - name: healthcheck
              image: busybox:1.35
              command:
                - /bin/sh
                - -c
                - "date; echo 'System healthcheck completed successfully.'"
          restartPolicy: OnFailure
```

### Apply the CronJob

```bash
kubectl apply -f healthcheck-cronjob.yaml
```

Expected output:

```text
cronjob.batch/system-healthcheck created
```

### Verify CronJob Execution

List the CronJobs:

```bash
kubectl get cronjob
```

Watch Job creation as the schedule triggers (wait 1–2 minutes):

```bash
kubectl get jobs --watch
```

Check the Pods spawned by the CronJob:

```bash
kubectl get pods -l app=system-healthcheck
```

Inspect logs from one of the generated executions:

```bash
kubectl logs -l app=system-healthcheck --tail=10
```
<img width="856" height="382" alt="image" src="https://github.com/user-attachments/assets/9edeceaa-07c9-47d1-b99a-cc02cb7fa500" />

## Step 5: Testing & Verification

Verify all relevant resources within the `lab07` namespace:

```bash
kubectl get daemonsets,jobs,cronjobs,pods
```
<img width="966" height="291" alt="image" src="https://github.com/user-attachments/assets/183b8ece-cb39-4981-826f-733f2a2234fa" />

Expected resource states:

- **DaemonSet:** One active Pod per eligible node.
- **Job:** One successful completion (`COMPLETIONS 1/1`).
- **CronJob:** An active schedule that triggers recurring executions.
- **Pods:** A mixture of `Running` (DaemonSet) and `Completed` (Job/CronJob) states.

**Note:** A CronJob creates Jobs on its schedule. If you run the verification command before the next scheduled time, a new CronJob-generated Job or Pod may not appear yet.

## Step 6: Resource Cleanup

Delete the CronJob, Job, and DaemonSet resources:

```bash
kubectl delete -f healthcheck-cronjob.yaml
kubectl delete -f pi-job.yaml
kubectl delete -f node-exporter-ds.yaml
```

Delete the lab namespace:

```bash
kubectl delete namespace lab07
```

Verify that the namespace has been completely removed:

```bash
kubectl get namespaces
```

## Useful Batch Processing Commands

| Command | Description |
| :--- | :--- |
| `kubectl get daemonsets` | List all active DaemonSets |
| `kubectl get jobs` | View Job execution status and completion count |
| `kubectl get cronjobs` | Check CronJob schedules and last execution times |
| `kubectl logs -l job-name=<job-name>` | Inspect logs generated by a completed Job |
| `kubectl create job <name> --from=cronjob/<cronjob-name>` | Manually trigger a Job run from an existing CronJob |
| `kubectl delete job <job-name>` | Manually remove a completed or stuck Job |

## Lab Summary

In this lab, you learned how to:

- Deploy **DaemonSets** to ensure specific background Pods run on every eligible node.
- Configure resource requests, limits, and ports for node-level agents.
- Create one-off **Jobs** for computational tasks and batch operations.
- Use `completions` and `backoffLimit` properties to govern Job executions.
- Schedule automated recurring tasks using **CronJobs**.
- Configure `concurrencyPolicy` and execution history limits.
- Inspect logs of terminated batch Pods and perform proper cleanup.
