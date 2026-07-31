# Paperlike

Paperlike, e-ink cihazların sakin okuma hissini Android ve web'e taşıyan;
yerel, çevrimdışı öncelikli bir EPUB/PDF okuyucu prototipidir.

Tek React/Next.js kod tabanı web'de statik olarak çalışır, aynı çıktı Capacitor
ile Android uygulamasına paketlenir. Kitaplar, ilerleme, notlar ve istatistikler
öncelikle kullanıcının cihazında tutulur.

> Proje prototip aşamasındadır. Temel okuma deneyimi geniştir; production
> dağıtımı, büyük dosya performansının gerçek cihaz ölçümleri ve iki yönlü bulut senkronizasyonu
> hâlâ geliştirilmektedir.

## Ana dokümantasyon

Ürün vizyonu, güncel durum, mimari, veri modeli, süreç diyagramları, test
stratejisi, bilinen sorunlar ve ayrıntılı yol haritası için:

**[Paperlike Ürün, Mimari ve Geliştirme Rehberi](./PROJECT_DOCUMENTATION.md)**

Önemli bölümler:

- [Tek bakışta proje durumu](./PROJECT_DOCUMENTATION.md#0-tek-bakışta-proje-durumu)
- [Güncel özellik envanteri](./PROJECT_DOCUMENTATION.md#3-güncel-özellik-envanteri)
- [Platform yetenek matrisi](./PROJECT_DOCUMENTATION.md#4-platform-yetenek-matrisi)
- [Teknik mimari](./PROJECT_DOCUMENTATION.md#6-yüksek-seviye-mimari)
- [Ekran ve navigasyon haritası](./PROJECT_DOCUMENTATION.md#911-ekran-ve-navigasyon-haritası)
- [State ve veri modeli](./PROJECT_DOCUMENTATION.md#8-state-ve-kalıcılık-modeli)
- [Veri yaşam döngüsü ve kurtarma hedefleri](./PROJECT_DOCUMENTATION.md#86-veri-yaşam-döngüsü-matrisi)
- [Bağımlılık, lisans ve güncelleme politikası](./PROJECT_DOCUMENTATION.md#55-bağımlılık-lisans-ve-güncelleme-politikası)
- [Yerel uygulama güvenlik tehdit modeli](./PROJECT_DOCUMENTATION.md#135-yerel-uygulama-güvenlik-tehdit-modeli)
- [Gizlilik politikası ve Data Safety taslağı](./PROJECT_DOCUMENTATION.md#136-gizlilik-politikası-ve-google-play-data-safety-çalışma-taslağı)
- [Test stratejisi](./PROJECT_DOCUMENTATION.md#17-test-stratejisi)
- [Risk kayıt defteri](./PROJECT_DOCUMENTATION.md#184-olasılık-ve-etki-risk-kayıt-defteri)
- [Bilinen sorunlar](./PROJECT_DOCUMENTATION.md#18-bilinen-sınırlamalar-ve-teknik-borç)
- [Yol haritası](./PROJECT_DOCUMENTATION.md#19-yol-haritası)
- [Yayın kapıları](./PROJECT_DOCUMENTATION.md#20-yayın-kapıları)

## Öne çıkan yetenekler

### Kütüphane

- EPUB/PDF içe aktarma ve metadata/kapak çıkarma
- Parser öncesi PDF/ZIP imzası, EPUB mimetype/iç ZIP bütçeleri ve 1 GiB güvenlik tavanı
- Grid, liste ve üç boyutlu raf görünümü
- Arama, sıralama, biçim filtresi ve basit kategori
- Yeniden adlandırma, bilgi görüntüleme ve ilişkili verilerle silme
- Tam kitaplık ZIP yedeği ve geri yükleme

### Okuyucu

- Ortak okuyucu kabuğu altında ayrı EPUB ve PDF motorları
- CFI/sayfa tabanlı ilerleme ve kaldığı yerden devam
- İçindekiler, tam metin arama, yer imi, vurgu ve notlar
- Word/PDF not dışa aktarma
- Sayfalanmış ve sürekli kaydırmalı okuma
- Tema, font, boyut, satır, margin, sütun ve ekran filtreleri
- Sesli okuma, günlük hedef, istatistik ve nazik mola hatırlatıcıları

### Android

- Geri gesture, immersive mod, wake lock ve haptic feedback
- Ses tuşlarıyla sayfa çevirme ve native TTS
- “Birlikte aç”/“Paylaş” intent'leri
- Okumaya devam et kısayolu ve ana ekran widget'ı
- Yerel bildirim ve Firebase Crashlytics
- Crashlytics JS hata payload'ında URL/yol/e-posta/token redaction ve boyut sınırı

### Web/PWA

- Kurulabilir web app manifest ve bağımsız Paperlike ikonları
- Sürümlü service worker app-shell cache'i
- Yeni sürüm için kullanıcı onaylı güncelle/ertele bildirimi
- Doğrulanmış staging cache, başarısız güncellemede eski sürümü koruma ve yeniden deneme akışı
- Tarayıcı destekliyorsa tek düğmeyle PWA kurulumu; iOS ve diğer tarayıcılar için kurulum yönlendirmesi
- Yerel kota/doluluk görünümü, kalıcı depolama isteği ve kitap içe aktarma öncesi güvenli alan kontrolü
- Chromium, Firefox, WebKit ve mobil profillerde otomatik taşma/dialog uyumluluk matrisi
- Telefon yatay, tablet dikey/yatay ve foldable-benzeri viewport/yön değişimi matrisi
- Masaüstü/mobil boş kitaplık, kurulu, offline, güncelleme ve cache-hata görsel referansları
- Axe WCAG A/AA taraması, klavye/focus ve 320 px yeniden akış kalite kapısı
- Kütüphane ve reader rotalarının çevrimdışı açılışı
- PDF worker ve Next.js statik parçalarının önbelleğe alınması
- Playwright ile gerçek Chromium offline testi

PWA görsel referansları: [`docs/visual-references/`](./docs/visual-references/)

### Büyük kitap performansı

- Sürekli PDF modunda yalnızca ekrana yakın sayfaların canvas ve text layer'ları oluşturulur
- Uzak PDF sayfaları düşük maliyetli yer tutucular olarak kalır ve yaklaştıkça yüklenir
- PDF arama ve metin okuma, React-PDF'in zaten açtığı belge nesnesini yeniden kullanır
- EPUB konum üretimi ilk sayfadan sonraya ertelenir ve dosya boyutuna göre seyrekleştirilir
- EPUB/PDF tam metin araması 250 ms debounce, iptal ve bölüm/sayfa ilerlemesi kullanır
- Yeni sorgu veya panelin kapanması önceki büyük kitap taramasını durdurur
- 120 sayfalık sentetik PDF, gerçek Chromium E2E testinde en fazla 10 yakın render ile doğrulanır
- Backup büyük EPUB/PDF girdilerini yeniden sıkıştırmadan ve tarayıcıda eager ArrayBuffer kopyası oluşturmadan ZIP'e ekler
- Backup/restore aşama ilerlemesi, iptal düğmesi, CRC ve eksik dosya ön doğrulaması içerir
- Backup restore entry/adet/açılmış boyut/manifest/sıkıştırma oranı bütçelerini kalıcı yazımdan önce uygular
- Kapaklar viewport'a 300 px yaklaşınca yüklenir ve en fazla 384×576 thumbnail olarak decode edilir
- Ortak LRU cache 96 kayıt/32 MiB sınırı, eşzamanlı okuma birleştirme ve güvenli object URL tahliyesi kullanır

## Platform durumu

| Alan | Durum |
|---|---|
| EPUB/PDF çekirdeği | Mevcut |
| Android sistem entegrasyonları | Mevcut, cihaz matrisi genişletilmeli |
| Web statik uygulaması | Mevcut prototip |
| Türkçe/İngilizce | Mevcut |
| Firebase/auth temeli | Mevcut; senkronizasyon genişletiliyor |
| PWA/offline app shell | Mevcut; kurulum, kota/persistence, atomik cache/rollback, kontrollü güncelleme ve offline app-shell hazır |
| Büyük kitap optimizasyonu | Kısmi; PDF lazy rendering, kontrollü arama, backup/restore ve kapak LRU/thumbnail optimizasyonu mevcut |
| Google Play production dağıtımı | Planlı |
| Koleksiyonlar/etiketler | Planlı |
| Bulut senkronizasyonu | Firestore push/pull, UID-scoped tombstone, temel mutasyonlarda IndexedDB outbox + bounded backoff + online/startup/manual flush, hesap ekranında sync durumu ve Drive resumable upload mevcut; dead-letter ve tombstone TTL/ack planlı |
| iOS | Planlı |

## Teknik yığın

- Next.js 16, React 19 ve TypeScript
- Tailwind CSS 4 ve Framer Motion
- Zustand ve IndexedDB (`idb`)
- `epub.js`, React-PDF/PDF.js
- Capacitor 8 ve özel Android Java pluginleri
- Firebase Crashlytics; Firebase Auth/Firestore altyapısı geliştirme aşamasında
- Vitest, fake-indexeddb, React Testing Library ve Playwright

## Gereksinimler

- Node.js 20 veya uyumlu sürüm
- npm
- Android geliştirme için Android Studio, Android SDK ve Java 21

Projede kurulu Next.js sürümünün API ve dosya yapısı klasik Next.js bilgisiyle
aynı kabul edilmemelidir. Kod yazmadan önce
`node_modules/next/dist/docs/` içindeki ilgili sürüm dokümanı okunmalıdır.

## Hızlı başlangıç

```bash
npm ci
npm run dev
```

Tarayıcıda `http://localhost:3000` adresini açın.

## Komutlar

| Komut | Amaç |
|---|---|
| `npm run dev` | Web geliştirme sunucusu |
| `npm run build` | Statik production export |
| `npm run lint` | ESLint kontrolü |
| `npm run type-check` | TypeScript kontrolü |
| `npm test` | Otomatik testleri çalıştırır |
| `npm run test:watch` | Testleri izleme modunda çalıştırır |
| `npm run test:e2e` | Production build + Chromium E2E testleri |
| `npm run test:e2e:ui` | Playwright görsel test arayüzü |
| `npm run test:e2e:compat` | Chromium, Firefox, WebKit ve mobil temel uyumluluk matrisi |
| `npm run test:responsive` | Telefon yatay, tablet ve foldable-benzeri responsive matris |
| `npm run test:a11y` | WCAG A/AA, klavye/focus ve 320 px reflow matrisi |
| `npm run test:visual` | Sürümlü PWA masaüstü/mobil görsel regresyonu |
| `npm run test:firestore-rules` | Firestore emülatöründe UID izolasyonu, hesap tasfiyesi ve iki-cihaz tombstone uzlaşması |
| `npm run benchmark:web` | Mevcut `out/` üzerinde web performans benchmarkı |
| `npm run benchmark:web:build` | Production build + web performans benchmarkı |
| `npm run benchmark:android:assemble` | Android benchmark hedef APK'larını derler |
| `npm run benchmark:android` | Yalnız ayrılmış/silinebilir test cihazında ve açık güvenlik izniyle Macrobenchmark |
| `npm run benchmark:android:report` | Mevcut AndroidX sonucunu ortak JSON/Markdown'a çevirir |
| `npm run check` | Lint, type-check ve test kalite kapısı |
| `npm run cap:sync` | Web build ve Android Capacitor sync |
| `npm run android:open` | Android Studio'da projeyi açma |
| `npm run android:dev` | LAN üzerinden Android canlı geliştirme |
| `npm run android:dev:sync` | Dev server yapılandırmasıyla Capacitor sync |

## Android geliştirme

Statik paket:

```bash
npm run cap:sync
npm run android:open
```

Canlı geliştirme:

```bash
npm run android:dev
npm run android:dev:sync
```

`CAP_DEV_IP` verilmezse yapılandırma uygun yerel IPv4 adresini bulmaya çalışır.
Bilgisayar ve Android cihaz aynı ağda olmalıdır.

## Veri ve gizlilik

- Kitaplar ve okuma verileri varsayılan olarak IndexedDB'de yerel tutulur.
- Hesap, temel okuma deneyiminin ön koşulu değildir.
- ZIP yedekleri kitap dosyaları ve kişisel notlar içerir; şifreli değildir.
- Native hatalar ve köprüden iletilen JavaScript hataları Crashlytics'e
  gönderilebilir.
- Opsiyonel senkronizasyon metadata için Firestore'u, kitap dosyaları için
  kullanıcının kendi Google Drive alanını kullanır; buluttan cihaza geri çekme
  henüz tamamlanmamıştır.

## Proje yapısı

```text
app/                  Next.js route ve uygulama kabuğu
components/library/   Kütüphane ve kitap yönetimi
components/reader/    Ortak okuyucu ile EPUB/PDF yüzeyleri
components/ui/        Temel UI bileşenleri
lib/                  Veri, import, backup, tema, i18n ve native wrapper'lar
store/                Zustand state'leri
android/              Capacitor Android projesi ve özel pluginler
```

## Katkı ve ajan çalışması

- Önce `AGENTS.md` ve ana dokümantasyonu okuyun.
- Kullanıcıya ait commitlenmemiş değişiklikleri koruyun.
- Next.js değişikliklerinde kurulu sürüm dokümanını kullanın.
- Kullanıcı metinlerini Türkçe ve İngilizce sözlüklere birlikte ekleyin.
- Veri şeması değişikliğinde migration ve backup uyumluluğunu değerlendirin.
- İş sonunda ilgili test, roadmap ve Graphify grafiğini güncelleyin.

## Lisans

[MIT](./LICENSE) — © 2026 Yusuf Eren Çakır
