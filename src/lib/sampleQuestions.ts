/** 预置问询池：每次起卦时随机选一条预填，避免千篇一律。 */
const SAMPLE_QUESTIONS: readonly string[] = [
  '最近有一件重要的事，我该如何抉择？',
  '想了解近期事业的发展方向。',
  '感情上正面临选择，吉凶如何？',
  '即将到来的变化，我该如何应对？',
  '想静下心来，听听卦对当下的指点。',
  '最近总是心神不宁，该注意什么？',
  '手上的项目能否顺利推进？',
  '想请卦为我指点一段关键时期的取舍。',
  '家人安康，想知道近期需要注意什么。',
  '正在考虑一次新的尝试，卦象如何说？',
]

/** 随机取一条预置问询（每次调用结果不同）。 */
export function getRandomSampleQuestion(): string {
  const idx = Math.floor(Math.random() * SAMPLE_QUESTIONS.length)
  return SAMPLE_QUESTIONS[idx]
}

/** 导出池子本身（供测试与未来扩展）。 */
export const QUESTION_POOL: readonly string[] = SAMPLE_QUESTIONS