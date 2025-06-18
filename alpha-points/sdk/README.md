# Sui Points Adapter - Universal Zero-Dev JavaScript SDK

## Overview

The Sui Points Adapter is a revolutionary drop-in JavaScript SDK that enables **zero-development blockchain points integration** for any website. Simply include one script tag and your website automatically starts rewarding users with blockchain points for common actions.

## 🚀 Quick Start

### Option 1: Auto-Configuration (Recommended)
```html
<script 
    src="https://cdn.alphapoints.com/sui-points-adapter.js"
    data-package-id="0x123..."
    data-partner-cap-id="0x456..."
    data-rpc-url="https://fullnode.mainnet.sui.io:443"
    data-allowed-origins="https://yoursite.com,https://www.yoursite.com">
</script>
```

### Option 2: Manual Configuration
```html
<script src="https://cdn.alphapoints.com/sui-points-adapter.js"></script>
<script>
    const adapter = new SuiPointsAdapter({
        packageId: '0x123...',
        partnerCapId: '0x456...',
        rpcUrl: 'https://fullnode.mainnet.sui.io:443',
        allowedOrigins: ['https://yoursite.com'],
        enableAutoDetection: true,
        showNotifications: true
    });
</script>
```

## ✨ Features

### 🔄 **Automatic Event Detection**
- **Form Submissions**: Automatically detects signup and newsletter forms
- **Button Clicks**: Identifies purchase, share, and action buttons
- **Page Navigation**: Tracks profile completion and milestone pages
- **Custom Events**: Supports website-specific event triggers

### 🔒 **Enterprise Security**
- **Replay Protection**: SHA-256 event hashing prevents duplicate submissions
- **Rate Limiting**: Configurable cooldowns and hourly limits
- **Domain Validation**: Restricts events to whitelisted origins
- **Secure Storage**: Client-side rate limiting with session management

### 🎯 **Event Types Supported**

| Event Type | Default Points | Default Cooldown | Auto-Detection |
|------------|----------------|------------------|----------------|
| `user_signup` | 50 | 24 hours | ✅ Forms with signup keywords |
| `purchase_completed` | 100 | None | ✅ Buy/checkout buttons |
| `newsletter_signup` | 25 | 7 days | ✅ Newsletter/subscribe forms |
| `social_share` | 15 | 1 hour | ✅ Social share buttons |
| `profile_completed` | 75 | 24 hours | ✅ Profile/dashboard pages |
| `referral_successful` | 200 | None | 🔧 Custom events only |

### 📱 **User Experience**
- **Real-time Notifications**: Beautiful toast notifications for earned points
- **Wallet Integration**: Automatic Sui wallet detection and connection
- **Offline Queuing**: Events queued when wallet disconnected
- **Zero Friction**: No user registration or setup required

## 📖 API Reference

### Constructor

```javascript
const adapter = new SuiPointsAdapter(config)
```

#### Configuration Options

```javascript
{
    // Required
    packageId: string,           // Sui package ID
    partnerCapId: string,        // Partner capability object ID
    
    // Network
    rpcUrl: string,              // Sui RPC endpoint
    
    // Security
    allowedOrigins: string[],    // Whitelisted domains
    maxEventsPerHour: number,    // Rate limiting (default: 10)
    
    // Event Configuration
    eventMappings: {
        user_signup: { 
            points: number, 
            cooldown: number 
        },
        // ... other event types
    },
    
    // Features
    enableAutoDetection: boolean, // Auto-detect events (default: true)
    showNotifications: boolean,   // Show point notifications (default: true)
    enableDebugMode: boolean,     // Console logging (default: false)
    
    // UI
    notificationDuration: number, // Notification display time (default: 3000ms)
    customStyles: object         // Custom notification styles
}
```

### Methods

#### `trackEvent(eventType, metadata)`
Manually track a custom event:
```javascript
adapter.trackEvent('purchase_completed', {
    amount: 99.99,
    currency: 'USD',
    productId: 'premium-plan'
});
```

#### `connectWallet()`
Manually trigger wallet connection:
```javascript
const connected = await adapter.connectWallet();
```

#### `getStatus()`
Get current adapter status:
```javascript
const status = adapter.getStatus();
// Returns: { isInitialized, hasWallet, queuedEvents, version }
```

#### `updateConfig(newConfig)`
Update configuration at runtime:
```javascript
adapter.updateConfig({
    showNotifications: false,
    maxEventsPerHour: 20
});
```

### Events

Listen for SDK events:

```javascript
// SDK ready
window.addEventListener('suiPointsReady', (event) => {
    console.log('Sui Points Adapter ready:', event.detail.adapter);
});

// Points earned
window.addEventListener('suiPointsEarned', (event) => {
    const { eventType, points, userId } = event.detail;
    console.log(`User earned ${points} points for ${eventType}`);
});
```

## 🎨 Customization

### Custom Event Detection

```javascript
// Dispatch custom events from your website
window.dispatchEvent(new CustomEvent('suiPointsEvent', {
    detail: {
        eventType: 'custom_achievement',
        userId: 'user123',
        metadata: { achievementId: 'first_purchase' }
    }
}));

// Referral events
window.dispatchEvent(new CustomEvent('referralCompleted', {
    detail: {
        userId: 'user123',
        referralData: { referredUserId: 'user456', campaign: 'winter2024' }
    }
}));
```

### Custom Styling

```javascript
const adapter = new SuiPointsAdapter({
    customStyles: {
        notification: {
            background: 'linear-gradient(135deg, #your-color1, #your-color2)',
            borderRadius: '12px',
            fontSize: '16px'
        }
    }
});
```

### Advanced Auto-Detection

The SDK automatically detects events by analyzing:

- **Form Elements**: Action URLs, class names, IDs, input types
- **Button Text**: "Buy Now", "Sign Up", "Subscribe", "Share"
- **URL Patterns**: `/profile`, `/dashboard`, `/complete`, `/checkout`
- **CSS Classes**: `.signup-form`, `.newsletter`, `.purchase-btn`

## 🔧 Integration Examples

### E-commerce Site
```html
<!-- Automatic purchase detection -->
<button class="buy-now-btn" onclick="checkout()">Buy Now - $99</button>

<!-- Manual tracking for complex flows -->
<script>
function onPurchaseComplete(orderData) {
    suiPointsAdapter.trackEvent('purchase_completed', {
        orderId: orderData.id,
        amount: orderData.total,
        items: orderData.items.length
    });
}
</script>
```

### SaaS Platform
```html
<!-- Automatic signup detection -->
<form class="signup-form" action="/register">
    <input type="email" name="email" placeholder="Email">
    <input type="password" name="password" placeholder="Password">
    <button type="submit">Create Account</button>
</form>

<!-- Profile completion tracking -->
<script>
// Automatically detected when user reaches /dashboard or /profile
// Or manually trigger:
function onProfileComplete() {
    suiPointsAdapter.trackEvent('profile_completed', {
        completionStep: 'avatar_uploaded',
        profileScore: 85
    });
}
</script>
```

### Content Site
```html
<!-- Automatic social share detection -->
<a href="#" class="share-twitter" onclick="shareOnTwitter()">
    Share on Twitter
</a>

<!-- Newsletter signup -->
<form class="newsletter-signup">
    <input type="email" placeholder="Enter your email">
    <button type="submit">Subscribe</button>
</form>
```

## 🛡️ Security Features

### Replay Protection
- Each event generates a unique SHA-256 hash
- Hash includes: event type, user ID, timestamp, and origin
- Prevents duplicate event submissions

### Rate Limiting
- Per-event cooldown periods
- Hourly rate limits per user
- Client-side enforcement with server validation

### Domain Validation
- Events restricted to whitelisted origins
- Prevents unauthorized event submissions
- CORS-style origin checking

### Data Privacy
- No personal data transmitted to blockchain
- User IDs are wallet addresses or session-generated
- Metadata is optional and controllable

## 🚀 Performance

### Lightweight
- **Minified Size**: ~15KB gzipped
- **Dependencies**: None (loads Sui SDK dynamically)
- **Initialization**: <100ms average

### Efficient
- **Event Processing**: <2 seconds end-to-end
- **Local Caching**: Rate limiting and user data
- **Batch Processing**: Queued events processed together

### Scalable
- **Concurrent Events**: 1000+ per second per partner
- **Auto-retry**: Failed events automatically retried
- **Graceful Degradation**: Works without wallet connection

## 🔍 Debugging

### Enable Debug Mode
```javascript
const adapter = new SuiPointsAdapter({
    enableDebugMode: true
});
```

### Console Output
```
[SuiPointsAdapter] Initializing Sui Points Adapter v1.0.0
[SuiPointsAdapter] Sui client connected successfully
[SuiPointsAdapter] Setting up automatic event detection
[SuiPointsAdapter] Wallet connected: 0x123...
[SuiPointsAdapter] Submitting event: user_signup for user: 0x123...
[SuiPointsAdapter] Event submitted successfully: ABC123...
```

### Status Monitoring
```javascript
// Check adapter status
console.log(adapter.getStatus());

// Monitor events
window.addEventListener('suiPointsEarned', (event) => {
    console.log('Points earned:', event.detail);
});
```

## 📦 CDN Hosting

### Production CDN
```html
<script src="https://cdn.alphapoints.com/sui-points-adapter.js"></script>
```

### Development CDN
```html
<script src="https://cdn.alphapoints.com/sui-points-adapter-dev.js"></script>
```

### Self-Hosting
Download `sui-points-adapter.js` and host on your own CDN:
```html
<script src="/js/sui-points-adapter.js"></script>
```

## 🆘 Support

### Common Issues

**Q: Events not being detected?**
A: Check console for errors, ensure wallet is connected, verify domain is whitelisted.

**Q: Rate limiting too restrictive?**
A: Adjust `maxEventsPerHour` and event-specific cooldowns in configuration.

**Q: Notifications not showing?**
A: Ensure `showNotifications: true` and check for CSS conflicts.

### Getting Help

- **Documentation**: https://docs.alphapoints.com/sdk
- **Support**: support@alphapoints.com
- **Discord**: https://discord.gg/alphapoints
- **GitHub**: https://github.com/alphapoints/sui-points-adapter

## 📄 License

MIT License - see LICENSE file for details.

---

**Transform your website into a blockchain rewards platform with zero development effort!** 🚀 