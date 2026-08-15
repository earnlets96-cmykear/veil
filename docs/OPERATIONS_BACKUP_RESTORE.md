# Operations: Backup and Disaster Recovery

## 1. Relay Server Backups

The VEIL Relay Server stores opaque encrypted envelope queues in `/var/lib/veil/storage`.

### Backup Procedure
```bash
# Archive relay data directory atomically
tar -czvf /backup/veil-relay-$(date +%Y%m%d%H%M%S).tar.gz -C /var/lib/veil storage
```

### Restore Procedure
```bash
sudo systemctl stop veil-relay
tar -xzvf /backup/veil-relay-YYYYMMDDHHMMSS.tar.gz -C /var/lib/veil/
sudo systemctl start veil-relay
```

---

## 2. Client Emergency Recovery

- **BIP-39 Passphrase Recovery**: Users can re-derive their Space identity using their 24-word recovery phrase on any fresh VEIL client.
- **Passphrase Export**: Export encrypted JSON archives from Settings.
