interface ChunkOptions {
  maxChunkSize?: number
  overlap?: number
}

export function chunkText(
  text: string,
  options: ChunkOptions = {}
): string[] {
  const { maxChunkSize = 1500, overlap = 200 } = options

  const paragraphs = text.split(/\n\n+/).filter(p => p.trim())
  const chunks: string[] = []
  let current = ''

  for (const paragraph of paragraphs) {
    if (current && (current.length + paragraph.length + 2) > maxChunkSize) {
      chunks.push(current.trim())
      if (overlap > 0) {
        current = current.slice(-overlap) + '\n\n' + paragraph
      } else {
        current = paragraph
      }
    } else {
      current = current ? current + '\n\n' + paragraph : paragraph
    }
  }

  if (current.trim()) {
    chunks.push(current.trim())
  }

  return chunks.length > 0 ? chunks : [text]
}
