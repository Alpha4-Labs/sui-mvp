/**
 * Transaction builder utilities for Alpha Points operations
 * Creates programmable transaction blocks for various operations
 */

import { PACKAGE_ID, SHARED_OBJECTS, SUI_TYPE, CLOCK_ID } from '../config/contract';

/**
 * Builds a transaction for staking SUI
 * 
 * @param amount Amount in MIST (SUI * 10^9)
 * @param durationEpochs Duration in epochs for the stake
 * @returns Programmable transaction block in JSON format
 */
export const buildStakeTransaction = (
  amount: bigint,
  durationEpochs: number
) => {
  return {
    kind: 'programmable',
    inputs: [
      // Input 0: Config shared object
      {
        kind: 'object',
        value: SHARED_OBJECTS.config,
        type: 'object',
      },
      // Input 1: Escrow vault shared object
      {
        kind: 'object',
        value: SHARED_OBJECTS.escrowVault,
        type: 'object',
      },
      // Input 2: Clock object for epoch info
      {
        kind: 'object',
        value: CLOCK_ID,
        type: 'object',
      },
      // Input 3: Amount to stake (in MIST)
      {
        kind: 'pure',
        value: amount.toString(),
        type: 'u64',
      },
      // Input 4: Duration in epochs
      {
        kind: 'pure',
        value: durationEpochs.toString(),
        type: 'u64',
      }
    ],
    transactions: [
      // Split coins from gas coin for staking
      {
        kind: 'SplitCoins',
        coin: { kind: 'GasCoin' },
        amounts: [
          { kind: 'Input', index: 3 }
        ]
      },
      // Call the route_stake function with the split coin
      {
        kind: 'MoveCall',
        target: `${PACKAGE_ID}::integration::route_stake`,
        typeArguments: [SUI_TYPE],
        arguments: [
          { kind: 'Input', index: 0 }, // config
          { kind: 'Input', index: 1 }, // escrow
          { kind: 'Input', index: 2 }, // clock
          { kind: 'NestedResult', index: 0, resultIndex: 0 }, // split coin
          { kind: 'Input', index: 4 } // duration
        ]
      }
    ]
  };
};

/**
 * Builds a transaction for unstaking a position
 * 
 * @param stakeId Object ID of the stake position
 * @returns Programmable transaction block in JSON format
 */
export const buildUnstakeTransaction = (
  stakeId: string
) => {
  return {
    kind: 'programmable',
    inputs: [
      // Input 0: Config shared object
      {
        kind: 'object',
        value: SHARED_OBJECTS.config,
        type: 'object',
      },
      // Input 1: Ledger shared object
      {
        kind: 'object',
        value: SHARED_OBJECTS.ledger,
        type: 'object',
      },
      // Input 2: Escrow vault shared object
      {
        kind: 'object',
        value: SHARED_OBJECTS.escrowVault,
        type: 'object',
      },
      // Input 3: Stake position object
      {
        kind: 'object',
        value: stakeId,
        type: 'object',
      },
      // Input 4: Clock object
      {
        kind: 'object',
        value: CLOCK_ID,
        type: 'object',
      }
    ],
    transactions: [
      // Call the redeem_stake function
      {
        kind: 'MoveCall',
        target: `${PACKAGE_ID}::integration::redeem_stake`,
        typeArguments: [SUI_TYPE],
        arguments: [
          { kind: 'Input', index: 0 }, // config
          { kind: 'Input', index: 1 }, // ledger
          { kind: 'Input', index: 2 }, // escrow
          { kind: 'Input', index: 3 }, // stake
          { kind: 'Input', index: 4 }  // clock
        ]
      }
    ]
  };
};

/**
 * Builds a transaction for redeeming Alpha Points for tokens
 * 
 * @param pointsAmount Amount of Alpha Points to redeem
 * @returns Programmable transaction block in JSON format
 */
export const buildRedeemPointsTransaction = (
  pointsAmount: string
) => {
  // Convert string to bigint
  const amount = BigInt(pointsAmount);
  
  return {
    kind: 'programmable',
    inputs: [
      // Input 0: Config shared object
      {
        kind: 'object',
        value: SHARED_OBJECTS.config,
        type: 'object',
      },
      // Input 1: Ledger shared object
      {
        kind: 'object',
        value: SHARED_OBJECTS.ledger,
        type: 'object',
      },
      // Input 2: Escrow vault shared object
      {
        kind: 'object',
        value: SHARED_OBJECTS.escrowVault,
        type: 'object',
      },
      // Input 3: Oracle shared object for conversion rates
      {
        kind: 'object',
        value: SHARED_OBJECTS.oracle,
        type: 'object',
      },
      // Input 4: Points amount to redeem
      {
        kind: 'pure',
        value: amount.toString(),
        type: 'u64',
      },
      // Input 5: Clock object
      {
        kind: 'object',
        value: CLOCK_ID,
        type: 'object',
      }
    ],
    transactions: [
      // Call the redeem_points function
      {
        kind: 'MoveCall',
        target: `${PACKAGE_ID}::integration::redeem_points`,
        typeArguments: [SUI_TYPE],
        arguments: [
          { kind: 'Input', index: 0 }, // config
          { kind: 'Input', index: 1 }, // ledger
          { kind: 'Input', index: 2 }, // escrow
          { kind: 'Input', index: 3 }, // oracle
          { kind: 'Input', index: 4 }, // amount
          { kind: 'Input', index: 5 }  // clock
        ]
      }
    ]
  };
};

/**
 * Builds a transaction for creating a loan against a staked position
 * 
 * @param stakeId Object ID of the stake position to use as collateral
 * @param pointsAmount Amount of Alpha Points to borrow
 * @returns Programmable transaction block in JSON format
 */
export const buildCreateLoanTransaction = (
  stakeId: string,
  pointsAmount: number
) => {
  return {
    kind: 'programmable',
    inputs: [
      // Input 0: Config shared object
      {
        kind: 'object',
        value: SHARED_OBJECTS.config,
        type: 'object',
      },
      // Input 1: Loan config shared object
      {
        kind: 'object',
        value: SHARED_OBJECTS.loanConfig,
        type: 'object',
      },
      // Input 2: Ledger shared object
      {
        kind: 'object',
        value: SHARED_OBJECTS.ledger,
        type: 'object',
      },
      // Input 3: Stake position object (collateral)
      {
        kind: 'object',
        value: stakeId,
        type: 'object',
      },
      // Input 4: Oracle shared object for valuation
      {
        kind: 'object',
        value: SHARED_OBJECTS.oracle,
        type: 'object',
      },
      // Input 5: Points amount to borrow
      {
        kind: 'pure',
        value: pointsAmount.toString(),
        type: 'u64',
      },
      // Input 6: Clock object
      {
        kind: 'object',
        value: CLOCK_ID,
        type: 'object',
      }
    ],
    transactions: [
      // Call the open_loan function
      {
        kind: 'MoveCall',
        target: `${PACKAGE_ID}::loan::open_loan`,
        typeArguments: [SUI_TYPE],
        arguments: [
          { kind: 'Input', index: 0 }, // config
          { kind: 'Input', index: 1 }, // loan_config
          { kind: 'Input', index: 2 }, // ledger
          { kind: 'Input', index: 3 }, // stake
          { kind: 'Input', index: 4 }, // oracle
          { kind: 'Input', index: 5 }, // amount
          { kind: 'Input', index: 6 }  // clock
        ]
      }
    ]
  };
};

/**
 * Builds a transaction for repaying a loan
 * 
 * @param loanId Object ID of the loan
 * @param stakeId Object ID of the stake position used as collateral
 * @returns Programmable transaction block in JSON format
 */
export const buildRepayLoanTransaction = (
  loanId: string,
  stakeId: string
) => {
  return {
    kind: 'programmable',
    inputs: [
      // Input 0: Config shared object
      {
        kind: 'object',
        value: SHARED_OBJECTS.config,
        type: 'object',
      },
      // Input 1: Ledger shared object
      {
        kind: 'object',
        value: SHARED_OBJECTS.ledger,
        type: 'object',
      },
      // Input 2: Loan object
      {
        kind: 'object',
        value: loanId,
        type: 'object',
      },
      // Input 3: Stake position object (collateral)
      {
        kind: 'object',
        value: stakeId,
        type: 'object',
      },
      // Input 4: Clock object
      {
        kind: 'object',
        value: CLOCK_ID,
        type: 'object',
      }
    ],
    transactions: [
      // Call the repay_loan function
      {
        kind: 'MoveCall',
        target: `${PACKAGE_ID}::loan::repay_loan`,
        typeArguments: [SUI_TYPE],
        arguments: [
          { kind: 'Input', index: 0 }, // config
          { kind: 'Input', index: 1 }, // ledger
          { kind: 'Input', index: 2 }, // loan
          { kind: 'Input', index: 3 }, // stake
          { kind: 'Input', index: 4 }  // clock
        ]
      }
    ]
  };
};