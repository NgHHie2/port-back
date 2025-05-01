const { workerData, parentPort } = require("worker_threads");
const mysql = require("mysql2/promise");
const nodemailer = require("nodemailer");

// Lấy dữ liệu từ thread chính
const { propertyId, dbConfig, emailConfig } = workerData;

// Hàm chính để gửi email
async function sendPropertyNotificationEmails() {
  let connection;

  try {
    // Kết nối đến database
    connection = await mysql.createConnection({
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      password: dbConfig.password,
      database: dbConfig.database,
    });

    parentPort.postMessage(
      `Đã kết nối database để xử lý property ID: ${propertyId}`
    );

    // Lấy thông tin dự án
    const [propertyRows] = await connection.execute(
      "SELECT * FROM properties WHERE id = ?",
      [propertyId]
    );

    if (propertyRows.length === 0) {
      parentPort.postMessage(`Không tìm thấy dự án với ID: ${propertyId}`);
      return;
    }

    const property = propertyRows[0];

    // Lấy danh sách email đăng ký
    const [emailRows] = await connection.execute("SELECT email FROM emails");

    if (emailRows.length === 0) {
      parentPort.postMessage("Không có email nào đăng ký nhận tin");
      return;
    }

    parentPort.postMessage(
      `Chuẩn bị gửi email cho ${emailRows.length} người đăng ký`
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

    // Phân chia email thành các nhóm nhỏ để gửi
    const chunkSize = 50; // Mỗi lần gửi tối đa 50 email
    let successCount = 0;
    let failCount = 0;

    // Chia emails thành các nhóm nhỏ
    for (let i = 0; i < emailRows.length; i += chunkSize) {
      const chunk = emailRows.slice(i, i + chunkSize);
      const emails = chunk.map((row) => row.email).join(",");

      try {
        // Tạo nội dung email
        const mailOptions = {
          from: `"Hòa Nguyễn BĐS" <${emailConfig.user}>`,
          bcc: emails, // Sử dụng BCC để ẩn danh sách email người nhận
          subject: `Dự án mới: ${property.name}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #0053a6;">Dự án mới vừa được cập nhật</h2>
              <p>Liên hệ để nhận thông tin chi tiết: <strong>0946 314286</strong></p>
              <div style="border: 1px solid #ddd; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
                <h3 style="color: #ff6b35; margin-top: 0;">${property.name}</h3>
                <p><strong>Địa chỉ:</strong> ${property.address}</p>
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

        // Gửi email
        await transporter.sendMail(mailOptions);
        successCount += chunk.length;

        parentPort.postMessage(
          `Đã gửi email cho nhóm ${Math.ceil(i / chunkSize) + 1}/${Math.ceil(
            emailRows.length / chunkSize
          )}`
        );

        // Chờ một chút giữa các lần gửi để tránh quá tải
        if (i + chunkSize < emailRows.length) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      } catch (error) {
        failCount += chunk.length;
        parentPort.postMessage(
          `Lỗi khi gửi email cho nhóm ${Math.ceil(i / chunkSize) + 1}: ${
            error.message
          }`
        );
      }
    }

    parentPort.postMessage(
      `Hoàn thành gửi email: Thành công: ${successCount}, Thất bại: ${failCount}`
    );
  } catch (error) {
    parentPort.postMessage(`Lỗi trong worker: ${error.message}`);
  } finally {
    // Đóng kết nối database
    if (connection) {
      await connection.end();
    }
  }
}

// Bắt đầu quy trình gửi email
sendPropertyNotificationEmails().catch((error) => {
  parentPort.postMessage(`Lỗi không xử lý được: ${error.message}`);
});
