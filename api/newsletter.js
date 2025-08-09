// api/newsletter.js
import dotenv from "dotenv";
dotenv.config();

import fetch from "node-fetch";
import { createTransport } from "nodemailer";
import { createClient } from "redis";

const X_BEARER_TOKEN = process.env.X_BEARER_TOKEN;
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
const EMAIL_FROM = process.env.EMAIL_FROM;

export default async (req, res) => {
  if (!X_BEARER_TOKEN || !EMAIL_USER || !EMAIL_PASS || !EMAIL_FROM) {
    return res
      .status(500)
      .send("Configuration error: Missing server-side environment variables.");
  }

  const client = createClient({ url: process.env.REDIS_URL });
  try {
    await client.connect();

    const subscribers = await client.keys("*");
    if (subscribers.length === 0) {
      return res.status(200).send("No subscribers found. Exiting.");
    }

    for (const recipient_email of subscribers) {
      const user_ids_string = await client.get(recipient_email);
      const user_ids = JSON.parse(user_ids_string);
      let allTweets = [];
      let usersMap = {};

      for (const user_id of user_ids) {
        // Updated API call to get full text and user details
        const tweetResponse = await fetch(
          `https://api.twitter.com/2/users/${user_id}/tweets?max_results=5&tweet.fields=created_at,text&expansions=author_id&user.fields=username,name`,
          {
            headers: { Authorization: `Bearer ${X_BEARER_TOKEN}` },
          }
        );

        if (tweetResponse.ok) {
          const tweetData = await tweetResponse.json();
          if (tweetData.data) {
            // Store user details for easy lookup
            if (tweetData.includes && tweetData.includes.users) {
              tweetData.includes.users.forEach((user) => {
                usersMap[user.id] = user;
              });
            }
            // Add tweets from this user to the main list
            allTweets = allTweets.concat(tweetData.data);
          }
        } else {
          console.error(`Failed to fetch tweets for user ID ${user_id}`);
        }
      }

      allTweets.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      let newsletterHtml = `
        <!DOCTYPE html>
        <html>
        <body>
            <div style="font-family: sans-serif;">
      `;

      if (allTweets.length === 0) {
        newsletterHtml += `<p>No new tweets from your subscribed accounts.</p>`;
      } else {
        allTweets.forEach((tweet) => {
          const tweetUrl = `https://twitter.com/i/web/status/${tweet.id}`;
          const author = usersMap[tweet.author_id]; // Get the author's details from the map

          newsletterHtml += `
            <div style="border: 1px solid #e1e8ed; padding: 16px; margin-bottom: 16px; border-radius: 8px;">
              <p><strong>${author.name}</strong> (@${author.username})</p>
              <p>${tweet.text}</p>
              <a href="${tweetUrl}">Read on X.com</a>
              <p style="font-size: 0.8em; color: #666; margin-top: 10px;">User ID: ${tweet.author_id}</p>
            </div>
          `;
        });
      }

      newsletterHtml += `
            </div>
        </body>
        </html>
      `;

      let transporter = createTransport({
        host: "smtp.sendgrid.net",
        port: 587,
        secure: false,
        auth: { user: EMAIL_USER, pass: EMAIL_PASS },
      });

      const mailOptions = {
        from: `"Your Tweet Newsletter" <${EMAIL_FROM}>`,
        to: recipient_email,
        subject: `Your Weekly Tweet Newsletter - ${new Date().toLocaleDateString()}`,
        html: newsletterHtml,
      };

      await transporter.sendMail(mailOptions);
      console.log(`Newsletter sent successfully to ${recipient_email}!`);
    }

    res.status(200).send("All newsletters sent successfully!");
  } catch (error) {
    console.error("Error in newsletter generation or sending:", error);
    res.status(500).send(`Error processing request: ${error.message}`);
  } finally {
    await client.disconnect();
  }
};
