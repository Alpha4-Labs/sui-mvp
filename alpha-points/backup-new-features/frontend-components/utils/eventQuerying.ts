import { SuiClient } from '@mysten/sui/client';
import { ALL_PACKAGE_IDS } from '../config/contract';

export interface ParsedEvent {
  id: string;
  type: 'perk_created' | 'perk_claimed' | 'points_earned' | 'points_spent' | 'points_locked' | 'points_unlocked' | 'stake_created' | 'stake_unlocked' | 'loan_created' | 'loan_repaid' | 'early_unstake' | 'engagement_milestone' | 'package_upgrade' | 'partner_created';
  timestamp: Date;
  amount?: number;
  userAddress?: string;
  txDigest?: string;
  eventData?: any;
}

// Helper function to create unique activity ID based on transaction digest
export const createUniqueEventId = (eventType: string, event: any): string => {
  const eventSeq = event.id?.eventSeq;
  const txDigest = event.id?.txDigest;
  const timestamp = event.timestampMs || Date.now();
  
  // Use transaction digest + eventSeq as primary identifier to prevent duplicates
  if (txDigest && eventSeq) {
    return `${eventType}-${txDigest}-${eventSeq}`;
  }
  
  // Fallback with just transaction digest
  if (txDigest) {
    return `${eventType}-${txDigest}-${timestamp}`;
  }
  
  // Fallback for events without digest - use eventSeq if available
  if (eventSeq) {
    return `${eventType}-seq-${eventSeq}`;
  }
  
  // Final fallback
  return `${eventType}-${timestamp}-${Math.random().toString(36).substr(2, 5)}`;
};

// Helper function to validate parsed event data
export const isValidEventData = (event: ParsedEvent): boolean => {
  // Basic validation - must have valid type and timestamp
  if (!event.type || !event.timestamp) {
    return false;
  }
  
  // For events with amounts, ensure they're meaningful (greater than 0)
  if (event.amount !== undefined && event.amount <= 0) {
    return false;
  }
  
  return true;
};

export interface QueryEventsOptions {
  userAddress: string;
  suiClient: SuiClient;
  limit?: number;
  onlyUserActivity?: boolean; // If true, only return events where user is the actor
}

export const queryUserEvents = async (options: QueryEventsOptions): Promise<ParsedEvent[]> => {
  const { userAddress, suiClient, limit = 50, onlyUserActivity = false } = options;
  
  // Single efficient query: get user's recent transactions
  const txns = await suiClient.queryTransactionBlocks({
    filter: { FromAddress: userAddress }, // Get transactions sent by the user
    options: {
      showEffects: true,
      showEvents: true,
      showInput: true,
      showObjectChanges: true,
    },
    order: 'descending',
    limit: limit
  });

  const allEvents: ParsedEvent[] = [];
  const seenIds = new Set<string>();
  
  // Process each transaction locally
  txns.data.forEach((tx) => {
    if (!tx.events) return;
    
    const txTimestamp = new Date(parseInt(tx.timestampMs || '0'));
    
    tx.events.forEach((event) => {
      const eventData = event.parsedJson;
      const eventType = event.type;
      const txDigest = tx.digest;
      
      // Check if this is an Alpha Points related event
      const isAlphaEvent = ALL_PACKAGE_IDS.some(pkgId => eventType?.includes(pkgId || ''));
      if (!isAlphaEvent) return;
      
      const isUserActivity = eventData?.user === userAddress || 
                            eventData?.staker === userAddress || 
                            eventData?.borrower === userAddress || 
                            eventData?.claimer === userAddress;

      // If onlyUserActivity is true, skip events where user is not the actor
      if (onlyUserActivity && !isUserActivity) return;

      let parsedEvent: ParsedEvent | null = null;

      // Parse event type locally
      const eventTypeParts = eventType?.split('::') || [];
      const moduleName = eventTypeParts[1];
      const eventName = eventTypeParts[2];

      if (!moduleName || !eventName) return;

      // Handle different event types
      switch (`${moduleName}::${eventName}`) {
        case 'ledger::Earned':
          const earnedAmount = eventData?.amount;
          if (earnedAmount && earnedAmount > 0) {
            parsedEvent = {
              id: createUniqueEventId('earned', { id: { txDigest, eventSeq: event.id?.eventSeq }, timestampMs: tx.timestampMs }),
              type: 'points_earned',
              timestamp: txTimestamp,
              amount: earnedAmount,
              userAddress: eventData?.user,
              txDigest,
              eventData
            };
          }
          break;

        case 'ledger::Spent':
          const spentAmount = eventData?.amount;
          if (spentAmount && spentAmount > 0) {
            parsedEvent = {
              id: createUniqueEventId('spent', { id: { txDigest, eventSeq: event.id?.eventSeq }, timestampMs: tx.timestampMs }),
              type: 'points_spent',
              timestamp: txTimestamp,
              amount: spentAmount,
              userAddress: eventData?.user,
              txDigest,
              eventData
            };
          }
          break;

        case 'integration::StakeDeposited':
        case 'integration::NativeStakeStored':
          parsedEvent = {
            id: createUniqueEventId('stake', { id: { txDigest, eventSeq: event.id?.eventSeq }, timestampMs: tx.timestampMs }),
            type: 'stake_created',
            timestamp: txTimestamp,
            amount: eventData?.principal,
            userAddress: eventData?.staker,
            txDigest,
            eventData
          };
          break;

        case 'integration::EarlyUnstakeForAlphaPoints':
          const alphaPointsAwarded = eventData?.alpha_points_awarded;
          const principal = eventData?.principal;
          
          if (alphaPointsAwarded && principal && alphaPointsAwarded > 0 && principal > 0) {
            parsedEvent = {
              id: createUniqueEventId('early-unstake', { id: { txDigest, eventSeq: event.id?.eventSeq }, timestampMs: tx.timestampMs }),
              type: 'early_unstake',
              timestamp: txTimestamp,
              amount: alphaPointsAwarded,
              userAddress: eventData?.staker,
              txDigest,
              eventData
            };
          }
          break;

        case 'loan::LoanOpened':
          parsedEvent = {
            id: createUniqueEventId('loan', { id: { txDigest, eventSeq: event.id?.eventSeq }, timestampMs: tx.timestampMs }),
            type: 'loan_created',
            timestamp: txTimestamp,
            amount: eventData?.principal_points,
            userAddress: eventData?.borrower,
            txDigest,
            eventData
          };
          break;

        case 'perk::PerkClaimed':
          parsedEvent = {
            id: createUniqueEventId('perk-claim', { id: { txDigest, eventSeq: event.id?.eventSeq }, timestampMs: tx.timestampMs }),
            type: 'perk_claimed',
            timestamp: txTimestamp,
            amount: eventData?.cost_alpha_points,
            userAddress: eventData?.user_address,
            txDigest,
            eventData
          };
          break;
      }

      // Add valid events
      if (parsedEvent && !seenIds.has(parsedEvent.id) && isValidEventData(parsedEvent)) {
        seenIds.add(parsedEvent.id);
        allEvents.push(parsedEvent);
      }
    });
  });

  // Sort by timestamp (newest first)
  allEvents.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  
  return allEvents;
}; 
