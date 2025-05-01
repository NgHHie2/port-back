const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");
const fs = require("fs");
const { Worker } = require("worker_threads");
const { connectDB, sequelize } = require("./config/db");
const Property = require("./models/Property");
const Email = require("./models/Email");

require("dotenv").config();

const app = express();

// Đảm bảo các thư mục cần thiết tồn tại
function ensureDirectoriesExist() {
  const directories = [
    path.join(__dirname, "workers"),
    path.join(__dirname, "public"),
  ];

  directories.forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`Đã tạo thư mục: ${dir}`);
    }
  });
}

// Tạo thư mục
ensureDirectoriesExist();

// Middleware
app.use(
  cors({
    origin: "*", // Cho phép tất cả các origin (sửa lại nếu cần)
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// Kết nối database
connectDB();

// Khởi tạo worker để xử lý email thông báo dự án mới trong thread riêng biệt
const createEmailWorker = (propertyId) => {
  return new Promise((resolve, reject) => {
    // Tạo một worker mới từ file emailWorker.js
    const worker = new Worker("./workers/emailWorker.js", {
      workerData: {
        propertyId,
        dbConfig: {
          host: process.env.DB_HOST,
          port: process.env.DB_PORT,
          user: process.env.DB_USER,
          password: process.env.DB_PASSWORD,
          database: process.env.DB_NAME,
        },
        emailConfig: {
          host: process.env.EMAIL_HOST,
          port: process.env.EMAIL_PORT,
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      },
    });

    // Lắng nghe kết quả từ worker
    worker.on("message", (message) => {
      console.log(`Worker message: ${message}`);
      resolve(message);
    });

    // Xử lý lỗi từ worker
    worker.on("error", (error) => {
      console.error("Worker error:", error);
      reject(error);
    });

    // Xử lý khi worker hoàn thành
    worker.on("exit", (code) => {
      if (code !== 0) {
        reject(new Error(`Worker stopped with exit code ${code}`));
      } else {
        resolve("Worker completed successfully");
      }
    });
  });
};

// Worker để gửi email liên hệ
const createContactWorker = (contactData) => {
  return new Promise((resolve, reject) => {
    // Tạo một worker mới từ file contactWorker.js
    const worker = new Worker("./workers/contactWorker.js", {
      workerData: {
        contactData,
        dbConfig: {
          host: process.env.DB_HOST,
          port: process.env.DB_PORT,
          user: process.env.DB_USER,
          password: process.env.DB_PASSWORD,
          database: process.env.DB_NAME,
        },
        emailConfig: {
          host: process.env.EMAIL_HOST,
          port: process.env.EMAIL_PORT,
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
          receiver: process.env.EMAIL_RECEIVER,
        },
      },
    });

    // Lắng nghe kết quả từ worker
    worker.on("message", (message) => {
      console.log(`Contact worker message: ${message}`);
      resolve(message);
    });

    // Xử lý lỗi từ worker
    worker.on("error", (error) => {
      console.error("Contact worker error:", error);
      reject(error);
    });

    // Xử lý khi worker hoàn thành
    worker.on("exit", (code) => {
      if (code !== 0) {
        reject(new Error(`Contact worker stopped with exit code ${code}`));
      } else {
        resolve("Contact worker completed successfully");
      }
    });
  });
};

// Middleware kiểm tra mã xác nhận
const verifyConfirmCode = (req, res, next) => {
  const { confirmCode } = req.body;

  if (!confirmCode) {
    return res.status(400).json({ message: "Thiếu mã xác nhận" });
  }

  if (confirmCode !== process.env.ADMIN_CONFIRM_CODE) {
    return res.status(403).json({ message: "Mã xác nhận không đúng" });
  }

  // Mã xác nhận đúng, tiếp tục xử lý
  next();
};

// Routes API cho properties
app.get("/api/properties", async (req, res) => {
  try {
    const properties = await Property.findAll({
      order: [["created_at", "DESC"]], // Sắp xếp theo thời gian tạo, mới nhất lên đầu
    });
    res.json(properties);
  } catch (error) {
    console.error("Lỗi khi lấy danh sách bất động sản:", error);
    res.status(500).json({ message: "Lỗi server" });
  }
});

app.get("/api/properties/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const property = await Property.findByPk(id);

    if (!property) {
      return res.status(404).json({ message: "Không tìm thấy bất động sản" });
    }

    res.json(property);
  } catch (error) {
    console.error("Lỗi khi lấy thông tin bất động sản:", error);
    res.status(500).json({ message: "Lỗi server" });
  }
});

app.post("/api/properties", verifyConfirmCode, async (req, res) => {
  try {
    const { name, address, price, image_url } = req.body;

    if (!name || !address || !price) {
      return res.status(400).json({ message: "Thiếu thông tin bắt buộc" });
    }

    const newProperty = await Property.create({
      name,
      address,
      price,
      image_url,
    });

    // Tạo worker thread mới để xử lý việc gửi email
    // Không chặn luồng chính API
    createEmailWorker(newProperty.id)
      .then((result) => {
        console.log(`Kết quả gửi email: ${result}`);
      })
      .catch((error) => {
        console.error("Lỗi khi gửi email thông báo:", error);
      });

    res.status(201).json(newProperty);
  } catch (error) {
    console.error("Lỗi khi thêm bất động sản:", error);
    res.status(500).json({ message: "Lỗi server" });
  }
});

app.put("/api/properties/:id", verifyConfirmCode, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, address, price, image_url } = req.body;

    const property = await Property.findByPk(id);

    if (!property) {
      return res.status(404).json({ message: "Không tìm thấy bất động sản" });
    }

    await property.update({
      name: name || property.name,
      address: address || property.address,
      price: price || property.price,
      image_url: image_url || property.image_url,
    });

    res.json(property);
  } catch (error) {
    console.error("Lỗi khi cập nhật bất động sản:", error);
    res.status(500).json({ message: "Lỗi server" });
  }
});

app.delete("/api/properties/:id", verifyConfirmCode, async (req, res) => {
  try {
    const { id } = req.params;

    const property = await Property.findByPk(id);

    if (!property) {
      return res.status(404).json({ message: "Không tìm thấy bất động sản" });
    }

    await property.destroy();

    res.json({ message: "Xóa bất động sản thành công" });
  } catch (error) {
    console.error("Lỗi khi xóa bất động sản:", error);
    res.status(500).json({ message: "Lỗi server" });
  }
});

// API cho email đăng ký
app.post("/api/subscribe", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email là bắt buộc" });
    }

    // Kiểm tra email đã tồn tại chưa và tạo mới nếu chưa có
    const [newEmail, created] = await Email.findOrCreate({
      where: { email },
      defaults: { email },
    });

    if (!created) {
      return res.status(400).json({ message: "Email đã đăng ký" });
    }

    res.status(201).json({ message: "Đăng ký nhận tin thành công" });
  } catch (error) {
    console.error("Lỗi khi đăng ký email:", error);
    res.status(500).json({ message: "Lỗi server" });
  }
});

// API cho form liên hệ
app.post("/api/contact", async (req, res) => {
  try {
    const { email, name, phone, message } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email là bắt buộc" });
    }

    // Lưu email vào database (nếu chưa có)
    await Email.findOrCreate({ where: { email } });

    // Tạo worker thread để gửi email thông báo liên hệ mới
    createContactWorker({ email, name, phone, message })
      .then((result) => {
        console.log(`Kết quả gửi email liên hệ: ${result}`);
      })
      .catch((error) => {
        console.error("Lỗi khi gửi email thông báo liên hệ:", error);
      });

    res.status(200).json({ message: "Gửi thông tin liên hệ thành công" });
  } catch (error) {
    console.error("Lỗi khi gửi thông tin liên hệ:", error);
    res.status(500).json({ message: "Lỗi server" });
  }
});

// Serve trang admin
app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

// Đường dẫn mặc định
app.get("/", (req, res) => {
  res.send("API server is running. Access /admin to manage properties.");
});

// Sync models với database
sequelize.sync({ alter: true }).then(() => {
  console.log("Database đã được đồng bộ hóa");
});

// Khởi động server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server đang chạy trên cổng ${PORT}`);
});
