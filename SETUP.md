# TripTogether — setup & deployment

TripTogether is a mobile-first Progressive Web App (PWA). It runs on iPhone, Android and desktop browsers. Shared trips use Supabase (database, anonymous sign-in and realtime).

## 1) Create the cloud database
1. Create a project at https://supabase.com/
2. In Project Settings → API, copy the Project URL and `anon` / publishable key.
3. Open SQL Editor → New query. Paste all of `supabase.sql` and run it.
4. In Authentication → Providers, enable **Anonymous Sign-Ins** and Email/password sign-in.
5. In Authentication settings, enable **Manual Linking**. The app uses this to attach an email to the existing anonymous identity without changing its user ID or losing trip ownership.
6. To email-verify addresses outside your Supabase organization, configure a custom mail provider under **Authentication → SMTP Settings**. Supabase's built-in sender is for project-team testing and is tightly rate-limited; production use needs your own SMTP credentials and a verified sender domain. See [Supabase SMTP setup](https://supabase.com/docs/guides/auth/auth-smtp).

## 2) Connect the app
Open `app.js` and replace `PASTE_YOUR_SUPABASE_PROJECT_URL` and `PASTE_YOUR_SUPABASE_ANON_KEY`.
Use only the public anon/publishable key. Never put a `service_role` or secret key in browser code.

## 3) Publish it
Upload the entire folder to a static HTTPS host such as Netlify, Cloudflare Pages or Vercel. Keep all files together. For Netlify Drop: https://app.netlify.com/drop

## 4) Install on phones
- iPhone: open the HTTPS site in Safari → Share → Add to Home Screen.
- Android: open the HTTPS site in Chrome → Install app / Add to Home screen.

## 5) Invite people
Create a trip and tap “Chia sẻ link xem”. Anyone with that link can open a read-only view without entering a name or being added to the member list. To join as a member, paste the link into the home screen and enter a name. New members are view-only until the trip creator grants edit permission in the Members tab. Treat the link like a password; anyone holding it can view trip details. There is no separate passcode. Anyone with the private invite link can view the trip; only joined members approved by the Host can edit.

## Grant edit access to members
For a database set up before this feature, run `member_edit_permissions.sql` once in Supabase SQL Editor. Existing joined members keep their current access; new members start as view-only. In a trip you created, open **Thành viên** and use **Cấp quyền sửa** or **Thu hồi quyền** for each joined account. Manually added guest names do not have an app login and cannot sign in.

## Use the same account on desktop and phone
On the device/browser that currently owns your trips, tap **Tài khoản → Gửi email xác minh** and verify the email from that same device. Return to the app, open **Tài khoản**, and save a password. On the second device, open the app, tap **Tài khoản**, and sign in with that email and password. Your original user ID is preserved, so your creator privileges and membership follow you; do not join the trip again as a new member. Email confirmation must be enabled/configured for your Supabase project.

## Add a member manually
To include someone who will not open an invitation link, first run `add_member.sql` in Supabase SQL Editor. Then open the trip → Members & settle → Add member and enter their name. Manually added members appear in equal expense splits and can be selected as the payer, but they do not get access to the app or the shared trip. Invite them if they need to use the app themselves.

## Remove data
Expenses and contributions can be removed by members with edit permission. Deletions are logged in the activity history; editors can restore deleted records when no related payment history would be lost. Only the trip creator can delete the trip; deleting it also deletes its members, expenses and deposits. If Supabase was configured before this feature was added, run `delete_trip.sql` once in SQL Editor.

## Match the expense workbook
The app tracks an initial fund separately from later contributions and stores a note on each expense. The payer is optional for expenses paid from the shared fund. If the database was configured before this field became optional, run `expense_payer_optional.sql` in Supabase SQL Editor. If the database was configured before these fields were added, run `excel_workflow.sql` once in Supabase SQL Editor.

Expenses paid personally by a member are treated as advances owed by the shared fund. They do not lower the cash balance until a member marks the expense as reimbursed. The Members tab can also record separate debts between members and mark them settled. For an existing database, run `reimbursements_and_member_debts.sql` once in Supabase SQL Editor.

## Included in this starter build
Trip creation, join by invitation link, member roster, shared expenses and contributions, reimbursement tracking, member-to-member debts, live updates and suggested debt transfers.

## Current limitations
This starter build does not yet include receipt uploads, offline write queues, push notifications, partial reimbursements or multi-currency conversion. For production use, add backup/export routines.

## Member requests for editing access

Run `member_edit_permissions.sql`, then `trip_edit_requests.sql` **once** in the Supabase SQL Editor. A viewer must join the trip as a member before requesting edit access. A joined member who has no edit access can select **Gửi yêu cầu cấp quyền** under Thành viên. The Host reviews pending requests there using **Duyệt** or **Từ chối**. Only the Host can approve requests. The viewing passcode alone never grants editing rights.

## View trips via invitation link (no viewing passcode)

Run `trip_link_access.sql` in the connected Supabase project before deploying a frontend build using this flow. A trip's random UUID invitation link is a bearer credential: anyone possessing it can view the trip's member names and financial ledger. Members can join through this link but remain view-only until the Host grants edit permissions. Do not post trip links publicly. Existing passcode hashes are left in the database for compatibility, but are no longer required for access.

## Payment and audit history (Phase 2)
For an existing project, run `payment_history.sql` **once** in Supabase SQL Editor, or apply the corresponding migration. The migration adds:
- `trip_payments`: an append-only, signed payment ledger for partial fund reimbursements and member-to-member debt payments. Negative amounts reverse a previously recorded payment.
- `trip_activity`: a read-only audit trail of expense, contribution, debt, and payment inserts, changes, and deletions.
- `record_trip_payment`: checks edit permission and prevents paying more than the original amount or reversing more than paid.
- `restore_trip_record`: restores a deleted expense or contribution when the original member still exists. Paid expenses with deleted payment history require coordinated manual recovery.

Existing financial amounts, membership and permissions are not reset. Fully settled historic records are backfilled into the ledger to preserve amounts; no money is transferred through TripTogether.

## Expense filtering and mobile components (Phase 3)
The Expenses tab supports text search, category, and reimbursement status filtering. The Members tab switches from a four-column grid to readable member cards on narrow screens. Payment and activity history are available in the Members tab.

## Maintainability and automated checks (Phase 4)
`finance.js` isolates all financial calculations and is shared by the app and automated tests. `trip-ui.js` holds pure expense search and filtering logic. `app.js` coordinates Supabase data access, authentication, rendering and actions.

Run the regression suite locally with Node.js 22 or newer:
```sh
node --test tests/*.test.cjs
```
GitHub Actions runs syntax validation and the same tests on each pull request and push to `main`.

**Important:** In production, deploy the SQL migration before the updated JavaScript bundle. The app requires the new payment and activity tables and RPC functions.

## Edit and remove members

For existing Supabase projects, apply `member_management.sql` once. It adds two permission-checked RPCs: `update_trip_member_name` and `remove_trip_member_safe`.

From the Members tab, editors can rename members. They can remove manually-added guests if those members have no linked expenses, contributions, personal debts, or recorded payments. The Host may also remove joined accounts with no financial references. The Host cannot be removed. Removing a member reduces the participant count and can change each remaining member's equal expense share; the UI asks for confirmation.

To keep the Members tab uncluttered, the Host's edit access requests and member permissions are now in **Trip header → ⚙ Quyền truy cập**. Members still request access from their own access request panel.
