import { logger } from './logger';

// Simple email service using Node.js built-in capabilities
// In production, you would use a service like SendGrid, AWS SES, or Nodemailer

export interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export const sendEmail = async (options: EmailOptions): Promise<void> => {
  try {
    // For now, we'll log the email content
    // In production, integrate with an email service provider
    logger.info('Email would be sent:', {
      to: options.to,
      subject: options.subject,
      text: options.text
    });

    // TODO: Integrate with email service provider (SendGrid, AWS SES, Nodemailer, etc.)
    // Example with Nodemailer:
    // const transporter = nodemailer.createTransport({
    //   host: process.env.SMTP_HOST,
    //   port: parseInt(process.env.SMTP_PORT || '587'),
    //   secure: false,
    //   auth: {
    //     user: process.env.SMTP_USER,
    //     pass: process.env.SMTP_PASS,
    //   },
    // });
    // 
    // await transporter.sendMail({
    //   from: process.env.FROM_EMAIL || 'noreply@goforglorystable.com',
    //   to: options.to,
    //   subject: options.subject,
    //   text: options.text,
    //   html: options.html,
    // });

    // For development, we'll simulate email sending
    // In production, replace this with actual email service
    console.log('\n=== EMAIL NOTIFICATION ===');
    console.log(`To: ${options.to}`);
    console.log(`Subject: ${options.subject}`);
    console.log(`Body:\n${options.text}`);
    console.log('==========================\n');
  } catch (error) {
    logger.error('Failed to send email:', error);
    throw error;
  }
};

export const sendRegistrationNotification = async (userData: {
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  country?: string;
  city?: string;
  state?: string;
}): Promise<void> => {
  const adminEmail = 'info@goforglorystable.com';
  
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

  await sendEmail({
    to: adminEmail,
    subject: 'New User Registration - Go For Glory Stable',
    text: emailText
  });
};

export const sendPasswordResetEmail = async (email: string, resetToken: string): Promise<void> => {
  // In production, this would be a proper reset link
  const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`;
  
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
      <p>
        <a href="${resetLink}" style="background-color: #2d5016; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
          Reset Password
        </a>
      </p>
      <p>This link will expire in 1 hour.</p>
      <p style="color: #666; font-size: 12px;">If you did not request this password reset, please ignore this email.</p>
      <p>Best regards,<br>Go For Glory Stable Team</p>
    </div>
  `;

  await sendEmail({
    to: email,
    subject: 'Reset Your Password - Go For Glory Stable',
    text: emailText,
    html: emailHtml
  });
};

