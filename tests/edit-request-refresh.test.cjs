const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync(require.resolve('../app.js'), 'utf8');
const start = source.indexOf('async function fetchEditRequests(tripId){');
const end = source.indexOf('async function requestEditAccess()', start);
assert.ok(start >= 0 && end > start, 'edit-request loader should exist');
const loader = source.slice(start, end);

function makeLoader(reply) {
  const calls = [];
  const context = {
    db: {rpc: async (name, params) => {
      calls.push({name, params});
      return reply;
    }},
    console: {warn: () => {}}
  };
  const fn = vm.runInNewContext(loader + '\nfetchEditRequests', context);
  return {fn, calls};
}

test('trip refresh fetches real edit requests rather than an empty placeholder', () => {
  const refreshStart = source.indexOf('async function refresh(){');
  const renderStart = source.indexOf('\nfunction render(){', refreshStart);
  assert.ok(refreshStart >= 0 && renderStart > refreshStart);
  const refresh = source.slice(refreshStart, renderStart);
  assert.match(refresh, /fetchEditRequests\(tripId\)/);
  assert.doesNotMatch(refresh, /Promise\.resolve\(\{items:\[\],available:false\}\)/);
  assert.match(refresh, /editRequests=requests\.items/);
  assert.match(refresh, /editRequestsAvailable=requests\.available/);
});

test('edit request loader returns pending requests for the specified trip', async () => {
  const {fn, calls} = makeLoader({
    data: [{user_id: 'member-id', status: 'pending', name: 'Member'}],
    error: null
  });
  const response = await fn('trip-id');
  assert.deepEqual(JSON.parse(JSON.stringify(response)), {
    items: [{user_id: 'member-id', status: 'pending', name: 'Member'}],
    available: true
  });
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [{
    name: 'list_trip_edit_requests',
    params: {p_trip_id: 'trip-id'}
  }]);
});

test('missing optional migration remains unavailable without aborting refresh', async () => {
  const {fn} = makeLoader({data:null,error:{code:'PGRST202',message:'RPC not found'}});
  const result = await fn('trip-id');
  assert.deepEqual(JSON.parse(JSON.stringify(result)), {items:[],available:false});
});
