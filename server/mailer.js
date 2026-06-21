const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'earlyaccess.mbq@gmail.com',
    pass: process.env.EMAIL_PASS
  }
});

const formatUserId = (id) => {
  const num = parseInt(id, 10);
  if (isNaN(num)) return `MBQ${id}`;
  return `MBQ${String(num).padStart(3, '0')}`;
};

const sendSampleDispatchedEmail = async (user) => {
  if (!process.env.EMAIL_PASS) {
    console.warn('EMAIL_PASS not configured. Skipping email to', user.email);
    return;
  }

  const firstName = user.full_name ? user.full_name.split(' ')[0] : 'User';
  const volunteerId = formatUserId(user.id);
  const selectedQode = user.gene_type || 'MyBodyQode Full Panel';

  const mailOptions = {
    from: `"MyBodyQode Team" <${process.env.EMAIL_USER || 'earlyaccess.mbq@gmail.com'}>`,
    to: user.email,
    subject: "Your Sample is Dispatched 🧬 | MyBodyQode Early Access",
    html: `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  :root {
    color-scheme: light dark;
    supported-color-schemes: light dark;
  }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    background-color: #F4F4F2;
    color: #1A1A19;
    margin: 0;
    padding: 0;
  }
  .dark-img {
    display: none !important;
  }
  @media (prefers-color-scheme: dark) {
    .light-img {
      display: none !important;
    }
    .dark-img {
      display: block !important;
      margin: 0 auto !important;
      filter: brightness(0) invert(1);
    }
    .header-text {
      color: #FFFFFF !important;
    }
  }
  .container {
    max-width: 600px;
    margin: 40px auto;
    background-color: #FFFFFF;
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
  }
  .header {
    background: #FFFFFF;
    padding: 30px;
    text-align: center;
    border-bottom: 1px solid #F0F0ED;
  }
  .header img {
    height: 48px;
    width: auto;
    display: block;
    margin: 0 auto;
  }
  .content {
    padding: 40px 30px;
    line-height: 1.6;
    font-size: 16px;
    color: #5A5A55;
  }
  .greeting {
    font-size: 22px;
    font-weight: 700;
    color: #1A1A19;
    margin-bottom: 24px;
    text-transform: capitalize;
  }
  .highlight-banner {
    background: linear-gradient(135deg, #6057D7 0%, #3FC2AC 100%);
    border-radius: 12px;
    padding: 24px;
    color: #FFFFFF;
    margin: 30px 0;
    box-shadow: 0 4px 12px rgba(96, 87, 215, 0.15);
  }
  .highlight-banner h3 {
    margin: 0 0 16px 0;
    font-size: 16px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    opacity: 0.9;
  }
  .info-grid {
    display: table;
    width: 100%;
    border-collapse: collapse;
  }
  .info-cell {
    display: table-cell;
    width: 50%;
    vertical-align: top;
  }
  .info-cell-left {
    padding-right: 16px;
    border-right: 1px solid rgba(255,255,255,0.2);
  }
  .info-cell-right {
    padding-left: 20px;
  }
  .info-label {
    font-size: 11px;
    text-transform: uppercase;
    font-weight: 700;
    color: rgba(255,255,255,0.7);
    letter-spacing: 1px;
    margin-bottom: 6px;
  }
  .info-value {
    font-size: 18px;
    font-weight: 700;
    color: #FFFFFF;
  }
  .checklist {
    list-style-type: none;
    padding: 0;
    margin: 30px 0;
  }
  .checklist li {
    margin-bottom: 16px;
    padding-left: 32px;
    position: relative;
    color: #1A1A19;
    font-weight: 500;
  }
  .checklist li::before {
    content: '✓';
    position: absolute;
    left: 0;
    top: 0;
    color: #027A48;
    background-color: #ECFDF3;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    font-size: 12px;
  }
  .quote {
    font-style: italic;
    color: #8B8B86;
    border-left: 3px solid #6057D7;
    padding-left: 20px;
    margin: 30px 0;
    font-size: 15px;
  }
  .button-container {
    text-align: center;
    margin: 40px 0;
  }
  .button {
    background-color: #1A1A19;
    color: #FFFFFF !important;
    text-decoration: none;
    padding: 16px 32px;
    border-radius: 12px;
    font-weight: 700;
    font-size: 16px;
    display: inline-block;
    transition: all 0.2s ease;
  }
  .footer {
    background-color: #F9F9F8;
    border-top: 1px solid #E8E8E5;
    padding: 30px;
    text-align: center;
    font-size: 12px;
    color: #A0A09D;
  }
  .tagline {
    font-weight: 700;
    color: #6057D7;
    margin-bottom: 10px;
    font-size: 14px;
  }
</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <!-- Light Mode Logo -->
      <img src="https://mybodyqode.vercel.app/assets/logo-CgtdQmKz.png" alt="MyBodyQode Logo" style="height: 48px; width: auto;" class="light-img">
      <!-- Dark Mode Logo (Replace URL with dark variant) -->
      <img src="https://mybodyqode.vercel.app/assets/logo-CgtdQmKz.png" alt="MyBodyQode Logo Dark" style="height: 48px; width: auto; display: none;" class="dark-img">
      <h1 class="header-text" style="color: #1A1A19; font-size: 20px; margin-top: 10px; font-weight: 800; letter-spacing: -0.5px;">MyBodyQode</h1>
    </div>
    <div class="content">
      <div class="greeting">Hi ${firstName},</div>
      
      <p>Thank you for submitting your DNA sample and becoming part of the <strong>MyBodyQode Early Access Program</strong>.</p>
      
      <p style="color: #1A1A19; font-weight: 600;">Your sample has been successfully linked to your profile and marked as dispatched.</p>
      
      <div class="highlight-banner">
        <h3>Sample Details</h3>
        <div class="info-grid" style="margin-bottom: 20px;">
          <div class="info-cell info-cell-left">
            <div class="info-label">Volunteer ID</div>
            <div class="info-value">${volunteerId}</div>
          </div>
          <div class="info-cell info-cell-right">
            <div class="info-label">Selected Test</div>
            <div class="info-value" style="font-size: 15px;">${selectedQode}</div>
          </div>
        </div>
        <div class="info-grid">
          <div class="info-cell info-cell-left">
            <div class="info-label">Username</div>
            <div class="info-value" style="font-size: 15px;">${user.username}</div>
          </div>
          <div class="info-cell info-cell-right">
            <div class="info-label">Email</div>
            <div class="info-value" style="font-size: 14px; word-break: break-all;">${user.email}</div>
          </div>
        </div>
      </div>
      
      <p>At MyBodyQode, we believe that understanding your body shouldn't require a team of experts, endless guesswork, or years of trial and error.</p>
      <p>Most people spend their lives following generic advice. The same diet. The same workout. The same wellness trends.</p>
      <p>Yet not every body responds the same way. <strong>Because your biology is one of a kind.</strong></p>
      
      <h3 style="color: #1A1A19; margin-top: 40px; font-size: 18px;">What happens next?</h3>
      <ul class="checklist">
        <li>Our laboratory partner will receive and process your sample.</li>
        <li>Your DNA result will be analyzed.</li>
        <li>We will combine your genetic result with your questionnaire responses.</li>
        <li>Your personalized MyBodyQode report will be generated.</li>
        <li>You'll receive exclusive early access to Qodai, our AI-powered report assistant.</li>
        <li>You'll gain access to biological insights designed to help you better understand your body's unique tendencies and responses.</li>
      </ul>
      
      <div class="button-container">
        <a href="https://mbq-tutorial.vercel.app/login" class="button">Track My Progress</a>
      </div>
      
      <div class="quote">
        <p>"Maybe the problem isn't that you're trying harder. Maybe it's that nobody taught you how your body works."</p>
      </div>
      
      <div class="quote">
        <p>"Personalized wellness shouldn't be a luxury for the few. It should be accessible to everyone."</p>
      </div>
      
      <p>Thank you for helping us build the future of personalized health and Consumer Biological Intelligence.</p>
      <p>Your participation is helping us create a world where people can move beyond guesswork and make decisions based on a deeper understanding of themselves.</p>
      
      <p style="color: #1A1A19; font-weight: 700; margin-top: 30px;">
        Understand your biology.<br>
        Make smarter choices.<br>
        Build a better tomorrow.
      </p>
      
      <p style="margin-top: 40px; color: #1A1A19;">Warm Regards,<br><strong>Team MyBodyQode</strong></p>
    </div>
    <div class="footer">
      <div class="tagline">Because your biology is one of a kind.</div>
      <p>Educational and non-diagnostic wellness insights only.</p>
      <p>&copy; 2026 MyBodyQode. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Dispatched email sent to ${user.email}`);
  } catch (error) {
    console.error('Error sending dispatched email:', error);
  }
};

const sendForgotCredentialsEmail = async (user) => {
  if (!process.env.EMAIL_PASS) {
    console.warn('EMAIL_PASS not configured. Skipping recovery email to', user.email);
    return;
  }

  const firstName = user.full_name ? user.full_name.split(' ')[0] : 'User';

  const mailOptions = {
    from: `"MyBodyQode Team" <${process.env.EMAIL_USER || 'earlyaccess.mbq@gmail.com'}>`,
    to: user.email,
    subject: "Your MyBodyQode Login Credentials 🔑",
    html: `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  :root {
    color-scheme: light dark;
    supported-color-schemes: light dark;
  }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    background-color: #F4F4F2;
    color: #1A1A19;
    margin: 0;
    padding: 0;
  }
  .dark-img {
    display: none !important;
  }
  @media (prefers-color-scheme: dark) {
    .light-img {
      display: none !important;
    }
    .dark-img {
      display: block !important;
      margin: 0 auto !important;
      filter: brightness(0) invert(1);
    }
    .header-text {
      color: #FFFFFF !important;
    }
  }
  .container {
    max-width: 600px;
    margin: 40px auto;
    background-color: #FFFFFF;
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
  }
  .header {
    background: #FFFFFF;
    padding: 30px;
    text-align: center;
    border-bottom: 1px solid #F0F0ED;
  }
  .header img {
    height: 48px;
    width: auto;
    display: block;
    margin: 0 auto;
  }
  .content {
    padding: 40px 30px;
    line-height: 1.6;
    font-size: 16px;
    color: #5A5A55;
  }
  .greeting {
    font-size: 22px;
    font-weight: 700;
    color: #1A1A19;
    margin-bottom: 24px;
    text-transform: capitalize;
  }
  .highlight-banner {
    background: linear-gradient(135deg, #6057D7 0%, #3FC2AC 100%);
    border-radius: 12px;
    padding: 24px;
    color: #FFFFFF;
    margin: 30px 0;
    box-shadow: 0 4px 12px rgba(96, 87, 215, 0.15);
  }
  .highlight-banner h3 {
    margin: 0 0 16px 0;
    font-size: 16px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    opacity: 0.9;
  }
  .info-grid {
    display: table;
    width: 100%;
    border-collapse: collapse;
  }
  .info-cell {
    display: table-cell;
    width: 100%;
    vertical-align: top;
  }
  .info-label {
    font-size: 11px;
    text-transform: uppercase;
    font-weight: 700;
    color: rgba(255,255,255,0.7);
    letter-spacing: 1px;
    margin-bottom: 6px;
  }
  .info-value {
    font-size: 18px;
    font-weight: 700;
    color: #FFFFFF;
  }
  .button-container {
    text-align: center;
    margin: 40px 0;
  }
  .button {
    background-color: #1A1A19;
    color: #FFFFFF !important;
    text-decoration: none;
    padding: 16px 32px;
    border-radius: 12px;
    font-weight: 700;
    font-size: 16px;
    display: inline-block;
    transition: all 0.2s ease;
  }
  .footer {
    background-color: #F9F9F8;
    border-top: 1px solid #E8E8E5;
    padding: 30px;
    text-align: center;
    font-size: 12px;
    color: #A0A09D;
  }
  .tagline {
    font-weight: 700;
    color: #6057D7;
    margin-bottom: 10px;
    font-size: 14px;
  }
</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <!-- Light Mode Logo -->
      <img src="https://mybodyqode.vercel.app/assets/logo-CgtdQmKz.png" alt="MyBodyQode Logo" class="light-img">
      <!-- Dark Mode Logo -->
      <img src="https://mybodyqode.vercel.app/assets/logo-CgtdQmKz.png" alt="MyBodyQode Logo Dark" class="dark-img">
      <h1 class="header-text" style="color: #1A1A19; font-size: 20px; margin-top: 10px; font-weight: 800; letter-spacing: -0.5px;">MyBodyQode</h1>
    </div>
    <div class="content">
      <div class="greeting">Hi ${firstName},</div>
      
      <p>We received a request to recover the credentials for your <strong>MyBodyQode Early Access Program</strong> account.</p>
      
      <div class="highlight-banner">
        <h3>Your Account Credentials</h3>
        <div class="info-grid">
          <div class="info-cell" style="margin-bottom: 20px; display: block;">
            <div class="info-label">Username</div>
            <div class="info-value" style="font-size: 24px;">${user.username}</div>
          </div>
          <div class="info-cell" style="margin-bottom: 20px; display: block;">
            <div class="info-label">Email Address</div>
            <div class="info-value" style="font-size: 16px; font-weight: 500;">${user.email}</div>
          </div>
          <div class="info-cell" style="display: block;">
            <div class="info-label">Phone Number</div>
            <div class="info-value" style="font-size: 16px; font-weight: 500;">${user.phone || 'N/A'}</div>
          </div>
        </div>
      </div>
      
      <p>If you didn't request this, you can safely ignore this email.</p>
      
      <div class="button-container">
        <a href="https://mbq-tutorial.vercel.app/login" class="button">Log In to My Account</a>
      </div>
      
      <p style="margin-top: 40px; color: #1A1A19;">Warm Regards,<br><strong>Team MyBodyQode</strong></p>
    </div>
    <div class="footer">
      <div class="tagline">Because your biology is one of a kind.</div>
      <p>Educational and non-diagnostic wellness insights only.</p>
      <p>&copy; 2026 MyBodyQode. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Recovery email sent to ${user.email}`);
  } catch (error) {
    console.error('Error sending recovery email:', error);
  }
};

module.exports = {
  sendSampleDispatchedEmail,
  sendForgotCredentialsEmail
};
