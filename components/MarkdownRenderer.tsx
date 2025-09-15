import ReactMarkdown from 'react-markdown'

interface MarkdownRendererProps {
  content: string
  className?: string
  isUserMessage?: boolean
}

export default function MarkdownRenderer({ content, className = '', isUserMessage = false }: MarkdownRendererProps) {
  // Handle JSON responses - extract the answer if it's a JSON object
  let processedContent = content;
  try {
    const parsed = JSON.parse(content);
    if (parsed.answer) {
      processedContent = parsed.answer;
    } else if (parsed.content) {
      processedContent = parsed.content;
    } else if (typeof parsed === 'object' && parsed !== null) {
      // If it's an object but no answer/content field, try to extract meaningful text
      processedContent = parsed.message || parsed.text || parsed.response || JSON.stringify(parsed, null, 2);
    }
  } catch {
    // Not JSON, use content as-is
    processedContent = content;
  }

  return (
    <ReactMarkdown 
      className={`prose prose-sm max-w-none ${isUserMessage ? 'text-white' : ''} ${className}`}
      components={{
        // Custom styling for different elements
        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
        strong: ({ children }) => <strong className={`font-semibold ${isUserMessage ? 'text-white font-bold' : 'text-gray-900'}`}>{children}</strong>,
        em: ({ children }) => <em className="italic">{children}</em>,
        ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
        li: ({ children }) => <li className="text-sm">{children}</li>,
        h1: ({ children }) => <h1 className={`text-lg font-bold mb-2 ${isUserMessage ? 'text-white' : 'text-gray-900'}`}>{children}</h1>,
        h2: ({ children }) => <h2 className={`text-base font-semibold mb-2 ${isUserMessage ? 'text-white' : 'text-gray-900'}`}>{children}</h2>,
        h3: ({ children }) => <h3 className={`text-sm font-semibold mb-1 ${isUserMessage ? 'text-white' : 'text-gray-900'}`}>{children}</h3>,
        code: ({ children, className }) => {
          // Inline code
          if (!className) {
            return <code className={`px-1 py-0.5 rounded text-xs font-mono ${isUserMessage ? 'bg-blue-800 text-blue-100' : 'bg-gray-100 text-gray-900'}`}>{children}</code>
          }
          // Block code
          return <code className="block bg-gray-900 text-gray-100 p-2 rounded text-xs font-mono overflow-x-auto">{children}</code>
        },
        pre: ({ children }) => <pre className="bg-gray-900 text-gray-100 p-2 rounded text-xs font-mono overflow-x-auto mb-2">{children}</pre>,
        blockquote: ({ children }) => <blockquote className={`border-l-4 border-gray-300 pl-3 italic mb-2 ${isUserMessage ? 'text-blue-100' : 'text-gray-700'}`}>{children}</blockquote>,
        a: ({ children, href }) => <a href={href} className={`underline ${isUserMessage ? 'text-blue-200 hover:text-blue-100' : 'text-blue-600 hover:text-blue-800'}`} target="_blank" rel="noopener noreferrer">{children}</a>,
      }}
    >
      {processedContent}
    </ReactMarkdown>
  )
}
