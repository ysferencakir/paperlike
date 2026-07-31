import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Paperlike — Hesap ve Veri Silme",
  description: "Paperlike hesabınızı ve buluttaki verilerinizi nasıl silebileceğiniz.",
};

// Public, unauthenticated deletion-request page required by Google Play's
// account deletion policy (a store listing must link to a page describing
// deletion even for users who can no longer sign in). Mirrors the in-app
// flow in components/library/AccountDialog.tsx and lib/account-deletion.ts.
// [PLACEHOLDER] values must be filled in before this page is linked from
// Play Console — see PROJECT_DOCUMENTATION.md § 13.6.
export default function AccountDeletionPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12 text-[15px] leading-relaxed">
      <h1 className="text-2xl font-semibold mb-6">Hesap ve Veri Silme</h1>

      <Section title="Uygulama içinden silme (önerilen)">
        <p>
          Paperlike&apos;a Google veya e-posta/parola ile giriş yapabiliyorsanız,
          hesabınızı ve buluttaki verilerinizi doğrudan uygulama içinden
          silebilirsiniz:
        </p>
        <ol className="list-decimal pl-5 mt-2 space-y-1">
          <li>Paperlike&apos;ı açın ve kütüphane ekranından hesap panelini açın.</li>
          <li>&quot;Hesabı ve verileri sil&quot; seçeneğine dokunun.</li>
          <li>
            İsterseniz bu cihazdaki yerel kitaplığı da silmeyi işaretleyin
            (işaretlemezseniz kitaplarınız cihazda kalır).
          </li>
          <li>Kimliğinizi yeniden doğrulayın ve silme işlemini onaylayın.</li>
        </ol>
        <p className="mt-2">
          Onay sonrası Firebase hesabınız, bulut kitaplığınız, notlarınız, yer
          imleriniz, ayarlarınız ve varsa Google Drive&apos;daki Paperlike
          klasörünüz kalıcı olarak silinir. Bu işlem geri alınamaz.
        </p>
      </Section>

      <Section title="Uygulamaya erişemiyorsanız">
        <p>
          Cihazınıza veya hesabınıza artık erişiminiz yoksa, hesap ve veri
          silme talebinizi hesabınızla ilişkili e-posta adresinden{" "}
          <Placeholder>PRIVACY_EMAIL_OR_REQUEST_URL</Placeholder> adresine
          göndererek iletebilirsiniz. Talebi işleme almak için sahiplik
          doğrulaması isteyebiliriz.
        </p>
      </Section>

      <Section title="Hangi veriler silinir">
        <ul className="list-disc pl-5 space-y-1">
          <li>Firebase kimlik doğrulama hesabı (e-posta, UID).</li>
          <li>Firestore&apos;daki kitap metadata&apos;sı, ilerleme, vurgu/not, yer imi ve ayarlar.</li>
          <li>Google Drive&apos;daki Paperlike klasöründe saklanan kitap dosyaları (Drive senkronizasyonu kullanıldıysa).</li>
        </ul>
        <p className="mt-2">
          Cihazınızdaki yerel kitaplık bu silme kapsamına dahil değildir; ayrı
          bir seçimdir ve isterseniz uygulama içinden silebilirsiniz.
        </p>
      </Section>

      <Section title="Ne kadar sürer">
        <p>
          Uygulama içi talepler anında işleme alınır. Aktif Firestore ve Drive
          verisi en geç <Placeholder>TARGET_ACTIVE_DELETE_DAYS</Placeholder>{" "}
          gün içinde tasfiye edilir. Firebase Authentication, kendi
          belgelenmiş yedek temizleme süresini ayrıca uygulayabilir.
        </p>
      </Section>

      <p className="text-sm text-neutral-500 mt-8">
        Daha fazla bilgi için{" "}
        <a href="/privacy" className="underline">
          Gizlilik Politikası
        </a>
        &apos;na bakın.
      </p>
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

function Placeholder({ children }: { children: React.ReactNode }) {
  return (
    <span className="bg-yellow-200/60 text-yellow-900 px-1 rounded font-mono text-[0.9em]">
      [{children}]
    </span>
  );
}
