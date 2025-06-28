# Changelog

All notable changes to the Alpha4 Onboard SDK will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-12-19

### Added
- **Zero-Dev Integration**: Drop-in JavaScript SDK for blockchain points integration
- **Automatic Event Detection**: Forms, buttons, page navigation, and social shares
- **Enterprise Security**: Replay protection, rate limiting, domain validation
- **Wallet Integration**: Automatic Sui wallet detection and connection
- **Real-time Notifications**: Beautiful toast notifications for earned points
- **Offline Queuing**: Events queued when wallet disconnected
- **TypeScript Support**: Complete type definitions included
- **CDN Distribution**: Available at https://onboard.alpha4.io/

### Event Types Supported
- `user_signup` - User registration (50 points, 24h cooldown)
- `purchase_completed` - Purchase transactions (100 points, no cooldown)
- `newsletter_signup` - Newsletter subscriptions (25 points, 7d cooldown)
- `social_share` - Social media sharing (15 points, 1h cooldown)
- `profile_completed` - Profile completion (75 points, 24h cooldown)
- `referral_successful` - Successful referrals (200 points, no cooldown)

### Security Features
- SHA-256 event hashing for replay protection
- Domain whitelist validation
- Rate limiting (configurable per event and per hour)
- Client-side enforcement with blockchain validation
- No personal data transmission

### Performance
- Minified size: ~10KB gzipped
- Zero dependencies (loads Sui SDK dynamically)
- Initialization: <100ms average
- Event processing: <2 seconds end-to-end

### Documentation
- Complete API reference
- Integration examples (e-commerce, SaaS, content sites)
- Debugging guide with console output examples
- Custom event and styling documentation 