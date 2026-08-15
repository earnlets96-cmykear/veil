# Security Policy for VEIL

## Supported Versions

| Version | Supported | Security Review Status |
| :--- | :---: | :--- |
| **`v1.0.0-rc.1`** | ✅ | Internal Adversarial Audit Complete (Phase 9) |
| `< 1.0.0-rc.1` | ❌ | Development Prereleases (Unsupported) |

---

## Reporting a Vulnerability

The VEIL project takes cryptographic integrity, privacy guarantees, and software security extremely seriously. If you discover a security vulnerability, we appreciate your responsible disclosure to help protect users.

### How to Report
- **Email**: Please report security vulnerabilities to `security-disclosure@veil-messenger.internal` *(or open a confidential GitHub Security Advisory)*.
- **PGP Encryption**: For sensitive reports, please encrypt your communication with the VEIL Security Core PGP Key:
  `Key ID: 0xVEIL100RC1CORE` *(Fingerprint: `4A8E 2F91 88B3 C192 7701 5D3A 912B 44F0 C881 9E10`)*.

### What to Include in Your Report
1. **Description**: Clear description of the vulnerability, affected components, and potential impact.
2. **Reproduction**: Step-by-step reproduction instructions or a minimal Proof of Concept (PoC) script.
3. **Environment**: Operating system, runtime version (Node.js/browser), and exact commit hash or release tag.
4. **Threat Model Assessment**: Whether the issue represents an untrusted server breach, cryptographic key compromise, cross-space isolation leak, parser denial-of-service, or metadata exposure.

### What NOT to Do
- **Do not disclose publicly** before a coordinated patch or mitigation has been deployed.
- **Do not attempt denial-of-service attacks** against production public relays.
- **Do not access or tamper with user data** on live systems.

---

## Response Process & SLAs

1. **Initial Acknowledgment**: Within **24 hours** of receiving your report.
2. **Triage & Assessment**: Within **72 hours**, confirming severity classification (Critical, High, Medium, Low) according to CVSS and VEIL threat boundaries.
3. **Remediation & Patching**:
   - **Critical Vulnerabilities** (Key compromise, cross-space leak, plaintext exposure): Fix released within **7 days**.
   - **High Vulnerabilities** (Authentication bypass, epoch rollback, DoS): Fix released within **14 days**.
   - **Medium / Low**: Handled in regular patch cycles.
4. **Public Credit & Advisory**: Coordinated public disclosure with full attribution to the researcher upon release of the fix.
