const { workerData, parentPort } = require("worker_threads");
const nodemailer = require("nodemailer");

// Lấy dữ liệu từ thread chính
const { contactData, emailConfig } = workerData;

// Hàm chính để gửi email thông báo liên hệ
async function sendContactNotification() {
  try {
    parentPort.postMessage(
      `Bắt đầu gửi email thông báo liên hệ mới từ: ${contactData.email}`
    );

    // Tạo transporter để gửi email
    const transporter = nodemailer.createTransport({
      host: emailConfig.host,
      port: emailConfig.port,
      secure: false,
      auth: {
        user: emailConfig.user,
        pass: emailConfig.pass,
      },
    });

    // Tạo nội dung email
    const mailOptions = {
      from: `"Website BĐS" <${emailConfig.user}>`,
      to: emailConfig.receiver,
      subject: "Có người liên hệ từ website",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #0053a6;">Thông tin liên hệ mới</h2>
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

    // Gửi email
    await transporter.sendMail(mailOptions);
    parentPort.postMessage("Đã gửi email thông báo liên hệ thành công");
  } catch (error) {
    parentPort.postMessage(
      `Lỗi khi gửi email thông báo liên hệ: ${error.message}`
    );
    throw error;
  }
}

// Bắt đầu quy trình gửi email
sendContactNotification().catch((error) => {
  parentPort.postMessage(`Lỗi không xử lý được: ${error.message}`);
});
