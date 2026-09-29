// Integration test: all mail goes to an isolated localhost SMTP sink, never an external mailbox.
// Run from the project directory: node tests/verify-enquiry.mjs
import assert from 'node:assert/strict';
import net from 'node:net';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const messages = [];
const sockets = new Set();
const smtp = net.createServer(socket => {
  sockets.add(socket);
  socket.on('close', () => sockets.delete(socket));
  socket.write('220 localhost test SMTP\r\n');
  let buffer = '', data = false, message = [];
  socket.on('data', chunk => {
    buffer += chunk.toString();
    let end;
    while ((end = buffer.indexOf('\r\n')) >= 0) {
      const line = buffer.slice(0, end); buffer = buffer.slice(end + 2);
      if (data) {
        if (line === '.') { messages.push(message.join('\r\n')); message = []; data = false; socket.write('250 Message accepted by local test sink\r\n'); }
        else message.push(line.startsWith('..') ? line.slice(1) : line);
      } else if (/^(EHLO|HELO)/i.test(line)) socket.write('250-localhost\r\n250 8BITMIME\r\n');
      else if (/^DATA/i.test(line)) { data = true; socket.write('354 End with a dot\r\n'); }
      else if (/^QUIT/i.test(line)) socket.end('221 Bye\r\n');
      else socket.write('250 OK\r\n');
    }
  });
});
await new Promise(resolve => smtp.listen(0, '127.0.0.1', resolve));
const probe = net.createServer();
await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
const port = probe.address().port;
await new Promise(resolve => probe.close(resolve));
const rateDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'diravo-enquiry-test-'));
const server = spawn('php', ['-S', `127.0.0.1:${port}`, '-t', root, path.join(root, 'scripts', 'serve.php')], {
  cwd: root, windowsHide: true,
  env: { ...process.env, MAIL_TRANSPORT: 'smtp', MAIL_HOST: '127.0.0.1', MAIL_PORT: String(smtp.address().port), MAIL_ENCRYPTION: 'none', MAIL_USERNAME: '', MAIL_PASSWORD: '', MAIL_FROM_EMAIL: 'sender@example.test', MAIL_RECIPIENT: 'recipient@example.test', ENQUIRY_RATE_DIR: rateDirectory }
});
let serverLog = '';
server.stderr.on('data', data => { serverLog += data.toString(); });
server.on('error', error => { console.error(error.message); });
const base = `http://127.0.0.1:${port}`;
let cookie = '', token;
const post = async (overrides = {}, omit = []) => {
  const data = { csrf_token: token, name: 'Website Reviewer', organisation: 'Test Organisation', email: 'reviewer@example.test', phone: '+254 700 000000', purpose: 'General enquiry', message: 'Please help us plan a purposeful event.', 'services[]': 'Events & Experiences', ...overrides };
  omit.forEach(key => delete data[key]);
  return fetch(`${base}/api/enquiry.php`, { method: 'POST', headers: { Cookie: cookie, Origin: base }, body: new URLSearchParams(data) });
};
try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    try { const response = await fetch(`${base}/api/enquiry.php`); if (response.ok) { cookie = response.headers.get('set-cookie').split(';')[0]; token = (await response.json()).token; ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  assert(ready, `PHP test server did not start: ${serverLog}`);
  assert.match(token, /^[a-f0-9]{64}$/);
  assert.equal((await fetch(`${base}/api/enquiry.php`, { method: 'PUT' })).status, 405);
  assert.equal((await post({ csrf_token: 'invalid' })).status, 403);
  assert.equal((await post({ email: 'not-an-email' })).status, 422);
  assert.equal((await post({}, ['services[]'])).status, 422);
  assert.equal((await post({ 'services[]': 'Unknown service' })).status, 422);
  assert.equal((await post({ name: 'Injected\r\nBcc: someone@example.test' })).status, 422);
  assert.equal((await post({ message: 'x'.repeat(21000) })).status, 413);
  assert.equal((await post({ website: 'spam.example' })).status, 200);
  assert.equal(messages.length, 0, 'A honeypot submission must not send email.');
  for (const privatePath of ['/client%20data/DIRAVO%20Company%20Profile%20v3.pdf', '/config/mail.example.php', '/vendor/autoload.php', '/composer.json', '/tests/verify-enquiry.mjs']) {
    assert.equal((await fetch(base + privatePath)).status, 404, `Internal file exposed: ${privatePath}`);
  }
  let result = await post();
  assert.equal(result.status, 200);
  assert.equal((await result.json()).success, true);
  assert.equal(messages.length, 1);
  assert.match(messages[0], /To: recipient@example\.test/);
  assert.match(messages[0], /Reply-To: Website Reviewer <reviewer@example\.test>/);
  assert.match(messages[0], /Events & Experiences/);
  assert.match(messages[0], /Please help us plan a purposeful event/);
  for (let index = 0; index < 4; index++) assert.equal((await post()).status, 200);
  result = await post();
  assert.equal(result.status, 429);
  assert.equal(messages.length, 5, 'The rate-limited enquiry must not send another email.');
  console.log('PASS: form sessions, validation, injection rejection, honeypot, private-file protection, SMTP delivery, reply-to and rate limiting. No external emails sent.');
} finally {
  server.kill();
  for (const socket of sockets) socket.destroy();
  await new Promise(resolve => smtp.close(resolve));
  for (const file of fs.readdirSync(rateDirectory)) {
    if (/^[a-f0-9]{64}\.json$/.test(file)) fs.unlinkSync(path.join(rateDirectory, file));
  }
  fs.rmdirSync(rateDirectory);
}
