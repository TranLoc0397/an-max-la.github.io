# TripTogether: international roadmap

## Why
TripTogether is built around one assumption: everyone pays in VND, inside Vietnam, in Vietnamese. The code shows it in four places:

| Lock-in | Where |
|---|---|
| Currency | `money()` always formats `vi-VN`/`VND`; `expenses.amount` has no currency |
| Time zone | `vietnamDate()` and every timestamp use `Asia/Ho_Chi_Minh` |
| Language | Vietnamese source text with an English dictionary; no other locale |
| Splitting | `calculateMemberBalances()` splits every expense equally between all members |

The first trip abroad hits the currency lock-in on the first meal. Everything else is friction; currency is a blocker.

## Prioritisation (RICE: reach × impact × confidence ÷ effort)

| # | Feature | Reach | Impact | Confidence | Effort | Score | Status |
|---|---|---|---|---|---|---|---|
| 1 | **Foreign-currency expenses** (original amount + rate, ledger stays VND) | Every trip abroad | 3 | 90% | 1 | **High** | ✅ This PR |
| 2 | **Uneven splits**: per-expense participants, shares or exact amounts | Most groups | 3 | 80% | 2 | High | Next |
| 3 | **Trip base currency** (a trip of foreigners settles in USD/EUR) | Non-Vietnamese groups | 3 | 70% | 3 | Medium | After 2 |
| 4 | **Locale-aware formatting** (numbers, dates, time zone of the trip) | All non-VN users | 2 | 90% | 1 | Medium | After 3 |
| 5 | **More languages** (ko, ja, th, zh) through the existing dictionary | Regional users | 2 | 80% | 1 per language | Medium | Ongoing |
| 6 | **Settle-up links**: payment deep links/QR (VietQR, PayPal, Wise) on each transfer | Every settlement | 2 | 60% | 2 | Medium | Later |
| 7 | **Receipt OCR** fills amount, currency and date from the receipt photo | Power users | 2 | 50% | 3 | Low | Later |

Splits come second because once a trip goes abroad, "not everyone joined this activity" becomes common, and equal splits stop being fair.

## Feature 1: Foreign-currency expenses

**User story.** As a member of a trip abroad, I want to record an expense in the local currency so that I don't have to convert it myself, and the group can still see what was actually paid.

**Design decision.** The ledger stays in VND. `amount` remains the VND value that every balance, reimbursement, payment, reminder and Excel formula already uses. A foreign expense also stores `currency`, `original_amount` and `fx_rate`. This means no change to `finance.js`, no data migration, and no risk to existing balances.

**Acceptance criteria**
1. The expense dialog offers 22 currencies (VND first, then the most common destinations). VND behaves exactly as before.
2. Choosing a foreign currency shows **original amount** and **rate (1 XXX = ? ₫)**. The VND field becomes read-only and shows `round(original × rate)` live.
3. Amounts accept both conventions: `12,50`, `12.50`, `25.400`, `1.234,56`, `1,234.56`.
4. Decimals follow the currency (JPY/KRW/VND 0, most others 2). Invalid input shows a clear message and is not saved.
5. **"Lấy tỷ giá hôm nay"** fills today's reference rate (open.er-api.com, which covers VND). Users can always overwrite it. The last rate per currency is remembered on the device.
6. The expense list shows `317.500 ₫` with `12,50 US$ · 1 USD = 25.400 ₫` underneath.
7. Editing reopens the original currency, amount and rate. Switching back to VND clears them.
8. The audit log records currency, original amount and rate changes. Restoring a deleted expense keeps them.
9. The Excel backup appends `Tien te`, `So tien goc`, `Ty gia (VND)` columns. Existing formula columns do not move.
10. Until `expense_currency.sql` is installed, the currency UI stays hidden and the app works VND-only.
11. All new labels are available in English.

**Data rules (enforced in the database)**
- `currency` is a 3-letter ISO code, default `VND`.
- VND rows have no `original_amount`/`fx_rate`. Foreign rows must have both > 0.
- `|amount − round(original_amount × fx_rate)| ≤ 1`.

**Out of scope (feature 3):** trips whose settlement currency is not VND.
