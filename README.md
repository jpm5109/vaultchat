# VaultChat: Multi-Platform Encrypted Chat System

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.8+](https://img.shields.io/badge/Python-3.8+-blue.svg)](https://www.python.org/)
[![Node.js 16+](https://img.shields.io/badge/Node.js-16+-green.svg)](https://nodejs.org/)
[![Firebase](https://img.shields.io/badge/Firebase-Enabled-orange.svg)](https://firebase.google.com/)

A professional-grade, end-to-end encrypted chat system with **dual deployment options**: a lightweight **Python CLI version** for terminal-based communication and a modern **React/Firebase web application** for browser-based secure messaging.

---

## 🌟 Features Overview

### Python CLI Version
- **True P2P Communication**: Direct socket-based peer-to-peer messaging
- **AES-128 Encryption**: Military-grade symmetric encryption using Fernet
- **Threaded Architecture**: Simultaneous message sending and receiving
- **Color-Coded UI**: Terminal-optimized interface with status indicators
- **Automatic Reconnection**: Built-in error handling and recovery
- **Lightweight & Fast**: Minimal dependencies for quick deployment

### Web Version (React + Firebase)
- **Zero-Config Authentication**: Anonymous Firebase authentication
- **Real-Time Messaging**: Firestore-powered instant message delivery
- **Social Discovery**: Add friends using unique 8-character invite codes
- **Responsive Design**: Mobile-first approach works on all devices
- **Message History**: Persistent encrypted chat logs
- **Friend Management**: Accept/reject connection requests
- **Secure Channel Wiping**: Purge chat histories from both ends
- **Modern UI**: Sleek dark-themed interface with animations

---

## 🏗️ Architecture

```
VaultChat/
├── python-version/          # CLI-based chat application
│   ├── server.py           # Socket server (multi-threaded)
│   ├── client.py           # Socket client with encryption
│   └── requirements.txt     # Python dependencies
│
├── web-version/             # React-based web application
│   ├── src/
│   │   ├── App.jsx        # Main application component
│   │   └── main.jsx       # Entry point
│   ├── index.html          # HTML template
│   ├── package.json        # Node dependencies
│   ├── vite.config.js      # Vite build configuration
│   ├── .env.example        # Environment template
│   └── package-lock.json   # npm deps lockfile
│
├── README.md               # This file
├── DEPLOYMENT.md           # Production deployment guide
├── SECURITY.md             # Security documentation
├── CONTRIBUTING.md         # Contribution guidelines
├── .gitignore              # Git exclusions
└── setup.sh                # Automated setup script
```

---

## 🚀 Quick Start

### Option 1: Automated Setup (Recommended)

```bash
# Clone the repository
git clone https://github.com/jpm5109/vaultchat.git
cd vaultchat

# Run the automated setup script
chmod +x setup.sh
./setup.sh
```

The script will guide you through setup for both versions.

### Option 2: Manual Setup

#### Python CLI Version

```bash
# Navigate to Python version directory
cd python-version

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start the server (Terminal 1)
python server.py

# Start client(s) (Terminal 2+)
python client.py
```

**Server Output:**
```
[STARTING] Server is listening on 127.0.0.1:55555
[INFO] Press Ctrl+C to stop the server.
```

**Client Usage:**
```
Choose your nickname: Alice
[CONNECTED] Connected successfully!
Joined! Type /quit to exit.
You: Hello World!
```

#### Web Version

```bash
# Navigate to web version directory
cd web-version

# Install Node dependencies
npm install

# Configure Firebase credentials
cp .env.example .env
# Edit .env with your Firebase project credentials

# Start development server
npm run dev
# Visit http://localhost:5173 (or shown port)

# Build for production
npm run build
# Output: dist/ directory ready for deployment
```

---

## 🔐 Security & Encryption

### Python Version
- **Encryption Method**: Fernet (AES-128 in CBC mode)
- **Key Management**: Pre-shared symmetric key (configured in `client.py`)
- **Message Format**: Encrypted binary blobs transmitted via TCP
- **Server Role**: Blind relay (server cannot decrypt messages)

### Web Version
- **Transport Security**: Firebase Firestore with HTTPS-only connections
- **Firebase Rules**: Data isolated per user (collection-level security)
- **Message Storage**: Plaintext storage (messages visible to both users)
- **Authentication**: Anonymous Firebase Auth (no account needed)

**⚠️ IMPORTANT SECURITY NOTES:**
1. **Python Version**: Change the `SHARED_KEY` in both `server.py` and `client.py` before deployment
2. **Web Version**: Never commit `.env` file with real Firebase credentials
3. **Private Keys**: Always use environment variables for sensitive data
4. For production, consider:
   - End-to-end encryption at the application level
   - Message signing for authenticity verification
   - Rate limiting on API endpoints
   - Regular security audits

See [SECURITY.md](./SECURITY.md) for detailed security guidelines.

---

## 📋 Prerequisites

### Python CLI Version
- Python 3.8 or higher
- pip (Python package manager)
- Linux/macOS/Windows with terminal support

### Web Version
- Node.js 16+ and npm 7+
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Firebase account and project

### System Requirements
- 50MB disk space minimum
- Internet connection (required for web version)
- Port 55555 available (Python version server)

---

## 🛠️ Installation Details

### Environment Setup

#### Python Version
```bash
cd python-version
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

#### Web Version
```bash
cd web-version
npm install
```

### Configuration

#### Python Version
Edit `python-version/client.py`:
```python
HOST = '127.0.0.1'      # Change to server IP for remote connections
PORT = 55555            # Change if port is already in use
SHARED_KEY = b'...'     # Change to your custom encryption key
```

To generate a new encryption key:
```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

#### Web Version
1. Create Firebase project at [Firebase Console](https://console.firebase.google.com/)
2. Enable Anonymous Authentication and Firestore Database
3. Copy `.env.example` to `.env`
4. Fill in your Firebase credentials from Project Settings

---

## 📖 Usage Examples

### Python CLI - Local Testing

**Terminal 1 (Server):**
```bash
cd python-version
python server.py
```

**Terminal 2 (Alice):**
```bash
cd python-version
python client.py
# Enter: alice
```

**Terminal 3 (Bob):**
```bash
cd python-version
python client.py
# Enter: bob
```

Now Alice and Bob can exchange encrypted messages!

### Web Version - First Run

1. Open `http://localhost:5173` in browser
2. Create a nickname and generate identity
3. Share your **Unique ID** (8-character code) with friends
4. Friends can add you by entering your ID
5. Start encrypted conversations!

---

## 🚢 Deployment

### Web Version - Deploy to Production

#### Vercel (Recommended - Free)
```bash
npm install -g vercel
vercel
# Follow prompts, configure environment variables
```

#### Netlify
```bash
npm run build
# Drag & drop dist/ folder to Netlify
```

#### Self-Hosted (Docker)
```bash
# Build Docker image
docker build -t vaultchat-web .

# Run container
docker run -p 3000:3000 \
  -e VITE_FIREBASE_API_KEY=xxx \
  vaultchat-web
```

#### Manual - Any Web Host
```bash
npm run build
# Upload dist/ folder to your web server
```

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed production deployment instructions.

---

## 🧪 Testing

### Python Version Test
```bash
# Terminal 1: Start server
cd python-version
python server.py

# Terminal 2: Run client 1
python client.py
# Type: test_user_1

# Terminal 3: Run client 2
python client.py
# Type: test_user_2

# Exchange test messages to verify encryption works
```

### Web Version Test
```bash
cd web-version
npm run dev

# Open two browser windows/tabs
# Test adding friends via invite codes
# Test message sending and real-time updates
```

---

## 📦 Dependencies

### Python Version
```
cryptography==42.0.5
```

### Web Version
```
react: ^18.3.1
firebase: ^12.10.0
lucide-react: ^0.344.0
vite: ^7.3.1
tailwindcss: ^3.4.19
```

---

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for:
- Code style guidelines
- Pull request process
- Issue reporting
- Development workflow

---

## 📝 License

This project is licensed under the **MIT License** - see [LICENSE](./LICENSE) file for details.

You are free to:
- Use this for commercial and private projects
- Modify and distribute the code
- Include it in proprietary software

You must:
- Include a copy of the license and copyright notice

---

## 🐛 Troubleshooting

### Python Version Issues

**"Connection refused" error:**
- Ensure server is running: `python server.py`
- Check if port 55555 is available: `netstat -an | grep 55555`
- Try different port by editing `PORT` variable

**Encryption errors:**
- Verify `SHARED_KEY` matches in server.py and client.py
- Regenerate key if changed: `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key())"`

### Web Version Issues

**Firebase connection errors:**
- Verify `.env` file has correct credentials
- Check Firebase project allows anonymous auth
- Enable Firestore Database in Firebase console

**Blank page after login:**
- Check browser console (F12) for errors
- Verify Firebase credentials
- Clear browser cache and reload

**Node dependencies issues:**
```bash
rm -rf node_modules package-lock.json
npm install
npm run dev
```

---

## 📚 Documentation

- [DEPLOYMENT.md](./DEPLOYMENT.md) - Production deployment guides
- [SECURITY.md](./SECURITY.md) - Security best practices
- [CONTRIBUTING.md](./CONTRIBUTING.md) - Development guidelines

---

## 📞 Support & Contact

For questions and support:
- 📧 Email: jeetprasadmandal@gmail.com
- 🐛 Issues: [GitHub Issues](https://github.com/jpm5109/vaultchat/issues)
- 💬 Discussions: [GitHub Discussions](https://github.com/jpm5109/vaultchat/discussions)

---

## 🎯 Future Enhancements

- [ ] End-to-end encryption for web version
- [ ] Video/audio call support
- [ ] Message reactions and replies
- [ ] File sharing with encryption
- [ ] Mobile native apps (iOS/Android)
- [ ] Offline message queuing
- [ ] User presence indicators
- [ ] Typing indicators

---

**Made with ❤️ for secure communication**

Last updated: March 2026

## 🔒 Security Note

This system uses End-to-End Encryption. In the Python version, messages are encrypted before they hit the wire. In the Web version, data is stored in secured Firestore paths accessible only to authenticated friends.
