const nodemailer = require("nodemailer");
require("dotenv").config();

// Tạo transporter cho việc gửi email
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/**
 * Gửi email thông báo khi có dự án mới
 * @param {Object} property - Thông tin dự án
 * @param {Array} subscribers - Danh sách người đăng ký nhận tin
 */
const sendNewPropertyNotification = async (property, subscribers) => {
  try {
    if (!subscribers || subscribers.length === 0) {
      console.log("Không có người đăng ký nhận tin");
      return;
    }

    // Phân chia danh sách email thành các nhóm nhỏ (mỗi nhóm 50 emails)
    // để tránh gửi quá nhiều cùng lúc
    const chunkSize = 50;
    const emailChunks = [];

    for (let i = 0; i < subscribers.length; i += chunkSize) {
      emailChunks.push(subscribers.slice(i, i + chunkSize));
    }

    console.log(`Chia thành ${emailChunks.length} nhóm email để gửi`);

    // Gửi email cho từng nhóm
    for (let i = 0; i < emailChunks.length; i++) {
      const chunk = emailChunks[i];
      const emails = chunk.map((sub) => sub.email).join(",");

      const mailOptions = {
        from: `"Hòa Nguyễn BĐS" <${process.env.EMAIL_USER}>`,
        bcc: emails, // Sử dụng BCC để ẩn danh sách email người nhận
        subject: `Dự án mới: ${property.name}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #0053a6;">Dự án mới vừa được cập nhật</h2>
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
            <p>Liên hệ ngay để nhận thông tin chi tiết: <strong>0946 314286</strong></p>
            <p style="font-size: 12px; color: #666; margin-top: 30px;">Email này được gửi tự động. Vui lòng không trả lời.</p>
          </div>
        `,
      };

      await transporter.sendMail(mailOptions);
      console.log(
        `Đã gửi email thông báo dự án mới cho nhóm ${i + 1}/${
          emailChunks.length
        }`
      );

      // Đợi 2 giây giữa các lần gửi để tránh quá tải
      if (i < emailChunks.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    console.log("Hoàn tất gửi email thông báo dự án mới");
  } catch (error) {
    console.error("Lỗi khi gửi email thông báo:", error);
    throw error; // Ném lỗi để xử lý ở lớp gọi
  }
};

/**
 * Gửi email thông báo khi có người liên hệ
 * @param {Object} contactData - Thông tin người liên hệ
 */
const sendContactNotification = async (contactData) => {
  try {
    const mailOptions = {
      from: `"Website BĐS" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_RECEIVER,
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
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log("Email thông báo liên hệ mới đã được gửi");
    return true;
  } catch (error) {
    console.error("Lỗi khi gửi email thông báo liên hệ:", error);
    throw error; // Ném lỗi để xử lý ở lớp gọi
  }
};

module.exports = {
  sendNewPropertyNotification,
  sendContactNotification,
};
