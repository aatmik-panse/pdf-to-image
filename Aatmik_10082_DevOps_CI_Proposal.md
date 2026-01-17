# DevOps CI/CD Project Proposal

**Student Name:** Aatmik Panse
**Scaler Student ID:** 10082
**Date:** 2026-01-15

---

## 1. Project Title
**PDF to Image Converter API CI/CD Pipeline**

## 2. GitHub Repository URL
`https://github.com/aatmik-panse/pdf-to-image`

## 3. Application Description
The **PDF to Image Converter API** is a high-performance, stateless microservice built with **Bun** (TypeScript) that converts PDF documents into high-quality JPG or PNG images.

**Key Features:**
*   **Core Logic**: Utilizes `pdftoppm` (Poppler) for efficient image processing.
*   **Architecture**: REST API (Express-compatible) and CLI tool.
*   **Storage**: Integrated with Google Cloud Storage (GCS) for stateless file handling, making it suitable for auto-scaling environments like **Kubernetes** (primary target).
*   **Containerization**: Fully containerized using Docker for consistent runtime environments.

## 4. CI/CD Problem Statement
In the current development workflow, several risks and inefficiencies exist:
*   **Manual Validation**: Code style checks and tests are run manually, leading to potential human error and inconsistent code quality.
*   **Security Gaps**: Dependencies and container base images are not automatically scanned for vulnerabilities, increasing supply chain risks.
*   **Deployment Reliability**: Docker images are built and pushed manually, which can result in "works on my machine" issues and untrusted artifacts in production.
*   **Technical Debt**: specialized linting and static analysis rules are not enforced on every commit.

**Goal**: To implement a production-grade CI/CD pipeline that automates the verification, security scanning, and packaging of the application, ensuring that only trusted, secure, and tested code is deployed.

## 5. Chosen CI/CD Stages & Justification

The pipeline will be implemented using **GitHub Actions** and includes the following distinct stages:

### Phase 1: Continuous Integration (CI) - Verification
**Triggers**:
*   Push to `main` branch
*   Manual execution via `workflow_dispatch`

| Stage | Tool | Justification |
| :--- | :--- | :--- |
| **Checkout** | `actions/checkout` | Retrieves the source code for the workflow. |
| **Setup Runtime** | `oven-sh/setup-bun` | Sets up the Bun runtime environment to install dependencies and run scripts. |
| **Linting** | `ESLint` | Enforces coding standards (TypeScript), ensuring consistency and preventing technical debt. Fails the build on style violations. |
| **Unit Tests** | `bun test` | Validates the business logic (e.g., PDF conversion util, GCS storage logic). Prevents regressions by ensuring new changes don't break existing features. |

### Phase 2: DevSecOps - Security (Shift-Left)
| Stage | Tool | Justification |
| :--- | :--- | :--- |
| **SAST (Static Analysis)** | **CodeQL** | Scans the source code for deep security vulnerabilities (e.g., injection flaws) without executing the code. Detects OWASP Top 10 issues early. |
| **SCA (Dependency)** | **Trivy** (fs mode) | Scans `package.json` and `bun.lock` for known CVEs in third-party libraries to prevent supply-chain attacks. |

### Phase 3: Build & Delivery (CD)
| Stage | Tool | Justification |
| :--- | :--- | :--- |
| **Docker Build** | `docker build` | Packages the application and its system dependencies (Poppler) into an immutable artifact. |
| **Container Scan** | **Trivy** (image mode) | Scans the built Docker image for OS-level vulnerabilities (e.g., in Debian/Alpine base) that code scans might miss. Ensures no vulnerable OS packages are shipped. |
| **Smoke Test** | `docker run` + `curl` | Temporarily spins up the built container and hits the `/health` endpoint. Ensures the application *actually starts* and listens on the correct port before pushing. |
| **Docker Push** | `docker push` | Publishes the verified, secure, and tested image to Docker Hub, ready for deployment. |

### Phase 4: Continuous Deployment (CD) - Kubernetes
| Stage | Tool | Justification |
| :--- | :--- | :--- |
| **Manifest Update** | `kustomize` / `envsubst` | Updates the Kubernetes deployment manifest with the new Docker image tag. |
| **Deploy** | `kubectl apply` | Applies the updated manifest to the Kubernetes cluster, triggering a rolling update. |
| **Rollout Status** | `kubectl rollout status` | Verifies that the deployment successfully rolled out and the new pods are healthy. |

## 6. Expected Outcomes
1.  **Automated Quality Gate**: Commits with failing tests or linting errors are automatically rejected.
2.  **Enhanced Security**: Vulnerabilities in code, dependencies, or the base OS are detected immediately, preventing insecure artifacts from reaching production.
3.  **Reliable Artifacts**: Every image in Docker Hub is guaranteed to have passed all functional and security checks.
4.  **Zero-Downtime Deployment**: Automated rolling updates to Kubernetes ensure high availability during releases.
5.  **Standardization**: The build and deployment process is code-defined (IaC), eliminating manual steps and variance.
