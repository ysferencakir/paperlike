import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Paperlike — Gizlilik Politikası",
  description: "Paperlike Android ve web/PWA uygulamasının gizlilik politikası.",
};

// Content mirrors the working draft in PROJECT_DOCUMENTATION.md § 13.6.
// The bracketed [PLACEHOLDER] values below are NOT legal advice and must be
// filled in by the app owner before this page is linked from Play Console or
// the app itself — see the "Yayınlanabilir hale getirme kontrol listesi" in
// that section for the full pre-publish checklist.
export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12 text-[15px] leading-relaxed">
      <h1 className="text-2xl font-semibold mb-1">Paperlike Gizlilik Politikası</h1>
      <p className="text-sm text-neutral-500 mb-8">
        Yürürlük tarihi: <Placeholder>YYYY-AA-GG</Placeholder>
      </p>

      <Field label="Veri sorumlusu/geliştirici">
        <Placeholder>PLAY_CONSOLE_DEVELOPER_OR_LEGAL_NAME</Placeholder>
      </Field>
      <Field label="Gizlilik iletişimi">
        <Placeholder>PRIVACY_EMAIL_OR_REQUEST_URL</Placeholder>
      </Field>

      <Section title="Kapsam">
        <p>
          Bu politika Paperlike Android uygulaması ve web/PWA sürümünün hangi verilere
          eriştiğini, verileri neden işlediğini, nereye aktardığını, ne kadar
          sakladığını ve kullanıcı seçeneklerini açıklar.
        </p>
      </Section>

      <Section title="Yerel kullanım">
        <p>
          Kullanıcı hesap açmadan EPUB/PDF okuyabilir. Kitap dosyaları, kapaklar,
          okuma ilerlemesi, vurgular, notlar, yer imleri, istatistikler ve tercihler
          öncelikle cihazdaki IndexedDB/localStorage içinde tutulur. Kullanıcı kitabı
          silebilir, site verisini temizleyebilir veya uygulamayı kaldırabilir.
          Android Auto Backup açıksa WebView verisi kullanıcının Android/Google
          yedekleme alanına cihaz transferi/kurtarma amacıyla taşınabilir.
        </p>
      </Section>

      <Section title="Hesap ve bulut senkronizasyonu">
        <p>
          Kullanıcı Google veya e-posta/parola ile hesap/sync seçerse Firebase
          Authentication kimlik doğrulama verisini işler. Kitap metadata&apos;sı,
          ilerleme, vurgu/not, yer imi ve desteklenen ayarlar Firestore&apos;a; orijinal
          kitap dosyası kullanıcının Google Drive alanına aktarılabilir. Paperlike{" "}
          <code>drive.file</code> scope&apos;u ile uygulamanın oluşturduğu veya
          kullanıcı tarafından uygulamayla açılan dosyalarla sınırlı erişim
          hedefler. Bulut verisi uçtan uca şifreli değildir; hizmet
          sağlayıcıların sunucu tarafı işleme koşulları geçerlidir.
        </p>
      </Section>

      <Section title="Crash ve analytics">
        <p>
          Android build&apos;inde Crashlytics otomatik collection manifest
          düzeyinde kapalıdır. Kullanıcı hesap panelindeki cihaz-yerel kontrolü
          açarsa crash trace, uygulama/OS/cihaz bilgisi, kurulum/session
          kimlikleri ve redakte edilmiş JavaScript error message/stack
          gönderilebilir. Opt-out JS iletimini hemen keser; Firebase&apos;in native
          override&apos;ı sonraki uygulama açılışında tam uygulanır ve uygulama
          gönderilmemiş raporların silinmesini ister. Firebase&apos;in yayımladığı
          mevcut retention&apos;a göre Crashlytics trace ve ilişkili kimlikleri 90 gün
          tutar, ardından live/backup sistemlerinden kaldırma sürecini başlatır.
          Firebase Analytics&apos;in etkin olduğu release&apos;lerde app interaction,
          cihaz/kurulum ve teknik tanılama verisi ayrıca işlenebilir; Analytics
          collection kararı Crashlytics opt-in kontrolünden ayrıdır.
        </p>
      </Section>

      <Section title="Üçüncü taraflar">
        <p>
          Google/Firebase; Authentication, Firestore, Crashlytics ve Analytics
          hizmetlerini, Google Drive ise kullanıcı tarafından seçilen
          senkronizasyonu sağlar. EPUB reader bugün Google Fonts&apos;a font
          stylesheet isteği gönderebilir; production hedefi fontları yerel
          paketlemektir. Kullanıcının başlattığı ZIP/DOCX/PDF paylaşımında
          seçilen hedef uygulamanın politikası geçerli olur.
        </p>
      </Section>

      <Section title="Saklama ve silme">
        <p>
          Yerel veri kullanıcı silene, site verisini temizleyene veya uygulamayı
          kaldırana kadar kalır. Kullanıcının dışa aktardığı dosyaları kullanıcı
          yönetir. Uygulama içi hesap silme aktif Firestore ağacını ve
          erişilebilir Drive <code>Paperlike</code> klasörlerini Auth&apos;tan önce
          siler; ancak production retention süresi, public web talep yolu ve
          ilişkili diagnostik verinin tasfiye sözleşmesi henüz tamamlanmamıştır.
          Hedef, hesap silme isteğinde aktif Firestore/Drive verisini en geç{" "}
          <Placeholder>TARGET_ACTIVE_DELETE_DAYS</Placeholder> gün içinde tasfiye
          etmek; yasal veya güvenlik gerekçesiyle tutulan istisnaları tür ve
          süreyle açıklamaktır. Firebase Auth kendi belgelenmiş backup temizleme
          süresini uygulayabilir. Bu hedef gerçek servis kanıtıyla
          doğrulanmadan hesaplı sürüm Play Store&apos;a gönderilmemelidir.
        </p>
      </Section>

      <Section title="Güvenlik">
        <p>
          Production Android cleartext trafiği kapalıdır ve Google/Firebase
          aktarımı HTTPS kullanır. Yerel veri işletim sistemi/origin
          sandbox&apos;ıyla korunur; ancak uygulama içi şifreleme ve uçtan uca cloud
          şifrelemesi yoktur. ZIP backup ve not export&apos;ları şifrelenmez;
          kullanıcı güvenli hedef seçmelidir. Hiçbir yöntem mutlak güvenlik
          garanti etmez.
        </p>
      </Section>

      <Section title="Kullanıcı seçenekleri">
        <p>
          Kullanıcı local-only kullanabilir, tekil kitap ve notları silebilir,
          kitaplığını ZIP olarak dışa aktarabilir ve hesabından çıkabilir. Hesap
          oluşturma sunulduğu için hem uygulama içinde hem{" "}
          <a href="/account-deletion" className="underline">
            /account-deletion
          </a>{" "}
          adresinde hesap ve ilişkili veri silme talebi sağlanır. Çıkış yapmak
          yerel cihaz verisini otomatik silmez.
        </p>
      </Section>

      <Section title="Çocuklar ve bölgesel haklar">
        <p>
          Hedef yaş grubu ve çocuklara yönelik ürün kararı{" "}
          <Placeholder>TARGET_AUDIENCE_DECISION</Placeholder> olarak
          doldurulmalıdır. Erişim, düzeltme, export, silme veya itiraz talepleri{" "}
          <Placeholder>PRIVACY_EMAIL_OR_REQUEST_URL</Placeholder> üzerinden
          alınır; kimlik doğrulama ve geçerli hukuk kapsamı uygulanır.
        </p>
      </Section>

      <Section title="Değişiklikler ve iletişim">
        <p>
          Politika değişiklikleri yürürlük tarihiyle bu sayfada yayınlanır;
          önemli veri amacı değişiklikleri gerektiğinde uygulama içinde
          bildirilir. Sorular için{" "}
          <Placeholder>PRIVACY_EMAIL_OR_REQUEST_URL</Placeholder> kullanılmalıdır.
        </p>
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="text-lg font-medium mb-2">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <p className="mb-1">
      <span className="font-medium">{label}:</span> {children}
    </p>
  );
}

function Placeholder({ children }: { children: React.ReactNode }) {
  return (
    <span className="bg-yellow-200/60 text-yellow-900 px-1 rounded font-mono text-[0.9em]">
      [{children}]
    </span>
  );
}
