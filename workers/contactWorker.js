const { workerData, parentPort } = require("worker_threads");
const nodemailer = require("nodemailer");
require("dotenv").config();
const { Resend } = require("resend");

// Get data from main thread
const { contactData, emailConfig } = workerData;

const resend = new Resend(process.env.API_MAIL);

// Main function to send contact notification
async function sendContactNotification() {
  try {
    parentPort.postMessage(
      `Starting to send contact notification from: ${contactData.email}`
    );

    // Create email content
    const mailOptions = {
      from: `"Hòa Nguyễn BĐS" <${emailConfig.user}>`,
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

    // Implement retry mechanism
    let emailSent = false;
    let attemptCount = 0;
    const maxAttempts = 3; // Số lần thử lại tối đa
    let lastError = null;

    // Tiếp tục thử cho đến khi email được gửi thành công hoặc đạt đến số lần thử lại tối đa
    while (!emailSent && attemptCount < maxAttempts) {
      attemptCount++;

      try {
        parentPort.postMessage(
          `Attempt ${attemptCount}/${maxAttempts} to send contact notification`
        );

        // Send email
        const { data, error } = await resend.emails.send({
          from: mailOptions.from,
          to: mailOptions.to,
          subject: mailOptions.subject,
          html: mailOptions.html,
        });

        if (error) {
          throw new Error(`Error from Resend API: ${JSON.stringify(error)}`);
        }

        // If we get here, email was sent successfully
        emailSent = true;
        parentPort.postMessage(
          `Contact notification email sent successfully on attempt ${attemptCount}`
        );
      } catch (error) {
        lastError = error;

        // Nếu đã thử hết số lần cho phép mà vẫn thất bại
        if (attemptCount >= maxAttempts) {
          parentPort.postMessage(
            `Failed to send contact notification email after ${maxAttempts} attempts. Last error: ${error.message}`
          );
        } else {
          // Thông báo về việc thử lại
          parentPort.postMessage(
            `Attempt ${attemptCount}/${maxAttempts} failed: ${error.message}. Retrying...`
          );

          // Chờ thời gian dài hơn giữa các lần thử lại (tăng theo số lần thử)
          const backoffTime = 1000 * attemptCount; // 1s, 2s, 3s...
          await new Promise((resolve) => setTimeout(resolve, backoffTime));
        }
      }
    }

    // If all attempts failed, throw the last error
    if (!emailSent) {
      throw lastError || new Error("Failed to send email after all attempts");
    }
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
