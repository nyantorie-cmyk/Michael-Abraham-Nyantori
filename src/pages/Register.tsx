import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, CreditCard, Smartphone, CheckCircle2, User, Phone, ShieldCheck, Key } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Register() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1: Form, 2: Verification, 3: Success
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    paymentMethod: 'phone'
  });
  const [verificationCode, setVerificationCode] = useState(['', '', '', '']);

  const handleInitialSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStep(2);
  };

  const handleVerificationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStep(3);
    setTimeout(() => {
      navigate('/');
    }, 2500);
  };

  const handleCodeChange = (index: number, value: string) => {
    if (value.length > 1) return;
    const newCode = [...verificationCode];
    newCode[index] = value;
    setVerificationCode(newCode);

    // Auto-focus next input
    if (value && index < 3) {
      const nextInput = document.getElementById(`code-${index + 1}`);
      nextInput?.focus();
    }
  };

  if (step === 3) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center px-6 text-center space-y-6 animate-in fade-in zoom-in duration-500">
        <motion.div 
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="w-24 h-24 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-500 mb-4"
        >
          <CheckCircle2 className="w-12 h-12" />
        </motion.div>
        <h2 className="text-3xl font-serif font-bold text-wine-black">Registration Successful!</h2>
        <p className="text-wine-black/40 max-w-xs mx-auto">
          Welcome to the Savvy Circle. Your payment has been verified and your registration is complete.
        </p>
        <div className="pt-8">
          <div className="flex items-center gap-2 text-wine-red font-bold text-sm">
            <div className="w-4 h-4 border-2 border-wine-red border-t-transparent rounded-full animate-spin" />
            Redirecting to home...
          </div>
        </div>
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500 px-6 pt-6 pb-12">
        <header className="flex items-center gap-4">
          <button 
            onClick={() => setStep(1)}
            className="p-2 rounded-full hover:bg-wine-red/5 transition-colors"
          >
            <ArrowLeft className="w-6 h-6 text-wine-black" />
          </button>
          <h1 className="text-2xl font-serif font-bold text-wine-black">Payment & Verification</h1>
        </header>

        <div className="space-y-6">
          <div className="bg-wine-black rounded-3xl p-4 text-white relative overflow-hidden shadow-xl flex flex-col items-center">
            <div className="relative z-10 w-full text-center mb-4">
              <ShieldCheck className="w-8 h-8 text-wine-gold mx-auto mb-2" />
              <h2 className="text-xl font-serif font-bold">Scan to Pay</h2>
              <p className="text-white/60 text-[10px] uppercase tracking-widest font-bold">Lipa kwa kuscan</p>
            </div>
            
            <div className="bg-white p-4 rounded-2xl mb-4 w-full max-w-[240px]">
              <img 
                src="https://storage.googleapis.com/m-infra.appspot.com/public/res/izopybvlcxrpdcivpl4aj5/qr_code_payment.png" 
                alt="Payment QR Code" 
                className="w-full h-auto rounded-lg"
                referrerPolicy="no-referrer"
              />
            </div>

            <div className="text-center space-y-1">
              <p className="text-wine-gold font-mono font-bold text-lg tracking-wider">15086600</p>
              <p className="text-white/40 text-[10px] font-bold uppercase">Kite General Collection</p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h3 className="text-sm font-bold text-wine-black">Enter Verification Code</h3>
              <p className="text-xs text-wine-black/40">Enter the 4-digit code received after payment</p>
            </div>

            <form onSubmit={handleVerificationSubmit} className="space-y-8">
              <div className="flex justify-center gap-4">
                {verificationCode.map((digit, i) => (
                  <input
                    key={i}
                    id={`code-${i}`}
                    type="number"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleCodeChange(i, e.target.value)}
                    className="w-14 h-16 bg-white border border-wine-black/10 rounded-2xl text-center text-2xl font-bold text-wine-black focus:outline-none focus:ring-2 focus:ring-wine-red/20 focus:border-wine-red transition-all shadow-sm"
                    required
                  />
                ))}
              </div>

              <button
                type="submit"
                className="w-full bg-wine-red text-white py-4 rounded-2xl font-bold text-sm shadow-lg shadow-wine-red/20 hover:bg-wine-red/90 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                Verify & Complete
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 px-6 pt-6 pb-12">
      <header className="flex items-center gap-4">
        <button 
          onClick={() => navigate(-1)}
          className="p-2 rounded-full hover:bg-wine-red/5 transition-colors"
        >
          <ArrowLeft className="w-6 h-6 text-wine-black" />
        </button>
        <h1 className="text-2xl font-serif font-bold text-wine-black">Event Registration</h1>
      </header>

      <div className="space-y-6">
        <div className="bg-wine-black rounded-3xl p-6 text-white relative overflow-hidden shadow-xl">
          <div className="relative z-10">
            <p className="text-wine-gold text-[10px] uppercase tracking-widest font-bold mb-1">Exclusive Access</p>
            <h2 className="text-xl font-serif font-bold mb-2">Join the Savvy Circle</h2>
            <p className="text-white/60 text-xs">Complete your registration to unlock premium tastings and member-only events.</p>
          </div>
          <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-wine-red/10 rounded-full blur-2xl" />
        </div>

        <form onSubmit={handleInitialSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-wine-black/40 ml-1">Full Name</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-wine-black/20" />
                <input
                  type="text"
                  placeholder="John Doe"
                  className="w-full bg-white border border-wine-black/5 rounded-2xl py-4 pl-12 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-wine-red/20 transition-all shadow-sm"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-wine-black/40 ml-1">Phone Number</label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-wine-black/20" />
                <input
                  type="tel"
                  placeholder="+1 (555) 000-0000"
                  className="w-full bg-white border border-wine-black/5 rounded-2xl py-4 pl-12 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-wine-red/20 transition-all shadow-sm"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  required
                />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-bold uppercase tracking-widest text-wine-black/40 ml-1">Payment Method</label>
            <div className="grid grid-cols-1 gap-3">
              {[
                { id: 'phone', label: 'Pay by Phone', icon: <Phone className="w-5 h-5" /> },
                { id: 'card', label: 'Credit / Debit Card', icon: <CreditCard className="w-5 h-5" /> },
                { id: 'apple', label: 'Apple Pay', icon: <Smartphone className="w-5 h-5" /> },
              ].map((method) => (
                <button
                  key={method.id}
                  type="button"
                  onClick={() => setFormData({ ...formData, paymentMethod: method.id })}
                  className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                    formData.paymentMethod === method.id
                      ? 'border-wine-red bg-wine-red/5 shadow-sm'
                      : 'border-wine-black/5 bg-white hover:bg-wine-cream'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`${formData.paymentMethod === method.id ? 'text-wine-red' : 'text-wine-black/40'}`}>
                      {method.icon}
                    </div>
                    <span className="text-sm font-bold text-wine-black">{method.label}</span>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    formData.paymentMethod === method.id
                      ? 'border-wine-red bg-wine-red'
                      : 'border-wine-black/10'
                  }`}>
                    {formData.paymentMethod === method.id && <div className="w-2 h-2 bg-white rounded-full" />}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-wine-red text-white py-4 rounded-2xl font-bold text-sm shadow-lg shadow-wine-red/20 hover:bg-wine-red/90 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            Proceed to Payment
          </button>
        </form>
      </div>
    </div>
  );
}
