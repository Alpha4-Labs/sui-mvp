import { SuiClient } from '@mysten/sui/client';
import { ALL_PACKAGE_IDS } from '../config/contract';

export interface AnalyticsData {
  currentBalance: number;
  lockedBalance: number;
  totalPoints: number;
  totalPointsEarned: number;
  totalPointsSpent: number;
  highestSingleReward: number;
  firstStakeDate: Date | null;
  totalStakingDays: number;
  averageDailyEarnings: number;
  totalStakedSui: number;
  perksRedeemed: number;
  referralEarnings: number;
  activeLoans: number;
  totalLoans: number;
  stakePositions: any[];
  loans: any[];
  totalTransactions: number;
}

const NATIVE_STAKED_SUI_TYPE_ARG = '0x3::staking_pool::StakedSui';

export async function fetchAnalyticsData({
  suiClient,
  userAddress,
  packageId,
  ledgerId,
}: {
  suiClient: SuiClient;
  userAddress: string;
  packageId: string;
  ledgerId: string;
}): Promise<AnalyticsData> {
  // 1. Fetch point balances (latest package only)
  const txb = suiClient.newTransactionBlock();
  txb.moveCall({
    target: `${packageId}::ledger::get_available_balance`,
    arguments: [txb.object(ledgerId), txb.pure.address(userAddress)],
  });
  txb.moveCall({
    target: `${packageId}::ledger::get_locked_balance`,
    arguments: [txb.object(ledgerId), txb.pure.address(userAddress)],
  });
  const pointBalancePromise = suiClient.devInspectTransactionBlock({
    sender: userAddress,
    transactionBlock: txb,
  });

  // 2. Aggregate all StakePosition, Loan objects, and Earned/Spent events across ALL_PACKAGE_IDS
  const stakePositionsAll: any[] = [];
  const loansAll: any[] = [];
  let earnedEventsAll: any[] = [];
  let spentEventsAll: any[] = [];

  await Promise.all(
    ALL_PACKAGE_IDS.map(async (pkgId) => {
      // StakePositions
      try {
        const stakeRes = await suiClient.getOwnedObjects({
          owner: userAddress,
          filter: {
            StructType: `${pkgId}::stake_position::StakePosition<${NATIVE_STAKED_SUI_TYPE_ARG}>`,
          },
          options: { showContent: true, showType: true },
        });
        if (stakeRes.data) stakePositionsAll.push(...stakeRes.data.map(obj => obj.data?.content?.fields || {}));
      } catch (e) {
        // Ignore errors for missing packages
      }
      // Loans
      try {
        const loanRes = await suiClient.getOwnedObjects({
          owner: userAddress,
          filter: {
            StructType: `${pkgId}::loan::Loan`,
          },
          options: { showContent: true, showType: true },
        });
        if (loanRes.data) loansAll.push(...loanRes.data.map(obj => obj.data?.content?.fields || {}));
      } catch (e) {
        // Ignore errors for missing packages
      }
      // Earned events
      try {
        const earnedRes = await suiClient.queryEvents({
          query: { MoveEventType: `${pkgId}::ledger::Earned` },
          order: 'ascending',
          limit: 1000,
        });
        if (earnedRes.data) earnedEventsAll.push(...earnedRes.data.filter(e => e.parsedJson?.user === userAddress));
      } catch (e) {
        // Ignore errors for missing packages
      }
      // Spent events
      try {
        const spentRes = await suiClient.queryEvents({
          query: { MoveEventType: `${pkgId}::ledger::Spent` },
          order: 'ascending',
          limit: 1000,
        });
        if (spentRes.data) spentEventsAll.push(...spentRes.data.filter(e => e.parsedJson?.user === userAddress));
      } catch (e) {
        // Ignore errors for missing packages
      }
    })
  );

  // Debug logging
  console.log('[fetchAnalyticsData] StakePositions:', stakePositionsAll.length, 'Loans:', loansAll.length, 'EarnedEvents:', earnedEventsAll.length, 'SpentEvents:', spentEventsAll.length);

  // Await point balances
  const pointBalanceResult = await pointBalancePromise;

  // Parse balances
  let available = 0;
  let locked = 0;
  if (pointBalanceResult.results && pointBalanceResult.results.length >= 2) {
    const availableResult = pointBalanceResult.results[0];
    const lockedResult = pointBalanceResult.results[1];
    if (availableResult?.returnValues?.[0]) {
      const [bytes, type] = availableResult.returnValues[0];
      if (type === 'u64' && Array.isArray(bytes)) {
        available = decodeU64(bytes);
      }
    }
    if (lockedResult?.returnValues?.[0]) {
      const [bytes, type] = lockedResult.returnValues[0];
      if (type === 'u64' && Array.isArray(bytes)) {
        locked = decodeU64(bytes);
      }
    }
  }
  const totalPoints = available + locked;

  // Calculate total staked SUI
  const totalStakedSui = stakePositionsAll.reduce((sum, pos) => {
    const principal = pos.amount ? parseFloat(pos.amount) : 0;
    return sum + principal / 1_000_000_000;
  }, 0);

  // Parse events
  const totalPointsEarned = earnedEventsAll.reduce((sum, e) => sum + parseInt(e.parsedJson.amount || '0'), 0);
  const totalPointsSpent = spentEventsAll.reduce((sum, e) => sum + parseInt(e.parsedJson.amount || '0'), 0);
  const highestSingleReward = earnedEventsAll.reduce((max, e) => Math.max(max, parseInt(e.parsedJson.amount || '0')), 0);

  // Use earliest startTimeMs from all stake positions for firstStakeDate
  let firstStakeDate: Date | null = null;
  if (stakePositionsAll.length > 0) {
    const minStart = Math.min(...stakePositionsAll.map(pos => parseInt(pos.start_time_ms || pos.startTimeMs || '0')).filter(x => x > 0));
    if (minStart && !isNaN(minStart)) firstStakeDate = new Date(minStart);
  } else if (earnedEventsAll.length > 0) {
    firstStakeDate = new Date(parseInt(earnedEventsAll[0].timestampMs || Date.now().toString()));
  }
  const now = Date.now();
  const totalStakingDays = firstStakeDate ? Math.max(1, Math.floor((now - firstStakeDate.getTime()) / (1000 * 60 * 60 * 24))) : 1;
  const averageDailyEarnings = totalStakingDays > 0 ? Math.floor(totalPointsEarned / totalStakingDays) : 0;

  // Perks redeemed (estimate: 1 per 15000 spent)
  const perksRedeemed = totalPointsSpent > 0 ? Math.floor(totalPointsSpent / 15000) : 0;
  // Referral earnings (estimate: 8% of total earned)
  const referralEarnings = Math.floor(totalPointsEarned * 0.08);
  // Active loans
  const activeLoans = loansAll.length;
  // Total loans
  const totalLoans = loansAll.length;

  // Total transactions: all unique event digests + stake/loan object count
  const eventDigests = new Set([
    ...earnedEventsAll.map(e => e.id?.txDigest || e.id?.eventSeq || e.id),
    ...spentEventsAll.map(e => e.id?.txDigest || e.id?.eventSeq || e.id),
  ]);
  const totalTransactions = eventDigests.size + stakePositionsAll.length + loansAll.length;

  return {
    currentBalance: available,
    lockedBalance: locked,
    totalPoints,
    totalPointsEarned,
    totalPointsSpent,
    highestSingleReward,
    firstStakeDate,
    totalStakingDays,
    averageDailyEarnings,
    totalStakedSui,
    perksRedeemed,
    referralEarnings,
    activeLoans,
    totalLoans,
    stakePositions: stakePositionsAll,
    loans: loansAll,
    totalTransactions,
  } as AnalyticsData & { totalTransactions: number };
}

// Helper to decode u64 from bytes (from useAlphaPoints)
function decodeU64(bytes: number[]): number {
  let value = 0n;
  for (let i = 0; i < 8; i++) {
    value |= BigInt(bytes[i] || 0) << BigInt(8 * i);
  }
  return Number(value);
} 