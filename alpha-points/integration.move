public entry fun redeem_points<T: store>(
    config: &Config,
    ledger: &mut Ledger,
    escrow: &mut EscrowVault<T>,
    mut supply_oracle: &mut SupplyOracle,
    oracle: &RateOracle,
    points_amount: u64,
    _clock: &Clock,
    ctx: &mut TxContext,
    mint_stats: &mut MintStats,
    epoch: u64
) {
    admin::assert_not_paused(config);
    let user = tx_context::sender(ctx);
    let deployer = admin::deployer_address(config);
    let (rate, decimals) = oracle::get_rate(oracle);
    let total_asset_amount = oracle::convert_points_to_asset(points_amount, rate, decimals);
    let fee_asset_amount = total_asset_amount / 1000;
    let user_asset_amount = total_asset_amount - fee_asset_amount;
    if (fee_asset_amount > total_asset_amount) { abort EFeeCalculationError };
    ledger::mint_points<address>(ledger, user, points_amount, ledger::new_point_type_staking(), ctx, mint_stats, epoch, &option::none(), 0, _clock, supply_oracle);
    if (user_asset_amount > 0) {
        escrow::withdraw(escrow, user_asset_amount, user, ctx);
    };
    if (fee_asset_amount > 0) {
        escrow::withdraw(escrow, fee_asset_amount, deployer, ctx);
    };
}

public entry fun redeem_points_with_partner<T: store>(
    config: &Config,
    ledger: &mut Ledger,
    escrow: &mut EscrowVault<T>,
    mut supply_oracle: &mut SupplyOracle, 
    oracle: &RateOracle,
    points_amount: u64,
    partner_cap: &PartnerCap,
    _clock: &Clock,
    ctx: &mut TxContext,
    mint_stats: &mut MintStats,
    epoch: u64
) {
    admin::assert_not_paused(config);
    let user = tx_context::sender(ctx);
    let deployer = admin::deployer_address(config);
    let (rate, decimals) = oracle::get_rate(oracle);
    let total_asset_amount = oracle::convert_points_to_asset(points_amount, rate, decimals);
    let fee_asset_amount = total_asset_amount / 1000;
    let user_asset_amount = total_asset_amount - fee_asset_amount;
    if (fee_asset_amount > total_asset_amount) { abort EFeeCalculationError };
    ledger::mint_points<address>(ledger, user, points_amount, ledger::new_point_type_staking(), ctx, mint_stats, epoch, &option::none(), 0, _clock, supply_oracle);
    if (user_asset_amount > 0) {
        escrow::withdraw(escrow, user_asset_amount, user, ctx);
    };
    if (fee_asset_amount > 0) {
        escrow::withdraw(escrow, fee_asset_amount, deployer, ctx);
    };
}

public entry fun claim_accrued_points<T: key + store>(
    config: &Config,
    ledger: &mut Ledger,
    stake_position: &mut StakePosition<T>,
    mut supply_oracle: &mut SupplyOracle, 
    _clock: &Clock,
    ctx: &mut TxContext,
    mint_stats: &mut MintStats
) {
    admin::assert_not_paused(config);
    let claimer = tx_context::sender(ctx);
    assert!(stake_position::owner_view(stake_position) == claimer, EAdminOnly); 

    let current_epoch = tx_context::epoch(ctx);
    let last_claim_epoch = stake_position::last_claim_epoch_view(stake_position);
    assert!(current_epoch > last_claim_epoch, EAlreadyClaimedOrTooSoon);

    let points_rate = admin::get_points_rate(config);
    let principal_sui = stake_position::principal_view(stake_position);

    let points_to_claim = ledger::calculate_accrued_points(
        principal_sui,
        points_rate,
        last_claim_epoch,
        current_epoch
    );

    if (points_to_claim > 0) {
        ledger::mint_points<T>(ledger, claimer, points_to_claim, ledger::new_point_type_staking(), ctx, mint_stats, current_epoch, &option::some(stake_position::borrow_as_immutable(stake_position)), 0, _clock, supply_oracle);
        stake_position::set_last_claim_epoch_mut(stake_position, current_epoch);
        stake_position::add_claimed_rewards_mut(stake_position, points_to_claim);

        let asset_name_ascii = std::type_name::into_string(std::type_name::get<T>());
        let asset_name_string = string::utf8(ascii::into_bytes(asset_name_ascii));

        event::emit(PointsClaimed {
            user: claimer,
            stake_id: stake_position::get_id_view(stake_position),
            points_claimed: points_to_claim,
            asset_type: asset_name_string,
            claim_epoch: current_epoch,
        });
    };
}

public entry fun earn_points_by_partner(
    user: address,
    pts: u64,
    partner: &mut PartnerCap,
    ledger: &mut Ledger,
    mint_stats: &mut MintStats,
    current_epoch: u64, 
    mut supply_oracle: &mut SupplyOracle, 
    _clock: &Clock,
    ctx: &mut TxContext
) {
    assert!(!partner_get_paused(partner), 0); 

    if (current_epoch > partner::get_last_epoch(partner)) { 
        partner::reset_mint_today_mut(partner, current_epoch);
    };
    
    assert!(partner_get_mint_remaining_today(partner) >= pts, 1); 

    assert!(ledger::can_mint_points(mint_stats, user, pts), 100);

    ledger::mint_points<address>(ledger, user, pts, ledger::new_point_type_staking(), ctx, mint_stats, current_epoch, &option::none(), 0, _clock, supply_oracle);
    
    partner::decrease_mint_remaining_today_mut(partner, pts); 

    ledger::update_minted_today(mint_stats, user, pts);

    event::emit(PointsEarned { user, amount: pts, partner: object::uid_to_address(partner_get_id(partner)) });
} 