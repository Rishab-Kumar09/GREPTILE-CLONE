export default function Features() {
  const features = [
    {
      icon: '🔍',
      title: 'Full Codebase Context',
      description: 'Unlike most tools, we generate a detailed graph of your codebase and understand how everything fits together.',
      color: 'primary'
    },
    {
      icon: '💬',
      title: 'In-line Comments',
      description: 'Context-aware comments on your PRs to identify bugs, antipatterns, and merge up to 80% faster.',
      color: 'blue'
    },
    {
      icon: '⚡',
      title: 'Quick Fix Suggestions',
      description: 'Click-to-accept suggestions to fix minor issues in your PR without leaving GitHub.',
      color: 'green'
    },
    {
      icon: '📋',
      title: 'PR Summaries',
      description: 'Get a summary of every PR in natural language to understand what\'s changed.',
      color: 'purple'
    },
    {
      icon: '🎯',
      title: 'Custom Rules',
      description: 'Add custom rules, style guides, and other context to customize reviews for your org.',
      color: 'orange'
    },
    {
      icon: '🧠',
      title: 'Learning System',
      description: 'AI learns from your feedback and adapts to your team\'s coding patterns over time.',
      color: 'pink'
    }
  ]

  const getColorClasses = (color: string) => {
    const colors = {
      primary: 'bg-primary-100 text-primary-600',
      blue: 'bg-blue-100 text-blue-600',
      green: 'bg-green-100 text-green-600',
      purple: 'bg-purple-100 text-purple-600',
      orange: 'bg-orange-100 text-orange-600',
      pink: 'bg-pink-100 text-pink-600'
    }
    return colors[color as keyof typeof colors] || colors.primary
  }

  return (
    <section id="features" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Your second pair of eyes
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Greptile automatically reviews PRs in GitHub and GitLab with full context of your codebase
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div key={index} className="card p-6 hover:shadow-lg transition-shadow">
              <div className={`w-12 h-12 rounded-lg ${getColorClasses(feature.color)} flex items-center justify-center mb-4`}>
                <span className="text-2xl">{feature.icon}</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                {feature.title}
              </h3>
              <p className="text-gray-600">
                {feature.description}
              </p>
            </div>
          ))}
        </div>

        {/* Language Support */}
        <div className="mt-16 text-center">
          <h3 className="text-2xl font-bold text-gray-900 mb-8">30+ Languages Supported</h3>
          <div className="flex flex-wrap justify-center gap-4">
            {['Python', 'JavaScript', 'TypeScript', 'Go', 'Java', 'Ruby', 'Elixir', 'Rust', 'PHP', 'C++', 'C#', 'Swift'].map((lang) => (
              <span key={lang} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-full text-sm font-medium">
                {lang}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
} 