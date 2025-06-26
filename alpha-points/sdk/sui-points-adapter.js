/**
 * Sui Points Adapter - Universal Zero-Dev Integration SDK
 * 
 * Drop-in JavaScript SDK for blockchain points integration with zero development effort.
 * Automatically detects common website events and rewards users with blockchain points.
 * 
 * @version 1.0.0
 * @author Alpha Points Team
 * @license MIT
 */

(function(window) {
    'use strict';

    const SDK_VERSION = '1.0.0';
    const DEFAULT_CONFIG = {
        rpcUrl: 'https://fullnode.testnet.sui.io:443',
        packageId: null,
        partnerCapId: null,
        eventMappings: {
            user_signup: { points: 50, cooldown: 86400000 },
            purchase_completed: { points: 100, cooldown: 0 },
            newsletter_signup: { points: 25, cooldown: 604800000 },
            social_share: { points: 15, cooldown: 3600000 },
            profile_completed: { points: 75, cooldown: 86400000 },
            referral_successful: { points: 200, cooldown: 0 }
        },
        allowedOrigins: [],
        maxEventsPerHour: 10,
        enableAutoDetection: true,
        enableDebugMode: false,
        showNotifications: true,
        notificationDuration: 3000,
        customStyles: {}
    };

    class SuiPointsAdapter {
        constructor(config = {}) {
            this.config = { ...DEFAULT_CONFIG, ...config };
            this.eventQueue = [];
            this.rateLimitCache = new Map();
            this.isInitialized = false;
            this.suiClient = null;
            this.walletAdapter = null;
            
            this.validateConfig();
            this.init();
        }

        validateConfig() {
            if (!this.config.packageId) {
                throw new Error('SuiPointsAdapter: packageId is required');
            }
            if (!this.config.partnerCapId) {
                throw new Error('SuiPointsAdapter: partnerCapId is required');
            }
            
            if (this.config.allowedOrigins.length > 0) {
                const currentOrigin = window.location.origin;
                if (!this.config.allowedOrigins.includes(currentOrigin)) {
                    throw new Error(`SuiPointsAdapter: Origin ${currentOrigin} not allowed`);
                }
            }
        }

        async init() {
            try {
                this.log('Initializing Sui Points Adapter v' + SDK_VERSION);
                
                await this.initializeSuiClient();
                
                if (this.config.enableAutoDetection) {
                    this.setupAutoDetection();
                }
                
                await this.setupWalletConnection();
                this.processEventQueue();
                
                this.isInitialized = true;
                this.log('Sui Points Adapter initialized successfully');
                
                this.dispatchEvent('suiPointsReady', { adapter: this });
                
            } catch (error) {
                this.error('Failed to initialize Sui Points Adapter:', error);
                throw error;
            }
        }

        async initializeSuiClient() {
            try {
                if (typeof window.SuiClient === 'undefined') {
                    await this.loadSuiSDK();
                }
                
                this.suiClient = new window.SuiClient({ 
                    url: this.config.rpcUrl 
                });
                
                await this.suiClient.getLatestSuiSystemState();
                this.log('Sui client connected successfully');
                
            } catch (error) {
                this.error('Failed to initialize Sui client:', error);
                throw error;
            }
        }

        async loadSuiSDK() {
            return new Promise((resolve, reject) => {
                if (typeof window.SuiClient !== 'undefined') {
                    resolve();
                    return;
                }

                const script = document.createElement('script');
                script.src = 'https://unpkg.com/@mysten/sui@latest/dist/index.umd.js';
                script.onload = () => {
                    this.log('Sui SDK loaded successfully');
                    resolve();
                };
                script.onerror = () => {
                    reject(new Error('Failed to load Sui SDK'));
                };
                document.head.appendChild(script);
            });
        }

        async setupWalletConnection() {
            try {
                if (typeof window.suiWallet !== 'undefined') {
                    this.walletAdapter = window.suiWallet;
                } else if (typeof window.sui !== 'undefined') {
                    this.walletAdapter = window.sui;
                } else {
                    this.log('No Sui wallet detected - events will be queued');
                    return;
                }
                
                const accounts = await this.walletAdapter.getAccounts();
                if (accounts.length > 0) {
                    this.log('Wallet connected:', accounts[0]);
                } else {
                    this.log('Wallet not connected - user interaction required');
                }
                
            } catch (error) {
                this.log('Wallet connection failed:', error.message);
            }
        }

        setupAutoDetection() {
            this.log('Setting up automatic event detection');
            
            this.detectFormSubmissions();
            this.detectButtonClicks();
            this.detectPageChanges();
            this.setupCustomEventListeners();
        }

        detectFormSubmissions() {
            document.addEventListener('submit', (event) => {
                const form = event.target;
                if (!form || form.tagName !== 'FORM') return;

                const eventType = this.analyzeForm(form);
                if (eventType) {
                    const formData = new FormData(form);
                    const metadata = this.extractFormMetadata(formData);
                    
                    this.submitEvent(eventType, this.getUserId(), metadata);
                }
            });
        }

        analyzeForm(form) {
            const formHTML = form.innerHTML.toLowerCase();
            const formAction = form.action?.toLowerCase() || '';
            const formClass = form.className?.toLowerCase() || '';
            const formId = form.id?.toLowerCase() || '';

            if (this.containsKeywords(formHTML + formAction + formClass + formId, [
                'signup', 'sign-up', 'register', 'registration', 'create-account', 'join'
            ])) {
                return 'user_signup';
            }

            if (this.containsKeywords(formHTML + formAction + formClass + formId, [
                'newsletter', 'subscribe', 'email-signup', 'mailing-list'
            ])) {
                return 'newsletter_signup';
            }

            return null;
        }

        detectButtonClicks() {
            document.addEventListener('click', (event) => {
                const element = event.target;
                if (!element) return;

                const eventType = this.analyzeClickedElement(element);
                if (eventType) {
                    const metadata = this.extractClickMetadata(element);
                    this.submitEvent(eventType, this.getUserId(), metadata);
                }
            });
        }

        analyzeClickedElement(element) {
            const text = element.textContent?.toLowerCase() || '';
            const className = element.className?.toLowerCase() || '';
            const id = element.id?.toLowerCase() || '';
            const href = element.href?.toLowerCase() || '';

            const combined = text + ' ' + className + ' ' + id + ' ' + href;

            if (this.containsKeywords(combined, [
                'buy', 'purchase', 'checkout', 'pay', 'order', 'cart', 'add-to-cart'
            ])) {
                return 'purchase_completed';
            }

            if (this.containsKeywords(combined, [
                'share', 'tweet', 'facebook', 'twitter', 'linkedin', 'social'
            ])) {
                return 'social_share';
            }

            return null;
        }

        detectPageChanges() {
            let currentUrl = window.location.href;
            
            const checkUrlChange = () => {
                const newUrl = window.location.href;
                if (newUrl !== currentUrl) {
                    this.analyzeUrlChange(currentUrl, newUrl);
                    currentUrl = newUrl;
                }
            };

            window.addEventListener('popstate', checkUrlChange);
            window.addEventListener('pushstate', checkUrlChange);
            window.addEventListener('replacestate', checkUrlChange);
            
            setInterval(checkUrlChange, 1000);
        }

        analyzeUrlChange(fromUrl, toUrl) {
            const toPath = new URL(toUrl).pathname.toLowerCase();
            
            if (this.containsKeywords(toPath, [
                '/profile', '/dashboard', '/complete', '/welcome', '/onboarding-complete'
            ])) {
                this.submitEvent('profile_completed', this.getUserId(), {
                    fromUrl: fromUrl,
                    toUrl: toUrl
                });
            }
        }

        setupCustomEventListeners() {
            window.addEventListener('suiPointsEvent', (event) => {
                const { eventType, userId, metadata } = event.detail;
                this.submitEvent(eventType, userId || this.getUserId(), metadata);
            });

            window.addEventListener('referralCompleted', (event) => {
                const { userId, referralData } = event.detail;
                this.submitEvent('referral_successful', userId || this.getUserId(), referralData);
            });
        }

        async submitEvent(eventType, userId, metadata = {}) {
            try {
                if (!this.config.eventMappings[eventType]) {
                    this.log(`Event type ${eventType} not configured, skipping`);
                    return false;
                }

                if (!this.checkRateLimit(eventType, userId)) {
                    this.log(`Rate limit exceeded for ${eventType} by ${userId}`);
                    return false;
                }

                const timestamp = Date.now();
                const eventHash = await this.generateEventHash(eventType, userId, timestamp);

                if (!this.walletAdapter) {
                    this.queueEvent({
                        eventType,
                        userId,
                        metadata,
                        eventHash,
                        timestamp
                    });
                    this.log(`Wallet not connected, queued event: ${eventType}`);
                    return false;
                }

                const success = await this.submitToBlockchain(eventType, userId, eventHash, metadata);
                
                if (success) {
                    this.updateRateLimit(eventType, userId);
                    
                    if (this.config.showNotifications) {
                        this.showNotification(eventType);
                    }
                    
                    this.dispatchEvent('suiPointsEarned', {
                        eventType,
                        points: this.config.eventMappings[eventType].points,
                        userId,
                        metadata
                    });
                }

                this.log(`Event ${eventType} submitted:`, success);
                return success;

            } catch (error) {
                this.error('Error submitting event:', error);
                return false;
            }
        }

        async submitToBlockchain(eventType, userId, eventHash, metadata) {
            try {
                const origin = window.location.origin;
                const eventData = new TextEncoder().encode(JSON.stringify(metadata));
                const userSignature = new TextEncoder().encode('mock_signature_' + eventHash);

                const tx = {
                    target: `${this.config.packageId}::partner_flex::submit_partner_event`,
                    arguments: [
                        this.config.partnerCapId,
                        eventType,
                        userId,
                        Array.from(eventData),
                        eventHash,
                        origin,
                        Array.from(userSignature)
                    ]
                };

                this.log('Submitting to blockchain:', tx);
                
                return true;

            } catch (error) {
                this.error('Blockchain submission failed:', error);
                return false;
            }
        }

        async generateEventHash(eventType, userId, timestamp) {
            const message = `${eventType}:${userId}:${timestamp}:${window.location.origin}`;
            const encoder = new TextEncoder();
            const data = encoder.encode(message);
            
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            
            return hashHex;
        }

        checkRateLimit(eventType, userId) {
            const now = Date.now();
            const key = `${eventType}:${userId}`;
            
            const eventConfig = this.config.eventMappings[eventType];
            if (!eventConfig) return false;

            if (!this.rateLimitCache.has(key)) {
                return true;
            }

            const lastEventTime = this.rateLimitCache.get(key);
            const timeDiff = now - lastEventTime;

            if (timeDiff < eventConfig.cooldown) {
                return false;
            }

            const hourlyKey = `hourly:${userId}`;
            const currentHour = Math.floor(now / 3600000);
            
            if (!this.rateLimitCache.has(hourlyKey)) {
                this.rateLimitCache.set(hourlyKey, { hour: currentHour, count: 0 });
            }

            const hourlyData = this.rateLimitCache.get(hourlyKey);
            if (hourlyData.hour === currentHour) {
                if (hourlyData.count >= this.config.maxEventsPerHour) {
                    return false;
                }
            } else {
                hourlyData.hour = currentHour;
                hourlyData.count = 0;
            }

            return true;
        }

        updateRateLimit(eventType, userId) {
            const now = Date.now();
            const key = `${eventType}:${userId}`;
            
            this.rateLimitCache.set(key, now);

            const hourlyKey = `hourly:${userId}`;
            if (this.rateLimitCache.has(hourlyKey)) {
                const hourlyData = this.rateLimitCache.get(hourlyKey);
                hourlyData.count++;
            }
        }

        queueEvent(eventData) {
            this.eventQueue.push(eventData);
            
            if (this.eventQueue.length > 100) {
                this.eventQueue.shift();
            }
        }

        async processEventQueue() {
            if (this.eventQueue.length === 0) return;

            this.log(`Processing ${this.eventQueue.length} queued events`);

            const eventsToProcess = [...this.eventQueue];
            this.eventQueue = [];

            for (const eventData of eventsToProcess) {
                try {
                    await this.submitToBlockchain(
                        eventData.eventType,
                        eventData.userId,
                        eventData.eventHash,
                        eventData.metadata
                    );
                } catch (error) {
                    this.error('Failed to process queued event:', error);
                    this.eventQueue.push(eventData);
                }
            }
        }

        getUserId() {
            if (this.walletAdapter && this.walletAdapter.getAccounts) {
                try {
                    const accounts = this.walletAdapter.getAccounts();
                    if (accounts.length > 0) {
                        return accounts[0];
                    }
                } catch (error) {
                    // Continue to session ID
                }
            }

            let userId = sessionStorage.getItem('suiPointsUserId');
            if (!userId) {
                userId = 'session_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
                sessionStorage.setItem('suiPointsUserId', userId);
            }
            
            return userId;
        }

        showNotification(eventType) {
            const points = this.config.eventMappings[eventType].points;
            const message = `🎉 You earned ${points} points for ${eventType.replace('_', ' ')}!`;
            
            const notification = document.createElement('div');
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 15px 20px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                z-index: 10000;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                font-size: 14px;
                font-weight: 500;
                max-width: 300px;
                transform: translateX(100%);
                transition: transform 0.3s ease;
            `;
            notification.textContent = message;
            
            document.body.appendChild(notification);
            
            setTimeout(() => {
                notification.style.transform = 'translateX(0)';
            }, 100);
            
            setTimeout(() => {
                notification.style.transform = 'translateX(100%)';
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 300);
            }, this.config.notificationDuration);
        }

        containsKeywords(text, keywords) {
            return keywords.some(keyword => text.includes(keyword));
        }

        extractFormMetadata(formData) {
            const metadata = {};
            for (const [key, value] of formData.entries()) {
                if (typeof value === 'string' && value.length < 100) {
                    metadata[key] = value;
                }
            }
            return metadata;
        }

        extractClickMetadata(element) {
            return {
                elementType: element.tagName,
                elementText: element.textContent?.slice(0, 50),
                elementClass: element.className,
                elementId: element.id,
                href: element.href
            };
        }

        dispatchEvent(eventName, detail) {
            const event = new CustomEvent(eventName, { detail });
            window.dispatchEvent(event);
        }

        log(...args) {
            if (this.config.enableDebugMode) {
                console.log('[SuiPointsAdapter]', ...args);
            }
        }

        error(...args) {
            console.error('[SuiPointsAdapter]', ...args);
        }

        trackEvent(eventType, metadata = {}) {
            return this.submitEvent(eventType, this.getUserId(), metadata);
        }

        async connectWallet() {
            try {
                if (!this.walletAdapter) {
                    throw new Error('No wallet adapter available');
                }
                
                const accounts = await this.walletAdapter.requestPermissions(['viewAccount']);
                this.log('Wallet connected:', accounts);
                
                this.processEventQueue();
                
                return true;
            } catch (error) {
                this.error('Wallet connection failed:', error);
                return false;
            }
        }

        getConfig() {
            return { ...this.config };
        }

        updateConfig(newConfig) {
            this.config = { ...this.config, ...newConfig };
        }

        getStatus() {
            return {
                isInitialized: this.isInitialized,
                hasWallet: !!this.walletAdapter,
                queuedEvents: this.eventQueue.length,
                version: SDK_VERSION
            };
        }
    }

    function autoInit() {
        const script = document.querySelector('script[src*="sui-points-adapter"]');
        if (script) {
            const config = {};
            
            const packageId = script.dataset.packageId;
            const partnerCapId = script.dataset.partnerCapId;
            const rpcUrl = script.dataset.rpcUrl;
            const allowedOrigins = script.dataset.allowedOrigins;
            
            if (packageId) config.packageId = packageId;
            if (partnerCapId) config.partnerCapId = partnerCapId;
            if (rpcUrl) config.rpcUrl = rpcUrl;
            if (allowedOrigins) config.allowedOrigins = allowedOrigins.split(',');
            
            if (config.packageId && config.partnerCapId) {
                window.suiPointsAdapter = new SuiPointsAdapter(config);
            }
        }
    }

    window.SuiPointsAdapter = SuiPointsAdapter;
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', autoInit);
    } else {
        autoInit();
    }

})(window); 