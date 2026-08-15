# Real Device Cross-Platform E2EE Testing Runbook

## 1. 28-Step E2EE Real-Device Verification Flow

| Step | Action | Expected Output |
| :--- | :--- | :--- |
| **1-3** | Open VEIL on Android & Desktop; create "Personal Main" & "Private" Spaces | Spaces created with distinct salts & SMKs |
| **4** | Configure Relay URL | Both clients connect to target relay |
| **5-8** | Generate & import `veil://invite/...` invitation; verify Safety Number | Ed25519 signature verified |
| **9-12** | Exchange text messages across platforms | Delivered and decrypted in real-time |
| **13-14** | Send image attachment | 64 KiB chunked encrypted transfer passes SHA-256 validation |
| **15-19** | Force-stop Android $\rightarrow$ send message from Desktop $\rightarrow$ restart Android | Queued envelope delivered upon unlock |
| **20-23** | Switch to Private Space $\rightarrow$ switch back to Personal Main | Complete data isolation verified |
| **24-28** | Trigger Panic Lock $\rightarrow$ re-unlock | State wiped instantly, restorable with passphrase |
