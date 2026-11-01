import { describe, expect, it } from 'vitest';
import { buildQueries, decodeMessage } from '../src/sources/gmail.js';

const b64url = (text) => Buffer.from(text, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

describe('gmail helpers', () => {
  it('decodes multipart messages (base64url, UTF-8) and headers', () => {
    const html = '<p>예약 확인 — ICN → NRT</p>';
    const msg = {
      id: 'abc',
      threadId: 'thr',
      internalDate: '1700000000000',
      payload: {
        mimeType: 'multipart/alternative',
        headers: [
          { name: 'Subject', value: 'Your trip ✈' },
          { name: 'From', value: 'Korean Air <noreply@koreanair.com>' },
        ],
        parts: [
          { mimeType: 'text/plain', headers: [{ name: 'Content-Type', value: 'text/plain; charset="UTF-8"' }], body: { data: b64url('short') } },
          { mimeType: 'text/html', headers: [{ name: 'Content-Type', value: 'text/html; charset=utf-8' }], body: { data: b64url(html) } },
          { mimeType: 'application/pdf', filename: 'ticket.pdf', body: { attachmentId: 'x' } },
        ],
      },
    };
    const email = decodeMessage(msg);
    expect(email).toMatchObject({ id: 'abc', threadId: 'thr', subject: 'Your trip ✈', from: 'Korean Air <noreply@koreanair.com>', date: 1700000000000, html });
    // Short plain-text parts are dropped in favour of the HTML body.
    expect(email.text).toBe('');
  });

  it('builds focused, union-able search queries', () => {
    const queries = buildQueries({ since: '2020-01-31' });
    expect(queries[0].q).toContain('category:reservations');
    expect(queries.every((q) => q.q.includes('after:2020/01/31'))).toBe(true);
    expect(queries.every((q) => q.q.includes('-category:promotions'))).toBe(true);
    expect(queries.some((q) => q.q.includes('koreanair.com'))).toBe(true);
    expect(buildQueries({ includePromotions: true }).some((q) => q.q.includes('-category:promotions'))).toBe(false);
  });
});
