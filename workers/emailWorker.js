const { workerData, parentPort } = require("worker_threads");
const postgres = require("postgres");
const { Resend } = require("resend");
require("dotenv").config();

// Get data from main thread
const { propertyId, emailConfig, databaseURL } = workerData;

// Create postgres.js client for the worker
const sql = postgres(databaseURL, { ssl: "verify-full" });

const resend = new Resend(process.env.API_MAIL);

// Main function to send property notification emails
async function sendPropertyNotificationEmails() {
  try {
    parentPort.postMessage(`Processing property ID: ${propertyId}`);

    // Test the database connection
    await sql`SELECT 1 as connection_test`;
    parentPort.postMessage("Worker database connection established");

    // Get property information
    const [property] =
      await sql`SELECT * FROM properties WHERE id = ${propertyId}`;

    if (!property) {
      parentPort.postMessage(`Property not found with ID: ${propertyId}`);
      await sql.end();
      return;
    }

    // Get email subscribers
    const subscribers = await sql`SELECT * FROM emails`;

    if (subscribers.length === 0) {
      parentPort.postMessage("No email subscribers found");
      await sql.end();
      return;
    }

    parentPort.postMessage(
      `Preparing to send email to ${subscribers.length} subscribers sequentially`
    );

    let successCount = 0;
    let failCount = 0;

    // Send emails one by one
    for (let i = 0; i < subscribers.length; i++) {
      const subscriber = subscribers[i];
      let emailSent = false;
      let attemptCount = 0;
      const maxAttempts = 3; // Số lần thử lại tối đa

      // Tiếp tục thử cho đến khi email được gửi thành công hoặc đạt đến số lần thử lại tối đa
      while (!emailSent && attemptCount < maxAttempts) {
        attemptCount++;

        try {
          // Create email content for a single recipient
          const mailOptions = {
            from: `"Hòa Nguyễn BĐS" <${emailConfig.user}>`,
            to: subscriber.email, // Send to one recipient
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

          // Send email to a single recipient
          const { data, error } = await resend.emails.send({
            from: mailOptions.from,
            to: mailOptions.to,
            subject: mailOptions.subject,
            html: mailOptions.html,
          });

          if (error) {
            throw new Error(
              `Error sending to ${subscriber.email}: ${error.message}`
            );
          }

          // Success
          emailSent = true;
          successCount++;
          parentPort.postMessage(
            `Successfully sent email to ${subscriber.email} (${i + 1}/${subscribers.length})`
          );
        } catch (error) {
          // Nếu đã thử hết số lần cho phép mà vẫn thất bại
          if (attemptCount >= maxAttempts) {
            failCount++;
            parentPort.postMessage(
              `Failed to send email to ${subscriber.email} after ${maxAttempts} attempts: ${error.message}`
            );
          } else {
            // Thông báo về việc thử lại
            parentPort.postMessage(
              `Attempt ${attemptCount}/${maxAttempts} failed for ${subscriber.email}: ${error.message}. Retrying...`
            );

            // Chờ thời gian dài hơn giữa các lần thử lại (tăng theo số lần thử)
            const backoffTime = 1000 * attemptCount; // 1s, 2s, 3s...
            await new Promise((resolve) => setTimeout(resolve, backoffTime));
          }
        }
      }

      // Thêm độ trễ giữa các người nhận kể cả khi thành công hay thất bại
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    parentPort.postMessage(
      `Email sending complete: Success: ${successCount}, Failed: ${failCount}`
    );
  } catch (error) {
    parentPort.postMessage(`Error in worker: ${error.message}`);
  } finally {
    // Close the database connection
    await sql.end();
    parentPort.postMessage("Worker database connection closed");
  }
}

// Start the email sending process
sendPropertyNotificationEmails().catch((error) => {
  parentPort.postMessage(`Unhandled error: ${error.message}`);
});
