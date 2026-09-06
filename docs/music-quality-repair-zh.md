# Phase 3：品質比較與有限修復

日期：2026-09-06。本輪採用精簡方案：品質指標用於候選比較和記錄，尚未設定 85 分等硬性通過門檻。

## 決策流程

1. 保留原始 cue 清單及實際產生它的 planner。若前面的 LLM fallback 已使用 beat planner，不再重跑相同修復。
2. 候選先檢查有效產品、slot 與發射時間，再執行既有儲存時間取整、安全處理、精確套裝 ledger 及 prompt constraint 驗證。
3. 非 beat 原方案若有硬性問題、段落／空檔／強時刻問題，或時間證據明顯偏弱，就嘗試一次現有 beat planner。只有未使用發射位置的警告不會觸發修復。
4. beat 候選走相同驗證流程，不能靠較高分數繞過硬限制。兩者均有效時，比較整數比較分數；同分優先警告較少者，仍相同則保留原方案。
5. 修復較差、無效或規劃拋錯時，保留原本有效的方案。兩者皆無效則生成失敗，不進入儲存完成流程。

固定 QR 套裝不再豁免軟性節奏問題的修復。若嘗試後仍有軟性警告，保留較佳有效方案並記錄殘留問題；此版本沒有承諾所有完成方案均達某個主觀品質門檻。沒有找到有效候選也不等於證明實物上不可能。

## 時間指標

`evaluateMusicSync` 只使用完整 profile 和實際 launch timestamp：

- 單發：`actualImpact = launch + firstImpactOffset`，與指派 slot 比較。不能僅靠 cue 自稱的 impact time 得到滿分。
- 多發：檢查序列開始是否對齊指派 slot，沿用 Phase 2 的時間契約。
- 規律多發：regularity 至少 0.65 時，另用 Phase 2 的 cadence compatibility。
- 不規則／sustained 多發：不逐發要求對拍，也不把不規則 cadence 當成精準連發失敗。
- profile、launch 或 slot 證據缺失時不評分，回傳 `null`，並回報已評估／總 cue 數。

Anchor accuracy 為 `clamp(1 - abs(actualAnchor - slotTime) / 0.12, 0, 1)` 的平均。時間分數使用 anchor 70%、cadence 30%；某項無證據時，僅在可用項之間重新正規化，再轉成 0–100 整數。0.12 秒是初始啟發式容差，尚未經實物或聽感校準。

Anchor accuracy < 0.8 或 cadence score < 0.5 只會要求一次修復，不會直接拒絕生成。門檻集中在 `MUSIC_REPAIR_TRIGGERS`。

## 候選比較分數

`comparisonScore = round(30 × sectionCoverage + 25 × coordinatedStrongCoverage + 15 × gapQuality + 30 × timingScore/100 × evidenceCoverage)`。

- `gapQuality`：最大空檔在既有允許值內為 1，否則為 `allowedGap / maximumGap`；一般允許值 8 秒，sparse 為 12 秒。
- 有完整 profile 時，使用各子發的 impact 至 end 區間合併後計算空檔；未知產品只提供原有 anchor 點，不假造持續覆蓋。
- `evidenceCoverage` 為已評估 cue 數除以總數。未知 timing 不會被算成完美同步。
- 單發最後一拍在已知時間模型下使用真正估計的 visible impact；多發仍保留既有序列開始契約。

比較分數是初始排序策略，不是視覺品質的量測。效果區間包含 renderer 尾焰與煙霧；其存在不代表仍有強烈視覺效果。尚未加入完整能量／視覺強度模型或跨段變速評估。

## 實際測試案例

沿用 Phase 2 的 120 BPM、60 秒、三件固定套裝 fixture，實際呼叫 fast 與 beat planner，再經候選選擇器比較：

| 指標     | 原 fast 方案 | beat 修復方案 |
| -------- | ------------ | ------------- |
| 比較分數 | 68           | 78            |
| 時間分數 | 85           | 85            |
| 產品數量 | 每件一次     | 每件一次      |
| 最後一拍 | 52 秒，單發  | 52 秒，單發   |
| 最終選擇 | 保留作比較   | 採用          |

改善來自結構覆蓋與空檔項，而非聲稱 timing 分數提高。該固定套裝案例仍保留兩項 missing-section 及一項 long-gap 警告。這是合成案例，尚未完成真人配樂觀看或線上 QR 驗證。

## 日誌與驗證

新增結構化事件包含原始／修復 planner、比較分數、時間分項、issue kinds、失敗分類、修復是否嘗試／採用及殘留 issues。不記錄原始音訊、prompt 文字、產品名稱或 capability token。這輪無資料庫 migration，指標先記錄在 server 日誌，不新增 UI 分數或永久品質欄位。

新增 19 項測試：候選優劣／同分／拋錯、QR 精確 ledger、最後一拍、prompt 與未知產品硬失敗、beat 不重複修復、未知時間證據、單發／多發評估、尾焰空檔，以及真實 planner 的固定套裝比較。完整測試 726/726 通過；型別、格式、排除舊 `platform/.next` 後的原始碼 lint 與 build 通過。

原始 `npm run check` 仍因既有 `platform/.next` 生成檔的 lint 報錯失敗。沒有刪除生成檔或放寬 repository 設定。

## 檔案

- `lib/cue-generation/music-sync-quality.ts`：時間證據指標。
- `lib/cue-generation/quality.ts`：既有 evaluator 的比較分數與效果區間空檔。
- `lib/cue-generation/choreography-repair.ts`：一次候選修復與選擇。
- `lib/cue-generation/runner.server.ts`：共用驗證、實際 planner 追蹤、完成前選擇與日誌。
- `tests/generation/choreography-repair.test.mjs`、`music-sync-quality.test.mjs`、`music-matching-integration.test.mjs`、`assortment-final-hit.test.mjs`：驗證及既有整合契約更新。

Phase 4 歌曲推薦尚未開始。建議下一步先以少量真實歌曲／套裝人工觀看，校準指標，再決定是否增加完成門檻。
