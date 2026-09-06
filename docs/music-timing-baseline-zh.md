# 音樂編排時間模型：基準盤點與第一輪範圍

盤點日期：2026-09-06。依本地 checkout 的程式與測試判讀；沒有驗證線上部署或實物煙花時間。

## 現有流程

固定套裝 QR → 音樂分析 → 共用 cue slots → fast／beat／LLM 編排 → 共用安全與精確數量驗證 → 品質檢查及既有 beat fallback → 儲存 → 子發展開與配樂預覽。

- `services/music-analyser/showcrafter.py`、`lib/show-analysis.types.ts`：分析契約包含節拍、重拍、小節拍數、onset、能量時間序列、段落、關鍵時刻、buildup、finale window、音樂特徵與 show personality。部分欄位在舊分析中可缺省。
- `lib/beat-grid.server.ts`：已使用節拍／重拍、段落能量、高潮、buildup、finale 及部分 onset 建立時槽，並依段落決定密度和 emphasis。不是所有原始分析欄位都直接控制排程。
- `lib/cue-generation/prompt.ts`：將段落、節拍概況、重拍、降採樣能量、高潮、buildup、derived metadata 和 personality 提供給 LLM。分析服務的文字效果建議不是產品物理時間的來源。
- `fast-planner.ts`：依風格、段落、產品特徵及可用數量作本地選擇。
- `beat-sync-planner.ts`：以音樂 anchors 和多位置 moments 排程，包含固定套裝及 final-hit 處理。
- `runner.server.ts`：分派生成模式、驗證 LLM 結果、執行 fallback，最後重新檢查安全與套裝精確數量。

## 已確認的時間邊界

`impact-timing.ts` 將單發的目標爆開時間減去升空估計，取得發射時間。估計使用 design、calibre、emphasis。無法在配樂開始後及時升空的單發不會被強行截到零秒。

多發產品目前將整組序列開始對齊 slot，並不保證第一個子發爆開對拍。

真正的 catalogue 子發來源在 `lib/shows/queries.server.ts` 的 `fetchShotsByCatalogueItem`：`multishot_fireworks` 提供 sequence index、時間偏移、pan、tilt、位置和 calibre，並解析各子發的 firework specification。`expandReplayCues` 將父 cue 時間加上子發偏移。`FireworkSpecification` 本身不包含這組完整已解析子發，不能僅憑父產品時長和 shot count 重建真實節奏。

`lib/fireworks/timing.ts` 已提供 design 的升空、效果開始、fade 與結束估計；`FireworksEngine.ts` 使用 calibre、emphasis 和子發角度。現有單發 planner 的升空估計預設零 pan，不能將它描述為對所有角度都已精確補償。

`components/replay/FireworkReplayViewer.tsx` 在音訊有效播放時以 `audio.currentTime` 推進預覽；音訊時鐘不可用時另有 fallback。因此第一輪不需要新增播放時鐘。

## 品質檢查與缺口

`quality.ts` 目前回傳段落覆蓋、多位置強時刻覆蓋、最大空檔及 issues，沒有 0–100 音樂同步總分。它接收 cue 層的 impact timestamp，不接收子發 timing profile；目前多發的該時間代表序列開始。

- 硬性品質問題：缺少最後音樂 hit、prompt constraint 違反。
- 軟性問題：缺少段落、空檔過長、強時刻協同不足、未使用發射位置。
- 安全、有效產品、套裝精確數量在 runner 的其他邊界另外處理，不能只看品質 issue 列表。
- 最後一輪 deterministic repair 條件：有 issue、原始模式不是 beat，且沒有固定套裝 ledger 或至少有一個 hard issue。LLM 分支另有較早的驗證與 fallback。
- 因此固定套裝僅有軟性問題時可完成；原始 beat 模式不會在此處再次 repair。
- 現有 repair 會替換 accepted cues，並非同時保留兩個候選再選擇。若未來比較品質，需要先將候選隔離，再逐個驗證硬限制。

## 第一輪實作界線

新增純計算時間 profile 和針對性測試。以既有 renderer 時間函式與呼叫端提供的已解析子發為輸入，保留不等距和同時發射，區分完整／未知資料。

此模型描述模擬估計，不宣稱實物量測精度。分開記錄發射偏移、可見效果開始和效果結束；尾焰結束不等同最後一次爆開。未知子發不能用平均間隔填補。

第一輪不接入 planner，不更改 renderer、數量、QR snapshot、UI、LLM 或資料庫。這使時間模型可獨立驗證，但不代表預覽編排品質已改善。

實作入口：`lib/fireworks/timing-profile.ts` 的 `buildProductTimingProfile({ product, emphasis, children? })`。`children` 可接收既有已解析 catalogue 子發的結構（`firework`、`timeOffsetSeconds`、`panDegrees`），不新增持久化欄位。所有偏移相對產品點火時間；單發 launch offset 為零。

輸出包含宣告／已解析發數、資料完整度、按 impact 排序的各發時間、首末 impact、整體結束時間和 interval min／max／mean／median。`regularityScore = clamp(1 - (max - min) / mean, 0, 1)` 僅描述間隔均勻程度，不代表音樂適配分數；不足兩個間隔或全部同時齊發時為 `null`。缺失或無效子發只保留有效的個別估計，不發佈完整產品的時間或 cadence 結論。未宣告發數時，呼叫端提供的子發清單須為完整清單。

驗證：既有 generation 基準 144/144；新增時間模型測試 14/14；最終完整測試 689/689。人工試聽與實物時間量測尚未執行，因為本輪未改變生成行為。

## 後續最小順序

1. 以小批既有產品驗證 profile 與預覽時間一致，確認缺失資料的比例。後續接入時沿用既有 server 讀取邊界，保留讀取錯誤與真正缺失的區別。
2. 在現有 fast／beat 選擇中加入局部節拍與 cadence 相容性，先不另建完整音樂角色或段落語法。LLM 僅取得相同計算 metadata。
3. 使用固定歌曲／套裝做前後比較，再加入有限一次的候選修復。保留較佳且通過所有硬限制的方案；演算法沒有找到方案不等於物理上不可能。
4. 分數先記錄、校準再決定是否阻擋完成。人工配樂預覽比較應從行為改動開始，不等到全部階段結束。
5. 歌曲推薦獨立延後。

Phase 2 預計涉及 planners、產品資料載入、prompt 與 generation tests；Phase 3 涉及 quality、runner、QR generation tests。第一輪不需要 migration 或 feature flag，因為不改生成行為。未來新增資料讀取需注意延遲、snapshot 語義及非 QR 相容性；行為改動宜先限縮 rollout 並保留舊路徑。
