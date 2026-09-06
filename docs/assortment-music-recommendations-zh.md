# Phase 4：固定煙花套裝推薦歌曲

## 本次交付

QR 選歌頁新增「Recommend music for me」，保留搜尋、分類瀏覽、試聽及「Use my own song」。推薦列表顯示曲名、演出者與簡短理由，不顯示內部分數。選曲仍然只更新頁面狀態，最後按 Generate show 才進入既有匯入、分析、建立節目流程。

## 架構與成本

`GET /api/assortments/[token]/music/jamendo?mode=recommend` 沿用有效公開 token、啟用套裝、服務端 funding user、durable rate limit 與 private/no-store 回應。

1. 沿用 Jamendo 已過濾可下載授權的 browse API，取一般、ambient、electronic 三個有界頁面。各頁請求目標 20 首；provider 分頁可能回傳較多，因此合併去重後硬限 60 首。
2. 只查套裝內產品（本路徑上限 100 種），以 Phase 1 timing profile 計算數量加權特徵。查詢錯誤及缺少產品均失敗，不當作空套裝。
3. 查該 funding user 已完成的 Jamendo song_analyses，限定候選 ID、completed、非空 analysis_json、最近完成優先，最多 300 列。重用既有 schema validator；無效歷史資料不充當證據。
4. 確定性排序，最多回傳五首。只輸出 provider 歌曲與文字理由，不回傳分析 JSON、使用者 ID、私人音檔位置或分數。

瀏覽沒有新分析、下載、Storage 寫入、LLM 呼叫、點數預留或節目建立。重用既有 Jamendo 五分鐘瀏覽快取，已完成分析直接讀取，不重複計算。

**這一版沒有自動分析未選中的候選曲目。** 沒有可重用分析的歌曲只以時長初步推薦，介面明示「rhythm has not been analysed」。使用者選曲並按 Generate 後，才走既有可重用分析／付費分析流程。推薦使用的分析特徵可重用，不代表原音檔仍存在或可免除匯入時的既有重用資格檢查。

## 排序公式

套裝特徵包含總件數、已知 timing 件數、單發件數、規則節奏件數、持續時間至少八秒的件數，以及高密度序列件數。高密度定義為至少四發且平均每秒至少兩個 impact，是 timing 推估，並非實際視覺威力。所有完整 timing 的總 duration × quantity 為序列容量；只要有未知產品 timing，整包 duration 容量保持未知。

各項 fit 在 0–1，分數為 `round(100 × Σ(fit × weight) / Σweight)`。未知維度不加權，時長未知用中性 0.5；相同分數按 track ID 排序。

| 維度     | 權重與算法                                                                                 |
| -------- | ------------------------------------------------------------------------------------------ |
| 時長     | 60；r = 曲長／套裝容量。r ≤ 1 時 0.45 + 0.55r，否則 exp(-2.5(r-1))                         |
| 節奏     | 20 × 規則產品比例；沿用實際 interval 的 cadenceCompatibility，加上已知 beat stability 調節 |
| 動態     | 10；energy range、section contrast、climax prominence 對照套裝持續／密集產品比例的目標動態 |
| 緩和速度 | 稀疏套裝加權 10；90 BPM 以下滿分，更快時逐步降低                                           |
| 結尾     | 10 × 高密度產品比例；使用 finale window 能量，缺省以末四分之一音樂的能量估計               |

正面理由只在對應 fit 足夠時顯示。數值是有界啟發式，不是成功機率或節奏品質保證。最終生成仍受原有產品數量、發射安全及 Phase 3 品質／修復流程約束。

## 驗證與限制

自動測試覆蓋短包避免過長歌曲、穩定拍點、強結尾、稀疏包較慢音樂、未知 timing、無分析標示、候選去重與上限、provider membership、分析重用、owner scope、資料庫失敗。既有 provider 授權與不可用曲目測試及 QR 上傳／生成測試一起執行。

本機 Chrome 手機尺寸 smoke test 以模擬 API 驗證推薦理由、切換 browse、選曲、自行上傳；沒有發送寫入請求。它不代表真實 Jamendo 預覽音訊、Supabase、分析服務及生成整段煙花的 E2E／人工聽感驗收。

候選池有限，不保證全站最佳曲目；新的 funding user 通常沒有已分析候選，會先得到時長推薦。最多 300 筆分析的限制可能使更舊的候選分析未被取到。未建立全站共享分析庫或背景預分析排程。套裝 capacity 是順序播放時長估計，未模擬完整編排可持續時間；climax/ending 使用密度代理，尚非完整視覺類型分類。這些限制不應被包裝成全面音樂理解推薦。

手動驗收：開啟有效 `/a/<token>` → Recommend music for me → 檢查曲名、理由與試聽 → Use track → Generate show → 確認進度、結果與套裝數量。再測搜尋、自行上傳、無效／撤銷 token、推薦服務失敗、曲目在匯入時不可用。正式服務與人工聽感驗收尚未執行。
