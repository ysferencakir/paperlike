# Üç Animasyon — Araştırma ve Plan

Bu üç animasyon uygulamanın "kitap hissi" iddiasının kalbinde: raf görünümü, kitap açılış animasyonu,
sayfa çevirme. Aşağıda her biri için ne yapılabilir/yapılamaz araştırması ve seçilen teknik yaklaşım var.

## Genel mimari kısıtlar (hepsini etkiliyor)

- **EPUB içeriği bir `<iframe>` içinde** (epub.js kendi pagination motorunu çalıştırıyor). Bu, iframe
  içeriğini canvas'a "yakalayıp" (screenshot) fiziksel olarak kıvırmayı imkansız kılmıyor ama ciddi
  şekilde zorlaştırıyor: `html2canvas` gibi bir kütüphane gerekir, performansı kitabın karmaşıklığına
  göre değişir, ve her sayfa geçişinde yeniden yakalama gerekir (maliyetli). **Karara**: iframe içeriğini
  yakalamak yerine, DOM/CSS 3D transform teknikleriyle çalışıyoruz.
- **PDF sayfaları gerçek `<canvas>`** (react-pdf/pdf.js). Bu, PDF için canvas tabanlı gerçek piksel
  warping teoride mümkün kılıyor, ama iki farklı teknik (EPUB için DOM/CSS, PDF için canvas/WebGL)
  bakım yükünü ikiye katlıyor. **Karara**: tutarlılık için ikisinde de aynı DOM/CSS tekniğini kullanıyoruz;
  ileride sadece PDF'e özel bir "gerçek kıvrılma" modu ayrı bir faz olarak eklenebilir.
- **Hazır kütüphaneler** (turn.js, react-pageflip) araştırıldı ve reddedildi:
  - `turn.js`: jQuery bağımlılığı (React ile çakışır), **non-commercial lisans**, bakımı bırakılmış
    (385 açık issue, site sertifikası süresi dolmuş).
  - `react-pageflip`/StPageFlip: MIT lisanslı, aktif, ama **sabit/kesikli sayfa elemanları** bekliyor —
    epub.js'in dinamik/reflowable pagination motoruyla kökten uyumsuz (kullanmak için epub.js'in tüm
    sayfalama sistemini değiştirip kendi sayfalamamızı yazmamız gerekirdi).
  - **Karar**: kendi hafif DOM/CSS + framer-motion çözümümüzü derinleştiriyoruz.

---

## 1. Raf Görünümü (Kütüphane)

**İstenen davranış:**
- Varsayılan: kitaplar rafta yan yana, sadece **cilt (spine)** görünüyor — dar, üzerinde başlık dikey yazıyor.
- Hover: o kitap raftan çıkıp **ön yüzünü** gösteriyor (kapak görseli), diğer kitaplar **bulanıklaşıyor**
  (derinlik/odak hissi).

**Teknik yaklaşım — gerçek 3D kutu:**
Her kitap, `perspective` içeren dar bir hücrede duran, `transform-style: preserve-3d` ile iki yüzü olan
bir "kutu": 
- **Cilt yüzü** — hücrenin tam genişliğinde (dar, örn. 34px), dikey başlık metni, spine-benzeri renk
  (kapak yoksa hash tabanlı gradient, kapak varsa kapağın kenar rengi). Dinlenme durumunda `rotateY(0)`
  ile tam görünür.
- **Kapak yüzü** — tam kapak genişliğinde (örn. 108px), cildin sol kenarına menteşelenmiş gibi
  `rotateY(-90deg)` ile cildin *arkasına* katlanmış, dinlenme durumunda görünmez.
- Hover'da: tüm kutu `rotateY(90deg)` döner → cilt yüzü kenara döner (görünmez olur), kapak yüzü öne
  gelir (görünür olur) + kutu hafifçe öne/yukarı kayar (raftan çıkma hissi) + z-index yükselir (diğer
  kitapların üzerine binmesin diye).
- **Bulanıklaşma**: JS state yerine saf CSS — raf konteynerinde `:has(.book:hover) .book:not(:hover)`
  seçicisiyle `filter: blur() brightness()`. Modern tarayıcılarda (`:has()` desteği 2023+) güvenilir.

**Neden bu iş?** Aynı `perspective`+`rotateY`+`backface-visibility` tekniği zaten kitap açılış
animasyonunda kanıtlandı (çalışıyor, donmuyor). Raf görünümünde bunu tersine (cilt→kapak) kullanmak
tutarlı ve düşük riskli.

---

## 2. Kitap Açılış Animasyonu

**Mevcut durum:** Kapak `rotateY` ile açılıyor, arkasında düz sayfa bloğu var, backface düzeltildi.
İyi ama "gerçekçilik" için eksik olan: fiziksel bir nesne hissi (ağırlık, hafif sekme), sayfa yığınının
tekli değil çoklu kenar hissi, kapağın attığı yönlü gölge.

**Eklenecekler:**
1. **İki aşamalı hareket** — önce kitap hafifçe "eline alınıyormuş" gibi ölçeklenip belirginleşiyor
   (150ms), SONRA kapak açılıyor (650ms). Tek düz hareket yerine "önce tut, sonra aç" ritmi.
2. **Sayfa yığını fanı** — tek düz blok yerine, hafif kaydırılmış 3 ince katman (en alttaki en açık ton,
   üsttekiler giderek koyulaşan) — gerçek bir sayfa yığınının kenarı gibi.
3. **Yönlü gölge** — kapağın üstüne binen düz siyah katman yerine, dönüş açısına bağlı bir
   `linear-gradient` gölgesi (cildin menteşe tarafından başlayıp yayılan) — daha fiziksel.
4. **Hafif "settle" sekmesi** — bitişte küçük bir overshoot (spring benzeri easing) — kağıdın oturması.

---

## 3. Sayfa Çevirme — Çok Şeritli (Multi-Strip) Kıvrılma

**Araştırma:** Gerçek CSS-only "page curl" efektleri genelde iki aileden birine giriyor:
- (a) **Tek düzlem rotateY** (şu an bizde olan) — basit, güvenilir, ama düz bir kart gibi döner,
  "kağıt eğilmiyor".
- (b) **Çok şeritli (multi-strip) yaklaşım** — sayfa N dikey şeride bölünür (8-12), her şerit bir
  öncekinden biraz daha fazla `rotateY` + hafif `skewY`/gölge alır → şeritler birlikte bir silindirin
  yüzeyini taklit eder, kağıt kıvrılıyormuş illüzyonu oluşur. turn.js/StPageFlip'in matematiksel temeli
  de özünde bu fikrin (parametrik eğri ile) daha gelişmiş hali.
- (c) **Canvas/WebGL piksel warping** — en gerçekçisi ama EPUB (iframe) için pratik değil, PDF için bile
  ek karmaşıklık/bağımlılık riski taşıyor.

**Karar: (b) — çok şeritli kıvrılma**, hem EPUB hem PDF'te aynı teknikle:
- Sayfanın DOM/canvas içeriği **değiştirilmiyor** — üstüne 8-10 dikey şeritten oluşan bir "overlay kılıf"
  bindiriliyor (her şerit o bölgenin arka plan rengini/gölgesini taşıyan saydam bir parça), her şerit
  `transform-origin` sayfa kenarında, `rotateY` açısı şerit indeksine göre kademeli artıyor
  (0°'den ~130°'ye), süre boyunca `requestAnimationFrame` veya framer-motion ile senkronize animasyonlu.
- Bu, alttaki gerçek içeriği (metin, seçilebilirlik) BOZMUYOR — sadece görsel bir "kıvrılma kılıfı"
  geçiş anında üstüne biniyor, geçiş bitince kayboluyor ve gerçek yeni sayfa zaten hazır durumda oturuyor.
- EPUB'da: kılıf, `containerRef`'in üstüne mutlak konumlu bir overlay olarak enjekte edilir (iframe'e
  dokunmadan — iframe'in kendi içeriği hiç değişmez, sadece üstüne geçici bir görsel kılıf biner).
- PDF'te: aynı kılıf tekniği, mevcut `motion.div` sarmalayıcısının üstüne eklenir.

**Kapsam notu:** Bu, "gerçek kağıt fiziği" (StPageFlip'in yaptığı parametrik eğri + sürükle-bırak ile
canlı kıvrılma) değil — tek yönlü, otomatik oynayan bir geçiş animasyonu. Ama şu anki düz `rotateY`'den
belirgin şekilde daha "kıvrılıyor" hissi verecek, ve donma riski taşımıyor (içeriğe dokunmuyor, sadece
üstüne geçici bir katman biniyor).

---

## Uygulama sırası

1. Raf görünümü (bağımsız, kütüphanede — reader'ı etkilemez)
2. Kitap açılış animasyonu (mevcut bileşeni derinleştirme)
3. Sayfa çevirme çok şeritli kıvrılma (en riskli/karmaşık, en çok test gerektirir — EPUB ve PDF ayrı ayrı doğrulanacak)

Her adımdan sonra build + lint + dev server canlı kontrolü yapılacak.

---

## Kod Tabanı Araştırması — Mevcut Durum ve Somut Uygulama Adımları

Yukarıdaki plan yazıldıktan sonra kod tabanı tarandı: **üç animasyonun da temel iskeleti zaten
uygulanmış durumda** (Faz 3, `TODO.md`'de ✅ işaretli). Aşağıda her madde için gerçek dosya/satır
referansları ve halihazırda YAPILMAMIŞ, eklenmesi gereken kısımlar var.

**Stack notu:** `next@16.2.11`, `react@19.2.4`, `framer-motion@^12.42.2`, `tailwindcss@^4`. 3D efektlerin
hepsi framer-motion veya ham CSS `@keyframes` ile yapılıyor — `@react-three/fiber`, `gsap` gibi ek
kütüphane yok, eklenmesi de planlanmıyor. `node_modules/next/dist/docs/01-app/` altında `"use client"`
sınırları ve olası View Transitions API dokümantasyonu var; yeni bir sayfa-geçişi tekniği denenecekse
kod yazmadan önce oradan kontrol edilmeli (AGENTS.md kuralı).

### 1. Raf Görünümü — DURUM: uygulanmış, ince ayar kaldı

- `components/library/ShelfView.tsx` — grid `auto-fill` sütunları (`SPINE_WIDTH=34px`), satır yüksekliği
  `184px`, `repeating-linear-gradient` ile raf desenli arka plan (`PLANK_HEIGHT=10px`).
- Her kitap gerçek iki-yüzlü 3D kutu (`ShelfBook`, satır 74-210): cilt yüzü dinlenmede `rotateY(0)`
  görünür, kapak yüzü `rotateY(90deg)` ile katlı.
- Hover varyantları (satır 30-39) zaten iki aşamalı — plandaki "önce öne çık, sonra dön" fikri kodda
  şu şekilde:

  ```js
  const bookVariants = {
    rest: { rotateY: 0, x: 0, z: 0, scale: 1 },
    open: { rotateY: [0, 0, -102], x: [0, 0, -34], z: [0, 46, 14], scale: [1, 1.1, 1.02] },
  };
  const BOOK_TRANSITION = { duration: 0.55, times: [0, 0.38, 1], ease: [0.33, 1, 0.4, 1] };
  ```

- Bulanıklaşma zaten `:has()` ile CSS-only (`app/globals.css:228-229`):

  ```css
  .shelf-grid:has(.shelf-book:hover) .shelf-book:not(:hover) { filter: blur(2.5px) brightness(0.86); }
  ```

- Hover state 150ms leave-delay timer ile sabit dış wrapper'da tutuluyor (satır 106-116) — kutu
  hareket ederken imlecin altından kaçmasını önlemek için.
- Bilgi kartı (başlık/yazar/format) bilinçli olarak dönen kutunun **kardeşi**, çocuğu değil (satır
  189-206) — `preserve-3d` metni de döndürmesin diye.

**Eksik/geliştirilebilir:** Plandaki "kapak yoksa hash tabanlı gradient, kapak varsa kapağın kenar
rengi" fikri kısmen var (`lib/book-color.ts` hash fallback + `lib/extract-cover-color.ts` gerçek kapak
rengi) — ek iş gerekmiyor, doğrulama yeterli.

### 2. Kitap Açılış Animasyonu — DURUM: 3/4 madde uygulanmış, "sayfa yığını fanı" eksik

`components/reader/BookOpenTransition.tsx` (114 satır, framer-motion `AnimatePresence`):

```js
const HOLD_MS = 850;
const OPEN_TIMES = [0, 0.16, 0.88, 1];
const ROTATE_KEYFRAMES = [0, 0, -128, -122];   // overshoot sonra yerleşme
const SCALE_KEYFRAMES = [1, 1.05, 0.96, 0.96];
const OPEN_DURATION = 0.85;
const OPEN_EASE = [0.33, 1, 0.4, 1];
```

- ✅ **İki aşamalı hareket** — `visible` state 850ms tutuluyor, sonra `AnimatePresence` exit'i tetikliyor;
  `SCALE_KEYFRAMES` ile "ele alma" hissi zaten var (satır 51-53).
- ❌ **Sayfa yığını fanı** — YOK. Şu an sadece ön yüz (kapak) + arka yüz (`PAGE_COLOR = "#f9f6ee"` düz
  blok, satır 99-106) var. Plandaki 3 kademeli ince katman eklenmemiş.
- ✅ **Yönlü gölge** — `opacity: [0, 0, 0.85, 0.85]` ile hinge tarafından yayılan gradient zaten var
  (satır 89-95).
- ✅ **Settle sekmesi** — `ROTATE_KEYFRAMES`'teki `-128 → -122` overshoot zaten bunu yapıyor.

**Somut ekleme planı (sayfa yığını fanı):** `BookOpenTransition.tsx` içinde arka yüzün (satır ~99-106)
arkasına, aynı `preserve-3d` konteynerin içine 3 ekstra `motion.div` eklenecek:

- Her biri `PAGE_COLOR`'ın giderek koyulaşan bir tonu (`#f9f6ee` → `#efe9da` → `#e5ddc9`), z-index'te
  arka yüzün altında.
- `transform: translateX(2-4px) translateY(1-2px)` kademeli offset (kenardan taşan sayfa hissi), CSS
  `filter: brightness()` ile ton farkı yerine ayrı hex renk kullanmak `next@16` + Tailwind v4'te de
  sorunsuz çalışır.
- Aynı `ROTATE_KEYFRAMES`/`OPEN_TIMES` timeline'ına bağlanacak ama her katman 5-8° geriden gelen bir
  `delay` ile (stagger) — kağıtların birbirini takip ederek açılması hissi.
- `backfaceVisibility: hidden` şart değil çünkü bu katmanlar hep arkada duruyor, hiç öne dönmüyor.

### 3. Sayfa Çevirme Çok Şeritli Kıvrılma — DURUM: tamamen uygulanmış

`components/reader/PageCurlOverlay.tsx` — plandaki "(b) çok şeritli yaklaşım" kararı birebir kodda:

```js
const STRIP_COUNT = 10;
const STEP_DELAY = 0.02;
const STRIP_DURATION = 0.38;
// initial={{ rotateY: 0 }}
// animate={{ rotateY: isNext ? -150 : 150 }}
// transition={{ duration: STRIP_DURATION, delay: waveIndex * STEP_DELAY, ease: [0.45, 0, 0.2, 1] }}
```

- Yön farkındalığı: `transformOrigin` "next"te sol kenar, "prev"te sağ kenar; `waveIndex` sırası da yöne
  göre ters çevriliyor, `perspective: 1400` overlay konteynerinde.
- **EPUB** (`components/reader/EpubReaderSurface.tsx`): `triggerPageTurnAnimation(direction)`
  (satır 128-141) — level 2'de `PageCurlOverlay` mount ediliyor, level 1'de ise ayrı, daha hafif bir
  CSS `@keyframes` yolu var (`app/globals.css:190-224`, `.epub-page-turn-animate-next/prev`,
  320ms `cubic-bezier(0.22, 1, 0.36, 1)`). İki seviye birbirinden bağımsız, plan sadece level 2'yi
  (multi-strip) kapsıyordu — level 1 zaten var olan "basit rotateY" tekniğinin sadeleştirilmiş hali,
  değiştirilmesi gerekmiyor.
- Önemli tasarım notu (kodda yorum, satır 121-127): tetikleme epub.js'in `relocated` event'i yerine
  imperative `next()`/`prev()` handle'larından yapılıyor — `relocated` navigasyon başına birden fazla
  ateşleyebildiği için çift animasyon riski var.
- **PDF** (`components/reader/PdfReaderSurface.tsx`): `triggerCurl(turnDirection)` (satır 57-62) sadece
  `pageTurnAnimation === 2` iken çalışıyor, aynı `PageCurlOverlay` mount ediliyor. Level 1 render'ı
  (satır 285-314) EPUB'daki CSS keyframe değerleriyle bire bir aynı sayısal dili kullanıyor
  (`26 * direction`, `±6deg`, `0.32s`, `[0.22, 1, 0.36, 1]`) — iki bağımsız kod yolu bilinçli olarak
  aynı "görsel dilde" tutulmuş. Level 2'de düz `<Page>` render ediliyor, ekstra `rotateY` YOK (yorum,
  satır 273-276: curl overlay'in kendi 3D hareketiyle çakışmasın diye).

**Eksik:** Yok — plan zaten (b) seçeneğini birebir uyguluyor. Kalan iş varsa sadece görsel ince ayar
(strip sayısı, easing) veya performans testi, mimari değişiklik gerekmiyor.

### Kalan tek somut iş

Yukarıdaki tarama sonucunda geriye kalan tek "plan var ama kod yok" maddesi: **kitap açılış
animasyonundaki sayfa yığını fanı** (bkz. madde 2). Diğer her şey zaten üretimde.
