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
