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

    // SDK Configuration
    const SDK_VERSION = '1.0.0';
    const DEFAULT_CONFIG = {
        // Sui Network Configuration
        rpcUrl: 'https://fullnode.testnet.sui.io:443',
        packageId: null, // Set by partner configuration
        partnerCapId: null, // Set by partner configuration
        
        // Event Configuration
        eventMappings: {
            user_signup: { points: 50, cooldown: 86400000 }, // 24 hours
            purchase_completed: { points: 100, cooldown: 0 },
            newsletter_signup: { points: 25, cooldown: 604800000 }, // 7 days
            social_share: { points: 15, cooldown: 3600000 }, // 1 hour
            profile_completed: { points: 75, cooldown: 86400000 }, // 24 hours
            referral_successful: { points: 200, cooldown: 0 }
        },
        
        // Security Configuration
        allowedOrigins: [], // Set by partner configuration
        maxEventsPerHour: 10,
        enableAutoDetection: true,
        enableDebugMode: false,
        
        // UI Configuration
        showNotifications: true,
        notificationDuration: 3000,
        customStyles: {}
    };

    /**
     * Main Sui Points Adapter Class
     */
    class SuiPointsAdapter {
        constructor(config = {}) {
            this.config = { ...DEFAULT_CONFIG, ...config };
            this.eventQueue = [];
            this.rateLimitCache = new Map();
            this.isInitialized = false;
            this.suiClient = null;
            this.walletAdapter = null;
            
            // Validate required configuration
            this.validateConfig();
            
            // Initialize the adapter
            this.init();
        }

        /**
         * Validate required configuration parameters
         */
        validateConfig() {
            if (!this.config.packageId) {
                throw new Error('SuiPointsAdapter: packageId is required');
            }
            if (!this.config.partnerCapId) {
                throw new Error('SuiPointsAdapter: partnerCapId is required');
            }
            
            // Validate origin if specified
            if (this.config.allowedOrigins.length > 0) {
                const currentOrigin = window.location.origin;
                if (!this.config.allowedOrigins.includes(currentOrigin)) {
                    throw new Error(`SuiPointsAdapter: Origin ${currentOrigin} not allowed`);
                }
            }
        }

        /**
         * Initialize the SDK
         */
        async init() {
            try {
                this.log('Initializing Sui Points Adapter v' + SDK_VERSION);
                
                // Initialize Sui client
                await this.initializeSuiClient();
                
                // Setup auto-detection if enabled
                if (this.config.enableAutoDetection) {
                    this.setupAutoDetection();
                }
                
                // Setup wallet connection
                await this.setupWalletConnection();
                
                // Process any queued events
                this.processEventQueue();
                
                this.isInitialized = true;
                this.log('Sui Points Adapter initialized successfully');
                
                // Emit ready event
                this.dispatchEvent('suiPointsReady', { adapter: this });
                
            } catch (error) {
                this.error('Failed to initialize Sui Points Adapter:', error);
                throw error;
            }
        }

        /**
         * Initialize Sui client
         */
        async initializeSuiClient() {
            try {
                // Load Sui SDK if not already loaded
                if (typeof window.SuiClient === 'undefined') {
                    await this.loadSuiSDK();
                }
                
                this.suiClient = new window.SuiClient({ 
                    url: this.config.rpcUrl 
                });
                
                // Test connection
                await this.suiClient.getLatestSuiSystemState();
                this.log('Sui client connected successfully');
                
            } catch (error) {
                this.error('Failed to initialize Sui client:', error);
                throw error;
            }
        }

        /**
         * Load Sui SDK dynamically
         */
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

        /**
         * Setup wallet connection
         */
        async setupWalletConnection() {
            try {
                // Check for Sui wallet
                if (typeof window.suiWallet !== 'undefined') {
                    this.walletAdapter = window.suiWallet;
                } else if (typeof window.sui !== 'undefined') {
                    this.walletAdapter = window.sui;
                } else {
                    this.log('No Sui wallet detected - events will be queued');
                    return;
                }
                
                // Request wallet connection
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

        /**
         * Setup automatic event detection
         */
        setupAutoDetection() {
            this.log('Setting up automatic event detection');
            
            // Form submission detection (signup, newsletter)
            this.detectFormSubmissions();
            
            // Button click detection (purchases, social shares)
            this.detectButtonClicks();
            
            // URL change detection (page completion)
            this.detectPageChanges();
            
            // Custom event listeners
            this.setupCustomEventListeners();
        }

        /**
         * Detect form submissions
         */
        detectFormSubmissions() {
            document.addEventListener('submit', (event) => {
                const form = event.target;
                if (!form || form.tagName !== 'FORM') return;
                
                // Analyze form to determine event type
                const eventType = this.analyzeForm(form);
                if (eventType) {
                    const formData = new FormData(form);
                    const metadata = this.extractFormMetadata(formData);
                    
                    this.submitEvent(eventType, this.getUserId(), metadata);
                }
            });
        }

        /**
         * Analyze form to determine event type
         */
        analyzeForm(form) {
            const formHTML = form.innerHTML.toLowerCase();
            const formAction = form.action?.toLowerCase() || '';
            const formClass = form.className?.toLowerCase() || '';
            const formId = form.id?.toLowerCase() || '';
            
            // Check for signup forms
            if (this.containsKeywords(formHTML + formAction + formClass + formId, [
                'signup', 'sign-up', 'register', 'registration', 'create-account', 'join'
            ])) {
                return 'user_signup';
            }
            
            // Check for newsletter forms
            if (this.containsKeywords(formHTML + formAction + formClass + formId, [
                'newsletter', 'subscribe', 'email-signup', 'mailing-list'
            ])) {
                return 'newsletter_signup';
            }
            
            return null;
        }

        /**
         * Detect button clicks
         */
        detectButtonClicks() {
            document.addEventListener('click', (event) => {
                const element = event.target;
                if (!element) return;
                
                // Analyze clicked element
                const eventType = this.analyzeClickedElement(element);
                if (eventType) {
                    const metadata = this.extractClickMetadata(element);
                    this.submitEvent(eventType, this.getUserId(), metadata);
                }
            });
        }

        /**
         * Analyze clicked element to determine event type
         */
        analyzeClickedElement(element) {
            const text = element.textContent?.toLowerCase() || '';
            const className = element.className?.toLowerCase() || '';
            const id = element.id?.toLowerCase() || '';
            const href = element.href?.toLowerCase() || '';
            
            const combined = text + ' ' + className + ' ' + id + ' ' + href;
            
            // Check for purchase buttons
            if (this.containsKeywords(combined, [
                'buy', 'purchase', 'checkout', 'pay', 'order', 'cart', 'add-to-cart'
            ])) {
                return 'purchase_completed';
            }
            
            // Check for social share buttons
            if (this.containsKeywords(combined, [
                'share', 'tweet', 'facebook', 'twitter', 'linkedin', 'social'
            ])) {
                return 'social_share';
            }
            
            return null;
        }

        /**
         * Detect page changes for completion events
         */
        detectPageChanges() {
            // Monitor URL changes
            let currentUrl = window.location.href;
            
            const checkUrlChange = () => {
                if (window.location.href !== currentUrl) {
                    const newUrl = window.location.href;
                    const eventType = this.analyzeUrlChange(currentUrl, newUrl);
                    
                    if (eventType) {
                        const metadata = { 
                            fromUrl: currentUrl, 
                            toUrl: newUrl,
                            timestamp: Date.now()
                        };
                        this.submitEvent(eventType, this.getUserId(), metadata);
                    }
                    
                    currentUrl = newUrl;
                }
            };
            
            // Check for URL changes periodically
            setInterval(checkUrlChange, 1000);
            
            // Listen for popstate events
            window.addEventListener('popstate', checkUrlChange);
        }

        /**
         * Analyze URL change to determine event type
         */
        analyzeUrlChange(fromUrl, toUrl) {
            const toPath = new URL(toUrl).pathname.toLowerCase();
            
            // Check for profile completion
            if (this.containsKeywords(toPath, [
                'profile', 'complete', 'dashboard', 'welcome', 'onboarding'
            ])) {
                return 'profile_completed';
            }
            
            return null;
        }

        /**
         * Setup custom event listeners
         */
        setupCustomEventListeners() {
            // Listen for custom events dispatched by the website
            window.addEventListener('suiPointsEvent', (event) => {
                const { eventType, userId, metadata } = event.detail;
                this.submitEvent(eventType, userId, metadata);
            });
            
            // Listen for referral events
            window.addEventListener('referralCompleted', (event) => {
                const { userId, referralData } = event.detail;
                this.submitEvent('referral_successful', userId, referralData);
            });
        }

        /**
         * Submit an event for points
         */
        async submitEvent(eventType, userId, metadata = {}) {
            try {
                this.log(`Submitting event: ${eventType} for user: ${userId}`);
                
                // Validate event type
                if (!this.config.eventMappings[eventType]) {
                    this.error(`Unknown event type: ${eventType}`);
                    return false;
                }
                
                // Check rate limiting
                if (!this.checkRateLimit(eventType, userId)) {
                    this.log(`Rate limit exceeded for ${eventType}`);
                    return false;
                }
                
                // Generate event hash for replay protection
                const eventHash = await this.generateEventHash(eventType, userId, Date.now());
                
                // Queue event if not initialized or no wallet
                if (!this.isInitialized || !this.walletAdapter) {
                    this.queueEvent({ eventType, userId, metadata, eventHash });
                    return true;
                }
                
                // Submit to blockchain
                const success = await this.submitToBlockchain(eventType, userId, eventHash, metadata);
                
                if (success) {
                    // Update rate limiting
                    this.updateRateLimit(eventType, userId);
                    
                    // Show notification
                    if (this.config.showNotifications) {
                        this.showNotification(eventType);
                    }
                    
                    // Dispatch success event
                    this.dispatchEvent('suiPointsEarned', {
                        eventType,
                        points: this.config.eventMappings[eventType].points,
                        userId,
                        metadata
                    });
                }
                
                return success;
                
            } catch (error) {
                this.error('Failed to submit event:', error);
                return false;
            }
        }

        /**
         * Submit event to blockchain
         */
        async submitToBlockchain(eventType, userId, eventHash, metadata) {
            try {
                // Create transaction
                const transaction = new window.SuiTransaction();
                
                transaction.moveCall({
                    target: `${this.config.packageId}::partner_flex::submit_partner_event`,
                    arguments: [
                        transaction.object(this.config.partnerCapId),
                        transaction.pure(eventType),
                        transaction.pure(userId),
                        transaction.pure(eventHash),
                        transaction.pure(JSON.stringify(metadata))
                    ]
                });
                
                // Sign and execute transaction
                const result = await this.walletAdapter.signAndExecuteTransaction({
                    transaction,
                    options: {
                        showEffects: true,
                        showObjectChanges: true
                    }
                });
                
                if (result.effects?.status?.status === 'success') {
                    this.log('Event submitted successfully:', result.digest);
                    return true;
                } else {
                    this.error('Transaction failed:', result.effects?.status);
                    return false;
                }
                
            } catch (error) {
                this.error('Blockchain submission failed:', error);
                return false;
            }
        }

        /**
         * Generate event hash for replay protection
         */
        async generateEventHash(eventType, userId, timestamp) {
            const data = `${eventType}:${userId}:${timestamp}:${window.location.origin}`;
            const encoder = new TextEncoder();
            const dataBuffer = encoder.encode(data);
            const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        }

        /**
         * Check rate limiting
         */
        checkRateLimit(eventType, userId) {
            const key = `${eventType}:${userId}`;
            const now = Date.now();
            
            // Check cooldown
            const cooldown = this.config.eventMappings[eventType].cooldown;
            if (cooldown > 0) {
                const lastEvent = this.rateLimitCache.get(key);
                if (lastEvent && (now - lastEvent) < cooldown) {
                    return false;
                }
            }
            
            // Check hourly rate limit
            const hourKey = `hour:${userId}:${Math.floor(now / 3600000)}`;
            const hourlyCount = this.rateLimitCache.get(hourKey) || 0;
            if (hourlyCount >= this.config.maxEventsPerHour) {
                return false;
            }
            
            return true;
        }

        /**
         * Update rate limiting cache
         */
        updateRateLimit(eventType, userId) {
            const key = `${eventType}:${userId}`;
            const now = Date.now();
            
            // Update cooldown
            this.rateLimitCache.set(key, now);
            
            // Update hourly count
            const hourKey = `hour:${userId}:${Math.floor(now / 3600000)}`;
            const hourlyCount = this.rateLimitCache.get(hourKey) || 0;
            this.rateLimitCache.set(hourKey, hourlyCount + 1);
        }

        /**
         * Queue event for later processing
         */
        queueEvent(eventData) {
            this.eventQueue.push(eventData);
            this.log('Event queued:', eventData.eventType);
        }

        /**
         * Process queued events
         */
        async processEventQueue() {
            if (this.eventQueue.length === 0) return;
            
            this.log(`Processing ${this.eventQueue.length} queued events`);
            
            for (const eventData of this.eventQueue) {
                await this.submitToBlockchain(
                    eventData.eventType,
                    eventData.userId,
                    eventData.eventHash,
                    eventData.metadata
                );
            }
            
            this.eventQueue = [];
        }

        /**
         * Get user ID (can be overridden)
         */
        getUserId() {
            // Try to get from wallet
            if (this.walletAdapter?.getAccounts) {
                const accounts = this.walletAdapter.getAccounts();
                if (accounts.length > 0) {
                    return accounts[0];
                }
            }
            
            // Fallback to session storage
            let userId = sessionStorage.getItem('suiPointsUserId');
            if (!userId) {
                userId = 'user_' + Math.random().toString(36).substr(2, 9);
                sessionStorage.setItem('suiPointsUserId', userId);
            }
            
            return userId;
        }

        /**
         * Show notification to user
         */
        showNotification(eventType) {
            const points = this.config.eventMappings[eventType].points;
            const message = `🎉 You earned ${points} points for ${eventType.replace('_', ' ')}!`;
            
            // Create notification element
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
            
            // Add to page
            document.body.appendChild(notification);
            
            // Animate in
            setTimeout(() => {
                notification.style.transform = 'translateX(0)';
            }, 100);
            
            // Remove after duration
            setTimeout(() => {
                notification.style.transform = 'translateX(100%)';
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 300);
            }, this.config.notificationDuration);
        }

        /**
         * Utility: Check if text contains keywords
         */
        containsKeywords(text, keywords) {
            return keywords.some(keyword => text.includes(keyword));
        }

        /**
         * Extract metadata from form
         */
        extractFormMetadata(formData) {
            const metadata = {};
            for (const [key, value] of formData.entries()) {
                if (typeof value === 'string' && value.length < 100) {
                    metadata[key] = value;
                }
            }
            return metadata;
        }

        /**
         * Extract metadata from clicked element
         */
        extractClickMetadata(element) {
            return {
                elementType: element.tagName,
                elementText: element.textContent?.slice(0, 50),
                elementClass: element.className,
                elementId: element.id,
                href: element.href
            };
        }

        /**
         * Dispatch custom event
         */
        dispatchEvent(eventName, detail) {
            const event = new CustomEvent(eventName, { detail });
            window.dispatchEvent(event);
        }

        /**
         * Logging utility
         */
        log(...args) {
            if (this.config.enableDebugMode) {
                console.log('[SuiPointsAdapter]', ...args);
            }
        }

        /**
         * Error logging utility
         */
        error(...args) {
            console.error('[SuiPointsAdapter]', ...args);
        }

        /**
         * Public API: Manually submit event
         */
        trackEvent(eventType, metadata = {}) {
            return this.submitEvent(eventType, this.getUserId(), metadata);
        }

        /**
         * Public API: Connect wallet
         */
        async connectWallet() {
            try {
                if (!this.walletAdapter) {
                    throw new Error('No wallet adapter available');
                }
                
                const accounts = await this.walletAdapter.requestPermissions(['viewAccount']);
                this.log('Wallet connected:', accounts);
                
                // Process any queued events
                this.processEventQueue();
                
                return true;
            } catch (error) {
                this.error('Wallet connection failed:', error);
                return false;
            }
        }

        /**
         * Public API: Get configuration
         */
        getConfig() {
            return { ...this.config };
        }

        /**
         * Public API: Update configuration
         */
        updateConfig(newConfig) {
            this.config = { ...this.config, ...newConfig };
        }

        /**
         * Public API: Get status
         */
        getStatus() {
            return {
                isInitialized: this.isInitialized,
                hasWallet: !!this.walletAdapter,
                queuedEvents: this.eventQueue.length,
                version: SDK_VERSION
            };
        }
    }

    // Auto-initialization if config is provided via script tag
    function autoInit() {
        const script = document.querySelector('script[src*="sui-points-adapter"]');
        if (script) {
            const config = {};
            
            // Extract config from data attributes
            const packageId = script.dataset.packageId;
            const partnerCapId = script.dataset.partnerCapId;
            const rpcUrl = script.dataset.rpcUrl;
            const allowedOrigins = script.dataset.allowedOrigins;
            
            if (packageId) config.packageId = packageId;
            if (partnerCapId) config.partnerCapId = partnerCapId;
            if (rpcUrl) config.rpcUrl = rpcUrl;
            if (allowedOrigins) config.allowedOrigins = allowedOrigins.split(',');
            
            // Auto-initialize if required config is present
            if (config.packageId && config.partnerCapId) {
                window.suiPointsAdapter = new SuiPointsAdapter(config);
            }
        }
    }

    // Export to global scope
    window.SuiPointsAdapter = SuiPointsAdapter;
    
    // Auto-initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', autoInit);
    } else {
        autoInit();
    }

})(window);
