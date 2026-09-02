# Screenshot Guide — Business Account Verification Workflow

For the Technical Design Manual. Follow in order; each step is one screenshot.
Total run time: about 3 minutes.

## Setup
Run the app, and if you have an existing session, log out first.

## The 8 screenshots

| # | Screen | How to get there | Caption for the manual |
|---|--------|------------------|------------------------|
| 1 | Registration — account type toggle | Sign up → see Personal / Vet Clinic segment | "URS #02: users choose personal or business registration" |
| 2 | Business registration form | Tap "Vet Clinic" → scroll to clinic fields | "Business applicants must supply UEN and AVS licence number" |
| 3 | UEN validation error | Enter UEN `123` → Submit | "Client-side format validation; authoritative check occurs at admin review" |
| 4 | Application under review | Complete the form → Submit | "New business accounts enter `pending` state with no listing privileges" |
| 5 | Admin review queue | Logout → login `admin@pawscan.demo` | "URS #29: administrator queue with counts by status" |
| 6 | Verification panel (close-up) | Same screen — crop the amber UEN/AVS box | "Identifiers are checked against ACRA and NParks AVS public registers" |
| 7 | Approval confirmation dialog | Tap Approve | "Approval requires explicit confirmation that both registers were checked" |
| 8 | Verified clinic dashboard | Logout → login as the clinic email | "URS #24/#25: listing management and anonymised referral statistics" |

## Optional extra screenshots

| # | Screen | How |
|---|--------|-----|
| 9 | Rejection with reason | Register a second clinic, then Reject → "UEN not found" |
| 10 | Rejected state as seen by clinic | Login as that second clinic |
| 11 | Suspend a verified listing | Admin → APPROVED filter → Suspend listing |

## Test data to use

Clinic name:  Pawsitive Veterinary Clinic
Email:        clinic@pawsitive.sg
UEN:          53412345X
AVS licence:  AVS-2024-118
Address:      12 Bukit Timah Road, Singapore 229899
Phone:        62345678

Admin login:  admin@pawscan.demo  (any password)

## State machine to include in the manual

    guest
      |  submits business registration (URS #02)
      v
    pending  --admin rejects (with reason)-->  rejected
      |
      |  admin approves (URS #29)
      v
    approved  --admin suspends (licence lapsed)-->  suspended

Only `approved` grants listing-management privileges. Every other state routes
to the status screen. This is the point worth making in the manual: the trust
boundary is the admin review, not the registration form.

## Known demo limitation (state this explicitly)

Verification is a MANUAL administrative decision. The app displays the
submitted UEN and licence number with links to the ACRA and AVS registers,
but does not call those registers programmatically. Automated registry
integration is out of scope for this project.

---

# Update — 5 newly built screens (previously mockups)

These are now REAL screens in the build. Capture them as screenshots.

| # | Screen | How to reach it |
|---|--------|-----------------|
| A | Welcome / onboarding | Fresh install, or clear app data — shows on first launch only |
| B | Forgot password | Login screen → "Forgot password?" link |
| C | Edit profile | Profile tab → "Edit" on the account card |
| D | Upgrade to Premium (tiers) | Profile tab → "Upgrade to Premium" card (free users) |
| E | Condition article | Scan a dog → tap any condition in the health watchlist → "Read more" |

To re-trigger onboarding for the screenshot: uninstall and reinstall, or add a
temporary button calling markOnboardingSeen's opposite (or clear AsyncStorage).
