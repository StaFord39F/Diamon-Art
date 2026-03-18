import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import nodemailer from "nodemailer";

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${new Date().toISOString()} ${req.method} ${req.url} ${res.statusCode} - ${duration}ms`);
  });
  next();
});

// Storage for orders and settings (in-memory for this demo)
let settings = {
  basePrice: 250,
  stepPrice: 450,
  premiumPrice: 250,
  vipPassword: "200712",
  aboutUs: "Ми — Світ краси, ваш надійний партнер у світі алмазного живопису. Ми створюємо шедеври з ваших фотографій, щоб кожен міг відчути себе художником. Наша місія — дарувати радість та творчість у кожен дім.",
  adminPassword: "200712Vv",
  bankAccount: "LT89 3250 0171 9422 7391",
  contactEmail: "u7204118005@gmail.com",
  smtpHost: "",
  smtpPort: 587,
  smtpUser: "",
  smtpPass: ""
};

let orders: any[] = [];

// Multer setup for file uploads
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}
const upload = multer({ dest: "uploads/" });

// API Routes
app.get(["/api/settings", "/api/settings/"], (req, res) => {
  const { adminPassword, vipPassword, ...publicSettings } = settings;
  res.json({
    ...publicSettings,
    paymentMethod: "Revolut",
    orderCount: orders.length,
    hasVip: !!vipPassword
  });
});

app.post("/api/admin/login", (req, res) => {
  const { password } = req.body;
  if (password === settings.adminPassword) {
    res.json({ success: true, token: "mock-admin-token" });
  } else {
    res.status(401).json({ success: false, message: "Невірний пароль" });
  }
});

app.post("/api/admin/settings", (req, res) => {
  const { token, ...newSettings } = req.body;
  if (token === "mock-admin-token") {
    settings = { ...settings, ...newSettings };
    res.json({ success: true });
  } else {
    res.status(403).json({ success: false });
  }
});

app.get("/api/admin/settings", (req, res) => {
  const { token } = req.query;
  if (token === "mock-admin-token") {
    res.json(settings);
  } else {
    res.status(403).json({ success: false });
  }
});

app.get("/api/admin/orders", (req, res) => {
  const { token } = req.query;
  if (token === "mock-admin-token") {
    res.json(orders);
  } else {
    res.status(403).json({ success: false });
  }
});

app.post("/api/orders", upload.fields([{ name: 'photo', maxCount: 1 }, { name: 'receipt', maxCount: 1 }]), async (req: any, res) => {
  const { size, price, currency, paymentStatus, isPremium, vipPassword, customerName, customerPhone, customerAddress, deliveryMethod, deliveryZone, deliveryCost } = req.body;
  const files = req.files as { [fieldname: string]: Express.Multer.File[] };
  
  const photo = files['photo'] ? files['photo'][0] : null;
  const receipt = files['receipt'] ? files['receipt'][0] : null;

  const isVip = vipPassword === settings.vipPassword;
  const isVipPassPurchase = req.body.isVipPassPurchase === 'true';

  if (!isVip && !isVipPassPurchase && (paymentStatus !== "PAID" || !receipt)) {
    return res.status(400).json({ success: false, message: "Оплата не підтверджена або відсутній чек" });
  }

  const newOrder = {
    id: Date.now(),
    size: isVipPassPurchase ? 'VIP PASS' : size,
    price: isVip ? 0 : Number(price),
    currency,
    isPremium: isPremium === 'true',
    isVip,
    isVipPassPurchase,
    customerName,
    customerPhone,
    customerAddress,
    deliveryMethod: deliveryMethod || 'Nova Poshta',
    deliveryZone: deliveryZone || 'local',
    deliveryCost: Number(deliveryCost) || 0,
    photoName: photo?.originalname || (isVipPassPurchase ? 'N/A' : 'unknown'),
    photoPath: photo?.path,
    receiptName: receipt?.originalname,
    receiptPath: receipt?.path,
    timestamp: new Date().toISOString()
  };

  orders.push(newOrder);

  // Send Email Notification
  if (settings.smtpHost && settings.smtpUser && settings.smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        host: settings.smtpHost,
        port: settings.smtpPort,
        secure: settings.smtpPort === 465,
        auth: {
          user: settings.smtpUser,
          pass: settings.smtpPass,
        },
      });

      const mailOptions = {
        from: `"Світ краси" <${settings.smtpUser}>`,
        to: settings.contactEmail,
        subject: `✨ ${isVipPassPurchase ? '💎 КУПІВЛЯ VIP ПРОПУСКУ' : 'НОВЕ ЗАМОВЛЕННЯ'} #${newOrder.id} ${isVip ? '💎 VIP' : ''}`,
        html: `
          <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px; max-width: 600px; margin: 0 auto;">
            <h2 style="color: ${isVipPassPurchase ? '#7c3aed' : '#059669'}; border-bottom: 2px solid ${isVipPassPurchase ? '#7c3aed' : '#059669'}; padding-bottom: 10px;">
              ${isVipPassPurchase ? 'Нова покупка VIP пропуску!' : 'Нове замовлення на сайті!'}
            </h2>
            <p style="font-size: 16px;"><strong>ID:</strong> #${newOrder.id}</p>
            
            <div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #374151;">📦 Деталі:</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 5px 0; color: #6b7280;">${isVipPassPurchase ? 'Товар' : 'Розмір'}:</td>
                  <td style="padding: 5px 0; font-weight: bold;">${newOrder.size}</td>
                </tr>
                <tr>
                  <td style="padding: 5px 0; color: #6b7280;">Ціна:</td>
                  <td style="padding: 5px 0; font-weight: bold;">${newOrder.price} ${newOrder.currency}</td>
                </tr>
                ${!isVipPassPurchase ? `
                <tr>
                  <td style="padding: 5px 0; color: #6b7280;">Доставка:</td>
                  <td style="padding: 5px 0; font-weight: bold;">${newOrder.deliveryCost} ${newOrder.currency} (${newOrder.deliveryZone})</td>
                </tr>
                ` : ''}
                ${!isVipPassPurchase ? `
                <tr>
                  <td style="padding: 5px 0; color: #6b7280;">Тип:</td>
                  <td style="padding: 5px 0; font-weight: bold;">${isVip ? '<span style="color: #7c3aed;">VIP (Безкоштовно)</span>' : 'Стандарт'}</td>
                </tr>
                <tr>
                  <td style="padding: 5px 0; color: #6b7280;">Преміум:</td>
                  <td style="padding: 5px 0; font-weight: bold;">${newOrder.isPremium ? 'Так ✅' : 'Ні'}</td>
                </tr>
                ` : ''}
              </table>
            </div>

            <div style="background: #f0fdf4; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #166534;">👤 Дані клієнта:</h3>
              <p style="margin: 5px 0;"><strong>ПІБ:</strong> ${newOrder.customerName}</p>
              <p style="margin: 5px 0;"><strong>Телефон:</strong> ${newOrder.customerPhone}</p>
              <p style="margin: 5px 0;"><strong>Доставка:</strong> ${newOrder.deliveryMethod}</p>
              <p style="margin: 5px 0;"><strong>Адреса:</strong> ${newOrder.customerAddress}</p>
              <p style="margin: 10px 0;">
                <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(newOrder.customerAddress)}" 
                   style="display: inline-block; padding: 8px 16px; background: #4285f4; color: white; text-decoration: none; border-radius: 6px; font-size: 12px; font-weight: bold;">
                   📍 Відкрити на Google Maps
                </a>
              </p>
            </div>

            <p style="font-size: 12px; color: #9ca3af; text-align: center; margin-top: 30px;">
              Це автоматичне повідомлення від системи "Світ краси".<br>
              Будь ласка, зв'яжіться з клієнтом для підтвердження.
            </p>
          </div>
        `,
      };

      await transporter.sendMail(mailOptions);
    } catch (error) {
      console.error("Помилка відправки email:", error);
    }
  } else {
    // Fallback to console log if SMTP not configured
    console.log(`[ORDER] New order created: #${newOrder.id}`);
    console.log(`[ORDER] Customer: ${customerName}, Phone: ${customerPhone}`);
  }

  res.json({ success: true, orderId: newOrder.id });
});

// Catch-all for API routes to prevent returning HTML
app.all("/api/*", (req, res) => {
  res.status(404).json({ success: false, message: `API route ${req.method} ${req.url} not found` });
});

// Vite middleware for development
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
