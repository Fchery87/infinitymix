export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-6 py-24">
        <h1 className="text-4xl font-bold mb-8">Privacy Policy</h1>
        <p className="text-sm text-gray-500 mb-12">Last updated: March 2026</p>

        <div className="space-y-8 text-gray-300 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">1. Information We Collect</h2>
            <p>
              We collect information you provide directly: account details (name, email),
              audio files you upload, and mashups you generate. We also collect usage data
              such as pages visited, features used, and device information.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">2. How We Use Your Information</h2>
            <p>
              We use your information to provide and improve our AI mashup generation service,
              personalize your experience, and communicate updates about our platform.
              Audio files are processed server-side for stem separation and mixing.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">3. Data Storage and Security</h2>
            <p>
              Your data is stored securely using industry-standard encryption. Audio files are
              stored in Cloudflare R2 with access controls. We retain your data as long as your
              account is active or as needed to provide our services.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">4. Data Sharing</h2>
            <p>
              We do not sell your personal data. We share data only with service providers
              necessary to operate InfinityMix (e.g., cloud hosting, payment processing),
              and only under strict data processing agreements.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">5. Your Rights</h2>
            <p>
              You may access, correct, or delete your personal data at any time through your
              account settings. You may request a full export of your data or account deletion
              by contacting us.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">6. Cookies</h2>
            <p>
              We use essential cookies for authentication and session management.
              We do not use tracking cookies for advertising purposes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">7. Children&apos;s Privacy</h2>
            <p>
              InfinityMix is not intended for users under 13. We do not knowingly collect
              personal information from children.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">8. Contact</h2>
            <p>
              Questions about this policy can be sent to{' '}
              <a href="mailto:privacy@infinitymix.com" className="text-primary hover:underline">
                privacy@infinitymix.com
              </a>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
