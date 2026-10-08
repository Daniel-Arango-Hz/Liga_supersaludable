import { randomBytes } from 'crypto';
import { Router } from 'express';
import { body } from 'express-validator';
import { supabaseAdmin } from '../config/supabase.js';
import { validate } from '../middleware/validate.js';
import { createIntegritySignature, verifyWompiEvent } from '../utils/wompi.js';

const router = Router();
const validStatuses = new Set(['PENDING', 'APPROVED', 'DECLINED', 'VOIDED', 'ERROR', 'PROCESSING']);

function wompiApiUrl() {
  return process.env.WOMPI_ENVIRONMENT === 'production'
    ? 'https://production.wompi.co/v1'
    : 'https://sandbox.wompi.co/v1';
}

function wompiConfiguration() {
  const { WOMPI_PUBLIC_KEY, WOMPI_INTEGRITY_SECRET, WOMPI_REDIRECT_URL } = process.env;
  if (!WOMPI_PUBLIC_KEY || !WOMPI_INTEGRITY_SECRET || !WOMPI_REDIRECT_URL) return null;

  try {
    const redirectUrl = new URL(WOMPI_REDIRECT_URL);
    if (redirectUrl.protocol !== 'https:' && process.env.NODE_ENV === 'production') return null;
    return { publicKey: WOMPI_PUBLIC_KEY, integritySecret: WOMPI_INTEGRITY_SECRET, redirectUrl: redirectUrl.toString() };
  } catch {
    return null;
  }
}

async function updateDonationFromTransaction(transaction) {
  if (!transaction?.reference || !validStatuses.has(transaction.status)) return false;
  if (transaction.currency !== 'COP' || !Number.isInteger(transaction.amount_in_cents)) return false;

  const { data: donation, error: lookupError } = await supabaseAdmin
    .from('donaciones')
    .select('reference, amount_in_cents, status')
    .eq('reference', transaction.reference)
    .maybeSingle();

  if (lookupError) throw lookupError;
  if (!donation || donation.amount_in_cents !== transaction.amount_in_cents) return false;
  if (['APPROVED', 'DECLINED', 'VOIDED', 'ERROR'].includes(donation.status)) return true;
  if (donation.status === transaction.status) return true;

  const { error } = await supabaseAdmin
    .from('donaciones')
    .update({
      status: transaction.status,
      transaction_id: transaction.id ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('reference', transaction.reference);

  if (error) throw error;
  return true;
}

router.post(
  '/wompi/checkout',
  [body('amount').isInt({ min: 1000, max: 50000000 }).withMessage('El aporte debe estar entre $1.000 y $50.000.000 COP')],
  validate,
  async (req, res) => {
    const config = wompiConfiguration();
    if (!config) return res.status(503).json({ error: 'La pasarela PSE no está configurada.' });

    const amountInCents = Number(req.body.amount) * 100;
    const reference = `FL-${Date.now()}-${randomBytes(8).toString('hex')}`;
    const currency = 'COP';

    const { error } = await supabaseAdmin.from('donaciones').insert({
      reference,
      amount_in_cents: amountInCents,
      currency,
      status: 'PENDING',
    });

    if (error) {
      console.error('No se pudo registrar el aporte pendiente:', error);
      return res.status(503).json({ error: 'No fue posible iniciar el aporte. Intenta de nuevo.' });
    }

    res.json({
      publicKey: config.publicKey,
      amountInCents,
      currency,
      reference,
      signature: createIntegritySignature(reference, amountInCents, currency, config.integritySecret),
      redirectUrl: config.redirectUrl,
    });
  }
);

router.get('/wompi/transacciones/:id', async (req, res) => {
  if (!process.env.WOMPI_EVENTS_SECRET) {
    return res.status(503).json({ error: 'La pasarela PSE no está configurada.' });
  }

  try {
    const response = await fetch(`${wompiApiUrl()}/transactions/${encodeURIComponent(req.params.id)}`);
    if (!response.ok) return res.status(502).json({ error: 'No se pudo consultar el estado del aporte.' });

    const payload = await response.json();
    const transaction = payload?.data;
    const updated = await updateDonationFromTransaction(transaction);
    if (!updated) return res.status(404).json({ error: 'No se encontró un aporte válido para esta transacción.' });

    res.json({
      id: transaction.id,
      reference: transaction.reference,
      amountInCents: transaction.amount_in_cents,
      currency: transaction.currency,
      status: transaction.status,
      paymentMethod: transaction.payment_method_type,
    });
  } catch (error) {
    console.error('Error al consultar transacción Wompi:', error);
    res.status(502).json({ error: 'No se pudo consultar el estado del aporte.' });
  }
});

router.post('/wompi/eventos', async (req, res) => {
  const secret = process.env.WOMPI_EVENTS_SECRET;
  if (!secret) return res.status(503).json({ error: 'Webhook no configurado.' });
  if (!verifyWompiEvent(req.body, secret)) return res.status(401).json({ error: 'Firma de evento inválida.' });

  if (req.body.event !== 'transaction.updated') return res.sendStatus(200);

  try {
    await updateDonationFromTransaction(req.body.data?.transaction);
    res.sendStatus(200);
  } catch (error) {
    console.error('Error al actualizar aporte desde webhook Wompi:', error);
    res.status(500).json({ error: 'No se pudo procesar el evento.' });
  }
});

export default router;