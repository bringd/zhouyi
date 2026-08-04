import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/Button'

interface SmsModalProps {
  onClose: () => void
  onSuccess: (phone: string) => void
}

const PHONE_REGEX = /^1[3-9]\d{9}$/

export function SmsModal({ onClose, onSuccess }: SmsModalProps) {
  const [step, setStep] = useState<'phone' | 'code'>('phone')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSend() {
    setError(null)
    if (!PHONE_REGEX.test(phone)) {
      setError('手机号格式错误,请输入 11 位中国手机号')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/sms/send', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ phone }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.message ?? '发送失败,请稍后再试')
        return
      }
      setStep('code')
    } finally {
      setLoading(false)
    }
  }

  async function handleVerify() {
    setError(null)
    if (!/^\d{6}$/.test(code)) {
      setError('验证码为 6 位数字')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/sms/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ phone, code }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.message ?? '验证失败')
        return
      }
      onSuccess(phone)
      onClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-ink/50 flex items-center justify-center z-50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="bg-rice border-2 border-june-bronze p-6 rounded-md max-w-sm w-full mx-4"
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          onClick={(e) => e.stopPropagation()}
        >
          <h2 className="font-display text-xl text-ink mb-4">
            {step === 'phone' ? '用手机号注册' : '输入验证码'}
          </h2>

          {step === 'phone' ? (
            <>
              <label className="block text-sm text-ink-light mb-1" htmlFor="phone">手机号</label>
              <input
                id="phone"
                type="tel"
                inputMode="numeric"
                maxLength={11}
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                className="w-full px-3 py-2 border border-june-bronze rounded-sm bg-rice-warm font-num"
                placeholder="11 位手机号"
              />
              <p className="text-xs text-ink-light mt-2">
                我们会发送 6 位验证码到你的手机。本地 dev 模式下,验证码会显示在 wrangler 控制台。
              </p>
            </>
          ) : (
            <>
              <label className="block text-sm text-ink-light mb-1" htmlFor="code">验证码</label>
              <input
                id="code"
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                className="w-full px-3 py-2 border border-june-bronze rounded-sm bg-rice-warm font-num tracking-widest"
                placeholder="6 位数字"
              />
              <p className="text-xs text-ink-light mt-2">
                已发送至 {phone.slice(0, 3)}****{phone.slice(-4)}
              </p>
            </>
          )}

          {error && <p className="text-sm text-june-red mt-2">{error}</p>}

          <div className="flex gap-2 mt-4">
            <Button variant="ghost" onClick={onClose}>取消</Button>
            <Button
              variant="primary"
              onClick={step === 'phone' ? handleSend : handleVerify}
              loading={loading}
            >
              {step === 'phone' ? '发送验证码' : '注册'}
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
