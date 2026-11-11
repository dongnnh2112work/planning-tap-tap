# Summit Your Drawing — Demo v3

White/airyclean map (colored-pencil risograph on #FFFFFF). STORAGE_KEY `summit_drawing_v5`. Preview-first export, GMaps directions, Strava timelapse.

# Summit Your Drawing — Demo v2 (Thảo Cầm Viên)

Demo web tĩnh (mở bằng `file://` được) cho trải nghiệm check-in NFC → vẽ 60 giây → bản đồ 15 chuồng → Tour Wrapped (Strava / lưới tranh / danh hiệu / tải PNG & video).

## Chạy nhanh

1. Giải nén `summit-demo-v2.zip` (hoặc mở thư mục này).
2. Mở `index.html` bằng Chrome / Edge (kéo thả vào trình duyệt hoặc `file:///…/index.html`).
3. Bấm **Quét NFC** → vẽ → đăng nhập giả lập → xem bản đồ → **Hoàn thành hành trình** → tải ảnh / video.

Không cần server. Không ES modules, không `fetch`.

## Tải Wrapped (bắt buộc)

- **Tải ảnh PNG**: tạo blob → thẻ `<a download>` — trên Chrome desktop/`file://` file được lưu thẳng về máy.
  - Lưới: `thao-cam-vien-wrapped-luoi.png`
  - Bản đồ: `thao-cam-vien-wrapped-map.png`
- **Tải video ngắn** (~8 giây): `canvas.captureStream` + `MediaRecorder`
  - Ưu tiên `video/mp4` nếu hỗ trợ, không thì `webm` (vp9/vp8).
  - Tên: `thao-cam-vien-wrapped-luoi.webm` / `…-map.webm` (hoặc `.mp4`).
  - Có overlay **Đang tạo video…** + thanh tiến độ.
- Trên điện thoại: nếu `navigator.canShare({files})` hiện thêm nút **Chia sẻ / Lưu ảnh** (và video); luôn còn nút tải trực tiếp dự phòng.

Ảnh map nhúng dạng data URI trong `map-data.js` để canvas không bị *tainted* khi mở `file://`. Font chờ `document.fonts.ready` (Quicksand / Be Vietnam Pro), fallback system-ui nếu offline.

## Bản đồ & nguồn

- **Bố cục 15 chuồng**: tham chiếu bản đồ minh hoạ chính thức TCV — **không** dùng ảnh chính thức làm nền sản phẩm.
- **Phong cách UI**: ô chuồng có viền rõ kiểu `ref-map-2` (hand-drawn pods trên `assets/map-v2.*`).
- **Mã / đối chiếu điểm**: sơ đồ HCM360 (`02-hcm360-*`) chỉ để đối chiếu, không phải bản chính thức.
- **Lối đi**: đồ thị đường tham khảo hình học OpenStreetMap (`03-osm-tiles-z18`).

> © OpenStreetMap contributors — ghi trong app (dòng credit dưới bản đồ) và trên ảnh/video Wrapped.

Chi tiết nguồn: xem `SOURCES.md` ở thư mục `tcv-ban-do` (kèm theo khi đóng gói team).

## Màn hình

| Màn | Mô tả |
|-----|--------|
| Welcome | Quét NFC / Reset |
| Chọn chuồng | 15 NFC giả lập |
| Vẽ | Bút cố định, tẩy theo nét, Undo, Gợi ý 30% cam, timer 60s |
| Login | Google mock |
| Bản đồ | Zoom/pan, ô chuồng viền, chỉ đường, gợi ý gần nhất |
| Wrapped | Quãng đường Strava → showcase lưới → danh hiệu + pháo hoa → export |

## Danh hiệu

- **Vị thần tốc độ** — TB < 25s
- **Đứa con của mẹ hoàn hảo** — TB ≥ 50s hoặc để hết giờ tự nộp
- **Vị thần chăm chỉ** — đủ 15 chuồng

## Kỹ thuật

- `config.js` — 15 động vật, landmarks, `PATH_EDGES`, `STORAGE_KEY=summit_drawing_v4`
- `map-data.js` — JPEG map dạng data URI
- `app.js` — toàn bộ logic; `window.__SUMMIT__` cho Playwright
- iPhone 17 frame 402×874 + `--fit` scale; `pointerPos` chia cho scale

## Kiểm thử

```bash
npx playwright test scripts/test-v2-exports.mjs
```

Xuất mẫu lưu tại `screenshots/v2/exports/`.


## Hình gợi ý (v4, style icon nét dày)

Nét gợi ý trên bàn vẽ lấy từ bộ 15 icon trong `assets/guides/`. Bấm **Gợi ý** hiện hình cam mờ (opacity ~0.3). Khi cập nhật SVG, chạy `node scripts/import-guides.mjs`.

**Giấy phép — chỉ dùng cho demo nội bộ, chưa được đưa ra công khai:**

- 11 icon cắt từ bộ stock trả phí Colourbox #46749229 (“wild animals outline vector icons safari and jungle concept”): `sutu`, `huou`, `voi`, `tegiac`, `gau`, `ho`, `honghac`, `casau`, `hama`, `ngua`, `dadieu`. Dùng tạm trong demo nội bộ thôi; không phát hành công khai trước khi mua license.
- 4 icon do Hai tự vẽ mới, dùng tự do: `vuon`, `capybara`, `cong`, `meerkat`.

## Đóng gói

Zip không gồm `node_modules`, `scripts`, `screenshots`, archive cũ — xem script đóng gói team.
