const http = require("http");
const {
  default: makeWASocket,
  useMultiFileAuthState
} = require("@whiskeysockets/baileys");

// ================= SERVER =================
http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Bot is running");
}).listen(3000);

// ================= CONFIG =================
const ADMIN_NUMBER = "91XXXXXXXXXX@s.whatsapp.net"; 
// 👆 अपना WhatsApp नंबर country code के साथ डालो

// ================= START BOT =================
async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("auth");

  const sock = makeWASocket({
    auth: state,
    browser: ["Ubuntu", "Chrome", "22.04"]
  });

  sock.ev.on("creds.update", saveCreds);

  const users = {};

  // ========== CONNECTION UPDATE ==========
  sock.ev.on("connection.update", (update) => {
    const { connection, qr } = update;

    if (qr) {
      console.log("\n================ QR CODE ================\n");
      console.log(qr);
      console.log("\nWhatsApp → Linked Devices → Scan QR\n");
    }

    if (connection === "open") {
      console.log("✅ WhatsApp Connected Successfully");
    }

    if (connection === "close") {
      console.log("❌ Connection Closed");
    }
  });

  // ========== MESSAGE HANDLER ==========
  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const from = msg.key.remoteJid;
    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      "";

    const button =
      msg.message.buttonsResponseMessage?.selectedButtonId;

    if (!users[from]) users[from] = { step: 0, tools: [] };

    // STEP 0: START
    if (text.toLowerCase() === "hi") {
      users[from] = { step: 1, tools: [] };
      await sock.sendMessage(from, {
        text: "Welcome to School Bot\nSelect items:",
        buttons: [
          { buttonId: "dress", buttonText: { displayText: "Dress" }, type: 1 },
          { buttonId: "books", buttonText: { displayText: "Books" }, type: 1 },
          { buttonId: "shoes", buttonText: { displayText: "Shoes" }, type: 1 }
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
        text: "Added!\nMore items? (yes / no)"
      });
      return;
    }

    // STEP 2: MORE ITEMS
    if (users[from].step === 2) {
      if (text.toLowerCase() === "yes") {
        users[from].step = 1;
        await sock.sendMessage(from, { text: "Select again:" });
      } else {
        users[from].step = 3;
        await sock.sendMessage(from, { text: "Enter class:" });
      }
      return;
    }

    // STEP 3: CLASS
    if (users[from].step === 3) {
      users[from].class = text;
      users[from].step = 4;
      await sock.sendMessage(from, { text: "Enter student name:" });
      return;
    }

    // STEP 4: NAME & FINISH
    if (users[from].step === 4) {
      users[from].name = text;

      const orderText =
        `📚 NEW SCHOOL ORDER\n\n` +
        `👤 Name: ${users[from].name}\n` +
        `🏫 Class: ${users[from].class}\n` +
        `🛍 Items: ${users[from].tools.join(", ")}\n` +
        `📞 Number: ${from.replace("@s.whatsapp.net", "")}`;

      // User confirmation
      await sock.sendMessage(from, {
        text: "✅ Order Confirmed!\nThank you 😊"
      });

      // Admin notification
      await sock.sendMessage(ADMIN_NUMBER, {
        text: orderText
      });

      delete users[from];
    }
  });
}

startBot();
