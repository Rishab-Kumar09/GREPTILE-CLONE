export default function HowItWorks() {
  const steps = [
    {
      number: 1,
      title: 'Codebase Indexing',
      description: 'We scan your entire codebase and create a detailed graph mapping all functions, classes, variables, files, and directories.',
      icon: '🔍'
    },
    {
      number: 2,
      title: 'AI Analysis',
      description: 'When you create a PR, our AI analyzes changes with full codebase context, understanding broader impact and dependencies.',
      icon: '🤖'
    },
    {
      number: 3,
      title: 'Bug Detection',
      description: 'AI identifies bugs, security vulnerabilities, anti-patterns, and performance issues that human reviewers typically miss.',
      icon: '🎯'
    },
    {
      number: 4,
      title: 'Inline Comments',
      description: 'Automated context-aware comments are posted directly on your GitHub/GitLab PR with specific feedback and suggestions.',
      icon: '💬'
    },
    {
      number: 5,
      title: 'Continuous Learning',
      description: 'The system learns from your team\'s feedback, custom rules, and coding patterns to continuously improve reviews.',
      icon: '📈'
    }
  ]

  return (
    <section id="how-it-works" className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            How It Works
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Our 5-step process transforms how your team approaches code review
          </p>
        </div>

        <div className="space-y-12">
          {steps.map((step, index) => (
            <div key={index} className={`flex flex-col lg:flex-row items-center gap-8 ${index % 2 === 1 ? 'lg:flex-row-reverse' : ''}`}>
              {/* Content */}
              <div className="flex-1 text-center lg:text-left">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-primary-600 text-white rounded-full text-xl font-bold mb-4">
                  {step.number}
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">
                  {step.title}
                </h3>
                <p className="text-lg text-gray-600 max-w-md mx-auto lg:mx-0">
                  {step.description}
                </p>
              </div>

              {/* Visual */}
              <div className="flex-1 flex justify-center">
                <div className="w-64 h-64 bg-white rounded-2xl border-2 border-gray-200 flex items-center justify-center shadow-lg">
                  <div className="text-center">
                    <div className="text-6xl mb-4">{step.icon}</div>
                    <div className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                      Step {step.number}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Results */}
        <div className="mt-20 bg-white rounded-2xl p-8 shadow-lg">
          <div className="text-center mb-8">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">
              The Result: Better Code, Faster Development
            </h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="text-4xl font-bold text-primary-600 mb-2">3X</div>
              <div className="text-lg font-semibold text-gray-900 mb-1">More Bugs Caught</div>
              <div className="text-gray-600">vs traditional reviews</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-blue-600 mb-2">4X</div>
              <div className="text-lg font-semibold text-gray-900 mb-1">Faster Merging</div>
              <div className="text-gray-600">reduced review time</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-green-600 mb-2">80%</div>
              <div className="text-lg font-semibold text-gray-900 mb-1">Less Manual Review</div>
              <div className="text-gray-600">automated feedback</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
} 