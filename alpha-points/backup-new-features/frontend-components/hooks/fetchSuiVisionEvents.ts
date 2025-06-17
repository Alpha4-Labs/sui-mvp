// Utility to fetch and aggregate SuiVision events for a user
// https://docs.blockvision.org/reference/retrieve-account-events

import { SuiClient, getFullnodeUrl, EventId } from '@mysten/sui/client';
import { NETWORK_TYPE } from '../config/network'; // Import NETWORK_TYPE

export interface SuiVisionEvent {
  type: 'earned' | 'spent' | 'locked' | 'unlocked';
  amount: number;
  timestamp: number; // ms
}

const EVENT_TYPE_MAP: Record<string, SuiVisionEvent['type']> = {
  'alpha_points::ledger::Earned': 'earned',
  'alpha_points::ledger::Spent': 'spent',
  'alpha_points::ledger::Locked': 'locked',
  'alpha_points::ledger::Unlocked': 'unlocked',
};

const API_KEY = import.meta.env['VITE_BLOCKVISION_API_KEY'];
const BASE_URL = import.meta.env['VITE_BLOCKVISION_HTTPS'] || 'https://api.blockvision.org';
if (!import.meta.env['VITE_BLOCKVISION_HTTPS']) {
  console.warn('BlockVision HTTPS endpoint (VITE_BLOCKVISION_HTTPS) not set. Using default https://api.blockvision.org.');
}

// In-memory session cache for events and balances
const eventCache = new Map<string, any>();

/**
 * Fetches SuiVision account activities for a user address, paginates, and maps to SuiVisionEvent[]
 * For testnet: uses Sui RPC (Mysten Sui SDK) to fetch transactions/events.
 * For mainnet: uses BlockVision /v2/sui/account/activities endpoint.
 * Filters by timestamp (from/to) in JS after fetch.
 * Maps activity types to: earned, spent, locked, unlocked.
 * Uses in-memory cache for session performance. Pass forceRefresh=true to bypass cache.
 */
export async function fetchSuiVisionEvents(address: string, fromTimestamp: number, toTimestamp: number, forceRefresh = false) {
  const cacheKey = `${address.toLowerCase()}-${fromTimestamp}-${toTimestamp}`;
  if (!forceRefresh && eventCache.has(cacheKey)) {
    return eventCache.get(cacheKey);
  }
  // --- Use Sui RPC for testnet, devnet, localnet ---
  if (NETWORK_TYPE === 'testnet' || NETWORK_TYPE === 'devnet' || NETWORK_TYPE === 'localnet') {
    // Use Mysten Sui SDK to fetch transactions and events
    const client = new SuiClient({ url: getFullnodeUrl(NETWORK_TYPE) });
    // Fetch all relevant Alpha Point events (Earned, Spent, Locked, Unlocked) for the address
    const eventTypes = [
      'alpha_points::ledger::Earned',
      'alpha_points::ledger::Spent',
      'alpha_points::ledger::Locked',
      'alpha_points::ledger::Unlocked',
    ];
    let allEvents: SuiVisionEvent[] = [];
    for (const moveEventType of eventTypes) {
      let cursor: EventId | null | undefined = null;
      let hasNext = true;
      while (hasNext) {
        const res = await client.queryEvents({
          query: { MoveEventType: moveEventType },
          cursor,
          limit: 50,
          order: 'descending',
        });
        const events = (res.data || []).map((e: any) => ({
          type: EVENT_TYPE_MAP[moveEventType],
          amount: Number(e.parsedJson?.amount) || 0,
          timestamp: Number(e.timestampMs) || 0,
          user: e.parsedJson?.user || '',
        }))
        // Only include events for the current user
        .filter(e => e.user.toLowerCase() === address.toLowerCase());
        allEvents = allEvents.concat(events);
        cursor = res.nextCursor;
        hasNext = !!cursor && res.data && res.data.length > 0;
      }
    }
    // Debug log

    // Filter by timestamp window
    allEvents = allEvents.filter(e => e.timestamp >= fromTimestamp && e.timestamp <= toTimestamp);
    // Sort by timestamp ascending
    allEvents.sort((a, b) => a.timestamp - b.timestamp);
    // Reconstruct daily running balance for the window
    const days = Math.ceil((toTimestamp - fromTimestamp) / (24 * 60 * 60 * 1000));
    const dailyBalances: { timestamp: number; balance: number }[] = [];
    let runningBalance = 0;
    let eventIdx = 0;
    for (let i = 0; i < days; i++) {
      const dayStart = fromTimestamp + i * 24 * 60 * 60 * 1000;
      const dayEnd = dayStart + 24 * 60 * 60 * 1000;
      // Apply all events for this day
      while (eventIdx < allEvents.length && allEvents[eventIdx].timestamp < dayEnd) {
        const e = allEvents[eventIdx];
        if (e.type === 'earned' || e.type === 'unlocked') runningBalance += e.amount;
        if (e.type === 'spent' || e.type === 'locked') runningBalance -= e.amount;
        eventIdx++;
      }
      dailyBalances.push({ timestamp: dayStart, balance: runningBalance });
    }
    // Debug log

    eventCache.set(cacheKey, dailyBalances);
    return dailyBalances;
  }

  // --- MAINNET: Use BlockVision ---
  // This part will only be reached if NETWORK_TYPE is 'mainnet'
  const endpoint = `${BASE_URL}/v2/sui/account/activities`;
  let cursor = '';
  let hasNext = true;
  const limit = 50;
  const allActivities: any[] = [];

  while (hasNext) {
    const body = {
      address,
      cursor,
      limit,
    };
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(API_KEY ? { 'X-API-Key': API_KEY } : {}),
      },
      body: JSON.stringify(body),
    });
    if (res.status === 404) {
      console.error('BlockVision API error: 404 (Not Found) for /v2/sui/account/activities. This endpoint is mainnet-only.');
      break;
    }
    if (!res.ok) {
      console.error('BlockVision API error:', res.status, await res.text());
      break;
    }
    const data = await res.json();
    if (Array.isArray(data.data)) {
      allActivities.push(...data.data);
    }
    cursor = data.nextPageCursor || '';
    hasNext = !!cursor && data.data && data.data.length === limit;
  }

  // Filter by timestamp (ms)
  const filtered = allActivities.filter((a) => {
    const ts = Number(a.timestamp) * 1000;
    return ts >= fromTimestamp && ts <= toTimestamp;
  });

  // Map to SuiVisionEvent[]
  // Refine this mapping for Alpha Points and loan flows
  const events = filtered.map((a) => {
    let type: SuiVisionEvent['type'] = 'earned';
    // --- Alpha Points logic (adjust as needed for your contract) ---
    if (a.activity_type === 'TransferOut' || a.activity_type === 'Pay') type = 'spent';
    else if (a.activity_type === 'StakeLock') type = 'locked';
    else if (a.activity_type === 'StakeUnlock') type = 'unlocked';
    // Example: Loan inflow/outflow (customize as needed)
    // if (a.activity_type === 'LoanInflow') type = 'loan_inflow';
    // if (a.activity_type === 'LoanOutflow') type = 'loan_outflow';
    // Log unknowns for future refinement
    else if (!['TransferIn','TransferOut','Pay','StakeLock','StakeUnlock'].includes(a.activity_type)) {
      console.warn('Unknown activity_type for Alpha Points:', a.activity_type, a);
    }
    return {
      type,
      amount: Number(a.amount) || 0,
      timestamp: Number(a.timestamp) * 1000,
    };
  });

  // Reconstruct daily running balance for the window
  const days = Math.ceil((toTimestamp - fromTimestamp) / (24 * 60 * 60 * 1000));
  const dailyBalances: { timestamp: number; balance: number }[] = [];
  let runningBalance = 0;
  let eventIdx = 0;
  for (let i = 0; i < days; i++) {
    const dayStart = fromTimestamp + i * 24 * 60 * 60 * 1000;
    const dayEnd = dayStart + 24 * 60 * 60 * 1000;
    // Apply all events for this day
    while (eventIdx < events.length && events[eventIdx].timestamp < dayEnd) {
      const e = events[eventIdx];
      if (e.type === 'earned' || e.type === 'unlocked') runningBalance += e.amount;
      if (e.type === 'spent' || e.type === 'locked') runningBalance -= e.amount;
      eventIdx++;
    }
    dailyBalances.push({ timestamp: dayStart, balance: runningBalance });
  }

  eventCache.set(cacheKey, dailyBalances);
  return dailyBalances;
} 