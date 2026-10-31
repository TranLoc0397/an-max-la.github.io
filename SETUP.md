# TripTogether — setup & deployment

TripTogether is a mobile-first Progressive Web App (PWA). It runs on iPhone, Android and desktop browsers. Shared trips use Supabase (database, anonymous sign-in and realtime).

## 1) Create the cloud database
1. Create a project at https://supabase.com/
2. In Project Settings → API, copy the Project URL and `anon` / publishable key.
3. Open SQL Editor → New query. Paste all of `supabase.sql` and run it.
4. In Authentication → Providers, enable **Anonymous Sign-Ins**.

## 2) Connect the app
Open `app.js` and replace `PASTE_YOUR_SUPABASE_PROJECT_URL` and `PASTE_YOUR_SUPABASE_ANON_KEY`.
Use only the public anon/publishable key. Never put a `service_role` or secret key in browser code.

## 3) Publish it
Upload the entire folder to a static HTTPS host such as Netlify, Cloudflare Pages or Vercel. Keep all files together. For Netlify Drop: https://app.netlify.com/drop

## 4) Install on phones
- iPhone: open the HTTPS site in Safari → Share → Add to Home Screen.
- Android: open the HTTPS site in Chrome → Install app / Add to Home screen.

## 5) Invite people
Create a trip and tap “Chia sẻ link xem”. Anyone with that link can open a read-only view without entering a name or being added to the member list. To join as a member and make changes, paste the link into the home screen and enter a name. Treat the link like a password; anyone holding it can view trip details. The trip creator must set a passcode (at least 8 characters) before sharing. Viewers enter it to open the read-only link; send the passcode separately. For an existing database, run `trip_passcode.sql` once in Supabase SQL Editor.

## Add a member manually
To include someone who will not open an invitation link, first run `add_member.sql` in Supabase SQL Editor. Then open the trip → Members & settle → Add member and enter their name. Manually added members appear in equal expense splits and can be selected as the payer, but they do not get access to the app or the shared trip. Invite them if they need to use the app themselves.

## Remove data
Expenses and deposits can be removed from their lists by any trip member. Only the trip creator can delete the trip; deleting it also deletes its members, expenses and deposits. If Supabase was configured before this feature was added, run `delete_trip.sql` once in SQL Editor.

## Match the expense workbook
The app tracks an initial fund separately from later contributions and stores a note on each expense. The payer is optional for expenses paid from the shared fund. If the database was configured before this field became optional, run `expense_payer_optional.sql` in Supabase SQL Editor. If the database was configured before these fields were added, run `excel_workflow.sql` once in Supabase SQL Editor.

## Included in this starter build
Trip creation, join by invitation link, member roster, shared expenses, contributions, live updates, equal-split balances and suggested transfers.

## Current limitations
This starter build does not yet include editing, receipt uploads, offline write queues, admin roles, push notifications or multi-currency conversion. Balances currently split all trip expenses equally among the members currently listed. The fund ledger is tracked separately from who paid individual expenses. For production use, add backup/export routines and consider stricter member/admin permissions.
