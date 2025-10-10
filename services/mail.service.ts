import sgMail from '@sendgrid/mail'

import config from '../config'
import { sendFormResponseEmailTemplate } from '../emails/emailTemplate'
import logger from '../utils/logger'

sgMail.setApiKey(config.SENDGRID_API_KEY)

// Interface for email attachments
interface EmailAttachment {
  content: string
  filename: string
  type: string
  disposition?: 'attachment' | 'inline'
}

// Interface for email options
export interface EmailOptions {
  to: string | string[]
  subject: string
  text: string
  html?: string
  from?: string
  attachments?: EmailAttachment[]
}

// Type for the response from SendGrid
type SendGridResponse = [sgMail.ClientResponse, object]

/**
 * Sends an email using SendGrid
 * @param options - Email configuration options
 * @returns Promise that resolves with SendGrid response
 * @throws Error if email sending fails
 */
export const sendEmail = async ({
  to,
  subject,
  text,
  html,
  from = config.DEFAULT_FROM_EMAIL,
  attachments = [],
}: EmailOptions): Promise<SendGridResponse> => {
  try {
    const msg: sgMail.MailDataRequired = {
      to,
      from,
      subject,
      text,
      html: html || text,
      attachments,
    }

    const response = await sgMail.send(msg)

    return response
  } catch (error) {
    logger.error('Error sending email:', {
      meta: {
        error,
      },
    })
    throw error
  }
}

export const sendFormResponseEmail = async (
  to: string,
  formName: string,
  projectName: string,
  name: string,
  email: string,
  formSubject?: string | null
): Promise<SendGridResponse> => {
  const message = `You have a new response in ${formName} of ${projectName}`

  const subject = formSubject ?? message

  const text = sendFormResponseEmailTemplate(
    formName,
    projectName,
    message,
    name,
    email
  )

  return sendEmail({ to, subject, text })
}
