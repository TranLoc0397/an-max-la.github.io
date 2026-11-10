const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');

test('fund reservation summary is shown before the add reminder action',()=>{
 const html=read('index.html');
 const panel=html.slice(html.indexOf('class="fund-reminder-panel"'),html.indexOf('</section>',html.indexOf('class="fund-reminder-panel"')));
 assert.ok(panel.indexOf('id="fundReminderSummary"')<panel.indexOf('id="addFundReminder"'));
 assert.match(panel,/aria-live="polite"/);
 assert.ok(Number(html.match(/styles\.css\?v=(\d+)/)[1])>=75);
 assert.ok(Number(html.match(/app\.js\?v=(\d+)/)[1])>=78);
});
test('summary renders independent reservation and remaining fund cards without modifying ledger totals',()=>{
 const app=read('app.js');
 assert.match(app,/class="fund-reserve-card"/);
 assert.match(app,/class="fund-reserve-card fund-reserve-card-remaining/);
 assert.match(app,/Cần dự phòng/);
 assert.match(app,/Sau khi giữ lại/);
 assert.match(app,/reminderMath\.totals\(fundReminders,actualFund\)/);
 assert.match(app,/class="fund-reminder-amount"/);
 assert.match(app,/fundRemindersAvailable&&remainingReminder\.outstanding/);
 const finance=read('finance.js');
 assert.doesNotMatch(finance,/fundReminder|fund_reminder/);
});
test('layout keeps two compact summary cards on phone widths with narrow-screen fallback',()=>{
 const css=read('styles.css');
 assert.match(css,/\.fund-reminder-summary:has\(\.fund-reserve-card\)/);
 assert.match(css,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 assert.match(css,/@media\(max-width:640px\)/);
 assert.match(css,/@media\(max-width:360px\)/);
 assert.match(css,/\.fund-reserve-value\{font-size:clamp/);
 assert.match(css,/\.fund-reminder-amount strong\{font-size:clamp/);
});
