# Mobil Deneyim Kontrol Listesi

Android'e Capacitor ile sarılmış bu uygulamanın "gerçek bir native app gibi hissettirmesi" için standart mobil UX kalıpları. Öncelik sırasına göre gruplandı — üsttekiler eksik olduğunda en çok "web sitesi gibi hissettiren" şeyler, alttakiler cila/nice-to-have.

## 1. Navigasyon ve sistem entegrasyonu (yüksek öncelik)

- [x] **Android geri tuşu/gesture'ı** — `@capacitor/app` + `useBackHandlerStore`/`BackButtonHandler` ile: açık panel varsa kapat, okuyucudaysa kütüphaneye dön, kütüphanedeyse uygulamadan çık.
- [x] **Kenar swipe çakışması** — `EpubReaderSurface.tsx`'te `EDGE_EXCLUSION_FRACTION` (%5) ile sayfa genişliğinin en kenarından başlayan swipe'lar artık sayfa çevirmeyi tetiklemiyor, sistemin geri gesture'ına bırakılıyor.
- [x] **Durum çubuğu (status bar) teması** — `lib/native-ui.ts` (`syncStatusBar`) ile hem kütüphane (sistem light/dark'a göre) hem okuyucu (aktif reader temasına göre) durum çubuğunu otomatik boyuyor.
- [x] **Immersive/tam ekran okuma modu** — özel `ImmersivePlugin.java` ile "chrome" gizlendiğinde sistem nav bar'ı da gizleniyor (alttan swipe ile geçici olarak geri getirilebiliyor).
- [x] **"Open with" / dosyadan aç** — `OpenFilePlugin.java` + `MainActivity` + AndroidManifest intent-filter + `OpenFileHandler.tsx`: dosya yöneticisi/e-posta gibi başka bir uygulamadan `.epub`/`.pdf` açıldığında kütüphaneye eklenip okuyucu direkt açılıyor.
- [x] **"Şununla paylaş" (Share intent) hedefi olma** — `MainActivity`'ye `ACTION_SEND` işleyicisi + manifest'e SEND intent-filter eklendi; başka bir uygulamanın "Paylaş" menüsünden Paperlike seçilebiliyor.
- [x] **Runtime izin akışları** — depolama izni gerekmiyor (tüm dosya erişimi `<input type=file>`/SAF ve `content://` intent URI'leri üzerinden, ham dosya yolu yok). Bildirim izni (Android 13+ `POST_NOTIFICATIONS`) artık tam olarak özelliğin açıldığı anda isteniyor: `lib/native-ui.ts`'e `requestNotificationPermission()` eklendi, `ReadingStatsPanel.tsx`'teki "Mola hatırlatıcıları" anahtarı açılırken bunu çağırıyor; kullanıcı izni reddederse anahtar açılmıyor ve bir toast ile bilgilendiriliyor (önceden izin reddedilirse hatırlatıcı sessizce hiç tetiklenmiyordu).

## 2. Okuma deneyimi (orta-yüksek öncelik)

- [x] Dokunma bölgeleriyle sayfa çevirme (sol/sağ kenar, orta = menü)
- [x] Swipe ile sayfa çevirme
- [x] **Ekranın açık kalması (wake lock)** — `ImmersivePlugin.keepAwake` (native `FLAG_KEEP_SCREEN_ON`) + `lib/native-ui.ts` (`setKeepAwake`), okuyucu açıkken sürekli aktif.
- [x] **Haptic feedback** — `@capacitor/haptics` ile sayfa çevirmede hafif, highlight/bookmark ekleme-kaldırmada orta şiddette titreşim.
- [ ] **Native metin seçimi + büyüteç** — kod tarafında müdahale gerektirmiyor (tarayıcı native davranışı), sadece telefonda elle test edilmeli.
- [x] **Pinch-to-zoom** — `PdfReaderSurface.tsx`'te iki-parmak `touchmove` mesafe takibiyle eklendi; aktifken swipe/tap mantığı devre dışı kalıyor.
- [x] **Ses tuşlarıyla sayfa çevirme** — `VolumeKeyPlugin.java` + Ayarlar panelinde opsiyonel switch; açıkken ses tuşları medya sesini değil sayfa çevirmeyi kontrol ediyor.
- [x] **Text-to-speech native kalitesi** — `@capacitor-community/text-to-speech`'e geçildi (`lib/native-ui.ts` → `speak`/`stopSpeaking`), web'de hâlâ `speechSynthesis`'e düşüyor (dev test için).

## 3. Uygulama yaşam döngüsü ve veri güvenilirliği (orta öncelik)

- [x] **Arka plana alınca ilerlemeyi kaydetme** — `ReaderView.tsx`'teki okuma-süresi flush effect'i artık `visibilitychange` olayında da anında flush ediyor (öncesinde en fazla 30sn'lik pencere içinde kayıp riski vardı).
- [x] **Yedekleme / senkron** — `lib/backup.ts` (JSZip ile tüm kitaplar+kapaklar+highlight/bookmark/ilerleme/istatistik tek .zip), kütüphane başlığında `BackupMenu.tsx` ile "Yedekle" (native share sheet açılır, Drive/WhatsApp/vb.'ye kaydedilebilir) ve "Geri Yükle" (dosya seçici ile .zip seçilip içe aktarılır).
- [x] **Uygulama kısayolları (App Shortcuts)** — `ShortcutPlugin.java` (paperlike://continue-reading, `ShortcutManagerCompat`) + `MainActivity` + `ShortcutHandler.tsx`; kitap her açıldığında ana ekran ikonunun uzun basma menüsündeki "Devam et: <kitap adı>" kısayolu güncelleniyor.
- [x] **Bildirimler** — `@capacitor/local-notifications` ile ara verme hatırlatıcısı artık native alarm üzerinden zamanlanıyor (uygulama arka plandayken/kapalıyken de tetikleniyor), önceki JS `setTimeout` sadece uygulama açıkken çalışıyordu.
- [x] **Android Auto Backup doğrulaması** — `backup_rules.xml` + `data_extraction_rules.xml` ile `app_webview/` (IndexedDB'nin yaşadığı yer) artık Auto Backup/cihaz transferine açıkça dahil ediliyor.
- [x] **Hata/çökme raporlama** — Firebase Crashlytics (`google-services.json` + `CrashReportingPlugin.java` + `CrashReportingHandler.tsx`). Native çökmeler otomatik yakalanıyor; JS hataları/unhandledrejection'lar `window.onerror` ile Crashlytics'e iletiliyor. (Not: `@capacitor-community/firebase-crashlytics` paketi Capacitor 5 için yazılmış, bizim Capacitor 8 kurulumumuzla uyumsuzdu — onun yerine Firebase Android SDK'sını doğrudan saran özel bir plugin yazıldı.)
- [x] **Ev ekranı widget'ı** — `ContinueReadingWidgetProvider.java` (AppWidgetProvider) + `WidgetPlugin.java` (Capacitor plugin) ile "şu an okuduğun kitap / ilerleme" gösteren bir ana ekran widget'ı eklendi. `ReaderView.tsx`, kitap/sayfa değiştikçe `updateContinueReadingWidget()` (`lib/native-ui.ts`) çağırıyor; bu, SharedPreferences'a yazıp widget'ı anında (30 dk'lık `updatePeriodMillis` sadece yedek) günceller. Widget'a dokunmak `paperlike://continue-reading?bookId=...` ile aynı akışı (`ShortcutHandler.tsx`) tetikleyip doğrudan o kitabın okuyucusunu açıyor; hiç kitap okunmamışsa "Henüz açık bir kitap yok" boş durumu gösteriliyor.

## 4. Görsel cila (düşük-orta öncelik)

- [x] **Splash screen ve app ikonu** — özel tasarım (açık kitap + altın kurdele, siyah zemin) `@capacitor/assets` ile tüm mipmap boyutları, adaptive icon katmanları ve açık/koyu+portre/yatay splash screen'ler olarak üretildi (`assets/logo.png` kaynak dosya olarak repoda tutuluyor, ileride değiştirmek isterseniz yeniden çalıştırılabilir).
- [x] **Adaptive/themed icon** — adaptive icon (foreground+background katmanları) üretimin bir parçası olarak otomatik geldi.
- [x] **Safe-area / çentik (notch) desteği** — asıl eksik, `viewport-fit=cover` hiç ayarlanmamıştı (yani `env(safe-area-inset-*)` hep 0 dönüyordu). `app/layout.tsx`'e `viewport` export'u eklendi; okuyucu üst/alt chrome, kütüphane başlığı ve toast artık gerçek safe-area değerlerine göre padding alıyor.
- [x] **Overscroll/bounce davranışı** — `globals.css`'te `body { overscroll-behavior: none }` ile kapatıldı.
- [x] **Toast/snackbar konumu** — artık `max(1.25rem, env(safe-area-inset-bottom))` kullanıyor, sistem nav bar'ının arkasında kalmıyor.

## 5. Erişilebilirlik (accessibility)

- [x] **TalkBack desteği** — tam tarama yapıldı (subagent ile). Sadece okuyucunun geri butonunda (`ArrowLeft`) `aria-label` eksikti, düzeltildi; `Dialog`/`Sheet` kapatma butonlarının `sr-only` metni de Türkçeleştirildi ("Kapat"). Geri kalan her yerde zaten doğruydu.
- [x] **Sistem font boyutu ölçeklendirmesine saygı** — kod tarafında engelleyici bir şey yok (`maximum-scale`/`user-scalable` gibi bir kısıtlama hiç ayarlanmamış, Tailwind `rem` tabanlı), ekstra değişiklik gerekmedi — telefonda "büyük yazı tipi" ile elle doğrulanabilir.

## 6. İleri seviye / nice-to-have

- [x] Tablet'te yan yana iki sayfa (spread) — `columnsAutoManaged` (varsayılan `true`) ile ≥900px ekranlarda otomatik 2 sütuna geçiyor; kullanıcı Ayarlar'dan Sütun'u elle değiştirirse o andan itibaren ekran boyutundan bağımsız, sadece elle seçilen değere sadık kalıyor.
- [ ] Ekran yönü (landscape) davranışı — okuma modunda döndürüldüğünde nasıl davranıyor, test edilmeli.
- [ ] Katlanabilir (foldable) cihaz desteği — ekran açıldığında/kapandığında layout'un kırılmadan uyum sağlaması.
- [ ] **Biyometrik kilit** — TEKRAR GERİ ALINDI. `deviceIsSecure` fallback'ı + kaçış yolu (2 başarısız denemeden sonra "Kilidi devre dışı bırak") ile düzeltilip açılmıştı, ama telefonda yine kilitlenme yaşandı. `app/layout.tsx`'te `<BiometricLockGate />` tekrar yorum satırına alındı; `BackupMenu.tsx`'teki "Biyometrik kilit" açma/kapama seçeneği de tamamen kaldırıldı (artık hiçbir şey yapmayan bir toggle bırakmamak için). Kod dosyaları (`BiometricLockGate.tsx`, `useSecurityStore.ts`) hâlâ kod tabanında duruyor ama hiçbir yerden çağrılmıyor/render edilmiyor — bu özellik bu uygulama için gerekli görülmüyor, tekrar denenmeyecek.
- [ ] Google Play Uygulama İçi Güncelleme (In-App Update) API'si — Play Store'a yüklendiğinde otomatik güncelleme hatırlatması.
- [ ] Dynamic color / Material You — Android 12+'ta sistem duvar kağıdı renklerine göre uygulama temasının otomatik uyumlanması (tamamen opsiyonel, marka kimliğiyle çelişebilir).
- [x] Çoklu dil desteği (i18n) — `lib/i18n/` (tr.ts/en.ts sözlükleri + `useTranslation()` hook'u, TypeScript her iki dilde de aynı anahtarların bulunmasını zorunlu kılıyor), `BackupMenu`'de dil seçici. Uygulamadaki her kullanıcıya görünür metin (~35 dosya) çevrildi.
- [x] İlk açılış tanıtımı (onboarding) — `ReaderOnboarding.tsx`, kitap ilk açıldığında swipe/dokunma gesturelarını bir kerelik gösterip `useOnboardingStore` ile bir daha göstermiyor.

## 7. Kurulum / dağıtım kalitesi

- [x] **Uygulama izinleri manifestosu gözden geçirme** — birleştirilmiş (merged) manifest incelendi: Firebase Analytics otomatik olarak reklam kimliği (`AD_ID`, `ACCESS_ADSERVICES_*`) izinleri ekliyormuş, bunlar `tools:node="remove"` ile kaldırıldı + `google_analytics_adid_collection_enabled=false` meta-data'sı eklendi (Crashlytics breadcrumb'larını etkilemiyor, onlar analytics event'lerinden geliyor). Diğer izinler (VIBRATE, POST_NOTIFICATIONS, WAKE_LOCK vb.) hepsi kullandığımız gerçek özelliklere karşılık geliyor, sorun yok.
- [x] **ProGuard/R8 ile küçültme** — release build type'ında `minifyEnabled true` + `shrinkResources true` açıldı, imzasız `assembleRelease` ile derleme doğrulandı (R8 hiçbir şeyi kırmadı). Crashlytics mapping dosyası da otomatik yükleniyor (okunabilir stack trace'ler için).
- [x] **Cold start süresi** — kütüphane ekranının (uygulamanın ilk açıldığı yer) ilk yüklemesinde gereksiz yere taşınan ağır kütüphaneler bulundu: `lib/backup.ts` (jszip), `lib/export-notes.ts` (docx + jspdf) ve `lib/epub-loader.ts` (epubjs — kitap eklerken kapak/metadata çıkarmak için kullanılıyor, kendi içinde de jszip taşıyor) hepsi modül tepesinde statik import edilmişti; halbuki bunların hiçbiri "/" ekranı ilk açıldığı anda gerekmiyor (sadece yedekleme, not dışa aktarma veya yeni kitap ekleme anında). Hepsi ilgili fonksiyon içine `await import(...)` ile taşındı — `lib/pdf-loader.ts`'te zaten var olan aynı kalıp (react-pdf/pdfjs için) örnek alındı. Sonuç: kütüphane ekranının ilk yüklemede indirdiği JS ~1.66MB'tan ~1.11MB'a düştü (~%33 azalma), bu dört kütüphane artık sadece gerçekten kullanıldıkları anda indiriliyor.

---

**Önerilen sıralama:** Bölüm 1 (özellikle geri tuşu) → Bölüm 2'nin geri kalanı (wake lock, haptics) → Bölüm 3 → Bölüm 4/5/6/7 istekle sıraya alınır.
