// LeadSense AI - Webhook Bot for Zoho SalesIQ
// Author: ChatGPT & Adithyan Buddy 😎

const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Memory sessions for user conversations
const sessions = {};

// Helper: get session ID
function getSessionId(body) {
  if (body.visitor && body.visitor.id) return body.visitor.id;
  if (body.request && body.request.visitor && body.request.visitor.id)
    return body.request.visitor.id;
  return "default";
}

// Helper: get user message text
function getText(body) {
  if (body.message && body.message.text) return body.message.text.trim();
  if (body.request?.message?.text) return body.request.message.text.trim();
  return "";
}

// Helper: send reply to SalesIQ
function reply(texts, suggestions = []) {
  return {
    action: "reply",
    replies: Array.isArray(texts) ? texts : [texts],
    ...(suggestions.length > 0 ? { suggestions } : {})
  };
}

// Helper: get or create session
function getSession(id) {
  if (!sessions[id]) sessions[id] = { stage: "start", data: {} };
  return sessions[id];
}

// ---------------------- MAIN WEBHOOK ----------------------
app.post("/zoho-salesiq", async (req, res) => {
  const body = req.body;
  const text = getText(body);
  const sessionId = getSessionId(body);
  const session = getSession(sessionId);
  const data = session.data;

  console.log("Incoming →", { text, stage: session.stage });

  // ---------------------- TRIGGER ----------------------
  if (body.handler === "trigger" || session.stage === "start") {
    session.stage = "main_menu";
    return res.json(
      reply(
        [
          "👋 Hi! I’m **LeadSense AI**, your smart lead qualification assistant.",
          "How can I help you today?"
        ],
        ["Qualify Me", "Talk to Sales Team", "Company Info"]
      )
    );
  }

  // ---------------------- MAIN MENU ----------------------
  if (session.stage === "main_menu") {
    if (text === "Qualify Me") {
      session.stage = "get_name";
      return res.json(reply("Great! Let's qualify you. ✨\n\nWhat’s your full name?"));
    }

    if (text === "Talk to Sales Team") {
      session.stage = "sales_name";
      return res.json(reply("Sure! What’s your name?"));
    }

    if (text === "Company Info") {
      return res.json(
        reply(
          [
            "🏢 *LeadSense AI*",
            "We provide automated lead qualification, scoring, and CRM integration."
          ],
          ["Qualify Me", "Talk to Sales Team"]
        )
      );
    }
  }

  // ---------------------- LEAD QUALIFICATION FLOW ----------------------

  if (session.stage === "get_name") {
    data.name = text;
    session.stage = "get_email";
    return res.json(reply("Nice! 😊\n\nWhat’s your email address?"));
  }

  if (session.stage === "get_email") {
    data.email = text;
    session.stage = "get_phone";
    return res.json(reply("Enter your mobile number:"));
  }

  if (session.stage === "get_phone") {
    data.phone = text;

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    data.otp = otp;

    console.log("Generated OTP:", otp);

    session.stage = "verify_otp";
    return res.json(reply(`🔐 OTP sent! (Demo OTP: **${otp}**) \nPlease enter the OTP:`));
  }

  if (session.stage === "verify_otp") {
    if (text !== data.otp) {
      return res.json(reply("❌ Incorrect OTP. Try again:"));
    }
    session.stage = "get_company";
    return res.json(reply("✅ OTP Verified!\n\nWhat’s your company name?"));
  }

  if (session.stage === "get_company") {
    data.company = text;
    session.stage = "get_website";
    return res.json(reply("Your company website URL?"));
  }

  if (session.stage === "get_website") {
    data.website = text;
    session.stage = "get_budget";
    return res.json(
      reply("Approximate budget range?", [
        "Below ₹50K",
        "₹50K – ₹2L",
        "₹2L – ₹5L",
        "Above ₹5L"
      ])
    );
  }

  if (session.stage === "get_budget") {
    data.budget = text;
    session.stage = "get_timeline";
    return res.json(
      reply("Expected timeline?", [
        "ASAP",
        "1–3 months",
        "3–6 months",
        "Flexible"
      ])
    );
  }

  if (session.stage === "get_timeline") {
    data.timeline = text;
    session.stage = "calculate_score";

    // ------------------ LEAD SCORING ------------------
    let score = 0;

    // Email check
    if (data.email.includes("@gmail.com") === false) score += 20;

    // Company domain
    if (data.website && data.website.length > 6) score += 30;

    // Budget
    if (data.budget === "Above ₹5L") score += 40;
    else if (data.budget === "₹2L – ₹5L") score += 30;
    else if (data.budget === "₹50K – ₹2L") score += 20;

    // Timeline
    if (data.timeline === "ASAP") score += 20;
    else if (data.timeline === "1–3 months") score += 10;

    // OTP verified
    score += 30;

    data.score = score;

    // ---------- SUMMARY ----------
    const summary =
      `🧾 *Lead Summary*\n\n` +
      `👤 Name: ${data.name}\n` +
      `📧 Email: ${data.email}\n` +
      `📞 Phone: ${data.phone}\n` +
      `🏢 Company: ${data.company}\n` +
      `🌐 Website: ${data.website}\n` +
      `💰 Budget: ${data.budget}\n` +
      `⏱ Timeline: ${data.timeline}\n\n` +
      `⭐ *Lead Score: ${score}/140*`;

    session.stage = "done";

    return res.json(
      reply(
        [summary, "Would you like to talk to our sales team now?"],
        ["Talk to Sales Team", "No Thanks"]
      )
    );
  }

  // ---------------------- SALES FLOW ----------------------

  if (session.stage === "sales_name") {
    data.sales_name = text;
    session.stage = "sales_email";
    return res.json(reply("Your email address?"));
  }

  if (session.stage === "sales_email") {
    data.sales_email = text;
    session.stage = "sales_phone";
    return res.json(reply("Your contact number?"));
  }

  if (session.stage === "sales_phone") {
    data.sales_phone = text;
    session.stage = "main_menu";

    return res.json(
      reply(
        [
          "📨 Your details have been sent to our Sales Team.",
          "They will reach you shortly. 🙌"
        ],
        ["Qualify Me", "Company Info"]
      )
    );
  }

  // ---------------------- FALLBACK ----------------------
  return res.json(reply("I didn’t understand that. Please choose an option.", ["Qualify Me", "Talk to Sales Team"]));
});

// ---------------------- HOME ROUTE ----------------------
app.get("/", (req, res) => {
  res.send("LeadSense AI Webhook Active! 🚀");
});

// ---------------------- START SERVER ----------------------
app.listen(PORT, () => {
  console.log("LeadSense AI webhook running on port " + PORT);
});
