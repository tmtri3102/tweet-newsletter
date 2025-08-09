// api/subscribe.js
import { createClient } from "redis";
import { createTransport } from "nodemailer";

const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
const EMAIL_FROM = process.env.EMAIL_FROM;
const REDIS_URL = process.env.REDIS_URL;

export default async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  let { user_ids, recipient_email } = req.body;

  // Added validation for user-friendliness
  if (typeof user_ids === "string") {
    user_ids = user_ids.split(",").map((id) => id.trim());
  }

  if (
    !user_ids ||
    !recipient_email ||
    !Array.isArray(user_ids) ||
    user_ids.length === 0
  ) {
    return res
      .status(400)
      .send("Missing required parameters or invalid format.");
  }

  const client = createClient({ url: REDIS_URL });
  try {
    await client.connect();
    await client.set(recipient_email, JSON.stringify(user_ids));
    console.log(
      `Subscription saved for ${recipient_email} with IDs: ${user_ids}`
    );

    const transporter = createTransport({
      host: "smtp.sendgrid.net",
      port: 587,
      secure: false,
      auth: { user: EMAIL_USER, pass: EMAIL_PASS },
    });

    const mailOptions = {
      from: `"Your Tweet Newsletter" <${EMAIL_FROM}>`,
      to: recipient_email,
      subject: `Subscription Confirmed!`,
      html: `
        <div style="font-family: sans-serif;">
          <h1>Thanks for subscribing!</h1>
          <p>You have successfully subscribed to the newsletter for the following IDs: ${user_ids.join(
            ", "
          )}.</p>
          <p>You will receive your first newsletter in the next scheduled run.</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`Confirmation email sent to ${recipient_email}!`);

    res.status(200).send("Subscription successful!");
  } catch (error) {
    console.error("Error in subscription process:", error);
    res.status(500).send(`Failed to subscribe: ${error.message}`);
  } finally {
    if (client.isOpen) {
      await client.disconnect();
    }
  }
};
