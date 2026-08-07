import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'

/* ----------------------------------------------------------------
   Markdown — renderizador de markdown para mensagens do assistente.
   Suporta: bold, italic, code, code blocks, listas, tabelas, links.
   Respeita design system: tokens, mono, cores.
   ---------------------------------------------------------------- */

const components: Components = {
  p: ({ children }) => (
    <p style={{ margin: '0 0 8px', lineHeight: 1.6 }}>{children}</p>
  ),
  strong: ({ children }) => (
    <strong style={{ fontWeight: 600, color: 'var(--t-hi)' }}>{children}</strong>
  ),
  em: ({ children }) => (
    <em style={{ fontStyle: 'italic' }}>{children}</em>
  ),
  code: ({ children, className }) => {
    const isBlock = className?.includes('language-')
    if (isBlock) {
      return (
        <code style={{
          display: 'block',
          padding: '12px 14px',
          margin: '8px 0',
          borderRadius: 'var(--r-xs)',
          background: 'var(--fill-1)',
          border: '1px solid var(--hair)',
          fontFamily: 'var(--f-mono)',
          fontSize: 12.5,
          lineHeight: 1.55,
          color: 'var(--t-mid)',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          overflowX: 'auto',
        }}>
          {children}
        </code>
      )
    }
    return (
      <code style={{
        padding: '2px 6px',
        borderRadius: 4,
        background: 'var(--fill-1)',
        fontFamily: 'var(--f-mono)',
        fontSize: '0.9em',
        color: 'var(--accent)',
      }}>
        {children}
      </code>
    )
  },
  pre: ({ children }) => (
    <pre style={{
      margin: '8px 0',
      padding: 0,
      background: 'none',
      overflow: 'visible',
    }}>
      {children}
    </pre>
  ),
  ul: ({ children }) => (
    <ul style={{
      margin: '6px 0',
      paddingLeft: 20,
      listStyleType: 'disc',
    }}>
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol style={{
      margin: '6px 0',
      paddingLeft: 20,
    }}>
      {children}
    </ol>
  ),
  li: ({ children }) => (
    <li style={{ margin: '3px 0', lineHeight: 1.55 }}>{children}</li>
  ),
  h1: ({ children }) => (
    <h1 style={{ fontSize: 18, fontWeight: 600, color: 'var(--t-hi)', margin: '12px 0 6px' }}>{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--t-hi)', margin: '10px 0 5px' }}>{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--t-hi)', margin: '8px 0 4px' }}>{children}</h3>
  ),
  blockquote: ({ children }) => (
    <blockquote style={{
      margin: '8px 0',
      paddingLeft: 14,
      borderLeft: '3px solid var(--accent)',
      color: 'var(--t-low)',
      fontStyle: 'italic',
    }}>
      {children}
    </blockquote>
  ),
  table: ({ children }) => (
    <div style={{ overflowX: 'auto', margin: '8px 0' }}>
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: 13,
        fontFamily: 'var(--f-mono)',
      }}>
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => (
    <thead style={{
      borderBottom: '1px solid var(--hair)',
    }}>
      {children}
    </thead>
  ),
  th: ({ children }) => (
    <th style={{
      padding: '6px 10px',
      textAlign: 'left',
      fontSize: 11.5,
      fontWeight: 600,
      color: 'var(--t-low)',
      letterSpacing: '.02em',
      textTransform: 'uppercase',
    }}>
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td style={{
      padding: '5px 10px',
      color: 'var(--t-mid)',
      borderBottom: '1px solid rgba(255,255,255,.03)',
    }}>
      {children}
    </td>
  ),
  img: ({ src, alt }) => (
    <img
      src={src}
      alt={alt || ''}
      loading="lazy"
      style={{
        maxWidth: '100%',
        height: 'auto',
        borderRadius: 'var(--r-xs)',
        margin: '6px 0',
        display: 'block',
        maxHeight: 200,
        objectFit: 'cover',
        background: 'var(--fill-1)',
      }}
      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
    />
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{ color: 'var(--accent)', textDecoration: 'underline', textUnderlineOffset: 3 }}
    >
      {children}
    </a>
  ),
  hr: () => (
    <hr style={{
      border: 'none',
      borderTop: '1px solid var(--hair)',
      margin: '12px 0',
    }} />
  ),
}

export function Markdown({ content }: { content: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {content}
    </ReactMarkdown>
  )
}
