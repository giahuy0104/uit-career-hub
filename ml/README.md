# Học máy trong UIT Career Hub

Hai mô hình học máy được huấn luyện offline bằng Python, xuất ra JSON và chạy trực tiếp trong backend Java
(không cần thêm server). Gemini chỉ viết lời giải thích; điểm số và thứ tự do các mô hình này quyết định.

| Mô hình | Bài toán | Dùng ở đâu | File |
|---|---|---|---|
| Xếp hạng việc làm (AI3 v2) | Dự đoán khả năng sinh viên ứng tuyển một tin | Sinh viên › Việc làm › Phù hợp với bạn | `backend/src/main/resources/ml/job-ranker.json` |
| Cảnh báo sớm thực tập | Dự đoán kỳ thực tập kết thúc không tốt | UIT › Quản lý thực tập | `backend/src/main/resources/ml/internship-risk.json` |

## Chạy lại

```powershell
python -m venv ml\.venv
ml\.venv\Scripts\python -m pip install -r ml\requirements.txt
ml\.venv\Scripts\python ml\train_ranker.py
ml\.venv\Scripts\python ml\train_risk.py
```

Mỗi script: mô phỏng dữ liệu → chia train/validation/test → huấn luyện Logistic Regression và LightGBM → chọn
mô hình tốt hơn **trên tập validation** → báo cáo trên **tập test** → ghi mô hình, số liệu (`ml/reports/*.json`),
biểu đồ (`ml/reports/*.png`) và các ca đối chiếu cho test Java. Hạt giống ngẫu nhiên cố định nên chạy lại ra đúng số.

`MlParityTest` (Java) kiểm tra cùng một dữ liệu thô cho ra **cùng đặc trưng và cùng xác suất** ở Python và Java
(sai khác < 1e-9). Đổi đặc trưng ở `features.py` thì phải đổi `JobRankingFeatures` / `InternshipRiskFeatures`.

## Dữ liệu

Hệ thống chưa có đủ dữ liệu thật để huấn luyện, nên cả hai thí nghiệm dùng **dữ liệu mô phỏng** có quy luật ẩn
biết trước. Kết quả chứng minh mô hình học được những tín hiệu mà cách làm cũ bỏ qua; **không** khẳng định độ
chính xác trên người dùng thật.

- **Xếp hạng:** 1.600 sinh viên, 320 tin, 24.000 lượt hiển thị (mỗi sinh viên 15 tin có trùng ít nhất 1 kỹ năng).
  Quyết định ứng tuyển phụ thuộc kỹ năng, nhóm ngành khai báo, **sở thích thật chỉ lộ qua lịch sử ứng tuyển**,
  độ nổi tiếng của doanh nghiệp và độ mới của tin. Tỉ lệ ứng tuyển 22,8%.
- **Cảnh báo sớm:** 2.400 kỳ thực tập với hai biến ẩn "mức chăm chỉ" và "nhu cầu hỗ trợ" sinh ra nhật ký
  (số tuần nộp, trễ, bị yêu cầu sửa, độ dài 15–30 từ như dữ liệu demo thật, lặp nội dung, nêu khó khăn).
  Tỉ lệ kết thúc không tốt 24,8%.

Hệ thống đã bắt đầu ghi hành vi thật vào `job_interaction_events` (hiển thị, xem, bấm gợi ý; nhãn "ứng tuyển"
lấy từ `applications`). Khi đủ dữ liệu, chạy lại với `--data <file.csv>` để huấn luyện trên dữ liệu thật.

## Đặc trưng

**Xếp hạng (14):** tỉ lệ kỹ năng bắt buộc / nên có đã có, Jaccard kỹ năng, số kỹ năng của tin, đúng nhóm ngành,
có khai báo nhóm ngành, đúng loại cơ hội, có khai báo loại cơ hội, số ngày từ khi đăng, số ngày tới hạn,
ln(1 + số đơn vào doanh nghiệp trong 30 ngày), tỉ lệ đơn cũ cùng nhóm ngành, số kỹ năng của sinh viên, điểm công thức cũ.
Không dùng tên, giới tính, GPA, MSSV.

**Cảnh báo sớm (9):** tỉ lệ tuần đã nộp, tỉ lệ nộp trễ, tỉ lệ bị yêu cầu sửa, số từ trung bình, xu hướng độ dài,
mức lặp nội dung giữa hai tuần liền nhau (Jaccard), tỉ lệ tuần nêu khó khăn, số ngày chưa nộp, số lần kế hoạch bị
yêu cầu sửa. Cần ít nhất 2 tuần đã nộp mới chấm điểm.

## Kết quả (tập test)

### Xếp hạng việc làm (302 sinh viên)

| Cách xếp | NDCG@5 | NDCG@10 | Precision@5 |
|---|---|---|---|
| Ngẫu nhiên | 0,303 | 0,456 | 0,234 |
| Công thức cũ (50/20/20/10) | 0,614 | 0,715 | 0,459 |
| Logistic Regression **(đang dùng)** | **0,678** | **0,766** | 0,495 |
| LightGBM | 0,675 | 0,762 | **0,497** |

Bootstrap ghép cặp theo sinh viên (2.000 lần), chênh lệch NDCG@5:

| So sánh | Trung bình | Khoảng tin cậy 95% |
|---|---|---|
| Logistic Regression − công thức | +0,065 | [+0,041; +0,088] |
| LightGBM − công thức | +0,061 | [+0,037; +0,086] |
| LightGBM − Logistic Regression | −0,003 | [−0,017; +0,011] |

Học máy tốt hơn công thức có ý nghĩa thống kê. Hai mô hình học máy ngang nhau vì quy luật mô phỏng gần tuyến tính;
validation chọn Logistic Regression, đơn giản và dễ giải thích hơn.

Bỏ bớt đặc trưng (LightGBM, NDCG@5): đủ 0,675 · bỏ lịch sử 0,659 · bỏ độ nổi tiếng 0,662 · bỏ độ mới 0,670.

### Cảnh báo sớm (480 kỳ thực tập)

| Cách chấm | AUC | PR-AUC | Phát hiện trong 20% điểm cao nhất |
|---|---|---|---|
| Hiện tại: tỉ lệ nhật ký thiếu | 0,749 | 0,509 | 49,5% |
| Logistic Regression | **0,834** | **0,600** | 53,2% |
| LightGBM **(đang dùng)** | 0,821 | 0,583 | **54,1%** |

Validation chọn LightGBM (AUC 0,882 so với 0,871) dù trên test Logistic Regression nhỉnh hơn; giữ nguyên quy tắc
"chọn trên validation" để không làm đẹp kết quả bằng tập test. Ngưỡng lấy từ validation: **Nguy cơ cao** ≥ 0,564
(15% cao nhất), **Cần theo dõi** ≥ 0,279. Trên test, nhóm "Nguy cơ cao" đúng 64,2% và bắt được 38,7% ca xấu.

Hệ số Logistic Regression (đã chuẩn hóa) cho thấy nhật ký ngắn là tín hiệu mạnh nhất (−1,08), tiếp theo là nêu
khó khăn (+0,36), thiếu tuần (−0,33), bị yêu cầu sửa (+0,31), nộp trễ (+0,21).

## Giải thích từng dự đoán

- Logistic Regression: đóng góp của đặc trưng i là hệ_số_i × giá_trị_chuẩn_hóa_i.
- LightGBM: phương pháp Saabas, cộng thay đổi giá trị kỳ vọng tại mỗi nhánh rẽ trên đường đi của cây.

Cả hai cộng lại đúng bằng log-odds (có test). Giao diện chỉ hiện tối đa 3 lý do có đóng góp ≥ 0,1.

## Giới hạn

- Dữ liệu mô phỏng do nhóm tự đặt quy luật; mô hình tốt trên đó chưa chắc tốt với người dùng thật.
- Đặc trưng xếp hạng tính tại thời điểm xuất, không tái tạo đúng thời điểm sinh viên nhìn thấy tin.
- Cảnh báo sớm chỉ để ưu tiên theo dõi, không tự thay đổi hồ sơ hay chặn ai.
- Chưa có mô-đun tự nhận diện kỹ năng từ văn bản (cần dataset có giấy phép).

## Huấn luyện lại bằng dữ liệu thật

Backend xuất dữ liệu đã dùng trong hệ thống ra CSV, tính đặc trưng bằng **chính mã Java** mà mô hình đang chạy
(không lệch giữa lúc huấn luyện và lúc dùng):

```powershell
cd backend
$env:ML_EXPORT_DIR = "..\ml\data"
java -jar target\career-hub-api-0.0.1-SNAPSHOT.jar db:ml:export
cd ..
ml\.venv\Scripts\python ml\train_ranker.py --data ml\data\ranker.csv
anker.csv
ml\.venv\Scripts\python ml\train_risk.py --data ml\data\risk.csv
isk.csv
```

- `ranker.csv`: mỗi cặp (sinh viên, tin) từng được hiển thị trong "Phù hợp với bạn"; nhãn 1 nếu sinh viên ứng tuyển
  trong 14 ngày sau lần hiển thị đầu. Lịch sử ứng tuyển, độ nổi tiếng, độ mới tính tại thời điểm hiển thị; kỹ năng và
  mong muốn của sinh viên là giá trị hiện tại (hệ thống không lưu lịch sử các trường này).
- `risk.csv`: các kỳ thực tập đã hoàn thành có phiếu đánh giá của doanh nghiệp; nhãn 1 nếu điểm tổng ≤ 2 hoặc doanh
  nghiệp không khuyến nghị.
- `ml/data/` không được commit (dữ liệu thật). Mô hình mới chỉ thay file JSON trong `backend/src/main/resources/ml/`.

## Theo dõi chất lượng sau khi triển khai

Trang UIT › Trợ lý AI › Từng chức năng hiển thị cho mỗi chức năng: công tắc riêng, hạn mức riêng (chức năng Gemini),
số lượt gọi, tỉ lệ người dùng đánh giá hữu ích (nút 👍/👎 ở mọi kết quả AI), số liệu kiểm tra offline của mô hình
và với xếp hạng việc làm là tỉ lệ bấm và tỉ lệ ứng tuyển thực tế sau khi được gợi ý.

## Demo trên máy local

`ml/demo/risk-demo.sql` thêm 4 sinh viên thực tập với nhật ký tốt / trung bình / đáng lo / mới bắt đầu.
**Chỉ chạy trên database local:**

```powershell
Get-Content ml\demo\risk-demo.sql | docker exec -i uit-career-hub-postgres psql -U uit_user -d uit_career_hub_main
```
