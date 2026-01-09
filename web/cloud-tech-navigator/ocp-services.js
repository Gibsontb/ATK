// Copyright Theodore B C Gibson, Cloud Agnostic Architect
// ATK / Cloud Decision Kit - OpenShift (OCP) catalog (tool)
// Version 1.0 (2026-01-09)
//
// NOTE:
// - This is modeled as a TOOL / platform (not a cloud provider).
// - Navigator reads tools via window.CDK.tools.*
//
// This gives you a structured, clickable OCP reference inside Cloud Tech Navigator.
// We can later map OCP items to native cloud services (ROSA/ARO/EKS/AKS, etc.) in the ATK master matrix.

window.CDK = window.CDK || {};
window.CDK.tools = window.CDK.tools || {};

window.CDK.tools.ocp = {
  id: "ocp",
  displayName: "OpenShift (OCP)",
  serviceCategories: {
    // ---------------------------
    // Managed OpenShift offerings
    // ---------------------------
    "managed": {
      label: "Managed OpenShift (Cloud)",
      services: [
        { id: "rosa", name: "ROSA (Red Hat OpenShift Service on AWS)", notes: "Managed OpenShift on AWS (offering/regions vary)." },
        { id: "aro",  name: "ARO (Azure Red Hat OpenShift)",          notes: "Managed OpenShift on Azure (offering/regions vary)." }
      ]
    },

    // ---------------------------
    // Core platform components
    // ---------------------------
    "core": {
      label: "Core Platform",
      services: [
        { id: "cluster", name: "Clusters & Nodes", notes: "Control plane, worker nodes, machine sets, upgrades." },
        { id: "projects", name: "Projects / Namespaces", notes: "Multi-tenancy boundaries for apps and teams." },
        { id: "routes", name: "Routes / Ingress", notes: "OpenShift routing layer (HAProxy-based by default) + ingress controllers." },
        { id: "operators", name: "Operators (OLM)", notes: "Lifecycle management for platform and app components." },
        { id: "registry", name: "Integrated Image Registry", notes: "Internal registry option; often paired with external registries." }
      ]
    },

    // ---------------------------
    // DevOps / App delivery
    // ---------------------------
    "delivery": {
      label: "App Delivery / DevOps",
      services: [
        { id: "pipelines", name: "OpenShift Pipelines (Tekton)", notes: "CI/CD pipelines as Kubernetes-native resources." },
        { id: "gitops", name: "OpenShift GitOps (Argo CD)", notes: "GitOps delivery + drift control." },
        { id: "builds", name: "Builds (S2I / BuildConfig)", notes: "Source-to-Image and build workflows (legacy + modern patterns)." }
      ]
    },

    // ---------------------------
    // Security
    // ---------------------------
    "security": {
      label: "Security",
      services: [
        { id: "rbac", name: "RBAC & SCC", notes: "Roles + Security Context Constraints." },
        { id: "networkpol", name: "Network Policies", notes: "Pod/namespace traffic controls." },
        { id: "secrets", name: "Secrets & Config", notes: "Secrets, config maps, external secret integrations." }
      ]
    },

    // ---------------------------
    // Observability
    // ---------------------------
    "observability": {
      label: "Observability",
      services: [
        { id: "monitoring", name: "Monitoring (Prometheus/Grafana)", notes: "Cluster monitoring stack (operator-managed)." },
        { id: "logging", name: "Logging", notes: "Cluster log aggregation patterns (stack varies by version/choice)." },
        { id: "tracing", name: "Distributed Tracing", notes: "Jaeger/OTel patterns (stack varies by version/choice)." }
      ]
    },

    // ---------------------------
    // Networking & Service Mesh
    // ---------------------------
    "mesh": {
      label: "Networking / Service Mesh",
      services: [
        { id: "servicemesh", name: "OpenShift Service Mesh (Istio)", notes: "Traffic mgmt, mTLS, observability for microservices." },
        { id: "api-gateway", name: "API Gateway Patterns", notes: "Gateway/ingress patterns (native or via addons/tools)." }
      ]
    },

    // ---------------------------
    // Storage
    // ---------------------------
    "storage": {
      label: "Storage",
      services: [
        { id: "pvc", name: "Persistent Volumes (PVC/PV)", notes: "Stateful workloads; CSI integrations with storage backends." },
        { id: "odf", name: "OpenShift Data Foundation (ODF)", notes: "Storage platform option (offering/license dependent)." }
      ]
    }
  }
};
