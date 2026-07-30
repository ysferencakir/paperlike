# Manuel Test Listesi

Bu oturumda yapılan değişiklikleri telefonda doğrulamak için. Önce en yeni/riskli maddeler, sonra genel regresyon kontrolü.

Kurulum: Android Studio'dan **Run** ile telefona güncel APK'yı kur (bu oturumda native tarafa dokunuldu — sadece dev-server yenilemesi yetmez).

---

## 1. Yeni: Ev ekranı widget'ı

- [ ] Ana ekrana uzun basıp "Widget ekle" ile Paperlike'ın "continue reading" widget'ını ekle.
- [ ] Hiç kitap açılmamışsa widget "Henüz açık bir kitap yok" gösteriyor mu?
- [ ] Bir kitap aç, birkaç sayfa çevir, ana ekrana dön → widget birkaç saniye içinde kitap adı + yüzde ile güncelleniyor mu?
- [ ] Widget'a dokun → doğrudan o kitabın kaldığın sayfasını açıyor mu?
- [ ] İkinci bir kitap aç → widget o kitaba geçiyor mu (eskisi kalmıyor)?
- [ ] Widget'ı büyütüp küçültmeyi dene (resize) — layout bozuluyor mu?

## 2. Yeni: Bildirim izni akışı (mola hatırlatıcıları)

- [ ] Ayarlar → Okuma istatistikleri panelinde "Mola hatırlatıcıları" anahtarını ilk kez aç → sistem bildirim izni diyaloğu çıkıyor mu?
- [ ] İzni **reddet** → anahtar otomatik kapalı kalıyor mu, ve "bildirim izni verilmedi" toast'ı görünüyor mu?
- [ ] Anahtarı tekrar aç, bu sefer izni **ver** → anahtar açık kalıyor mu?
- [ ] Bir kitabı aç, ayarlanan süre kadar bekle (veya kısa bir süreye ayarlayıp test et) → mola bildirimi geliyor mu, uygulama arka plandayken de?

## 3. Yeni: Biyometrik kilit + kaçış yolu

- [ ] Yedekleme menüsünden (kütüphane başlığındaki bulut ikonu) "Biyometrik kilit" anahtarını aç.
- [ ] Uygulamayı arka plana al, tekrar öne getir → kilit ekranı çıkıyor mu?
- [ ] Doğru parmak izi/PIN ile kilidi aç → kütüphaneye giriyor musun?
- [ ] **Kaçış yolu testi**: kilit ekranında bilerek 2 kez yanlış dene (veya iptal et) → "Kilidi devre dışı bırak" linki çıkıyor mu?
- [ ] O linke tıkla → onay ekranı çıkıyor mu ("Evet, kapat" / "Vazgeç")?
- [ ] "Evet, kapat" de → kilit tamamen kapanıp kütüphaneye giriyor musun, ve ayarlarda anahtar da kapalı görünüyor mu?

## 4. Yeni: Cold start hissi

- [ ] Uygulamayı tamamen kapat (son uygulamalardan da temizle), tekrar aç → kütüphane ekranı öncekine göre daha hızlı/akıcı açılıyor gibi mi hissediliyor? (Kesin ölçüm zor ama fark edilir bir yavaşlık *olmamalı*.)
- [ ] Yeni bir epub kitap ekle (dosyadan aç veya + ile) → kapak/başlık çıkarma hâlâ düzgün çalışıyor mu (ilk kez biraz daha geç yüklenebilir, kütüphane çökmeden bekliyor mu)?
- [ ] Notlar panelinden "Word olarak dışa aktar" ve "PDF olarak dışa aktar" — ikisi de hâlâ çalışıyor mu?
- [ ] Yedekleme menüsünden "Yedekle" (export) ve "Geri Yükle" (import) — ikisi de hâlâ çalışıyor mu?

## 5. Genel regresyon (bu oturumda dokunulan diğer alanlar)

- [ ] Sayfa çevirme: hem EPUB hem PDF'te parmakla kaydırma (swipe) düzgün çalışıyor mu, ortadaki dokunma menüyü açıyor mu?
- [ ] Geri tuşu: panel açıkken kapatıyor, okuyucudayken kütüphaneye dönüyor, kütüphanedeyken uygulamadan çıkıyor mu?
- [ ] Immersive mod: okurken sistem nav bar'ı gizli mi, alttan swipe ile geçici geri gelip tekrar gizleniyor mu?
- [ ] Ses tuşlarıyla sayfa çevirme (ayarlardan açık ise) çalışıyor mu?
- [ ] Uygulama kısayolu: ana ekran ikonuna uzun bas → "Devam et: <kitap>" kısayolu doğru kitaba gidiyor mu?
- [ ] "Şununla aç" / "Paylaş" ile başka bir uygulamadan (dosya yöneticisi, e-posta) bir epub/pdf açmayı dene.
- [ ] Dil değiştirme (Yedekleme menüsü → Türkçe/English) → arayüz tamamen değişiyor mu, eksik/İngilizce kalan Türkçe metin var mı (veya tersi)?
- [ ] Karanlık/aydınlık tema geçişinde durum çubuğu rengi doğru senkronize oluyor mu?
- [ ] Tablet/geniş ekranda (varsa) iki sayfalık görünüm otomatik açılıyor mu?

## 6. Sadece elle test edilecek, kod tarafında değişiklik yok

- [ ] **Yatay ekran (landscape)**: okuma modunda telefonu döndür — layout bozulmadan uyum sağlıyor mu?
- [ ] **Katlanabilir cihaz**: (elinde varsa) ekranı açıp kapatınca layout kırılıyor mu?
- [ ] **Native metin seçimi + büyüteç**: okurken bir kelimeye uzun bas — sistem metin seçimi/büyüteç normal şekilde çalışıyor mu?
- [ ] **Büyük yazı tipi**: telefon ayarlarından sistem yazı tipini büyüt → uygulama arayüzü (menüler, ayarlar) taşmadan büyüyor mu?

---

Bir şey bozuksa, hangi madde olduğunu ve ne gördüğünü yazman yeterli — devamını buradan takip ederim.
