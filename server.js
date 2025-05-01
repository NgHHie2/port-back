const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");
const { Worker } = require("worker_threads");
const { sql, testConnection, initDB } = require("./config/db");

require("dotenv").config();

const app = express();

// Middleware
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// Create worker for sending email notifications
const createEmailWorker = (propertyId) => {
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      path.join(__dirname, "workers", "emailWorker.js"),
      {
        workerData: {
          propertyId,
          emailConfig: {
            host: process.env.EMAIL_HOST,
            port: process.env.EMAIL_PORT,
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
          },
          databaseURL: process.env.DATABASE_URL,
        },
      }
    );

    worker.on("message", (message) => {
      console.log(`Worker message: ${message}`);
      resolve(message);
    });

    worker.on("error", (error) => {
      console.error("Worker error:", error);
      reject(error);
    });

    worker.on("exit", (code) => {
      if (code !== 0) {
        reject(new Error(`Worker stopped with exit code ${code}`));
      } else {
        resolve("Gửi mail thành công");
      }
    });
  });
};

// Worker for handling contact form submissions
const createContactWorker = (contactData) => {
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      path.join(__dirname, "workers", "contactWorker.js"),
      {
        workerData: {
          contactData,
          emailConfig: {
            host: process.env.EMAIL_HOST,
            port: process.env.EMAIL_PORT,
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
            receiver: process.env.EMAIL_RECEIVER,
          },
        },
      }
    );
    console.log(
      "Đường dẫn emailWorker.js:",
      path.join(__dirname, "workers", "emailWorker.js")
    );

    worker.on("message", (message) => {
      console.log(`Contact worker message: ${message}`);
      resolve(message);
    });

    worker.on("error", (error) => {
      console.error("Contact worker error:", error);
      reject(error);
    });

    worker.on("exit", (code) => {
      if (code !== 0) {
        reject(new Error(`Contact worker stopped with exit code ${code}`));
      } else {
        resolve("Contact worker completed successfully");
      }
    });
  });
};

// Middleware to verify admin confirmation code
const verifyConfirmCode = (req, res, next) => {
  const { confirmCode } = req.body;

  if (!confirmCode) {
    return res.status(400).json({ message: "Thiếu mã xác nhận" });
  }

  if (confirmCode !== process.env.ADMIN_CONFIRM_CODE) {
    return res.status(403).json({ message: "Mã xác nhận không đúng" });
  }

  next();
};

// Routes API for properties
app.get("/api/properties", async (req, res) => {
  try {
    const properties =
      await sql`SELECT * FROM properties ORDER BY created_at DESC`;
    res.json(properties);
  } catch (error) {
    console.error("Error getting properties list:", error);
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/api/properties/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const [property] = await sql`SELECT * FROM properties WHERE id = ${id}`;

    if (!property) {
      return res.status(404).json({ message: "Không tìm thấy dự án" });
    }

    res.json(property);
  } catch (error) {
    console.error("Error getting property info:", error);
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/api/properties", verifyConfirmCode, async (req, res) => {
  try {
    const { name, address, price, image_url } = req.body;

    if (!name || !address || !price) {
      return res.status(400).json({ message: "Thiếu thông tin" });
    }

    const [newProperty] = await sql`
      INSERT INTO properties (name, address, price, image_url, created_at, updated_at)
      VALUES (${name}, ${address}, ${price}, ${image_url}, NOW(), NOW())
      RETURNING *
    `;

    // Create worker thread to send notification emails
    // Won't block the main API thread
    createEmailWorker(newProperty.id)
      .then((result) => {
        console.log(`Email sending result: ${result}`);
      })
      .catch((error) => {
        console.error("Error sending notification email:", error);
      });

    res.status(201).json(newProperty);
  } catch (error) {
    console.error("Error adding property:", error);
    res.status(500).json({ message: "Server error" });
  }
});

app.put("/api/properties/:id", verifyConfirmCode, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, address, price, image_url } = req.body;

    // Check if property exists
    const [property] = await sql`SELECT * FROM properties WHERE id = ${id}`;

    if (!property) {
      return res.status(404).json({ message: "Dự án không tồn tại" });
    }

    // Update the property
    const [updatedProperty] = await sql`
      UPDATE properties 
      SET name = ${name}, 
          address = ${address}, 
          price = ${price}, 
          image_url = ${image_url}, 
          updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    res.json(updatedProperty);
  } catch (error) {
    console.error("Error updating property:", error);
    res.status(500).json({ message: "Server error" });
  }
});

app.delete("/api/properties/:id", verifyConfirmCode, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if property exists
    const [property] = await sql`SELECT * FROM properties WHERE id = ${id}`;

    if (!property) {
      return res.status(404).json({ message: "Dự án không tồn tại" });
    }

    // Delete the property
    await sql`DELETE FROM properties WHERE id = ${id}`;

    res.json({ message: "Xóa thành công" });
  } catch (error) {
    console.error("Error deleting property:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// API for email subscriptions
app.post("/api/subscribe", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email được yêu cầu" });
    }

    // Check if email already exists
    const existingEmail =
      await sql`SELECT * FROM emails WHERE email = ${email}`;

    if (existingEmail.length > 0) {
      return res.status(400).json({ message: "Email này đã từng đăng ký" });
    }

    // Create new email subscriber
    await sql`INSERT INTO emails (email, created_at) VALUES (${email}, NOW())`;

    res.status(201).json({ message: "Đăng ký thành công!! Cảm ơn bạn." });
  } catch (error) {
    console.error("Error subscribing email:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// API for emails list
app.get("/api/emails", async (req, res) => {
  try {
    const emails = await sql`SELECT * FROM emails ORDER BY created_at DESC`;
    res.json(emails);
  } catch (error) {
    console.error("Error getting emails list:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// API for contact form
app.post("/api/contact", async (req, res) => {
  try {
    const { email, name, phone, message } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email được yêu cầu" });
    }

    // Store email in subscribers if not already present
    const existingEmail =
      await sql`SELECT * FROM emails WHERE email = ${email}`;

    if (existingEmail.length === 0) {
      await sql`INSERT INTO emails (email, created_at) VALUES (${email}, NOW())`;
    }

    // Create worker thread to send contact notification
    createContactWorker({ email, name, phone, message })
      .then((result) => {
        console.log(`Contact email result: ${result}`);
      })
      .catch((error) => {
        console.error("Error sending contact notification:", error);
      });

    res.status(200).json({ message: "Gửi tin nhắn thành công!!" });
  } catch (error) {
    console.error("Error sending contact info:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Serve admin page
app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

// Default route
app.get("/", (req, res) => {
  res.send("API server is running. Access /admin to manage properties.");
});

// Initialize database and start server
async function startServer() {
  try {
    // Test database connection
    const connected = await testConnection();

    if (!connected) {
      console.error("Failed to connect to database. Server will not start.");
      process.exit(1);
    }

    // Initialize the database (create tables if they don't exist)
    await initDB();

    // Start the server
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Error starting server:", error);
    process.exit(1);
  }
}

// Start the application
startServer();
