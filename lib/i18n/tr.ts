// Source-of-truth dictionary — every key is authored here first (Turkish),
// then mirrored with the same keys in en.ts (TypeScript enforces this via
// `Record<keyof typeof tr, string>` there, so a missing translation is a
// build error, not a silent gap).
export const tr = {
  // Common
  "common.cancel": "Vazgeç",
  "common.save": "Kaydet",
  "common.close": "Kapat",

  // Formats
  "format.epub": "EPUB",
  "format.pdf": "PDF",
  "format.all": "Tümü",

  // Open file (share/open-with)
  "openFile.unsupportedType": "Desteklenmeyen dosya türü.",
  "openFile.importedFilename": "İçe Aktarılan Kitap",
  "openFile.added": "Kitap eklendi.",
  "openFile.failed": "Kitap açılamadı.",
  "importBook.fileTooLarge": "Kitap dosyası 1 GB güvenlik sınırını aşıyor.",
  "importBook.invalidContent": "Dosyanın içeriği EPUB veya PDF biçimiyle eşleşmiyor.",

  // PWA
  "pwa.updateReady": "Paperlike'ın yeni sürümü hazır.",
  "pwa.update": "Güncelle",
  "pwa.later": "Sonra",
  "pwa.updating": "Yeni sürüm etkinleştiriliyor…",
  "pwa.updateFailed": "Yeni sürüm hazırlanamadı. Mevcut sürüm çalışmaya devam ediyor.",
  "pwa.cacheFailed": "Yeni çevrimdışı içerik kaydedilemedi. Mevcut verilerin korunuyor.",
  "pwa.retry": "Yeniden Dene",
  "pwa.toolsAriaLabel": "Uygulama ve depolama",
  "pwa.toolsTitle": "Uygulama ve Depolama",
  "pwa.toolsDescription": "Paperlike'ı yükle ve tarayıcıdaki yerel kitap alanını yönet.",
  "pwa.installTitle": "Uygulamayı yükle",
  "pwa.installDescription": "Daha hızlı erişmek ve uygulama görünümünde kullanmak için Paperlike'ı cihazına yükle.",
  "pwa.install": "Paperlike'ı Yükle",
  "pwa.installed": "Paperlike bu cihazda yüklü.",
  "pwa.installIosHint": "Safari'de Paylaş düğmesine, ardından Ana Ekrana Ekle seçeneğine dokun.",
  "pwa.installBrowserHint": "Yükleme seçeneği hazır olduğunda burada görünür. Tarayıcı menüsündeki “Uygulamayı yükle” veya “Ana ekrana ekle” seçeneğini de kullanabilirsin.",
  "pwa.storageTitle": "Yerel depolama",
  "pwa.storageLoading": "Depolama bilgisi okunuyor…",
  "pwa.storageUnsupported": "Bu tarayıcı depolama kotası bilgisini paylaşmıyor.",
  "pwa.storageUsed": "{usage} / {quota} kullanılıyor",
  "pwa.storageAvailable": "Yaklaşık {available} kullanılabilir alan",
  "pwa.storageUsageAriaLabel": "Yerel depolama kullanımı",
  "pwa.storageLow": "Kullanılabilir alan azalıyor. Yeni kitap eklemeden önce gereksiz dosyaları sil veya kütüphaneni yedekle.",
  "pwa.storagePersistent": "Kalıcı depolama koruması etkin.",
  "pwa.storagePersistenceDescription": "Tarayıcının alan açarken Paperlike verilerini otomatik temizleme riskini azalt.",
  "pwa.storageRequestPersistence": "Kalıcı Depolamayı İste",
  "pwa.storagePersistenceDenied": "Tarayıcı bu isteği kabul etmedi. Uygulamayı yüklemek ve düzenli kullanmak daha sonra izin verilmesine yardımcı olabilir.",
  "pwa.storageNotBackup": "Bu koruma bir yedek değildir. Kitaplarını güvenceye almak için ayrıca kütüphane yedeği oluştur.",

  // Backup menu
  "backup.shareTitle": "Kütüphane Yedeği",
  "backup.exportFailed": "Yedek oluşturulamadı.",
  "backup.restoredOne": "1 kitap geri yüklendi.",
  "backup.restoredMany": "{count} kitap geri yüklendi.",
  "backup.importFailed": "Yedek geri yüklenemedi.",
  "backup.ariaLabel": "Yedekleme",
  "backup.export": "Kütüphaneyi Yedekle",
  "backup.import": "Yedekten Geri Yükle",
  "backup.progressCollecting": "Kitaplar hazırlanıyor",
  "backup.progressCompressing": "Yedek oluşturuluyor",
  "backup.progressValidating": "Yedek doğrulanıyor",
  "backup.progressRestoring": "Kitaplar geri yükleniyor",
  "backup.progressMetadata": "Okuma verileri geri yükleniyor",
  "backup.cancel": "İşlemi iptal et",
  "backup.cancelled": "Yedekleme işlemi iptal edildi.",

  // Book actions menu
  "bookActions.ariaLabel": "Kitap seçenekleri",
  "bookActions.rename": "Yeniden Adlandır",
  "bookActions.info": "Bilgi",
  "bookActions.infoTitle": "Kitap Bilgisi",
  "bookActions.titleLabel": "Başlık",
  "bookActions.authorLabel": "Yazar",
  "bookActions.categoryLabel": "Kategori",
  "bookActions.uncategorized": "Kategorisiz",
  "bookActions.formatLabel": "Format",
  "bookActions.sizeLabel": "Boyut",
  "bookActions.addedAtLabel": "Eklenme Tarihi",
  "bookActions.unknownAuthor": "Bilinmeyen Yazar",
  "bookActions.updated": "Kitap güncellendi.",
  "bookActions.editTitle": "Kitabı Düzenle",
  "bookActions.editDescription": "Başlığı, yazarı ve rafta göründüğü kategoriyi düzenle.",
  "bookActions.categoryPlaceholder": "ör. Roman, Bilim Kurgu",

  // Book card / list row
  "book.deleted": "Kitap silindi.",
  "book.confirmDelete": "Silmeyi onayla",
  "book.delete": "Kitabı sil",

  // Category dialog
  "category.created": "\"{name}\" kategorisi oluşturuldu.",
  "category.addTitle": "Kategori Ekle",
  "category.addDescription": "Bir kategori adı belirle ve rafta bu kategoride görünecek kitapları seç.",
  "category.nameLabel": "Kategori Adı",
  "category.namePlaceholder": "ör. Roman, Bilim Kurgu",
  "category.booksLabel": "Kitaplar",
  "category.selectedCount": "({count} seçili)",
  "category.noBooks": "Henüz kitap yok.",

  // Library view
  "library.title": "Kütüphanem",
  "library.bookCount": "{count} kitap",
  "library.stats": "Okuma istatistiklerin",
  "library.addCategory": "Kategori ekle",
  "library.editLibrary": "Düzenle",
  "library.doneEditing": "Bitti",
  "library.addBook": "Kitap Ekle",
  "library.searchPlaceholder": "Kitap veya yazar ara…",
  "library.sortRecent": "Son Eklenen",
  "library.sortTitle": "Başlığa Göre",
  "library.sortAuthor": "Yazara Göre",
  "library.gridView": "Izgara görünümü",
  "library.listView": "Liste görünümü",
  "library.shelfView": "Raf görünümü",
  "library.noSearchResults": "Aramanla eşleşen kitap bulunamadı.",
  "library.emptyTitle": "Kütüphanen boş",
  "library.emptySubtitle": "İlk kitabını ekleyerek okumaya başla — EPUB ya da PDF.",
  "library.uploadTitle": "Kitap Ekle",
  "library.uploadDescription": "EPUB veya PDF dosyanı sürükleyip bırak.",

  // Reading stats panel
  "stats.weekdayMon": "Pzt",
  "stats.weekdayTue": "Sal",
  "stats.weekdayWed": "Çar",
  "stats.weekdayThu": "Per",
  "stats.weekdayFri": "Cum",
  "stats.weekdaySat": "Cmt",
  "stats.weekdaySun": "Paz",
  "stats.noneToday": "Bugün henüz okumaya başlamadın. İstediğin an, istediğin sayfadan devam edebilirsin.",
  "stats.todayMinutes": "Bugün {minutes} dakika kitabının içindeydin ✨",
  "stats.todayHours": "Bugün {hours} saat {minutes} dakika kitabının içindeydin ✨",
  "stats.title": "Okuma İstatistiklerin",
  "stats.streak": "🔥 {streak} gündür art arda okuyorsun — güzel gidiyor.",
  "stats.last7Days": "Son 7 gün",
  "stats.dailyGoal": "Günlük Hedef",
  "stats.decreaseGoal": "Hedefi azalt",
  "stats.minutesUnit": "{minutes} dk",
  "stats.increaseGoal": "Hedefi artır",
  "stats.goalReached": "Bugünkü hedefine ulaştın, ne güzel 🎉",
  "stats.breakReminders": "Nazik mola hatırlatmaları",
  "stats.breakRemindersDescription": "Uzun bir okuma seansında, istersen sana kısa bir mola önerelim.",
  "stats.notificationPermissionDenied": "Bildirim izni verilmedi, mola hatırlatıcıları gösterilemez.",

  // Shelf view
  "shelf.categoryBookCount": "· {count} kitap",
  "shelf.notStarted": "Henüz başlanmadı",
  "shelf.progress": "%{percentage} okundu · {relativeDate}",
  "shelf.sizeAndAdded": "{size} · {date} eklendi",
  "shelf.uncategorized": "Kategorisiz",

  // Relative date
  "relativeDate.today": "bugün",
  "relativeDate.yesterday": "dün",
  "relativeDate.daysAgo": "{days} gün önce",
  "relativeDate.monthsAgo": "{months} ay önce",
  "relativeDate.yearsAgo": "{years} yıl önce",

  // Upload dropzone
  "upload.importFailed": "Kitap içe aktarılamadı.",
  "upload.importFailedWithFile": "{filename}: {message}",
  "upload.addedOne": "Kitap eklendi.",
  "upload.addedMany": "{count} kitap eklendi.",
  "upload.importing": "Kitap içe aktarılıyor…",
  "upload.idle": "EPUB veya PDF yükleyin",
  "upload.hint": "Sürükleyip bırakın ya da tıklayarak seçin",
  "upload.insufficientStorage": "Bu kitaplar için yeterli güvenli yerel alan yok. Önce yer açın veya kütüphanenizi yedekleyin.",

  // Break suggestion
  "break.suggestion": "Bir süredir kitabının içindesin. Gözlerine küçük bir mola iyi gelebilir 🌿",
  "break.dismiss": "Kapat",

  // Epub reader surface
  "epub.openTimeout": "EPUB açma zaman aşımına uğradı",

  // Notes panel
  "notes.exportFailed": "Dışa aktarma başarısız oldu.",
  "notes.title": "Notlarım",
  "notes.export": "Dışa aktar",
  "notes.exportWord": "Word olarak indir (.docx)",
  "notes.exportPdf": "PDF olarak indir",
  "notes.highlightsCount": "Vurgular ({count})",
  "notes.bookmarksCount": "Yer İmleri ({count})",
  "notes.noHighlights": "Henüz vurgu yok. Metni seçip renk ve önem seçerek vurgulayabilirsin.",
  "notes.importanceLevel": "Önem seviyesi {level}",
  "notes.editNote": "Not düzenle",
  "notes.deleteHighlight": "Vurguyu sil",
  "notes.noBookmarks": "Henüz yer imi yok. Üstteki yer imi simgesine dokunarak ekleyebilirsin.",
  "notes.locationFallback": "Konum",
  "notes.deleteBookmark": "Yer imini sil",
  "notes.noteDialogTitle": "Not",
  "notes.notePlaceholder": "Bu vurgu hakkında not ekle…",

  // PDF reader surface
  "pdf.zoomOut": "Uzaklaştır",
  "pdf.zoomIn": "Yakınlaştır",
  "pdf.pageMode": "Sayfa modu",
  "pdf.scrollMode": "Kaydırma modu",

  // Reader onboarding
  "onboarding.swipe": "Sayfa çevirmek için sağa veya sola kaydırın",
  "onboarding.tap": "Menüyü açıp kapatmak için ekrana dokunun",
  "onboarding.gotIt": "Anladım",

  // Reader settings panel
  "theme.light": "Açık",
  "theme.cream": "Krem",
  "theme.sepia": "Sepya",
  "theme.dark": "Koyu",
  "theme.coffee": "Kahve",
  "theme.oledBlack": "Siyah",
  "theme.custom": "Özel",
  "font.literata": "Literata",
  "font.lora": "Lora",
  "font.garamond": "Garamond",
  "font.sans": "Sans",
  "font.dyslexic": "Dyslexic",
  "settings.title": "Okuma Ayarları",
  "settings.theme": "Tema",
  "settings.background": "Arka Plan",
  "settings.textColor": "Yazı",
  "settings.autoNightMode": "Otomatik Gece Modu",
  "settings.brightness": "Parlaklık",
  "settings.contrast": "Kontrast",
  "settings.warmth": "Sıcaklık",
  "settings.fontFamily": "Yazı Tipi",
  "settings.lineHeight": "Satır Aralığı",
  "settings.layout": "Düzen",
  "settings.margin": "Kenar Boşluğu",
  "settings.scrollMode": "Sonsuz Kaydırma",
  "settings.volumeKeyPageTurn": "Ses Tuşlarıyla Sayfa Çevirme",
  "settings.columns": "Sütun",
  "settings.pageTurnAnimation": "Sayfa Geçiş Animasyonu",
  "pageTurnAnimation.off": "Kapalı",
  "pageTurnAnimation.soft": "Yumuşak",
  "pageTurnAnimation.realistic": "Gerçekçi",

  // Reader view
  "reader.openError": "Bu kitap açılamadı — dosya bozuk ya da desteklenmeyen bir yapıda olabilir.",
  "reader.noTextOnPage": "Bu sayfada okunacak metin bulunamadı.",
  "reader.pageLabel": "Sayfa {page}",
  "reader.locationFallback": "Konum",
  "reader.bookNotFound": "Bu kitap bulunamadı.",
  "reader.fileMissing":
    "Kitap kaydı bulundu ancak dosyası cihazda yok. Kitabı kütüphaneye yeniden ekleyin.",
  "reader.loadError":
    "Kitap bilgileri yüklenirken bir sorun oluştu. Kütüphaneye dönüp yeniden deneyin.",
  "reader.loading": "Kitap yükleniyor",
  "reader.downloadingFile": "Kitap buluttan indiriliyor…",
  "reader.backToLibrary": "Kütüphaneye dön",
  "reader.stopReadAloud": "Sesli okumayı durdur",
  "reader.readAloud": "Sesli oku",
  "reader.searchInBook": "Kitapta ara",
  "reader.notes": "Notlarım",
  "reader.removeBookmark": "Yer imini kaldır",
  "reader.addBookmark": "Yer imi ekle",
  "reader.toc": "İçindekiler",
  "reader.settings": "Ayarlar",

  // Search panel
  "search.title": "Kitapta Ara",
  "search.placeholder": "Ara…",
  "search.noResults": "Sonuç bulunamadı.",
  "search.progress": "{completed}/{total} kısım tarandı · {count} sonuç",
  "search.failed": "Kitap aranırken bir hata oluştu.",

  // Selection bar
  "selection.cancel": "Vazgeç",
  "selection.chooseColor": "{color} rengi seç",
  "selection.importanceLevel": "Önem seviyesi {level}",
  "selection.highlight": "Vurgula",

  // TOC panel
  "toc.title": "İçindekiler",
  "toc.unnamedChapter": "Adsız Bölüm",

  // App metadata
  "app.title": "Kütüphanem",
  "app.description": "E-ink hissiyatlı EPUB/PDF okuyucu",

  // Import book
  "importBook.unsupportedType": "Desteklenmeyen dosya türü: {filename}",
  "importBook.unknownAuthor": "Bilinmeyen Yazar",

  // Loaders
  "epubLoader.untitledBook": "Adsız Kitap",
  "epubLoader.unknownAuthor": "Bilinmeyen Yazar",
  "pdfLoader.unknownAuthor": "Bilinmeyen Yazar",

  // Backup (lib)
  "backupLib.invalidFile": "Geçersiz yedek dosyası (manifest bulunamadı).",
  "backupLib.newerVersion": "Bu yedek, uygulamanın daha yeni bir sürümüyle oluşturulmuş.",

  // Export notes
  "exportNotes.defaultBookName": "Kitap",
  "exportNotes.noHighlights": "Henüz vurgu eklenmemiş.",
  "exportNotes.wordFilename": "{title} - Notlar.docx",
  "exportNotes.pdfFilename": "{title} - Notlar.pdf",
  "importance.normal": "Normal",
  "importance.important": "Önemli",
  "importance.veryImportant": "Çok Önemli",
  "importance.critical": "Kritik",

  // Native UI (notifications, shortcuts)
  "native.breakReminderTitle": "Ara vermek ister misin?",
  "native.breakReminderBody": "Biraz uzun süredir okuyorsun — gözlerine mola ver.",
  "native.continueReadingShortcut": "Devam et: {title}",

  // Language switcher
  "language.label": "Dil",
  "language.turkish": "Türkçe",
  "language.english": "English",

  // Account / cloud sync
  "account.ariaLabel": "Hesap",
  "account.description": "Kütüphaneni hesabınla senkronize et. Hesapsız kullanım her zaman çalışmaya devam eder.",
  "account.signInTitle": "Giriş Yap",
  "account.signUpTitle": "Hesap Oluştur",
  "account.signedInTitle": "Giriş yapıldı",
  "account.continueWithGoogle": "Google ile devam et",
  "account.orDivider": "veya",
  "account.emailLabel": "E-posta",
  "account.passwordLabel": "Şifre",
  "account.forgotPassword": "Şifremi unuttum",
  "account.signIn": "Giriş Yap",
  "account.signUp": "Hesap Oluştur",
  "account.signOut": "Çıkış Yap",
  "account.switchToSignUp": "Hesabın yok mu? Hesap oluştur",
  "account.switchToSignIn": "Zaten hesabın var mı? Giriş yap",
  "account.resetEmailSent": "Şifre sıfırlama e-postası gönderildi.",
  "account.errorWrongPassword": "E-posta veya şifre hatalı.",
  "account.errorEmailInUse": "Bu e-posta zaten kullanımda.",
  "account.errorWeakPassword": "Şifre çok zayıf, en az 6 karakter olmalı.",
  "account.errorInvalidEmail": "Geçersiz e-posta adresi.",
  "account.errorUserNotFound": "Bu e-postayla bir hesap bulunamadı.",
  "account.errorGeneric": "Bir şeyler ters gitti. Tekrar dene.",

  // Google Drive sync errors (background book-file backup failures)
  "drive.errorQuotaExceeded": "Drive'da yer kalmadı, kitap yedeklenemedi.",
  "drive.errorPermissionDenied": "Drive erişim izni iptal edilmiş, tekrar giriş yapın.",
  "drive.errorNotFound": "Kitap dosyası Drive'da bulunamadı.",
  "drive.errorGeneric": "Kitap Drive'a yedeklenemedi, daha sonra tekrar denenecek.",
} as const;
