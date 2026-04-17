import express from 'express';
import cors from 'cors';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 465),
  secure: String(process.env.SMTP_SECURE).toLowerCase() === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function looksLikeEmail(value = '') {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'book-session-server' });
});

app.post('/api/book-session', async (req, res) => {
  try {
    const {
      psychologistName,
      psychologistEmail,
      clientName,
      clientContact,
      format,
      preferredTime,
      requestText,
    } = req.body || {};

    if (!clientName || !clientContact || !format) {
      return res.status(400).json({
        ok: false,
        error: 'Не заполнены обязательные поля.',
      });
    }

    const safePsychologistName = escapeHtml(psychologistName || 'Попова Наталья Николаевна');
    const safePsychologistEmail = escapeHtml(psychologistEmail || process.env.OWNER_EMAIL || '');
    const safeClientName = escapeHtml(clientName);
    const safeClientContact = escapeHtml(clientContact);
    const safeFormat = escapeHtml(format);
    const safePreferredTime = escapeHtml(preferredTime || 'Не указано');
    const safeRequestText = escapeHtml(requestText || 'Не указано');

    const ownerRecipient = psychologistEmail || process.env.OWNER_EMAIL;

    const ownerMail = {
      from: `Сайт психолога <${process.env.SMTP_USER}>`,
      to: ownerRecipient,
      subject: `Новая заявка на консультацию: ${clientName}`,
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#222;max-width:680px;margin:0 auto;">
          <h2 style="margin-bottom:16px;">Новая заявка с сайта</h2>
          <p><strong>Специалист:</strong> ${safePsychologistName}</p>
          <p><strong>Имя клиента:</strong> ${safeClientName}</p>
          <p><strong>Контакт клиента:</strong> ${safeClientContact}</p>
          <p><strong>Формат:</strong> ${safeFormat}</p>
          <p><strong>Удобное время:</strong> ${safePreferredTime}</p>
          <p><strong>Запрос:</strong><br>${safeRequestText.replace(/\n/g, '<br>')}</p>
          <hr style="margin:24px 0;border:none;border-top:1px solid #ddd;">
          <p style="font-size:14px;color:#666;">Заявка отправлена с сайта: ${escapeHtml(process.env.SITE_URL || 'http://localhost:3000')}</p>
        </div>
      `,
    };

    await transporter.sendMail(ownerMail);

    if (looksLikeEmail(clientContact)) {
      const clientMail = {
        from: `Попова Наталья Николаевна <${process.env.SMTP_USER}>`,
        to: clientContact.trim(),
        subject: 'Ваша заявка принята',
        html: `
          <div style="font-family:Arial,sans-serif;line-height:1.6;color:#222;max-width:680px;margin:0 auto;">
            <h2 style="margin-bottom:16px;">Спасибо за заявку</h2>
            <p>Здравствуйте, ${safeClientName}.</p>
            <p>Ваша заявка на консультацию успешно отправлена специалисту <strong>${safePsychologistName}</strong>.</p>
            <p><strong>Ваш контакт:</strong> ${safeClientContact}</p>
            <p><strong>Формат:</strong> ${safeFormat}</p>
            <p><strong>Удобное время:</strong> ${safePreferredTime}</p>
            <p>Специалист свяжется с вами после обработки заявки.</p>
            <hr style="margin:24px 0;border:none;border-top:1px solid #ddd;">
            <p style="font-size:14px;color:#666;">Контакт для связи: ${safePsychologistEmail}</p>
          </div>
        `,
      };

      await transporter.sendMail(clientMail);
    }

    return res.json({
      ok: true,
      message: 'Заявка отправлена.',
    });
  } catch (error) {
    console.error('book-session error:', error);
    return res.status(500).json({
      ok: false,
      error: 'Не удалось отправить заявку.',
    });
  }
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server started on http://localhost:${PORT}`);
});