const { workerData, parentPort } = require("worker_threads");
const nodemailer = require("nodemailer");
require("dotenv").config();

// Get data from main thread
const { contactData, emailConfig } = workerData;

// Main function to send contact notification
async function sendContactNotification() {
  try {
    parentPort.postMessage(
      `Starting to send contact notification from: ${contactData.email}`
    );

    // Create email transporter
    const transporter = nodemailer.createTransport({
      host: emailConfig.host,
      port: emailConfig.port,
      secure: false,
      auth: {
        user: emailConfig.user,
        pass: emailConfig.pass,
      },
    });

    // Create email content
    const mailOptions = {
      from: `"Real Estate Website" <${emailConfig.user}>`,
      to: emailConfig.receiver,
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

    // Send email
    await transporter.sendMail(mailOptions);
    parentPort.postMessage("Contact notification email sent successfully");
  } catch (error) {
    parentPort.postMessage(
      `Error sending contact notification email: ${error.message}`
    );
    throw error;
  }
}

// Start the email sending process
sendContactNotification().catch((error) => {
  parentPort.postMessage(`Unhandled error: ${error.message}`);
});
