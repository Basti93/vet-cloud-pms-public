/**
 * Appointment Confirmation Tokens
 * JWT-based tokens for email confirmation links
 */

import jwt from 'jsonwebtoken';

export interface ConfirmationTokenPayload {
  appointmentId: string;
  ownerEmail: string;
  action: 'confirm' | 'cancel';
  iat?: number;
  exp?: number;
}

const TOKEN_EXPIRY = '24h'; // 24 hours

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret === 'your-secret-key-change-this') {
    throw new Error(
      'JWT_SECRET environment variable must be set to a strong secret (minimum 32 characters). ' +
      'Set a secure random value in .env or your deployment platform.'
    );
  }
  return secret;
}

const SECRET = getSecret();

/**
 * Generate a confirmation token for an appointment
 */
export function generateConfirmationToken(
  appointmentId: string,
  ownerEmail: string,
  action: 'confirm' | 'cancel' = 'confirm'
): string {
  const payload: ConfirmationTokenPayload = {
    appointmentId,
    ownerEmail,
    action,
  };

  return jwt.sign(payload, SECRET, {
    expiresIn: TOKEN_EXPIRY,
    algorithm: 'HS256',
  });
}

/**
 * Verify and decode a confirmation token
 */
export function verifyConfirmationToken(token: string): ConfirmationTokenPayload | null {
  try {
    const decoded = jwt.verify(token, SECRET, {
      algorithms: ['HS256'],
    });

    return decoded as ConfirmationTokenPayload;
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

/**
 * Build confirmation URL
 */
export function buildConfirmationUrl(token: string, baseUrl: string, action: 'confirm' | 'cancel' = 'confirm'): string {
  const endpoint = action === 'cancel' ? '/api/appointments/cancel' : '/confirm';
  return `${baseUrl}${endpoint}?token=${token}`;
}
