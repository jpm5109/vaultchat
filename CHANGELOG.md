## [1.0.0] - 2026-03-03

### Added
- Initial release of VaultChat
- Python CLI version with AES-128 encryption
- React-based web version with Firebase integration
- Comprehensive documentation (README, DEPLOYMENT, SECURITY, CONTRIBUTING)
- Automated setup script (setup.sh)
- .env.example template for Firebase configuration
- Professional .gitignore configuration

### Features
- End-to-end encrypted messaging
- Real-time message delivery
- Friend request system
- Message history management
- Multiple deployment options

### Documentation
- README.md - Project overview and quick start
- DEPLOYMENT.md - Production deployment guide
- SECURITY.md - Security best practices
- CONTRIBUTING.md - Development guidelines

### Security
- Fernet encryption for Python version
- Firebase Firestore security rules
- Environment variable management
- No hardcoded credentials

---

## [1.0.1] - 2026-03-05 (Web Version Security Update)

### Added (Web Version)
- Anti-screenshot protection (PrintScreen blocking)
- Anti-copy security (keyboard shortcuts disabled for Ctrl+C, Ctrl+X)
- Developer tools prevention (F12, Ctrl+Shift+I, Ctrl+J, Ctrl+U blocking)
- Auto-blur on window focus loss (15px blur filter)
- Account wipe on logout (full user data deletion)
- Enhanced security event listeners

### Enhanced
- Security tier classification: Anti-Screenshot & Anti-Copy enabled
- Improved message privacy with comprehensive screen protection
- Better developer protection against inspection and code viewing
- More robust logout process with complete data erasure

### Documentation
- Updated SECURITY.md with new protection features
- Updated README.md feature list with security enhancements

---

## Future Releases

### [1.2.0] - Planned
- [ ] End-to-end encryption for web version
- [ ] Message reactions
- [ ] Typing indicators
- [ ] User presence indicators
- [ ] Message search functionality

### [2.0.0] - Future
- [ ] Video/audio calling
- [ ] File sharing with encryption
- [ ] Mobile native apps (iOS/Android)
- [ ] Offline message queuing
- [ ] Group conversations

---

**Current Version: 1.0.1**
**Last Updated: March 5, 2026**
