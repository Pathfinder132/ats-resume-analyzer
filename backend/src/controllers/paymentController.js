const Razorpay = require("razorpay");
const crypto = require("crypto");
const Payment = require("../models/Payment");
const Resume = require("../models/Resume");

const getRazorpay = () =>
  new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_SECRET,
  });

// POST /api/payment/create-order
const createOrder = async (req, res) => {
  try {
    const { resumeId } = req.body;
    if (!resumeId) return res.status(400).json({ success: false, message: "resumeId required" });

    const resume = await Resume.findOne({ resumeId });
    if (!resume) return res.status(404).json({ success: false, message: "Resume not found" });
    if (resume.isPaid) return res.status(400).json({ success: false, message: "Already paid" });

    const razorpay = getRazorpay();
    const order = await razorpay.orders.create({
      amount: 9900, // ₹99 in paise
      currency: "INR",
      receipt: `rcpt_${resumeId.slice(0, 8)}`,
      notes: { resumeId },
    });

    await Payment.create({
      resumeId,
      orderId: order.id,
      amount: 99,
      currency: "INR",
      status: "created",
    });

    res.json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    console.error("Create order error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/payment/verify
const verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, resumeId } = req.body;

    const secret = process.env.RAZORPAY_SECRET;
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto.createHmac("sha256", secret).update(body).digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ success: false, message: "Invalid payment signature" });
    }

    // Mark payment
    await Payment.findOneAndUpdate(
      { orderId: razorpay_order_id },
      { paymentId: razorpay_payment_id, signature: razorpay_signature, status: "paid" },
    );

    // Unlock resume
    await Resume.findOneAndUpdate({ resumeId }, { isPaid: true, paymentId: razorpay_payment_id });

    res.json({ success: true, message: "Payment verified successfully" });
  } catch (err) {
    console.error("Verify payment error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { createOrder, verifyPayment };
