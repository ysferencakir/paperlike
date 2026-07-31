# PWA görsel referansları

Bu klasör masaüstü Chromium ve mobil Pixel/Chromium PWA durumlarının gözle
incelenebilir referans ekranlarını içerir. Görseller deterministik
storage/service-worker taklitleri, TR locale, açık tema ve azaltılmış hareket
ayarıyla üretilir. iPhone/WebKit davranışı ayrı uyumluluk matrisinde doğrulanır.

Kapsanan durumlar:

- boş kütüphane;
- kurulu PWA + depolama paneli;
- gerçek service worker üzerinden offline app shell;
- güncelleme hazır bildirimi;
- runtime cache yazma hatası ve korunmuş kütüphane.

Referansları bilinçli bir arayüz değişikliğinden sonra yenilemek için:

```bash
npm run test:visual:update
```

Normal kalite kontrolünde `npm run test:visual` aynı durumlarda görünürlük,
viewport taşması, dialog/banner erişilebilirliği ve ekran üretimini doğrular.
CI çıktıları `pwa-visual-references` artifact'i olarak saklanır.
