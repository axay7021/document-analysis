import sgMail from '@sendgrid/mail'
import nodemailer from 'nodemailer'
import { config } from '../config'
import { AuthError } from './authError'

export interface VerificationMailer {
  configured(): boolean
  send(email: string, code: string): Promise<void>
}

export const verificationMailer: VerificationMailer = {
  configured: () =>
    Boolean(
      (process.env.SMTP_USER && process.env.SMTP_PASSWORD) ||
        (config.SENDGRID_API_KEY && config.DEFAULT_FROM_EMAIL)
    ),
  async send(email, code) {
    if (!this.configured())
      throw new AuthError(
        'EMAIL_NOT_CONFIGURED',
        'Email verification delivery is not configured yet.',
        503
      )
    try {
      const text = `Your verification code is ${code}. It expires in 15 minutes. If you did not request this, ignore this message.`
      if (process.env.SMTP_USER && process.env.SMTP_PASSWORD) {
        const transport = nodemailer.createTransport({
          host: process.env.SMTP_HOST || 'smtp.gmail.com',
          port: Number(process.env.SMTP_PORT || 587),
          secure: process.env.SMTP_PORT === '465',
          requireTLS: process.env.SMTP_PORT !== '465',
          connectionTimeout: 15000,
          socketTimeout: 20000,
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD,
          },
        })
        await transport.sendMail({
          from: {
            name: 'Document Analysis',
            address: process.env.SMTP_FROM || process.env.SMTP_USER,
          },
          to: email,
          subject: 'Verify your Document Analysis email',
          text,
        })
        return
      }
      sgMail.setApiKey(config.SENDGRID_API_KEY)
      await sgMail.send({
        to: email,
        from: { email: config.DEFAULT_FROM_EMAIL, name: 'Document Analysis' },
        subject: 'Verify your Document Analysis email',
        text: `Your verification code is ${code}. It expires in 15 minutes. If you did not request this, ignore this message.`,
        html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;color:#24334b"><h2>Verify your email</h2><p>Use this code to finish signing in to Document Analysis:</p><p style="font-size:32px;letter-spacing:8px;font-weight:bold">${code}</p><p>Expires in 15 minutes. If you did not request this, ignore this email.</p></div>`,
      })
    } catch {
      throw new AuthError(
        'EMAIL_DELIVERY_FAILED',
        'We could not send the verification email. Please try again later.',
        503
      )
    }
  },
}
