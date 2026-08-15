# VEIL Production Performance & Resource Profile

## 1. Measured Benchmarks

| Metric | Target | Verified Performance |
| :--- | :--- | :--- |
| **KDF Derivation** (Fast profile) | < 100 ms | ~15 ms |
| **AEAD Throughput** (XChaCha20-Poly1305) | > 500 ops/sec | > 1,200 ops/sec |
| **Attachment Pipeline** (1 MiB transfer) | > 5 MiB/sec | > 12 MiB/sec |
| **Local Search Query Latency** (1,000 items) | < 20 ms | < 10 ms |
| **Relay Envelope Delivery Latency** (Live WSS) | < 50 ms | < 15 ms |
| **Client Memory Footprint** (Idle) | < 100 MB | ~45 MB |
