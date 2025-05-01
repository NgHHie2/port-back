const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");
const fs = require("fs");
const { Worker } = require("worker_threads");
const {
  ensureDataDirectoryExists,
  Properties,
  Emails,
} = require("./data/dataHandler");

require("dotenv").config();

const app = express();

// Ensure directories exist
function ensureDirectoriesExist() {
  const directories = [
    path.join(__dirname, "workers"),
    path.join(__dirname, "public"),
    path.join(__dirname, "data"),
  ];

  directories.forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`Created directory: ${dir}`);
    }
  });
}

// Create directories and initialize data files
ensureDirectoriesExist();
ensureDataDirectoryExists();

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
    const worker = new Worker("./workers/emailWorker.js", {
      workerData: {
        propertyId,
        emailConfig: {
          host: process.env.EMAIL_HOST,
          port: process.env.EMAIL_PORT,
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      },
    });

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
        resolve("Worker completed successfully");
      }
    });
  });
};

// Worker for handling contact form submissions
const createContactWorker = (contactData) => {
  return new Promise((resolve, reject) => {
    const worker = new Worker("./workers/contactWorker.js", {
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
    });

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
    const properties = Properties.findAll();
    res.json(properties);
  } catch (error) {
    console.error("Error getting properties list:", error);
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/api/properties/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const property = Properties.findById(id);

    if (!property) {
      return res.status(404).json({ message: "Property not found" });
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
      return res.status(400).json({ message: "Missing required information" });
    }

    const newProperty = Properties.create({
      name,
      address,
      price,
      image_url,
    });

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

    const updatedProperty = Properties.update(id, {
      name,
      address,
      price,
      image_url,
    });

    if (!updatedProperty) {
      return res.status(404).json({ message: "Property not found" });
    }

    res.json(updatedProperty);
  } catch (error) {
    console.error("Error updating property:", error);
    res.status(500).json({ message: "Server error" });
  }
});

app.delete("/api/properties/:id", verifyConfirmCode, async (req, res) => {
  try {
    const { id } = req.params;
    const result = Properties.delete(id);

    if (!result) {
      return res.status(404).json({ message: "Property not found" });
    }

    res.json({ message: "Property deleted successfully" });
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
      return res.status(400).json({ message: "Email is required" });
    }

    const result = Emails.create(email);

    if (!result.created) {
      return res.status(400).json({ message: "Email already subscribed" });
    }

    res.status(201).json({ message: "Subscription successful" });
  } catch (error) {
    console.error("Error subscribing email:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// API for emails list
app.get("/api/emails", async (req, res) => {
  try {
    const emails = Emails.findAll();
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
      return res.status(400).json({ message: "Email is required" });
    }

    // Store email in subscribers if not already present
    Emails.create(email);

    // Create worker thread to send contact notification
    createContactWorker({ email, name, phone, message })
      .then((result) => {
        console.log(`Contact email result: ${result}`);
      })
      .catch((error) => {
        console.error("Error sending contact notification:", error);
      });

    res.status(200).json({ message: "Contact information sent successfully" });
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

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
