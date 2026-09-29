# 🚀 Hướng Dẫn Triển Khai Lên Render (Deployment Guide)

Dự án của bạn đã được thiết kế tối ưu, kết hợp cả Backend (Node.js/Express) và Frontend (PWA Static HTML) trong cùng một máy chủ (Monolith). Do đó, bạn không cần phải deploy riêng biệt Frontend lên Vercel/Netlify nữa.

## Bước 1: Đưa Code lên GitHub
1. Mở terminal, chạy các lệnh sau để push code lên GitHub:
   ```bash
   git add .
   git commit -m "Ready for production"
   git push origin main
   ```

## Bước 2: Deploy Lên Render bằng Blueprint (Siêu Nhanh)
Tôi đã tạo sẵn file `render.yaml` (Infrastructure as Code) trong dự án của bạn.
1. Đăng nhập vào [Render.com](https://render.com/).
2. Bấm vào nút **"New"** -> Chọn **"Blueprint"**.
3. Kết nối với repository GitHub của bạn (chọn repository `zalo-nail-booking`).
4. Render sẽ tự động đọc file `render.yaml` và hỏi bạn các giá trị Environment Variables (Biến môi trường) còn thiếu (Bởi vì các key nhạy cảm đã bị ẩn đi qua cờ `sync: false`).

## Bước 3: Nhập Biến Môi Trường (Environment Variables)
Hãy copy các biến môi trường từ file `.env` của bạn paste vào dashboard của Render:
- `ADMIN_PASSWORD`
- `JWT_SECRET`
- `SHOP_ZALO_PHONE`
- `DATABASE_URL` *(Lưu ý: Nếu Deploy, hãy dùng IPv4 connection của Supabase Pooler)*
- `REDIS_URL`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `GOOGLE_REFRESH_TOKEN`

Bấm **Apply** và chờ khoảng 2-3 phút để Render build và chạy ứng dụng.

## Bước 4: Chống Sleep (Cold Start) với cron-job.org hoặc UptimeRobot
Render gói miễn phí sẽ đưa server vào trạng thái "ngủ" nếu không có ai truy cập trong 15 phút. Để giải quyết:
1. Tạo một tài khoản miễn phí tại [cron-job.org](https://cron-job.org/) hoặc [UptimeRobot](https://uptimerobot.com/).
2. Tạo một **Monitor (HTTP/s)** hoặc **Cron Job**.
3. Điền URL ứng dụng của bạn kèm endpoint `/ping`. Ví dụ:
   `https://zalo-nail-booking.onrender.com/ping`
4. Cài đặt tần suất (Interval) là **10 phút / lần**.

## Bước 5: Hoàn Thiện
Copy link ứng dụng của bạn (ví dụ: `https://zalo-nail-booking.onrender.com/`) và dán vào:
- Lời chào tự động Zalo OA / Zalo cá nhân.
- Tiểu sử Facebook / Instagram / TikTok.

**Chúc tiệm Spa của bạn đắt khách! 🎉**
