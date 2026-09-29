# ANTIGRAVITY EXECUTION ROADMAP: ADMIN DASHBOARD

Document Type: Agent Instruction & Task Checklist
Target Agent: Antigravity AI Agent
Project: Zalo Nail/Spa Booking System (Admin Module)

---

## CONTEXT & OBJECTIVE
Xây dựng trang quản trị (Admin Dashboard) tối giản cho chủ tiệm Nail/Spa cá nhân.
Yêu cầu cốt lõi:
1. Đăng nhập đơn giản bằng Mật khẩu (JWT Authentication).
2. Quản lý Lịch hẹn (Xem, Hủy, Thêm lịch thủ công từ Zalo/Khách gọi điện).
3. Quản lý Dịch vụ (Thêm, Sửa, Xóa, Đổi thời lượng/giá).
4. Khóa ngày nghỉ / Khung giờ bận cá nhân (Blocked Slots).

---

## PHASE 1: DATABASE SCHEMA & ADMIN AUTHENTICATION
Goal: Cập nhật CSDL và viết Backend API phục vụ xác thực Admin & Quản lý Dịch vụ.

- [x] Task 1.1: Cập nhật `db/schema.sql`
  - Bổ sung bảng `business_hours` (Giờ mở/đóng cửa mặc định theo thứ trong tuần).
  - Bổ sung bảng `blocked_slots` (Khung giờ/Ngày chủ tiệm chủ động khóa nghỉ).
- [x] Task 1.2: Triển khai Authentication Middleware (`src/middlewares/auth.middleware.ts`)
  - Viết middleware kiểm tra JWT Token từ Header `Authorization: Bearer <token>`.
  - Sử dụng secret key và password từ `process.env.ADMIN_PASSWORD`.
- [x] Task 1.3: Triển khai API Authentication (`src/controllers/admin/auth.controller.ts`)
  - `POST /api/admin/login`: Nhận password, kiểm tra khớp với `.env` -> Trả về JWT Token.
- [x] Task 1.4: Triển khai CRUD Services API (`src/controllers/admin/service.controller.ts`)
  - `GET /api/admin/services`: Lấy toàn bộ danh sách dịch vụ.
  - `POST /api/admin/services`: Thêm dịch vụ mới.
  - `PUT /api/admin/services/:id`: Cập nhật tên, thời gian làm (phút), giá tiền.
  - `DELETE /api/admin/services/:id`: Xóa/Ẩn dịch vụ.

---

## PHASE 2: ADMIN BOOKING & BLOCKED SLOTS MANAGEMENT
Goal: Viết API quản lý lịch hẹn và khóa khung giờ bận.

- [x] Task 2.1: Triển khai Admin Booking API (`src/controllers/admin/booking.controller.ts`)
  - `GET /api/admin/bookings?date=YYYY-MM-DD`: Lấy danh sách lịch hẹn trong ngày/tuần.
  - `PATCH /api/admin/bookings/:id/status`: Cập nhật trạng thái (`confirmed`, `completed`, `cancelled`).
  - `POST /api/admin/bookings/manual`: Thêm lịch hẹn thủ công (Chủ tiệm nhận khách qua Zalo/Điện thoại).
- [x] Task 2.2: Triển khai Blocked Slots API (`src/controllers/admin/blocked.controller.ts`)
  - `POST /api/admin/blocked-slots`: Tạo khung giờ bận (Ví dụ: Nghỉ trưa, Bận việc gia đình, Nghỉ Lễ).
  - `GET /api/admin/blocked-slots`: Danh sách các giờ/ngày đã khóa.
  - `DELETE /api/admin/blocked-slots/:id`: Mở lại khung giờ đã khóa.
- [x] Task 2.3: Cập nhật Public Slot Calculation API (`GET /api/slots`)
  - Chỉnh sửa logic `GET /api/slots` phía Client: Khi tính toán khung giờ trống, tự động trừ đi cả lịch đã booked TRẦN + các khung giờ nằm trong `blocked_slots`.

---

## PHASE 3: FRONTEND ADMIN DASHBOARD (HTML/JS + TailwindCSS)
Goal: Xây dựng giao diện Web Admin nhẹ, chạy mượt trên điện thoại & máy tính.

- [x] Task 3.1: Trang Đăng nhập (`public/admin/login.html`)
  - Form nhập mật khẩu Admin, gửi request tới `/api/admin/login`, lưu JWT vào `localStorage`.
- [x] Task 3.2: Dashboard Quản lý Lịch hẹn (`public/admin/index.html`)
  - Bảng hiển thị danh sách lịch hẹn trong ngày (Tên khách, SĐT, Dịch vụ, Khung giờ, Trạng thái).
  - Nút chuyển trạng thái nhanh: `Đã làm xong`, `Hủy lịch`.
  - Form modal "Thêm lịch thủ công".
- [x] Task 3.3: Trang Quản lý Dịch vụ & Khóa Lịch (`public/admin/settings.html`)
  - Danh sách Dịch vụ + Form sửa giá/thời lượng.
  - Bộ chọn Ngày/Giờ để Admin bấm "Khóa khung giờ này".

---

## PHASE 4: INTEGRATION & TESTING
Goal: Kiểm thử tích hợp toàn bộ module Admin.

- [ ] Task 4.1: Kiểm thử Security & Auth
  - Verify rằng các API `/api/admin/*` nếu không có Bearer Token sẽ bị từ chối (401 Unauthorized).
- [ ] Task 4.2: Kiểm thử logic Khóa lịch (Blocked Slots)
  - Admin bấm khóa khung giờ 14:00 - 16:00 ngày mai -> Mở trang đặt lịch phía Client kiểm tra xem giờ 14:00 - 16:00 có bị ẩn đi không.
- [ ] Task 4.3: Đánh dấu hoàn thành toàn bộ Task trong `ANTIGRAVITY_ADMIN_TASKS.md`.