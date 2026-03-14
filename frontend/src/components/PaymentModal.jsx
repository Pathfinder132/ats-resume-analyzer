import { useState } from 'react'
import { createPaymentOrder, verifyPayment } from '../services/api'

export default function PaymentModal({ resumeId, onSuccess, onClose }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handlePayment = async () => {
    setLoading(true)
    setError('')
    try {
      const order = await createPaymentOrder(resumeId)

      const options = {
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: 'ResumeIQ',
        description: 'ATS Resume Optimization',
        order_id: order.orderId,
        handler: async (response) => {
          try {
            await verifyPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              resumeId
            })
            onSuccess()
          } catch (e) {
            setError('Payment verification failed. Please contact support.')
          }
        },
        prefill: { name: '', email: '', contact: '' },
        theme: { color: '#0D0D0D' },
        modal: { ondismiss: () => setLoading(false) }
      }

      const rzp = new window.Razorpay(options)
      rzp.on('payment.failed', () => setError('Payment failed. Please try again.'))
      rzp.open()
    } catch (e) {
      setError(e.message || 'Failed to initiate payment')
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-900/60 backdrop-blur-sm">
      <div className="card w-full max-w-md p-8 animate-fade-up">
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <div className="section-tag mb-2">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><circle cx="5" cy="5" r="5"/></svg>
              Unlock Full Optimization
            </div>
            <h2 className="font-display text-2xl text-ink-900">Supercharge your resume</h2>
          </div>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-800 transition-colors p-1">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Features */}
        <div className="bg-ink-50 rounded-xl p-5 mb-6 space-y-3">
          {[
            'Detailed AI-powered ATS analysis',
            'Optimized bullet points with impact metrics',
            'Missing keywords inserted naturally',
            'ATS-safe formatting improvements',
            'Downloadable optimized PDF resume',
          ].map((f, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-sage-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="white" strokeWidth="2">
                  <path d="M2 5l2.5 2.5L8 2.5"/>
                </svg>
              </div>
              <span className="text-sm text-ink-700">{f}</span>
            </div>
          ))}
        </div>

        {/* Price */}
        <div className="flex items-center justify-between mb-6 pb-5 border-b border-ink-100">
          <div>
            <p className="text-sm text-ink-500 mb-0.5">One-time payment</p>
            <div className="flex items-baseline gap-1">
              <span className="font-display text-4xl text-ink-900">₹99</span>
              <span className="text-ink-400 text-sm">INR</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-ink-400 line-through">₹499</div>
            <div className="text-xs text-sage-500 font-500">80% off launch price</div>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-crimson-50 border border-crimson-200 rounded-lg text-sm text-crimson-500">
            {error}
          </div>
        )}

        <button
          onClick={handlePayment}
          disabled={loading}
          className="btn-sage w-full text-base py-4 mb-3"
        >
          {loading ? (
            <>
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              Preparing checkout...
            </>
          ) : (
            <>Pay ₹99 &amp; Optimize Resume</>
          )}
        </button>

        <p className="text-center text-xs text-ink-400">
          Secured by Razorpay · UPI, Cards, Net Banking accepted
        </p>
      </div>
    </div>
  )
}
