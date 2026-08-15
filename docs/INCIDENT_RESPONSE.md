# INCIDENT_RESPONSE.md — Security Incident Response & Compromise Containment

## 1. 10-Step Incident Containment Workflow

```mermaid
graph TD
    Step1["1. Incident Identification & Severity Triage"] --> Step2["2. Isolation & Threat Containment"]
    Step2 --> Step3["3. Evidence Preservation (Zero PII/Secrets)"]
    Step3 --> Step4["4. Root Cause Analysis & PoC Verification"]
    Step4 --> Step5["5. Patch Engineering & Negative Test Suite"]
    Step5 --> Step6["6. Independent Security Review / Dual Sign-off"]
    Step6 --> Step7["7. Staged Deployment & Hotfix Rollout"]
    Step7 --> Step8["8. Key Rotation & Space Invalidation (if needed)"]
    Step8 --> Step9["9. Transparent Security Advisory Publication"]
    Step9 --> Step10["10. Postmortem & Architectural ADR Documentation"]
```

---

## 2. Key Compromise Recovery Protocols

| Compromise Scenario | Impact Scope | User Action Required | System Enforcement |
| :--- | :--- | :--- | :--- |
| **Lost / Stolen Unlocked Device** | Active Space sessions exposed | Trigger Panic Lock remotely (or rotate keys from secondary enrolled device) | `revokeDevice()` publishes signed revocation tombstone |
| **Space Password Compromised** | Specific Space on specific device | Unlock Space immediately and run `changePassword()` | Re-derives Argon2id KEK and re-encrypts SMK envelope |
| **Device Linking SAS MITM Attempt** | Unauthorized device attempting enrollment | Reject SAS code mismatch on primary device | Ephemeral DH exchange aborted, no keys transferred |
| **Compromised Group Member** | Past message plaintext exported by member | Admin removes member via `removeMember()` | Monotonic epoch advance + immediate Sender Key rotation |
| **Relay Server Breach** | Attacker dumps relay database | Zero plaintext exposure (E2EE) | Rotate all client mailbox capabilities via `MailboxRotationManager` |
