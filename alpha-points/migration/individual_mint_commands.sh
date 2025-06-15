# Stake: 0x31b73dc192dacfe80ce7929eb34b40f1d3a038ff8a05b18c72e3d5b1249f430e
# Owner: 0xfc5cd7ce4ffd3552d87df6fcf1738c8e284b8bea9c38052dda94c3eb30d1a1b8
# Amount: 500.0000 SUI → 550,000,000 points
sui client call --package YOUR_PACKAGE_ID_HERE \
  --module ledger \
  --function mint_points \
  --args YOUR_LEDGER_ID_HERE 0xfc5cd7ce4ffd3552d87df6fcf1738c8e284b8bea9c38052dda94c3eb30d1a1b8 550000000 "0" \
  --gas-budget 10000000

# Stake: 0x794d84ea07bb597ea79610b1b526f3c0a1b30f9bb11589f3b360735c9c99d17b
# Owner: 0x26c25d11ac38064e727272797e5955c3e5f08dcc928f5d6bbb2491658eca3896
# Amount: 420.0000 SUI → 462,000,000 points
sui client call --package YOUR_PACKAGE_ID_HERE \
  --module ledger \
  --function mint_points \
  --args YOUR_LEDGER_ID_HERE 0x26c25d11ac38064e727272797e5955c3e5f08dcc928f5d6bbb2491658eca3896 462000000 "0" \
  --gas-budget 10000000

# Stake: 0xbbcbbc97a12c7db35ae4fd4864806687447e0d62ba9735e42425bacfd4a2e234
# Owner: 0x08b8700a6cf6a41835de61163f8dd55bccbcd9e8ed3150079b3feb8513c3e221
# Amount: 400.0000 SUI → 440,000,000 points
sui client call --package YOUR_PACKAGE_ID_HERE \
  --module ledger \
  --function mint_points \
  --args YOUR_LEDGER_ID_HERE 0x08b8700a6cf6a41835de61163f8dd55bccbcd9e8ed3150079b3feb8513c3e221 440000000 "0" \
  --gas-budget 10000000
