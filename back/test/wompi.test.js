import assert from 'assert';
import { createHash } from 'crypto';
import { createIntegritySignature, verifyWompiEvent } from '../src/utils/wompi.js';

assert.equal(
  createIntegritySignature('ref-123', 250000, 'COP', 'test_secret'),
  createHash('sha256').update('ref-123250000COPtest_secret').digest('hex')
);

const event = {
  data: { transaction: { id: 'tx-123', status: 'APPROVED', amount_in_cents: 250000 } },
  signature: { properties: ['transaction.id', 'transaction.status', 'transaction.amount_in_cents'] },
  timestamp: 1760000000,
};
const value = 'tx-123APPROVED2500001760000000events_secret';
event.signature.checksum = createHash('sha256').update(value).digest('hex');
assert.equal(verifyWompiEvent(event, 'events_secret'), true);

const alteredEvent = {
  data: { transaction: { status: 'APPROVED' } },
  signature: {
    properties: ['transaction.status'],
    checksum: createHash('sha256').update('APPROVED1760000000events_secret').digest('hex'),
  },
  timestamp: 1760000000,
};
assert.equal(verifyWompiEvent(alteredEvent, 'events_secret'), true);
alteredEvent.data.transaction.status = 'DECLINED';
assert.equal(verifyWompiEvent(alteredEvent, 'events_secret'), false);

console.log('Pruebas Wompi: 3 verificaciones correctas.');