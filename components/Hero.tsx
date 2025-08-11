import Link from 'next/link'

export default function Hero() {
  return (
    <section className="bg-gradient-to-br from-primary-50 to-blue-50 py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          {/* Badge */}
          <div className="inline-flex items-center px-4 py-2 bg-primary-100 text-primary-700 rounded-full text-sm font-medium mb-8">
            <span className="w-2 h-2 bg-primary-500 rounded-full mr-2"></span>
            Used by 1000+ software teams
          </div>

          {/* Main Heading */}
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
            The AI Code{' '}
            <span className="text-primary-600">Reviewer</span>
          </h1>

          {/* Subheading */}
          <div className="text-xl md:text-2xl text-gray-600 mb-8 space-y-2">
            <div className="font-semibold text-primary-600">CATCH 3X MORE BUGS</div>
            <div className="font-semibold text-blue-600">MERGE PRS 4X FASTER</div>
            <div className="font-semibold text-purple-600">100% CODEBASE CONTEXT</div>
          </div>

          {/* Description */}
          <p className="text-lg text-gray-600 max-w-3xl mx-auto mb-10">
            AI-powered code review and codebase intelligence platform. Unlike other tools, 
            we generate a detailed graph of your codebase and understand how everything fits together.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
            <Link href="/auth/signup" className="btn-primary text-lg px-8 py-3">
              Try For Free
            </Link>
            <Link href="/demo" className="btn-outline text-lg px-8 py-3">
              Watch Demo
            </Link>
          </div>

          {/* Trust Indicators */}
          <p className="text-sm text-gray-500 mb-8">
            no credit card required • 14-day free trial
          </p>

          {/* Feature Highlights */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16">
            <div className="text-center">
              <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Context-Aware Reviews</h3>
              <p className="text-gray-600">Reviews PRs with full understanding of your entire codebase, not just diffs</p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Lightning Fast</h3>
              <p className="text-gray-600">Merge pull requests 4X faster with automated, intelligent feedback</p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Enterprise Ready</h3>
              <p className="text-gray-600">SOC2 compliant with self-hosted deployment options for maximum security</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
} 