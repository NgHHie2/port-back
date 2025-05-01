// Admin Panel JavaScript
document.addEventListener("DOMContentLoaded", function () {
  // Elements
  const propertyForm = document.getElementById("propertyForm");
  const propertyIdInput = document.getElementById("propertyId");
  const nameInput = document.getElementById("name");
  const addressInput = document.getElementById("address");
  const priceInput = document.getElementById("price");
  const imageUrlInput = document.getElementById("image_url");
  const resetBtn = document.getElementById("resetBtn");
  const propertyList = document.getElementById("propertyList");
  const successAlert = document.getElementById("successAlert");
  const errorAlert = document.getElementById("errorAlert");

  // Bootstrap Elements
  let deleteModal = null;
  let emailModal = null;

  // Initialize modals safely
  if (typeof bootstrap !== "undefined") {
    const deleteModalEl = document.getElementById("deleteModal");
    const emailModalEl = document.getElementById("emailModal");

    if (deleteModalEl) {
      deleteModal = new bootstrap.Modal(deleteModalEl);
    }

    if (emailModalEl) {
      emailModal = new bootstrap.Modal(emailModalEl);
    }
  } else {
    console.warn("Bootstrap is not loaded. Modals will not work.");
  }

  const confirmDeleteBtn = document.getElementById("confirmDelete");
  const emailListBtn = document.getElementById("emailListBtn");
  const emailList = document.getElementById("emailList");

  let propertyToDelete = null;

  // Initial data load
  loadProperties();

  // Event listeners
  if (propertyForm) {
    propertyForm.addEventListener("submit", saveProperty);
  }

  if (resetBtn) {
    resetBtn.addEventListener("click", resetForm);
  }

  if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener("click", confirmDeleteProperty);
  }

  if (emailListBtn) {
    emailListBtn.addEventListener("click", loadEmails);
  }

  // Functions
  function loadProperties() {
    if (!propertyList) return;

    propertyList.innerHTML = `
        <div class="col-12 text-center">
          <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">Đang tải...</span>
          </div>
        </div>
      `;

    fetch("/api/properties")
      .then((response) => {
        if (!response.ok) {
          throw new Error("Network response was not ok");
        }
        return response.json();
      })
      .then((properties) => {
        propertyList.innerHTML = "";

        if (properties.length === 0) {
          propertyList.innerHTML =
            '<div class="col-12"><p class="text-center">Không có dự án nào.</p></div>';
          return;
        }

        properties.forEach((property) => {
          const propertyCol = document.createElement("div");
          propertyCol.className = "col-md-6 col-lg-4";

          const imgSrc =
            property.image_url ||
            "https://via.placeholder.com/400x200?text=No+Image";

          propertyCol.innerHTML = `
              <div class="property-item">
                <img src="${imgSrc}" alt="${property.name}" class="property-img" onerror="this.src='https://via.placeholder.com/400x200?text=No+Image'">
                <h4>${property.name}</h4>
                <p><strong>Địa chỉ:</strong> ${property.address}</p>
                <p><strong>Giá:</strong> ${property.price}</p>
                <div class="d-flex">
                  <button class="btn btn-sm btn-warning btn-action edit-btn" data-id="${property.id}">
                    <i class="fas fa-edit"></i> Sửa
                  </button>
                  <button class="btn btn-sm btn-danger btn-action delete-btn" data-id="${property.id}">
                    <i class="fas fa-trash"></i> Xóa
                  </button>
                </div>
              </div>
            `;

          propertyList.appendChild(propertyCol);
        });

        // Add event listeners to buttons
        document.querySelectorAll(".edit-btn").forEach((btn) => {
          btn.addEventListener("click", () => editProperty(btn.dataset.id));
        });

        document.querySelectorAll(".delete-btn").forEach((btn) => {
          btn.addEventListener("click", () => deleteProperty(btn.dataset.id));
        });
      })
      .catch((error) => {
        console.error("Lỗi khi tải dữ liệu:", error);
        propertyList.innerHTML =
          '<div class="col-12"><p class="text-center text-danger">Lỗi khi tải dữ liệu! Vui lòng thử lại sau.</p></div>';
      });
  }

  function loadEmails() {
    if (!emailList) return;

    emailList.innerHTML = `
        <div class="text-center">
          <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">Đang tải...</span>
          </div>
        </div>
      `;

    if (emailModal) {
      emailModal.show();
    }

    fetch("/api/emails")
      .then((response) => {
        if (!response.ok) {
          throw new Error("Network response was not ok");
        }
        return response.json();
      })
      .then((emails) => {
        if (!emailList) return;

        emailList.innerHTML = "";

        if (emails.length === 0) {
          emailList.innerHTML =
            '<p class="text-center">Không có email nào đăng ký.</p>';
          return;
        }

        const table = document.createElement("table");
        table.className = "table table-striped";

        // Tạo header
        const thead = document.createElement("thead");
        const headerRow = document.createElement("tr");

        const thId = document.createElement("th");
        thId.textContent = "ID";
        thId.scope = "col";

        const thEmail = document.createElement("th");
        thEmail.textContent = "Email";
        thEmail.scope = "col";

        const thDate = document.createElement("th");
        thDate.textContent = "Ngày đăng ký";
        thDate.scope = "col";

        headerRow.appendChild(thId);
        headerRow.appendChild(thEmail);
        headerRow.appendChild(thDate);
        thead.appendChild(headerRow);

        // Tạo body
        const tbody = document.createElement("tbody");

        emails.forEach((item) => {
          const row = document.createElement("tr");

          const tdId = document.createElement("td");
          tdId.textContent = item.id;

          const tdEmail = document.createElement("td");
          tdEmail.textContent = item.email;

          const tdDate = document.createElement("td");
          const date = new Date(item.created_at);
          tdDate.textContent = date.toLocaleDateString("vi-VN");

          row.appendChild(tdId);
          row.appendChild(tdEmail);
          row.appendChild(tdDate);

          tbody.appendChild(row);
        });

        table.appendChild(thead);
        table.appendChild(tbody);
        emailList.appendChild(table);
      })
      .catch((error) => {
        console.error("Lỗi khi tải danh sách email:", error);
        emailList.innerHTML =
          '<p class="text-center text-danger">Lỗi khi tải danh sách email! Vui lòng thử lại sau.</p>';
      });
  }

  function saveProperty(e) {
    e.preventDefault();

    const confirmCodeInput = document.getElementById("confirmCode");

    if (!confirmCodeInput || !confirmCodeInput.value) {
      showAlert(errorAlert, "Vui lòng nhập mã xác nhận");
      return;
    }

    const propertyData = {
      name: nameInput.value,
      address: addressInput.value,
      price: priceInput.value,
      image_url: imageUrlInput.value,
      confirmCode: confirmCodeInput.value,
    };

    const isEditing = propertyIdInput.value !== "";
    const url = isEditing
      ? `/api/properties/${propertyIdInput.value}`
      : "/api/properties";
    const method = isEditing ? "PUT" : "POST";

    fetch(url, {
      method: method,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(propertyData),
    })
      .then((response) => {
        if (!response.ok) {
          return response.json().then((data) => {
            throw new Error(data.message || "Lỗi khi lưu dự án");
          });
        }
        return response.json();
      })
      .then((data) => {
        showAlert(
          successAlert,
          isEditing
            ? "Cập nhật dự án thành công!"
            : "Thêm dự án mới thành công!"
        );
        resetForm();
        loadProperties();
      })
      .catch((error) => {
        console.error("Lỗi:", error);
        showAlert(
          errorAlert,
          error.message || "Lỗi khi lưu dự án. Vui lòng thử lại sau."
        );
      });
  }

  function editProperty(id) {
    fetch(`/api/properties/${id}`)
      .then((response) => {
        if (!response.ok) {
          throw new Error("Network response was not ok");
        }
        return response.json();
      })
      .then((property) => {
        if (
          !propertyIdInput ||
          !nameInput ||
          !addressInput ||
          !priceInput ||
          !imageUrlInput
        )
          return;

        propertyIdInput.value = property.id;
        nameInput.value = property.name;
        addressInput.value = property.address;
        priceInput.value = property.price;
        imageUrlInput.value = property.image_url || "";

        // Cuộn lên form
        const formElement = document.getElementById("addPropertyForm");
        if (formElement) {
          formElement.scrollIntoView({ behavior: "smooth" });
        }
      })
      .catch((error) => {
        console.error("Lỗi khi lấy thông tin dự án:", error);
        showAlert(errorAlert, "Lỗi khi lấy thông tin dự án. Vui lòng thử lại.");
      });
  }

  function deleteProperty(id) {
    propertyToDelete = id;
    if (deleteModal) {
      deleteModal.show();
    }
  }

  function confirmDeleteProperty() {
    if (!propertyToDelete) return;

    const deleteConfirmCodeInput = document.getElementById("deleteConfirmCode");

    if (!deleteConfirmCodeInput || !deleteConfirmCodeInput.value) {
      // Thêm thông báo lỗi vào modal
      const errorMsg = document.createElement("div");
      errorMsg.className = "alert alert-danger mt-2";
      errorMsg.textContent = "Vui lòng nhập mã xác nhận";
      deleteConfirmCodeInput.parentNode.appendChild(errorMsg);

      // Tự động xóa thông báo sau 3s
      setTimeout(() => {
        if (errorMsg.parentNode) {
          errorMsg.parentNode.removeChild(errorMsg);
        }
      }, 3000);

      return;
    }

    fetch(`/api/properties/${propertyToDelete}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        confirmCode: deleteConfirmCodeInput.value,
      }),
    })
      .then((response) => {
        if (!response.ok) {
          return response.json().then((data) => {
            throw new Error(data.message || "Lỗi khi xóa dự án");
          });
        }
        return response.json();
      })
      .then((data) => {
        if (deleteModal) {
          deleteModal.hide();
        }
        showAlert(successAlert, "Xóa dự án thành công!");
        loadProperties();
        propertyToDelete = null;

        // Reset input mã xác nhận
        if (deleteConfirmCodeInput) {
          deleteConfirmCodeInput.value = "";
        }
      })
      .catch((error) => {
        console.error("Lỗi khi xóa dự án:", error);

        // Thêm thông báo lỗi vào modal
        const errorMsg = document.createElement("div");
        errorMsg.className = "alert alert-danger mt-2";
        errorMsg.textContent =
          error.message || "Lỗi khi xóa dự án. Vui lòng thử lại sau.";
        deleteConfirmCodeInput.parentNode.appendChild(errorMsg);

        // Tự động xóa thông báo sau 3s
        setTimeout(() => {
          if (errorMsg.parentNode) {
            errorMsg.parentNode.removeChild(errorMsg);
          }
        }, 3000);
      });
  }

  function resetForm() {
    if (propertyForm) {
      propertyForm.reset();
    }
    if (propertyIdInput) {
      propertyIdInput.value = "";
    }

    // Xóa giá trị trong trường mã xác nhận
    const confirmCodeInput = document.getElementById("confirmCode");
    if (confirmCodeInput) {
      confirmCodeInput.value = "";
    }
  }

  function showAlert(alertElement, message) {
    if (!alertElement) return;

    alertElement.textContent = message;
    alertElement.style.display = "block";

    setTimeout(() => {
      alertElement.style.display = "none";
    }, 3000);
  }
});
