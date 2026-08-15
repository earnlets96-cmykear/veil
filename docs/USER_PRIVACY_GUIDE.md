# USER_PRIVACY_GUIDE.md — Plain Language Privacy Guide for VEIL

## 1. Welcome to VEIL

VEIL is designed from the ground up to protect your privacy and communications. Unlike traditional messaging apps, VEIL does not require your phone number or email, does not build a social graph of who you talk to, and allows you to create multiple isolated Spaces under a single app.

---

## 2. What VEIL Protects

- **Your Message Contents**: Every message, image, audio note, and file is encrypted on your device and can only be decrypted by the intended recipient. The server only sees encrypted gibberish.
- **Your Contacts & Social Graph**: The server does not keep a list of your contacts or know who you are communicating with. Messages are dropped into blind, rotating mailboxes.
- **Multiple Personas (Spaces)**: You can create separate Spaces (e.g., Personal, Work, Private). Each Space uses a different password and has completely separate data. Opening one Space reveals nothing about the others.
- **Coercion Resistance (Decoy Spaces)**: If forced to unlock your phone, entering your Decoy Space password opens an authentic secondary Space with its own chats, without revealing your primary Spaces.
- **Instant Emergency Wipe (Panic Lock)**: Tapping Panic Lock or entering your panic trigger immediately locks all Spaces and purges temporary message text from memory.

---

## 3. What VEIL Cannot Protect Against

No software can provide absolute magic protection. Here are the honest boundaries you should know:

1. **Compromised Device / Keyloggers**: If your physical phone or computer has spyware, malware, or a keylogger installed, the malware can capture what you type or see on your screen.
2. **Camera Over Your Shoulder**: If someone physically records your screen with a camera while you are chatting, software encryption cannot prevent this. You can enable *Privacy Mode* in Settings to blur message previews.
3. **Loss of Both Password AND Backup Phrase**: VEIL has **zero backdoors**. There is no "Forgot Password" email link. If you lose your password and did not save your 24-word recovery phrase, your Space cannot be recovered.
4. **Internet Service Provider (ISP) Connection Records**: Your ISP can see that your device is connected to a messaging relay server and the rough timing and size of encrypted traffic packets, although VEIL adds random padding and delays to make traffic analysis difficult.

---

## 4. Best Practices for Maximum Privacy

1. **Write Down Your 24-Word Recovery Phrase**: Go to `Settings -> Recovery` in your Space and write your recovery words on paper. Store it in a safe, offline place.
2. **Use Strong, Unique Passwords for Different Spaces**: Do not reuse your Main Space password for your Private or Decoy Space.
3. **Set an Auto-Lock Timer**: Enable auto-lock (e.g., 5 minutes) so that your Space locks automatically if you step away from your device.
4. **Review Security Indicators**: In 1-to-1 chats, verify Safety Numbers / fingerprints with your contacts in person or over a trusted secondary channel.
