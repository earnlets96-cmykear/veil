# VEIL Release Procedure & Packaging

## 1. Release Verification Checklist

- [x] Full test suite passing 100% (`npm test`)
- [x] Clean production build generated (`npm run build`)
- [x] Zero sensitive secrets in logs, repositories, or artifacts
- [x] Production deployment templates verified (`deployment/`)
- [x] AI continuity records synchronized (`docs/ai/`)

---

## 2. Release Commands

```bash
# Clean install
npm ci

# Run test suite
npm test

# Build production bundle
npm run build

# Start production relay
npm run relay
```
