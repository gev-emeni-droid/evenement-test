export async function onRequest(context) {
  if (context.request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const { email, subject, message, calendarUrl, logo } = await context.request.json();

    if (!email || !subject || !message) {
      return new Response(
        JSON.stringify({ error: 'Missing email, subject, or message' }),
        { status: 400 }
      );
    }

    const RESEND_API_KEY = context.env.RESEND_API_KEY;
    const SENDER_EMAIL = 'notifications@l-iamani.com';

    // Récupérer l'adresse mail du client depuis la DB si elle existe
    const settingsRes = await context.env.DB.prepare('SELECT sender_email, custom_logo FROM hotesse_settings WHERE id = ?').bind('global').first();
    const senderEmail = settingsRes?.sender_email || SENDER_EMAIL;
    const dbLogo = settingsRes?.custom_logo;

    // Utiliser le logo passé en paramètre, ou celui de la DB
    const finalLogo = logo || dbLogo;

    // Construire le HTML du mail avec logo en bas au centre
    let htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .greeting { margin-bottom: 20px; }
            .message { margin: 20px 0; }
            .link-section { margin: 30px 0; text-align: center; }
            .cta-button { display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; }
            .footer { margin-top: 40px; text-align: center; padding-top: 20px; border-top: 1px solid #ddd; }
            .logo-container { text-align: center; margin-top: 30px; }
            .logo-container img { max-width: 150px; height: auto; }
          </style>
        </head>
        <body>
          <div class="container">
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
              ${finalLogo ? `<div class="logo-container"><img src="${finalLogo}" alt="Logo"></div>` : ''}
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
