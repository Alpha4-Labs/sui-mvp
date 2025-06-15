import { SuiClient } from '@mysten/sui/client';
import { SUI_CONFIG } from '../config/sui';

export async function testNetworkConnectivity(): Promise<{
  success: boolean;
  message: string;
  details?: any;
}> {
  try {
    console.log('🌐 Testing network connectivity...');
    console.log('🌐 RPC URL:', SUI_CONFIG.rpcUrl);
    console.log('🌐 Network:', SUI_CONFIG.network);
    
    const client = new SuiClient({ url: SUI_CONFIG.rpcUrl });
    
    // Test basic connectivity
    const startTime = Date.now();
    const chainId = await client.getChainIdentifier();
    const responseTime = Date.now() - startTime;
    
    console.log('🌐 Chain ID:', chainId);
    console.log('🌐 Response time:', responseTime, 'ms');
    
    // Test if we can get system state (simpler test)
    const systemState = await client.getLatestSuiSystemState();
    
    console.log('🌐 System state available:', !!systemState);
    
    return {
      success: true,
      message: `Connected to ${SUI_CONFIG.network} (${responseTime}ms)`,
      details: {
        chainId,
        responseTime,
        network: SUI_CONFIG.network,
        rpcUrl: SUI_CONFIG.rpcUrl,
        hasSystemState: !!systemState
      }
    };
    
  } catch (error) {
    console.error('❌ Network connectivity test failed:', error);
    
    let errorMessage = 'Network connection failed';
    
    if (error instanceof Error) {
      if (error.message.includes('Failed to fetch')) {
        errorMessage = 'Cannot reach Sui network. Check internet connection.';
      } else if (error.message.includes('timeout')) {
        errorMessage = 'Network request timed out.';
      } else {
        errorMessage = `Network error: ${error.message}`;
      }
    }
    
    return {
      success: false,
      message: errorMessage,
      details: error
    };
  }
}

export async function testWalletTransaction(userAddress: string): Promise<{
  success: boolean;
  message: string;
  details?: any;
}> {
  try {
    console.log('💰 Testing wallet transaction capabilities...');
    console.log('💰 User address:', userAddress);
    
    const client = new SuiClient({ url: SUI_CONFIG.rpcUrl });
    
    // Get user's coins to see if they have any SUI
    const coins = await client.getCoins({
      owner: userAddress,
      coinType: '0x2::sui::SUI',
      limit: 5
    });
    
    console.log('💰 Available SUI coins:', coins.data.length);
    
    const totalBalance = coins.data.reduce((sum, coin) => {
      return sum + BigInt(coin.balance);
    }, BigInt(0));
    
    console.log('💰 Total SUI balance:', totalBalance.toString(), 'MIST');
    
    if (totalBalance === BigInt(0)) {
      return {
        success: false,
        message: 'No SUI balance available for transactions',
        details: { balance: '0', coinCount: coins.data.length }
      };
    }
    
    return {
      success: true,
      message: `Wallet ready for transactions (${totalBalance.toString()} MIST available)`,
      details: {
        balance: totalBalance.toString(),
        coinCount: coins.data.length,
        coins: coins.data.map(c => ({ id: c.coinObjectId, balance: c.balance }))
      }
    };
    
  } catch (error) {
    console.error('❌ Wallet transaction test failed:', error);
    
    return {
      success: false,
      message: `Wallet test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: error
    };
  }
} 