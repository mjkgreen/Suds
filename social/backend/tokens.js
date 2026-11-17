// Fixed local-only signing secret and demo tokens. These only ever unlock the
// throwaway local database; they are not real credentials for anything.
const jwt = require('jsonwebtoken');
const SECRET = 'local-demo-only-secret-not-used-anywhere-else-000';
const DEMO_USER_ID = '00000000-0000-4000-a000-000000000001';
const far = Math.floor(Date.now() / 1000) + 10 * 365 * 86400;
const DEMO_USER = { id: DEMO_USER_ID, aud: 'authenticated', role: 'authenticated', email: 'jordan@example.com',
  app_metadata: { provider: 'email' }, user_metadata: { username: 'jordanr' }, created_at: '2026-01-01T00:00:00Z' };
const tokens = {
  anon: jwt.sign({ role: 'anon', iss: 'supabase', exp: far }, SECRET),
  user: jwt.sign({ sub: DEMO_USER_ID, role: 'authenticated', aud: 'authenticated', email: DEMO_USER.email, exp: far }, SECRET),
};
module.exports = { SECRET, tokens, DEMO_USER, DEMO_USER_ID };
if (require.main === module) console.log(tokens[process.argv[2] || 'anon']);
