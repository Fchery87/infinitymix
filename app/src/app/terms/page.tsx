export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-6 py-24">
        <h1 className="text-4xl font-bold mb-8">Terms of Service</h1>
        <p className="text-sm text-gray-500 mb-12">Last updated: March 2026</p>

        <div className="space-y-8 text-gray-300 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">1. Acceptance of Terms</h2>
            <p>
              By accessing or using InfinityMix, you agree to be bound by these Terms of Service.
              If you do not agree, do not use our service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">2. Use of Service</h2>
            <p>
              InfinityMix provides AI-powered audio mashup generation tools. You may use our service
              to create, share, and download audio mashups in accordance with applicable copyright law
              and our acceptable use policies.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">3. User Content</h2>
            <p>
              You retain ownership of any audio files you upload. By uploading content, you grant us
              a limited license to process, store, and generate derivative works solely for the purpose
              of providing our mashup generation service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">4. Intellectual Property</h2>
            <p>
              You are responsible for ensuring you have the right to use any audio content you upload.
              Generated mashups may be subject to copyright in the original works. We do not guarantee
              that generated mashups are free from third-party copyright claims.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">5. Subscriptions and Billing</h2>
            <p>
              Paid plans are billed monthly. You may cancel at any time. Refunds are handled on a
              case-by-case basis within 14 days of purchase.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">6. Limitation of Liability</h2>
            <p>
              InfinityMix is provided &quot;as is&quot; without warranties of any kind. We are not liable
              for any damages arising from your use of the service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">7. Changes to Terms</h2>
            <p>
              We may update these terms from time to time. Continued use of the service after changes
              constitutes acceptance of the updated terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">8. Contact</h2>
            <p>
              Questions about these terms can be sent to{' '}
              <a href="mailto:legal@infinitymix.com" className="text-primary hover:underline">
                legal@infinitymix.com
              </a>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
