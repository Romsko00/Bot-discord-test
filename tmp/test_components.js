const { MessagePayload } = require('discord.js');

try {
  const payload = MessagePayload.create(
    { isWebhook: false }, 
    {
      flags: 32768,
      components: [
        {
          type: 17,
          accent_color: 3447003,
          components: [
            { type: 10, content: "Test" }
          ]
        }
      ]
    }
  );
  console.log("Payload created successfully:", JSON.stringify(payload.resolveData().components));
} catch (err) {
  console.error("Error creating payload:", err);
}
