# Lab 11: Mental Health Booking App on K3s with NGINX Ingress

This lab migrates the **Mental Health Booking App** from Docker Compose to a Kubernetes-based architecture running on a **K3s VM**.

The project demonstrates practical Kubernetes and K3s concepts while keeping the architecture simple and easy to understand.

---

## 1. Lab Objectives

By completing this lab, you will practice:

- Docker multi-stage builds
- Docker networking
- NGINX reverse proxy
- K3s
- Kubernetes Namespaces
- ConfigMaps
- Secrets
- Deployments
- StatefulSets
- PersistentVolumeClaims
- K3s `local-path` StorageClass
- Headless Services
- ClusterIP Services
- Kubernetes Jobs
- Kubernetes CronJobs
- Liveness Probes
- Readiness Probes
- Startup Probes
- Rolling Updates
- Horizontal Pod Autoscaling
- NGINX Ingress Controller
- Kubernetes DNS
- Internal service discovery
- Local DNS using `/etc/hosts`
- Kubernetes troubleshooting

The final architecture remains intentionally small:

```text
                         Browser
                            |
                            |
                   smallsteps.local
                            |
                            v
              +--------------------------+
              | NGINX Ingress Controller |
              |        Port 80            |
              +------------+-------------+
                           |
                 +---------+---------+
                 |                   |
               /api                  /
                 |                   |
                 v                   v
       +------------------+   +------------------+
       | backend-service  |   | frontend-service |
       |    ClusterIP     |   |    ClusterIP     |
       |      :3000       |   |       :80        |
       +--------+---------+   +--------+---------+
                |                      |
                v                      v
       +------------------+   +------------------+
       | Backend Pods     |   | NGINX Pods       |
       | Deployment       |   | Deployment       |
       | replicas: 2      |   | replicas: 2      |
       +--------+---------+   +------------------+
                |
                v
       +----------------------+
       | mongodb-headless     |
       | Headless Service     |
       +----------+-----------+
                  |
                  v
       +----------------------+
       | MongoDB StatefulSet  |
       | mongodb-0            |
       +----------+-----------+
                  |
                  v
       +----------------------+
       | MongoDB PVC          |
       | 2Gi / local-path     |
       +----------------------+

       Additional Kubernetes resources:

       Job       -> Application smoke test
       CronJob   -> MongoDB backup demonstration
       HPA       -> Backend autoscaling
```

---

# 2. Existing Application

The original application contains:

```text
mental-health-booking-app/
├── public/
├── src/
│   └── server.js
├── docker/
│   ├── Dockerfile
│   └── nginx.conf
├── .env.example
├── docker-compose.yml
└── package.json
```

The application consists of:

```text
Frontend
   |
   v
NGINX
   |
   v
Node.js / Express
   |
   v
MongoDB
```

The Express application listens on:

```text
3000
```

MongoDB listens on:

```text
27017
```

NGINX listens on:

```text
80
```

Application API endpoints include:

```text
/api/auth/*
/api/doctors
/api/bookings
/api/health
```

---

# 3. Final Project Structure

The final project should look like this:

```text
mental-health-booking-app/
│
├── public/
│   ├── index.html
│   ├── css/
│   └── js/
│
├── src/
│   └── server.js
│
├── docker/
│   ├── Dockerfile
│   └── nginx.conf
│
├── k8s/
│   ├── 00-namespace.yaml
│   ├── 01-configmap-secret.yaml
│   ├── 02-mongodb-statefulset.yaml
│   ├── 03-backend-deployment.yaml
│   ├── 04-frontend-deployment.yaml
│   ├── 05-ingress.yaml
│   ├── 06-smoke-test-job.yaml
│   ├── 07-mongodb-backup-cronjob.yaml
│   └── 08-backend-hpa.yaml
│
├── .dockerignore
├── .env.example
├── docker-compose.yml
├── package.json
├── package-lock.json
└── README.md
```

---

# 4. Kubernetes Components

| Component | Kubernetes Resource | Port | Exposure | Storage |
|---|---|---:|---|---|
| NGINX Ingress | Ingress Controller | 80/443 | External | None |
| Frontend | Deployment | 80 | ClusterIP | None |
| Backend | Deployment | 3000 | ClusterIP | None |
| MongoDB | StatefulSet | 27017 | Internal | 2Gi PVC |
| MongoDB DNS | Headless Service | 27017 | Internal | None |
| Config | ConfigMap | - | Internal | None |
| Credentials | Secret | - | Internal | None |
| Smoke Test | Job | - | Internal | None |
| Backup | CronJob | - | Internal | None |
| Autoscaling | HPA | - | Internal | None |

---

# 5. VM Requirements

The lab is designed for a Linux VM.

Recommended minimum:

```text
CPU:      2 vCPU
RAM:      4 GB
Disk:     20 GB+
OS:       Ubuntu 22.04 / Ubuntu 24.04
Network:  VM reachable from your host machine
```

Check the VM:

```bash
hostname
```

```bash
hostname -I
```

```bash
ip addr
```

---

# 6. Verify K3s

Check K3s:

```bash
k3s --version
```

Check Kubernetes:

```bash
kubectl version --client
```

Check the node:

```bash
kubectl get nodes -o wide
```

Expected:

```text
NAME   STATUS   ROLES                  AGE   VERSION
test   Ready    control-plane,master   ...   v1...
```

Your actual node name/version may be different.

---

# 7. Verify K3s Storage

K3s normally provides the `local-path` StorageClass.

Run:

```bash
kubectl get storageclass
```

Expected:

```text
NAME                   PROVISIONER
local-path (default)   rancher.io/local-path
```

This project will use:

```text
local-path
```

for MongoDB persistence.

---

# 8. Disable Traefik

K3s normally installs Traefik as its default Ingress controller.

This lab will use:

```text
NGINX Ingress Controller
```

instead.

We should not run both controllers for this lab.

---

## 8.1 Check Traefik

Run:

```bash
kubectl get pods -n kube-system | grep traefik
```

Also:

```bash
kubectl get svc -n kube-system | grep traefik
```

If Traefik exists, continue.

---

# 9. Configure K3s to Disable Traefik

Open:

```bash
sudo nano /etc/rancher/k3s/config.yaml
```

If the file does not exist:

```bash
sudo mkdir -p /etc/rancher/k3s
sudo touch /etc/rancher/k3s/config.yaml
```

Add:

```yaml
disable:
  - traefik
```

If the file already contains other settings, keep them.

Example:

```yaml
write-kubeconfig-mode: "0644"

disable:
  - traefik
```

Save:

```text
CTRL + O
ENTER
CTRL + X
```

---

# 10. Restart K3s

Run:

```bash
sudo systemctl restart k3s
```

Check:

```bash
sudo systemctl status k3s --no-pager
```

Wait:

```bash
sleep 10
```

Check:

```bash
kubectl get nodes
```

The node must become:

```text
Ready
```

---

# 11. Verify Traefik Is Disabled

Run:

```bash
kubectl get pods -n kube-system
```

There should be no running Traefik Pod.

Check:

```bash
kubectl get svc -n kube-system
```

There should be no active Traefik Service.

You can also check:

```bash
kubectl get helmcharts -n kube-system
```

---

# 12. Install NGINX Ingress Controller

Add the Helm repository:

```bash
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
```

Update:

```bash
helm repo update
```

Create the namespace:

```bash
kubectl create namespace ingress-nginx
```

Install NGINX Ingress:

```bash
helm install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx
```

Check:

```bash
kubectl get pods -n ingress-nginx
```

Wait until the controller is:

```text
Running
```

Check:

```bash
kubectl get svc -n ingress-nginx
```

Check the Helm release:

```bash
helm list -n ingress-nginx
```

---

# 13. Verify Ingress Class

Run:

```bash
kubectl get ingressclass
```

Expected:

```text
NAME
nginx
```

The Kubernetes Ingress resource will explicitly use:

```yaml
ingressClassName: nginx
```

---

# 14. Dockerfile

File:

```text
docker/Dockerfile
```

Use the following complete file:

```dockerfile
# syntax=docker/dockerfile:1

# ==================================================
# Backend Dependencies
# ==================================================

FROM node:22-alpine AS backend-deps

WORKDIR /app

COPY package*.json ./

RUN npm ci --omit=dev \
    && npm cache clean --force


# ==================================================
# Backend
# ==================================================

FROM node:22-alpine AS backend

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=backend-deps --chown=node:node /app/node_modules ./node_modules

COPY --chown=node:node package*.json ./
COPY --chown=node:node src ./src
COPY --chown=node:node public ./public

USER node

EXPOSE 3000

CMD ["node", "src/server.js"]


# ==================================================
# Frontend
# ==================================================

FROM nginx:1.28-alpine AS frontend

RUN rm -f /etc/nginx/conf.d/default.conf

COPY public/ /usr/share/nginx/html/

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

---

# 15. NGINX Configuration

File:

```text
docker/nginx.conf
```

Complete content:

```nginx
server {
    listen 80;
    server_name _;

    root /usr/share/nginx/html;
    index index.html;

    server_tokens off;

    location = /nginx-health {
        access_log off;
        default_type text/plain;

        return 200 "OK\n";
    }

    location /api/ {
        proxy_pass http://backend-service:3000;

        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_connect_timeout 5s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~ /\. {
        deny all;
    }
}
```

---

# 16. Update server.js

The Node.js application must listen on all interfaces inside the container.

Find the existing `app.listen()` code.

Use:

```javascript
const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
});
```

The important part is:

```text
0.0.0.0
```

Do not use:

```text
localhost
```

or:

```text
127.0.0.1
```

for the container listener.

Kubernetes needs to reach the application through the Pod network.

Keep your existing API routes:

```text
/api/auth/*
/api/doctors
/api/bookings
/api/health
```

---

# 17. .dockerignore

File:

```text
.dockerignore
```

Content:

```dockerignore
.git
.gitignore

node_modules

npm-debug.log*
yarn-debug.log*
pnpm-debug.log*

.env
.env.*

coverage
.nyc_output

*.log

.DS_Store

.vscode
.idea

k8s
```

---

# 18. Namespace

File:

```text
k8s/00-namespace.yaml
```

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: smallsteps
```

Apply:

```bash
kubectl apply -f k8s/00-namespace.yaml
```

Verify:

```bash
kubectl get namespace smallsteps
```

---

# 19. ConfigMap and Secret

File:

```text
k8s/01-configmap-secret.yaml
```

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: smallsteps-config
  namespace: smallsteps
data:
  NODE_ENV: "production"
  PORT: "3000"
  MONGO_DATABASE: "smallsteps"

---
apiVersion: v1
kind: Secret
metadata:
  name: smallsteps-secret
  namespace: smallsteps
type: Opaque
stringData:
  MONGO_ROOT_USERNAME: "smallsteps"
  MONGO_ROOT_PASSWORD: "SmallSteps@12345"
  JWT_SECRET: "CHANGE_THIS_TO_A_LONG_RANDOM_SECRET"
  MONGODB_URI: "mongodb://smallsteps:SmallSteps%4012345@mongodb-0.mongodb-headless.smallsteps.svc.cluster.local:27017/smallsteps?authSource=admin"
```

Apply:

```bash
kubectl apply -f k8s/01-configmap-secret.yaml
```

Verify:

```bash
kubectl get configmap -n smallsteps
```

```bash
kubectl get secret -n smallsteps
```

### Important

These credentials are suitable for a lab.

Do not commit real production credentials to Git.

For an actual production environment, use an external secret-management solution or inject secrets securely through your deployment system.

---

# 20. MongoDB StatefulSet

MongoDB should be a StatefulSet because it is a stateful workload.

File:

```text
k8s/02-mongodb-statefulset.yaml
```

```yaml
apiVersion: v1
kind: Service
metadata:
  name: mongodb-headless
  namespace: smallsteps
spec:
  clusterIP: None

  selector:
    app: mongodb

  ports:
    - name: mongodb
      port: 27017
      targetPort: 27017

---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: mongodb
  namespace: smallsteps

spec:
  serviceName: mongodb-headless

  replicas: 1

  selector:
    matchLabels:
      app: mongodb

  template:
    metadata:
      labels:
        app: mongodb

    spec:
      terminationGracePeriodSeconds: 30

      containers:
        - name: mongodb

          image: mongo:7

          imagePullPolicy: IfNotPresent

          ports:
            - name: mongodb
              containerPort: 27017

          env:
            - name: MONGO_INITDB_ROOT_USERNAME
              valueFrom:
                secretKeyRef:
                  name: smallsteps-secret
                  key: MONGO_ROOT_USERNAME

            - name: MONGO_INITDB_ROOT_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: smallsteps-secret
                  key: MONGO_ROOT_PASSWORD

            - name: MONGO_INITDB_DATABASE
              valueFrom:
                configMapKeyRef:
                  name: smallsteps-config
                  key: MONGO_DATABASE

          volumeMounts:
            - name: mongodb-data
              mountPath: /data/db

          startupProbe:
            exec:
              command:
                - mongosh
                - --quiet
                - --eval
                - "db.adminCommand('ping')"

            failureThreshold: 30
            periodSeconds: 10

          readinessProbe:
            exec:
              command:
                - mongosh
                - --quiet
                - --eval
                - "db.adminCommand('ping')"

            initialDelaySeconds: 10
            periodSeconds: 10

          livenessProbe:
            exec:
              command:
                - mongosh
                - --quiet
                - --eval
                - "db.adminCommand('ping')"

            initialDelaySeconds: 30
            periodSeconds: 20

          resources:
            requests:
              cpu: 100m
              memory: 256Mi

            limits:
              cpu: 500m
              memory: 512Mi

  volumeClaimTemplates:

    - metadata:
        name: mongodb-data

      spec:
        accessModes:
          - ReadWriteOnce

        storageClassName: local-path

        resources:
          requests:
            storage: 2Gi
```

Apply:

```bash
kubectl apply -f k8s/02-mongodb-statefulset.yaml
```

Check:

```bash
kubectl get statefulset -n smallsteps
```

Check Pod:

```bash
kubectl get pods -n smallsteps
```

Check PVC:

```bash
kubectl get pvc -n smallsteps
```

Expected:

```text
STATUS
Bound
```

Check PV:

```bash
kubectl get pv
```

---

# 21. Verify MongoDB

Check logs:

```bash
kubectl logs mongodb-0 -n smallsteps
```

Check:

```bash
kubectl describe pod mongodb-0 -n smallsteps
```

The MongoDB Pod should eventually become:

```text
Running
```

and:

```text
READY 1/1
```

---

# 22. MongoDB StatefulSet DNS

Because MongoDB uses a StatefulSet and Headless Service:

```text
StatefulSet:
mongodb

Pod:
mongodb-0

Headless Service:
mongodb-headless
```

The stable DNS name is:

```text
mongodb-0.mongodb-headless.smallsteps.svc.cluster.local
```

This hostname is used by:

```text
MONGODB_URI
```

---

# 23. Backend Deployment

File:

```text
k8s/03-backend-deployment.yaml
```

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
  namespace: smallsteps

spec:
  replicas: 2

  strategy:
    type: RollingUpdate

    rollingUpdate:
      maxUnavailable: 0
      maxSurge: 1

  selector:
    matchLabels:
      app: backend

  template:
    metadata:
      labels:
        app: backend

    spec:
      containers:

        - name: backend

          image: smallsteps-backend:1.0

          imagePullPolicy: IfNotPresent

          ports:
            - name: http
              containerPort: 3000

          env:

            - name: NODE_ENV
              valueFrom:
                configMapKeyRef:
                  name: smallsteps-config
                  key: NODE_ENV

            - name: PORT
              valueFrom:
                configMapKeyRef:
                  name: smallsteps-config
                  key: PORT

            - name: JWT_SECRET
              valueFrom:
                secretKeyRef:
                  name: smallsteps-secret
                  key: JWT_SECRET

            - name: MONGODB_URI
              valueFrom:
                secretKeyRef:
                  name: smallsteps-secret
                  key: MONGODB_URI

          startupProbe:
            httpGet:
              path: /api/health
              port: http

            failureThreshold: 30
            periodSeconds: 5

          readinessProbe:
            httpGet:
              path: /api/health
              port: http

            initialDelaySeconds: 10
            periodSeconds: 10

          livenessProbe:
            httpGet:
              path: /api/health
              port: http

            initialDelaySeconds: 30
            periodSeconds: 20

          resources:

            requests:
              cpu: 100m
              memory: 128Mi

            limits:
              cpu: 500m
              memory: 512Mi

---
apiVersion: v1
kind: Service
metadata:
  name: backend-service
  namespace: smallsteps

spec:
  type: ClusterIP

  selector:
    app: backend

  ports:
    - name: http
      port: 3000
      targetPort: http
```

Apply:

```bash
kubectl apply -f k8s/03-backend-deployment.yaml
```

Check:

```bash
kubectl get deployment -n smallsteps
```

Check Pods:

```bash
kubectl get pods -n smallsteps -l app=backend
```

Check Service:

```bash
kubectl get svc backend-service -n smallsteps
```

Check rollout:

```bash
kubectl rollout status deployment/backend -n smallsteps
```

---

# 24. Frontend NGINX Deployment

The frontend Deployment will use NGINX.

The static website comes from the Docker image.

The NGINX configuration is mounted from a Kubernetes ConfigMap.

File:

```text
k8s/04-frontend-deployment.yaml
```

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: nginx-config
  namespace: smallsteps

data:
  default.conf: |
    server {
        listen 80;
        server_name _;

        root /usr/share/nginx/html;
        index index.html;

        server_tokens off;

        location = /nginx-health {
            access_log off;
            default_type text/plain;

            return 200 "OK\n";
        }

        location /api/ {
            proxy_pass http://backend-service:3000;

            proxy_http_version 1.1;

            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;

            proxy_connect_timeout 5s;
            proxy_read_timeout 60s;
            proxy_send_timeout 60s;
        }

        location / {
            try_files $uri $uri/ /index.html;
        }

        location ~ /\. {
            deny all;
        }
    }

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend
  namespace: smallsteps

spec:
  replicas: 2

  strategy:
    type: RollingUpdate

    rollingUpdate:
      maxUnavailable: 0
      maxSurge: 1

  selector:
    matchLabels:
      app: frontend

  template:
    metadata:
      labels:
        app: frontend

    spec:

      containers:

        - name: nginx

          image: smallsteps-frontend:1.0

          imagePullPolicy: IfNotPresent

          ports:
            - name: http
              containerPort: 80

          volumeMounts:

            - name: nginx-config
              mountPath: /etc/nginx/conf.d/default.conf
              subPath: default.conf
              readOnly: true

          readinessProbe:
            httpGet:
              path: /nginx-health
              port: http

            initialDelaySeconds: 5
            periodSeconds: 10

          livenessProbe:
            httpGet:
              path: /nginx-health
              port: http

            initialDelaySeconds: 10
            periodSeconds: 20

          resources:

            requests:
              cpu: 50m
              memory: 64Mi

            limits:
              cpu: 250m
              memory: 128Mi

      volumes:

        - name: nginx-config

          configMap:
            name: nginx-config

---
apiVersion: v1
kind: Service
metadata:
  name: frontend-service
  namespace: smallsteps

spec:
  type: ClusterIP

  selector:
    app: frontend

  ports:
    - name: http
      port: 80
      targetPort: http
```

Apply:

```bash
kubectl apply -f k8s/04-frontend-deployment.yaml
```

Check:

```bash
kubectl get deployment -n smallsteps
```

```bash
kubectl get pods -n smallsteps -l app=frontend
```

Check:

```bash
kubectl rollout status deployment/frontend -n smallsteps
```

---

# 25. NGINX Ingress

The application will use:

```text
smallsteps.local
```

Ingress rules:

```text
/api
   |
   v
backend-service:3000

/
   |
   v
frontend-service:80
```

File:

```text
k8s/05-ingress.yaml
```

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: smallsteps-ingress
  namespace: smallsteps

  annotations:
    nginx.ingress.kubernetes.io/proxy-body-size: "10m"
    nginx.ingress.kubernetes.io/proxy-connect-timeout: "5"
    nginx.ingress.kubernetes.io/proxy-read-timeout: "60"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "60"

spec:

  ingressClassName: nginx

  rules:

    - host: smallsteps.local

      http:

        paths:

          - path: /api
            pathType: Prefix

            backend:
              service:
                name: backend-service

                port:
                  number: 3000

          - path: /
            pathType: Prefix

            backend:
              service:
                name: frontend-service

                port:
                  number: 80
```

Apply:

```bash
kubectl apply -f k8s/05-ingress.yaml
```

Check:

```bash
kubectl get ingress -n smallsteps
```

Describe:

```bash
kubectl describe ingress smallsteps-ingress -n smallsteps
```

---

# 26. Important Ingress Routing

The browser sends:

```text
http://smallsteps.local/
```

The NGINX Ingress Controller sends it to:

```text
frontend-service:80
```

For:

```text
http://smallsteps.local/api/health
```

the Ingress sends the request to:

```text
backend-service:3000
```

The architecture is therefore:

```text
Browser
   |
   v
NGINX Ingress
   |
   +------ / --------> frontend-service
   |
   +------ /api -----> backend-service
                            |
                            v
                    mongodb-headless
                            |
                            v
                        MongoDB
```

---

# 27. Kubernetes Job

A Job is useful for demonstrating one-time Kubernetes workloads.

This Job will test:

```text
Backend
Frontend
```

File:

```text
k8s/06-smoke-test-job.yaml
```

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: smallsteps-smoke-test
  namespace: smallsteps

spec:
  backoffLimit: 5

  template:

    metadata:
      labels:
        app: smallsteps-smoke-test

    spec:

      restartPolicy: Never

      containers:

        - name: smoke-test

          image: curlimages/curl:8.10.1

          command:
            - sh
            - -c

          args:
            - |
              set -e

              echo "Testing backend..."

              curl -f http://backend-service:3000/api/health

              echo ""

              echo "Backend test passed."

              echo "Testing frontend..."

              curl -f http://frontend-service/nginx-health

              echo ""

              echo "Frontend test passed."

              echo ""

              echo "All smoke tests passed."
```

Apply:

```bash
kubectl apply -f k8s/06-smoke-test-job.yaml
```

Check:

```bash
kubectl get jobs -n smallsteps
```

Check logs:

```bash
kubectl logs job/smallsteps-smoke-test -n smallsteps
```

Expected:

```text
Testing backend...
Backend test passed.

Testing frontend...
Frontend test passed.

All smoke tests passed.
```

---

# 28. MongoDB CronJob

A CronJob demonstrates scheduled Kubernetes workloads.

File:

```text
k8s/07-mongodb-backup-cronjob.yaml
```

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: mongodb-backup
  namespace: smallsteps

spec:

  schedule: "0 2 * * *"

  successfulJobsHistoryLimit: 3
  failedJobsHistoryLimit: 3

  jobTemplate:

    spec:

      template:

        spec:

          restartPolicy: OnFailure

          containers:

            - name: mongodb-backup

              image: mongo:7

              command:
                - /bin/sh
                - -c

              args:
                - |
                  set -e

                  DATE=$(date +%Y-%m-%d-%H%M)

                  echo "Starting MongoDB backup: $DATE"

                  mongodump \
                    --host mongodb-0.mongodb-headless.smallsteps.svc.cluster.local \
                    --port 27017 \
                    --username "$MONGO_USERNAME" \
                    --password "$MONGO_PASSWORD" \
                    --authenticationDatabase admin \
                    --db smallsteps \
                    --archive="/tmp/smallsteps-$DATE.archive"

                  echo "MongoDB backup completed."

              env:

                - name: MONGO_USERNAME

                  valueFrom:
                    secretKeyRef:
                      name: smallsteps-secret
                      key: MONGO_ROOT_USERNAME

                - name: MONGO_PASSWORD

                  valueFrom:
                    secretKeyRef:
                      name: smallsteps-secret
                      key: MONGO_ROOT_PASSWORD
```

Apply:

```bash
kubectl apply -f k8s/07-mongodb-backup-cronjob.yaml
```

Check:

```bash
kubectl get cronjob -n smallsteps
```

---

# 29. Test CronJob Immediately

The scheduled time is:

```text
02:00
```

You do not need to wait.

Create a test Job:

```bash
kubectl create job \
  --from=cronjob/mongodb-backup \
  mongodb-backup-test \
  -n smallsteps
```

Check:

```bash
kubectl get jobs -n smallsteps
```

Check logs:

```bash
kubectl logs job/mongodb-backup-test -n smallsteps
```

Expected:

```text
Starting MongoDB backup...
MongoDB backup completed.
```

### Important

This is a Kubernetes learning demonstration.

The backup file is created inside the temporary Job container.

For a real production backup solution, send the backup to durable external storage such as S3-compatible object storage.

---

# 30. Backend HPA

The backend already has two replicas.

We can demonstrate Kubernetes autoscaling using HPA.

File:

```text
k8s/08-backend-hpa.yaml
```

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: backend-hpa
  namespace: smallsteps

spec:

  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: backend

  minReplicas: 2
  maxReplicas: 5

  behavior:

    scaleUp:
      stabilizationWindowSeconds: 0

    scaleDown:
      stabilizationWindowSeconds: 60

  metrics:

    - type: Resource

      resource:

        name: cpu

        target:

          type: Utilization
          averageUtilization: 70
```

Apply:

```bash
kubectl apply -f k8s/08-backend-hpa.yaml
```

Check:

```bash
kubectl get hpa -n smallsteps
```

Check Metrics Server:

```bash
kubectl get pods -n kube-system | grep metrics
```

Test metrics:

```bash
kubectl top pods -n smallsteps
```

If `kubectl top` works, the HPA can obtain CPU metrics.

---

# 31. Build Docker Images

Go to the application directory:

```bash
cd mental-health-booking-app
```

Build backend:

```bash
docker build \
  -f docker/Dockerfile \
  --target backend \
  -t smallsteps-backend:1.0 \
  .
```

Build frontend:

```bash
docker build \
  -f docker/Dockerfile \
  --target frontend \
  -t smallsteps-frontend:1.0 \
  .
```

Check:

```bash
docker images | grep smallsteps
```

Expected:

```text
smallsteps-backend
smallsteps-frontend
```

---

# 32. Test Docker First

Before Kubernetes, make sure the application itself works.

Run:

```bash
docker compose up -d
```

Check:

```bash
docker compose ps
```

Test the API:

```bash
curl http://localhost:3000/api/health
```

When finished:

```bash
docker compose down
```

---

# 33. Import Images into K3s

K3s uses containerd.

Export backend:

```bash
docker save \
  smallsteps-backend:1.0 \
  -o /tmp/smallsteps-backend.tar
```

Export frontend:

```bash
docker save \
  smallsteps-frontend:1.0 \
  -o /tmp/smallsteps-frontend.tar
```

Import backend:

```bash
sudo k3s ctr -n k8s.io images import \
  /tmp/smallsteps-backend.tar
```

Import frontend:

```bash
sudo k3s ctr -n k8s.io images import \
  /tmp/smallsteps-frontend.tar
```

Verify:

```bash
sudo k3s ctr -n k8s.io images list | grep smallsteps
```

You should see:

```text
smallsteps-backend:1.0
smallsteps-frontend:1.0
```

---

# 34. Deployment Order

Deploy the application in this order:

```text
1. Namespace
       |
       v
2. ConfigMap + Secret
       |
       v
3. MongoDB StatefulSet + PVC
       |
       v
4. Backend Deployment + Service
       |
       v
5. Frontend Deployment + Service
       |
       v
6. NGINX Ingress
       |
       v
7. Smoke Test Job
       |
       v
8. MongoDB CronJob
       |
       v
9. HPA
```

---

# 35. Step 1 — Namespace

```bash
kubectl apply -f k8s/00-namespace.yaml
```

Verify:

```bash
kubectl get ns smallsteps
```

---

# 36. Step 2 — ConfigMap and Secret

```bash
kubectl apply -f k8s/01-configmap-secret.yaml
```

Verify:

```bash
kubectl get configmap -n smallsteps
```

```bash
kubectl get secret -n smallsteps
```

---

# 37. Step 3 — MongoDB

```bash
kubectl apply -f k8s/02-mongodb-statefulset.yaml
```

Watch:

```bash
kubectl get pods -n smallsteps -w
```

Wait until:

```text
mongodb-0   1/1   Running
```

Press:

```text
CTRL+C
```

Check PVC:

```bash
kubectl get pvc -n smallsteps
```

Expected:

```text
mongodb-data-mongodb-0   Bound   2Gi
```

Check PV:

```bash
kubectl get pv
```

---

# 38. Step 4 — Backend

```bash
kubectl apply -f k8s/03-backend-deployment.yaml
```

Check:

```bash
kubectl get pods -n smallsteps -l app=backend
```

Wait:

```bash
kubectl rollout status deployment/backend -n smallsteps
```

Expected:

```text
2/2 pods Running
```

Check Service:

```bash
kubectl get svc backend-service -n smallsteps
```

---

# 39. Step 5 — Frontend

```bash
kubectl apply -f k8s/04-frontend-deployment.yaml
```

Check:

```bash
kubectl get pods -n smallsteps -l app=frontend
```

Wait:

```bash
kubectl rollout status deployment/frontend -n smallsteps
```

Check Service:

```bash
kubectl get svc frontend-service -n smallsteps
```

---

# 40. Step 6 — Ingress

Apply:

```bash
kubectl apply -f k8s/05-ingress.yaml
```

Check:

```bash
kubectl get ingress -n smallsteps
```

Describe:

```bash
kubectl describe ingress smallsteps-ingress -n smallsteps
```

---

# 41. Configure VM DNS

Find the VM IP:

```bash
hostname -I
```

Example:

```text
192.168.107.198
```

Use your actual VM IP.

---

# 42. Windows Hosts File

If the browser is running on Windows:

Open:

```text
C:\Windows\System32\drivers\etc\hosts
```

Run Notepad as Administrator.

Add:

```text
192.168.107.198 smallsteps.local
```

Replace the example IP with the actual VM IP.

Save the file.

---

# 43. Test DNS

From Windows CMD:

```cmd
ping smallsteps.local
```

You should see something similar to:

```text
Pinging smallsteps.local [192.168.107.198]
```

The important part is that the hostname resolves to the VM IP.

---

# 44. Step 7 — Application Testing

## Check all resources

```bash
kubectl get all -n smallsteps
```

Check PVC:

```bash
kubectl get pvc -n smallsteps
```

Check Ingress:

```bash
kubectl get ingress -n smallsteps
```

Check Jobs:

```bash
kubectl get jobs -n smallsteps
```

Check CronJobs:

```bash
kubectl get cronjobs -n smallsteps
```

Check HPA:

```bash
kubectl get hpa -n smallsteps
```

---

# 45. Test Backend Directly

Use port-forward:

```bash
kubectl port-forward \
  svc/backend-service \
  3000:3000 \
  -n smallsteps
```

From another terminal:

```bash
curl http://127.0.0.1:3000/api/health
```

Expected:

```text
HTTP 200
```

Stop port-forward:

```text
CTRL+C
```

---

# 46. Test Frontend Directly

Run:

```bash
kubectl port-forward \
  svc/frontend-service \
  8080:80 \
  -n smallsteps
```

Open:

```text
http://localhost:8080
```

Stop:

```text
CTRL+C
```

---

# 47. Test Internal Kubernetes DNS

Create a temporary curl Pod:

```bash
kubectl run test-client \
  -n smallsteps \
  --image=curlimages/curl:8.10.1 \
  --rm \
  -it \
  -- sh
```

Inside the Pod:

```bash
curl http://backend-service:3000/api/health
```

Then:

```bash
curl http://frontend-service/nginx-health
```

Exit:

```bash
exit
```

This proves Kubernetes Service discovery works.

---

# 48. Test MongoDB DNS

Run:

```bash
kubectl run dns-test \
  -n smallsteps \
  --image=busybox:1.36 \
  --rm \
  -it \
  -- sh
```

Inside:

```bash
nslookup mongodb-0.mongodb-headless.smallsteps.svc.cluster.local
```

Exit:

```bash
exit
```

---

# 49. Test Ingress from the VM

Find VM IP:

```bash
hostname -I
```

Then:

```bash
curl \
  -H "Host: smallsteps.local" \
  http://YOUR_VM_IP/
```

Test API:

```bash
curl \
  -H "Host: smallsteps.local" \
  http://YOUR_VM_IP/api/health
```

Replace:

```text
YOUR_VM_IP
```

with the real VM IP.

---

# 50. Test from Browser

Open:

```text
http://smallsteps.local
```

The request flow is:

```text
Windows Browser
       |
       v
smallsteps.local
       |
       v
K3s VM
       |
       v
NGINX Ingress Controller
       |
       +--------------------+
       |                    |
       v                    v
   frontend-service     backend-service
       |                    |
       v                    v
    NGINX Pods          Node.js Pods
                            |
                            v
                         MongoDB
```

---

# 51. Check Logs

Backend:

```bash
kubectl logs deployment/backend -n smallsteps
```

Frontend:

```bash
kubectl logs deployment/frontend -n smallsteps
```

MongoDB:

```bash
kubectl logs mongodb-0 -n smallsteps
```

NGINX Ingress:

```bash
kubectl logs \
  -n ingress-nginx \
  deployment/ingress-nginx-controller
```

---

# 52. Check Pod Details

List Pods:

```bash
kubectl get pods -n smallsteps -o wide
```

Describe backend Pod:

```bash
kubectl describe pod \
  $(kubectl get pod -n smallsteps -l app=backend -o jsonpath='{.items[0].metadata.name}') \
  -n smallsteps
```

Describe MongoDB:

```bash
kubectl describe pod mongodb-0 -n smallsteps
```

---

# 53. Test StatefulSet Persistence

Check MongoDB:

```bash
kubectl get pod mongodb-0 -n smallsteps
```

Delete the Pod:

```bash
kubectl delete pod mongodb-0 -n smallsteps
```

Watch:

```bash
kubectl get pods -n smallsteps -w
```

Kubernetes will recreate:

```text
mongodb-0
```

Check PVC:

```bash
kubectl get pvc -n smallsteps
```

The PVC should remain:

```text
Bound
```

This demonstrates the difference between:

```text
Deployment
```

and:

```text
StatefulSet
```

---

# 54. Test Backend Rolling Update

Build another image:

```bash
docker build \
  -f docker/Dockerfile \
  --target backend \
  -t smallsteps-backend:1.1 \
  .
```

Export:

```bash
docker save \
  smallsteps-backend:1.1 \
  -o /tmp/smallsteps-backend-1.1.tar
```

Import into K3s:

```bash
sudo k3s ctr -n k8s.io images import \
  /tmp/smallsteps-backend-1.1.tar
```

Change:

```yaml
image: smallsteps-backend:1.0
```

to:

```yaml
image: smallsteps-backend:1.1
```

Then:

```bash
kubectl apply -f k8s/03-backend-deployment.yaml
```

Watch:

```bash
kubectl get pods -n smallsteps -l app=backend -w
```

Check:

```bash
kubectl rollout status deployment/backend -n smallsteps
```

---

# 55. Roll Back a Deployment

View history:

```bash
kubectl rollout history deployment/backend -n smallsteps
```

Rollback:

```bash
kubectl rollout undo deployment/backend -n smallsteps
```

Check:

```bash
kubectl rollout status deployment/backend -n smallsteps
```

---

# 56. Verify HPA

Run:

```bash
kubectl get hpa -n smallsteps
```

Detailed:

```bash
kubectl describe hpa backend-hpa -n smallsteps
```

Check metrics:

```bash
kubectl top pods -n smallsteps
```

The backend starts with:

```text
2 replicas
```

and can scale up to:

```text
5 replicas
```

according to CPU utilization.

---

# 57. Debugging Cheat Sheet

| Task | Command |
|---|---|
| Nodes | `kubectl get nodes -o wide` |
| All resources | `kubectl get all -n smallsteps` |
| Pods | `kubectl get pods -n smallsteps` |
| Pods + IP | `kubectl get pods -n smallsteps -o wide` |
| Services | `kubectl get svc -n smallsteps` |
| Endpoints | `kubectl get endpoints -n smallsteps` |
| Deployments | `kubectl get deployments -n smallsteps` |
| StatefulSets | `kubectl get sts -n smallsteps` |
| PVCs | `kubectl get pvc -n smallsteps` |
| PVs | `kubectl get pv` |
| StorageClasses | `kubectl get storageclass` |
| Ingress | `kubectl get ingress -n smallsteps` |
| Ingress details | `kubectl describe ingress -n smallsteps` |
| Jobs | `kubectl get jobs -n smallsteps` |
| CronJobs | `kubectl get cronjobs -n smallsteps` |
| HPA | `kubectl get hpa -n smallsteps` |
| Backend logs | `kubectl logs deployment/backend -n smallsteps` |
| Frontend logs | `kubectl logs deployment/frontend -n smallsteps` |
| MongoDB logs | `kubectl logs mongodb-0 -n smallsteps` |
| Ingress logs | `kubectl logs -n ingress-nginx deployment/ingress-nginx-controller` |
| Pod details | `kubectl describe pod POD_NAME -n smallsteps` |
| Events | `kubectl get events -n smallsteps --sort-by=.lastTimestamp` |
| CPU/Memory | `kubectl top pods -n smallsteps` |

---

# 58. Common Problems

## Problem: `ImagePullBackOff`

Check:

```bash
kubectl describe pod POD_NAME -n smallsteps
```

Verify image:

```bash
sudo k3s ctr -n k8s.io images list | grep smallsteps
```

If missing, import again:

```bash
sudo k3s ctr -n k8s.io images import /tmp/smallsteps-backend.tar
```

or:

```bash
sudo k3s ctr -n k8s.io images import /tmp/smallsteps-frontend.tar
```

---

# 59. Backend CrashLoopBackOff

Check:

```bash
kubectl logs deployment/backend -n smallsteps
```

Then:

```bash
kubectl describe pod POD_NAME -n smallsteps
```

Check the Secret:

```bash
kubectl get secret smallsteps-secret -n smallsteps
```

Typical causes:

```text
Wrong MongoDB URI
Wrong JWT_SECRET
MongoDB unavailable
Node.js application error
Missing dependency
Application listening only on localhost
```

---

# 60. MongoDB Not Ready

Check:

```bash
kubectl get pvc -n smallsteps
```

The PVC must be:

```text
Bound
```

Check logs:

```bash
kubectl logs mongodb-0 -n smallsteps
```

Check:

```bash
kubectl describe pod mongodb-0 -n smallsteps
```

---

# 61. Ingress Not Working

Check controller:

```bash
kubectl get pods -n ingress-nginx
```

Check Service:

```bash
kubectl get svc -n ingress-nginx
```

Check Ingress:

```bash
kubectl get ingress -n smallsteps
```

Check class:

```bash
kubectl get ingressclass
```

Check configuration:

```bash
kubectl describe ingress smallsteps-ingress -n smallsteps
```

Check controller logs:

```bash
kubectl logs \
  -n ingress-nginx \
  deployment/ingress-nginx-controller
```

---

# 62. `smallsteps.local` Does Not Open

Check Windows hosts:

```text
C:\Windows\System32\drivers\etc\hosts
```

Make sure:

```text
YOUR_VM_IP smallsteps.local
```

exists.

Test:

```cmd
ping smallsteps.local
```

Then test the VM directly:

```bash
curl \
  -H "Host: smallsteps.local" \
  http://YOUR_VM_IP/api/health
```

If the `curl` command works but the browser does not, the problem is likely on the Windows DNS/hosts side.

---

# 63. Check K3s Service

```bash
sudo systemctl status k3s --no-pager
```

Check logs:

```bash
sudo journalctl -u k3s -n 100 --no-pager
```

---

# 64. Complete Verification

Run:

```bash
kubectl get nodes
```

```bash
kubectl get pods -n ingress-nginx
```

```bash
kubectl get all -n smallsteps
```

```bash
kubectl get pvc -n smallsteps
```

```bash
kubectl get ingress -n smallsteps
```

```bash
kubectl get jobs -n smallsteps
```

```bash
kubectl get cronjobs -n smallsteps
```

```bash
kubectl get hpa -n smallsteps
```

Then:

```bash
curl \
  -H "Host: smallsteps.local" \
  http://YOUR_VM_IP/api/health
```

Finally:

```text
http://smallsteps.local
```

---

# 65. Teardown

Delete the application resources:

```bash
kubectl delete -f k8s/08-backend-hpa.yaml
```

```bash
kubectl delete -f k8s/07-mongodb-backup-cronjob.yaml
```

```bash
kubectl delete -f k8s/06-smoke-test-job.yaml
```

```bash
kubectl delete -f k8s/05-ingress.yaml
```

```bash
kubectl delete -f k8s/04-frontend-deployment.yaml
```

```bash
kubectl delete -f k8s/03-backend-deployment.yaml
```

```bash
kubectl delete -f k8s/02-mongodb-statefulset.yaml
```

```bash
kubectl delete -f k8s/01-configmap-secret.yaml
```

```bash
kubectl delete -f k8s/00-namespace.yaml
```

Or simply delete the entire namespace:

```bash
kubectl delete namespace smallsteps
```

Check:

```bash
kubectl get namespace smallsteps
```

Expected:

```text
Error from server (NotFound)
```

---

# 66. Remove NGINX Ingress Controller

If you want to remove NGINX:

```bash
helm uninstall ingress-nginx \
  -n ingress-nginx
```

Then:

```bash
kubectl delete namespace ingress-nginx
```

---

# 67. Restore Traefik

This is optional.

For this lab, keep NGINX Ingress.

If you want to restore the K3s default Traefik:

Edit:

```bash
sudo nano /etc/rancher/k3s/config.yaml
```

Remove:

```yaml
disable:
  - traefik
```

Then:

```bash
sudo systemctl restart k3s
```

Verify:

```bash
kubectl get pods -n kube-system | grep traefik
```

---

# 68. Final Architecture

The completed project looks like this:

```text
                           INTERNET / LAN
                                |
                                |
                         smallsteps.local
                                |
                                v
                 +---------------------------+
                 | NGINX INGRESS CONTROLLER  |
                 |                           |
                 | HTTP :80                  |
                 | HTTPS :443                |
                 +-------------+-------------+
                               |
                +--------------+--------------+
                |                             |
              /api                            /
                |                             |
                v                             v
       +------------------+          +------------------+
       | backend-service  |          | frontend-service |
       | ClusterIP :3000  |          | ClusterIP :80   |
       +--------+---------+          +--------+---------+
                |                             |
                v                             v
       +------------------+          +------------------+
       | Backend          |          | NGINX            |
       | Deployment       |          | Deployment       |
       |                  |          |                  |
       | backend-xxxx     |          | frontend-xxxx    |
       | backend-yyyy     |          | frontend-yyyy    |
       +--------+---------+          +------------------+
                |
                |
                v
       +-------------------------+
       | mongodb-headless        |
       | Headless Service        |
       +------------+------------+
                    |
                    v
       +-------------------------+
       | MongoDB StatefulSet     |
       |                         |
       | mongodb-0               |
       +------------+------------+
                    |
                    v
       +-------------------------+
       | mongodb-data PVC        |
       |                         |
       | 2Gi                     |
       | local-path               |
       +-------------------------+


       +-------------------------+
       | Kubernetes Job          |
       | Smoke Test              |
       +-------------------------+

       +-------------------------+
       | Kubernetes CronJob      |
       | MongoDB Backup          |
       +-------------------------+

       +-------------------------+
       | HPA                     |
       | Backend 2 -> 5 Pods     |
       +-------------------------+
```

---

# 69. Kubernetes Topics Covered

This project intentionally covers the most useful Kubernetes concepts for this application:

| Topic | Used? | Purpose |
|---|---|---|
| Namespace | Yes | Application isolation |
| ConfigMap | Yes | Non-sensitive configuration |
| Secret | Yes | Credentials |
| Deployment | Yes | Stateless application |
| StatefulSet | Yes | MongoDB |
| PVC | Yes | MongoDB persistence |
| StorageClass | Yes | K3s `local-path` |
| Headless Service | Yes | Stateful MongoDB DNS |
| ClusterIP | Yes | Internal services |
| Ingress | Yes | External HTTP routing |
| NGINX Ingress | Yes | External access |
| Liveness Probe | Yes | Detect unhealthy containers |
| Readiness Probe | Yes | Control traffic |
| Startup Probe | Yes | Slow startup handling |
| Rolling Update | Yes | Zero/minimal downtime deployment |
| Job | Yes | One-time smoke test |
| CronJob | Yes | Scheduled backup |
| HPA | Yes | Backend autoscaling |
| Kubernetes DNS | Yes | Service discovery |
| Traefik | Disabled | Replaced by NGINX |
| DaemonSet | No | Not required |
| RBAC | No | Not required for this application |
| NetworkPolicy | No | Not required for this simple lab |
| Service Mesh | No | Unnecessary complexity |
| Operators | No | Unnecessary complexity |

---

# 70. Final Learning Flow

The complete DevOps flow is:

```text
Developer
    |
    v
Node.js Application
    |
    v
Dockerfile
    |
    v
Docker Images
    |
    v
K3s containerd
    |
    v
Kubernetes Namespace
    |
    +-----------------------+
    |                       |
    v                       v
ConfigMap                Secret
    |                       |
    +-----------+-----------+
                |
                v
        Kubernetes Workloads
                |
        +-------+-------+
        |       |       |
        v       v       v
      Mongo   Backend  Frontend
      Stateful Deployment Deployment
        |       |       |
        |       |       |
        |       +---+---+
        |           |
        v           v
       PVC       Services
                    |
                    v
              NGINX Ingress
                    |
                    v
             smallsteps.local
                    |
                    v
                 Browser
```

---

# 71. Final Commands — Quick Deployment

After all files are created and Docker images are available:

```bash
# 1. Disable Traefik
sudo nano /etc/rancher/k3s/config.yaml

# Add:
# disable:
#   - traefik

sudo systemctl restart k3s

# 2. Install NGINX Ingress
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update

helm install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx \
  --create-namespace

# 3. Build images
docker build \
  -f docker/Dockerfile \
  --target backend \
  -t smallsteps-backend:1.0 \
  .

docker build \
  -f docker/Dockerfile \
  --target frontend \
  -t smallsteps-frontend:1.0 \
  .

# 4. Import images into K3s
docker save smallsteps-backend:1.0 \
  -o /tmp/smallsteps-backend.tar

docker save smallsteps-frontend:1.0 \
  -o /tmp/smallsteps-frontend.tar

sudo k3s ctr -n k8s.io images import \
  /tmp/smallsteps-backend.tar

sudo k3s ctr -n k8s.io images import \
  /tmp/smallsteps-frontend.tar

# 5. Deploy application
kubectl apply -f k8s/00-namespace.yaml

kubectl apply -f k8s/01-configmap-secret.yaml

kubectl apply -f k8s/02-mongodb-statefulset.yaml

kubectl apply -f k8s/03-backend-deployment.yaml

kubectl apply -f k8s/04-frontend-deployment.yaml

kubectl apply -f k8s/05-ingress.yaml

kubectl apply -f k8s/06-smoke-test-job.yaml

kubectl apply -f k8s/07-mongodb-backup-cronjob.yaml

kubectl apply -f k8s/08-backend-hpa.yaml

# 6. Verify
kubectl get pods -n smallsteps

kubectl get svc -n smallsteps

kubectl get pvc -n smallsteps

kubectl get ingress -n smallsteps

kubectl get jobs -n smallsteps

kubectl get cronjobs -n smallsteps

kubectl get hpa -n smallsteps
```

Then configure the client machine:

```text
YOUR_VM_IP smallsteps.local
```

and open:

```text
http://smallsteps.local
```

---

# 72. Result

The final application is a simple but complete Kubernetes project:

```text
Docker
  |
  v
K3s
  |
  +-- Namespace
  |
  +-- ConfigMap
  |
  +-- Secret
  |
  +-- MongoDB StatefulSet
  |      |
  |      +-- Headless Service
  |      |
  |      +-- 2Gi PVC
  |             |
  |             +-- local-path
  |
  +-- Backend Deployment
  |      |
  |      +-- 2 replicas
  |      +-- Health Probes
  |      +-- Rolling Updates
  |      +-- HPA
  |
  +-- Frontend Deployment
  |      |
  |      +-- NGINX
  |      +-- 2 replicas
  |
  +-- Job
  |      |
  |      +-- Smoke Test
  |
  +-- CronJob
  |      |
  |      +-- MongoDB Backup
  |
  +-- NGINX Ingress
         |
         +-- /
         |
         +-- /api
```

The design deliberately stays simple while demonstrating the Kubernetes concepts that are most useful for a real full-stack application.
