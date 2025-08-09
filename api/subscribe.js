import { createClient } from "redis";

export default async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  const { user_ids, recipient_email } = req.body;

  if (
    !user_ids ||
    !recipient_email ||
    !Array.isArray(user_ids) ||
    user_ids.length === 0
  ) {
    return res.status(400).send("Missing required parameters.");
  }

  const client = createClient({ url: process.env.REDIS_URL });
  await client.connect();

  try {
    await client.set(recipient_email, JSON.stringify(user_ids)); // Redis stores strings, so you need to stringify
    console.log(
      `Subscription saved for ${recipient_email} with IDs: ${user_ids}`
    );
    res.status(200).send("Subscription successful!");
  } catch (error) {
    console.error("Error saving subscription:", error);
    res.status(500).send("Failed to subscribe.");
  } finally {
    await client.disconnect();
  }
};
