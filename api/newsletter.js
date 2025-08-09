// api/newsletter.js

// Using ES module syntax with dotenv for local development
import dotenv from "dotenv";
dotenv.config();

// Import necessary libraries
import fetch from "node-fetch";
import { createTransport } from "nodemailer";

// --- Configuration from Environment Variables (static for all users) ---
const X_BEARER_TOKEN = process.env.X_BEARER_TOKEN;
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
const EMAIL_FROM = process.env.EMAIL_FROM; // Verified SendGrid sender

// --- Main Serverless Function Entry Point ---
export default async (req, res) => {
  // Get user-specific data from URL query parameters
  const { user_id, recipient_email } = req.query;

  // Basic validation for required parameters
  if (!X_BEARER_TOKEN || !EMAIL_USER || !EMAIL_PASS || !EMAIL_FROM) {
    console.error(
      "Missing server-side environment variables. Please check Vercel settings."
    );
    return res
      .status(500)
      .send("Configuration error: Missing server-side environment variables.");
  }

  if (!user_id || !recipient_email) {
    return res
      .status(400)
      .send(
        "Missing required URL parameters: 'user_id' and 'recipient_email'."
      );
  }

  try {
    // 1. Fetch Latest 30 Tweets from X.com using the provided user_id
    const tweetResponse = await fetch(
      `https://api.twitter.com/2/users/${user_id}/tweets?max_results=30&tweet.fields=created_at`,
      {
        headers: {
          Authorization: `Bearer ${X_BEARER_TOKEN}`,
        },
      }
    );

    if (!tweetResponse.ok) {
      const errorText = await tweetResponse.text();
      console.error(`X.com API error: ${tweetResponse.status} - ${errorText}`);
      return res
        .status(tweetResponse.status)
        .send(`Failed to fetch tweets from X.com API: ${errorText}`);
    }

    const tweetData = await tweetResponse.json();
    const tweets = tweetData.data || [];

    // 2. Generate HTML Newsletter Content
    let newsletterHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Your Weekly Tweet Newsletter</title>
                <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333;}
                    .container { max-width: 600px; margin: 20px auto; padding: 20px; }
                </style>
            </head>
            <body>
                <div class="container">
        `;

    if (tweets.length === 0) {
      newsletterHtml += `<p>No tweets found for this period.</p>`;
    } else {
      tweets.forEach((tweet) => {
        const tweetUrl = `https://twitter.com/i/web/status/${tweet.id}`;
        newsletterHtml += `
          <div style="margin-bottom: 24px; padding-bottom: 12px; border-bottom: 1px solid #e1e8ed;">
              <p style="font-size: 16px; line-height: 24px; margin-bottom: 8px;">${tweet.text}</p>
              <a href="${tweetUrl}" style="color: #1da1f2; text-decoration: none; font-size: 14px;">Read on X.com</a>
          </div>
        `;
      });
    }

    newsletterHtml += `
                </div>
            </body>
            </html>
        `;

    // 3. Send Email using Nodemailer (SendGrid SMTP)
    let transporter = createTransport({
      host: "smtp.sendgrid.net",
      port: 587,
      secure: false, // Use TLS
      auth: {
        user: EMAIL_USER, // 'apikey'
        pass: EMAIL_PASS, // Your SendGrid API Key
      },
    });

    const mailOptions = {
      from: `"Your Tweet Newsletter" <${EMAIL_FROM}>`,
      to: recipient_email, // Now uses the user-provided email
      subject: `Your Weekly Tweet Newsletter - ${new Date().toLocaleDateString()}`,
      html: newsletterHtml,
    };

    await transporter.sendMail(mailOptions);
    console.log(`Newsletter sent successfully to ${recipient_email}!`);

    // Respond to the HTTP request
    res.status(200).send("Newsletter sent successfully!");
  } catch (error) {
    console.error("Error in newsletter generation or sending:", error);
    res.status(500).send(`Error processing request: ${error.message}`);
  }
};
