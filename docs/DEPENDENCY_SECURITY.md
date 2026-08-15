# VEIL Dependency & Supply-Chain Security Policy

## 1. Supply Chain Philosophy

VEIL maintains an ultra-minimal dependency footprint:
- **Production Dependencies**: Limited strictly to audited cryptographic primitives (`@noble`), React, and `ws`.
- **Zero Third-Party Analytics**: No telemetry, tracking, or crash-reporting libraries are permitted.
- **Audited Implementations**: Noble crypto suites are pure JavaScript/TypeScript without unsafe native bindings or post-install compilation hooks.

---

## 2. Dependency Audit Results

- Production dependencies count: 6
- Vulnerabilities / Advisories: 0
- Status: **APPROVED FOR v1.0.0 GA**
