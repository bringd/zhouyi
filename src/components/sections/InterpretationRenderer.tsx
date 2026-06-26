/**
 * Render an AI interpretation that uses Markdown-style headings.
 *
 * The AI is prompted to emit 6 sections prefixed by `## `:
 *
 *   ## 卦象概要
 *   (paragraph...)
 *
 *   ## 当前状态
 *   (paragraph...)
 *
 *   ...
 *
 * This component splits the text on `^## ` lines and renders each
 * heading as a styled h3 (matching the card's design tokens), with
 * the body text in a readable 15px font and ample line-height.
 *
 * Legacy `**bold**` markers in body text are stripped — they were
 * used as a poor man's heading by the previous prompt and look
 * noisy next to real headings.
 */
import { Fragment } from 'react'

interface InterpretationRendererProps {
  text: string
}

const HEADING_CLASSES =
  'mt-5 first:mt-0 font-display text-base text-june-bronze tracking-[0.25em] ' +
  'flex items-center gap-2 before:content-[""] before:block before:w-1 ' +
  'before:h-4 before:bg-june-bronze before:rounded-sm'

const BODY_CLASSES = 'mt-2 font-body text-[15px] text-ink leading-[1.9]'

function stripBold(text: string): string {
  // Drop `**...**` markers (no nested emphasis in our prompt output).
  return text.replace(/\*\*(.+?)\*\*/g, '$1')
}

interface Section {
  heading: string
  body: string
}

function parseSections(text: string): Section[] {
  const sections: Section[] = []
  const lines = text.split('\n')
  let currentHeading: string | null = null
  let currentBody: string[] = []

  const flush = () => {
    if (currentHeading !== null) {
      sections.push({
        heading: currentHeading.trim(),
        body: currentBody.join('\n').trim(),
      })
    }
  }

  for (const line of lines) {
    const match = line.match(/^##\s+(.+)$/)
    if (match) {
      flush()
      currentHeading = match[1]
      currentBody = []
    } else {
      currentBody.push(line)
    }
  }
  flush()

  // Fallback: if the AI didn't use `## ` headings, treat the whole
  // text as a single section so we still render it (without a
  // heading) instead of showing nothing.
  if (sections.length === 0) {
    sections.push({ heading: '', body: text.trim() })
  }

  return sections
}

export function InterpretationRenderer({ text }: InterpretationRendererProps) {
  const sections = parseSections(text)
  return (
    <div className="space-y-1">
      {sections.map((section, idx) => (
        <Fragment key={idx}>
          {section.heading && <h3 className={HEADING_CLASSES}>{section.heading}</h3>}
          {section.body && (
            <p className={BODY_CLASSES + (section.heading ? '' : ' first:mt-0')}>
              {stripBold(section.body)
                .split('\n')
                .map((line, i) => (
                  <Fragment key={i}>
                    {line}
                    {i < section.body.split('\n').length - 1 && <br />}
                  </Fragment>
                ))}
            </p>
          )}
        </Fragment>
      ))}
    </div>
  )
}