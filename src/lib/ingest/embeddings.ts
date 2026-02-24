import OpenAI from 'openai'

function getClient() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await getClient().embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  })
  return response.data[0].embedding
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const response = await getClient().embeddings.create({
    model: 'text-embedding-3-small',
    input: texts,
  })
  return response.data.map(d => d.embedding)
}
