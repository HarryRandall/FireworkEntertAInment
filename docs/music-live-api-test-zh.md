# 音樂功能真實 API 驗證（2026-09-06）

本次使用已連線的 Supabase API 查詢實際專案，並以 HTTPS 呼叫正式網站的公開唯讀端點。未建立節目、觸發分析、扣點或修改資料庫。未部署本機 Phase 1–4 變更。

## 通過

- `GET https://showcrafter.vercel.app/api/health/supabase`：HTTP 200，`ok: true`，Supabase 可連線。
- `GET /api/assortments/invalid-test-token/music/jamendo?mode=browse`：HTTP 404，`Assortment unavailable.`，非有效 token 正確拒絕。
- 真實資料庫有 3 個啟用中且套裝仍有效的公開 QR 連結，11 筆 completed Jamendo 分析。查詢時沒有尚未過期的 Jamendo response cache。
- 歷史 QR 節目生成紀錄為 7 筆 completed、3 筆 failed。這是既有紀錄，不能當成本次新程式生成成功的證據。

## 發現：分析格式不相容

有效 QR 連結所對應 funding user 範圍內有 8 筆 completed Jamendo 分析：2 筆 schema 1.4.0、6 筆 schema 1.5.0。

直接取出各一筆完整、未改寫的真實 analysis_json，在本機呼叫現有 `parseStoredAnalyserResult`：

| 曲目                        | 格式  | 結果                                                        |
| --------------------------- | ----- | ----------------------------------------------------------- |
| Athens                      | 1.4.0 | 通過，486 個 beat_times                                     |
| The Positive Corporate Tech | 1.5.0 | 拒絕：schema_version 預期 1.4.0；不認得 bar_grid_confidence |

目前 validator 嚴格接受 1.4.0，另有 1.3.0 相容處理，沒有 1.5.0 相容處理。Phase 4 會略過這類無法解析的分析，將相關候選降為時長推薦；這是資料格式相容性問題，不代表歌曲尚未分析。

需要先查明 1.5.0 的正式契約與產生來源，再加入有驗證的相容處理；不能單純改版本字串或刪欄位就視為通過。

## 尚未執行

- 有效 QR token 的正式瀏覽／搜尋已於使用者明確授權後完成，結果見下方補充。
- 真實匯入、分析、生成及 replay 全流程。
- 本機完整 HTTP 串接：本機環境沒有 Supabase URL/service role、Jamendo client ID、分析服務 URL/secret、Upstash URL/token。
- 新增 Phase 4 的正式端點測試：本次修改仍在本機，正式網站的既有 API 不足以證明新版本端點通過。

以上結果區分了正式公開 API、真實資料在本機的相容性測試，以及尚未執行的端到端驗收。測試報告不包含有效 QR token、私人音檔路徑或服務金鑰。

## 使用者授權後：有效 QR 正式 API 測試

已獲明確授權，使用 `qr_test` token 對 `https://showcrafter.vercel.app` 發送唯讀 GET。沒有呼叫匯入、分析或建立節目的 POST。

| 測試                       | HTTP | 實際結果                                                             |
| -------------------------- | ---- | -------------------------------------------------------------------- |
| 瀏覽 `mode=browse&count=5` | 200  | ok=true，29 首曲目                                                   |
| 搜尋 `q=Athens`            | 200  | 1 首，Athens / Pierce Murphy，track ID 1860165                       |
| 不存在的 genre             | 400  | Unknown genre.                                                       |
| 過短搜尋 `q=a`             | 400  | 要求至少兩個字元                                                     |
| 推薦 `mode=recommend`      | 400  | 落入搜尋參數驗證，要求至少兩個字元；正式網站尚未提供本機新增推薦模式 |

瀏覽與搜尋都回傳 `Cache-Control: private, no-store, max-age=0` 及 JSON content type。回傳曲目已檢查 provider=jamendo、數字 track ID、30–600 秒時長、HTTPS preview URL 與允許的 CC BY／CC0 授權標籤。未重新下載或播放音檔，所以 HTTPS preview URL 存在不等於已驗證音訊播放。

`count=5` 是現有 browse 收集目標，不是最終結果硬上限，因此整批回傳 29 首；本機 Phase 4 的候選合併另外設有 60 首硬上限。

結論：正式既有 Jamendo 瀏覽／搜尋可用，錯誤參數會拒絕。但本機 Phase 4 尚未部署，不能把這次成功當成新推薦模式已上線。分析 1.5.0 相容性問題仍未修正，完整匯入／生成 E2E 也尚未執行。

## 後續修復：1.5.0 讀取相容

本機已補上 1.4.0／1.5.0 的明確支援；1.5.0 必須包含有限且介於 0–1 的 bar_grid_confidence。原有時間順序、總拍數、時間範圍、未知欄位與未知版本檢查均保留，1.3.0 歷史轉換也保留。不更改既有資料的版本或新增資料庫 migration。

用上方同兩筆完整真實資料重新驗證後，Athens 1.4.0 與 The Positive Corporate Tech 1.5.0 均通過；後者保留信心值 0.195 與 242 個 beat_times。新接收的 HTTP analyser JSON 與資料庫讀取共用修復。新增回歸測試確認 1.5.0 已完成分析不再因版本被當成沒有分析。

這是消費端對已觀察到的 1.5.0 格式相容處理；本機 Python 分析器仍輸出 1.4.0，並未升級或重新部署分析服務。此次尚未重新分析音檔，也尚未部署網站。前文的版本失敗是修復前測試結果。
