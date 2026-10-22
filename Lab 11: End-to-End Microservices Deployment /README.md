# Lab 11: Mental Health Booking App on K3s with NGINX Ingress

This lab migrates the **Mental Health Booking App** from Docker Compose to Kubernetes using **K3s** and **NGINX Ingress Controller**.

The project keeps the architecture simple while demonstrating important Kubernetes concepts:

- Docker multi-stage builds
- K3s
- Namespace
- ConfigMap
- Secret
- Deployment
- StatefulSet
- PersistentVolumeClaim
- K3s `local-path` StorageClass
- Headless Service
- ClusterIP Service
- Kubernetes Job
- Kubernetes CronJob
- Liveness, Readiness and Startup Probes
- Rolling Updates
- Horizontal Pod Autoscaling
- NGINX
- NGINX Ingress Controller
- Kubernetes DNS
- `/etc/hosts`

---

# 1. Architecture

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
       | ClusterIP :3000  |   | ClusterIP :80    |
       +--------+---------+   +--------+---------+
                |                      |
                v                      v
       +------------------+   +------------------+
       | Backend Pods     |   | NGINX Pods       |
       | Deployment       |   | Deployment       |
       | 2 replicas       |   | 2 replicas       |
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
```

### Request Flow

```text
Browser
   |
   v
NGINX Ingress
   |
   +---- / ------------> frontend-service:80
   |
   +---- /api ---------> backend-service:3000
                              |
                              v
                       mongodb-headless
                              |
                              v
                           MongoDB
```

---

# 2. Application

The original application contains:

```text
mental-health-booking-app/
├── public/
├── src/
│   └── server.js
├── docker/
│   ├── Dockerfile
│   └── nginx.conf
├── k8s/
├── .env.example
├── docker-compose.yml
├── package.json
├── package-lock.json
└── README.md
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

### Application Ports

| Component | Port |
|---|---:|
| NGINX | 80 |
| Node.js / Express | 3000 |
| MongoDB | 27017 |

### API Endpoints

```text
/api/auth/*
/api/doctors
/api/bookings
/api/health
```

---

# 3. Final Project Structure

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

| Component | Resource | Port | Exposure | Storage |
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

# 5. Docker Configuration

## 5.1 Multi-Stage Dockerfile

File:

```text
docker/Dockerfile
```

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

# 6. NGINX Configuration

File:

```text
docker/nginx.conf
```

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

# 7. Kubernetes Files

The Kubernetes manifests remain unchanged.

```text
k8s/
├── 00-namespace.yaml
├── 01-configmap-secret.yaml
├── 02-mongodb-statefulset.yaml
├── 03-backend-deployment.yaml
├── 04-frontend-deployment.yaml
├── 05-ingress.yaml
├── 06-smoke-test-job.yaml
├── 07-mongodb-backup-cronjob.yaml
└── 08-backend-hpa.yaml
```

---

# 8. Namespace

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

---

# 9. ConfigMap and Secret

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

---

# 10. MongoDB StatefulSet

MongoDB uses a **StatefulSet** because it is a stateful workload and requires persistent storage.

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

Verify:

```bash
kubectl get pods -n smallsteps
kubectl get pvc -n smallsteps
```

Expected:

```text
mongodb-0   1/1   Running
```

and:

```text
mongodb-data-mongodb-0   Bound   2Gi
```

---

# 11. Backend Deployment

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

Verify:

```bash
kubectl get pods -n smallsteps -l app=backend
kubectl rollout status deployment/backend -n smallsteps
```

---

# 12. Frontend NGINX Deployment

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

Verify:

```bash
kubectl get pods -n smallsteps -l app=frontend
kubectl rollout status deployment/frontend -n smallsteps
```

---

# 13. NGINX Ingress

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

Verify:

```bash
kubectl get ingress -n smallsteps
```

---

# 14. Kubernetes Job

The Job performs a simple smoke test for the backend and frontend.

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

Logs:

```bash
kubectl logs job/smallsteps-smoke-test -n smallsteps
```

---

# 15. MongoDB CronJob

The CronJob demonstrates scheduled Kubernetes workloads.

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

Verify:

```bash
kubectl get cronjobs -n smallsteps
```

---

# 16. Backend HPA

The existing project includes an HPA for the backend.

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

Verify:

```bash
kubectl get hpa -n smallsteps
```

---

# 17. Prepare the K3s VM

Check K3s:

```bash
k3s --version
```

Check the Kubernetes node:

```bash
kubectl get nodes -o wide
```

Check the K3s storage:

```bash
kubectl get storageclass
```

Expected:

```text
local-path (default)
```

The MongoDB PVC uses this StorageClass.

---

# 18. Disable Traefik

K3s normally installs Traefik as its default Ingress Controller.

This lab uses **NGINX Ingress Controller** instead.

Create the configuration directory if needed:

```bash
sudo mkdir -p /etc/rancher/k3s
```

Open:

```bash
sudo nano /etc/rancher/k3s/config.yaml
```

Add:

```yaml
disable:
  - traefik
```

Restart K3s:

```bash
sudo systemctl restart k3s
```

Verify:

```bash
kubectl get pods -n kube-system
```

---

# 19. Install NGINX Ingress Controller

Add the Helm repository:

```bash
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
```

Update:

```bash
helm repo update
```

Install:

```bash
helm install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx \
  --create-namespace
```

Check:

```bash
kubectl get pods -n ingress-nginx
```

Check the Ingress Class:

```bash
kubectl get ingressclass
```

Expected:

```text
nginx
```

---

# 20. Build the Docker Images

Go to the project directory:

```bash
cd mental-health-booking-app
```

Build the backend:

```bash
docker build \
  -f docker/Dockerfile \
  --target backend \
  -t smallsteps-backend:1.0 \
  .
```

Build the frontend:

```bash
docker build \
  -f docker/Dockerfile \
  --target frontend \
  -t smallsteps-frontend:1.0 \
  .
```

Verify:

```bash
docker images | grep smallsteps
```

Expected:

```text
smallsteps-backend
smallsteps-frontend
```

---

# 21. Import Images into K3s

K3s uses `containerd`, so the Docker images must be imported.

Export the backend:

```bash
docker save smallsteps-backend:1.0 \
  -o /tmp/smallsteps-backend.tar
```

Export the frontend:

```bash
docker save smallsteps-frontend:1.0 \
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

---

# 22. Deploy the Application

Apply the manifests in this order:

```bash
kubectl apply -f k8s/00-namespace.yaml

kubectl apply -f k8s/01-configmap-secret.yaml

kubectl apply -f k8s/02-mongodb-statefulset.yaml

kubectl apply -f k8s/03-backend-deployment.yaml

kubectl apply -f k8s/04-frontend-deployment.yaml

kubectl apply -f k8s/05-ingress.yaml

kubectl apply -f k8s/06-smoke-test-job.yaml

kubectl apply -f k8s/07-mongodb-backup-cronjob.yaml

kubectl apply -f k8s/08-backend-hpa.yaml
```

---

# 23. Verify the Deployment

Check Pods:

```bash
kubectl get pods -n smallsteps
```

Check Services:

```bash
kubectl get svc -n smallsteps
```

Check StatefulSet:

```bash
kubectl get statefulset -n smallsteps
```

Check PVC:

```bash
kubectl get pvc -n smallsteps
```

Check Ingress:

```bash
kubectl get ingress -n smallsteps
```

Check Job:

```bash
kubectl get jobs -n smallsteps
```

Check CronJob:

```bash
kubectl get cronjobs -n smallsteps
```

Check HPA:

```bash
kubectl get hpa -n smallsteps
```

Or check everything together:

```bash
kubectl get all -n smallsteps
```

---

# 24. Configure Local DNS

Find the VM IP:

```bash
hostname -I
```

Example:

```text
192.168.107.200
```

On the Windows host machine, open:

```text
C:\Windows\System32\drivers\etc\hosts
```

Run Notepad as Administrator and add:

```text
192.168.107.200 smallsteps.local
```

Replace the IP with the actual VM IP.

Test:

```cmd
ping smallsteps.local
```

---

# 25. Test the Application

Open:

```text
http://smallsteps.local
```

Test the API:

```text
http://smallsteps.local/api/health
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
NGINX Ingress
      |
      +----------------------+
      |                      |
      v                      v
frontend-service        backend-service
      |                      |
      v                      v
 NGINX Pods             Node.js Pods
                              |
                              v
                           MongoDB
```

---

# 26. Verify the Smoke Test

Check:

```bash
kubectl get jobs -n smallsteps
```

View the logs:

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

# 27. Test StatefulSet Persistence

Check MongoDB:

```bash
kubectl get pod mongodb-0 -n smallsteps
```

Delete the MongoDB Pod:

```bash
kubectl delete pod mongodb-0 -n smallsteps
```

Watch:

```bash
kubectl get pods -n smallsteps -w
```

Kubernetes recreates:

```text
mongodb-0
```

Check the PVC:

```bash
kubectl get pvc -n smallsteps
```

The PVC should remain:

```text
Bound
```

This demonstrates the main difference between:

```text
Deployment
```

and:

```text
StatefulSet
```

---

# 28. Useful Logs

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

# 29. Basic Troubleshooting

### Check Pods

```bash
kubectl get pods -n smallsteps
```

### Check Pod details

```bash
kubectl describe pod POD_NAME -n smallsteps
```

### Check events

```bash
kubectl get events \
  -n smallsteps \
  --sort-by=.lastTimestamp
```

### Check images

```bash
sudo k3s ctr -n k8s.io images list | grep smallsteps
```

### Check Ingress

```bash
kubectl get ingress -n smallsteps
```

### Check Ingress Controller

```bash
kubectl get pods -n ingress-nginx
```

### Check application logs

```bash
kubectl logs deployment/backend -n smallsteps
```

---

# 30. Cleanup

Delete the complete application namespace:

```bash
kubectl delete namespace smallsteps
```

Remove NGINX Ingress if required:

```bash
helm uninstall ingress-nginx -n ingress-nginx
```

Then:

```bash
kubectl delete namespace ingress-nginx
```

---

# 31. Restore Traefik

This step is optional.

If you want to restore the K3s default Traefik, edit:

```bash
sudo nano /etc/rancher/k3s/config.yaml
```

Remove:

```yaml
disable:
  - traefik
```

Restart K3s:

```bash
sudo systemctl restart k3s
```

Verify:

```bash
kubectl get pods -n kube-system | grep traefik
```

---

# 32. Final Architecture

```text
                         INTERNET / LAN
                              |
                       smallsteps.local
                              |
                              v
                +---------------------------+
                | NGINX INGRESS CONTROLLER  |
                |                           |
                | HTTP :80                 |
                | HTTPS :443               |
                +-------------+-------------+
                              |
                 +------------+------------+
                 |                         |
               /api                        /
                 |                         |
                 v                         v
        +------------------+      +------------------+
        | backend-service  |      | frontend-service |
        | ClusterIP :3000  |      | ClusterIP :80    |
        +--------+---------+      +--------+---------+
                 |                         |
                 v                         v
        +------------------+      +------------------+
        | Backend          |      | NGINX            |
        | Deployment       |      | Deployment       |
        | 2 replicas       |      | 2 replicas       |
        +--------+---------+      +------------------+
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
        | mongodb-0               |
        +------------+------------+
                     |
                     v
        +-------------------------+
        | MongoDB PVC             |
        | 2Gi / local-path        |
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

# 33. Kubernetes Topics Covered

| Topic | Purpose |
|---|---|
| Namespace | Application isolation |
| ConfigMap | Non-sensitive configuration |
| Secret | Credentials |
| Deployment | Stateless application |
| StatefulSet | MongoDB |
| PVC | Persistent MongoDB storage |
| StorageClass | K3s `local-path` |
| Headless Service | Stateful MongoDB DNS |
| ClusterIP | Internal service communication |
| Ingress | External HTTP routing |
| NGINX Ingress | Application entry point |
| Liveness Probe | Detect unhealthy containers |
| Readiness Probe | Control traffic |
| Startup Probe | Handle application startup |
| Rolling Update | Safe application updates |
| Job | One-time smoke test |
| CronJob | Scheduled MongoDB backup |
| HPA | Backend autoscaling |
| Kubernetes DNS | Service discovery |
| Traefik | Disabled and replaced by NGINX |

---

# 34. Final Deployment Flow

```text
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
    +-------------------+
    |                   |
    v                   v
 ConfigMap            Secret
    |                   |
    +---------+---------+
              |
              v
       Kubernetes Workloads
              |
       +------+------+------+
       |      |      |      |
       v      v      v      v
     Mongo  Backend Frontend Job
       |      |      |
       |      |      |
       v      v      v
      PVC   Services NGINX
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

# 35. Result

The final project provides a simple full-stack Kubernetes architecture running on a K3s VM.

The application uses:

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
   |      +-- Rolling Update
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

The architecture stays simple while demonstrating the major Kubernetes concepts required for this lab.
