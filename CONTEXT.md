# Context dự án Tap Tap

> Đọc file này trước tiên nếu anh/chị/agent mới vào dự án. Cập nhật lần cuối: 11/11/2026.

## Tap Tap là gì
Tap Tap là trải nghiệm **chạm điện thoại để sưu tập**: người chơi chạm điện thoại vào thẻ/trạm NFC (hoặc quét QR dự phòng), một trang web mở ra (không cần cài app), hiện thẻ thú hoặc nhiệm vụ kèm câu đố. Trả lời đúng thì giữ thẻ / ghi điểm. Cuối hành trình có **recap kiểu Wrapped** để chia sẻ.

Giải thích cho trẻ 5 tuổi: "Chạm điện thoại vào bảng bí mật là có một con thú nhảy ra thành tấm thẻ. Trả lời đúng câu đố là được giữ thẻ. Gom đủ thì có video nhỏ để khoe bạn bè."

Dự án do **Howls** (agency event/activation) làm chủ.

## Hai hướng sản phẩm
| | A. B2C: khách lẻ tại Thảo Cầm Viên (TCV) | B. B2B: pilot cho đoàn |
|---|---|---|
| Người dùng | Gen Z 18–25 tại Sài Gòn | Đoàn tour, team building, sự kiện, trường học |
| Người trả tiền | Chưa có (bản 0đ, thu góp ý) | Đơn vị tổ chức: ưu tiên đại lý tour/MICE, rồi agency sự kiện, rồi HR/trường |
| Luật chơi | 15 thẻ thú + 3 thẻ bí mật, quiz, badge 5/10/15, Wrapped | Nhiệm vụ theo trạm, điểm, bảng xếp hạng cá nhân/đội, recap |
| Trạm | Chưa chốt; không gắn gì lên tài sản sở thú | Trạm di động Howls mang theo |
| Vận hành | — | Giai đoạn 1: Howls chạy hộ. Giai đoạn 2 (ngoài MVP): khách tự chạy bằng mã PIN |

**Đang nghiêng hướng B (pilot B2B)** nhưng **chưa chốt**. Xem [DECISIONS.md](DECISIONS.md).

Cả hai hướng dùng chung **một NFC core**: web/PWA, tag chứa URL + QR dự phòng, quest engine, định danh người chơi (Google login hoặc UID vòng tay), chống chạm trùng phía server, analytics, recap.

## Đã có (tới 11/11/2026)
- Nội dung: 15 trạm + 3 trứng phục sinh, 72 câu quiz, art thẻ (phong cách gouache sách thiếu nhi), motion chạm thẻ.
- Demo 9 màn (bản B2C) tại https://ui-demo-beta.vercel.app, có nút "Hỏi Tap Tap" trả lời câu hỏi của khách.
- Repo code: https://github.com/dongnnh2112work/tap-tap
- Đề xuất flow MVP: [FLOW_B2B.md](FLOW_B2B.md).

## Còn thiếu
- Đăng nhập Google thật và backend lưu bộ sưu tập (demo đang giả lập).
- Domain, tag NFC (chưa mua), test NFC trên máy thật.
- Trang host, dashboard, bảng xếp hạng realtime cho B2B.
- Đoàn pilot đầu tiên.
- Giá bán: **chưa chốt, chưa kiểm chứng**.

## Lịch
- **W1/12 (30/11–6/12): internal launch.**
- **W2/12 (7–13/12): release / buổi pilot đầu.**
- Tới 31/12: thêm 1–2 buổi, số liệu và báo cáo.
- Chi tiết: [TIMELINE.md](TIMELINE.md).

## Chỉ số pilot B2B
Tỷ lệ hoàn thành đoàn ≥ 70%, lỗi chạm < 5%, setup quest ≤ 1 giờ, lắp trạm ≤ 30 phút, hài lòng người tổ chức ≥ 8/10.
**Điều kiện dừng:** sau 2 pilot mà hoàn thành < 50% hoặc lỗi chạm > 10% thì sửa sản phẩm trước khi đi bán.

## Câu hỏi đang mở
1. Hướng A hay B cho 3 tháng tới?
2. Đoàn pilot đầu tiên là ai, ngày nào?
3. Bản cho tour: mở trạm bằng GPS + QR, NFC chỉ làm điểm nhấn?

## Thị trường (tham khảo)
Trên thế giới đã có nhiều bên làm game tour/scavenger hunt (đa số dùng GPS + QR, rất ít dùng NFC). Đây là ngách dịch vụ có phần mềm, quy mô nhỏ. Điểm khác biệt Tap Tap nhắm tới: recap kiểu Wrapped, nội dung tiếng Việt, Howls vận hành trọn gói.

## Repo này dùng để làm gì
Repo này là **workspace planning** của dự án: context, timeline, quyết định, tiến độ từng agent (thư mục `progress/`). Code sản phẩm nằm ở repo `tap-tap`, không nằm ở đây. Bee (PM) đọc repo mỗi ngày làm việc và báo cáo cho anh BeeNgyy.
