# Data tables / データの編集方法

All tables are plain **CSV (UTF-8)**. Open them in Excel, Google Sheets, Numbers, or any text editor.
Save as **CSV UTF-8** so names do not turn into garbled text.
Lines starting with `#` are ignored.

すべて **CSV（UTF-8）** です。Excel・Googleスプレッドシート・テキストエディタで編集できます。
保存するときは必ず **「CSV UTF-8」** を選んでください（文字化け防止）。

---

## a_fes_members.csv — table a: who uses which color at each stage

One row = one member at one stage (a live, a day, or a block — anything you want to choose separately).

| column | required | meaning |
|---|---|---|
| `stage_id` | ✔ | Short ID with no spaces, e.g. `fes6-day1`. Rows with the same ID form one stage. |
| `stage_name_en`, `stage_name_ja` | ✔ (one) | Name shown in the stage list. You can add `stage_name_ko`, `stage_name_zh-Hans`, `stage_name_zh-Hant`, `stage_name_id`. |
| `date` | | `YYYY-MM-DD` |
| `member_id` | ✔ | Stable ID, e.g. `hoshimachi_suisei`. Used for "my oshi". |
| `name_en`, `name_ja`, `name_ko`, `name_zh-Hans`, `name_zh-Hant`, `name_id` | ✔ (one) | Member name per language. Empty ones fall back to English, then Japanese. |
| `oshi_mark` | ✔ | The oshi mark emoji. |
| `color_key` | ✔ | Must match a `color_key` in table b (e.g. `lightblue`). This links the member to a penlight color slot. |
| `color_name_en`, `color_name_ja` | | Optional name for this color as fans call it. |
| `color_hex` | ✔ | Color code, e.g. `#2F6BFF`. Shown as a soft "penlight glow". |
| `image` | | Optional image path/URL (debug mode overlay). Only use images you are allowed to use. |
| `verified` | | `yes` when checked against an official source. |
| `source` | | URL of the source you checked. |
| `note` | | Anything else. |

## b_penlight_colors.csv — table b: penlight color order

One row = one color slot of one penlight, in the order the button cycles.

| column | required | meaning |
|---|---|---|
| `penlight_id` | ✔ | Short ID, e.g. `kb-x10-15c`. |
| `penlight_name` | ✔ | Name shown in the list. |
| `order` | ✔ | 1, 2, 3 … the order you get by pressing the "next" button. |
| `color_key` | ✔ | Shared key used by table a. Use the same key for "the same color" across penlights. |
| `color_name_en`, `color_name_ja` (+ other languages) | | Display name of the color. |
| `color_hex` | ✔ | Approximate LED color. |
| `note` | | |

## c_penlight_specs.csv — penlight specs (debug page 14)

`penlight_id, penlight_name, maker, release, length_cm, screw (coin / precision), oshi_button (yes/no), brightness_button (yes/no), color_count, battery, note, verified, source`

## contributors.csv — credits

`name, fan_name, color_vision_type (C/P/D/T/A or empty), role`

Color vision type is personal (health-related) information. **Only add it with the person's clear permission**, and leave it empty if they prefer.
色覚タイプは個人の健康に関わる情報です。**必ず本人の同意を得てから**記入し、希望しない人は空欄にしてください。

---

After editing, commit the CSV to GitHub. The page reads the newest tables when online and keeps the last copy for offline use.
