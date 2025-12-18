const http = require("http");

http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Bot is running");
}).listen(process.env.PORT || 3000);

// ================== IMPORTS ==================
const { default: makeWASocket, useMultiFileAuthState } = require("@whiskeysockets/baileys");
const axios = require("axios");

// ================== CONFIG ==================
const ADMIN_NUMBER = "447448071922@s.whatsapp.net"; // 👉 अपना नंबर
const GOOGLE_SHEET_URL = ""; // optional (खाली छोड़ सकते हो)

// ================== START BOT ==================
async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("auth");

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true
  });

  sock.ev.on("creds.update", saveCreds);

  const users = {};

  // ================== CONNECTION ==================
  sock.ev.on("connection.update", (update) => {
    const { qr, connection } = update;

    if (qr) {
      console.log("Scan this QR Code:");
      console.log(qr);
    }

    if (connection === "open") {
      console.log("✅ WhatsApp Connected Successfully");
    }

    if (connection === "close") {
      console.log("❌ Connection Closed");
    }
  });

  // ================== MESSAGE HANDLER ==================
  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const from = msg.key.remoteJid;
    const text = msg.message.conversation?.toLowerCase();
    const button = msg.message.buttonsResponseMessage?.selectedButtonId;

    if (!users[from]) users[from] = { step: 0, tools: [] };

    // STEP 0: START
    if (text === "hi") {
      users[from] = { step: 1, tools: [] };

      await sock.sendMessage(from, {
        text: "🎒 Welcome to School Bot\nTools select करें:",
        buttons: [
          { buttonId: "dress", buttonText: { displayText: "👕 Dress" }, type: 1 },
          { buttonId: "books", buttonText: { displayText: "📚 Books" }, type: 1 },
          { buttonId: "shoes", buttonText: { displayText: "👟 Shoes" }, type: 1 }
        ],
        headerType: 1
      });
      return;
    }

    // STEP 1: TOOL SELECT
    if (users[from].step === 1 && button) {
      users[from].tools.push(button);
      users[from].step = 2;

      await sock.sendMessage(from, {
        text: "✅ Added! Aur tool chahiye? (yes / no)"
      });
      return;
    }

    // STEP 2: MORE TOOLS?
    if (users[from].step === 2) {
      if (text === "yes") {
        users[from].step = 1;
        await sock.sendMessage(from, { text: "Ek aur tool select करें" });
      } else {
        users[from].step = 3;
        await sock.sendMessage(from, { text: "🏫 Bacche ki class बताइए" });
      }
      return;
    }

    // STEP 3: CLASS
    if (users[from].step === 3) {
      users[from].class = text;
      users[from].step = 4;
      await sock.sendMessage(from, { text: "👤 Bacche ka naam बताइए" });
      return;
    }

    // STEP 4: NAME & FINISH
    if (users[from].step === 4) {
      users[from].name = text;
      users[from].step = 0;

      const orderText =
        `📦 NEW SCHOOL ORDER\n\n` +
        `👤 Name: ${users[from].name}\n` +
        `🏫 Class: ${users[from].class}\n` +
        `🎒 Tools: ${users[from].tools.join(", ")}\n` +
        `📱 Mobile: ${from.replace("@s.whatsapp.net", "")}`;

      // User confirmation
      await sock.sendMessage(from, {
        text: "✅ Order Confirmed! Thank you 🙏"
      });

      // Admin notification
      await sock.sendMessage(ADMIN_NUMBER, {
        text: orderText
      });

      // Google Sheet (optional)
      if (GOOGLE_SHEET_URL) {
        await axios.post(GOOGLE_SHEET_URL, {
          name: users[from].name,
          class: users[from].class,
          tools: users[from].tools.join(", "),
          mobile: from.replace("@s.whatsapp.net", "")
        });
      }
    }
  });
}

startBot();
