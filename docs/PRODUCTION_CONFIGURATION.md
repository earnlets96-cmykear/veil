# PRODUCTION_CONFIGURATION.md — VEIL Production Configuration Architecture

## 1. Environment Configurations

| Setting | Development | Test | Production |
| :--- | :--- | :--- | :--- |
| `relayHttpUrl` | `http://127.0.0.1:8787` | `http://127.0.0.1:0` | `https://relay.veil.chat` |
| `relayWsUrl` | `ws://127.0.0.1:8787/v1/ws` | `ws://127.0.0.1:0/v1/ws` | `wss://relay.veil.chat/v1/ws` |
| `enforceTls` | `false` | `false` | `true` |
| `requestTimeoutMs` | 10,000 ms | 5,000 ms | 15,000 ms |
| `maxOutboundQueueSize` | 500 envelopes | 100 envelopes | 1,000 envelopes |
| `maxAttachmentSizeBytes` | 10 MiB | 1 MiB | 25 MiB |
| `logLevel` | `info` | `none` | `error` |

---

## 2. Security Invariants

- **No Baked Secrets**: Client builds contain zero private keys, master keys, or passwords.
- **Fail-Closed TLS**: When `enforceTls: true`, cleartext `http://` or `ws://` endpoints are rejected with `TlsRequiredError`.
