const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
test('audit trigger skips logging when the parent trip is being deleted',()=>{
 const sql=fs.readFileSync(path.join(__dirname,'..','fix_delete_trip_activity.sql'),'utf8');
 assert.match(sql,/create or replace function public\.log_trip_activity\(\)/);
 const guard=sql.indexOf('if not exists(select 1 from public.trips where id=target_trip)');
 const insert=sql.indexOf('insert into public.trip_activity');
 assert.ok(guard>0&&insert>guard,'trip existence guard must run before the activity insert');
 assert.match(sql,/security definer set search_path=public,pg_temp/);
});

test('fresh installs via payment_history.sql include the same delete-trip guard',()=>{
 const sql=fs.readFileSync(path.join(__dirname,'..','payment_history.sql'),'utf8');
 const fn=sql.slice(sql.indexOf('create or replace function public.log_trip_activity()'));
 const guard=fn.indexOf('if not exists(select 1 from public.trips where id=target_trip)');
 const insert=fn.indexOf('insert into public.trip_activity');
 assert.ok(guard>0&&insert>guard,'guard must precede the insert in payment_history.sql');
});
