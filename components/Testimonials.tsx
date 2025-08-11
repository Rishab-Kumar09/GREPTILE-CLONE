export default function Testimonials() {
  const testimonials = [
    {
      quote: "Greptile Clone has transformed our code review process. We're catching 3X more bugs and shipping faster than ever.",
      author: "Sarah Chen",
      role: "Senior Engineering Manager",
      company: "TechCorp"
    },
    {
      quote: "The AI understands our codebase better than some of our junior developers. It's like having a senior engineer review every PR.",
      author: "Michael Rodriguez",
      role: "CTO",
      company: "StartupXYZ"
    },
    {
      quote: "Finally, an AI tool that actually understands context. No more false positives or irrelevant suggestions.",
      author: "Emily Watson",
      role: "Lead Developer",
      company: "InnovateLabs"
    }
  ]

  return (
    <section className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Loved by developers worldwide
          </h2>
          <p className="text-lg text-gray-600">
            See what teams are saying about their experience
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <div key={index} className="card p-6">
              <div className="text-primary-600 mb-4">
                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z"/>
                </svg>
              </div>
              <p className="text-gray-700 mb-6 italic">
                "{testimonial.quote}"
              </p>
              <div>
                <div className="font-semibold text-gray-900">{testimonial.author}</div>
                <div className="text-sm text-gray-600">{testimonial.role}</div>
                <div className="text-sm text-primary-600">{testimonial.company}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
} 