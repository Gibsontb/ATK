// Copyright Theodore B C Gibson, Cloud Agnostic Architect
// ATK / Cloud Decision Kit - F5 catalog (tool)
// Version 1.0 (2026-01-09)
//
// NOTE:
// - This is NOT a cloud provider catalog.
// - It must register under: window.CDK.tools.f5
// - The Navigator UI reads tools via window.CDK.tools.*
//
// If you need deeper fidelity later (per-product SKUs, cloud marketplace links, etc.)
// we can expand this without changing the schema shape.

window.CDK = window.CDK || {};
window.CDK.tools = window.CDK.tools || {};

window.CDK.tools.f5 = {
  id: "f5",
  displayName: "F5 / BIG-IP / NGINX",
  serviceCategories: {
    // ---------------------------
    // Application Delivery (ADC / LTM)
    // ---------------------------
    "adc-lb": {
      label: "Application Delivery (ADC / Load Balancing)",
      services: [
        { id: "bigip-ltm", name: "BIG-IP LTM (Local Traffic Manager)", notes: "Layer 4/7 load balancing, SSL offload, traffic policies." },
        { id: "bigip-dns", name: "BIG-IP DNS (GTM)", notes: "Global traffic management, DNS-based load balancing, health checks." },
        { id: "bigip-sslo", name: "BIG-IP SSL Orchestrator", notes: "Decrypt/inspect/re-encrypt traffic for security stacks." }
      ]
    },

    // ---------------------------
    // Security (WAF / DDoS / Bot)
    // ---------------------------
    "security": {
      label: "Security (WAF / DDoS / Bot / API)",
      services: [
        { id: "bigip-asm-awaf", name: "BIG-IP Advanced WAF / ASM", notes: "Web application firewall + advanced protections (varies by license)." },
        { id: "bigip-afm", name: "BIG-IP AFM (Advanced Firewall Manager)", notes: "Network firewall, DDoS protections (platform dependent)." },
        { id: "silverline", name: "Silverline (Managed Security Services)", notes: "Managed WAF/DDoS/SOC services (offering dependent)." },
        { id: "shape", name: "Shape Security (Bot & Fraud)", notes: "Bot mitigation / account takeover protection (product family)." }
      ]
    },

    // ---------------------------
    // NGINX (Ingress / API gateway / App platform)
    // ---------------------------
    "nginx": {
      label: "NGINX (Ingress / API / App Delivery)",
      services: [
        { id: "nginx-plus", name: "NGINX Plus", notes: "Commercial NGINX with advanced load balancing, health checks, support." },
        { id: "nginx-ingress", name: "NGINX Ingress Controller", notes: "Kubernetes ingress controller for L7 routing and policies." },
        { id: "nginx-app-protect", name: "NGINX App Protect (WAF/DoS)", notes: "WAF/DoS for NGINX-based delivery paths." },
        { id: "nginx-api-mgmt", name: "NGINX Management Suite (API Connectivity)", notes: "API gateway/management capabilities (suite dependent)." }
      ]
    },

    // ---------------------------
    // Identity / Access (optional)
    // ---------------------------
    "access": {
      label: "Access / Identity",
      services: [
        { id: "bigip-apm", name: "BIG-IP APM (Access Policy Manager)", notes: "SSO, VPN, ZTNA-style access policies (license dependent)." }
      ]
    },

    // ---------------------------
    // Deployments / Platforms
    // ---------------------------
    "deploy": {
      label: "Deployments (Where it Runs)",
      services: [
        { id: "onprem", name: "On-Prem / Private Cloud", notes: "Appliances or virtual editions; integrates with DC networking and security." },
        { id: "marketplace", name: "Cloud Marketplaces", notes: "Available via AWS/Azure/GCP/OCI marketplaces (offerings vary)." },
        { id: "kubernetes", name: "Kubernetes / Containers", notes: "NGINX ingress + app security components commonly used in k8s." }
      ]
    }
  }
};
