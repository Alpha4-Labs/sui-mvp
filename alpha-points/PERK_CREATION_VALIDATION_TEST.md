# Perk Creation Validation Test Checklist

## 🎯 Purpose
Verify that partners cannot create perks without a PartnerPerkStatsV2 object across all interfaces and scenarios.

## 🧪 Test Scenarios

### 1. Main Partner Dashboard - Perk Creation Tab

#### Test Case 1A: No PartnerPerkStats Object
**Setup:**
- Partner has PartnerCapFlex but no PartnerPerkStatsV2 object
- Navigate to Partner Dashboard → Perks tab

**Expected Behavior:**
- [ ] Create Perk button is disabled
- [ ] Button text shows "Stats Required"
- [ ] Button tooltip shows "Partner Stats object required - Go to Settings tab to create"
- [ ] Readiness validation shows "Missing: stats object" 
- [ ] All form fields can be filled but submission is blocked

#### Test Case 1B: PartnerPerkStats Check in Progress
**Setup:**
- Partner stats status is being checked (`isCheckingStats = true`)

**Expected Behavior:**
- [ ] Create Perk button is disabled
- [ ] Button text shows "Checking Stats..."
- [ ] Button tooltip shows "Checking partner stats..."
- [ ] Form shows loading/checking state

#### Test Case 1C: PartnerPerkStats Exists
**Setup:**
- Partner has valid PartnerPerkStatsV2 object (`hasPartnerStats = true`)

**Expected Behavior:**
- [ ] Create Perk button is enabled (when other fields are valid)
- [ ] Button text shows "Create Perk"
- [ ] No stats-related warnings or blocks
- [ ] Readiness validation passes stats requirement

### 2. PerkCreationForm Component

#### Test Case 2A: Form with Missing PartnerPerkStats
**Setup:**
- PerkCreationForm component with `hasPartnerStats = false`

**Expected Behavior:**
- [ ] Red warning banner appears at top of form
- [ ] Warning explains PartnerPerkStatsV2 requirement
- [ ] Warning provides step-by-step instructions
- [ ] Submit button is disabled
- [ ] Submit button text shows "Stats Required"
- [ ] Readiness validation includes "Stats Object" check
- [ ] Form submission is blocked with alert message

#### Test Case 2B: Form with Valid PartnerPerkStats
**Setup:**
- PerkCreationForm component with `hasPartnerStats = true`

**Expected Behavior:**
- [ ] No warning banner appears
- [ ] Submit button enabled when form is valid
- [ ] Submit button text shows "Create Perk"
- [ ] Readiness validation passes for stats object
- [ ] Form submission proceeds normally

### 3. Function-Level Validation

#### Test Case 3A: handleCreatePerk Function
**Setup:**
- Call handleCreatePerk with `hasPartnerStats = false`

**Expected Behavior:**
- [ ] Function returns early with error toast
- [ ] Toast message explains PartnerPerkStatsV2 requirement
- [ ] Toast provides navigation instructions
- [ ] No blockchain transaction is attempted
- [ ] Form state remains unchanged

#### Test Case 3B: handleCreatePerk with null/undefined stats
**Setup:**
- Call handleCreatePerk with `hasPartnerStats = null` or `isCheckingStats = true`

**Expected Behavior:**
- [ ] Function returns early with "wait" message
- [ ] No blockchain transaction is attempted
- [ ] User prompted to wait for verification

### 4. Marketplace Purchase Validation

#### Test Case 4A: Purchase Perk Without PartnerPerkStats
**Setup:**
- User attempts to purchase perk from partner without PartnerPerkStatsV2

**Expected Behavior:**
- [ ] Purchase fails with clear error message
- [ ] Error explains partner setup incomplete
- [ ] Error provides specific missing requirement
- [ ] Error suggests contacting partner
- [ ] No points are deducted from user

#### Test Case 4B: Purchase Perk with PartnerPerkStats
**Setup:**
- User attempts to purchase perk from partner with PartnerPerkStatsV2

**Expected Behavior:**
- [ ] Purchase proceeds normally
- [ ] Transaction completes successfully
- [ ] User receives perk
- [ ] Points are properly deducted

### 5. Edge Cases and Error Handling

#### Test Case 5A: Stats Object Created During Session
**Setup:**
- Partner starts with no stats object
- Creates stats object in Settings tab
- Returns to Perk creation

**Expected Behavior:**
- [ ] Form automatically updates to allow perk creation
- [ ] No page refresh required
- [ ] Stats validation passes immediately
- [ ] Create button becomes enabled

#### Test Case 5B: Network Error During Stats Check
**Setup:**
- Network error occurs during stats verification

**Expected Behavior:**
- [ ] Graceful error handling
- [ ] User informed of network issue
- [ ] Option to retry verification
- [ ] Form remains in safe state (disabled)

#### Test Case 5C: Stale Data Scenarios
**Setup:**
- Frontend shows partner has stats but blockchain doesn't
- Or vice versa

**Expected Behavior:**
- [ ] Backend validation catches discrepancy
- [ ] Clear error message to user
- [ ] Suggestion to refresh or contact support
- [ ] No invalid state persists

### 6. User Experience Validation

#### Test Case 6A: Clear Error Messages
**All error messages should:**
- [ ] Clearly explain what's missing
- [ ] Provide specific next steps
- [ ] Include navigation instructions
- [ ] Use friendly, helpful tone
- [ ] Include relevant emojis/icons for clarity

#### Test Case 6B: Visual Indicators
**UI should provide:**
- [ ] Disabled button states
- [ ] Helpful tooltips
- [ ] Warning banners when appropriate
- [ ] Color-coded validation (red/yellow/green)
- [ ] Loading states during checks

#### Test Case 6C: Accessibility
**Form should be:**
- [ ] Keyboard navigable
- [ ] Screen reader friendly
- [ ] High contrast indicators
- [ ] Clear focus states
- [ ] Proper ARIA labels

## 🔧 Testing Tools and Commands

### Manual Testing Steps
1. **Setup Test Environment:**
   ```bash
   # Create partner without stats object
   # Navigate to partner dashboard
   # Attempt perk creation
   ```

2. **Verify Validation:**
   ```javascript
   // In browser console
   console.log('hasPartnerStats:', hasPartnerStats);
   console.log('isCheckingStats:', isCheckingStats);
   console.log('Button disabled:', document.querySelector('[data-testid="create-perk-btn"]')?.disabled);
   ```

3. **Test Marketplace Purchase:**
   ```javascript
   // Try purchasing perk from partner without stats
   // Verify error message content
   // Confirm no points deducted
   ```

### Automated Testing
```typescript
// Example test cases
describe('Perk Creation Validation', () => {
  test('blocks creation without PartnerPerkStats', () => {
    // Test implementation
  });
  
  test('allows creation with valid PartnerPerkStats', () => {
    // Test implementation  
  });
  
  test('shows appropriate error messages', () => {
    // Test implementation
  });
});
```

## ✅ Success Criteria

### All tests must pass:
- [ ] **Prevention:** No perks can be created without PartnerPerkStatsV2
- [ ] **Detection:** Clear validation at all entry points
- [ ] **Guidance:** Helpful error messages and instructions
- [ ] **Recovery:** Easy path to fix the issue
- [ ] **Consistency:** Same validation across all interfaces

### Performance Requirements:
- [ ] Validation checks complete within 2 seconds
- [ ] No unnecessary blockchain calls
- [ ] Smooth user experience transitions
- [ ] Minimal impact on form responsiveness

### Security Requirements:
- [ ] Frontend validation backed by blockchain validation
- [ ] No bypass mechanisms exist
- [ ] Error messages don't expose sensitive data
- [ ] Graceful handling of edge cases

## 📊 Test Results Template

### Test Execution Log
```
Date: ___________
Tester: ___________
Environment: ___________

Test Case 1A: [ PASS / FAIL ]
Notes: ___________

Test Case 1B: [ PASS / FAIL ]  
Notes: ___________

[Continue for all test cases...]

Overall Result: [ PASS / FAIL ]
Critical Issues Found: ___________
Recommendations: ___________
```

## 🚨 Critical Validation Points

### Must-Have Validations:
1. ✅ **Button Disabled:** Create Perk button disabled without stats
2. ✅ **Function Guard:** handleCreatePerk early return without stats  
3. ✅ **Form Validation:** PerkCreationForm blocks submission
4. ✅ **Visual Feedback:** Clear warning messages and indicators
5. ✅ **Purchase Protection:** Marketplace handles missing stats gracefully

### Nice-to-Have Enhancements:
- [ ] Auto-fix suggestions (create stats object automatically)
- [ ] Real-time validation status updates
- [ ] Progress indicators for stats creation
- [ ] Batch validation for multiple partners
- [ ] Admin tools for detecting issues

---

**Last Updated:** December 2024  
**Status:** Ready for testing  
**Priority:** Critical - Must pass before production deployment 