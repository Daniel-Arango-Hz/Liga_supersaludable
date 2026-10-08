import { validationResult } from 'express-validator';

/**
 * Ejecuta express-validator y responde 422 si hay errores.
 */
export function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() });
  }
  next();
}
