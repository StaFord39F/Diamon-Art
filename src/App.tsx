import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Upload, 
  Settings as SettingsIcon, 
  ShoppingBag, 
  CheckCircle, 
  Check,
  X, 
  ChevronRight, 
  Image as ImageIcon,
  CreditCard,
  Lock,
  LogOut,
  Plus,
  Minus,
  Star,
  ArrowRight,
  Truck,
  Package,
  Globe
} from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import confetti from 'canvas-confetti';
import Autocomplete from "react-google-autocomplete";
import { Settings, Order, Currency } from './types';

const SIZES = [
  { label: '30x30 см', step: 0 },
  { label: '40x40 см', step: 1 },
  { label: '50x50 см', step: 2 },
  { label: '60x60 см', step: 3 },
  { label: '70x70 см', step: 4 },
  { label: '80x80 см', step: 5 },
];

export default function App() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [selectedSize, setSelectedSize] = useState(SIZES[0]);
  const [currency, setCurrency] = useState<Currency>('NOK');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [isPaying, setIsPaying] = useState(false);
  const [isPremiumSelected, setIsPremiumSelected] = useState(false);
  const [isBuyingVipPass, setIsBuyingVipPass] = useState(false);
  const [vipCode, setVipCode] = useState('');
  const [isVipApplied, setIsVipApplied] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState<'Nova Poshta' | 'DHL' | 'DPD'>('Nova Poshta');
  const [deliveryZone, setDeliveryZone] = useState<'local' | 'regional' | 'international'>('local');
  const [orderStatus, setOrderStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [adminOrders, setAdminOrders] = useState<Order[]>([]);
  const [rates, setRates] = useState<Record<string, number>>({ NOK: 1, EUR: 0.087, USD: 0.094, UAH: 3.7 });
  const [ratesTimestamp, setRatesTimestamp] = useState<string | null>(null);
  const [ratesError, setRatesError] = useState<string | null>(null);

  // Fetch exchange rates
  useEffect(() => {
    fetch('https://open.er-api.com/v6/latest/NOK')
      .then(res => {
        if (!res.ok) throw new Error('API connection failed');
        return res.json();
      })
      .then(data => {
        if (data && data.rates) {
          setRates(data.rates);
          setRatesError(null);
          // Format the timestamp: 15.03.2026 12:00
          const date = new Date(data.time_last_update_utc || Date.now());
          const formattedDate = `${date.getDate().toString().padStart(2, '0')}.${(date.getMonth() + 1).toString().padStart(2, '0')}.${date.getFullYear()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
          setRatesTimestamp(formattedDate);
        }
      })
      .catch(err => {
        console.error('Failed to fetch rates:', err);
        setRatesError('Не вдалося завантажити актуальні курси. Використовуються резервні дані.');
        // Fallback timestamp
        const date = new Date();
        const formattedDate = `${date.getDate().toString().padStart(2, '0')}.${(date.getMonth() + 1).toString().padStart(2, '0')}.${date.getFullYear()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
        setRatesTimestamp(formattedDate);
      });
  }, []);

  // Fetch settings
  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => setSettings(data));
  }, []);

  // Fetch orders and full settings if admin
  useEffect(() => {
    if (adminToken) {
      fetch(`/api/admin/orders?token=${adminToken}`)
        .then(res => res.json())
        .then(data => setAdminOrders(data));
      
      fetch(`/api/admin/settings?token=${adminToken}`)
        .then(res => res.json())
        .then(data => setSettings(data));
    }
  }, [adminToken]);

  const onDropPhoto = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    setUploadedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  }, []);

  const onDropReceipt = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    setReceiptFile(file);
    setReceiptPreviewUrl(URL.createObjectURL(file));
  }, []);

  const photoDropzone = useDropzone({ 
    onDrop: onDropPhoto, 
    accept: { 'image/*': ['.jpeg', '.jpg', '.png'] },
    multiple: false 
  } as any);

  const receiptDropzone = useDropzone({ 
    onDrop: onDropReceipt, 
    accept: { 'image/*': ['.jpeg', '.jpg', '.png', '.pdf'] },
    multiple: false 
  } as any);

  const convert = (nokPrice: number) => {
    const rate = rates[currency] || 1;
    const converted = nokPrice * rate;
    // Round to 2 decimal places for non-NOK currencies for precision
    return currency === 'NOK' ? Math.round(converted).toString() : converted.toFixed(2);
  };

  const calculateNokPrice = (step: number) => {
    if (!settings) return 0;
    if (isBuyingVipPass) return 1500;
    
    const basePaintingPrice = settings.basePrice + (step * settings.stepPrice);
    const methodBasePrices = { 'Nova Poshta': 300, 'DHL': 500, 'DPD': 650 };
    const zoneModifiers = { local: 50, regional: 100, international: 300 };
    let deliveryCost = methodBasePrices[deliveryMethod] + zoneModifiers[deliveryZone];

    if (isVipApplied) return 0;

    if (isPremiumSelected) {
      const discountedPainting = Math.round(basePaintingPrice * 0.8);
      const discountedDelivery = Math.round(deliveryCost * 0.8);
      return discountedPainting + discountedDelivery + settings.premiumPrice;
    }

    const isPromoActive = (settings.orderCount || 0) < 15;
    if (isPromoActive) {
      return Math.round((basePaintingPrice + deliveryCost) * 0.9);
    }

    return basePaintingPrice + deliveryCost;
  };

  const calculatePrice = (step: number) => {
    const nokPrice = calculateNokPrice(step);
    return convert(nokPrice);
  };

  const getDeliveryCost = () => {
    if (isVipApplied || isBuyingVipPass) return 0;
    const methodBasePrices = { 'Nova Poshta': 300, 'DHL': 500, 'DPD': 650 };
    const zoneModifiers = { local: 50, regional: 100, international: 300 };
    let cost = methodBasePrices[deliveryMethod] + zoneModifiers[deliveryZone];
    
    if (isPremiumSelected) cost = Math.round(cost * 0.8);
    else if (isPromoActive) cost = Math.round(cost * 0.9);
    
    return convert(cost);
  };

  const getOriginalPrice = (step: number) => {
    if (!settings) return 0;
    const base = settings.basePrice + (step * settings.stepPrice);
    const methodBasePrices = { 'Nova Poshta': 300, 'DHL': 500, 'DPD': 650 };
    const zoneModifiers = { local: 50, regional: 100, international: 300 };
    const delivery = methodBasePrices[deliveryMethod] + zoneModifiers[deliveryZone];
    
    let nokPrice = base + delivery;
    if (isPremiumSelected) nokPrice += settings.premiumPrice;
    
    return convert(nokPrice);
  };

  const isPromoActive = settings ? (settings.orderCount || 0) < 15 : false;

  const handleOrder = async () => {
    if (!isBuyingVipPass && !uploadedFile) {
      alert('Будь ласка, завантажте фото!');
      return;
    }
    if (!customerName || !customerPhone || !customerAddress) {
      alert('Будь ласка, заповніть всі дані для відправки!');
      return;
    }

    if (isVipApplied) {
      // Skip payment modal for VIP
      confirmPayment(true);
    } else {
      setIsPaying(true);
    }
  };

  const confirmPayment = async (isVip: boolean = false) => {
    if (!isVip && !receiptFile) {
      alert('Будь ласка, завантажте чек про оплату!');
      return;
    }
    setOrderStatus('processing');
    
    // Simulate AI Bot checking the receipt
    if (!isVip) {
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    const formData = new FormData();
    if (uploadedFile) {
      formData.append('photo', uploadedFile!);
    }
    if (receiptFile) {
      formData.append('receipt', receiptFile!);
    }
    formData.append('size', isBuyingVipPass ? 'VIP PASS' : selectedSize.label);
    formData.append('price', calculatePrice(selectedSize.step).toString());
    formData.append('currency', currency);
    formData.append('paymentStatus', isVipApplied ? 'VIP' : 'PAID');
    formData.append('isPremium', isPremiumSelected.toString());
    formData.append('isVipPassPurchase', isBuyingVipPass.toString());
    formData.append('customerName', customerName);
    formData.append('customerPhone', customerPhone);
    formData.append('customerAddress', customerAddress);
    formData.append('deliveryMethod', deliveryMethod);
    formData.append('deliveryZone', deliveryZone);
    formData.append('deliveryCost', getDeliveryCost().toString());
    
    if (isVipApplied) {
      formData.append('vipPassword', vipCode);
    }

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setOrderStatus('success');
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 }
        });
      } else {
        setOrderStatus('error');
      }
    } catch (e) {
      setOrderStatus('error');
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: adminPassword }),
    });
    const data = await res.json();
    if (data.success) {
      setIsAdmin(true);
      setAdminToken(data.token);
      setShowAdminLogin(false);
    } else {
      alert('Невірний пароль');
    }
  };

  const updateAdminSettings = async (newSettings: Partial<Settings>) => {
    const res = await fetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: adminToken, ...newSettings }),
    });
    if (res.ok) {
      setSettings(prev => prev ? { ...prev, ...newSettings } : null);
      alert('Налаштування оновлено!');
    }
  };

  if (!settings) return <div className="flex items-center justify-center h-screen bg-stone-50">Завантаження...</div>;

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 font-sans selection:bg-emerald-100">
      {/* Promotion Banner */}
      {isPromoActive && (
        <div className="bg-emerald-600 text-white py-2 px-6 text-center text-sm font-bold tracking-wide">
          🔥 АКЦІЯ: -10% ДЛЯ ПЕРШИХ 15 ПОКУПЦІВ! (Залишилось місць: {15 - (settings?.orderCount || 0)})
        </div>
      )}

      {/* Navigation */}
      <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-stone-200 px-6 py-4 flex justify-between items-center">
        <div className="text-2xl font-black tracking-tighter text-emerald-600 uppercase">Світ краси</div>
        <div className="flex items-center gap-6">
          <button onClick={() => document.getElementById('about')?.scrollIntoView({ behavior: 'smooth' })} className="text-sm font-medium hover:text-emerald-600 transition-colors">Про нас</button>
          <button 
            onClick={() => isAdmin ? setIsAdmin(false) : setShowAdminLogin(true)} 
            className="p-2 hover:bg-stone-100 rounded-full transition-colors"
          >
            {isAdmin ? <LogOut size={20} /> : <SettingsIcon size={20} />}
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-12">
        {isAdmin ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-12"
          >
            <div className="flex justify-between items-end">
              <div>
                <h1 className="text-4xl font-bold tracking-tight">Панель адміністратора</h1>
                <p className="text-stone-500 mt-2">Керуйте цінами та замовленнями</p>
              </div>
              <button onClick={() => setIsAdmin(false)} className="text-sm font-medium text-emerald-600 hover:underline">Повернутися на сайт</button>
            </div>

            <div className="grid md:grid-rows-2 gap-8">
              <div className="bg-white p-8 rounded-3xl border border-stone-200 shadow-sm space-y-6">
                <h2 className="text-xl font-bold flex items-center gap-2"><SettingsIcon size={20} /> Налаштування цін</h2>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-stone-400">Базова ціна (30x30)</label>
                    <div className="flex items-center gap-4">
                      <input 
                        type="number" 
                        value={settings.basePrice} 
                        onChange={(e) => setSettings({ ...settings, basePrice: parseInt(e.target.value) })}
                        className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-stone-400">Крок ціни (за розмір)</label>
                    <input 
                      type="number" 
                      value={settings.stepPrice} 
                      onChange={(e) => setSettings({ ...settings, stepPrice: parseInt(e.target.value) })}
                      className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-stone-400">Ціна Преміум статусу</label>
                    <input 
                      type="number" 
                      value={settings.premiumPrice} 
                      onChange={(e) => setSettings({ ...settings, premiumPrice: parseInt(e.target.value) })}
                      className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-stone-400">Пароль VIP пропуску</label>
                    <input 
                      type="text" 
                      value={settings.vipPassword || ''} 
                      onChange={(e) => setSettings({ ...settings, vipPassword: e.target.value })}
                      className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-stone-400">SMTP Host</label>
                    <input 
                      type="text" 
                      value={settings.smtpHost || ''} 
                      onChange={(e) => setSettings({ ...settings, smtpHost: e.target.value })}
                      className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-stone-400">SMTP Port</label>
                    <input 
                      type="number" 
                      value={settings.smtpPort || 587} 
                      onChange={(e) => setSettings({ ...settings, smtpPort: parseInt(e.target.value) })}
                      className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-stone-400">SMTP User</label>
                    <input 
                      type="text" 
                      value={settings.smtpUser || ''} 
                      onChange={(e) => setSettings({ ...settings, smtpUser: e.target.value })}
                      className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-stone-400">SMTP Password</label>
                    <input 
                      type="password" 
                      value={settings.smtpPass || ''} 
                      onChange={(e) => setSettings({ ...settings, smtpPass: e.target.value })}
                      className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-stone-400">Текст "Про нас"</label>
                  <textarea 
                    value={settings.aboutUs} 
                    onChange={(e) => setSettings({ ...settings, aboutUs: e.target.value })}
                    rows={4}
                    className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                  />
                </div>
                <button 
                  onClick={() => updateAdminSettings(settings)}
                  className="w-full py-4 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200"
                >
                  Зберегти зміни
                </button>
              </div>

              <div className="bg-white p-8 rounded-3xl border border-stone-200 shadow-sm space-y-6">
                <h2 className="text-xl font-bold flex items-center gap-2"><ShoppingBag size={20} /> Останні замовлення</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-stone-100">
                        <th className="py-4 text-xs font-bold uppercase text-stone-400">ID</th>
                        <th className="py-4 text-xs font-bold uppercase text-stone-400">Клієнт</th>
                        <th className="py-4 text-xs font-bold uppercase text-stone-400">Розмір</th>
                        <th className="py-4 text-xs font-bold uppercase text-stone-400">Ціна</th>
                        <th className="py-4 text-xs font-bold uppercase text-stone-400">Дата</th>
                      </tr>
                    </thead>
                    <tbody>
                      {adminOrders.map(order => (
                        <tr key={order.id} className="border-b border-stone-50 hover:bg-stone-50 transition-colors">
                          <td className="py-4 font-mono text-sm">{order.id}</td>
                          <td className="py-4">
                            <div className="font-bold">{order.customerName}</div>
                            <div className="text-xs text-stone-500">{order.customerPhone}</div>
                            <div className="text-xs text-stone-400 max-w-[200px] truncate">{order.customerAddress}</div>
                          </td>
                          <td className="py-4">
                            {order.size}
                            <div className="flex gap-1 mt-1">
                              {order.isPremium && <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-full uppercase">PREMIUM</span>}
                              {order.isVip && <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-[10px] font-bold rounded-full uppercase">VIP</span>}
                              {order.isVipPassPurchase && <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded-full uppercase">VIP PASS PURCHASE</span>}
                            </div>
                          </td>
                          <td className="py-4 font-bold">{order.price} {order.currency}</td>
                          <td className="py-4 text-sm text-stone-500">{new Date(order.timestamp).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <div className="space-y-24">
            {/* Hero Section */}
            <section className="grid lg:grid-cols-2 gap-16 items-center">
              <div className="space-y-8">
                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold uppercase tracking-wider"
                >
                  <ImageIcon size={14} /> Створіть свій шедевр
                </motion.div>
                <motion.h1 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="text-6xl lg:text-8xl font-black tracking-tight leading-[0.9]"
                >
                  АЛМАЗНІ КАРТИНИ <span className="text-emerald-600">ПО ФОТО</span>
                </motion.h1>
                <motion.p 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-xl text-stone-500 max-w-md"
                >
                  Завантажте своє улюблене фото, і ми перетворимо його на набір для алмазної мозаїки преміум якості.
                </motion.p>
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="flex gap-4"
                >
                  <button 
                    onClick={() => document.getElementById('order-form')?.scrollIntoView({ behavior: 'smooth' })}
                    className="px-8 py-4 bg-emerald-600 text-white font-bold rounded-2xl hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-200 flex items-center gap-2"
                  >
                    Замовити зараз <ChevronRight size={20} />
                  </button>
                </motion.div>
              </div>

              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 }}
                className="relative aspect-square rounded-[3rem] overflow-hidden shadow-2xl rotate-3"
              >
                <img 
                  src="https://picsum.photos/seed/diamond/1000/1000" 
                  alt="Diamond Art Example" 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-12">
                  <div className="text-white">
                    <p className="text-sm font-bold uppercase tracking-widest opacity-70">Приклад роботи</p>
                    <p className="text-3xl font-bold">Ваші спогади у кристалах</p>
                  </div>
                </div>
              </motion.div>
            </section>

            {/* Order Form */}
            <section id="order-form" className="bg-white rounded-[3rem] border border-stone-200 shadow-sm overflow-hidden grid lg:grid-cols-2">
              <div className="p-12 space-y-10">
                <div className="space-y-2">
                  <h2 className="text-3xl font-bold tracking-tight">Налаштуйте замовлення</h2>
                  <p className="text-stone-500">Виберіть розмір та завантажте зображення</p>
                </div>

                <div className="space-y-6">
                  {/* VIP Pass Purchase Card */}
                  <div 
                    onClick={() => {
                      setIsBuyingVipPass(!isBuyingVipPass);
                      if (!isBuyingVipPass) setIsVipApplied(false);
                    }}
                    className={`p-6 rounded-3xl border-2 transition-all cursor-pointer relative overflow-hidden group ${
                      isBuyingVipPass 
                        ? 'border-purple-500 bg-purple-50 shadow-lg' 
                        : 'border-stone-100 bg-stone-50 hover:border-purple-200'
                    }`}
                  >
                    <div className="absolute top-0 right-0 p-4">
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${isBuyingVipPass ? 'bg-purple-500 border-purple-500' : 'border-stone-300'}`}>
                        {isBuyingVipPass && <Check size={14} className="text-white" />}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center">
                        <Star size={24} />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg">VIP Пропуск</h3>
                        <p className="text-sm text-stone-500">{convert(1500)} {currency} • 1 картина безкоштовно</p>
                      </div>
                    </div>
                    {isBuyingVipPass && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-4 pt-4 border-t border-purple-200 text-xs text-purple-700 font-medium"
                      >
                        ✨ Після покупки ви отримаєте VIP статус та зможете замовити будь-яку картину безкоштовно!
                      </motion.div>
                    )}
                  </div>

                  {!isBuyingVipPass && (
                    <div className="space-y-3">
                      <label className="text-xs font-bold uppercase tracking-wider text-stone-400">1. Виберіть розмір</label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {SIZES.map(size => (
                          <button
                            key={size.label}
                            onClick={() => setSelectedSize(size)}
                            className={`p-4 rounded-2xl border-2 transition-all text-sm font-bold ${
                              selectedSize.label === size.label 
                              ? 'border-emerald-600 bg-emerald-50 text-emerald-700' 
                              : 'border-stone-100 hover:border-stone-200'
                            }`}
                          >
                            {size.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-3">
                    <div className="flex justify-between items-end">
                      <label className="text-xs font-bold uppercase tracking-wider text-stone-400">2. Валюта</label>
                      {settings && (
                        <span className="text-[10px] font-bold text-stone-400 uppercase tracking-tight">
                          Базова ціна: {isBuyingVipPass ? 1500 : settings.basePrice} NOK
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {(['NOK', 'EUR', 'USD', 'UAH'] as Currency[]).map(curr => (
                        <button
                          key={curr}
                          onClick={() => setCurrency(curr)}
                          className={`min-w-[100px] px-6 py-4 rounded-2xl border-2 transition-all text-base font-bold ${
                            currency === curr 
                            ? 'border-stone-900 bg-stone-900 text-white shadow-lg' 
                            : 'border-stone-100 bg-white text-stone-900 hover:border-stone-200'
                          }`}
                        >
                          {curr}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-xs font-bold uppercase tracking-wider text-stone-400">3. Статус замовлення</label>
                    <button
                      onClick={() => setIsPremiumSelected(!isPremiumSelected)}
                      className={`w-full p-6 rounded-3xl border-2 transition-all flex items-center justify-between group ${
                        isPremiumSelected 
                        ? 'border-amber-500 bg-amber-50' 
                        : 'border-stone-100 hover:border-stone-200'
                      }`}
                    >
                      <div className="flex items-center gap-4 text-left">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${isPremiumSelected ? 'bg-amber-500 text-white' : 'bg-stone-100 text-stone-400'}`}>
                          <CreditCard size={24} />
                        </div>
                        <div>
                          <p className={`font-bold ${isPremiumSelected ? 'text-amber-900' : 'text-stone-900'}`}>Преміум Статус</p>
                          <p className="text-xs text-stone-500">Знижка 20% на перші 5 картин</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-lg font-black ${isPremiumSelected ? 'text-amber-600' : 'text-stone-400'}`}>+{convert(settings.premiumPrice)} {currency}</p>
                        <p className="text-[10px] uppercase font-bold tracking-widest opacity-50">Одноразово</p>
                      </div>
                    </button>
                  </div>

                  <div className="space-y-3">
                    <label className="text-xs font-bold uppercase tracking-wider text-stone-400">4. VIP Пропуск (Безкоштовно)</label>
                    <div className="flex gap-2">
                      <input 
                        type="text"
                        placeholder="Введіть VIP пароль"
                        value={vipCode}
                        onChange={(e) => setVipCode(e.target.value)}
                        className="flex-1 p-4 bg-stone-50 border border-stone-200 rounded-2xl focus:ring-2 focus:ring-purple-500 outline-none font-mono"
                      />
                      <button 
                        onClick={() => {
                          if (vipCode === '200712') {
                            setIsVipApplied(true);
                            alert('VIP доступ активовано! Ваше замовлення безкоштовне.');
                          } else {
                            alert('Невірний VIP пароль');
                          }
                        }}
                        className="px-6 bg-purple-600 text-white font-bold rounded-2xl hover:bg-purple-700 transition-colors"
                      >
                        ОК
                      </button>
                    </div>
                    {isVipApplied && (
                      <p className="text-xs text-purple-600 font-bold flex items-center gap-1">
                        <Check size={14} /> VIP статус активовано: 1 картина безкоштовно
                      </p>
                    )}
                  </div>

                  <div className="space-y-3">
                    <label className="text-xs font-bold uppercase tracking-wider text-stone-400">{isBuyingVipPass ? '3. Дані для відправки' : '5. Дані для відправки'}</label>
                    <div className="space-y-4">
                      <input 
                        type="text"
                        placeholder="ПІБ отримувача"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        className="w-full p-4 bg-stone-50 border border-stone-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                      <input 
                        type="tel"
                        placeholder="Номер телефону"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        className="w-full p-4 bg-stone-50 border border-stone-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                      <Autocomplete
                        apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}
                        onPlaceSelected={(place) => {
                          setCustomerAddress(place.formatted_address || '');
                        }}
                        options={{
                          types: ["address"],
                        }}
                        defaultValue={customerAddress}
                        placeholder="Введіть точну адресу (Пошук Google Maps)"
                        className="w-full p-4 bg-stone-50 border border-stone-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none"
                        onChange={(e: any) => setCustomerAddress(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-xs font-bold uppercase tracking-wider text-stone-400">{isBuyingVipPass ? '4. Спосіб доставки' : '6. Спосіб доставки'}</label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {[
                        { id: 'Nova Poshta', label: 'Нова Пошта', icon: Package, price: 300 },
                        { id: 'DHL', label: 'DHL Courier', icon: Truck, price: 500 },
                        { id: 'DPD', label: 'DPD Courier', icon: Truck, price: 650 },
                      ].map((method) => (
                        <button
                          key={method.id}
                          onClick={() => setDeliveryMethod(method.id as any)}
                          className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${
                            deliveryMethod === method.id 
                            ? 'border-emerald-600 bg-emerald-50 text-emerald-700' 
                            : 'border-stone-100 hover:border-stone-200 text-stone-600'
                          }`}
                        >
                          <method.icon size={20} />
                          <div className="text-center">
                            <span className="text-xs font-bold block">{method.label}</span>
                            <span className="text-[10px] opacity-60">{convert(method.price)} {currency}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {!isBuyingVipPass && (
                    <div className="space-y-3">
                      <label className="text-xs font-bold uppercase tracking-wider text-stone-400">7. Відстань (Додатковий збір)</label>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {[
                          { id: 'local', label: 'По місту', desc: `+${convert(50)} ${currency}` },
                          { id: 'regional', label: 'По країні', desc: `+${convert(100)} ${currency}` },
                          { id: 'international', label: 'За кордон', desc: `+${convert(300)} ${currency}` },
                        ].map((zone) => (
                          <button
                            key={zone.id}
                            onClick={() => setDeliveryZone(zone.id as any)}
                            className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center text-center gap-1 ${
                              deliveryZone === zone.id 
                              ? 'border-emerald-600 bg-emerald-50 text-emerald-700' 
                              : 'border-stone-100 hover:border-stone-200 text-stone-600'
                            }`}
                          >
                            <span className="text-xs font-bold">{zone.label}</span>
                            <span className="text-[10px] opacity-60">{zone.desc}</span>
                          </button>
                        ))}
                      </div>
                      <p className="text-[10px] text-stone-400 italic">
                        * Преміум статус дає -20% на доставку. VIP пропуск — безкоштовно.
                      </p>
                    </div>
                  )}

                  {!isBuyingVipPass && (
                    <div className="space-y-3">
                      <label className="text-xs font-bold uppercase tracking-wider text-stone-400">8. Завантажте фото для картини</label>
                      <div 
                        {...photoDropzone.getRootProps()} 
                        className={`border-2 border-dashed rounded-3xl p-8 transition-all flex flex-col items-center justify-center gap-4 cursor-pointer ${
                          photoDropzone.isDragActive ? 'border-emerald-500 bg-emerald-50' : 'border-stone-200 hover:border-stone-300'
                        }`}
                      >
                        <input {...photoDropzone.getInputProps()} />
                        {previewUrl ? (
                          <div className="relative w-full aspect-video rounded-xl overflow-hidden">
                            <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                            <button 
                              onClick={(e) => { e.stopPropagation(); setUploadedFile(null); setPreviewUrl(null); }}
                              className="absolute top-2 right-2 p-1 bg-black/50 text-white rounded-full hover:bg-black/70"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="w-12 h-12 bg-stone-100 rounded-full flex items-center justify-center text-stone-400">
                              <Upload size={24} />
                            </div>
                            <div className="text-center">
                              <p className="font-bold">Натисніть або перетягніть</p>
                              <p className="text-xs text-stone-400">JPG, PNG до 10MB</p>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-8 border-t border-stone-100 flex flex-col sm:flex-row sm:items-end justify-between gap-8">
                  <div className="space-y-4 flex-1">
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-400">Підсумок замовлення</p>
                      <div className="flex flex-col">
                        <div className="flex items-baseline gap-3">
                          <span className="text-sm text-stone-500 font-medium">Ціна:</span>
                          <span className="text-sm font-bold text-stone-900">{calculateNokPrice(selectedSize.step)} NOK</span>
                        </div>
                        <div className="flex items-baseline gap-3 mt-1">
                          <span className="text-sm text-stone-500 font-medium">Разом:</span>
                          <span className="text-4xl font-black text-emerald-600">
                            {convert(calculateNokPrice(selectedSize.step))} {currency}
                          </span>
                          {(isPromoActive || isPremiumSelected || isVipApplied) && (
                            <span className="text-lg text-stone-300 line-through font-medium">
                              {getOriginalPrice(selectedSize.step)} {currency}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1">
                      {ratesError && (
                        <p className="text-[10px] text-amber-600 font-bold flex items-center gap-1">
                          ⚠️ {ratesError}
                        </p>
                      )}
                      {ratesTimestamp && (
                        <p className="text-[10px] text-stone-400 font-medium">
                          Курс актуальний на: <span className="text-stone-500">{ratesTimestamp}</span>
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <button 
                    onClick={handleOrder}
                    disabled={!isBuyingVipPass && !uploadedFile}
                    className={`px-12 py-5 text-white font-bold rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-2xl hover:scale-[1.02] active:scale-[0.98] ${
                      isBuyingVipPass 
                        ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200' 
                        : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200'
                    }`}
                  >
                    {isBuyingVipPass ? 'Придбати VIP Pass' : 'Оформити замовлення'}
                  </button>
                </div>
              </div>

              <div className="bg-stone-900 p-12 text-white flex flex-col justify-between relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/20 blur-[100px] rounded-full -mr-32 -mt-32"></div>
                
                <div className="space-y-8 relative z-10">
                  <h3 className="text-2xl font-bold">Чому обирають нас?</h3>
                  <div className="space-y-6">
                    {[
                      { title: 'Преміум якість', desc: 'Використовуємо лише найкращі акрилові стрази.' },
                      { title: 'Швидка доставка', desc: 'Відправляємо по всьому світу протягом 3-5 днів.' },
                      { title: 'Повна комплектація', desc: 'У наборі є все необхідне для початку роботи.' },
                    ].map((item, i) => (
                      <div key={i} className="flex gap-4">
                        <div className="w-6 h-6 rounded-full bg-emerald-500 flex-shrink-0 flex items-center justify-center text-stone-900 font-bold text-xs">{i+1}</div>
                        <div>
                          <p className="font-bold">{item.title}</p>
                          <p className="text-stone-400 text-sm">{item.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white/5 border border-white/10 p-6 rounded-2xl space-y-4 relative z-10">
                  <div className="flex items-center gap-3">
                    <CreditCard className="text-emerald-500" />
                    <p className="font-bold">Оплата тільки через Revolut</p>
                  </div>
                  <p className="text-sm text-stone-400">Ми приймаємо платежі на Revolut: <br/><span className="text-white font-mono">{settings.bankAccount}</span></p>
                </div>
              </div>
            </section>

            {/* About Us */}
            <section id="about" className="max-w-3xl mx-auto text-center space-y-8">
              <h2 className="text-4xl font-bold tracking-tight">Про нас</h2>
              <p className="text-xl text-stone-500 leading-relaxed">
                {settings.aboutUs}
              </p>
            </section>

            {/* Technical Specification */}
            <section className="max-w-3xl mx-auto p-8 bg-stone-50 rounded-[2rem] border border-stone-200 space-y-4">
              <h3 className="text-lg font-bold flex items-center gap-2 justify-center">
                <Globe size={18} className="text-emerald-600" />
                Технічна специфікація розрахунку
              </h3>
              <p className="text-sm text-stone-600 leading-relaxed italic text-center">
                "Для розрахунку ціни на сайті реалізовано динамічний обмін валют за поточним курсом банку. Базова ціна перераховується у вибрану валюту відповідно до актуального курсу. Для цього підключено API курсу валют. При виборі користувачем валюти (євро, долар, гривня) підсумкова сума перераховується відповідно до курсу на момент оплати. Перерахунок є динамічним, відображається в реальному часі та зрозумілий користувачеві. Відображається вибрана валюта та актуальна сума в ній, виходячи з курсу банку."
              </p>
            </section>
          </div>
        )}
      </main>

      {/* Admin Login Modal */}
      <AnimatePresence>
        {showAdminLogin && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAdminLogin(false)}
              className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-white p-8 rounded-[2rem] shadow-2xl w-full max-w-md space-y-6"
            >
              <div className="text-center space-y-2">
                <div className="w-12 h-12 bg-stone-100 rounded-full flex items-center justify-center mx-auto text-stone-400">
                  <Lock size={24} />
                </div>
                <h3 className="text-2xl font-bold">Вхід для адміна</h3>
                <p className="text-stone-500">Введіть пароль для доступу</p>
              </div>
              <form onSubmit={handleAdminLogin} className="space-y-4">
                <input 
                  type="password" 
                  placeholder="Пароль"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="w-full p-4 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                />
                <button className="w-full py-4 bg-stone-900 text-white font-bold rounded-xl hover:bg-stone-800 transition-all">
                  Увійти
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Payment Modal */}
      <AnimatePresence>
        {isPaying && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-white p-10 rounded-[3rem] shadow-2xl w-full max-w-xl space-y-8"
            >
              {orderStatus === 'idle' && (
                <>
                  <div className="space-y-4">
                    <h3 className="text-3xl font-bold">Оплата через Revolut</h3>
                    <p className="text-stone-500">
                      Для завершення замовлення перекажіть{' '}
                      <span className="text-stone-900 font-bold">
                        {calculatePrice(selectedSize.step)} {currency}
                        {currency !== 'NOK' && ` (≈ ${calculateNokPrice(selectedSize.step)} NOK)`}
                      </span>{' '}
                      {isPromoActive && <span className="text-xs text-emerald-600 font-bold">(з урахуванням знижки 10%)</span>} на наш Revolut:
                    </p>
                    <div className="p-6 bg-stone-50 rounded-2xl border border-stone-200 font-mono text-lg text-center select-all">
                      {settings.bankAccount}
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <label className="text-xs font-bold uppercase tracking-wider text-stone-400">Завантажте чек про оплату (Screenshot)</label>
                    <div 
                      {...receiptDropzone.getRootProps()} 
                      className={`border-2 border-dashed rounded-2xl p-6 transition-all flex flex-col items-center justify-center gap-2 cursor-pointer ${
                        receiptDropzone.isDragActive ? 'border-emerald-500 bg-emerald-50' : 'border-stone-200 hover:border-stone-300'
                      }`}
                    >
                      <input {...receiptDropzone.getInputProps()} />
                      {receiptPreviewUrl ? (
                        <div className="flex items-center gap-3 text-emerald-600 font-bold">
                          <CheckCircle size={20} /> Чек завантажено
                        </div>
                      ) : (
                        <>
                          <Upload size={20} className="text-stone-400" />
                          <p className="text-sm font-bold">Натисніть, щоб додати чек</p>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-3 p-4 bg-emerald-50 text-emerald-700 rounded-xl text-sm">
                      <CheckCircle size={18} />
                      <p>Наш Бот автоматично перевірить чек перед відправкою.</p>
                    </div>
                    <div className="flex gap-3">
                      <button 
                        onClick={() => setIsPaying(false)}
                        className="flex-1 py-4 border-2 border-stone-100 font-bold rounded-xl hover:bg-stone-50 transition-all"
                      >
                        Скасувати
                      </button>
                      <button 
                        onClick={confirmPayment}
                        disabled={!receiptFile}
                        className="flex-1 py-4 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-all shadow-lg shadow-emerald-200"
                      >
                        Підтвердити оплату
                      </button>
                    </div>
                  </div>
                </>
              )}

              {orderStatus === 'processing' && (
                <div className="py-12 text-center space-y-6">
                  <div className="relative w-24 h-24 mx-auto">
                    <div className="absolute inset-0 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center text-emerald-500">
                      <SettingsIcon size={32} className="animate-pulse" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-2xl font-bold">Бот перевіряє чек...</h3>
                    <p className="text-stone-500">Аналіз зображення та транзакції</p>
                  </div>
                </div>
              )}

              {orderStatus === 'success' && (
                <div className="py-12 text-center space-y-6">
                  <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle size={40} />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-3xl font-bold">Замовлення прийнято!</h3>
                    <p className="text-stone-500">Ми надіслали підтвердження на email адміністратора u7204118005@gmail.com. Ми зв'яжемося з вами найближчим часом.</p>
                  </div>
                  <button 
                    onClick={() => { setIsPaying(false); setOrderStatus('idle'); setUploadedFile(null); setPreviewUrl(null); }}
                    className="px-10 py-4 bg-stone-900 text-white font-bold rounded-xl hover:bg-stone-800 transition-all"
                  >
                    Чудово
                  </button>
                </div>
              )}

              {orderStatus === 'error' && (
                <div className="py-12 text-center space-y-6">
                  <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
                    <X size={40} />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-2xl font-bold">Помилка оплати</h3>
                    <p className="text-stone-500">Нам не вдалося підтвердити ваш платіж. Спробуйте ще раз або зверніться в підтримку.</p>
                  </div>
                  <button 
                    onClick={() => setOrderStatus('idle')}
                    className="px-10 py-4 bg-stone-900 text-white font-bold rounded-xl hover:bg-stone-800 transition-all"
                  >
                    Спробувати знову
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="bg-white border-t border-stone-200 px-6 py-12 mt-24">
        <div className="max-w-7xl mx-auto grid md:grid-cols-3 gap-12">
          <div className="space-y-4">
            <div className="text-xl font-black tracking-tighter text-emerald-600 uppercase">Світ краси</div>
            <p className="text-sm text-stone-500">Ваш преміум сервіс алмазного живопису по всьому світу.</p>
          </div>
          <div className="space-y-4">
            <h4 className="font-bold">Контакти</h4>
            <p className="text-sm text-stone-500">{settings.contactEmail}</p>
          </div>
          <div className="space-y-4">
            <h4 className="font-bold">Рахунок для оплати</h4>
            <p className="text-sm font-mono text-stone-500">{settings.bankAccount}</p>
          </div>
        </div>
        <div className="max-w-7xl mx-auto pt-12 mt-12 border-t border-stone-100 text-center text-xs text-stone-400">
          © {new Date().getFullYear()} Світ краси. Всі права захищені.
        </div>
      </footer>
    </div>
  );
}
