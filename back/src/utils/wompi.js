import { createHash, timingSafeEqual } from 'crypto';

export function createIntegritySignature(reference, amountInCents, currency, secret) {
  return createHash('sha256')
    .update(`${reference}${amountInCents}${currency}${secret}`)
    .digest('hex');
}

function getPropertyValue(source, path) {
  return path.split('.').reduce((value, key) => {
    if (!value || typeof value !== 'object' || !Object.prototype.hasOwnProperty.call(value, key)) return undefined;
    return value[key];
  }, source);
}

export function verifyWompiEvent(event, secret) {
  const properties = event?.signature?.properties;
  const checksum = event?.signature?.checksum;

  if (!Array.isArray(properties) || properties.length === 0 || !/^([a-f0-9]{64})$/i.test(checksum ?? '')) {
    return false;
  }

  const values = [];
  for (const property of properties) {
    if (typeof property !== 'string') return false;
    const value = getPropertyValue(event.data, property);
    if (value === undefined || value === null) return false;
    values.push(String(value));
  }

  if (!Number.isInteger(event.timestamp)) return false;

  const expected = createHash('sha256')
    .update(`${values.join('')}${event.timestamp}${secret}`)
    .digest();
  const received = Buffer.from(checksum, 'hex');
  return received.length === expected.length && timingSafeEqual(received, expected);
}