const express = require("express");
const mysql = require("mysql2");
const app = express();
const bodyParser = require("body-parser");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const bcrypt = require('bcryptjs');
const saltRounds = 10;
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const PORT = process.env.PORT || 5000;
const axios = require('axios');
const cheerio = require('cheerio');
const querystring = require('querystring');
const nodemailer = require('nodemailer');
const request = require('request');
const webpush = require('web-push');
const crypto = require('crypto');
const cron = require('node-cron');
const schedule = require("node-schedule");
const pdfParse = require('pdf-parse');
const fs = require('fs');
const webPush = require('web-push');
const Razorpay = require('razorpay');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { HarmBlockThreshold, HarmCategory } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI('AIzaSyCvmpjZRi7GGS9TcPQeVCnSDJLFPchYZ38');
const safetySettings = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_NONE
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_NONE
  }
];

const model = genAI.getGenerativeModel({
  model: "gemini-2.0-flash",
  safetySettings: safetySettings,
  systemInstruction: "You are Edusify, an AI-powered productivity assistant designed to help students manage their academic tasks, study materials, and stay organized. Your mission is to provide tailored assistance and streamline the study experience with a wide range of features.\n\n" +
  
  "- **Sticky Notes**: Users can quickly add sticky notes on the dashboard by clicking 'Add Note'. They can input a title, optional description, and select the note color. Notes are saved for easy access and organization. The dashboard also displays today's tasks and events.\n" +
  
  "- **AI Assistant**: Edusify helps users by generating notes, quizzes, and even adding AI responses directly to their notes with the 'Magic' feature. Users can click on the 'Magic' button to generate content like quizzes and notes from their AI response and add that content to their study materials.\n" +
  
  "- **To-Do List**: The To-Do List helps users manage their tasks more efficiently. Tasks can be created with a title, description, due date, priority level, and email reminders. AI can even generate tasks based on user input or upcoming deadlines.\n" +
  
  "- **Notes**: Users can create notes by going to the 'Notes' section and clicking 'Create Notes'. They can input a name and description for the note, select a subject category, and optionally add images. Notes are customizable and can be saved for future reference. Additionally, users can generate flashcards and quizzes from their notes for better retention.\n" +
  
  "- **Flashcards**: Users can create flashcards manually, from AI-generated content, or by uploading PDFs. When uploading PDFs, Edusify extracts text and generates relevant flashcards. Flashcards can be customized, saved, and studied.\n" +
  
  "- **Rooms**: Rooms allow users to create or join study groups where they can share resources, track each other's progress, and collaborate on projects. Rooms help create a sense of community for focused learning.\n" +
  
  "- **Quizzes**: Users can generate quizzes manually, with AI, or from PDFs. AI can help generate relevant quiz questions based on the user's study material, and quizzes can be shared with others for collaborative learning.\n" +
  
  "- **Document Locker**: A secure space where students can store important documents with the option to add password protection for extra security.\n" +
  
  "- **Calendar**: Users can track important dates like exams, assignments, and events, keeping their schedule organized and well-managed.\n" +
  
  "- **Pomodoro Timer**: The Pomodoro Timer helps users maintain focus with study sessions and breaks. It tracks study and break times, allowing users to monitor their productivity and download stats for social sharing.\n\n" +
  
  "When responding to user requests related to schedules, tasks, or notes, generate a general plan or summary based on the provided input without asking for too many details. If the user provides a broad topic, generate a summary note instead of requesting more specifics. If the user requires changes, wait for their feedback and adjust accordingly. Keep the flow of conversation smooth and focused on providing immediate value, not excessive clarifications."
});




app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

app.use(session({
  key: "userId",
  secret: "Englishps4",
  resave: false,
  saveUninitialized: false,
  cookie: {
    expires: 60 * 60 * 24 * 12,
  },
}));

app.use(cors({
  origin: "*", // Allows requests from any origin
  methods: ["GET", "POST", "DELETE", "PUT"],
  credentials: true, // Allows cookies to be sent
}));


// Define storage for multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
      cb(null, 'public/');
  },
  filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, Date.now() + ext); // Append timestamp to filename to avoid collisions
  },
});


// File filter function
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
  if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
  } else {
      cb(new Error('Invalid file type'), false);
  }
};


const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // Limit file size to 5 MB
});


// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

const connection = mysql.createPool({
  connectionLimit: 10, // Maximum number of connections in the pool
  host: "localhost",
  user: "root",
  password: "Englishps#4",
  database: "kisar",
});

connection.getConnection((err) => {
  if (err) {
    console.error("Error connecting to MySQL database: ", err);
  } else {
    console.log("Connected to MySQL database");
  }
});

// Promisify query function
const query = (sql, params) => {
  return new Promise((resolve, reject) => {
    connection.query(sql, params, (error, results) => {
      if (error) {
        reject(error);
      } else {
        resolve(results);
      }
    });
  });
};

const MAX_RETRIES = 10;

// Helper function to introduce a delay (in milliseconds
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));


app.post("/api/kisar/chat", async (req, res) => {
  const { message, chatHistory } = req.body;

  try {
    // Validate required inputs
    if (!message || typeof message !== 'string' || message.trim() === '') {
      return res.status(400).json({ error: 'Message cannot be empty.' });
    }

    // Build dynamic system instruction
    const dynamicSystemInstruction = `
     You are an AI chatbot designed to assist customers with questions about the KISAR 2025 event registration process. Your purpose is to provide accurate, friendly, and helpful answers based on the event registration quotation prepared on February 25, 2025, for KISAR. Use the information below to respond to customer inquiries. Always aim to be clear, concise, and polite. If a question falls outside this information, let the user know you don’t have that detail and suggest they contact KISAR at kisar.office@gmail.com.

---

Event Registration App Overview:
- This custom app is for the 10th Annual Conference KISAR 2025, held from 16th May to 18th May 2025.
- Event Purpose: Organized by the Karnataka Chapter of the India Society for Assisted Reproduction (ISAR) to facilitate professional development and networking.
- Location: Specific venue details aren’t available here; contact kisar.office@gmail.com for more info.

Package Details for Registrations (Before March 31, 2025 - Early Bird):
Sl No | Package                          | Charges in INR
1     | Non Residential Registration     | 9000/-
2     | Residential, Single Occupancy (2 Days) | 22000/-
3     | Residential, 2 Sharing (2 Days) | 17500/-
4     | Double Occupancy                | 26000/-
5     | Accompanied Person Registration | 9000/-

Late Registration (1st April 2025 to 12th May 2025):
Sl No | Package                          | Charges in INR
1     | Non Residential Registration     | 12000/-
2     | Residential, Single Occupancy (2 Days) | 26000/-
3     | Residential, 2 Sharing (2 Days) | 21500/-
4     | Double Occupancy                | 29000/-
5     | Accompanied Person Registration | 9000/-

Spot Registration (After 12th May 2025 to 16th May 2025):
Sl No | Package                          | Charges in INR
1     | Conference Only                 | 15000/-
2     | Accompanied Person Registration | 9000/-

Package Inclusions:
- Non-Residential Registration: Access to the conference and banquet only.
- Residential, Single Occupancy (2 Days): Accommodation, conference access, and banquet for one person.
- Residential, 2 Sharing (2 Days): Accommodation, conference access, and banquet; rate is per person sharing a room.
- Double Occupancy: Accommodation for two people, conference and banquet access for one registrant.
- Accompanied Person Registration: Banquet access only, requires mandatory registration.
- Conference Only (Spot): Access to the conference only, no banquet or accommodation.

Payment Details:
- A 3% + Rs.3 convenience fee is added to each package by the payment partner 
- Payments are processed through the app via a secure payment gateway (Instamojo).


Key Dates:
- Event dates: 16th May 2025 to 18th May 2025.
- Early bird deadline: Before 31st March 2025.
- Late registration period: 1st April 2025 to 12th May 2025.

Common Questions:
- Cancellation/Refund Policy: I don’t have details on cancellations or refunds. Please contact KISAR directly at kisar.office@gmail.com.
- Payment Methods: Payments are processed online via the app with a 3% convenience fee.

Guidelines for Responses:
- Be friendly and patient: “Happy to assist you! Here’s the info you’re looking for…”
- Use exact numbers: “The Non-Residential Early Bird rate is ₹9000 before 31st March 2025.”
- If unsure: “I don’t have that detail available, but feel free to email kisar.office@gmail.com for more help!”
- Avoid guessing: Stick to the provided info and don’t make assumptions.

Contact Information:
- If I can’t assist, please email kisar.office@gmail.com for further support.

---
    `;

    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      safetySettings: safetySettings,
      systemInstruction: dynamicSystemInstruction
    });

    const initialChatHistory = [
      { role: 'user', parts: [{ text: 'Hello' }] },
      { role: 'model', parts: [{ text: 'Great to meet you. What would you like to know?' }] },
    ];

    const chat = model.startChat({ history: chatHistory || initialChatHistory });

    console.log('User asked:', message);

    let aiResponse = '';

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        // Attempt to send message to AI
        const result = await chat.sendMessage(message);
        aiResponse = result.response?.text?.() || 'No response from AI.';
        console.log(`AI responded on attempt ${attempt}`);
        break; // Exit loop if successful
      } catch (error) {
        console.error(`Attempt ${attempt} failed:`, error.message);

        if (attempt === MAX_RETRIES) {
          throw new Error('AI service failed after multiple attempts.');
        }

        // Exponential backoff delay (2^attempt * 100 ms)
        const delayMs = Math.pow(2, attempt) * 100;
        console.log(`Retrying in ${delayMs}ms...`);
        await delay(delayMs);
      }
    }

    if (!aiResponse || aiResponse === 'No response from AI.') {
      return res.status(500).json({ error: 'AI service did not return a response.' });
    }


    res.json({ response: aiResponse });
  } catch (error) {
    console.error('Error in /api/chat/ai endpoint:', error);

    res.status(500).json({ error: 'An error occurred while processing your request. Please try again later.' });
  }
});


// Razorpay setup
const razorpay = new Razorpay({
  key_id: 'rzp_test_RerVxaTytL17Ax',
  key_secret: 'qUxFqXVXmy8CttXEorqE6Kor',
});

app.post("/create-order-razorpay", async (req, res) => {
  try {
    const { amount, currency } = req.body;

    const options = {
      amount: amount * 100, 
      currency,
      receipt: `order_rcptid_${Math.floor(Math.random() * 100000)}`,
    };

    const order = await razorpay.orders.create(options);
    res.json({ order });
  } catch (error) {
    console.error("Error creating order:", error);
    res.status(500).json({ error: "Failed to create order" });
  }
});


app.post("/create-order-instamojo", async (req, res) => {
  try {
    const {
      amount,
      honorific,
      first_name,
      middle_name,
      last_name,
      email,
      phone,
      address,
      city,
      state,
      pincode,
      med_council_number,
      category,
      type,
      package_ids,
    } = req.body;

    const INSTAMOJO_API_KEY = "0cb75fd5924ef24ef42dd7a202a4d773";
    const INSTAMOJO_AUTH_TOKEN = "432d3e19bdcf4f6fc0d2f4e71674f868";
    const INSTAMOJO_API_URL = "https://www.instamojo.com/api/1.1/payment-requests/";

    // Check if phone number already has a SUCCESS entry
    const checkQuery = `
      SELECT COUNT(*) as successCount
      FROM event_registrations
      WHERE phone = ? AND payment_status = 'SUCCESS'
    `;
    const checkResult = await query(checkQuery, [phone]);

    if (checkResult[0].successCount > 0) {
      return res.status(409).json({
        error: "This phone number is already registered with a successful payment."
      });
    }

    const buyerName = `${honorific || ""} ${first_name} ${middle_name || ""} ${last_name}`.trim();

    const packageQuery = `
      SELECT name
      FROM packages
      WHERE id IN (?)
    `;
    const packageResult = await query(packageQuery, [package_ids]);
    const packageTitles = packageResult.map((row) => row.name);

    const paymentData = {
      purpose: `Packages: ${packageTitles.join(", ")}`,
      amount: amount,
      buyer_name: buyerName,
      email: email,
      phone: phone,
      redirect_url: "https://kisar2025.vercel.app/payment-success",
      webhook: "https://srv742265.hstgr.cloud/webhook",
      send_email: true,
      send_sms: true,
      allow_repeated_payments: false,
    };

    const response = await axios.post(INSTAMOJO_API_URL, paymentData, {
      headers: {
        "X-Api-Key": INSTAMOJO_API_KEY,
        "X-Auth-Token": INSTAMOJO_AUTH_TOKEN,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    const insertQuery = `
      INSERT INTO event_registrations (
        honorific, first_name, middle_name, last_name, email, phone, 
        address, city, state, pincode, med_council_number, category, type, 
        package_ids, payment_id, payment_status, amount, currency
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    await query(insertQuery, [
      honorific || null,
      first_name,
      middle_name || null,
      last_name,
      email,
      phone,
      address || null,
      city || null,
      state || null,
      pincode || null,
      med_council_number || null,
      category,
      type || null,
      JSON.stringify(package_ids),
      response.data.payment_request.id,
      "PENDING",
      amount,
      "INR",
    ]);

    res.json({
      payment_request: {
        id: response.data.payment_request.id,
        url: response.data.payment_request.longurl,
      },
    });
  } catch (error) {
    console.error("Error creating Instamojo payment request:", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to create payment request" });
  }
});



app.post("/webhook", async (req, res) => {
  try {
    // Parse webhook data from Instamojo
    const {
      amount,
      buyer,
      buyer_name,
      buyer_phone,
      currency,
      fees,
      longurl,
      mac,
      payment_id,
      payment_request_id,
      purpose,
      shorturl,
      status,
    } = req.body;

    console.log("Webhook received:", req.body);

    // Map Instamojo status to our payment_status ENUM
    const paymentStatus = status === "Credit" ? "SUCCESS" : "FAIL";
    if (status === "Credit") {
      const packageQuery = `
        SELECT p.name, p.price
        FROM event_registrations er
        JOIN packages p ON JSON_CONTAINS(er.package_ids, CAST(p.id AS JSON))
        WHERE er.payment_id = ? 
      `;
      const packageParams = [payment_request_id];
      const packageResult = await query(packageQuery, packageParams);

      if (!packageResult.length) {
        throw new Error(`No packages found for payment_request_id: ${payment_request_id}`);
      }

      // Calculate base amounts excluding 18% GST
      const gstRate = 0.18; // 9% CGST + 9% SGST
      const items = packageResult.map(pkg => {
        const priceWithGst = parseFloat(pkg.price);
        const basePrice = priceWithGst / (1 + gstRate); // Remove GST
        return {
          description: pkg.name,
          sacCode: "9995", // Fixed SAC code
          amount: basePrice.toFixed(2) // Base amount excluding GST
        };
      });

      // Payload for Python API
      const invoicePayload = {
        date: new Date().toLocaleDateString("en-GB"), // Current date in DD/MM/YYYY
        invoiceNo: "0", // Fixed invoice number
        billTo: buyer_name || "Customer",
        instamojoPaymentId: payment_id,
        email: buyer,
        items: items
      };

      // Call Python FastAPI endpoint
      await axios.post("http://localhost:4000/api/generate-invoice", invoicePayload, {
        headers: { "Content-Type": "application/json" }
      });

      console.log(`Invoice generated and email sent for payment_id: ${payment_id}`);
    }

    // Update event_registrations table
    const updateQuery = `
      UPDATE event_registrations
      SET payment_status = ?,
          payment_date = NOW(),
          payment_id = ?,
          amount = ?,
          currency = ?,
          fees = ?
      WHERE payment_id = ?
    `;
    const updateParams = [paymentStatus, payment_id, amount, currency, fees, payment_request_id];

    const result = await query(updateQuery, updateParams);

    if (result.affectedRows === 0) {
      console.warn(`No registration found for payment_request_id: ${payment_request_id}`);
    }

    

    // Respond to Instamojo to acknowledge receipt
    res.status(200).send("Webhook received");
  } catch (error) {
    console.error("Error processing webhook:", error);
    res.status(500).send("Error processing webhook");
  }
});


// Verify Payment & Store Registration
app.post("/verify-payment", async (req, res) => {
  try {
    const { payment_id, order_id, signature, name, email, phone } = req.body;

    // Verify payment signature
    const body = `${order_id}|${payment_id}`;
    const expected_signature = crypto
      .createHmac("sha256", "qUxFqXVXmy8CttXEorqE6Kor") // Razorpay secret key
      .update(body)
      .digest("hex");

    if (expected_signature !== signature) {
      return res.status(400).json({ success: false, message: "Payment verification failed" });
    }

    // Store registration details in database
    const queryText = `
      INSERT INTO event_registrations (name, email, phone, payment_id, payment_status, payment_date)
      VALUES (?, ?, ?, ?, 'success', NOW())
    `;

    await query(queryText, [name, email, phone, payment_id]);
    res.json({ success: true, message: "Registration successful!" });
  } catch (error) {
    console.error("Error in verify-payment:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/registrations", (req, res) => {
  let { search, payment_status } = req.query;
  let sql = `
    SELECT 
      er.*, 
      GROUP_CONCAT(p.name) AS package_names
    FROM 
      event_registrations er
    LEFT JOIN 
      packages p ON FIND_IN_SET(p.id, REPLACE(REPLACE(REPLACE(er.package_ids, '[', ''), ']', ''), ' ', ''))
    WHERE 1=1
  `;
  let values = [];

  if (search) {
    sql += ` AND (er.first_name LIKE ? OR er.middle_name LIKE ? OR er.last_name LIKE ? OR er.email LIKE ? OR er.phone LIKE ? OR er.payment_id LIKE ?)`;
    values.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }

  if (payment_status) {
    sql += ` AND er.payment_status = ?`;
    values.push(payment_status);
  }

  sql += ` GROUP BY er.id`;

  connection.query(sql, values, (err, results) => {
    if (err) {
      return res.status(500).json({ error: "Database query error", details: err.message });
    }


    // Ensure package_names are populated
    results.forEach(result => {
      if (result.package_names === null) {
        result.package_names = [];
      } else {
        result.package_names = result.package_names.split(',');
      }
    });

    res.json(results);
  });
});



app.put("/api/registrations/edit/:id", (req, res) => {
  let {
    honorific,
    first_name,
    middle_name,
    last_name,
    email,
    phone,
    address,
    city,
    state,
    pincode,
    med_council_number,
    category,
    type,
    package_ids,
    payment_id,
    payment_status,
    amount,
    currency,
    payment_date,
  } = req.body;

  // Ensure package_ids is stored as JSON if not null
  if (typeof package_ids === "string") {
    try {
      package_ids = JSON.parse(package_ids);
    } catch (error) {
      return res.status(400).json({ error: "Invalid JSON format for package_ids" });
    }
  }

  // Convert date format
  if (payment_date) {
    payment_date = new Date(payment_date).toISOString().slice(0, 19).replace("T", " ");
  }

  const query = `
    UPDATE event_registrations 
    SET honorific=?, first_name=?, middle_name=?, last_name=?, email=?, phone=?, address=?, 
        city=?, state=?, pincode=?, med_council_number=?, category=?, type=?, package_ids=?, 
        payment_id=?, payment_status=?, amount=?, currency=?, payment_date=COALESCE(?, payment_date)
    WHERE id=?
  `;

  const values = [
    honorific, first_name, middle_name, last_name, email, phone, address,
    city, state, pincode, med_council_number, category, type, JSON.stringify(package_ids),
    payment_id, payment_status, amount, currency, payment_date, req.params.id
  ];

  connection.query(query, values, (err, result) => {
    if (err) return res.status(500).json({ error: "Update failed", details: err.message });
    if (result.affectedRows === 0) return res.status(404).json({ error: "No record found with this ID" });
    res.json({ message: "User updated successfully" });
  });
});


// Delete Registration
app.delete("/api/registrations/remove/:id", (req, res) => {
  connection.query("DELETE FROM event_registrations WHERE id=?", [req.params.id], (err) => {
    if (err) return res.status(500).json({ error: "Delete failed" });
    res.json({ message: "User deleted successfully" });
  });
});


// Get all packages
app.get("/api/packages", async (req, res) => {
  try {
    const packages = await query("SELECT * FROM packages");
   
    res.json(packages);
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Error fetching packages" });
  }
});

// Add a new package
app.post("/api/packages/add", async (req, res) => {
  const { name, description, price, active = true, type = "MAIN" } = req.body;

  if (!name || !price) {
    return res.status(400).json({ error: "Package name and price are required" });
  }

  try {
    await query(
      "INSERT INTO packages (name, description, price, active, type) VALUES (?, ?, ?, ?, ?)",
      [name, description || null, price, active, type]
    );
    res.json({ message: "Package added successfully" });
  } catch (error) {
    console.error("Error adding package:", error);
    res.status(500).json({ error: "Error adding package" });
  }
});

// Update a package
app.put("/api/packages/edit/:id", async (req, res) => {
  const { name, description, price, active, type } = req.body;
  const { id } = req.params;

  if (!name || !price) {
    return res.status(400).json({ error: "Package name and price are required" });
  }

  try {
    const result = await query(
      "UPDATE packages SET name = ?, description = ?, price = ?, active = ?, type = ? WHERE id = ?",
      [name, description || null, price, active, type, id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Package not found" });
    }
    res.json({ message: "Package updated successfully" });
  } catch (error) {
    console.error("Error updating package:", error);
    res.status(500).json({ error: "Error updating package" });
  }
});

// Delete a package
app.delete("/api/packages/remove/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await query("DELETE FROM packages WHERE id = ?", [id]);
    res.json({ message: "Package deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Error deleting package" });
  }
});

// API endpoint to fetch package data with registration counts
app.get('/api/packages/reg-count', (req, res) => {
  // Selecting id and name from packages table
  const sql = 'SELECT id, name FROM packages';
  connection.query(sql, (err, packages) => {
    if (err) {
      throw err;
    }

    const promises = packages.map((pkg) => {
      return new Promise((resolve, reject) => {
        // Count only where package_ids contains pkg.id AND payment_status = 'SUCCESS'
        connection.query(
          `SELECT COUNT(*) AS reg_count 
           FROM event_registrations 
           WHERE JSON_CONTAINS(package_ids, ?) 
           AND payment_status = 'SUCCESS'`,
          [`[${pkg.id}]`],
          (err, result) => {
            if (err) {
              reject(err);
            } else {
              pkg.reg_count = result[0].reg_count;
              resolve(pkg);
            }
          }
        );
      });
    });

    Promise.all(promises)
      .then((packagesWithCount) => {
        res.json(packagesWithCount); // Send JSON response with packages and registration counts
      })
      .catch((err) => {
        res.status(500).json({ error: 'Error fetching data' });
      });
  });
});


app.get('/api/user-packages', (req, res) => {
  const search = req.query.query?.trim();
  if (!search) {
    return res.status(400).json({ error: 'Missing query parameter' });
  }

  // Case-insensitive search for email, name, or phone
  const sql = `
    SELECT id, honorific, first_name, middle_name, last_name, email, phone, package_ids, amount, fees
    FROM event_registrations
    WHERE (
      LOWER(email) = LOWER(?) OR
      LOWER(first_name) = LOWER(?) OR
      LOWER(phone) = LOWER(?)
    ) AND payment_status = 'SUCCESS'
    LIMIT 1
  `;

  connection.query(sql, [search, search, search], (err, results) => {
    if (err) {
      console.error('Database error in user query:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    if (results.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = results[0];
    let packageIds = [];
    // try {
    //   // Parse package_ids, default to empty array if null or invalid
    //   packageIds = user.package_ids ? JSON.parse(user.package_ids) : [];
    //   if (!Array.isArray(packageIds)) {
    //     console.warn(`Invalid package_ids format for user ${user.id}: not an array`, user.package_ids);
    //     packageIds = [];
    //   }
    //   packageIds = packageIds.filter(id => Number.isInteger(id) && id > 0);
    // } catch (parseErr) {
    //   console.warn(`Error parsing package_ids for user ${user.id}:`, parseErr.message, user.package_ids);
    //   packageIds = [];
    // }

    packageIds = user.package_ids;

    // Fetch all available MAIN packages
    connection.query(
      'SELECT id, name, price FROM packages WHERE type = ? AND active = 1 ORDER BY price ASC',
      ['MAIN'],
      (err, allPackages) => {
        if (err) {
          console.error('Error fetching all packages:', err);
          return res.status(500).json({ error: 'Error fetching all packages' });
        }

        res.json({
          user: {
            id: user.id,
            honorific: user.honorific,
            first_name: user.first_name,
            middle_name: user.middle_name,
            last_name: user.last_name,
            email: user.email,
            phone: user.phone,
            package_ids: packageIds,
            amount: user.amount,
            fees: user.fees,
          },
          allPackages: allPackages || [],
        });
      }
    );
  });
});


app.post("/api/create-upgrade-order-instamojo", async (req, res) => {
  try {
    const { registration_id, package_id, amount } = req.body;

    // Validate inputs
    if (!registration_id || !package_id || !amount) {
      return res.status(400).json({ error: "registration_id, package_id, and amount are required" });
    }

    const INSTAMOJO_API_KEY = "0cb75fd5924ef24ef42dd7a202a4d773";
    const INSTAMOJO_AUTH_TOKEN = "432d3e19bdcf4f6fc0d2f4e71674f868";
    const INSTAMOJO_API_URL = "https://www.instamojo.com/api/1.1/payment-requests/";

    // Fetch user details
    const userQuery = `
      SELECT honorific, first_name, middle_name, last_name, email, phone, package_ids,
             address, city, state, pincode, med_council_number, category, type,
             payment_id, payment_status, amount, currency, fees, payment_date
      FROM event_registrations
      WHERE id = ? AND payment_status = 'SUCCESS'
    `;
    const userResult = await query(userQuery, [registration_id]);
    if (!userResult.length) {
      return res.status(404).json({ error: "User not found or no successful registration" });
    }
    const user = userResult[0];

    // Sanitize package_ids to ensure valid JSON
    let sanitizedPackageIds = '[]'; // Default to empty array
    let parsedPackageIds = [];
    if (user.package_ids) {
      try {
        parsedPackageIds = user.package_ids;
        if (Array.isArray(parsedPackageIds)) {
          sanitizedPackageIds = JSON.stringify(parsedPackageIds);
        } else {
          console.warn(`Invalid package_ids format for registration ${registration_id}: not an array`, user.package_ids);
        }
      } catch (error) {
        console.warn(`Error parsing package_ids for registration ${registration_id}:`, error.message, user.package_ids);
      }
    }

    // Fetch new package details (name and price)
    const packageQuery = `
      SELECT name, price
      FROM packages
      WHERE id = ? AND type = 'MAIN' AND active = 1
    `;
    const packageResult = await query(packageQuery, [package_id]);
    if (!packageResult.length) {
      return res.status(404).json({ error: "Package not found or not available" });
    }
    const newPackage = packageResult[0];

    // Insert current registration into event_registrations_activity
    const activityQuery = `
      INSERT INTO event_registrations_activity (
        registration_id, honorific, first_name, middle_name, last_name, email, phone,
        address, city, state, pincode, med_council_number, category, type, package_ids,
        payment_id, payment_status, amount, currency, fees, payment_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    await query(activityQuery, [
      registration_id,
      user.honorific,
      user.first_name,
      user.middle_name,
      user.last_name,
      user.email,
      user.phone,
      user.address,
      user.city,
      user.state,
      user.pincode,
      user.med_council_number,
      user.category,
      user.type,
      sanitizedPackageIds,
      user.payment_id,
      user.payment_status,
      user.amount,
      user.currency,
      user.fees,
      user.payment_date,
    ]);

    // Prepare buyer name
    const buyerName = `${user.honorific || ""} ${user.first_name} ${user.middle_name || ""} ${user.last_name}`.trim();

    // Create Instamojo payment request with frontend-provided amount
    const paymentData = {
      purpose: `Upgrade to Package: ${newPackage.name}`,
      amount: amount,
      buyer_name: buyerName,
      email: user.email,
      phone: user.phone,
      redirect_url: "https://kisar2025.vercel.app/payment-success",
      webhook: "https://srv742265.hstgr.cloud/api/upgrade-webhook",
      send_email: true,
      send_sms: true,
      allow_repeated_payments: false,
    };

    const response = await axios.post(INSTAMOJO_API_URL, querystring.stringify(paymentData), {
      headers: {
        "X-Api-Key": INSTAMOJO_API_KEY,
        "X-Auth-Token": INSTAMOJO_AUTH_TOKEN,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    // Update event_registrations with pending payment and new package price
    const updateQuery = `
      UPDATE event_registrations
      SET payment_id = ?, payment_status = 'PENDING', amount = ?, currency = 'INR'
      WHERE id = ?
    `;
    await query(updateQuery, [response.data.payment_request.id, newPackage.price, registration_id]);

    res.json({
      payment_request: {
        id: response.data.payment_request.id,
        url: response.data.payment_request.longurl,
      },
    });
  } catch (error) {
    console.error("Error creating Instamojo upgrade payment request:", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to create payment request" });
  }
});

// Webhook for package upgrade
app.post("/api/upgrade-webhook", async (req, res) => {
  try {
    const {
      amount,
      buyer,
      buyer_name,
      buyer_phone,
      currency,
      fees,
      payment_id,
      payment_request_id,
      status,
      purpose,
    } = req.body;

    console.log("Upgrade webhook received:", req.body);

    // Map Instamojo status to payment_status ENUM
    const paymentStatus = status === "Credit" ? "SUCCESS" : "FAIL";

    // Fetch registration
    const registrationQuery = `
      SELECT package_ids
      FROM event_registrations
      WHERE payment_id = ?
    `;
    const registrationResult = await query(registrationQuery, [payment_request_id]);
    if (!registrationResult.length) {
      console.warn(`No registration found for payment_request_id: ${payment_request_id}`);
      return res.status(404).send("Registration not found");
    }

    // Update event_registrations
    if (paymentStatus === "SUCCESS") {
      // Extract package_id from purpose (e.g., "Upgrade to Package: Residential Single")
      const packageName = purpose.replace("Upgrade to Package: ", "");
      const packageQuery = `
        SELECT id, price
        FROM packages
        WHERE name = ? AND type = 'MAIN' AND active = 1
      `;
      const packageResult = await query(packageQuery, [packageName]);
      if (!packageResult.length) {
        console.error(`Package not found for name: ${packageName}`);
        return res.status(404).send("Package not found");
      }
      const newPackageId = packageResult[0].id;
      const packagePrice = packageResult[0].price;

      // Fetch current package_ids and preserve non-MAIN packages
      let currentPackageIds = registrationResult[0].package_ids
      // try {
      //   currentPackageIds = JSON.parse(registrationResult[0].package_ids || '[]');
      //   if (!Array.isArray(currentPackageIds)) {
      //     console.warn(`Invalid package_ids format for payment_request_id ${payment_request_id}: not an array`);
      //     currentPackageIds = [];
      //   }
      // } catch (error) {
      //   console.warn(`Error parsing package_ids for payment_request_id ${payment_request_id}:`, error.message);
      //   currentPackageIds = [];
      // }

      // Fetch package types to identify non-MAIN packages
      const packageTypeQuery = `
        SELECT id, type
        FROM packages
        WHERE id IN (?)
      `;
      const packageTypesResult = await query(packageTypeQuery, [currentPackageIds]);
      const nonMainPackageIds = packageTypesResult
        .filter(pkg => pkg.type !== 'MAIN')
        .map(pkg => pkg.id);

      // Combine non-MAIN package IDs with the new MAIN package ID
      const updatedPackageIds = [...nonMainPackageIds, newPackageId];

      // Update package_ids (preserve non-MAIN, add new MAIN package_id)
      const updateQuery = `
        UPDATE event_registrations
        SET package_ids = ?,
            payment_status = ?,
            payment_id = ?,
            amount = ?,
            currency = ?,
            fees = ?,
            payment_date = NOW()
        WHERE payment_id = ?
      `;
      await query(updateQuery, [
        JSON.stringify(updatedPackageIds),
        paymentStatus,
        payment_id,
        packagePrice,
        currency,
        fees,
        payment_request_id,
      ]);
    } else {
      // Update only payment status for failed payments
      const updateQuery = `
        UPDATE event_registrations
        SET payment_status = ?,
            payment_id = ?,
            payment_date = NOW()
        WHERE payment_id = ?
      `;
      await query(updateQuery, [paymentStatus, payment_id, payment_request_id]);
    }

    res.status(200).send("Webhook received");
  } catch (error) {
    console.error("Error processing upgrade webhook:", error);
    res.status(500).send("Error processing webhook");
  }
});


// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

