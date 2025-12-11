import nodemailer, { Transporter } from 'nodemailer';
import { logger } from './logger';

// Email service using Nodemailer with dynamic SMTP configuration
// Supports multiple SMTP providers (Gmail, SendGrid, custom SMTP, etc.)

export interface EmailOptions {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    path?: string;
    content?: string | Buffer;
    contentType?: string;
  }>;
}

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  auth?: {
    user: string;
    pass: string;
  };
  tls?: {
    rejectUnauthorized: boolean;
  };
}

/**
 * Get SMTP configuration from environment variables
 * Supports multiple providers: Gmail, SendGrid, custom SMTP
 */
const getSmtpConfig = (): SmtpConfig | null => {
  // Check if SMTP is configured
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  // If no SMTP configuration, return null (will use console logging)
  if (!smtpHost || !smtpPort || !smtpUser || !smtpPass) {
    return null;
  }

  const port = parseInt(smtpPort, 10);
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;

  return {
    host: smtpHost,
    port,
    secure,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
    tls: {
      rejectUnauthorized: process.env.SMTP_REJECT_UNAUTHORIZED !== 'false',
    },
  };
};

/**
 * Create nodemailer transporter
 * Returns null if SMTP is not configured (for development)
 */
const createTransporter = (): Transporter | null => {
  const smtpConfig = getSmtpConfig();

  if (!smtpConfig) {
    return null;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.secure,
      auth: smtpConfig.auth,
      tls: smtpConfig.tls,
    });

    return transporter;
  } catch (error) {
    logger.error('Failed to create email transporter:', error);
    return null;
  }
};

/**
 * Send email using nodemailer
 * Falls back to console logging if SMTP is not configured
 */
export const sendEmail = async (options: EmailOptions): Promise<void> => {
  try {
    const transporter = createTransporter();
    const fromEmail = process.env.FROM_EMAIL || process.env.SMTP_USER || 'noreply@goforglorystable.com';
    const fromName = process.env.FROM_NAME || 'Go For Glory Stable';

    // If transporter is not available (development mode), log to console
    if (!transporter) {
      logger.warn('SMTP not configured. Email will be logged to console instead of being sent.');
      logger.info('Email would be sent:', {
        from: `${fromName} <${fromEmail}>`,
        to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
        subject: options.subject,
        text: options.text,
      });

      console.log('\n=== EMAIL NOTIFICATION ===');
      console.log(`From: ${fromName} <${fromEmail}>`);
      console.log(`To: ${Array.isArray(options.to) ? options.to.join(', ') : options.to}`);
      if (options.cc) {
        console.log(`CC: ${Array.isArray(options.cc) ? options.cc.join(', ') : options.cc}`);
      }
      if (options.bcc) {
        console.log(`BCC: ${Array.isArray(options.bcc) ? options.bcc.join(', ') : options.bcc}`);
      }
      console.log(`Subject: ${options.subject}`);
      console.log(`Body:\n${options.text}`);
      if (options.html) {
        console.log(`\nHTML Body:\n${options.html}`);
      }
      console.log('==========================\n');
      return;
    }

    // Send email using nodemailer
    const mailOptions = {
      from: `${fromName} <${fromEmail}>`,
      to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
      cc: options.cc ? (Array.isArray(options.cc) ? options.cc.join(', ') : options.cc) : undefined,
      bcc: options.bcc ? (Array.isArray(options.bcc) ? options.bcc.join(', ') : options.bcc) : undefined,
      replyTo: options.replyTo,
      attachments: options.attachments,
    };

    const info = await transporter.sendMail(mailOptions);

    logger.info('Email sent successfully:', {
      messageId: info.messageId,
      to: options.to,
      subject: options.subject,
    });
  } catch (error) {
    logger.error('Failed to send email:', error);
    throw error;
  }
};

/**
 * Verify SMTP connection
 * Useful for testing email configuration
 */
export const verifyEmailConnection = async (): Promise<boolean> => {
  const transporter = createTransporter();

  if (!transporter) {
    logger.warn('SMTP not configured. Cannot verify connection.');
    return false;
  }

  try {
    await transporter.verify();
    logger.info('SMTP connection verified successfully');
    return true;
  } catch (error) {
    logger.error('SMTP connection verification failed:', error);
    return false;
  }
};

/**
 * Send registration notification email to admin
 */
export const sendRegistrationNotification = async (userData: {
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  country?: string;
  city?: string;
  state?: string;
}): Promise<void> => {
  const adminEmail = process.env.ADMIN_EMAIL || 'info@goforglorystable.com';

  const emailText = `
New User Registration

A new user has registered on Go For Glory Stable:

Name: ${userData.first_name} ${userData.last_name}
Email: ${userData.email}
Phone: ${userData.phone || 'Not provided'}
Location: ${[userData.city, userData.state, userData.country].filter(Boolean).join(', ') || 'Not provided'}

Registration Date: ${new Date().toLocaleString()}

Please review this registration in the admin panel.
  `.trim();

  const emailHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2d5016;">New User Registration</h2>
      <p>A new user has registered on Go For Glory Stable:</p>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Name:</strong></td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd;">${userData.first_name} ${userData.last_name}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Email:</strong></td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd;">${userData.email}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Phone:</strong></td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd;">${userData.phone || 'Not provided'}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Location:</strong></td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd;">${[userData.city, userData.state, userData.country].filter(Boolean).join(', ') || 'Not provided'}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Registration Date:</strong></td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd;">${new Date().toLocaleString()}</td>
        </tr>
      </table>
      <p>Please review this registration in the admin panel.</p>
    </div>
  `;

  await sendEmail({
    to: adminEmail,
    subject: 'New User Registration - Go For Glory Stable',
    text: emailText,
    html: emailHtml,
  });
};

/**
 * Send password reset email
 */
export const sendPasswordResetEmail = async (email: string, resetToken: string): Promise<void> => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const resetLink = `${frontendUrl}/reset-password?token=${resetToken}`;

  const emailText = `
Password Reset Request

You have requested to reset your password for your Go For Glory Stable account.

Click the link below to reset your password:
${resetLink}

This link will expire in 1 hour.

If you did not request this password reset, please ignore this email.

Best regards,
Go For Glory Stable Team
  `.trim();

  const emailHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2d5016;">Password Reset Request</h2>
      <p>You have requested to reset your password for your Go For Glory Stable account.</p>
      <p style="text-align: center; margin: 30px 0;">
        <a href="${resetLink}" style="background-color: #2d5016; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
          Reset Password
        </a>
      </p>
      <p>This link will expire in 1 hour.</p>
      <p style="color: #666; font-size: 12px; margin-top: 30px;">If you did not request this password reset, please ignore this email.</p>
      <p>Best regards,<br>Go For Glory Stable Team</p>
    </div>
  `;

  await sendEmail({
    to: email,
    subject: 'Reset Your Password - Go For Glory Stable',
    text: emailText,
    html: emailHtml,
  });
};
