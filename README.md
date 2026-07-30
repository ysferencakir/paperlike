# Paperlike

Paperlike, e-ink cihazların sakin okuma hissini Android ve web'e taşıyan;
yerel, çevrimdışı öncelikli bir EPUB/PDF okuyucu prototipidir.

Tek React/Next.js kod tabanı web'de statik olarak çalışır, aynı çıktı Capacitor
ile Android uygulamasına paketlenir. Kitaplar, ilerleme, notlar ve istatistikler
öncelikle kullanıcının cihazında tutulur.

> Proje prototip aşamasındadır. Temel okuma deneyimi geniştir; production
> dağıtımı, büyük dosya performansı, PWA güncelleme UX'i ve bulut senkronizasyonu
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
- [State ve veri modeli](./PROJECT_DOCUMENTATION.md#8-state-ve-kalıcılık-modeli)
- [Test stratejisi](./PROJECT_DOCUMENTATION.md#17-test-stratejisi)
- [Bilinen sorunlar](./PROJECT_DOCUMENTATION.md#18-bilinen-sınırlamalar-ve-teknik-borç)
- [Yol haritası](./PROJECT_DOCUMENTATION.md#19-yol-haritası)
- [Yayın kapıları](./PROJECT_DOCUMENTATION.md#20-yayın-kapıları)

## Öne çıkan yetenekler

### Kütüphane

- EPUB/PDF içe aktarma ve metadata/kapak çıkarma
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

### Web/PWA

- Kurulabilir web app manifest ve bağımsız Paperlike ikonları
- Sürümlü service worker app-shell cache'i
- Kütüphane ve reader rotalarının çevrimdışı açılışı
- PDF worker ve Next.js statik parçalarının önbelleğe alınması
- Playwright ile gerçek Chromium offline testi

### Büyük kitap performansı

- Sürekli PDF modunda yalnızca ekrana yakın sayfaların canvas ve text layer'ları oluşturulur
- Uzak PDF sayfaları düşük maliyetli yer tutucular olarak kalır ve yaklaştıkça yüklenir
- PDF arama ve metin okuma, React-PDF'in zaten açtığı belge nesnesini yeniden kullanır
- EPUB konum üretimi ilk sayfadan sonraya ertelenir ve dosya boyutuna göre seyrekleştirilir
- 120 sayfalık sentetik PDF, gerçek Chromium E2E testinde en fazla 10 yakın render ile doğrulanır

## Platform durumu

| Alan | Durum |
|---|---|
| EPUB/PDF çekirdeği | Mevcut |
| Android sistem entegrasyonları | Mevcut, cihaz matrisi genişletilmeli |
| Web statik uygulaması | Mevcut prototip |
| Türkçe/İngilizce | Mevcut |
| Firebase/auth temeli | Geliştirme aşamasında |
| PWA/offline app shell | Mevcut; güncelleme/quota UX'i geliştirilmeli |
| Büyük kitap optimizasyonu | Kısmi; PDF lazy rendering ve EPUB konum politikası mevcut |
| Google Play production dağıtımı | Planlı |
| Koleksiyonlar/etiketler | Planlı |
| Bulut senkronizasyonu | Tasarlanmış, uygulanıyor |
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
- Gelecek senkronizasyon modeli metadata için Firestore'u, kitap dosyaları için
  kullanıcının kendi Google Drive alanını hedefler.

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
