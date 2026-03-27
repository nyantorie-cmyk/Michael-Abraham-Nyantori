import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShoppingCart, Plus, Minus, X, ShoppingBag, Search, Filter, ChevronRight, Phone, Loader2, CheckCircle2, Truck, Package, MapPin, Star, Check } from 'lucide-react';
import { Product, CartItem, OrderStatus } from '../types';
import { GoogleGenAI } from "@google/genai";
import { db, handleFirestoreError, OperationType, sanitizeData, generateNumericOrderId } from '../firebase';
import { collection, onSnapshot, query, orderBy, addDoc, serverTimestamp, setDoc, doc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';

export default function Shop() {
  const { user } = useAuth();
  const [dynamicProducts, setDynamicProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});

  useEffect(() => {
    const productsRef = collection(db, 'products');
    const q = query(productsRef, orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedProducts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Product[];
      setDynamicProducts(fetchedProducts);
      setLoading(false);
    }, (error) => {
      setLoading(false);
      handleFirestoreError(error, OperationType.GET, 'products');
    });
    return () => unsubscribe();
  }, []);

  const allProducts = useMemo(() => {
    // Remove duplicates by ID if any
    const unique = dynamicProducts.filter((v, i, a) => a.findIndex(t => (t.id === v.id)) === i);
    return unique;
  }, [dynamicProducts]);
  
  // Payment & Tracking State
  const [paymentStep, setPaymentStep] = useState<'cart' | 'phone' | 'pushing' | 'success' | 'tracking' | 'track-input'>('cart');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [orderId, setOrderId] = useState('');
  const [trackingInput, setTrackingInput] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [discount, setDiscount] = useState(0);
  const [couponError, setCouponError] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [addressLink, setAddressLink] = useState('');
  const [isLocating, setIsLocating] = useState(false);
  const [showAddSuccess, setShowAddSuccess] = useState<string | null>(null);
  const [trackedOrder, setTrackedOrder] = useState<any>(null);
  const [isFetchingOrder, setIsFetchingOrder] = useState(false);

  useEffect(() => {
    if (paymentStep === 'tracking' && orderId) {
      const fetchOrder = async () => {
        setIsFetchingOrder(true);
        try {
          const { doc, getDoc } = await import('firebase/firestore');
          const orderRef = doc(db, 'orders', orderId);
          const orderSnap = await getDoc(orderRef);
          if (orderSnap.exists()) {
            setTrackedOrder(orderSnap.data());
          }
        } catch (error) {
          console.error("Error fetching order:", error);
        } finally {
          setIsFetchingOrder(false);
        }
      };
      fetchOrder();
    } else if (paymentStep !== 'tracking') {
      setTrackedOrder(null);
    }
  }, [paymentStep, orderId]);

  const addToCart = (product: Product) => {
    const option = selectedOptions[product.id];
    if (product.options && !option) {
      alert('Please select an option (Sweet or Dry)');
      return;
    }

    setCart(prev => {
      const cartItemId = option ? `${product.id}-${option}` : product.id;
      const existing = prev.find(item => 
        (item.options ? `${item.id}-${item.selectedOption}` : item.id) === cartItemId
      );
      
      if (existing) {
        return prev.map(item => 
          (item.options ? `${item.id}-${item.selectedOption}` : item.id) === cartItemId 
            ? { ...item, quantity: item.quantity + 1 } 
            : item
        );
      }
      return [...prev, { ...product, quantity: 1, selectedOption: option }];
    });

    setShowAddSuccess(product.id);
    setTimeout(() => setShowAddSuccess(null), 2000);
  };

  const removeFromCart = (cartItemId: string) => {
    setCart(prev => prev.filter(item => {
      const id = item.selectedOption ? `${item.id}-${item.selectedOption}` : item.id;
      return id !== cartItemId;
    }));
  };

  const updateQuantity = (cartItemId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      const id = item.selectedOption ? `${item.id}-${item.selectedOption}` : item.id;
      if (id === cartItemId) {
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const handleCheckout = () => {
    if (!user) {
      alert('Please log in to complete your purchase.');
      return;
    }
    setPaymentStep('phone');
  };

  const applyCoupon = () => {
    setCouponError('');
    const code = couponCode.toUpperCase().trim();
    if (code === 'SAVVY10') {
      setDiscount(0.1); // 10% discount
    } else if (code === 'SAVVY20') {
      setDiscount(0.2); // 20% discount
    } else if (code === 'SAVVY50') {
      setDiscount(0.5); // 50% discount
    } else {
      setCouponError('Invalid coupon code');
      setDiscount(0);
    }
  };

  const handleUseLocation = async () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(async (position) => {
      try {
        const { latitude, longitude } = position.coords;
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: `What is the formatted address for coordinates ${latitude}, ${longitude}? Please provide a concise address.`,
          config: {
            tools: [{ googleMaps: {} }],
            toolConfig: {
              retrievalConfig: {
                latLng: { latitude, longitude }
              }
            }
          },
        });

        const address = response.text || "Location found";
        const mapsLink = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.find(chunk => chunk.maps?.uri)?.maps?.uri;

        setDeliveryAddress(address);
        if (mapsLink) setAddressLink(mapsLink);
      } catch (error) {
        console.error("Error fetching address:", error);
        alert("Failed to get address from location.");
      } finally {
        setIsLocating(false);
      }
    }, (error) => {
      console.error("Geolocation error:", error);
      alert("Unable to retrieve your location.");
      setIsLocating(false);
    });
  };

  const handleTrackOrder = () => {
    if (!trackingInput) {
      alert('Please enter a tracking ID');
      return;
    }
    setOrderId(trackingInput);
    setPaymentStep('tracking');
  };
  const initiateUssdPush = async () => {
    if (!user) {
      alert('Please log in to complete your purchase.');
      return;
    }
    if (!phoneNumber || phoneNumber.length < 10) {
      alert('Please enter a valid phone number');
      return;
    }
    if (!deliveryAddress) {
      alert('Please enter a delivery address');
      return;
    }
    setPaymentStep('pushing');
    
    try {
      const simpleId = generateNumericOrderId();
      
      // Create the order in Firestore first
      const orderData = sanitizeData({
        id: simpleId, // Store the simple ID in the document too
        userId: user.uid,
        userName: user.displayName || 'Anonymous',
        userEmail: user.email || 'anonymous@example.com',
        items: cart,
        total: Number(finalTotal.toFixed(2)),
        status: 'pending' as OrderStatus,
        createdAt: serverTimestamp(),
        shippingAddress: deliveryAddress,
        phone: phoneNumber
      });

      // Use setDoc to use our simple numeric ID as the document ID
      await setDoc(doc(db, 'orders', simpleId), orderData);
      setOrderId(simpleId);

      // Call the USSD Push API
      const response = await fetch('/api/payment/ussd', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phoneNumber,
          amount: Number(finalTotal.toFixed(2)),
          orderId: simpleId
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to initiate USSD push');
      }

      const result = await response.json();
      
      if (result.status === 'success') {
        setPaymentStep('success');
        setCart([]); // Clear cart after success
      } else {
        throw new Error(result.message || 'Payment failed');
      }
    } catch (error) {
      console.error("Error creating order:", error);
      setPaymentStep('cart');
      alert(error instanceof Error ? error.message : "Failed to process order. Please try again.");
      handleFirestoreError(error, OperationType.WRITE, 'orders');
    }
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const discountAmount = cartTotal * discount;
  const finalTotal = cartTotal - discountAmount;
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Shop Header */}
      <section className="px-6 pt-6 space-y-4">
        <div className="flex justify-between items-center">
          <div className="space-y-1">
            <h2 className="text-3xl font-serif font-bold text-wine-black">The Cellar</h2>
            <p className="text-wine-black/40 text-sm">Exclusive collections for members</p>
          </div>
          <button 
            onClick={() => {
              setIsCartOpen(true);
              if (paymentStep === 'success' || paymentStep === 'tracking') {
                // Reset if they reopen after success
                setPaymentStep('cart');
              }
            }}
            className="relative p-3 bg-wine-red text-white rounded-2xl shadow-lg shadow-wine-red/20 active:scale-95 transition-all"
          >
            <ShoppingBag className="w-6 h-6" />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-wine-gold text-wine-black text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-wine-cream">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </section>

      {/* Product Grid */}
      <section className="px-6 grid grid-cols-1 gap-6">
        {loading && dynamicProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-wine-red" />
            <p className="text-wine-black/40 text-sm font-bold uppercase tracking-widest">Loading Cellar...</p>
          </div>
        ) : allProducts.map((product, i) => (
          <motion.div
            key={product.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white rounded-[2.5rem] overflow-hidden border border-wine-black/5 shadow-sm group"
          >
            <div className="relative h-64 overflow-hidden">
              <img 
                src={product.image} 
                alt={product.name} 
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                referrerPolicy="no-referrer"
              />
              <div className="absolute top-4 right-4">
                <span className="px-3 py-1 bg-white/90 backdrop-blur-md rounded-full text-[10px] font-bold text-wine-black uppercase tracking-widest">
                  {product.category}
                </span>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <h3 className="text-xl font-serif font-bold text-wine-black">{product.name}</h3>
                  <p className="text-xs text-wine-black/40 leading-relaxed">
                    {product.description}
                  </p>
                  {product.rating && (
                    <div className="flex items-center gap-1 pt-1">
                      <div className="flex items-center">
                        {[...Array(5)].map((_, index) => (
                          <Star
                            key={index}
                            className={`w-3 h-3 ${
                              index < Math.floor(product.rating || 0)
                                ? 'text-wine-gold fill-wine-gold'
                                : 'text-wine-black/10'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-[10px] font-bold text-wine-black">{product.rating}</span>
                      <span className="text-[10px] text-wine-black/30">({product.reviews} reviews)</span>
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-wine-red">{product.price.toLocaleString()}</p>
                  <p className="text-[10px] text-wine-black/30 font-bold uppercase">Per Bottle</p>
                </div>
              </div>

              {product.options && (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-wine-black/40 uppercase tracking-widest">Select Type</p>
                  <div className="flex gap-2">
                    {product.options.map(opt => (
                      <button
                        key={opt}
                        onClick={() => setSelectedOptions(prev => ({ ...prev, [product.id]: opt }))}
                        className={`px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all ${
                          selectedOptions[product.id] === opt
                            ? 'bg-wine-black text-white'
                            : 'bg-wine-black/5 text-wine-black/60 hover:bg-wine-black/10'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${product.stock < 5 ? 'bg-orange-500 animate-pulse' : 'bg-emerald-500'}`} />
                  <span className="text-[10px] font-bold text-wine-black/40 uppercase tracking-widest">
                    {product.stock < 5 ? `Only ${product.stock} left` : 'In Stock'}
                  </span>
                </div>
                <button 
                  onClick={() => addToCart(product)}
                  className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-xs font-bold transition-all active:scale-95 ${
                    showAddSuccess === product.id 
                      ? 'bg-emerald-500 text-white' 
                      : 'bg-wine-black text-white hover:bg-wine-red'
                  }`}
                >
                  {showAddSuccess === product.id ? (
                    <>
                      <Check className="w-4 h-4" /> Added!
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" /> Add to Cart
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </section>

      {/* Cart Drawer */}
      <AnimatePresence>
        {isCartOpen && (
          <div className="fixed inset-0 z-[100] flex justify-end">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCartOpen(false)}
              className="absolute inset-0 bg-wine-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative w-full max-w-sm bg-wine-cream h-full shadow-2xl flex flex-col"
            >
              <div className="p-6 flex justify-between items-center border-bottom border-wine-black/5">
                <div className="flex items-center gap-3">
                  <ShoppingBag className="w-6 h-6 text-wine-red" />
                  <h3 className="text-xl font-serif font-bold">
                    {paymentStep === 'tracking' ? 'Order Status' : 'Your Cart'}
                  </h3>
                </div>
                <button 
                  onClick={() => setIsCartOpen(false)}
                  className="p-2 hover:bg-wine-black/5 rounded-full transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {paymentStep === 'cart' && (
                  <>
                    <div className="flex justify-center mb-4">
                      <button 
                        onClick={() => setPaymentStep('track-input')}
                        className="text-[10px] font-bold text-wine-red uppercase tracking-widest border border-wine-red/20 px-4 py-2 rounded-full hover:bg-wine-red/5 transition-all flex items-center gap-2"
                      >
                        <Search className="w-3 h-3" /> Track Existing Order
                      </button>
                    </div>
                    {cart.length === 0 ? (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="h-full flex flex-col items-center justify-center text-center space-y-4"
                      >
                        <div className="w-20 h-20 bg-wine-black/5 rounded-full flex items-center justify-center text-wine-black/20">
                          <ShoppingBag className="w-10 h-10" />
                        </div>
                        <div>
                          <p className="font-bold text-wine-black">Your cart is empty</p>
                          <p className="text-xs text-wine-black/40">Explore our cellar to find something special.</p>
                        </div>
                        <button 
                          onClick={() => setIsCartOpen(false)}
                          className="text-wine-red text-sm font-bold hover:underline"
                        >
                          Start Shopping
                        </button>
                      </motion.div>
                    ) : (
                      <div className="space-y-4">
                        <AnimatePresence initial={false}>
                          {cart.map(item => {
                            const cartItemId = item.selectedOption ? `${item.id}-${item.selectedOption}` : item.id;
                            return (
                              <motion.div 
                                layout
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20, scale: 0.95 }}
                                key={cartItemId} 
                                className="flex gap-4 bg-white p-4 rounded-3xl border border-wine-black/5 shadow-sm group relative overflow-hidden"
                              >
                                <div className="relative">
                                  <img 
                                    src={item.image} 
                                    alt={item.name} 
                                    className="w-20 h-20 rounded-2xl object-cover"
                                    referrerPolicy="no-referrer"
                                  />
                                </div>
                                <div className="flex-1 space-y-2">
                                  <div className="flex justify-between items-start">
                                    <div className="space-y-1">
                                      <h4 className="text-sm font-bold text-wine-black line-clamp-1">{item.name}</h4>
                                      <div className="flex flex-wrap gap-2">
                                        <p className="text-xs font-bold text-wine-red">{item.price.toLocaleString()}</p>
                                        {item.selectedOption && (
                                          <span className="text-[9px] px-2 py-0.5 bg-wine-red/10 text-wine-red rounded-full font-bold uppercase tracking-wider border border-wine-red/20">
                                            {item.selectedOption}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <button 
                                      onClick={() => removeFromCart(cartItemId)}
                                      className="p-2 bg-wine-black/5 text-wine-black/20 hover:text-white hover:bg-wine-red rounded-xl transition-all active:scale-90 flex items-center justify-center"
                                      title="Remove from cart"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                  <div className="flex items-center justify-between pt-1">
                                    <div className="flex items-center gap-3 bg-wine-cream rounded-xl px-2 py-1">
                                      <button 
                                        onClick={() => updateQuantity(cartItemId, -1)}
                                        className="p-1 hover:text-wine-red transition-colors"
                                      >
                                        <Minus className="w-3 h-3" />
                                      </button>
                                      <div className="w-6 flex justify-center overflow-hidden">
                                        <AnimatePresence mode="popLayout">
                                          <motion.span
                                            key={item.quantity}
                                            initial={{ y: 10, opacity: 0 }}
                                            animate={{ y: 0, opacity: 1 }}
                                            exit={{ y: -10, opacity: 0 }}
                                            className="text-xs font-bold text-center inline-block"
                                          >
                                            {item.quantity}
                                          </motion.span>
                                        </AnimatePresence>
                                      </div>
                                      <button 
                                        onClick={() => updateQuantity(cartItemId, 1)}
                                        className="p-1 hover:text-wine-red transition-colors"
                                      >
                                        <Plus className="w-3 h-3" />
                                      </button>
                                    </div>
                                    <motion.p 
                                      key={item.price * item.quantity}
                                      initial={{ opacity: 0.5 }}
                                      animate={{ opacity: 1 }}
                                      className="text-xs font-bold text-wine-black"
                                    >
                                      {(item.price * item.quantity).toLocaleString()}
                                    </motion.p>
                                  </div>
                                </div>
                              </motion.div>
                            );
                          })}
                        </AnimatePresence>
                      </div>
                    )}
                  </>
                )}

                {paymentStep === 'track-input' && (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6 py-8"
                  >
                    <div className="w-16 h-16 bg-wine-red/10 rounded-2xl flex items-center justify-center text-wine-red mx-auto">
                      <Search className="w-8 h-8" />
                    </div>
                    <div className="text-center space-y-2">
                      <h4 className="text-xl font-serif font-bold">Track Your Order</h4>
                      <p className="text-xs text-wine-black/40 px-8">Enter your tracking ID to see the status of your package.</p>
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-wine-black/40 uppercase tracking-widest ml-2">Tracking ID</label>
                        <input 
                          type="text"
                          placeholder="e.g. 1234"
                          value={trackingInput}
                          onChange={(e) => setTrackingInput(e.target.value)}
                          className="w-full bg-white border border-wine-black/5 rounded-2xl px-4 py-4 text-sm focus:ring-2 focus:ring-wine-red transition-all"
                        />
                      </div>
                      <button 
                        onClick={handleTrackOrder}
                        className="w-full bg-wine-black text-white py-4 rounded-2xl font-bold shadow-lg hover:bg-wine-red transition-all"
                      >
                        Track Package
                      </button>
                      <button 
                        onClick={() => setPaymentStep('cart')}
                        className="w-full text-wine-black/40 text-xs font-bold hover:text-wine-black transition-colors"
                      >
                        Back to Cart
                      </button>
                    </div>
                  </motion.div>
                )}

                {paymentStep === 'phone' && (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6 py-8"
                  >
                    <div className="w-16 h-16 bg-wine-red/10 rounded-2xl flex items-center justify-center text-wine-red mx-auto">
                      <Phone className="w-8 h-8" />
                    </div>
                    <div className="text-center space-y-2">
                      <h4 className="text-xl font-serif font-bold">USSD Push Payment</h4>
                      <p className="text-xs text-wine-black/40 px-8">Enter your mobile number to receive a payment prompt on your phone.</p>
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-wine-black/40 uppercase tracking-widest ml-2">Phone Number</label>
                        <input 
                          type="tel"
                          placeholder="e.g. 0700 000 000"
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                          className="w-full bg-white border border-wine-black/5 rounded-2xl px-4 py-4 text-sm focus:ring-2 focus:ring-wine-red transition-all"
                        />
                      </div>
                      <button 
                        onClick={initiateUssdPush}
                        className="w-full bg-wine-black text-white py-4 rounded-2xl font-bold shadow-lg hover:bg-wine-red transition-all"
                      >
                        Send Payment Prompt
                      </button>
                      <button 
                        onClick={() => setPaymentStep('cart')}
                        className="w-full text-wine-black/40 text-xs font-bold hover:text-wine-black transition-colors"
                      >
                        Back to Cart
                      </button>
                    </div>
                  </motion.div>
                )}

                {paymentStep === 'pushing' && (
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-6">
                    <div className="relative">
                      <div className="w-24 h-24 border-4 border-wine-red/20 border-t-wine-red rounded-full animate-spin" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Phone className="w-8 h-8 text-wine-red" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <h4 className="text-xl font-serif font-bold">Pushing USSD...</h4>
                      <p className="text-xs text-wine-black/40 px-8">Please check your phone and enter your PIN to complete the transaction.</p>
                    </div>
                  </div>
                )}

                {paymentStep === 'success' && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="h-full flex flex-col items-center justify-center text-center space-y-8"
                  >
                    <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600">
                      <CheckCircle2 className="w-12 h-12" />
                    </div>
                    <div className="space-y-2">
                      <h4 className="text-2xl font-serif font-bold text-wine-black">Payment Successful!</h4>
                      <p className="text-sm text-wine-black/60">Your order has been confirmed.</p>
                      <div className="bg-wine-black/5 px-4 py-2 rounded-xl inline-block mt-4">
                        <p className="text-[10px] font-bold text-wine-black/40 uppercase">Order ID</p>
                        <p className="text-sm font-mono font-bold text-wine-black">{orderId}</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setPaymentStep('tracking')}
                      className="w-full bg-wine-black text-white py-4 rounded-2xl font-bold shadow-lg hover:bg-wine-red transition-all flex items-center justify-center gap-2"
                    >
                      <Truck className="w-5 h-5" /> Track Your Order
                    </button>
                  </motion.div>
                )}

                {paymentStep === 'tracking' && (
                  <motion.div 
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="space-y-8 py-4"
                  >
                    <div className="bg-white p-6 rounded-[2rem] border border-wine-black/5 shadow-sm space-y-6">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-[10px] font-bold text-wine-black/40 uppercase">Status</p>
                          <p className="text-sm font-bold text-emerald-600">
                            {trackedOrder?.status || 'Order Processing'}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-bold text-wine-black/40 uppercase">Est. Delivery</p>
                          <p className="text-sm font-bold text-wine-black">
                            {trackedOrder?.estimatedDelivery || 'Today, 4:30 PM'}
                          </p>
                        </div>
                      </div>

                        {/* Tracking Timeline */}
                        <div className="space-y-6 relative">
                          <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-wine-black/5" />
                          
                          {/* Step 1: Confirmed */}
                          <div className={`flex gap-4 relative ${trackedOrder?.status === 'cancelled' ? 'opacity-30' : ''}`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white z-10 ${
                              ['pending', 'packed', 'on transit', 'delivered'].includes(trackedOrder?.status) 
                                ? 'bg-emerald-500' 
                                : 'bg-wine-black/10 text-wine-black'
                            }`}>
                              <CheckCircle2 className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="text-xs font-bold text-wine-black">Order Confirmed</p>
                              <p className="text-[10px] text-wine-black/40">
                                {trackedOrder?.status === 'pending' ? 'Processing' : 'Payment Received'}
                              </p>
                            </div>
                          </div>

                          {/* Step 2: Preparing */}
                          <div className={`flex gap-4 relative ${!['packed', 'on transit', 'delivered'].includes(trackedOrder?.status) ? 'opacity-30' : ''}`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white z-10 ${
                              ['packed', 'on transit', 'delivered'].includes(trackedOrder?.status)
                                ? (trackedOrder?.status === 'packed' ? 'bg-wine-red animate-pulse' : 'bg-emerald-500')
                                : 'bg-wine-black/10 text-wine-black'
                            }`}>
                              {['on transit', 'delivered'].includes(trackedOrder?.status) ? <CheckCircle2 className="w-4 h-4" /> : <Package className="w-4 h-4" />}
                            </div>
                            <div>
                              <p className="text-xs font-bold text-wine-black">Preparing Package</p>
                              <p className="text-[10px] text-wine-black/40">
                                {trackedOrder?.status === 'packed' ? 'In progress' : (['on transit', 'delivered'].includes(trackedOrder?.status) ? 'Completed' : 'Pending')}
                              </p>
                            </div>
                          </div>

                          {/* Step 3: Out for Delivery */}
                          <div className={`flex gap-4 relative ${!['on transit', 'delivered'].includes(trackedOrder?.status) ? 'opacity-30' : ''}`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white z-10 ${
                              ['on transit', 'delivered'].includes(trackedOrder?.status)
                                ? (trackedOrder?.status === 'on transit' ? 'bg-wine-red animate-pulse' : 'bg-emerald-500')
                                : 'bg-wine-black/10 text-wine-black'
                            }`}>
                              {trackedOrder?.status === 'delivered' ? <CheckCircle2 className="w-4 h-4" /> : <Truck className="w-4 h-4" />}
                            </div>
                            <div>
                              <p className="text-xs font-bold text-wine-black">Out for Delivery</p>
                              <p className="text-[10px] text-wine-black/40">
                                {trackedOrder?.status === 'on transit' ? 'In transit' : (trackedOrder?.status === 'delivered' ? 'Completed' : 'Pending')}
                              </p>
                            </div>
                          </div>

                          {/* Step 4: Delivered */}
                          <div className={`flex gap-4 relative ${trackedOrder?.status !== 'delivered' ? 'opacity-30' : ''}`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white z-10 ${
                              trackedOrder?.status === 'delivered' ? 'bg-emerald-500' : 'bg-wine-black/10 text-wine-black'
                            }`}>
                              <MapPin className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="text-xs font-bold text-wine-black">Delivered</p>
                              <p className="text-[10px] text-wine-black/40">
                                {trackedOrder?.status === 'delivered' ? 'Received' : 'Pending'}
                              </p>
                            </div>
                          </div>
                        </div>
                    </div>

                    <div className="bg-wine-red/5 p-6 rounded-[2rem] border border-wine-red/10">
                      <p className="text-xs font-bold text-wine-red mb-2">Delivery Address</p>
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-wine-black">
                          {trackedOrder?.userName || user?.displayName || 'Anonymous Member'}
                        </p>
                        <p className="text-xs text-wine-black/60 leading-relaxed whitespace-pre-wrap">
                          {trackedOrder?.shippingAddress || deliveryAddress || 'No address provided'}
                        </p>
                        <p className="text-xs font-medium text-wine-black/80">
                          {trackedOrder?.phone || phoneNumber}
                        </p>
                      </div>
                    </div>

                    <button 
                      onClick={() => setIsCartOpen(false)}
                      className="w-full bg-wine-black text-white py-4 rounded-2xl font-bold shadow-lg hover:bg-wine-red transition-all"
                    >
                      Done
                    </button>
                  </motion.div>
                )}
              </div>

              {cart.length > 0 && paymentStep === 'cart' && (
                <div className="p-6 bg-white border-t border-wine-black/5 space-y-6">
                  {/* Delivery Address Section */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <p className="text-[10px] font-bold text-wine-black/40 uppercase tracking-widest ml-1">Delivery Address</p>
                      <button 
                        onClick={handleUseLocation}
                        disabled={isLocating}
                        className="text-[10px] font-bold text-wine-red uppercase tracking-widest flex items-center gap-1 hover:underline disabled:opacity-50"
                      >
                        {isLocating ? <Loader2 className="w-3 h-3 animate-spin" /> : <MapPin className="w-3 h-3" />}
                        Use Current Location
                      </button>
                    </div>
                    <div className="space-y-2">
                      <textarea 
                        placeholder="Enter your delivery address..."
                        value={deliveryAddress}
                        onChange={(e) => setDeliveryAddress(e.target.value)}
                        rows={2}
                        className="w-full bg-wine-cream border border-wine-black/5 rounded-xl px-4 py-3 text-xs focus:outline-none focus:ring-2 focus:ring-wine-red/20 transition-all resize-none"
                      />
                      {addressLink && (
                        <a 
                          href={addressLink} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-[10px] text-wine-red font-bold flex items-center gap-1 hover:underline ml-1"
                        >
                          <MapPin className="w-3 h-3" /> View on Google Maps
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Coupon Code Section */}
                  <div className="space-y-3">
                    <p className="text-[10px] font-bold text-wine-black/40 uppercase tracking-widest ml-1">Coupon Code</p>
                    <div className="flex gap-2">
                      <input 
                        type="text"
                        placeholder="Enter code (e.g. SAVVY10)"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value)}
                        className="flex-1 bg-wine-cream border border-wine-black/5 rounded-xl px-4 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-wine-red/20 transition-all uppercase font-mono"
                      />
                      <button 
                        onClick={applyCoupon}
                        className="px-4 py-2 bg-wine-black text-white rounded-xl text-[10px] font-bold hover:bg-wine-red transition-all active:scale-95"
                      >
                        Apply
                      </button>
                    </div>
                    {couponError && <p className="text-[10px] text-wine-red font-bold ml-1">{couponError}</p>}
                    {discount > 0 && (
                      <p className="text-[10px] text-emerald-600 font-bold ml-1 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> {discount * 100}% discount applied!
                      </p>
                    )}
                  </div>

                  <div className="space-y-3 pt-2 border-t border-wine-black/5">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-wine-black/40 font-medium">Subtotal</span>
                      <motion.span 
                        key={cartTotal}
                        initial={{ opacity: 0.5, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="font-bold text-wine-black"
                      >
                        {cartTotal.toLocaleString()}
                      </motion.span>
                    </div>
                    {discount > 0 && (
                      <motion.div 
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex justify-between items-center text-sm"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-wine-black/40 font-medium">Discount</span>
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-bold uppercase tracking-wider">
                            {discount * 100}% OFF
                          </span>
                        </div>
                        <span className="text-emerald-500 font-bold">-{discountAmount.toLocaleString()}</span>
                      </motion.div>
                    )}
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-wine-black/40 font-medium">Shipping</span>
                      <span className="text-emerald-500 font-bold uppercase text-[10px] tracking-widest">Free</span>
                    </div>
                    <div className="flex justify-between items-center text-xl pt-4 mt-2 border-t border-wine-black/10">
                      <span className="font-serif font-bold text-wine-black">Total</span>
                      <motion.span 
                        key={finalTotal}
                        initial={{ scale: 1.1, color: '#991b1b' }}
                        animate={{ scale: 1, color: '#991b1b' }}
                        className="font-serif font-bold"
                      >
                        {finalTotal.toLocaleString()}
                      </motion.span>
                    </div>
                  </div>
                  <button 
                    onClick={handleCheckout}
                    className="w-full bg-wine-red text-white py-4 rounded-2xl font-bold shadow-lg shadow-wine-red/20 hover:bg-wine-red/90 transition-all flex items-center justify-center gap-2"
                  >
                    Checkout <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
