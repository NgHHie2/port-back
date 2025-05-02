const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");
const { Resend } = require("resend");
const { sql, testConnection, initDB } = require("./config/db");

require("dotenv").config();

const app = express();
const resend = new Resend(process.env.API_MAIL);

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

// Function to send property notification emails
async function sendPropertyNotificationEmails(propertyId) {
  try {
    console.log(`Processing property ID: ${propertyId}`);

    // Get property information
    const [property] =
      await sql`SELECT * FROM properties WHERE id = ${propertyId}`;

    if (!property) {
      console.log(`Property not found with ID: ${propertyId}`);
      return;
    }

    // Get email subscribers
    const subscribers = await sql`SELECT * FROM emails`;

    if (subscribers.length === 0) {
      console.log("No email subscribers found");
      return;
    }

    console.log(`Preparing to send email to ${subscribers.length} subscribers`);

    let successCount = 0;
    let failCount = 0;

    // Process subscribers sequentially with a small delay between each
    for (const subscriber of subscribers) {
      // Send email with retry functionality
      await sendSinglePropertyEmail(subscriber, property).then((success) => {
        if (success) {
          successCount++;
          console.log(
            `Successfully sent email to ${subscriber.email} (${successCount + failCount}/${subscribers.length})`
          );
        } else {
          failCount++;
          console.error(
            `Failed to send email to ${subscriber.email} after all retry attempts`
          );
        }
      });

      // Add a small delay between emails to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    console.log(
      `Email sending process completed: Success: ${successCount}, Failed: ${failCount}`
    );
    return true;
  } catch (error) {
    console.error(
      `Error in sending property notification emails: ${error.message}`
    );
    return false;
  }
}

// Helper function to send a single property email with retry mechanism
async function sendSinglePropertyEmail(subscriber, property) {
  const maxAttempts = 3;
  let attemptCount = 0;

  // Create email content for a single recipient
  const mailOptions = {
    from: `"Hòa Nguyễn BĐS" <${process.env.EMAIL_USER}>`,
    to: subscriber.email,
    subject: `Dự án mới: ${property.name}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #0053a6;">Dự án mới vừa được cập nhật</h2>
        <p>Liên hệ để nhận thông tin chi tiết: <strong>0946 314286</strong></p>
        <div style="border: 1px solid #ddd; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
          <h3 style="color: #ff6b35; margin-top: 0;">${property.name}</h3>
          <p><strong>Chi tiết:</strong> ${property.address}</p>
          <p><strong>Giá:</strong> ${property.price}</p>
          ${
            property.image_url
              ? `<img src="${property.image_url}" alt="${property.name}" style="max-width: 100%; height: auto; margin: 10px 0;">`
              : ""
          }
        </div>
        <p>Truy cập <a href="https://hoabds.online">hoabds.online</a> để xem nhiều dự án khác.</p>

        <p style="font-size: 12px; color: #666; margin-top: 30px;">Email này được gửi tự động. Vui lòng không trả lời.</p>
      </div>
    `,
  };

  // Try sending the email multiple times with backoff
  while (attemptCount < maxAttempts) {
    attemptCount++;

    try {
      const { data, error } = await resend.emails.send({
        from: mailOptions.from,
        to: mailOptions.to,
        subject: mailOptions.subject,
        html: mailOptions.html,
      });

      if (error) {
        throw new Error(`Error from Resend API: ${JSON.stringify(error)}`);
      }

      // If successful, return true
      return true;
    } catch (error) {
      if (attemptCount >= maxAttempts) {
        console.error(
          `Failed to send email to ${subscriber.email} after ${maxAttempts} attempts: ${error.message}`
        );
        return false;
      } else {
        console.log(
          `Attempt ${attemptCount}/${maxAttempts} failed for ${subscriber.email}: ${error.message}. Retrying...`
        );

        // Exponential backoff between retries (1s, 2s, 4s, etc.)
        const backoffTime = 1000 * Math.pow(2, attemptCount - 1);
        await new Promise((resolve) => setTimeout(resolve, backoffTime));
      }
    }
  }

  return false;
}

// Function to send contact notification email
async function sendContactNotification(contactData) {
  try {
    console.log(
      `Starting to send contact notification from: ${contactData.email}`
    );

    // Create email content
    const mailOptions = {
      from: `"Hòa Nguyễn BĐS" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_RECEIVER,
      subject: "Có người liên hệ từ website",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #0053a6;">Tin nhắn</h2>
          <div style="border: 1px solid #ddd; padding: 15px; border-radius: 5px;">
            <p><strong>Email:</strong> ${contactData.email}</p>
            ${
              contactData.name
                ? `<p><strong>Tên:</strong> ${contactData.name}</p>`
                : ""
            }
            ${
              contactData.phone
                ? `<p><strong>SĐT:</strong> ${contactData.phone}</p>`
                : ""
            }
            ${
              contactData.message
                ? `<p><strong>Tin nhắn:</strong> ${contactData.message}</p>`
                : ""
            }
          </div>
          <p style="font-size: 12px; color: #666; margin-top: 30px;">Email này được gửi tự động từ form liên hệ trên website.</p>
        </div>
      `,
    };

    // Implement retry mechanism
    const maxAttempts = 3;
    let attemptCount = 0;

    // Try sending the email multiple times with backoff
    while (attemptCount < maxAttempts) {
      attemptCount++;

      try {
        console.log(`Contact email attempt ${attemptCount}/${maxAttempts}`);

        const { data, error } = await resend.emails.send({
          from: mailOptions.from,
          to: mailOptions.to,
          subject: mailOptions.subject,
          html: mailOptions.html,
        });

        if (error) {
          throw new Error(`Error from Resend API: ${JSON.stringify(error)}`);
        }

        console.log(
          `Contact notification email sent successfully on attempt ${attemptCount}`
        );
        return true;
      } catch (error) {
        if (attemptCount >= maxAttempts) {
          console.error(
            `Failed to send contact notification email after ${maxAttempts} attempts. Last error: ${error.message}`
          );
          return false;
        } else {
          console.log(
            `Attempt ${attemptCount}/${maxAttempts} failed: ${error.message}. Retrying...`
          );

          // Exponential backoff between retries (1s, 2s, 4s, etc.)
          const backoffTime = 1000 * Math.pow(2, attemptCount - 1);
          await new Promise((resolve) => setTimeout(resolve, backoffTime));
        }
      }
    }

    return false;
  } catch (error) {
    console.error(
      `Error preparing contact notification email: ${error.message}`
    );
    return false;
  }
}

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

// API for properties
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

    // Trả về response thành công ngay lập tức
    res.status(201).json(newProperty);

    // Sau đó mới bắt đầu gửi email trong nền
    // Process sẽ tiếp tục chạy sau khi response đã được gửi
    sendPropertyNotificationEmails(newProperty.id)
      .then((result) => {
        console.log(
          `Email notification process initialized: ${result ? "Successfully" : "Failed"}`
        );
      })
      .catch((error) => {
        console.error(
          `Unexpected error in email notification process: ${error.message}`
        );
      });
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

    // Trả về kết quả thành công ngay lập tức
    res.status(200).json({ message: "Gửi tin nhắn thành công!!" });

    // Sau đó mới bắt đầu gửi email thông báo trong nền
    sendContactNotification({ email, name, phone, message })
      .then((success) => {
        console.log(
          `Contact email sending process: ${success ? "Successful" : "Failed"}`
        );
      })
      .catch((error) => {
        console.error(
          `Unexpected error in contact notification process: ${error.message}`
        );
      });
  } catch (error) {
    console.error("Error sending contact info:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Serve admin page
app.get("/admin-hoabds", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

// Default route
app.get("/", (req, res) => {
  res.send("API server is running.");
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
