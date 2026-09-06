# Phase 2：產品節奏匹配

日期：2026-09-06。這輪完成精簡版音樂／產品匹配，沿用既有時槽、段落規則、產品池和安全驗證。

## 實際行為

- fast planner 在現有能量、色彩、效果及重複使用分數上加入時間適配偏好。
- beat planner 在既有 sustained 產品池內按匹配程度排序；固定套裝則對剩餘產品加入時間排序，保留最後一拍的單發優先與精確數量檢查。
- runner 在產品篩選後載入時間資料，fast、beat 及既有 fallback 都使用同一份 profile。
- LLM prompt 收到精簡時間摘要：資料完整度、normal emphasis 參考下的首末 impact、結束時間及間隔統計。自訂 prompt 同樣附加不可虛構物理時間的規則。
- profile 缺省或未知時，時間偏好為零。資料讀取失敗會向上回報，不會轉成「未知但可以繼續」的成功讀取。

## 資料流

`loadProductTimingProfiles` 沿用 replay 的 `fetchShotsByCatalogueItem`，取得子發時間、設計、口徑及角度。僅多發產品增加讀取，每批最多 100 個 catalogue ID；單發直接使用已載入 specification。每次生成計算 normal／accent／peak 三份 profile，不逐 cue 查資料。

新讀取選項 `preserveUnknownTiming` 讓缺失時間進入 profile 時保持未知。原有 replay 呼叫不開啟此選項，繼續保留原本的零秒 fallback。catalogue 讀取使用既有 server client，沒有新增 schema、migration、公開 API 或權限。

固定套裝仍以既有 immutable ledger 決定產品 ID 與數量；時間資料沿用現有 catalogue 子發來源，沒有新增產品設計快照，也沒有將套裝重新展開為可替代的產品清單。

## 匹配計算

在目標時刻附近，以二分搜尋定位既有升序 beat array，再取附近有效 beat gaps 的中位數。附近無有效間隔時才使用分析的 BPM；沒有可用 BPM 則為未知。沒有新增 beat detector。

對整組已解析 impact intervals，分別嘗試同一個比例 `r ∈ {0.5, 1, 2}`：

1. `target = localBeatInterval × r`
2. `tolerance = max(0.04 秒, target × 0.12)`
3. 每個間隔得分：`clamp(1 - abs(interval - target) / tolerance, 0, 1)`
4. 每個比例取所有間隔的平均分；選三種比例中的最高值。
5. 乘上 Phase 1 的 `regularityScore`，結果為 0–1。

同時齊發的零間隔保留；不會刪掉後把剩餘部分描述為完美連發。不完整 profile、少於兩個間隔或 regularity 未知時不計 cadence 分數。

40ms／12% 是第一版排序容差，尚未經實物量測或人工聽感校準，不是物理精度承諾。

角色偏好限制在 -0.5 到 0.5：單發在重拍／高潮／結尾增加 0.3；chorus／drop／buildup 的 cadence 項為 `(compatibility - 0.5) × 0.35`；高潮或 finale 再加同項 ×0.18。較長效果與不規則效果在較疏的段落增加小幅偏好（0.16／0.12），chorus／drop 重拍增加 0.08。長效果門檻 2.5 秒、不規則門檻 0.65 是可調整的初始策略，並非新的硬限制。結束時間包含 renderer 尾焰與煙霧，不能當成視覺強度的量測。

## 同一個 120 BPM 固定套裝的前後比較

測試曲：60 秒；套裝：一個單發、兩個各四發且其他主要產品特徵相同的 cake。兩個 cake 的子發間隔分別為 0.50 秒與 0.73 秒，各產品數量均為一。

| Planner      | 修改前                                     | 修改後                                     |
| ------------ | ------------------------------------------ | ------------------------------------------ |
| fast         | 4 秒放 0.50s cake；28 秒高潮放 0.73s cake  | 4 秒放 0.73s cake；28 秒高潮放 0.50s cake  |
| beat         | 16 秒放 0.50s cake；28 秒高潮放 0.73s cake | 16 秒放 0.73s cake；28 秒高潮放 0.50s cake |
| 兩者最後一拍 | 52 秒由單發命中                            | 同樣由單發命中                             |

以上是實際執行 planner 的合成 fixture 結果，不是人工觀看預覽或線上生成的結論。每個產品仍使用一次；另有重複數量測試。

## 驗證與限制

新增 18 項測試，涵蓋節拍比例、不規則／同時發射、不同局部 tempo、資料缺失、兩種 planner 的前後差異、精確數量、非 QR 呼叫相容性、LLM 摘要和實際 query／mapper 的受控 I/O 測試。完整測試 707/707 通過。

本輪改變產品選擇排序，沒有改變多發排程的時間原點：slot 仍代表序列開始，cadence 相容不保證每次爆開都精確對拍。尚未做多發第一個可見 impact 的相位補償、跨整段變速的相容性評估、LLM 結果的強制適配修復、0–100 品質門檻或歌曲推薦。

尚未執行線上資料庫查詢、真實 QR 生成或人工配樂預覽；資料讀取測試使用受控 client，保留真實 query、mapper 與 profile 計算。下一階段應先加入有限候選修復和人工案例比較，再決定品質門檻。
