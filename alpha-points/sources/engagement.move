/// Separate engagement tracking system for Alpha Points
/// This module tracks user engagement streaks and milestones independently
/// ACCESS CONTROLLED: Only authorized systems can record engagement
module alpha_points::engagement {
    use sui::clock::{Self, Clock};
    use sui::event;
    use sui::table::{Self as table_ops, Table as SuiTable};
    use sui::object::{Self as object_ops};



    /// User engagement tracking data
    public struct UserEngagement has key, store {
        id: UID,
        current_streak: u64,        // Current consecutive epochs with activity
        longest_streak: u64,        // All-time longest streak
        last_active_epoch: u64,     // Last epoch with any activity
        streak_start_epoch: u64,    // When current streak started
        total_active_epochs: u64,   // Total number of epochs with activity
        last_updated: u64           // Timestamp of last update
    }

    /// Shared engagement tracking ledger
    public struct EngagementTracker has key {
        id: UID,
        users: SuiTable<address, UserEngagement>
    }

    // Events
    public struct EngagementActivity has copy, drop {
        user: address,
        activity_type: u8,  // 1=earn, 2=spend, 3=stake, 4=claim, 5=loan, etc.
        epoch: u64
    }

    public struct EngagementStreakUpdated has copy, drop {
        user: address,
        current_streak: u64,
        longest_streak: u64,
        epoch: u64
    }

    public struct EngagementMilestone has copy, drop {
        user: address,
        milestone_type: u8,  // 1=first_activity, 2=streak_10, 3=streak_30, 4=streak_100, 5=new_record
        streak_value: u64,
        epoch: u64
    }

    /// Event emitted when the EngagementTracker is created
    public struct EngagementTrackerCreated has copy, drop {
        tracker_id: ID
    }

    /// Activity type constants
    const ACTIVITY_EARN: u8 = 1;
    const ACTIVITY_SPEND: u8 = 2;
    const ACTIVITY_STAKE: u8 = 3;
    const ACTIVITY_CLAIM: u8 = 4;


    /// Milestone type constants
    const MILESTONE_FIRST_ACTIVITY: u8 = 1;
    const MILESTONE_STREAK_10: u8 = 2;
    const MILESTONE_STREAK_30: u8 = 3;
    const MILESTONE_STREAK_100: u8 = 4;
    const MILESTONE_NEW_RECORD: u8 = 5;



    /// Creates and shares the EngagementTracker object (runs on initial package publish only)
    fun init(ctx: &mut TxContext) {
        create_engagement_tracker(ctx);
    }

    /// PUBLIC ENTRY: Creates and shares the EngagementTracker object
    /// Call this manually after package upgrade since init() doesn't run on upgrades
    public entry fun create_engagement_tracker(ctx: &mut TxContext) {
        let tracker = EngagementTracker {
            id: object_ops::new(ctx),
            users: table_ops::new(ctx)
        };
        
        // Emit creation event so frontend can discover the tracker ID
        event::emit(EngagementTrackerCreated {
            tracker_id: object_ops::id(&tracker)
        });
        
        transfer::share_object(tracker);
    }

    /// INTERNAL: Records user engagement activity for the current epoch
    /// Only callable from within this package for security
    /// Includes anti-gaming measures (one engagement per epoch per user)
    public(package) fun internal_record_activity(
        tracker: &mut EngagementTracker,
        user: address,
        activity_type: u8,
        current_epoch: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let current_timestamp = clock::timestamp_ms(clock);
        
        // Anti-gaming: Check if user already has engagement in this epoch
        if (table_ops::contains(&tracker.users, user)) {
            let engagement = table_ops::borrow(&tracker.users, user);
            // Prevent multiple engagement records in same epoch
            if (engagement.last_active_epoch == current_epoch) {
                return // Silently ignore duplicate activity in same epoch
            };
        };
        
        // Emit activity event
        event::emit(EngagementActivity {
            user,
            activity_type,
            epoch: current_epoch
        });

        if (!table_ops::contains(&tracker.users, user)) {
            // First time activity - create engagement record
            let engagement = UserEngagement {
                id: object_ops::new(ctx),
                current_streak: 1,
                longest_streak: 1,
                last_active_epoch: current_epoch,
                streak_start_epoch: current_epoch,
                total_active_epochs: 1,
                last_updated: current_timestamp
            };
            table_ops::add(&mut tracker.users, user, engagement);
            
            // Emit first activity milestone
            event::emit(EngagementMilestone {
                user,
                milestone_type: MILESTONE_FIRST_ACTIVITY,
                streak_value: 1,
                epoch: current_epoch
            });
        } else {
            let engagement = table_ops::borrow_mut(&mut tracker.users, user);
            
            // Only update if this is a new epoch (prevent multiple updates per epoch)
            if (current_epoch > engagement.last_active_epoch) {
                let was_consecutive = (current_epoch == engagement.last_active_epoch + 1);
                
                if (was_consecutive) {
                    // Continue streak
                    engagement.current_streak = engagement.current_streak + 1;
                } else {
                    // Streak broken, start new one
                    engagement.current_streak = 1;
                    engagement.streak_start_epoch = current_epoch;
                };
                
                // Update longest streak if needed
                let mut new_record = false;
                if (engagement.current_streak > engagement.longest_streak) {
                    engagement.longest_streak = engagement.current_streak;
                    new_record = true;
                };
                
                engagement.last_active_epoch = current_epoch;
                engagement.total_active_epochs = engagement.total_active_epochs + 1;
                engagement.last_updated = current_timestamp;
                
                // Emit streak update event
                event::emit(EngagementStreakUpdated {
                    user,
                    current_streak: engagement.current_streak,
                    longest_streak: engagement.longest_streak,
                    epoch: current_epoch
                });
                
                // Emit milestone events
                if (new_record) {
                    event::emit(EngagementMilestone {
                        user,
                        milestone_type: MILESTONE_NEW_RECORD,
                        streak_value: engagement.longest_streak,
                        epoch: current_epoch
                    });
                };
                
                // Check for streak milestones
                if (engagement.current_streak == 10) {
                    event::emit(EngagementMilestone {
                        user,
                        milestone_type: MILESTONE_STREAK_10,
                        streak_value: 10,
                        epoch: current_epoch
                    });
                } else if (engagement.current_streak == 30) {
                    event::emit(EngagementMilestone {
                        user,
                        milestone_type: MILESTONE_STREAK_30,
                        streak_value: 30,
                        epoch: current_epoch
                    });
                } else if (engagement.current_streak == 100) {
                    event::emit(EngagementMilestone {
                        user,
                        milestone_type: MILESTONE_STREAK_100,
                        streak_value: 100,
                        epoch: current_epoch
                    });
                };
            };
        };
    }

    // === SIMPLE INTERFACE FOR LEDGER INTEGRATION ===
    // Called directly from ledger functions when legitimate point operations happen

    /// Record earn activity (called from ledger::internal_earn)
    public(package) fun record_earn_activity(
        tracker: &mut EngagementTracker,
        user: address,
        current_epoch: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        internal_record_activity(tracker, user, ACTIVITY_EARN, current_epoch, clock, ctx);
    }

    /// Record spend activity (called from ledger::internal_spend)
    public(package) fun record_spend_activity(
        tracker: &mut EngagementTracker,
        user: address,
        current_epoch: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        internal_record_activity(tracker, user, ACTIVITY_SPEND, current_epoch, clock, ctx);
    }

    /// Record lock activity (called from ledger::internal_lock)
    public(package) fun record_lock_activity(
        tracker: &mut EngagementTracker,
        user: address,
        current_epoch: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        internal_record_activity(tracker, user, ACTIVITY_STAKE, current_epoch, clock, ctx);
    }

    /// Record unlock activity (called from ledger::internal_unlock)
    public(package) fun record_unlock_activity(
        tracker: &mut EngagementTracker,
        user: address,
        current_epoch: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        internal_record_activity(tracker, user, ACTIVITY_CLAIM, current_epoch, clock, ctx);
    }

    // === View Functions ===

    /// Get user's current engagement streak
    public fun get_current_streak(tracker: &EngagementTracker, user: address): u64 {
        if (!table_ops::contains(&tracker.users, user)) {
            return 0
        };
        let engagement = table_ops::borrow(&tracker.users, user);
        engagement.current_streak
    }

    /// Get user's longest engagement streak
    public fun get_longest_streak(tracker: &EngagementTracker, user: address): u64 {
        if (!table_ops::contains(&tracker.users, user)) {
            return 0
        };
        let engagement = table_ops::borrow(&tracker.users, user);
        engagement.longest_streak
    }

    /// Get user's last active epoch
    public fun get_last_active_epoch(tracker: &EngagementTracker, user: address): u64 {
        if (!table_ops::contains(&tracker.users, user)) {
            return 0
        };
        let engagement = table_ops::borrow(&tracker.users, user);
        engagement.last_active_epoch
    }

    /// Get total number of epochs user has been active
    public fun get_total_active_epochs(tracker: &EngagementTracker, user: address): u64 {
        if (!table_ops::contains(&tracker.users, user)) {
            return 0
        };
        let engagement = table_ops::borrow(&tracker.users, user);
        engagement.total_active_epochs
    }

    /// Get when user's current streak started
    public fun get_streak_start_epoch(tracker: &EngagementTracker, user: address): u64 {
        if (!table_ops::contains(&tracker.users, user)) {
            return 0
        };
        let engagement = table_ops::borrow(&tracker.users, user);
        engagement.streak_start_epoch
    }

    /// Check if user has any engagement history
    public fun has_engagement_history(tracker: &EngagementTracker, user: address): bool {
        table_ops::contains(&tracker.users, user)
    }

    /// Calculate current streak considering epoch gaps (for frontend)
    /// Returns 0 if streak is broken based on current epoch
    public fun get_current_streak_validated(tracker: &EngagementTracker, user: address, current_epoch: u64): u64 {
        if (!table_ops::contains(&tracker.users, user)) {
            return 0
        };
        let engagement = table_ops::borrow(&tracker.users, user);
        
        // If more than 1 epoch gap, streak is broken
        if (current_epoch > engagement.last_active_epoch + 1) {
            return 0
        };
        
        engagement.current_streak
    }

    /// Get full engagement stats for a user
    public fun get_engagement_stats(tracker: &EngagementTracker, user: address): (u64, u64, u64, u64, u64, u64) {
        if (!table_ops::contains(&tracker.users, user)) {
            return (0, 0, 0, 0, 0, 0)
        };
        let engagement = table_ops::borrow(&tracker.users, user);
        (
            engagement.current_streak,
            engagement.longest_streak,
            engagement.last_active_epoch,
            engagement.streak_start_epoch,
            engagement.total_active_epochs,
            engagement.last_updated
        )
    }

    /// Get engagement data for multiple users (batch query)
    public fun get_multiple_streaks(tracker: &EngagementTracker, users: vector<address>): vector<u64> {
        let mut results = vector::empty<u64>();
        let mut i = 0;
        while (i < vector::length(&users)) {
            let user = vector::borrow(&users, i);
            let streak = get_current_streak(tracker, *user);
            vector::push_back(&mut results, streak);
            i = i + 1;
        };
        results
    }

    #[test_only]
    /// Initialize the EngagementTracker for testing
    public fun init_for_testing(ctx: &mut TxContext) {
        init(ctx);
    }
} 