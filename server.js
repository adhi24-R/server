//-----------------------------------------------
// LeadSense AI - Webhook Bot (With CRM + REAL OTP + Info)
//-----------------------------------------------

const express = require("express");
const axios = require("axios");
const nodemailer = require("nodemailer");
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// ---------------- EMAIL SENDER (REAL OTP) ------------------
const mailer = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,   // Gmail from Render ENV
    pass: process.env.EMAIL_PASS    // App Password from Render ENV
  }
});

async function sendOTPEmail(toEmail, otp) {
  const mailOptions = {
    from: `LeadSense AI <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: "Your LeadSense AI OTP Verification",
    html: `<h2>Your OTP is:</h2><h1>${otp}</h1>`
  };

  await mailer.sendMail(mailOptions);
  console.log("OTP Email sent to:", toEmail);
}

// ---------------- CRM AUTH CONFIG ------------------
const CLIENT_ID = process.env.CRM_CLIENT_ID;
const CLIENT_SECRET = process.env.CRM_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.CRM_REFRESH_TOKEN;

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
        "1. Data is used only for lead analysis.",
        "2. No sharing with third parties.",
        "3. OTP is used for verification only.",
        "4. Sales team may contact you based on qualification."
      ])
    );
  }

  if (text.toLowerCase().includes("privacy")) {
    return res.json(
      reply([
        "🔒 *Privacy Policy*",
        "Your personal information is protected.",
        "We do not sell or share your data.",
        "Used strictly for CRM & qualification."
      ])
    );
  }

  if (text.toLowerCase().includes("company")) {
    return res.json(
      reply([
        "🏢 *Company Details*",
        "LeadSense Technologies Pvt. Ltd.",
        "Chennai, India",
        "Services: AI Bots, Web Apps, Product Development, CRM Automation."
      ])
    );
  }

  if (text.toLowerCase().includes("about")) {
    return res.json(
      reply([
        "ℹ️ *About LeadSense AI*",
        "An intelligent AI assistant for qualifying and scoring high-quality leads."
      ])
    );
  }

  // ----------------- START / TRIGGER -----------------
  if (body.handler === "trigger" || session.stage === "start") {
    session.stage = "menu";
    return res.json(
      reply(
        [
          "👋 Hi! I’m **LeadSense AI**, your smart lead qualification bot.",
          "What would you like to do?"
        ],
        ["Qualify Me", "Talk to Sales", "Terms & Conditions"]
      )
    );
  }

  // ---------------- MAIN MENU ----------------
  if (session.stage === "menu") {
    if (text === "Qualify Me") {
      session.stage = "name";
      return res.json(reply("Great! What’s your full name?"));
    }

    if (text === "Talk to Sales") {
      session.stage = "sales_name";
      return res.json(reply("Sure! What’s your name?"));
    }
  }

  // ---------------- QUALIFICATION FLOW ----------------
  if (session.stage === "name") {
    data.name = text;
    session.stage = "email";
    return res.json(reply("What is your email address?"));
  }

  if (session.stage === "email") {
    data.email = text;
    session.stage = "phone";
    return res.json(reply("Enter your phone number:"));
  }

 if (session.stage === "phone") {
  data.phone = text;

  // generate OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  data.otp = otp;

  // send real OTP safely
  try {
    await sendOTPEmail(data.email, otp);
    console.log("OTP sent to:", data.email);
  } catch (err) {
    console.log("OTP EMAIL ERROR:", err);

    return res.json(
      reply(
        "⚠️ We couldn’t send the OTP email due to a server issue.\nPlease check your email settings or try again."
      )
    );
  }

  session.stage = "otp_verify";
  return res.json(
    reply("📩 OTP has been sent to your email. Enter the OTP:")
  );
}

  if (session.stage === "otp_verify") {
    if (text !== data.otp) return res.json(reply("❌ Incorrect OTP. Try again:"));
    session.stage = "company";
    return res.json(reply("OTP Verified! What’s your company name?"));
  }

  if (session.stage === "company") {
    data.company = text;
    session.stage = "website";
    return res.json(reply("What is your company website URL?"));
  }

  if (session.stage === "website") {
    data.website = text;
    session.stage = "budget";
    return res.json(
      reply("Approximate budget?", [
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

    // lead scoring
    let score = 0;
    if (!data.email.includes("@gmail")) score += 20;
    if (data.website) score += 30;
    if (data.budget === "Above ₹5L") score += 40;
    if (data.timeline === "ASAP") score += 20;
    score += 30; // OTP bonus

    data.score = score;

    // CRM integration
    try {
      const token = await getCRMToken();
      await axios.post(
        "https://www.zohoapis.com/crm/v2/Leads",
        {
          data: [
            {
              Company: data.company,
              Last_Name: data.name,
              Email: data.email,
              Phone: data.phone,
              Website: data.website,
              Lead_Score: data.score,
              Description: `Budget: ${data.budget}, Timeline: ${data.timeline}`
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

    session.stage = "done";

    return res.json(
      reply(
        [
          `🧾 *Lead Summary*\n\n` +
          `👤 ${data.name}\n` +
          `📧 ${data.email}\n` +
          `📞 ${data.phone}\n` +
          `🏢 ${data.company}\n` +
          `🌐 ${data.website}\n` +
          `💰 ${data.budget}\n` +
          `⏱ ${data.timeline}\n` +
          `⭐ Lead Score: ${score}/140`,
          "Want to talk to Sales?"
        ],
        ["Talk to Sales", "No Thanks"]
      )
    );
  }

  // ---------------- SALES FLOW ----------------
  if (session.stage === "sales_name") {
    data.sales_name = text;
    session.stage = "sales_email";
    return res.json(reply("Enter your email:"));
  }

  if (session.stage === "sales_email") {
    data.sales_email = text;
    session.stage = "sales_phone";
    return res.json(reply("Enter your phone:"));
  }

  if (session.stage === "sales_phone") {
    data.sales_phone = text;
    session.stage = "menu";

    return res.json(
      reply(
        ["📞 Sales team will contact you soon.", "Need anything else?"],
        ["Qualify Me", "Terms & Conditions"]
      )
    );
  }

  return res.json(reply("Choose an option:", ["Qualify Me", "Talk to Sales"]));
});

// ---------------- HOME ROUTE ----------------
app.get("/", (req, res) => {
  res.send("LeadSense AI Webhook Running ✔️");
});

// ---------------- START SERVER ---------------
app.listen(PORT, () => {
  console.log("LeadSense AI running on port " + PORT);
});

