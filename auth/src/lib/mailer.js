// Envío de correos vía Resend
export async function sendPasswordResetEmail(env, to, resetLink) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      from:    'Oesti Quest <noreply@oestiquest.com>',
      to:      [to],
      subject: 'Restablecer contraseña — Oesti Quest',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:auto">
          <h2>Restablecer contraseña</h2>
          <p>Haz clic en el enlace para crear una nueva contraseña. El enlace expira en 1 hora.</p>
          <p><a href="${resetLink}" style="display:inline-block;padding:10px 20px;background:#b8e030;color:#111;border-radius:6px;text-decoration:none;font-weight:700">Restablecer contraseña</a></p>
          <p style="color:#888;font-size:13px">Si no has solicitado esto, ignora este correo.</p>
        </div>
      `,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error('Email send failed: ' + JSON.stringify(err));
  }
}
