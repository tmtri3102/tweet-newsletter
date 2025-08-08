// api/newsletter.js

// Using ES module syntax with dotenv for local development
import dotenv from "dotenv";
dotenv.config();

// Import necessary libraries
import fetch from "node-fetch";
import { createTransport } from "nodemailer";

// --- Configuration from Environment Variables ---
const X_BEARER_TOKEN = process.env.X_BEARER_TOKEN;
const X_USER_ID = process.env.X_USER_ID;

const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
const EMAIL_TO = process.env.EMAIL_TO; // Recipient email address
const EMAIL_FROM = process.env.EMAIL_FROM; // Verified SendGrid sender

// --- Main Serverless Function Entry Point ---
export default async (req, res) => {
  // Basic validation for environment variables
  if (
    !X_BEARER_TOKEN ||
    !X_USER_ID ||
    !EMAIL_USER ||
    !EMAIL_PASS ||
    !EMAIL_TO ||
    !EMAIL_FROM
  ) {
    console.error(
      "Missing environment variables. Please check your .env file or Vercel settings."
    );
    return res
      .status(500)
      .send("Configuration error: Missing environment variables.");
  }

  try {
    // 1. Fetch Latest 5 Tweets from X.com
    const tweetResponse = await fetch(
      `https://api.twitter.com/2/users/${X_USER_ID}/tweets?max_results=5&tweet.fields=created_at`,
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
    const tweets = tweetData.data || []; // Ensure 'data' array exists

    // 2. Generate HTML Newsletter Content
    let newsletterHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Your Weekly Tweet Newsletter</title>
                <style>
                    body { font-family: sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 20px auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px; }
                    h1 { color: #007bff; }
                    ol { padding-left: 20px; }
                    li { margin-bottom: 10px; }
                    a { color: #007bff; text-decoration: none; }
                    a:hover { text-decoration: underline; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>Your Weekly Tweet Digest! 🐦</h1>
                    <p>Here are your latest 5 tweets from X.com:</p>
                    <ol>
        `;

    if (tweets.length === 0) {
      newsletterHtml += `<li>No tweets found for this period.</li>`;
    } else {
      tweets.forEach((tweet, index) => {
        // Construct the direct tweet URL
        const tweetUrl = `https://twitter.com/i/web/status/${tweet.id}`;
        newsletterHtml += `<li>${
          index + 1
        }. <a href="${tweetUrl}">${tweet.text.substring(
          0,
          100
        )}... (click for full tweet)</a></li>`;
      });
    }

    newsletterHtml += `
                    </ol>
                    <p>Enjoy your digest!</p>
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
      to: EMAIL_TO,
      subject: `Your Weekly Tweet Newsletter - ${new Date().toLocaleDateString()}`,
      html: newsletterHtml,
    };

    await transporter.sendMail(mailOptions);
    console.log(`Newsletter sent successfully to ${EMAIL_TO}!`);

    // Respond to the HTTP request
    res.status(200).send("Newsletter sent successfully!");
  } catch (error) {
    console.error("Error in newsletter generation or sending:", error);
    res.status(500).send(`Error processing request: ${error.message}`);
  }
};
