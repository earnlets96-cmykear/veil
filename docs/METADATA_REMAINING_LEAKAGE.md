# METADATA_REMAINING_LEAKAGE.md — Transparent Catalog of Residual Traffic Signals

## 1. Cryptographic Honesty Commitment

Metadata minimization reduces observable patterns, but no software can eliminate all physical information leakage over public packet-switched networks.

---

## 2. Residual Metadata Catalog

| Residual Signal | Threat Observer | Severity | Why It Remains | Potential Future Mitigation |
| :--- | :--- | :--- | :--- | :--- |
| **Connection Timestamps & Frequency** | ISP / Local Network Wiretap | Medium | Direct TCP/TLS connections require socket establishment when active. | Continuous constant-rate cover traffic (high battery/bandwidth cost). |
| **Bucket Threshold Boundaries** | Passive Network Eavesdropper | Low | Payloads just under 512B vs 2KB are padded to different bucket sizes. | Uniform fixed-size packetization across all packets. |
| **Global Traffic Correlation** | Global Passive Adversary | High | An adversary observing both sender and receiver ISP connections simultaneously can correlate packet burst times. | Mixnet routing (e.g., Loopix/Nym architecture). |
| **Push Notification Timestamps** | OS Vendor (Apple / Google) | Low | APNs/FCM receives a wake-up push request when an envelope is posted. | Background periodic polling without push notifications. |
| **Media Transfer Volume** | Relay Server / CDN | Low | A 10 MB video produces ~160 chunks of 64 KiB. | Fixed-rate media chunk streaming and decoy chunk downloads. |
