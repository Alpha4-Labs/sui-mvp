import type { DiscordUser } from '../types/index.js';

// Discord OAuth configuration
const DISCORD_CLIENT_ID = import.meta.env.VITE_DISCORD_CLIENT_ID || '1380238017268154439';
const DISCORD_REDIRECT_URI = import.meta.env.VITE_DISCORD_REDIRECT_URI || `${window.location.origin}/`;
const DISCORD_SCOPES = ['identify', 'email'];

export class DiscordAuthService {
  private static instance: DiscordAuthService;
  private accessToken: string | null = null;
  private user: DiscordUser | null = null;

  private constructor() {
    // Load from localStorage if available
    this.loadFromStorage();
  }

  static getInstance(): DiscordAuthService {
    if (!DiscordAuthService.instance) {
      DiscordAuthService.instance = new DiscordAuthService();
    }
    return DiscordAuthService.instance;
  }

  private loadFromStorage(): void {
    const token = localStorage.getItem('discord_access_token');
    const user = localStorage.getItem('discord_user');
    
    if (token && user) {
      this.accessToken = token;
      this.user = JSON.parse(user);
    }
  }

  private saveToStorage(): void {
    if (this.accessToken && this.user) {
      localStorage.setItem('discord_access_token', this.accessToken);
      localStorage.setItem('discord_user', JSON.stringify(this.user));
    }
  }

  private clearStorage(): void {
    localStorage.removeItem('discord_access_token');
    localStorage.removeItem('discord_user');
  }

  /**
   * Generates the Discord OAuth URL and redirects user using implicit flow
   */
  initiateOAuth(): void {
    const state = this.generateState();
    localStorage.setItem('discord_oauth_state', state);

    const params = new URLSearchParams({
      client_id: DISCORD_CLIENT_ID,
      redirect_uri: DISCORD_REDIRECT_URI,
      response_type: 'token', // Use implicit flow instead of authorization code
      scope: DISCORD_SCOPES.join(' '),
      state,
    });

    const authUrl = `https://discord.com/api/oauth2/authorize?${params.toString()}`;
    
    console.log('Discord OAuth Configuration (Implicit Flow):', {
      clientId: DISCORD_CLIENT_ID,
      redirectUri: DISCORD_REDIRECT_URI,
      scopes: DISCORD_SCOPES,
      state,
      authUrl
    });
    
    window.location.href = authUrl;
  }

  /**
   * Handles the OAuth callback for implicit flow
   */
  async handleCallback(accessToken: string, state: string): Promise<DiscordUser> {
    console.log('Processing Discord OAuth callback...', {
      tokenLength: accessToken.length,
      stateLength: state.length,
      timestamp: new Date().toISOString()
    });
    
    const storedState = localStorage.getItem('discord_oauth_state');
    console.log('State validation:', {
      provided: state,
      stored: storedState,
      match: storedState === state
    });
    
    if (!storedState) {
      throw new Error('No stored OAuth state found - please try connecting again');
    }
    
    if (state !== storedState) {
      console.error('State mismatch:', { provided: state, stored: storedState });
      throw new Error('Invalid OAuth state - possible CSRF attack or expired session');
    }

    localStorage.removeItem('discord_oauth_state');

    try {
      // Use the access token directly (implicit flow)
      this.accessToken = accessToken;

      // Fetch user info
      console.log('Fetching Discord user info...');
      const userResponse = await fetch('https://discord.com/api/users/@me', {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      });

      console.log('Discord API response:', {
        status: userResponse.status,
        statusText: userResponse.statusText,
        headers: Object.fromEntries(userResponse.headers.entries())
      });

      if (!userResponse.ok) {
        const errorText = await userResponse.text();
        console.error('Discord API error details:', {
          status: userResponse.status,
          statusText: userResponse.statusText,
          body: errorText
        });
        
        if (userResponse.status === 401) {
          throw new Error('Invalid or expired Discord access token - please try connecting again');
        } else if (userResponse.status === 429) {
          throw new Error('Rate limited by Discord API - please wait a moment and try again');
        } else {
          throw new Error(`Discord API error: ${userResponse.status} ${userResponse.statusText}`);
        }
      }

      const userData = await userResponse.json();
      console.log('Discord user data received:', {
        id: userData.id,
        username: userData.username,
        hasAvatar: !!userData.avatar,
        hasEmail: !!userData.email
      });
      
      this.user = {
        id: userData.id,
        username: userData.username,
        discriminator: userData.discriminator || '0',
        avatar: userData.avatar,
        email: userData.email,
      };

      this.saveToStorage();
      
      console.log('Discord user authenticated successfully:', { 
        username: this.user.username, 
        id: this.user.id,
        timestamp: new Date().toISOString()
      });
      
      return this.user;
    } catch (error) {
      console.error('Discord callback error:', error);
      this.clearStorage();
      
      // Re-throw with more context if it's a generic error
      if (error instanceof Error) {
        throw error;
      } else {
        throw new Error(`Discord authentication failed: ${String(error)}`);
      }
    }
  }

  /**
   * Get current authenticated user
   */
  getCurrentUser(): DiscordUser | null {
    return this.user;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.accessToken !== null && this.user !== null;
  }

  /**
   * Logout user
   */
  logout(): void {
    this.accessToken = null;
    this.user = null;
    this.clearStorage();
  }

  /**
   * Verify token is still valid
   */
  async verifyToken(): Promise<boolean> {
    if (!this.accessToken) return false;

    try {
      const response = await fetch('https://discord.com/api/users/@me', {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  private generateState(): string {
    return btoa(Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15));
  }
} 