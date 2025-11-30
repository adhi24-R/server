// server.js
// ProdMate - IT Service & Web Development Assistant (Webhook Bot for Zoho SalesIQ)

const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;

// Parse JSON body
app.use(express.json());

// Simple in-memory session store
// sessions[sessionId] = { stage: "...", data: {...} }
const sessions = {};

// Helper: get session id from Zoho payload
function getSessionId(body) {
  // Try to use visitor id or conversation id if available
  if (body && body.visitor && body.visitor.id) {
    return String(body.visitor.id);
  }
  if (body && body.request && body.request.visitor && body.request.visitor.id) {
    return String(body.request.visitor.id);
  }
  if (body && body.request_id) {
    return String(body.request_id);
  }
  // Fallback (not ideal but ok for dev)
  return "default-session";
}

// Helper: get user text from Zoho payload
function getUserText(body) {
  if (body && body.message && typeof body.message.text === "string") {
    return body.message.text.trim();
  }
  if (body && body.request && body.request.message && typeof body.request.message.text === "string") {
    return body.request.message.text.trim();
  }
  if (body && typeof body.text === "string") {
    return body.text.trim();
  }
  return "";
}

// Helper: get or create session
function getSession(sessionId) {
  if (!sessions[sessionId]) {
    sessions[sessionId] = {
      stage: "start",
      data: {}
    };
  }
  return sessions[sessionId];
}

// Helper: build reply object Zoho expects
function makeReply(replies, suggestions) {
  const result = {
    action: "reply",
    replies: []
  };

  if (Array.isArray(replies)) {
    result.replies = replies;
  } else if (typeof replies === "string") {
    result.replies = [replies];
  }

  if (Array.isArray(suggestions) && suggestions.length > 0) {
    result.suggestions = suggestions;
  }

  return result;
}

// Main Webhook endpoint for Zoho SalesIQ
app.post("/zoho-salesiq", function (req, res) {
  const body = req.body || {};
  const handlerType = body.handler || ""; // "trigger" or "message" (if Zoho sends it)
  const text = getUserText(body);
  const sessionId = getSessionId(body);
  const session = getSession(sessionId);
  let stage = session.stage;
  const data = session.data;

  console.log("=== Incoming from Zoho ===");
  console.log("Handler:", handlerType, "| Session:", sessionId, "| Stage:", stage, "| Text:", text);

  // 1) Trigger handler: when visitor first lands (if configured)
  if (handlerType === "trigger" || stage === "start") {
    session.stage = "main_menu";
    const responseBody = makeReply(
      [
        "👋 Hi! I’m ProdMate – your IT Service & Web Development Assistant.",
        "I can help you with project enquiries, product implementations, and ongoing support."
      ],
      [
        "New Web / App Project",
        "Support for Existing Product",
        "Implementation / Integration",
        "Company Services Info"
      ]
    );
    return res.json(responseBody);
  }

  // 2) Message handler: conversation logic based on stages
  // ----------------------------------------------------
  // MAIN MENU
  if (stage === "main_menu") {
    if (text === "New Web / App Project") {
      session.stage = "ask_business_model";
      const responseBody = makeReply(
        [
          "Awesome! 🚀 Let’s talk about your new project.",
          "First, which best describes your business?"
        ],
        [
          "Product-based Company",
          "Service-based Company",
          "Startup / Founder"
        ]
      );
      return res.json(responseBody);
    }

    if (text === "Support for Existing Product") {
      session.stage = "support_product_type";
      const responseBody = makeReply(
        "Sure. Is this a software / web app issue or a hardware / device issue?",
        ["Software / Web App Issue", "Hardware / Device Issue"]
      );
      return res.json(responseBody);
    }

    if (text === "Implementation / Integration") {
      session.stage = "impl_type";
      const responseBody = makeReply(
        "Got it. What kind of implementation or integration do you need?",
        [
          "New product setup",
          "API / Third-party integration",
          "Cloud / DevOps setup",
          "Migration from old system"
        ]
      );
      return res.json(responseBody);
    }

    if (text === "Company Services Info") {
      const responseBody = makeReply(
        [
          "🏢 We provide:",
          "• Custom web & mobile app development",
          "• SaaS product development",
          "• Ongoing maintenance & support",
          "• API integrations, DevOps & cloud setup",
          "• UI/UX & product consulting"
        ],
        [
          "New Web / App Project",
          "Support for Existing Product",
          "Implementation / Integration"
        ]
      );
      return res.json(responseBody);
    }

    // Fallback in main_menu
    const responseBody = makeReply(
      "Please select one of the options below 👇",
      [
        "New Web / App Project",
        "Support for Existing Product",
        "Implementation / Integration",
        "Company Services Info"
      ]
    );
    return res.json(responseBody);
  }

  // ----------------------------------------------------
  // NEW PROJECT FLOW
  // ----------------------------------------------------

  if (stage === "ask_business_model") {
    data.business_model = text; // Product-based / Service-based / Startup
    session.stage = "ask_project_type";

    const responseBody = makeReply(
      "Great. What type of project are you looking for?",
      [
        "Company Website",
        "Web Application / SaaS",
        "Mobile App",
        "E-commerce Platform",
        "UI/UX & Redesign"
      ]
    );
    return res.json(responseBody);
  }

  if (stage === "ask_project_type") {
    data.project_type = text;
    session.stage = "ask_project_goal";

    const responseBody = makeReply(
      "Nice choice. What’s the main goal of this project? (e.g., lead generation, internal tool, SaaS product, brand website, etc.)"
    );
    return res.json(responseBody);
  }

  if (stage === "ask_project_goal") {
    data.project_goal = text;
    session.stage = "ask_budget";

    const responseBody = makeReply(
      "Got it. Do you have an approximate budget range in mind?",
      [
        "Below ₹50K",
        "₹50K – ₹2L",
        "₹2L – ₹5L",
        "Above ₹5L",
        "Not sure yet"
      ]
    );
    return res.json(responseBody);
  }

  if (stage === "ask_budget") {
    data.budget_range = text;
    session.stage = "ask_timeline";

    const responseBody = makeReply(
      "What’s your expected timeline for this project?",
      [
        "ASAP (0–1 month)",
        "1–3 months",
        "3–6 months",
        "Flexible"
      ]
    );
    return res.json(responseBody);
  }

  if (stage === "ask_timeline") {
    data.timeline = text;
    session.stage = "ask_tech_pref";

    const responseBody = makeReply(
      "Any tech preferences? (e.g., React, Next.js, Node.js, Laravel, Flutter, etc.)\nYou can also type 'No preference'."
    );
    return res.json(responseBody);
  }

  if (stage === "ask_tech_pref") {
    data.tech_preference = text;
    session.stage = "ask_project_details";

    const responseBody = makeReply(
      "Please describe your project in 3–4 lines. Include key features or modules you need."
    );
    return res.json(responseBody);
  }

  if (stage === "ask_project_details") {
    data.project_details = text;
    session.stage = "ask_contact_name";

    const responseBody = makeReply("Great! Can I have your full name?");
    return res.json(responseBody);
  }

  if (stage === "ask_contact_name") {
    data.contact_name = text;
    session.stage = "ask_contact_email";

    const responseBody = makeReply("Your work email address?");
    return res.json(responseBody);
  }

  if (stage === "ask_contact_email") {
    data.contact_email = text;
    session.stage = "ask_contact_phone";

    const responseBody = makeReply("Your contact phone number?");
    return res.json(responseBody);
  }

  if (stage === "ask_contact_phone") {
    data.contact_phone = text;
    session.stage = "confirm_project_summary";

    // Build summary
    const summary =
      "📝 *New Project Enquiry Summary*\n\n" +
      "🏢 Business type: " + (data.business_model || "-") + "\n" +
      "🧩 Project type: " + (data.project_type || "-") + "\n" +
      "🎯 Goal: " + (data.project_goal || "-") + "\n" +
      "💰 Budget: " + (data.budget_range || "-") + "\n" +
      "⏱ Timeline: " + (data.timeline || "-") + "\n" +
      "⚙ Tech preference: " + (data.tech_preference || "-") + "\n" +
      "📋 Details: " + (data.project_details || "-") + "\n\n" +
      "👤 Contact: " + (data.contact_name || "-") + "\n" +
      "📧 Email: " + (data.contact_email || "-") + "\n" +
      "📞 Phone: " + (data.contact_phone || "-");

    const responseBody = makeReply(
      [
        summary,
        "Do you want to submit this enquiry now?"
      ],
      ["Submit", "Cancel"]
    );
    return res.json(responseBody);
  }

  if (stage === "confirm_project_summary") {
    if (text === "Submit") {
      // 👉 Here you can integrate with Zoho CRM, Desk, or your backend API.
      console.log("=== NEW PROJECT ENQUIRY SUBMITTED ===");
      console.log(data);

      // Reset session for new conversation
      session.stage = "main_menu";
      session.data = {};

      const responseBody = makeReply(
        [
          "✅ Your project enquiry has been submitted successfully.",
          "Our team will contact you soon with next steps."
        ],
        [
          "New Web / App Project",
          "Support for Existing Product",
          "Implementation / Integration"
        ]
      );
      return res.json(responseBody);
    } else if (text === "Cancel") {
      session.stage = "main_menu";
      session.data = {};

      const responseBody = makeReply(
        "Okay, I’ve cancelled this enquiry. You can start again anytime.",
        [
          "New Web / App Project",
          "Support for Existing Product",
          "Implementation / Integration"
        ]
      );
      return res.json(responseBody);
    } else {
      const responseBody = makeReply(
        "Please choose *Submit* or *Cancel*.",
        ["Submit", "Cancel"]
      );
      return res.json(responseBody);
    }
  }

  // ----------------------------------------------------
  // SUPPORT FLOW (Existing product support - short version)
  // ----------------------------------------------------

  if (stage === "support_product_type") {
    data.support_type = text; // Software / Hardware
    session.stage = "support_product_name";

    const responseBody = makeReply(
      "Please enter your product / module name (e.g., CRM portal, Billing app, IoT device etc.):"
    );
    return res.json(responseBody);
  }

  if (stage === "support_product_name") {
    data.support_product = text;
    session.stage = "support_issue_desc";

    const responseBody = makeReply(
      "Describe the issue you’re facing in 2–3 lines (what happens, when it started, any error messages)."
    );
    return res.json(responseBody);
  }

  if (stage === "support_issue_desc") {
    data.support_issue = text;
    session.stage = "support_contact_email";

    const responseBody = makeReply("Your email for support updates?");
    return res.json(responseBody);
  }

  if (stage === "support_contact_email") {
    data.support_email = text;
    session.stage = "support_contact_phone";

    const responseBody = makeReply("Your contact number?");
    return res.json(responseBody);
  }

  if (stage === "support_contact_phone") {
    data.support_phone = text;
    session.stage = "support_summary";

    const sSummary =
      "🛠 *Support Request Summary*\n\n" +
      "Issue type: " + (data.support_type || "-") + "\n" +
      "Product / Module: " + (data.support_product || "-") + "\n" +
      "Issue: " + (data.support_issue || "-") + "\n\n" +
      "📧 Email: " + (data.support_email || "-") + "\n" +
      "📞 Phone: " + (data.support_phone || "-");

    const responseBody = makeReply(
      [
        sSummary,
        "We’ve recorded your support request. Our team will reach out to you soon."
      ],
      [
        "New Web / App Project",
        "Implementation / Integration",
        "Company Services Info"
      ]
    );

    // Reset after summary
    session.stage = "main_menu";
    session.data = {};
    return res.json(responseBody);
  }

  // ----------------------------------------------------
  // IMPLEMENTATION / INTEGRATION FLOW (short version)
  // ----------------------------------------------------

  if (stage === "impl_type") {
    data.impl_type = text;
    session.stage = "impl_system_details";

    const responseBody = makeReply(
      "Please describe the systems or tools involved (e.g., Zoho, Shopify, custom backend, payment gateway, etc.)."
    );
    return res.json(responseBody);
  }

  if (stage === "impl_system_details") {
    data.impl_systems = text;
    session.stage = "impl_contact_name";

    const responseBody = makeReply("Your name, please?");
    return res.json(responseBody);
  }

  if (stage === "impl_contact_name") {
    data.impl_contact_name = text;
    session.stage = "impl_contact_email";

    const responseBody = makeReply("Your email id?");
    return res.json(responseBody);
  }

  if (stage === "impl_contact_email") {
    data.impl_contact_email = text;
    session.stage = "impl_contact_phone";

    const responseBody = makeReply("Your phone number?");
    return res.json(responseBody);
  }

  if (stage === "impl_contact_phone") {
    data.impl_contact_phone = text;

    const iSummary =
      "⚙️ *Implementation / Integration Request*\n\n" +
      "Type: " + (data.impl_type || "-") + "\n" +
      "Systems / Tools: " + (data.impl_systems || "-") + "\n\n" +
      "👤 Contact: " + (data.impl_contact_name || "-") + "\n" +
      "📧 Email: " + (data.impl_contact_email || "-") + "\n" +
      "📞 Phone: " + (data.impl_contact_phone || "-");

    const responseBody = makeReply(
      [
        iSummary,
        "Thanks! Our implementation team will get in touch with you soon."
      ],
      [
        "New Web / App Project",
        "Support for Existing Product",
        "Company Services Info"
      ]
    );

    session.stage = "main_menu";
    session.data = {};
    return res.json(responseBody);
  }

  // ----------------------------------------------------
  // Fallback for any unknown stage
  // ----------------------------------------------------
  session.stage = "main_menu";
  const responseBody = makeReply(
    "Let’s start again. What do you need help with?",
    [
      "New Web / App Project",
      "Support for Existing Product",
      "Implementation / Integration",
      "Company Services Info"
    ]
  );
  return res.json(responseBody);
});

// Simple health-check route
app.get("/", function (req, res) {
  res.send("ProdMate IT Service Bot is running ✅");
});

app.listen(PORT, function () {
  console.log("ProdMate bot listening on port " + PORT);
});
