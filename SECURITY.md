# VaultChat Security Guidelines

## 🔒 Overview

VaultChat implements end-to-end encryption for secure communication. This document outlines security features, best practices, and recommendations for secure deployment.

---

## 🛡️ Security Architecture

### Python CLI Version

#### Encryption Details
- **Algorithm**: Fernet (Symmetric Encryption)
- **Base**: AES-128 in CBC mode with HMAC
- **Key Management**: Pre-shared symmetric key
- **Message Format**: Base64-encoded encrypted binary

#### Security Model
```
User A (Client)
    ↓ [Encrypt with SHARED_KEY]
Server (Blind Relay - Cannot Decrypt)
    ↓ [Forward encrypted blob]
User B (Client)
    ↓ [Decrypt with SHARED_KEY]
```

**Strengths:**
- Server cannot read messages
- Simple and lightweight
- Fast encryption/decryption
- No key exchange required

**Limitations:**
- Pre-shared key required (distribution challenge)
- No forward secrecy (old key compromise = all messages readable)
- No message authentication (cannot verify sender identity)

### Web Version

#### Firebase Security
- **Transport**: HTTPS-only connections
- **Authentication**: Anonymous Firebase Auth
- **Database**: Firestore with security rules
- **Message Storage**: Firestore encrypted at rest (Google-managed)

#### Current Security Model
```
Browser (Client) ↔ Firebase Firestore
    ↓
All messages stored in plaintext (encrypted by Google)
Both users can read chat history
```

**Strengths:**
- Server-side encryption (Google data center security)
- Access control via Firestore rules
- Real-time synchronization
- Automatic backups

**Limitations:**
- Messages readable by both users
- Firebase can theoretically access plaintext
- No end-to-end encryption
- Authentication based on browser storage

#### Enhanced Security Features (Web Version 1.1+)
The web version now includes advanced client-side security protections:

- **Anti-Screenshot Protection**: Blocks PrintScreen and screenshot tools
  - Detects PrintScreen key and clears clipboard
  - Prevents screen capture attempts
  
- **Anti-Copy Security**: Disables copy/cut functionality
  - Blocks Ctrl+C, Ctrl+X keyboard shortcuts
  - Prevents copy-paste of sensitive messages
  - Shows "Copy Restricted" security warning

- **Developer Tools Blocking**: Prevents inspection and debugging
  - Blocks F12 (DevTools)
  - Blocks Ctrl+Shift+I (Inspector)
  - Blocks Ctrl+Shift+J (Console)
  - Blocks Ctrl+Shift+C (Element Picker)
  - Blocks Ctrl+U (View Source)

- **Auto-Blur on Window Loss**: Automatically blurs content when unfocused
  - Applies 15px blur filter when window loses focus
  - Removes blur immediately when window regains focus
  - Prevents shoulder-surfing and preview captures

- **Account Wipe on Logout**: Complete data deletion
  - Full user account erasure on sign-out
  - All associated data removed from Firestore
  - Clean session termination

---

## ⚠️ Critical Security Recommendations

### Before Deployment

1. **Change Encryption Keys** (Python Version)
   ```bash
   # Generate new key
   python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
   
   # Update in server.py AND client.py
   SHARED_KEY = b'your_new_key_here'
   ```

2. **Secure Environment Variables** (Web Version)
   - Never commit `.env` file
   - Use GitHub Secrets for CI/CD
   - Rotate Firebase credentials regularly
   - Use separate Firebase projects for dev/prod

3. **Enable Firebase Security Rules**
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /artifacts/{appId}/users/{userId}/{document=**} {
         allow read: if request.auth.uid == userId;
         allow write: if request.auth.uid == userId;
       }
       
       match /artifacts/{appId}/public/{document=**} {
         allow read: if request.auth != null;
         allow write: if request.auth != null && request.resource.data.uid == request.auth.uid;
       }
     }
   }
   ```

4. **Use HTTPS Only**
   - Enforce HTTPS redirection
   - Set HSTS headers
   - Use secure cookies

### Ongoing Security Practices

1. **Key Rotation**
   - Rotate Python `SHARED_KEY` every 90 days
   - Maintain backward compatibility window
   - Use key versioning if rotating

2. **Access Control**
   - Limit server access to trusted IPs only
   - Use firewall rules for port 55555
   - Implement rate limiting

3. **Audit Logging**
   - Log authentication attempts
   - Monitor suspicious activities
   - Keep logs for 90 days minimum

4. **Dependency Updates**
   ```bash
   # Python
   pip install --upgrade cryptography
   
   # Node.js
   npm audit
   npm audit fix
   npm outdated
   ```

---

## 🔐 Encryption Details

### Python Fernet Cipher

**How it works:**
```
SHARED_KEY (256-bit)
    ↓
Fernet Instance
    ↓
plaintext + timestamp
    ↓
AES-128-CBC encryption
    ↓
HMAC signature
    ↓
Base64 encoding
    ↓
Ciphertext (encrypted message)
```

**Generating Keys:**
```python
from cryptography.fernet import Fernet

# Generate new key
key = Fernet.generate_key()
print(key)  # Output: b'...'

# Load existing key
cipher = Fernet(key)

# Encrypt
ciphertext = cipher.encrypt(b'Hello World')

# Decrypt
plaintext = cipher.decrypt(ciphertext)
```

### Firebase Firestore Encryption

- **At Rest**: AES-256 encryption (Google-managed)
- **In Transit**: TLS 1.2+ encryption
- **Key Management**: Google Cloud KMS

---

## 🚨 Vulnerability Mitigation

### Known Risks

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Pre-shared key exposure | Critical | Store securely, rotate regularly |
| Man-in-the-Middle (Python) | High | Use VPN/secure network for server |
| Plaintext storage (Web) | Medium | Implement client-side E2E encryption |
| Firebase credential leak | High | Use environment variables, never commit |
| Session hijacking | Medium | Use secure/httpOnly cookies |
| DDoS attacks | Medium | Rate limiting, WAF protection |
| SQL injection (N/A) | N/A | Using Firestore (NoSQL) |

### Mitigation Strategies

1. **Transport Security**
   ```nginx
   # Nginx config
   ssl_protocols TLSv1.2 TLSv1.3;
   ssl_ciphers HIGH:!aNULL:!MD5;
   add_header Strict-Transport-Security "max-age=31536000" always;
   ```

2. **Rate Limiting**
   ```python
   # Python server rate limiting
   from collections import defaultdict
   import time
   
   client_messages = defaultdict(list)
   MAX_MESSAGES = 100  # per minute
   
   def is_rate_limited(client):
       now = time.time()
       client_messages[client] = [t for t in client_messages[client] if now - t < 60]
       return len(client_messages[client]) >= MAX_MESSAGES
   ```

3. **Input Validation**
   ```python
   # Validate message size
   MAX_MESSAGE_SIZE = 4096
   if len(message) > MAX_MESSAGE_SIZE:
       client.close()
   ```

---

## 🔑 Key Management

### Python Version

**Storage:**
- Keep `SHARED_KEY` in `client.py` (consider config file)
- Use environment variables in production: `SHARED_KEY = os.getenv('SHARED_KEY')`

**Distribution:**
- Share via secure channel (encrypted email, in-person)
- Never include in git commits
- Use `.env` file in production

**Example secure setup:**
```bash
# Create .env file
echo "SHARED_KEY=$(python -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())')" > .env

# Load in Python
from dotenv import load_dotenv
import os
load_dotenv()
SHARED_KEY = os.getenv('SHARED_KEY').encode()
```

### Web Version

**Firebase Keys:**
- Generate separate keys for dev/staging/production
- Rotate credentials every 6 months
- Use Firebase Application Restrictions
- Monitor API usage in Firebase Console

---

## 📋 Security Checklist

Before deploying to production:

- [ ] Change all default encryption keys
- [ ] Enable Firebase security rules
- [ ] Set up HTTPS/TLS certificates
- [ ] Configure environment variables
- [ ] Review and update dependencies
- [ ] Enable audit logging
- [ ] Set up rate limiting
- [ ] Configure firewalls
- [ ] Test encryption/decryption
- [ ] Document security procedures
- [ ] Set up monitoring and alerts
- [ ] Conduct security testing
- [ ] Create incident response plan
- [ ] Train team on security practices
- [ ] Perform penetration testing (optional)

---

## 🔍 Testing Security

### Encryption Testing

```python
# test_encryption.py
from cryptography.fernet import Fernet

def test_encryption_decryption():
    key = Fernet.generate_key()
    cipher = Fernet(key)
    
    plaintext = b"Sensitive Message"
    ciphertext = cipher.encrypt(plaintext)
    decrypted = cipher.decrypt(ciphertext)
    
    assert plaintext == decrypted
    assert plaintext != ciphertext
    print("✓ Encryption test passed")

def test_key_change():
    key1 = Fernet.generate_key()
    key2 = Fernet.generate_key()
    
    cipher1 = Fernet(key1)
    ciphertext = cipher1.encrypt(b"Message")
    
    cipher2 = Fernet(key2)
    try:
        cipher2.decrypt(ciphertext)
        assert False, "Should not decrypt with different key"
    except:
        print("✓ Key isolation test passed")

if __name__ == "__main__":
    test_encryption_decryption()
    test_key_change()
```

### Running Security Tests

```bash
# Python
python test_encryption.py

# Dependencies security check
pip install safety
safety check

# Node.js
npm audit
npx snyk test
```

---

## 📞 Security Reporting

If you discover a security vulnerability:

1. **Do NOT** open a public GitHub issue
2. Email: `jeetprasadmandal@gmail.com` with:
   - Description of vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)
3. We will respond within 48 hours
4. Allow 30 days for patch before public disclosure

---

## 🔗 References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Cryptography.io Documentation](https://cryptography.io/)
- [Firebase Security Rules](https://firebase.google.com/docs/firestore/security/start)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)

---

## 📚 Further Reading

- [A Practical Guide to Modern Encryption](https://cheatsheetseries.owasp.org/)
- [Secure Code Guidelines](https://cheatsheetseries.owasp.org/cheatsheets/Secure_Coding_Practices_Cheat_Sheet.html)
- [Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)

---

**Last Updated:** March 2026
**Security Level:** Moderate (Consider E2E encryption for production use)
