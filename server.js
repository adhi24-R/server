//-----------------------------------------------
// LeadSense AI - Webhook Bot (With CRM + OTP + Info)
//-----------------------------------------------

const express = require("express");
const axios = require("axios");
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// ---------------- CRM AUTH CONFIG ------------------
// Replace these with YOUR Zoho CRM credentials
const CLIENT_ID = "YOUR_CLIENT_ID";
const CLIENT_SECRET = "YOUR_CLIENT_SECRET";
const REFRESH_TOKEN = "YOUR_REFRESH_TOKEN";

// CRM token
let accessToken = null;

// Function to get fresh access token
async function getCRMToken() {
  const url = `https://accounts.zoho.com/oauth/v2/token?refresh_token=${REFRESH_TOKEN}&client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}&grant_type=refresh_token`;
  const res = await axios.post(url);
  accessToken = res.data.access_token;
  return accessToken;
}

// ---------------- Session System ------------------
const sessions = {};
function getSessionId(body) {
  if (body.visitor?.id) return body.visitor.id;
  if (body.request?.visitor?.id) return body.request.visitor.id;
  return "default";
}
function getText(body) {
  return body.message?.text ||
    body.request?.message?.text ||
    "";
}
function getSession(id) {
  if (!sessions[id]) sessions[id] = { stage: "start", data: {} };
  return sessions[id];
}
function reply(texts, suggestions = []) {
  return {
    action: "reply",
    replies: Array.isArray(texts) ? texts : [texts],
    ...(suggestions.length > 0 && { suggestions })
  };
}

// ------------------- WEBHOOK ----------------------
app.post("/zoho-salesiq", async (req, res) => {
  const body = req.body;
  const text = getText(body).trim();
  const sid = getSessionId(body);
  const session = getSession(sid);
  const data = session.data;

  console.log("Incoming:", text, "| Stage:", session.stage);

  // ----------------- INSTANT INFO HANDLERS -----------------
  if (text.toLowerCase().includes("terms")) {
    return res.json(
      reply([
        "📜 *Terms & Conditions*",
        "1. All data submitted is used only for lead analysis.",
        "2. No details are shared with third parties.",
        "3. OTP verification ensures lead authenticity.",
        "4. Sales team may contact you for follow-up.",
        "Need anything else?"
      ])
    );
  }

  if (text.toLowerCase().includes("privacy")) {
    return res.json(
      reply([
        "🔒 *Privacy Policy*",
        "We strictly protect all your personal and business information.",
        "No data is sold or shared.",
        "Used only for qualification & CRM updates."
      ])
    );
  }

  if (text.toLowerCase().includes("company")) {
    return res.json(
      reply([
        "🏢 *Company Details*",
        "Name: LeadSense Technologies Pvt. Ltd.",
        "Location: Chennai, India",
        "Services: AI Bots, Web Development, Product Engineering, CRM Automation"
      ])
    );
  }

  if (text.toLowerCase().includes("about")) {
    return res.json(
      reply([
        "ℹ️ *About LeadSense AI*",
        "We build intelligent lead qualification systems for fast-growing businesses."
      ])
    );
  }

  // ----------------- TRIGGER / START -----------------
  if (body.handler === "trigger" || session.stage === "start") {
    session.stage = "menu";
    return res.json(
      reply(
        [
          "👋 Hi! I’m **LeadSense AI**, your smart lead qualification assistant.",
          "How can I help you today?"
        ],
        ["Qualify Me", "Talk to Sales", "Terms & Conditions", "Company Info"]
      )
    );
  }

  // ----------------- MAIN MENU -----------------
  if (session.stage === "menu") {
    if (text === "Qualify Me") {
      session.stage = "name";
      return res.json(reply("Sure! What's your full name?"));
    }

    if (text === "Talk to Sales") {
      session.stage = "sales_name";
      return res.json(reply("Okay! What’s your name?"));
    }
  }

  // ------------------ QUALIFICATION FLOW ------------------
  if (session.stage === "name") {
    data.name = text;
    session.stage = "email";
    return res.json(reply("Enter your email:"));
  }

  if (session.stage === "email") {
    data.email = text;
    session.stage = "phone";
    return res.json(reply("Enter your phone number:"));
  }

  if (session.stage === "phone") {
    data.phone = text;

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    data.otp = otp;

    console.log("OTP:", otp);

    session.stage = "otp_verify";
    return res.json(reply(`OTP sent! (Demo OTP: **${otp}**) Enter OTP:`));
  }

  if (session.stage === "otp_verify") {
    if (text !== data.otp) return res.json(reply("❌ Wrong OTP. Try again:"));
    session.stage = "company";
    return res.json(reply("OTP Verified! What’s your company name?"));
  }

  if (session.stage === "company") {
    data.company = text;
    session.stage = "website";
    return res.json(reply("Your company website URL?"));
  }

  if (session.stage === "website") {
    data.website = text;
    session.stage = "budget";
    return res.json(
      reply("Your approximate budget?", [
        "Below ₹50K",
        "₹50K – ₹2L",
        "₹2L – ₹5L",
        "Above ₹5L"
      ])
    );
  }

  if (session.stage === "budget") {
    data.budget = text;
    session.stage = "timeline";
    return res.json(
      reply("Expected timeline?", ["ASAP", "1–3 months", "3–6 months", "Flexible"])
    );
  }

  if (session.stage === "timeline") {
    data.timeline = text;

    // -------- LEAD SCORING --------
    let score = 0;

    if (!data.email.includes("@gmail")) score += 20;
    if (data.website) score += 30;

    if (data.budget === "Above ₹5L") score += 40;
    else if (data.budget === "₹2L – ₹5L") score += 30;
    else if (data.budget === "₹50K – ₹2L") score += 20;

    if (data.timeline === "ASAP") score += 20;

    score += 30; // OTP bonus

    data.score = score;

    // ------ CRM CREATE LEAD ------
    try {
      const token = await getCRMToken();

      await axios.post(
        "https://www.zohoapis.com/crm/v2/Leads",
        {
          data: [
            {
              Company: data.company,
              Last_Name: data.name || "Lead",
              Email: data.email,
              Phone: data.phone,
              Website: data.website,
              Description: `Budget: ${data.budget}, Timeline: ${data.timeline}`,
              Lead_Score: score
            }
          ]
        },
        {
          headers: { Authorization: `Zoho-oauthtoken ${token}` }
        }
      );

      console.log("CRM Lead Created!");
    } catch (err) {
      console.log("CRM ERROR:", err.response?.data || err);
    }

    // -------- SUMMARY --------
    session.stage = "done";

    return res.json(
      reply(
        [
          `🧾 *Lead Summary*\n\n` +
            `👤 Name: ${data.name}\n` +
            `📧 Email: ${data.email}\n` +
            `📞 Phone: ${data.phone}\n` +
            `🏢 Company: ${data.company}\n` +
            `🌐 Website: ${data.website}\n` +
            `💰 Budget: ${data.budget}\n` +
            `⏱ Timeline: ${data.timeline}\n` +
            `⭐ Lead Score: ${score}/140`,
          "Would you like to talk to Sales?"
        ],
        ["Talk to Sales", "No Thanks"]
      )
    );
  }

  // ------------------- SALES TEAM FLOW -------------------
  if (session.stage === "sales_name") {
    data.sales_name = text;
    session.stage = "sales_email";
    return res.json(reply("Your email?"));
  }

  if (session.stage === "sales_email") {
    data.sales_email = text;
    session.stage = "sales_phone";
    return res.json(reply("Your phone?"));
  }

  if (session.stage === "sales_phone") {
    data.sales_phone = text;
    session.stage = "menu";

    return res.json(
      reply(
        [
          "📞 Sales team will contact you shortly.",
          "Need anything else?"
        ],
        ["Qualify Me", "Terms & Conditions"]
      )
    );
  }

  // ------------- fallback -----------
  return res.json(reply("I didn’t get that. Choose an option.", ["Qualify Me", "Talk to Sales"]));
});

// --------------- HOME ROUTE ---------------
app.get("/", (req, res) => {
  res.send("LeadSense AI Webhook Running ✔️");
});

// ---------------- START SERVER -----------
app.listen(PORT, () => {
  console.log("LeadSense AI running on port " + PORT);
});
