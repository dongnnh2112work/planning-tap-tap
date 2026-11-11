# Rule làm việc cho agent – Tap Tap

Repo này là **workspace** của dự án Tap Tap. Mọi agent đọc file này trước khi làm việc. Repo đang **public**.

## 1. Vai trò
- **Anh BeeNgyy (BD):** vận hành, cách bán Tap Tap cho doanh nghiệp, tìm khách hàng. Là người quyết cuối cùng.
- **Anh Triết (Technical):** toàn bộ phần kỹ thuật của dự án. Code đi qua phía technical (anh Triết / TECH-LEAD).
- **Thư và Nhi (Art & Social):** UI design và social media.
- **Bee (PM):** điều phối, theo dõi repo mỗi ngày, báo cáo anh BeeNgyy.
- Mỗi agent ghi ở đầu file `progress/<TÊN>.md` mình làm cho ai, và chỉ nhận việc trong phạm vi của người đó.
- Agent đồng ý không thay cho người duyệt. Chỉ người phụ trách xác nhận mới tính là đã chốt.

## 2. Đọc trước khi làm
Thứ tự đọc: `CONTEXT.md` → `DECISIONS.md` → `TIMELINE.md` → file họp mới nhất trong `meetings/` → file `progress/` của mình.
Không làm ngược quyết định đã chốt; muốn đổi thì ghi ở mục "Cần anh BeeNgyy quyết".

## 3. Cập nhật tiến độ
- Mỗi agent chỉ sửa `progress/<TÊN>.md` của mình; mục mới ở **trên cùng**, theo mẫu trong `README.md`.
- Cập nhật cuối mỗi ngày có làm việc, và ngay khi bị chặn hoặc có nguy cơ trễ mốc.
- Commit: `[TÊN] YYYY-MM-DD nội dung`. Không force push, không xoá lịch sử.

## 4. Sửa file chung (CONTEXT, TIMELINE, DECISIONS)
- Ai cũng được sửa.
- **Trước khi sửa:** lưu bản cũ vào `archive/<tên-file>_YYYY-MM-DD.md` để có thể khôi phục.
- **Sau khi sửa:** thêm một dòng vào mục "Lịch sử sửa" cuối file: ngày, người sửa, sửa gì.
- Mục "Đã chốt" trong `DECISIONS.md` chỉ đổi khi anh BeeNgyy xác nhận.

## 5. Sự thật và số liệu
- Không bịa số, ngày, tên, giá. Tách rõ: đã xác minh / ước tính / chưa xác minh.
- Chỗ chưa quyết ghi "Cần chốt", không tự điền.

## 6. An toàn (repo public)
- Không đưa mật khẩu, API key, token, dữ liệu khách hàng thật, thông tin cá nhân.
- Không ghi giá, báo giá, chi phí; không nêu tên đối thủ hay đối tác chưa công bố.
- Không đưa nội dung trợ lý nội bộ của team lên bản demo public.

## 7. Việc phải báo / hỏi trước
- **Mọi khoản tốn tiền** (gói trả phí, tag, domain, server, API…): báo anh Triết trước khi dùng.
- **Mọi merge / deploy liên quan production:** báo anh Triết và chờ đồng ý.
- Email, tin nhắn ra ngoài, bài đăng công khai: chỉ soạn nháp, người phụ trách tự gửi.
- Xoá file, repo, dữ liệu: hỏi trước.

## 8. Họp tuần (thứ 3)
- Team họp mỗi **thứ 3**.
- Sau họp, tạo `meetings/YYYY-MM-DD.md` theo `meetings/TEMPLATE.md`: đã chốt, next step (ai, hạn), câu hỏi mở. Bee soạn từ ghi chú, anh BeeNgyy xác nhận.
- Phần đã chốt được thêm vào `DECISIONS.md` (theo mục 4).
- **Bắt buộc:** mỗi agent khi đọc repo lần đầu phải **tự tạo routine** đọc file họp mới nhất vào **sáng thứ 4 hằng tuần**, nhận next step của mình và ghi vào file `progress/`. Không tạo được routine thì báo cho chủ của mình.

## 9. Mốc và rủi ro
- Mốc chính: 29/11 test NFC xong · W1/12 (30/11–6/12) internal launch · W2/12 (7–13/12) release.
- Thấy nguy cơ trễ mốc: ghi ngay ở "Vướng / rủi ro", không đợi tới hạn.
- Viết tiếng Việt, ngắn, nói thẳng vấn đề.

## Lịch sử sửa
- 2026-11-11 · Bee · Tạo bản đầu, anh BeeNgyy duyệt.
