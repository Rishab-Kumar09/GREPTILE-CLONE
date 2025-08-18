export default function Pricing() {
  return (
    <section id="pricing" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-8">Simple, Transparent Pricing</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="card p-8">
            <h3 className="text-xl font-bold mb-4">Free</h3>
            <div className="text-3xl font-bold mb-4">$0</div>
            <p className="text-gray-600 mb-6">FREE during testing phase!</p>
            <ul className="text-left space-y-2 mb-8">
              <li>✓ Public repositories</li>
              <li>✓ Unlimited PR reviews</li>
              <li>✓ Full AI analysis</li>
            </ul>
            <a href="/auth/signup" className="btn-outline w-full inline-block text-center">Start Free (No Payment)</a>
          </div>
          <div className="card p-8 border-primary-500 border-2 relative">
            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-primary-500 text-white px-4 py-1 rounded-full text-sm">
              Most Popular
            </div>
            <h3 className="text-xl font-bold mb-4">Pro</h3>
            <div className="text-3xl font-bold mb-4">$0<span className="text-lg text-gray-600">/month</span>
              <div className="text-sm text-green-600">Usually $29/user</div>
            </div>
            <p className="text-gray-600 mb-6">FREE during testing phase!</p>
            <ul className="text-left space-y-2 mb-8">
              <li>✓ Private repositories</li>
              <li>✓ Unlimited PR reviews</li>
              <li>✓ Advanced AI models</li>
              <li>✓ Custom rules</li>
            </ul>
            <a href="/auth/signup" className="btn-primary w-full inline-block text-center">Activate Pro (Free)</a>
          </div>
          <div className="card p-8">
            <h3 className="text-xl font-bold mb-4">Enterprise</h3>
            <div className="text-3xl font-bold mb-4">$0
              <div className="text-sm text-green-600">Usually Custom Pricing</div>
            </div>
            <p className="text-gray-600 mb-6">FREE during testing phase!</p>
            <ul className="text-left space-y-2 mb-8">
              <li>✓ Self-hosted deployment</li>
              <li>✓ SSO/SAML integration</li>
              <li>✓ Custom AI models</li>
              <li>✓ SLA guarantee</li>
            </ul>
            <a href="/auth/signup" className="btn-outline w-full inline-block text-center">Get Enterprise (Free)</a>
          </div>
        </div>
      </div>
    </section>
  )
} 