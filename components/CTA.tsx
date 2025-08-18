import Link from 'next/link'

export default function CTA() {
  return (
    <section className="py-20 bg-primary-600">
      <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
          Ready to revolutionize your code reviews?
        </h2>
        <p className="text-xl text-primary-100 mb-8">
          Join thousands of developers already using AI to ship better code faster.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/auth/signup" className="btn bg-white text-primary-600 hover:bg-gray-100 text-lg px-8 py-3">
                          Sign Up
          </Link>
          <Link href="/demo" className="btn border-white text-white hover:bg-white hover:text-primary-600 text-lg px-8 py-3">
            Schedule Demo
          </Link>
        </div>
        <p className="text-sm text-primary-200 mt-6">
          14-day free trial • No credit card required • Cancel anytime
        </p>
      </div>
    </section>
  )
} 