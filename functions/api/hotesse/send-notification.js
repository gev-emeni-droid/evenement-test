export async function onRequest(context) {
  if (context.request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const { email, subject, message, calendarUrl, themeColor } = await context.request.json();

    if (!email || !subject || !message) {
      return new Response(
        JSON.stringify({ error: 'Missing email, subject, or message' }),
        { status: 400 }
      );
    }

    const RESEND_API_KEY = context.env.RESEND_API_KEY;
    const SENDER_EMAIL = 'notifications@l-iamani.com';
    
    // Récupérer l'adresse mail du client depuis la DB
    const settingsRes = await context.env.DB.prepare('SELECT sender_email FROM hotesse_settings WHERE id = ?').bind('global').first();
    const senderEmail = settingsRes?.sender_email || SENDER_EMAIL;
    
    // URL du logo hébergé dans public/
    const logoUrl = `${new URL(context.request.url).origin}/logo.jpg`;

    // Construire le HTML du mail avec logo en bas au centre
    let htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; background-color: #fafafa; }
            .content { background-color: white; padding: 30px; border-radius: 8px; }
            .greeting { margin-bottom: 20px; font-size: 16px; }
            .message { margin: 20px 0; font-size: 16px; }
            .link-section { margin: 30px 0; text-align: center; }
            .cta-button { display: inline-block; padding: 12px 24px; background-color: ${themeColor || '#007bff'}; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; }
            .footer { margin-top: 40px; text-align: center; padding-top: 20px; border-top: 1px solid #eee; }
            .logo-container { text-align: center; margin-top: 30px; }
            .logo-container img { max-width: 100px; width: 100%; height: auto; display: block; margin: 0 auto; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="content">
              <div class="greeting">
                <p>Bonjour,</p>
              </div>
              <div class="message">
                <p>${message}</p>
              </div>
              <div class="link-section">
                <a href="${calendarUrl || '#'}" class="cta-button">Consulter le calendrier</a>
              </div>
              <div class="footer">
                <div class="logo-container"><img src="${logoUrl}" alt="Logo" style="max-width: 100px; height: auto; display: block; margin: 0 auto;"></div>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    // Appel API Resend pour envoyer l'email
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: senderEmail,
        to: email,
        subject: subject,
        html: htmlContent,
      }),
    });

    if (!emailResponse.ok) {
      const error = await emailResponse.json();
      return new Response(
        JSON.stringify({ error: error.message || 'Failed to send email' }),
        { status: 500 }
      );
    }

    const result = await emailResponse.json();
    return new Response(JSON.stringify({ success: true, emailId: result.id }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500 }
    );
  }
}
