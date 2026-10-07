# RUN FOR IMPACT 2026 — TRIỂN KHAI BẢN THỬ NGHIỆM

**Trạng thái:** Mã nguồn phát triển. Đã kiểm tra cú pháp JavaScript; CHƯA xác minh Strava webhook/Firebase/Netlify thực tế. Chưa thay website chính thức trước khi test Run và Walk thật.

## 0. Sao lưu
- GitHub: đã có nhánh `launch-test`. Không sửa `main`.
- Firebase Firestore: xuất dữ liệu/sao lưu trước khi cập nhật rules. Nếu đã có KM cũ từ `submissions`, KHÔNG tự động chuyển sang dữ liệu mới. Bản này lấy Leaderboard tuần từ `stravaActivities` và trái tim từ `members.totalApprovedKm`; với dữ liệu cũ, cần đối soát và migration riêng để tránh lệch.
- Không đưa `STRAVA_CLIENT_SECRET` hoặc `FIREBASE_SERVICE_ACCOUNT_JSON` lên GitHub.

## 1. GitHub — chỉ nhánh launch-test
1. Vào repository `dieulantn2408/savills-run-for-impact-2026`, chọn nhánh `launch-test`.
2. Giải nén ZIP này trên Mac. Mở thư mục chứa `index.html`, `app.js`, `assets`, `netlify`.
3. Để thay cả các file cũ chính xác, khuyến nghị dùng GitHub Desktop: Clone repository → Current Branch: launch-test → Repository → Show in Finder → chép **nội dung bên trong** ZIP vào thư mục repository (Replace) → Commit → Push origin. Không chép cả thư mục bao ngoài khiến `index.html` bị lồng thêm một cấp.
4. Nếu dùng GitHub Web, chọn `launch-test` → Add file → Upload files → kéo toàn bộ file/thư mục đã giải nén vào repository root → Commit changes. Xác nhận `netlify/functions/strava-worker.mjs` và `_activity.mjs` đã xuất hiện.
5. Không merge `launch-test` vào `main` khi chưa test xong.

## 2. Firebase
1. Firebase Console → project `run-for-impact` → Firestore Database → Rules.
2. Sao lưu rules cũ. Dán nội dung file `firestore.rules` trong ZIP → Publish.
3. Kiểm tra collections: `admins`, `joinRequests`, `members`. `stravaTokens`, `stravaAthletes`, `stravaOAuthStates`, `stravaEvents`, `stravaActivities`, `stravaConnections` được Netlify Functions tạo khi hoạt động. `clubDeclarations` được nhân viên tự xác nhận.
4. Chỉ BTC có document `admins/{uid}` mới được duyệt tài khoản và gọi `strava-review`.
5. Nếu thử nghiệm trước 01/10, bật `PILOT_TEST_MODE=true` trên Netlify. Hoạt động thử nằm trong `stravaPilotActivities` và KHÔNG cộng vào campaign chính thức.

## 3. Netlify — preview branch (KHÔNG thay production)
1. Netlify → site `savills-run-impact-strava-test` → Project configuration → Build & deploy → Continuous deployment → Branch deploys → bật branch deploy cho `launch-test` (nếu gói/site hỗ trợ). Có thể tạo site Netlify riêng trỏ vào repository và branch `launch-test` để cách ly hoàn toàn.
2. Publish directory: `.`; Functions directory: `netlify/functions`; build command: để trống hoặc `npm install` nếu Netlify yêu cầu cài dependencies. Netlify cần Node >=20.
3. Environment variables (Functions scope): `FIREBASE_SERVICE_ACCOUNT_JSON`, `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, `STRAVA_VERIFY_TOKEN`, `SITE_URL` = URL HTTPS **chính xác** của site preview, `AUTO_SYNC_ENABLED=true` sau khi webhook đã được xác minh, `PILOT_TEST_MODE=true` khi test trước 01/10, `PILOT_RECONCILE=true` chỉ cho pilot tối đa 10 tài khoản.
4. Deploy lại sau khi cập nhật biến môi trường. Kiểm tra Deploy log không có lỗi bundling `firebase-admin`. Mở `https://<preview-domain>/.netlify/functions/strava-health` để xác nhận Functions đã lên và các biến môi trường được nhận (health không chứng minh webhook đã hoạt động).
5. Strava OAuth redirect URL được mã nguồn lấy từ `SITE_URL`; cập nhật **Authorization Callback Domain** của Strava app tương ứng với domain Netlify preview. Nếu Strava chỉ cho phép một domain, dùng site riêng với custom domain hoặc kiểm thử tuần tự trên domain đã được cấp phép.

## 4. Strava webhook — BẮT BUỘC để tự cộng KM
1. Strava API application → kiểm tra app đã được cấp quyền phù hợp và hạn mức người dùng. 10 người pilot trước; 1.000 người cần được Strava chấp thuận phù hợp.
2. Callback URL: `https://<SITE_URL_HOST>/.netlify/functions/strava-webhook`. Verify token phải khớp `STRAVA_VERIFY_TOKEN` trên Netlify.
3. Đăng ký subscription từ máy của người quản trị (điền secret riêng, KHÔNG đưa vào GitHub):
   `curl -X POST https://www.strava.com/api/v3/push_subscriptions -F client_id=YOUR_ID -F client_secret=YOUR_SECRET -F callback_url=https://YOUR_SITE/.netlify/functions/strava-webhook -F verify_token=YOUR_VERIFY_TOKEN`
4. Strava sẽ gọi GET callback có `hub.challenge`; function phải trả challenge chính xác. Kiểm tra subscription bằng Strava API GET `/api/v3/push_subscriptions?client_id=...&client_secret=...`.
5. Kiểm tra `STRAVA_SUBSCRIPTION_ID` nếu có; không tạo nhiều subscription trùng một Strava app. Webhook gửi sự kiện mới đến URL đã đăng ký.
6. Bật `AUTO_SYNC_ENABLED=true`, redeploy. Worker chạy theo lịch 5 phút, không tức thì. `PILOT_RECONCILE=true` cho phép dò bổ sung mỗi giờ với tối đa 10 tài khoản pilot; TẮT trước khi mở rộng 1.000 người và thiết kế chiến lược theo API rate limits.

## 5. Test bằng hoạt động THẬT
1. BTC duyệt 1 tài khoản pilot → nhân viên kết nối Strava và tự xác nhận Club.
2. Trước 01/10: bật `PILOT_TEST_MODE=true`; ghi Run/Walk ngoài trời >=1 KM, >=10 phút, GPS, Save. Xem Firestore `stravaEvents` → `stravaPilotActivities` có `pilot-verified`. **Không** có KM trong official Dashboard (đúng thiết kế).
3. Từ 01/10: tắt `PILOT_TEST_MODE`; ghi Run/Walk thật. Kiểm tra `stravaEvents` status `processed`, `stravaActivities/{activityId}` status `credited`, `members/{uid}.totalApprovedKm` tăng một lần, hai Leaderboard và bản đồ/trái tim tăng. Đợi tối đa một chu kỳ worker (~5 phút) cộng thời gian Strava gửi webhook.
4. Gửi lại cùng sự kiện: KM không tăng thêm. Chỉnh sửa: chuyển `review`, KM cũ bị trừ cho đến khi BTC duyệt. Xóa: chuyển `deleted`, KM bị trừ.
5. Nếu webhook lỡ sự kiện: nút `Check for missing activities` cho phép nhân viên yêu cầu đồng bộ bù. Đây là nút khôi phục, không phải Submit Proof.
6. Nếu Strava hoạt động nhưng `stravaEvents` trống: kiểm tra webhook subscription, callback URL, Netlify Function logs, Strava rate limits. Nếu `queued` không chuyển: kiểm tra Scheduled Function logs, `AUTO_SYNC_ENABLED`, Firebase service account.

## 6. Trước launching
- Chỉ mở cho 1.000 người sau khi Strava API quota/athlete cap được xác nhận và triển khai dữ liệu phân trang server-side. Bản pilot hiện đọc `members` và `stravaActivities` trên trình duyệt; có thể tốn Firestore reads khi quy mô lớn.
- Bản này không tự động di chuyển KM cũ từ các `submissions` trước đây. Đối soát trước khi mở chính thức.
- Kiểm tra trình duyệt iPhone/Android, kết nối Strava, BTC approve/reject, update/delete, phân tuần theo giờ Việt Nam, hai bảng Show More.
