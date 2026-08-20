# Disaster Recovery & Cold-Start Runbook

## 1. Failure Scenarios

### Scenario A: Render Web Service Crash or Redeployment
- **Impact**: In-flight WebSocket connections drop.
- **Recovery**:
  - Render automatically spawns a new container.
  - New container connects to Supabase PostgreSQL and Cloudflare R2 on boot.
  - Clients automatically reconnect using exponential backoff and resume listening to their blind mailboxes.
  - Zero messages, attachments, or account credentials are lost because Render contains zero state.

### Scenario B: Transient Database Interruption
- **Impact**: Database queries fail temporarily.
- **Recovery**:
  - `PostgresClient` initiates automatic retry with exponential backoff (up to 3 attempts).
  - `/readyz` endpoint returns 503 during outage to alert load balancers.
  - Connections recover automatically once Supabase finishes failover/maintenance.

### Scenario C: Device Loss or Storage Corruption
- **Impact**: Local IndexedDB / partition store is erased.
- **Recovery**:
  - User supplies 24-word recovery phrase.
  - Client derives identical 256-bit Space Master Key.
  - Client synchronizes encrypted account records from PostgreSQL.
  - All chats and media are restored losslessly.
