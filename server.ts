import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import admin from "firebase-admin";
import fs from "fs";
import { Resend } from 'resend';

import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

const firebaseConfig = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf-8"));

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: firebaseConfig.projectId
    });
  } catch (error) {
    console.warn("Firebase Admin could not be initialized with applicationDefault. Push notifications may not work until a service account is provided.");
    // Fallback for local dev if needed, but usually applicationDefault is what we want in Cloud Run
    admin.initializeApp({
      projectId: firebaseConfig.projectId
    });
  }
}

const db = getFirestore(firebaseConfig.firestoreDatabaseId || '(default)');
const messaging = getMessaging();

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Email Ticket Endpoint
  app.post("/api/email/send-ticket", async (req, res) => {
    const { email, userName, eventTitle, eventDate, eventTime, eventLocation, ticketId, qrCode } = req.body;

    if (!email || !eventTitle || !ticketId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (!resend) {
      console.warn("Resend API key missing. Email not sent.");
      return res.json({ success: true, message: "Email not sent (API key missing)" });
    }

    try {
      const { data, error } = await resend.emails.send({
        from: 'Savvy Wine Community <onboarding@resend.dev>',
        to: [email],
        subject: `Registration Confirmed: ${eventTitle}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <h1 style="color: #4A0E0E; text-align: center;">Registration Confirmed!</h1>
            <p>Hello ${userName},</p>
            <p>Your registration for <strong>${eventTitle}</strong> has been confirmed. We're excited to have you join us!</p>
            
            <div style="background-color: #FDFCFB; padding: 20px; border-radius: 10px; margin: 20px 0;">
              <h2 style="margin-top: 0; font-size: 18px;">Event Details</h2>
              <p><strong>Date:</strong> ${eventDate}</p>
              <p><strong>Time:</strong> ${eventTime || 'TBA'}</p>
              <p><strong>Location:</strong> ${eventLocation}</p>
            </div>

            <div style="text-align: center; padding: 20px; border: 2px dashed #4A0E0E; border-radius: 10px;">
              <h2 style="margin-top: 0;">Your Ticket</h2>
              <p style="font-size: 24px; font-weight: bold; color: #4A0E0E; margin: 10px 0;">${ticketId}</p>
              <p style="font-size: 12px; color: #666;">QR Code Data: ${qrCode}</p>
              <p style="font-size: 14px;">Please present this ticket at the entrance.</p>
            </div>

            <p style="margin-top: 30px; font-size: 14px; color: #666; text-align: center;">
              Thank you for being part of the Savvy Wine Community.
            </p>
          </div>
        `,
      });

      if (error) {
        console.error("Error sending email via Resend:", error);
        return res.status(500).json({ error: "Failed to send email" });
      }

      res.json({ success: true, data });
    } catch (error) {
      console.error("Error in email endpoint:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // USSD Push Payment Simulation Endpoint
  app.post("/api/payment/ussd", (req, res) => {
    const { phoneNumber, amount, ticketId, orderId } = req.body;
    const referenceId = ticketId || orderId || 'unknown';

    if (!phoneNumber || !amount || !referenceId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    console.log(`Initiating USSD push for ${phoneNumber} - Amount: ${amount} - Reference: ${referenceId}`);

    // Simulate processing delay
    setTimeout(() => {
      // In a real scenario, you'd call a provider API here (e.g., M-Pesa, Stripe, etc.)
      // and wait for a callback or poll for status.
      // For this demo, we'll return success.
      res.json({ 
        status: "success", 
        message: "USSD push sent successfully. Please check your phone to complete payment.",
        transactionId: "TXN-" + Math.random().toString(36).substring(2, 10).toUpperCase()
      });
    }, 1500);
  });

  // Push Notification Endpoint
  app.post("/api/notifications/send", async (req, res) => {
    const { userId, title, body, data } = req.body;

    if (!userId || !title || !body) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    try {
      const userDoc = await db.collection("users").doc(userId).get();
      if (!userDoc.exists) {
        return res.status(404).json({ error: "User not found" });
      }

      const userData = userDoc.data();
      const tokens = userData?.fcmTokens || [];

      if (tokens.length === 0) {
        return res.json({ success: true, message: "No tokens found for user" });
      }

      const message = {
        notification: { title, body },
        data: data || {},
        tokens: tokens
      };

      const response = await messaging.sendEachForMulticast(message);
      console.log(`Successfully sent ${response.successCount} messages to user ${userId}`);

      // Cleanup invalid tokens
      if (response.failureCount > 0) {
        const failedTokens: string[] = [];
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            const error = resp.error as any;
            if (error?.code === 'messaging/invalid-registration-token' || 
                error?.code === 'messaging/registration-token-not-registered') {
              failedTokens.push(tokens[idx]);
            }
          }
        });
        
        if (failedTokens.length > 0) {
          await db.collection("users").doc(userId).update({
            fcmTokens: FieldValue.arrayRemove(...failedTokens)
          });
          console.log(`Removed ${failedTokens.length} invalid tokens for user ${userId}`);
        }
      }

      res.json({ success: true, count: response.successCount });
    } catch (error) {
      console.error("Error sending push notification:", error);
      res.status(500).json({ error: "Failed to send push notification" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
