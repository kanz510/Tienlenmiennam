# Mậu Binh r124 — audit so với trải nghiệm ZingPlay

Ngày audit: 2026-10-24  
Base commit: `929f0f4a639bd7453ced0e775028b4f3e352dc83` (r124)  
Nhánh audit: `maubinh-zingplay-audit-r124`

## Phạm vi và giới hạn

Đã đọc `index.html`, `style.css`, `maubinh.js` và hướng dẫn luật công khai của ZingPlay. Đây là code review tĩnh; chưa chạy game trong trình duyệt, chưa kiểm tra trên điện thoại và chưa đối chiếu từng frame với client ZingPlay thực tế. Vì vậy không đánh dấu các hạng mục UI/luật là đã pass runtime.

## Những khác biệt cụ thể trong r124

1. **Cách xếp bài khác trải nghiệm quen thuộc:** 13 lá được solver tự xếp sẵn thành ba hàng ngay khi chia; người chơi chỉ có thể bấm một lá rồi bấm lá thứ hai để hoán đổi. Không có thao tác kéo-thả, không có khu vực bài chưa xếp, và người chơi không thực sự tự phân phối 13 lá vào 3 chi. Đây là khác biệt trải nghiệm rõ ràng cần ưu tiên nếu muốn gần ZingPlay.
2. **Bàn chơi được dựng theo khung cố định 780×440 và xoay bằng `applyRotation()`:** dễ gây cảm giác chật/khó thao tác trên màn hình điện thoại, nhất là khi tên chi, tên tổ hợp, bộ đếm và nút hành động cùng chiếm chiều ngang. Cần test ít nhất 390×844 portrait và 844×390 landscape.
3. **Bot chỉ hiện dòng “✓ Xếp xong” trong lúc người chơi đang xếp:** không có tiến trình/đồng hồ đối thủ riêng hay trạng thái chờ đồng bộ. Sau khi so bài, cả ba chi được dựng cùng lúc; thiếu nhịp lật bài, làm nổi chi thắng/thua và tổng kết theo từng đối thủ.
4. **Bố cục kết quả chủ yếu là các dòng chữ:** kết quả không trình bày dạng bảng so chi trực quan (chi của mình đối chiếu chi từng đối thủ, dấu thắng/thua/hòa, điểm cơ bản, thưởng và tổng điểm). Trải nghiệm vì vậy khó đọc hơn game bài thương mại.
5. **Nút “Xong” gọi thẳng `mbShowdown()` kể cả khi bài lủng:** UI đổi màu và cảnh báo nhưng không có bước xác nhận trước khi người chơi tự kết thúc với hậu quả thua ba chi. Nên thêm hộp xác nhận rõ ràng hoặc yêu cầu sửa bài.
6. **Logic AI xếp bài chạy brute-force:** `mbAllValidArrangements()` duyệt tới 72.072 cách xếp cho mỗi bộ 13 lá; `mbNewGame()` gọi solver cho người chơi và cả ba bot. Cần đo thời gian thực trên điện thoại trước khi kết luận có giật; nếu có, chuyển sang solver tối ưu/cache hoặc tính toán không chặn UI.
7. **Chưa có kiểm thử luật tự động:** cần test cố định cho 3-5-5, thứ tự chi, A-2-3-4-5, sảnh đồng chất, tứ quý, cù lũ, hai đôi, ăn trắng, hòa, thưởng chi, sập 3 chi và sập làng. Các biến thể thưởng có thể khác giữa từng nền tảng; không sao chép máy móc mọi mức thưởng mà chưa chốt luật tham chiếu.
8. **Tiền Mậu Binh dùng chung `state.money` của Tiến Lên:** đây là điểm tích hợp có rủi ro. Cần test số dư trước/sau, ván mới, quay về sảnh, tải lại trang và trạng thái tiền âm; không đổi mô hình lưu tiền của Tiến Lên trong đợt UI.

## Kế hoạch nâng cấp theo thứ tự

### P0 — đúng thao tác và an toàn luồng chơi
- Chốt luật tham chiếu: chi trên 3 lá, chi giữa 5 lá, chi dưới 5 lá; chi trên không mạnh hơn chi giữa, chi giữa không mạnh hơn chi dưới; xác nhận quy tắc A thấp trong sảnh và toàn bộ thưởng.
- Thay thao tác xếp chính bằng kéo-thả/nhấn chọn rồi đưa bài vào chi; vẫn giữ nút “Xếp tự động”, “Hoàn tác”, “Xóa/xếp lại” và đếm lá 3/5/5.
- Khi nhấn “Xong” với bài lủng, hiển thị cảnh báo xác nhận; không âm thầm chuyển sang kết quả.
- Viết test luật và kiểm tra solver luôn trả đúng 13 lá duy nhất, đủ 3/5/5, không trùng lá và không lủng.

### P1 — bàn chơi gần game thương mại
- Thiết kế bàn Mậu Binh riêng, đồng bộ hệ emerald + champagne-gold của game, nhưng có hierarchy đặc trưng: đối thủ ở phía trên, 3 chi của người chơi dễ đọc, tay bài/khu vực xếp rõ ràng, action bar cố định.
- Dùng trạng thái đối thủ “đang xếp / đã xếp / đang so bài”; reveal theo nhịp và làm nổi từng chi thắng/thua/hòa.
- Thay result text dài bằng bảng so chi theo từng đối thủ và bảng cộng điểm minh bạch.
- Kiểm tra tương phản, vùng chạm tối thiểu, safe-area và responsive ở portrait/landscape.

### P2 — hiệu năng và regression
- Đo thời gian chia bài/xếp tự động trên thiết bị chậm; tối ưu solver nếu cần.
- Kiểm tra vào Mậu Binh → về sảnh → vào Tiến Lên, âm thanh, tiền, lưu ván và service worker.
- Giữ tất cả thay đổi trong nhánh này; không merge vào `main` nếu chưa được yêu cầu.

## Nguồn tham chiếu

- ZingPlay — hướng dẫn Mậu Binh: https://play.zing.vn/detail-games/chi-tiet.poker-viet-nam.17.html
- ZingPlay Chinese Poker / 13 lá trên Google Play: https://play.google.com/store/apps/details?id=zps.game.pusoy.cn

## Trạng thái

- [x] Đọc code r124 và lập audit tĩnh.
- [x] Tạo nhánh riêng từ commit r124.
- [ ] Chưa sửa luật / solver trước khi có test xác nhận.
- [ ] Chưa kiểm thử trình duyệt hoặc điện thoại.
- [ ] Chưa merge.
