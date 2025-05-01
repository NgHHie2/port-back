const { workerData, parentPort } = require("worker_threads");
const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");

// Get data from main thread
const { propertyId, emailConfig } = workerData;

// Define paths for data files
const DATA_DIR = path.join(__dirname, "..", "data");
const PROPERTIES_FILE = path.join(DATA_DIR, "properties.json");
const EMAILS_FILE = path.join(DATA_DIR, "emails.json");

// Read data from file
function readData(filePath) {
  try {
    const data = fs.readFileSync(filePath, "utf8");
    return JSON.parse(data);
  } catch (error) {
    parentPort.postMessage(
      `Error reading data from ${filePath}: ${error.message}`
    );
    throw error;
  }
}

// Main function to send property notification emails
async function sendPropertyNotificationEmails() {
  try {
    parentPort.postMessage(`Processing property ID: ${propertyId}`);

    // Get property information
    const propertiesData = readData(PROPERTIES_FILE);
    const property = propertiesData.properties.find(
      (p) => p.id === parseInt(propertyId)
    );

    if (!property) {
      parentPort.postMessage(`Property not found with ID: ${propertyId}`);
      return;
    }

    // Get email subscribers
    const emailsData = readData(EMAILS_FILE);
    const subscribers = emailsData.emails;

    if (subscribers.length === 0) {
      parentPort.postMessage("No email subscribers found");
      return;
    }

    parentPort.postMessage(
      `Preparing to send email to ${subscribers.length} subscribers`
    );

    // Create transporter for sending emails
    const transporter = nodemailer.createTransport({
      host: emailConfig.host,
      port: emailConfig.port,
      secure: false,
      auth: {
        user: emailConfig.user,
        pass: emailConfig.pass,
      },
    });

    // Split emails into small groups for sending
    const chunkSize = 50; // Send max 50 emails at once
    let successCount = 0;
    let failCount = 0;

    // Split emails into groups
    for (let i = 0; i < subscribers.length; i += chunkSize) {
      const chunk = subscribers.slice(i, i + chunkSize);
      const emails = chunk.map((sub) => sub.email).join(",");

      try {
        // Create email content
        const mailOptions = {
          from: `"Hòa Nguyễn BĐS" <${emailConfig.user}>`,
          bcc: emails, // Use BCC to hide recipient list
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
              <p style="font-size: 12px; color: #666; margin-top: 30px;">Email này được gửi tự động. Vui lòng không trả lời.</p>
            </div>
          `,
        };

        // Send email
        await transporter.sendMail(mailOptions);
        successCount += chunk.length;

        parentPort.postMessage(
          `Sent email to group ${Math.ceil(i / chunkSize) + 1}/${Math.ceil(
            subscribers.length / chunkSize
          )}`
        );

        // Wait a bit between sends to avoid overloading
        if (i + chunkSize < subscribers.length) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      } catch (error) {
        failCount += chunk.length;
        parentPort.postMessage(
          `Error sending email to group ${Math.ceil(i / chunkSize) + 1}: ${
            error.message
          }`
        );
      }
    }

    parentPort.postMessage(
      `Email sending complete: Success: ${successCount}, Failed: ${failCount}`
    );
  } catch (error) {
    parentPort.postMessage(`Error in worker: ${error.message}`);
  }
}

// Start the email sending process
sendPropertyNotificationEmails().catch((error) => {
  parentPort.postMessage(`Unhandled error: ${error.message}`);
});
