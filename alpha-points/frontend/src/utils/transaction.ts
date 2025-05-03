import { PACKAGE_ID, SHARED_OBJECTS, SUI_TYPE, CLOCK_ID } from '../config/contract';

// Create a stake transaction
export const buildStakeTransaction = (
  amount: bigint,
  durationEpochs: number
) => {
  // Create a transaction object structure directly
  return {
    kind: 'programmable',
    inputs: [
      {
        kind: 'object',
        value: SHARED_OBJECTS.config,
        type: 'object',
      },
      {
        kind: 'object',
        value: SHARED_OBJECTS.escrowVault,
        type: 'object',
      },
      {
        kind: 'object',
        value: CLOCK_ID,
        type: 'object',
      },
      {
        kind: 'pure',
        value: amount.toString(),
        type: 'u64',
      },
      {
        kind: 'pure',
        value: durationEpochs.toString(),
        type: 'u64',
      }
    ],
    transactions: [
      {
        kind: 'SplitCoins',
        coin: { kind: 'GasCoin' },
        amounts: [
          { kind: 'Input', index: 3 }
        ]
      },
      {
        kind: 'MoveCall',
        target: `${PACKAGE_ID}::integration::route_stake`,
        typeArguments: [SUI_TYPE],
        arguments: [
          { kind: 'Input', index: 0 },
          { kind: 'Input', index: 1 },
          { kind: 'Input', index: 2 },
          { kind: 'NestedResult', index: 0, resultIndex: 0 },
          { kind: 'Input', index: 4 }
        ]
      }
    ]
  };
};

// Redeem points for SUI
export const buildRedeemPointsTransaction = (
  pointsAmount: string
) => {
  // Convert string to bigint
  const amount = BigInt(pointsAmount);
  
  return {
    kind: 'programmable',
    inputs: [
      {
        kind: 'object',
        value: SHARED_OBJECTS.config,
        type: 'object',
      },
      {
        kind: 'object',
        value: SHARED_OBJECTS.ledger,
        type: 'object',
      },
      {
        kind: 'object',
        value: SHARED_OBJECTS.escrowVault,
        type: 'object',
      },
      {
        kind: 'object',
        value: SHARED_OBJECTS.oracle,
        type: 'object',
      },
      {
        kind: 'pure',
        value: amount.toString(),
        type: 'u64',
      },
      {
        kind: 'object',
        value: CLOCK_ID,
        type: 'object',
      }
    ],
    transactions: [
      {
        kind: 'MoveCall',
        target: `${PACKAGE_ID}::integration::redeem_points`,
        typeArguments: [SUI_TYPE],
        arguments: [
          { kind: 'Input', index: 0 },
          { kind: 'Input', index: 1 },
          { kind: 'Input', index: 2 },
          { kind: 'Input', index: 3 },
          { kind: 'Input', index: 4 },
          { kind: 'Input', index: 5 }
        ]
      }
    ]
  };
};

// Create a loan transaction
export const buildCreateLoanTransaction = (
  stakeId: string,
  pointsAmount: number
) => {
  return {
    kind: 'programmable',
    inputs: [
      {
        kind: 'object',
        value: SHARED_OBJECTS.config,
        type: 'object',
      },
      {
        kind: 'object',
        value: SHARED_OBJECTS.loanConfig,
        type: 'object',
      },
      {
        kind: 'object',
        value: SHARED_OBJECTS.ledger,
        type: 'object',
      },
      {
        kind: 'object',
        value: stakeId,
        type: 'object',
      },
      {
        kind: 'object',
        value: SHARED_OBJECTS.oracle,
        type: 'object',
      },
      {
        kind: 'pure',
        value: pointsAmount.toString(),
        type: 'u64',
      },
      {
        kind: 'object',
        value: CLOCK_ID,
        type: 'object',
      }
    ],
    transactions: [
      {
        kind: 'MoveCall',
        target: `${PACKAGE_ID}::loan::open_loan`,
        typeArguments: [SUI_TYPE],
        arguments: [
          { kind: 'Input', index: 0 },
          { kind: 'Input', index: 1 },
          { kind: 'Input', index: 2 },
          { kind: 'Input', index: 3 },
          { kind: 'Input', index: 4 },
          { kind: 'Input', index: 5 },
          { kind: 'Input', index: 6 }
        ]
      }
    ]
  };
};

// Repay a loan transaction
export const buildRepayLoanTransaction = (
  loanId: string,
  stakeId: string
) => {
  return {
    kind: 'programmable',
    inputs: [
      {
        kind: 'object',
        value: SHARED_OBJECTS.config,
        type: 'object',
      },
      {
        kind: 'object',
        value: SHARED_OBJECTS.ledger,
        type: 'object',
      },
      {
        kind: 'object',
        value: loanId,
        type: 'object',
      },
      {
        kind: 'object',
        value: stakeId,
        type: 'object',
      },
      {
        kind: 'object',
        value: CLOCK_ID,
        type: 'object',
      }
    ],
    transactions: [
      {
        kind: 'MoveCall',
        target: `${PACKAGE_ID}::loan::repay_loan`,
        typeArguments: [SUI_TYPE],
        arguments: [
          { kind: 'Input', index: 0 },
          { kind: 'Input', index: 1 },
          { kind: 'Input', index: 2 },
          { kind: 'Input', index: 3 },
          { kind: 'Input', index: 4 }
        ]
      }
    ]
  };
};

// Unstake transaction
export const buildUnstakeTransaction = (
  stakeId: string
) => {
  return {
    kind: 'programmable',
    inputs: [
      {
        kind: 'object',
        value: SHARED_OBJECTS.config,
        type: 'object',
      },
      {
        kind: 'object',
        value: SHARED_OBJECTS.ledger,
        type: 'object',
      },
      {
        kind: 'object',
        value: SHARED_OBJECTS.escrowVault,
        type: 'object',
      },
      {
        kind: 'object',
        value: stakeId,
        type: 'object',
      },
      {
        kind: 'object',
        value: CLOCK_ID,
        type: 'object',
      }
    ],
    transactions: [
      {
        kind: 'MoveCall',
        target: `${PACKAGE_ID}::integration::redeem_stake`,
        typeArguments: [SUI_TYPE],
        arguments: [
          { kind: 'Input', index: 0 },
          { kind: 'Input', index: 1 },
          { kind: 'Input', index: 2 },
          { kind: 'Input', index: 3 },
          { kind: 'Input', index: 4 }
        ]
      }
    ]
  };
};