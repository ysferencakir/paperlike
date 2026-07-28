# Paperlike — Yol Haritası

Apple kadar zarif, Kindle kadar kullanıcı dostu ve özelleştirilebilir bir EPUB/PDF okuyucu.
Şimdilik lokal (IndexedDB), sonra deploy edilecek. Kod modüler tutulacak; her faz kendi başına
teslim edilebilir bir modül olarak eklenecek.

## Mevcut Durum (temel zaten sağlam)

- **Kütüphane**: IndexedDB (idb) storage, Zustand store, sürükle-bırak yükleme, kapak çıkarma, silme (2 adımlı onay)
- **Reader kabuğu**: ortak `ReaderView` + format'a özel `EpubReaderSurface` / `PdfReaderSurface` (`ReaderSurfaceHandle` arayüzü ile ayrıştırılmış)
- **Okuma ayarları**: tema (açık/krem/sepya/koyu/kahve/OLED-siyah/özel), gerçek kitap fontları (Literata/Lora/EB Garamond/Sans/Dyslexic), boyut, satır aralığı, kenar boşluğu, sütun sayısı, parlaklık/kontrast/sıcaklık filtresi, sayfa geçiş animasyonu — hepsi persist ediliyor
- **İlerleme takibi**: EPUB için CFI, PDF için sayfa no, IndexedDB'de saklanıyor, kaldığı yerden devam
- **Hata durumları**: EPUB açma timeout'u, bozuk dosya fallback ekranı

## Faz 0 — Temel Tamamlama ✅

Kindle/Apple standardına ulaşmak için "base" sürümde eksik olan çekirdek özellikler.

- [x] EPUB içindekiler (TOC) paneli — bölüme sıçrama
- [x] PDF: zoom kontrolü (+/-, yüzde göstergesi)
- [x] PDF: text layer açık — metin seçme, kopyalama, tarayıcı içi arama
- [x] PDF: sürekli scroll modu (sayfa-sayfa yanında alternatif, kontrol çubuğundan geçiş)
- [x] Klavye kısayolları: Space/Shift+Space (sayfa), Home/End (başa/sona), Esc (panel kapat)
- [x] Toast/bildirim sistemi — import hatası, silme/ekleme/yeniden adlandırma geri bildirimi
- [x] Kitap kartı context menüsü: yeniden adlandır (başlık/yazar), bilgi (format/boyut/tarih)

## Faz 1 — Kişiselleştirme Derinliği (Kindle-vari) ✅

- [x] Highlight & not sistemi — metni seç, renk + önem derecesi (1-3 yıldız) seç, üstüne not ekle (EPUB'da kalıcı vurgu; PDF'te sayfa+alıntı olarak kaydedilir, görsel overlay yok)
- [x] Notlar paneli: alıntılanan metin blockquote/alıntı formatında, notlar normal metin, önem rozetleri görünür
- [x] Vurguları/notları kitap bazında Word (.docx) ve PDF olarak dışa aktarma
- [x] Yer imi (bookmark) — header'da tek dokunuşla ekle/kaldır, "Notlarım" panelinden listele
- [x] Kitap içi tam metin arama (EPUB: bölüm bazlı CFI arama; PDF: sayfa bazlı metin arama)
- [x] Otomatik gece modu (20:00–07:00 arası light/sepia temasını otomatik dark'a çevirir)
- [x] Özel tema oluşturucu (arka plan/yazı rengi seçici)

## Faz 2 — Cila & Mikro-etkileşimler (Apple-vari) ✅

- [x] Gerçek sayfa çevirme animasyonu — EPUB'da CSS fade/slide (rendition container'da), PDF'te (sayfa modunda) framer-motion geçişi; `pageTurnAnimation` ayarına bağlı
- [x] Kütüphane: liste/izgara görünüm toggle'ı (tercih persist ediliyor)
- [x] Arama, sıralama (son eklenen/başlık/yazar), format filtreleme (kütüphane görünümünde)
- [x] Boş durum / onboarding animasyonları, kitap listesi giriş animasyonu (staggered fade-in)
- [ ] Koleksiyon/etiketleme — kapsam dışı bırakıldı, ayrı bir modül olarak planlanmalı

## Faz 3 — Kitap Hissi & Etkileşim Derinliği ✅

18.07.2026 tarihli yönetici vizyon dokümanıyla (Kindle Deneyimi Mobilde) karşılaştırma sonucu çıkan,
web'de gerçekten uygulanabilir maddeler. Sırayla önem/etki sırasına göre.

- [x] Kitap açılış animasyonu — kütüphaneden okuyucuya geçişte kapak açılıyormuş hissi (`BookOpenTransition`)
- [x] Gerçek kitap dizgi fontları — Literata, Lora, EB Garamond (next/font/google + EPUB iframe'ine Google Fonts injection ile)
- [x] Sıcak/krem tema tonu (`#f7f3e9`) — "Krem" olarak eklendi
- [x] Kahverengi tonlu gece modu — "Kahve" teması eklendi, otomatik gece modu artık buna geçiyor
- [x] Gerçekçi sayfa kıvrılma efekti — yön farkındalıklı (ileri/geri) perspective+rotateY geçişi, EPUB'da CSS keyframe, PDF'te framer-motion
- [x] Sayfa kalınlığı hissi — footer'da okunan/kalan sayfa oranını gösteren küçük "kitap kesiti" göstergesi
- [x] Kütüphanede "raf görünümü" — grid/list yanında 3. görünüm, CSS-only tekrarlayan "raf" deseni
- [x] Sesli okuma (TTS) — Web Speech API ile, mevcut sayfa/bölüm metnini okur (temel play/durdur, sayfa değişince otomatik durur)
- [x] Kişisel okuma istatistikleri — kütüphanede "İstatistiklerim" paneli: bugünkü süre, seri (streak), son 7 gün mini grafik
- [x] Günlük okuma hedefi (dakika bazlı, ayarlanabilir) ve tek seferlik, nazik mola önerisi

**Ton notu:** İstatistik ve mola önerisi metinleri kasıtlı olarak baskısız/suçlayıcı olmayan bir dille yazıldı
("bugün henüz okumadın" gibi olumsuz/eksiklik vurgusu yerine "istediğin an devam edebilirsin" gibi davetkâr
ifadeler; mola önerisi tek seferlik, kolayca kapatılabilir, tekrar tekrar uyarmıyor).

**Web ortamının sınırları (native/PWA gerektirir, not düşüldü):**

- Titreşimli sayfa çevirme — `navigator.vibrate()` yalnızca Android Chrome'da çalışır, iOS Safari'de çalışmaz
- Otomatik donanım ekran parlaklığı — web sayfası işletim sistemi parlaklığına erişemez, sadece kendi filtre/overlay'imizle simüle edilebilir (zaten var)
- Bildirim/odak modu — web sayfası OS bildirimlerini susturamaz
- OCR ile basılı kitap dijitalleştirme — kamera erişimi + OCR motoru gerektiren ayrı bir modül

## Faz 4 — Deploy Hazırlığı

- [ ] PWA manifest + service worker (offline okuma)
- [ ] Büyük dosyalarda performans (streaming/lazy render)
- [ ] Hata izleme (error boundary + logging)
- [ ] Gerçek deploy (Vercel önerilir — istemci taraflı IndexedDB kullanıldığı için ekstra backend gerekmiyor)
- [ ] Bulut senkronizasyonu (opsiyonel, backend gerektirir — deploy sonrası değerlendirilmeli)

## Notlar

- Her modül tamamlandığında bu dosya güncellenecek, tamamlanan maddeler işaretlenecek.
- Tasarım felsefesi: sade, az ama doğru özelleştirme seçeneği, gereksiz soyutlama yok.
