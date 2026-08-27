# LockScreen Privacy & Metadata Minimization Guide

## 1. Zero-Enumeration Threat Model
In privacy-first applications, unauthenticated interfaces (such as lock screens or splash screens) can inadvertently leak critical metadata to passive observers, shoulder surfers, forensic inspectors, or coerced unlocking scenarios:
- How many accounts or Spaces exist on the device.
- Whether a decoy vault or hidden partition is configured.
- How many encrypted envelopes or storage records exist in local IndexedDB partitions.

## 2. VEIL Zero-Disclosure Guarantees
The VEIL LockScreen adheres to strict cryptographic and UI invariants:

1. **No Account / Space Counts**:
   - The UI never displays counts such as `"X encrypted vault envelopes at rest"` or `"X spaces detected"`.
   - The UI provides a single, uniform passphrase/PIN prompt that accepts any credential.

2. **Credential-Selected Space Unlocking**:
   - The user inputs their passphrase or PIN.
   - VEIL performs Argon2id key derivation against the input.
   - The derived master key attempts to open each local envelope. If an envelope opens successfully, that specific Space is mounted. If none match, a generic `"Invalid credentials or Space envelope not found."` error is shown without disclosing how many envelopes were evaluated.

3. **Neutral Action Set**:
   - The LockScreen renders a fixed, identical set of buttons (`Unlock Space`, `+ New Space`, `🔄 Restore Account`, `🚨 Panic`) regardless of device state.
