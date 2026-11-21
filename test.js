// Unit + integration tests: run with `npm test`. Uses a temporary data folder and offline AI fallback.
const os = require('os'),
  fs = require('fs'),
  path = require('path'),
  assert = require('assert');
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-'));
process.env.ANTHROPIC_API_KEY = '';
process.env.GEMINI_API_KEY = '';
const { score, hav, band, app } = require('./server');
(async () => {
  assert.strictEqual(band(80), 'Critical');
  assert.strictEqual(band(60), 'High');
  assert.strictEqual(band(40), 'Medium');
  assert.strictEqual(band(10), 'Low');
  assert.ok(Math.abs(hav(0, 0, 0, 0.001) - 111) < 2);
  const base = {
    lat: 0,
    lng: 0,
    size: 5,
    safety: 5,
    road: 'main',
    count: 10,
    created: Date.now() - 30 * 864e5,
  };
  assert.ok(score(base).total > score({ ...base, size: 1, safety: 1, count: 1 }).total);
  assert.ok(score(base).total <= 100);
  const srv = app.listen(0),
    B = 'http://localhost:' + srv.address().port;
  const call = async (u, m = 'GET', b, h = {}) => {
    const r = await fetch(B + u, {
      method: m,
      headers: { 'content-type': 'application/json', ...h },
      body: b ? JSON.stringify(b) : undefined,
    });
    return { s: r.status, j: await r.json().catch(() => ({})) };
  };
  assert.strictEqual((await call('/api/health')).j.ok, true);
  assert.strictEqual((await call('/api/issues')).j.length, 5, 'seeded');
  // accounts
  assert.strictEqual(
    (await call('/api/register', 'POST', { name: 'A', email: 'x', password: '1' })).s,
    400,
  );
  const reg = await call('/api/register', 'POST', {
    name: 'Test User',
    email: 't@x.com',
    password: 'password1',
  });
  assert.strictEqual(reg.s, 200);
  assert.strictEqual(
    (
      await call('/api/register', 'POST', {
        name: 'Test User',
        email: 't@x.com',
        password: 'password1',
      })
    ).s,
    409,
  );
  assert.strictEqual(
    (await call('/api/login', 'POST', { email: 't@x.com', password: 'wrong' })).s,
    401,
  );
  const cit = { authorization: 'Bearer ' + reg.j.token },
    me = await call('/api/me', 'GET', null, cit);
  assert.strictEqual(me.j.role, 'citizen');
  assert.strictEqual(
    (await call('/api/me', 'GET', null, { authorization: 'Bearer bad.token' })).s,
    401,
    'forged token rejected',
  );
  // validation
  assert.strictEqual(
    (await call('/api/triage', 'POST', { text: 'x', lat: 0, lng: 0 })).s,
    400,
    'outside service area',
  );
  assert.strictEqual(
    (await call('/api/triage', 'POST', { lat: 18.763, lng: 84.418 })).s,
    400,
    'needs photo or text',
  );
  // report flow
  const img = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2w==';
  const t1 = await call('/api/triage', 'POST', {
    text: 'big pothole',
    lat: 18.763,
    lng: 84.418,
    image: img,
  });
  assert.strictEqual(t1.j.assessment.issue_type, 'pothole');
  assert.ok(t1.j.assessment.offline);
  const rep = await call('/api/reports', 'POST', { triageId: t1.j.triageId }, cit);
  assert.strictEqual(rep.s, 200);
  assert.ok(rep.j.ownerKey);
  const id = rep.j.id;
  const t2 = await call('/api/triage', 'POST', {
    text: 'same',
    lat: 18.763,
    lng: 84.418,
    image: img,
  });
  assert.strictEqual(t2.j.reusedPhoto, true, 'image reuse detected');
  assert.strictEqual(
    (await call('/api/reports', 'POST', { triageId: t2.j.triageId })).s,
    409,
    'reused photo blocked',
  );
  assert.strictEqual(
    (await call('/api/issues/' + id + '/support', 'POST')).s,
    409,
    'reporter cannot support own report',
  );
  const other = { 'x-forwarded-for': '9.9.9.9' };
  assert.strictEqual((await call('/api/issues/' + id + '/support', 'POST', null, other)).s, 200);
  assert.strictEqual(
    (await call('/api/issues/' + id + '/support', 'POST', null, other)).s,
    409,
    'no double support',
  );
  // authorisation
  assert.strictEqual(
    (await call('/api/issues/' + id + '/status', 'PATCH', { status: 'Resolved' })).s,
    401,
  );
  assert.strictEqual(
    (await call('/api/issues/' + id + '/status', 'PATCH', { status: 'Resolved' }, cit)).s,
    401,
    'citizen cannot update status',
  );
  assert.strictEqual(
    (await call('/api/issues/' + id + '/verify', 'POST', { image: img })).s,
    403,
    'stranger cannot verify',
  );
  assert.strictEqual(
    (
      await call(
        '/api/issues/' + id + '/verify',
        'POST',
        { image: img },
        { 'x-owner-key': rep.j.ownerKey },
      )
    ).s,
    200,
    'owner can verify',
  );
  const off = await call('/api/login', 'POST', {
      email: 'officer@civiclens.demo',
      password: 'Officer@123',
    }),
    oh = { authorization: 'Bearer ' + off.j.token };
  const up = await call(
    '/api/issues/' + id + '/status',
    'PATCH',
    { status: 'Assigned', assignee: 'Ravi', note: 'Crew sent' },
    oh,
  );
  assert.strictEqual(up.j.status, 'Assigned');
  assert.strictEqual(up.j.assignee, 'Ravi');
  assert.strictEqual(
    (await call('/api/audit', 'GET', null, oh)).s,
    401,
    'officer cannot read audit log',
  );
  const adm = await call('/api/login', 'POST', {
      email: 'admin@civiclens.demo',
      password: 'Admin@123',
    }),
    ah = { authorization: 'Bearer ' + adm.j.token };
  assert.ok(
    (await call('/api/audit', 'GET', null, ah)).j.some((a) => a.action === 'status'),
    'audit logged',
  );
  assert.ok((await call('/api/admin/escalate', 'POST', { force: true }, ah)).j.escalated > 0);
  assert.strictEqual((await call('/api/my-issues', 'GET', null, cit)).j.length, 1);
  srv.close();
  console.log('All tests passed');
  process.exit(0);
})().catch((e) => {
  console.error('FAILED:', e.message, e.stack.split('\n')[1]);
  process.exit(1);
});
