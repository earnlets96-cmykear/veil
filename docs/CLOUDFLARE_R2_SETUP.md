# Cloudflare R2 Object Storage Setup & Configuration Guide

## 1. Prerequisites
- A Cloudflare account with R2 enabled.

---

## 2. Bucket Creation
1. Go to **R2** in the Cloudflare Dashboard.
2. Click **Create bucket**.
3. Name the bucket `veil-attachments` (or your chosen bucket name).
4. Leave Location as **Automatic**.

---

## 3. Creating API Tokens
1. In Cloudflare R2, navigate to **Manage R2 API Tokens**.
2. Click **Create API Token**.
3. Select **Object Read & Write** permissions for your `veil-attachments` bucket.
4. Save the generated credentials:
   - **Access Key ID** (`R2_ACCESS_KEY_ID`)
   - **Secret Access Key** (`R2_SECRET_ACCESS_KEY`)
   - **Endpoint URL** (`R2_ENDPOINT`): `https://<account_id>.r2.cloudflarestorage.com`

---

## 4. Environment Variables on Render
Configure the following in your Render Web Service Environment Settings:
```env
R2_ENDPOINT=https://<account_id>.r2.cloudflarestorage.com
R2_BUCKET=veil-attachments
R2_ACCESS_KEY_ID=<your_r2_access_key_id>
R2_SECRET_ACCESS_KEY=<your_r2_secret_access_key>
R2_REGION=auto
```
