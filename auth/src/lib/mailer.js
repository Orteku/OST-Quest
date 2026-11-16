// Envío de correos vía Resend
const RESET_TEXTS = {
  es: {
    subject: 'Restablecer contraseña — Oesti Quest',
    title:   'Restablecer contraseña',
    body:    'Haz clic en el botón para crear una nueva contraseña. El enlace caduca en 1 hora.',
    button:  'Restablecer contraseña',
    ignore:  'Si no lo has pedido tú, ignora este correo: tu contraseña no cambiará.',
  },
  en: {
    subject: 'Reset your password — Oesti Quest',
    title:   'Reset your password',
    body:    'Click the button to create a new password. The link expires in 1 hour.',
    button:  'Reset password',
    ignore:  "If you didn't request this, ignore this email: your password won't change.",
  },
};

export async function sendPasswordResetEmail(env, to, resetLink, lang = 'es') {
  const tx = RESET_TEXTS[lang] ?? RESET_TEXTS.es;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      from:    'Oesti Quest <noreply@oestiquest.com>',
      to:      [to],
      subject: tx.subject,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:auto">
          <h2>${tx.title}</h2>
          <p>${tx.body}</p>
          <p><a href="${resetLink}" style="display:inline-block;padding:10px 20px;background:#b8e030;color:#111;border-radius:6px;text-decoration:none;font-weight:700">${tx.button}</a></p>
          <p style="color:#888;font-size:13px">${tx.ignore}</p>
        </div>
      `,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error('Email send failed: ' + JSON.stringify(err));
  }
}
