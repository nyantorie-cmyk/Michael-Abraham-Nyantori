import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  LayoutGrid, 
  List, 
  Package, 
  Download, 
  History,
  Newspaper,
  Calendar,
  MapPin,
  ShoppingBag,
  QrCode,
  Truck,
  ArrowLeft,
  Loader2,
  Users,
  MessageCircle,
  Image as ImageIcon,
  ArrowUpDown,
  Save,
  Trash2 as TrashIcon,
  ChevronRight,
  Edit2,
  X
} from 'lucide-react';
import { 
  collection, 
  query, 
  onSnapshot, 
  doc, 
  updateDoc, 
  deleteDoc, 
  addDoc, 
  serverTimestamp,
  getDocs,
  where,
  getDoc,
  Timestamp
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType, sanitizeData } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeCanvas } from 'qrcode.react';
import { ImageEditor } from '../components/ImageEditor';

type AdminTab = 'insight' | 'news' | 'event' | 'store' | 'product' | 'qr' | 'order';
type ViewMode = 'list' | 'create' | 'edit';
type OrderStatus = 'pending' | 'packed' | 'on transit' | 'delivered' | 'cancelled';

interface QRCode {
  id: string;
  code: string;
  title: string;
  description: string;
  type: 'Points' | 'Discount' | 'Reward';
  value: number;
  isActive: boolean;
  usageLimit: number;
  usageCount: number;
  expiryDate: string;
}

interface QRClaim {
  id: string;
  qrId: string;
  userId: string;
  claimedAt: any;
  pointsAwarded?: number;
  userName?: string;
  userEmail?: string;
}

export default function Admin() {
  const navigate = useNavigate();
  const { user: firebaseUser, loading: authLoading, logout } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<AdminTab>('insight');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [layoutMode, setLayoutMode] = useState<'grid' | 'list'>('list');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [userCount, setUserCount] = useState(0);
  const [eventSort, setEventSort] = useState<'date' | 'attendees'>('date');
  
  const [newsList, setNewsList] = useState<any[]>([]);
  const [eventsList, setEventsList] = useState<any[]>([]);
  const [storesList, setStoresList] = useState<any[]>([]);
  const [productsList, setProductsList] = useState<any[]>([]);
  const [qrList, setQrList] = useState<QRCode[]>([]);
  const [ordersList, setOrdersList] = useState<any[]>([]);
  
  const [editingImage, setEditingImage] = useState<string | null>(null);
  const [isViewingClaims, setIsViewingClaims] = useState(false);
  const [selectedQR, setSelectedQR] = useState<QRCode | null>(null);
  const [selectedQRClaims, setSelectedQRClaims] = useState<QRClaim[]>([]);

  const [newsData, setNewsData] = useState({
    title: '',
    summary: '',
    content: '',
    category: 'Industry News',
    source: 'Savvy Wine Community',
    image: '',
  });

  const [eventData, setEventData] = useState({
    title: '',
    date: '',
    time: '',
    location: '',
    venue: '',
    hosts: '',
    specialGuest: '',
    description: '',
    image: '',
    price: 0,
    isPast: false,
    attendeeCount: 0,
  });

  const [storeData, setStoreData] = useState({
    name: '',
    type: 'Liquor Store',
    address: '',
    lat: 0,
    lng: 0,
    phone: '',
  });

  const [productData, setProductData] = useState({
    name: '',
    description: '',
    price: 0,
    image: '',
    category: 'Wine',
    stock: 10,
    rating: 4.5,
  });

  const [qrData, setQrData] = useState({
    code: '',
    title: '',
    description: '',
    type: 'Points' as 'Points' | 'Discount' | 'Reward',
    value: 0,
    isActive: true,
    usageLimit: 0,
    usageCount: 0,
    expiryDate: '',
  });

  useEffect(() => {
    if (firebaseUser) {
      const checkAdmin = async () => {
        console.log("Checking Firestore role for UID:", firebaseUser.uid);
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (userDoc.exists()) {
          console.log("User document found. Role:", userDoc.data().role);
          if (userDoc.data().role === 'admin') {
            setIsAdmin(true);
          }
        } else {
          console.log("User document NOT found in Firestore.");
        }
      };
      checkAdmin();
    }
  }, [firebaseUser]);

  useEffect(() => {
    if (!isAdmin) return;

    console.log("Setting up onSnapshot listeners for admin...");
    const unsubNews = onSnapshot(collection(db, 'news'), (snap) => {
      console.log("News snapshot received. Size:", snap.size);
      setNewsList(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'news'));

    const unsubEvents = onSnapshot(collection(db, 'events'), (snap) => {
      console.log("Events snapshot received. Size:", snap.size);
      setEventsList(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'events'));

    const unsubStores = onSnapshot(collection(db, 'stores'), (snap) => {
      console.log("Stores snapshot received. Size:", snap.size);
      setStoresList(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'stores'));

    const unsubProducts = onSnapshot(collection(db, 'products'), (snap) => {
      console.log("Products snapshot received. Size:", snap.size);
      setProductsList(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'products'));

    const unsubQR = onSnapshot(collection(db, 'qrcodes'), (snap) => {
      console.log("QR snapshot received. Size:", snap.size);
      setQrList(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as QRCode[]);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'qrcodes'));

    const unsubOrders = onSnapshot(collection(db, 'orders'), (snap) => {
      console.log("Orders snapshot received. Size:", snap.size);
      setOrdersList(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'orders'));

    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      console.log("Users snapshot received. Size:", snap.size);
      setUserCount(snap.size);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'users'));

    return () => {
      unsubNews();
      unsubEvents();
      unsubStores();
      unsubProducts();
      unsubQR();
      unsubOrders();
      unsubUsers();
    };
  }, [isAdmin]);

  const filteredList = useMemo(() => {
    let list: any[] = [];
    if (activeTab === 'news') list = newsList;
    if (activeTab === 'event') {
      list = [...eventsList].sort((a, b) => {
        if (eventSort === 'date') return new Date(b.date).getTime() - new Date(a.date).getTime();
        return (b.attendeeCount || 0) - (a.attendeeCount || 0);
      });
    }
    if (activeTab === 'store') list = storesList;
    if (activeTab === 'product') list = productsList;
    if (activeTab === 'qr') list = qrList;
    if (activeTab === 'order') list = ordersList;

    if (!searchQuery) return list;

    const query = searchQuery.toLowerCase();
    return list.filter(item => {
      const title = (item.title || item.name || item.code || '').toLowerCase();
      const category = (item.category || item.type || '').toLowerCase();
      return title.includes(query) || category.includes(query);
    });
  }, [activeTab, newsList, eventsList, storesList, productsList, qrList, ordersList, searchQuery, eventSort]);

  const formatDate = (date: any) => {
    if (!date) return 'N/A';
    if (typeof date === 'string') return new Date(date).toLocaleDateString();
    if (date.toDate) return date.toDate().toLocaleDateString();
    return new Date(date).toLocaleDateString();
  };

  const isExpired = (expiryDate: any) => {
    if (!expiryDate) return false;
    const expiry = new Date(expiryDate);
    const now = new Date();
    expiry.setHours(23, 59, 59, 999);
    return now > expiry;
  };

  const handleUpdateOrderStatus = async (orderId: string, newStatus: OrderStatus) => {
    try {
      const orderRef = doc(db, 'orders', orderId);
      await updateDoc(orderRef, {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
      setStatus({ type: 'success', message: `Order status updated to ${newStatus}` });
    } catch (error) {
      console.error(error);
      setStatus({ type: 'error', message: 'Failed to update order status' });
      handleFirestoreError(error, OperationType.WRITE, 'orders');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const collectionName = activeTab === 'news' ? 'news' : 
                            activeTab === 'event' ? 'events' :
                            activeTab === 'store' ? 'stores' :
                            activeTab === 'product' ? 'products' :
                            activeTab === 'qr' ? 'qrcodes' : 'orders';
      await deleteDoc(doc(db, collectionName, id));
      setStatus({ type: 'success', message: 'Item deleted successfully' });
      if (viewMode === 'edit') resetForms();
    } catch (error) {
      console.error('Delete error:', error);
      setStatus({ type: 'error', message: 'Failed to delete item' });
      const collectionName = activeTab === 'news' ? 'news' : 
                            activeTab === 'event' ? 'events' :
                            activeTab === 'store' ? 'stores' :
                            activeTab === 'product' ? 'products' :
                            activeTab === 'qr' ? 'qrcodes' : 'orders';
      handleFirestoreError(error, OperationType.DELETE, collectionName);
    }
  };

  const handleEdit = (item: any) => {
    setEditingId(item.id);
    setViewMode('edit');
    if (activeTab === 'news') setNewsData({ ...item });
    if (activeTab === 'event') setEventData({ ...item });
    if (activeTab === 'store') setStoreData({ ...item });
    if (activeTab === 'product') setProductData({ ...item });
    if (activeTab === 'qr') {
      const data = { ...item };
      if (data.expiryDate && typeof data.expiryDate.toDate === 'function') {
        data.expiryDate = data.expiryDate.toDate().toISOString().split('T')[0];
      } else if (data.expiryDate && typeof data.expiryDate === 'string') {
        data.expiryDate = data.expiryDate.split('T')[0];
      }
      setQrData(data);
    }
  };

  const handleCreateNew = () => {
    resetForms();
    setViewMode('create');
  };

  const resetForms = () => {
    setNewsData({ title: '', summary: '', content: '', category: 'Industry News', source: 'Savvy Wine Community', image: '' });
    setEventData({ title: '', date: '', time: '', location: '', venue: '', hosts: '', specialGuest: '', description: '', image: '', price: 0, isPast: false, attendeeCount: 0 });
    setStoreData({ name: '', type: 'Liquor Store', address: '', lat: 0, lng: 0, phone: '' });
    setProductData({ name: '', description: '', price: 0, image: '', category: 'Wine', stock: 10, rating: 4.5 });
    setQrData({ code: '', title: '', description: '', type: 'Points', value: 0, isActive: true, usageLimit: 0, usageCount: 0, expiryDate: '' });
    setEditingId(null);
    setViewMode('list');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const collectionName = activeTab === 'news' ? 'news' : 
                            activeTab === 'event' ? 'events' :
                            activeTab === 'store' ? 'stores' :
                            activeTab === 'product' ? 'products' :
                            activeTab === 'qr' ? 'qrcodes' : 'orders';
      
      let data: any = {};
      if (activeTab === 'news') data = { ...newsData };
      if (activeTab === 'event') data = { ...eventData };
      if (activeTab === 'store') data = { ...storeData };
      if (activeTab === 'product') data = { ...productData };
      if (activeTab === 'qr') {
        data = { ...qrData };
        if (data.expiryDate && typeof data.expiryDate === 'string' && data.expiryDate.trim() !== '') {
          data.expiryDate = Timestamp.fromDate(new Date(data.expiryDate));
        } else if (data.expiryDate && typeof data.expiryDate.toDate === 'function') {
          // already a timestamp or similar
        } else {
          delete data.expiryDate;
        }
      }

      // Clean data: remove id if present
      delete data.id;

      if (viewMode === 'edit' && editingId) {
        await updateDoc(doc(db, collectionName, editingId), sanitizeData({ ...data, updatedAt: serverTimestamp() }));
        setStatus({ type: 'success', message: 'Updated successfully' });
      } else {
        await addDoc(collection(db, collectionName), sanitizeData({ ...data, createdAt: serverTimestamp() }));
        setStatus({ type: 'success', message: 'Created successfully' });
      }
      resetForms();
    } catch (error) {
      console.error(error);
      setStatus({ type: 'error', message: 'Operation failed' });
      const collectionName = activeTab === 'news' ? 'news' : 
                            activeTab === 'event' ? 'events' :
                            activeTab === 'store' ? 'stores' :
                            activeTab === 'product' ? 'products' :
                            activeTab === 'qr' ? 'qrcodes' : 'orders';
      handleFirestoreError(error, OperationType.WRITE, collectionName);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setEditingImage(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleDownloadQR = (qr: QRCode) => {
    const canvas = document.getElementById(`qr-canvas-${qr.id}`) as HTMLCanvasElement;
    if (canvas) {
      const url = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `qr-${qr.code}.png`;
      link.href = url;
      link.click();
    }
  };

  const handleViewClaims = async (qr: QRCode) => {
    setSelectedQR(qr);
    setIsViewingClaims(true);
    const snap = await getDocs(query(collection(db, 'qrclaims'), where('qrId', '==', qr.id)));
    const claims = await Promise.all(snap.docs.map(async d => {
      const data = d.data();
      const user = await getDoc(doc(db, 'users', data.userId));
      return { id: d.id, ...data, userName: user.data()?.name, userEmail: user.data()?.email };
    }));
    setSelectedQRClaims(claims as QRClaim[]);
  };

  const renderListItem = (item: any) => {
    const expired = activeTab === 'qr' && isExpired(item.expiryDate);
    
    if (activeTab === 'order') {
      return (
        <div className="bg-white rounded-[32px] border border-wine-black/5 p-6 space-y-4 group hover:border-wine-red/20 transition-all">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-wine-cream rounded-xl flex items-center justify-center text-wine-red">
                <Package className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-wine-black">Order #{item.id}</h3>
                <p className="text-[10px] text-wine-black/40 font-bold uppercase tracking-widest">
                  {formatDate(item.createdAt)} • {item.userName}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-wine-black">${item.total?.toFixed(2)}</p>
              <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${
                item.status === 'Delivered' ? 'bg-emerald-100 text-emerald-600' :
                item.status === 'Cancelled' ? 'bg-red-100 text-red-600' :
                'bg-amber-100 text-amber-600'
              }`}>
                {item.status}
              </span>
            </div>
          </div>
          <div className="pt-4 border-t border-wine-black/5 flex justify-between items-center">
             <select 
               value={item.status}
               onChange={(e) => handleUpdateOrderStatus(item.id, e.target.value as OrderStatus)}
               className="bg-wine-cream border-none rounded-xl px-4 py-2 text-xs font-bold text-wine-black outline-none capitalize"
             >
               <option value="pending">Pending</option>
               <option value="packed">Packed</option>
               <option value="on transit">On Transit</option>
               <option value="delivered">Delivered</option>
               <option value="cancelled">Cancelled</option>
             </select>
             <button onClick={() => handleDelete(item.id)} className="p-2 text-wine-black/20 hover:text-red-600 transition-colors">
               <TrashIcon className="w-4 h-4" />
             </button>
          </div>
        </div>
      );
    }

    return (
      <motion.div 
        layout
        className={`bg-white rounded-3xl border border-wine-black/5 group hover:border-wine-red/20 transition-all shadow-sm overflow-hidden ${
          layoutMode === 'list' ? 'p-4 flex items-center gap-4' : 'flex flex-col h-full'
        } ${expired ? 'opacity-60 grayscale-[0.5]' : ''}`}
      >
        <div className={`${layoutMode === 'list' ? 'w-16 h-16 rounded-2xl shrink-0' : 'w-full aspect-video'} overflow-hidden bg-wine-cream relative`}>
          {item.image ? (
            <img src={item.image} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-wine-red/20">
              {activeTab === 'store' ? <MapPin className="w-8 h-8" /> : 
               activeTab === 'product' ? <ShoppingBag className="w-8 h-8" /> :
               activeTab === 'qr' ? <QrCode className="w-8 h-8" /> :
               <ImageIcon className="w-8 h-8" />}
            </div>
          )}
        </div>
        <div className={`flex-1 min-w-0 ${layoutMode === 'grid' ? 'p-5' : ''}`}>
          <h3 className="font-bold text-wine-black truncate">{item.title || item.name}</h3>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
            <p className="text-[10px] text-wine-black/40 font-bold uppercase tracking-widest">
              {activeTab === 'news' && item.category}
              {activeTab === 'event' && `${formatDate(item.date)} • ${item.time}`}
              {activeTab === 'store' && item.type}
              {activeTab === 'product' && item.category}
              {activeTab === 'qr' && `${item.type} • ${item.code}`}
            </p>
            {activeTab === 'news' && (
              <div className="flex items-center gap-1 text-[10px] text-wine-black/40 font-bold uppercase tracking-widest">
                <Activity className="w-3 h-3" />
                {item.views || 0} views
              </div>
            )}
            {activeTab === 'event' && (
              <div className="flex items-center gap-1 text-[10px] text-wine-red font-bold uppercase tracking-widest">
                <Users className="w-3 h-3" />
                {item.attendeeCount || 0}
              </div>
            )}
            {activeTab === 'qr' && (
              <div className="flex items-center gap-1 text-[10px] text-wine-black/40 font-bold uppercase tracking-widest">
                <History className="w-3 h-3" />
                {item.usageCount || 0} / {item.usageLimit || '∞'}
              </div>
            )}
          </div>
          {activeTab === 'store' && (
            <p className="text-[10px] text-wine-black/40 mt-1 truncate">{item.address}</p>
          )}
          {activeTab === 'product' && (
            <p className="text-sm font-bold text-wine-red mt-1">${item.price}</p>
          )}
          {activeTab === 'qr' && expired && (
            <span className="inline-block mt-2 px-2 py-0.5 bg-red-100 text-red-600 text-[8px] font-black uppercase rounded-full">Expired</span>
          )}
          <div className="flex items-center gap-2 mt-4">
            <button onClick={() => handleEdit(item)} className="p-2 text-wine-black/20 hover:text-wine-red transition-colors"><Edit2 className="w-4 h-4" /></button>
            <button onClick={() => handleDelete(item.id)} className="p-2 text-wine-black/20 hover:text-red-600 transition-colors"><TrashIcon className="w-4 h-4" /></button>
            {activeTab === 'qr' && (
              <>
                <button onClick={() => handleDownloadQR(item)} className="p-2 text-wine-black/20 hover:text-wine-red transition-colors" title="Download QR"><Download className="w-4 h-4" /></button>
                <button onClick={() => handleViewClaims(item)} className="p-2 text-wine-black/20 hover:text-wine-red transition-colors" title="View History"><History className="w-4 h-4" /></button>
              </>
            )}
          </div>
        </div>
      </motion.div>
    );
  };

  const tabs = [
    { id: 'insight', label: 'Insight', icon: <Activity className="w-4 h-4" /> },
    { id: 'news', label: 'News', icon: <Newspaper className="w-4 h-4" /> },
    { id: 'event', label: 'Event', icon: <Calendar className="w-4 h-4" /> },
    { id: 'store', label: 'Store', icon: <MapPin className="w-4 h-4" /> },
    { id: 'product', label: 'Product', icon: <ShoppingBag className="w-4 h-4" /> },
    { id: 'qr', label: 'QR', icon: <QrCode className="w-4 h-4" /> },
    { id: 'order', label: 'Orders', icon: <Truck className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-wine-cream pb-20">
      <header className="bg-white px-6 py-6 flex items-center justify-between sticky top-0 z-30 border-b border-wine-black/5">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 bg-wine-black/5 rounded-full text-wine-black"><ArrowLeft className="w-5 h-5" /></button>
          <h1 className="text-xl font-serif font-bold">Admin Dashboard</h1>
        </div>
      </header>

      <main className="px-6 py-8 max-w-4xl mx-auto space-y-8">
        {authLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-wine-red" />
            <p className="text-wine-black/40 text-sm font-bold uppercase tracking-widest">Verifying Privileges...</p>
          </div>
        ) : needsVerification ? (
          <div className="bg-amber-50 border border-amber-100 p-8 rounded-[32px] text-center space-y-4">
            <h2 className="text-xl font-serif font-bold text-amber-900">Email Verification Required</h2>
            <p className="text-amber-600/70 text-sm">Your admin account is detected, but you must verify your email address to access the dashboard.</p>
            <div className="flex flex-col gap-3">
              <button 
                onClick={async () => {
                  if (auth.currentUser) {
                    await auth.currentUser.reload();
                    window.location.reload();
                  }
                }} 
                className="bg-amber-600 text-white px-8 py-3 rounded-2xl font-bold text-sm"
              >
                I've Verified My Email
              </button>
              <button onClick={() => navigate('/')} className="text-amber-600 font-bold text-sm">Return Home</button>
            </div>
          </div>
        ) : !isAdmin ? (
          <div className="bg-red-50 border border-red-100 p-8 rounded-[32px] text-center space-y-4">
            <h2 className="text-xl font-serif font-bold text-red-900">Access Denied</h2>
            <p className="text-red-600/70 text-sm">You do not have administrative privileges.</p>
            <button onClick={() => navigate('/')} className="bg-red-600 text-white px-8 py-3 rounded-2xl font-bold text-sm">Return Home</button>
          </div>
        ) : (
          <>
            <div className="flex bg-white p-1 rounded-2xl border border-wine-black/5 overflow-x-auto no-scrollbar">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => { setActiveTab(tab.id as AdminTab); setViewMode('list'); }}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                    activeTab === tab.id ? 'bg-wine-red text-white shadow-md' : 'text-wine-black/40 hover:text-wine-black/60'
                  }`}
                >
                  {tab.icon} {tab.label}
                </button>
              ))}
            </div>

            <AnimatePresence>
              {status && (
                <motion.div
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className={`p-4 rounded-2xl flex items-center justify-between gap-4 ${
                    status.type === 'success' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-red-50 text-red-600 border border-red-100'
                  }`}
                >
                  <p className="text-sm font-bold">{status.message}</p>
                  <button onClick={() => setStatus(null)} className="p-1 hover:bg-black/5 rounded-lg transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {activeTab !== 'insight' && (
              <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="relative flex-1 w-full">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-wine-black/20" />
                  <input
                    type="text"
                    placeholder={`Search ${activeTab}...`}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-white border border-wine-black/5 rounded-2xl py-3 pl-12 pr-4 text-sm font-bold text-wine-black outline-none focus:border-wine-red/20 transition-all"
                  />
                </div>
                <div className="flex items-center gap-2 bg-white p-1 rounded-2xl border border-wine-black/5">
                  <button 
                    onClick={() => setLayoutMode('list')}
                    className={`p-2 rounded-xl transition-all ${layoutMode === 'list' ? 'bg-wine-cream text-wine-red' : 'text-wine-black/20 hover:text-wine-black/40'}`}
                  >
                    <List className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => setLayoutMode('grid')}
                    className={`p-2 rounded-xl transition-all ${layoutMode === 'grid' ? 'bg-wine-cream text-wine-red' : 'text-wine-black/20 hover:text-wine-black/40'}`}
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-serif font-bold text-wine-black">
                {activeTab === 'insight' ? 'Admin Overview' : activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
              </h2>
              <div className="flex items-center gap-3">
                {activeTab === 'event' && viewMode === 'list' && (
                  <div className="flex bg-white p-1 rounded-xl border border-wine-black/5">
                    <button 
                      onClick={() => setEventSort('date')}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${eventSort === 'date' ? 'bg-wine-red text-white' : 'text-wine-black/40'}`}
                    >
                      Date
                    </button>
                    <button 
                      onClick={() => setEventSort('attendees')}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${eventSort === 'attendees' ? 'bg-wine-red text-white' : 'text-wine-black/40'}`}
                    >
                      Attendees
                    </button>
                  </div>
                )}
                {viewMode === 'list' && activeTab !== 'order' && activeTab !== 'insight' && (
                  <button onClick={handleCreateNew} className="bg-wine-red text-white px-6 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2">
                    <Plus className="w-4 h-4" /> Create New
                  </button>
                )}
              </div>
            </div>

            {viewMode === 'list' ? (
              <div className="space-y-8">
                {activeTab === 'insight' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="bg-white p-8 rounded-[32px] border border-wine-black/5 shadow-sm flex flex-col items-center text-center space-y-2">
                      <Users className="w-8 h-8 text-wine-red mb-2" />
                      <p className="text-wine-black/40 text-xs uppercase font-bold tracking-widest">Total Users</p>
                      <p className="text-4xl font-serif font-bold text-wine-black">{userCount}</p>
                    </div>
                    <div className="bg-white p-8 rounded-[32px] border border-wine-black/5 shadow-sm flex flex-col items-center text-center space-y-2">
                      <Truck className="w-8 h-8 text-wine-red mb-2" />
                      <p className="text-wine-black/40 text-xs uppercase font-bold tracking-widest">Total Orders</p>
                      <p className="text-4xl font-serif font-bold text-wine-black">{ordersList.length}</p>
                    </div>
                    <div className="bg-white p-8 rounded-[32px] border border-wine-black/5 shadow-sm flex flex-col items-center text-center space-y-2">
                      <MapPin className="w-8 h-8 text-wine-red mb-2" />
                      <p className="text-wine-black/40 text-xs uppercase font-bold tracking-widest">Total Stores</p>
                      <p className="text-4xl font-serif font-bold text-wine-black">{storesList.length}</p>
                    </div>
                    <div className="bg-white p-8 rounded-[32px] border border-wine-black/5 shadow-sm flex flex-col items-center text-center space-y-2">
                      <Calendar className="w-8 h-8 text-wine-red mb-2" />
                      <p className="text-wine-black/40 text-xs uppercase font-bold tracking-widest">Total Events</p>
                      <p className="text-4xl font-serif font-bold text-wine-black">{eventsList.length}</p>
                    </div>
                    <div className="bg-white p-8 rounded-[32px] border border-wine-black/5 shadow-sm flex flex-col items-center text-center space-y-2">
                      <QrCode className="w-8 h-8 text-wine-red mb-2" />
                      <p className="text-wine-black/40 text-xs uppercase font-bold tracking-widest">Total Offers</p>
                      <p className="text-4xl font-serif font-bold text-wine-black">{qrList.length}</p>
                    </div>
                  </div>
                ) : (
                  <div className={layoutMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-4'}>
                    {filteredList.length > 0 ? (
                      filteredList.map((item: any) => (
                        <div key={item.id}>{renderListItem(item)}</div>
                      ))
                    ) : (
                      <div className="col-span-full py-20 text-center space-y-4 bg-white rounded-[32px] border border-wine-black/5">
                        <div className="w-16 h-16 bg-wine-cream rounded-full flex items-center justify-center mx-auto text-wine-black/20">
                          <Search className="w-8 h-8" />
                        </div>
                        <p className="text-wine-black/40 text-sm font-bold uppercase tracking-widest">No results found for "{searchQuery}"</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="bg-white p-8 rounded-[32px] border border-wine-black/5 space-y-6">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-6"
                  >
                    {activeTab === 'news' && (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-wine-black/40 ml-2">Title</label>
                          <input type="text" value={newsData.title} onChange={e => setNewsData({...newsData, title: e.target.value})} className="w-full bg-wine-cream border-none rounded-2xl px-6 py-4 text-sm font-bold text-wine-black outline-none" required />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-wine-black/40 ml-2">Summary</label>
                          <textarea value={newsData.summary} onChange={e => setNewsData({...newsData, summary: e.target.value})} className="w-full bg-wine-cream border-none rounded-2xl px-6 py-4 text-sm font-bold text-wine-black outline-none min-h-[100px]" required />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-wine-black/40 ml-2">Content (Markdown)</label>
                          <textarea value={newsData.content} onChange={e => setNewsData({...newsData, content: e.target.value})} className="w-full bg-wine-cream border-none rounded-2xl px-6 py-4 text-sm font-bold text-wine-black outline-none min-h-[200px]" required />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-wine-black/40 ml-2">Category</label>
                            <select value={newsData.category} onChange={e => setNewsData({...newsData, category: e.target.value})} className="w-full bg-wine-cream border-none rounded-2xl px-6 py-4 text-sm font-bold text-wine-black outline-none">
                              <option>Industry News</option>
                              <option>Events</option>
                              <option>Community</option>
                            </select>
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-wine-black/40 ml-2">Source</label>
                            <input type="text" value={newsData.source} onChange={e => setNewsData({...newsData, source: e.target.value})} className="w-full bg-wine-cream border-none rounded-2xl px-6 py-4 text-sm font-bold text-wine-black outline-none" />
                          </div>
                        </div>
                      </div>
                    )}

                    {activeTab === 'event' && (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-wine-black/40 ml-2">Event Title</label>
                          <input type="text" value={eventData.title} onChange={e => setEventData({...eventData, title: e.target.value})} className="w-full bg-wine-cream border-none rounded-2xl px-6 py-4 text-sm font-bold text-wine-black outline-none" required />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-wine-black/40 ml-2">Date</label>
                            <input type="date" value={eventData.date} onChange={e => setEventData({...eventData, date: e.target.value})} className="w-full bg-wine-cream border-none rounded-2xl px-6 py-4 text-sm font-bold text-wine-black outline-none" required />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-wine-black/40 ml-2">Time</label>
                            <input type="time" value={eventData.time} onChange={e => setEventData({...eventData, time: e.target.value})} className="w-full bg-wine-cream border-none rounded-2xl px-6 py-4 text-sm font-bold text-wine-black outline-none" required />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-wine-black/40 ml-2">Location</label>
                            <input type="text" value={eventData.location} onChange={e => setEventData({...eventData, location: e.target.value})} className="w-full bg-wine-cream border-none rounded-2xl px-6 py-4 text-sm font-bold text-wine-black outline-none" required />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-wine-black/40 ml-2">Venue</label>
                            <input type="text" value={eventData.venue} onChange={e => setEventData({...eventData, venue: e.target.value})} className="w-full bg-wine-cream border-none rounded-2xl px-6 py-4 text-sm font-bold text-wine-black outline-none" required />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-wine-black/40 ml-2">Hosts</label>
                            <input type="text" value={eventData.hosts} onChange={e => setEventData({...eventData, hosts: e.target.value})} className="w-full bg-wine-cream border-none rounded-2xl px-6 py-4 text-sm font-bold text-wine-black outline-none" />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-wine-black/40 ml-2">Special Guest</label>
                            <input type="text" value={eventData.specialGuest} onChange={e => setEventData({...eventData, specialGuest: e.target.value})} className="w-full bg-wine-cream border-none rounded-2xl px-6 py-4 text-sm font-bold text-wine-black outline-none" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-wine-black/40 ml-2">Description</label>
                          <textarea value={eventData.description} onChange={e => setEventData({...eventData, description: e.target.value})} className="w-full bg-wine-cream border-none rounded-2xl px-6 py-4 text-sm font-bold text-wine-black outline-none min-h-[100px]" required />
                        </div>
                      </div>
                    )}

                    {activeTab === 'store' && (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-wine-black/40 ml-2">Store Name</label>
                          <input type="text" value={storeData.name} onChange={e => setStoreData({...storeData, name: e.target.value})} className="w-full bg-wine-cream border-none rounded-2xl px-6 py-4 text-sm font-bold text-wine-black outline-none" required />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-wine-black/40 ml-2">Address</label>
                          <input type="text" value={storeData.address} onChange={e => setStoreData({...storeData, address: e.target.value})} className="w-full bg-wine-cream border-none rounded-2xl px-6 py-4 text-sm font-bold text-wine-black outline-none" required />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-wine-black/40 ml-2">Latitude</label>
                            <input type="number" step="any" value={storeData.lat} onChange={e => setStoreData({...storeData, lat: Number(e.target.value)})} className="w-full bg-wine-cream border-none rounded-2xl px-6 py-4 text-sm font-bold text-wine-black outline-none" required />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-wine-black/40 ml-2">Longitude</label>
                            <input type="number" step="any" value={storeData.lng} onChange={e => setStoreData({...storeData, lng: Number(e.target.value)})} className="w-full bg-wine-cream border-none rounded-2xl px-6 py-4 text-sm font-bold text-wine-black outline-none" required />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-wine-black/40 ml-2">Type</label>
                            <select value={storeData.type} onChange={e => setStoreData({...storeData, type: e.target.value as any})} className="w-full bg-wine-cream border-none rounded-2xl px-6 py-4 text-sm font-bold text-wine-black outline-none">
                              <option>Liquor Store</option>
                              <option>Restaurant</option>
                              <option>Wine Bar</option>
                            </select>
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-wine-black/40 ml-2">Phone</label>
                            <input type="text" value={storeData.phone} onChange={e => setStoreData({...storeData, phone: e.target.value})} className="w-full bg-wine-cream border-none rounded-2xl px-6 py-4 text-sm font-bold text-wine-black outline-none" />
                          </div>
                        </div>
                      </div>
                    )}

                    {activeTab === 'product' && (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-wine-black/40 ml-2">Product Name</label>
                          <input type="text" value={productData.name} onChange={e => setProductData({...productData, name: e.target.value})} className="w-full bg-wine-cream border-none rounded-2xl px-6 py-4 text-sm font-bold text-wine-black outline-none" required />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-wine-black/40 ml-2">Description</label>
                          <textarea value={productData.description} onChange={e => setProductData({...productData, description: e.target.value})} className="w-full bg-wine-cream border-none rounded-2xl px-6 py-4 text-sm font-bold text-wine-black outline-none min-h-[100px]" required />
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-wine-black/40 ml-2">Price</label>
                            <input type="number" step="0.01" value={productData.price} onChange={e => setProductData({...productData, price: Number(e.target.value)})} className="w-full bg-wine-cream border-none rounded-2xl px-6 py-4 text-sm font-bold text-wine-black outline-none" required />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-wine-black/40 ml-2">Stock</label>
                            <input type="number" value={productData.stock} onChange={e => setProductData({...productData, stock: Number(e.target.value)})} className="w-full bg-wine-cream border-none rounded-2xl px-6 py-4 text-sm font-bold text-wine-black outline-none" required />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-wine-black/40 ml-2">Category</label>
                            <select value={productData.category} onChange={e => setProductData({...productData, category: e.target.value})} className="w-full bg-wine-cream border-none rounded-2xl px-6 py-4 text-sm font-bold text-wine-black outline-none">
                              <option>Wine</option>
                              <option>Spirits</option>
                              <option>Merchandise</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    )}

                    {activeTab === 'qr' && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-wine-black/40 ml-2">QR Code</label>
                            <input type="text" value={qrData.code} onChange={e => setQrData({...qrData, code: e.target.value})} className="w-full bg-wine-cream border-none rounded-2xl px-6 py-4 text-sm font-bold text-wine-black outline-none" required />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-wine-black/40 ml-2">Title</label>
                            <input type="text" value={qrData.title} onChange={e => setQrData({...qrData, title: e.target.value})} className="w-full bg-wine-cream border-none rounded-2xl px-6 py-4 text-sm font-bold text-wine-black outline-none" required />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-wine-black/40 ml-2">Description</label>
                          <textarea value={qrData.description} onChange={e => setQrData({...qrData, description: e.target.value})} className="w-full bg-wine-cream border-none rounded-2xl px-6 py-4 text-sm font-bold text-wine-black outline-none min-h-[80px]" required />
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-wine-black/40 ml-2">Type</label>
                            <select value={qrData.type} onChange={e => setQrData({...qrData, type: e.target.value as any})} className="w-full bg-wine-cream border-none rounded-2xl px-6 py-4 text-sm font-bold text-wine-black outline-none">
                              <option>Points</option>
                              <option>Discount</option>
                              <option>Reward</option>
                            </select>
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-wine-black/40 ml-2">Value</label>
                            <input type="number" value={qrData.value} onChange={e => setQrData({...qrData, value: Number(e.target.value)})} className="w-full bg-wine-cream border-none rounded-2xl px-6 py-4 text-sm font-bold text-wine-black outline-none" required />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-wine-black/40 ml-2">Usage Limit</label>
                            <input type="number" value={qrData.usageLimit} onChange={e => setQrData({...qrData, usageLimit: Number(e.target.value)})} className="w-full bg-wine-cream border-none rounded-2xl px-6 py-4 text-sm font-bold text-wine-black outline-none" placeholder="0 for unlimited" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-wine-black/40 ml-2">Expiry Date</label>
                          <input type="date" value={qrData.expiryDate} onChange={e => setQrData({...qrData, expiryDate: e.target.value})} className="w-full bg-wine-cream border-none rounded-2xl px-6 py-4 text-sm font-bold text-wine-black outline-none" />
                        </div>
                      </div>
                    )}

                    {['news', 'event', 'product'].includes(activeTab) && (
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-wine-black/40 ml-2">Image</label>
                        <div 
                          onClick={() => fileInputRef.current?.click()}
                          className="w-full aspect-video bg-wine-cream rounded-[32px] border-2 border-dashed border-wine-black/5 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-wine-red/20 transition-all overflow-hidden relative group"
                        >
                          {(activeTab === 'news' ? newsData.image : activeTab === 'event' ? eventData.image : productData.image) ? (
                            <>
                              <img src={activeTab === 'news' ? newsData.image : activeTab === 'event' ? eventData.image : productData.image} alt="" className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-wine-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <p className="text-white text-xs font-bold">Change Image</p>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-wine-red shadow-sm">
                                <ImageIcon className="w-6 h-6" />
                              </div>
                              <p className="text-wine-black/40 text-[10px] font-bold uppercase tracking-widest">Click to upload image</p>
                            </>
                          )}
                          <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="image/*" />
                        </div>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>

                <div className="flex flex-col gap-3">
                  <button type="submit" disabled={isSubmitting} className="w-full bg-wine-red text-white py-4 rounded-2xl font-bold shadow-lg shadow-wine-red/20 disabled:opacity-50">
                    {isSubmitting ? 'Processing...' : (viewMode === 'edit' ? 'Update' : 'Create')}
                  </button>
                  <div className="flex gap-3">
                    <button type="button" onClick={resetForms} className="flex-1 bg-wine-black/5 text-wine-black py-4 rounded-2xl font-bold">Cancel</button>
                    {viewMode === 'edit' && editingId && (
                      <button type="button" onClick={() => handleDelete(editingId)} className="flex-1 bg-red-50 text-red-600 py-4 rounded-2xl font-bold">Delete</button>
                    )}
                  </div>
                </div>
              </form>
            )}
          </>
        )}
      </main>

      <AnimatePresence>
        {editingImage && (
          <ImageEditor
            image={editingImage}
            onCropComplete={(cropped) => { 
              setEditingImage(null); 
              if (activeTab === 'news') setNewsData({...newsData, image: cropped});
              if (activeTab === 'event') setEventData({...eventData, image: cropped});
              if (activeTab === 'product') setProductData({...productData, image: cropped});
            }}
            onCancel={() => setEditingImage(null)}
            aspect={16 / 9}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isViewingClaims && selectedQR && (
          <div className="fixed inset-0 z-[100] bg-wine-black/90 backdrop-blur-sm flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white w-full max-w-2xl rounded-[40px] overflow-hidden shadow-2xl max-h-[80vh] flex flex-col"
            >
              <div className="p-8 border-b border-wine-black/5 flex justify-between items-center">
                <div>
                  <h3 className="text-2xl font-serif font-bold text-wine-black">QR Claims History</h3>
                  <p className="text-xs text-wine-black/40 font-bold uppercase tracking-widest mt-1">{selectedQR.title} ({selectedQR.code})</p>
                </div>
                <button onClick={() => setIsViewingClaims(false)} className="p-3 bg-wine-black/5 rounded-full hover:bg-wine-black/10 transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-8 space-y-4 no-scrollbar">
                {selectedQRClaims.length > 0 ? (
                  selectedQRClaims.map((claim) => (
                    <div key={claim.id} className="bg-wine-cream p-6 rounded-3xl flex justify-between items-center">
                      <div>
                        <p className="font-bold text-wine-black">{claim.userName || 'Unknown User'}</p>
                        <p className="text-[10px] text-wine-black/40 font-bold uppercase tracking-widest">{claim.userEmail}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-wine-red">+{claim.pointsAwarded || 0} Points</p>
                        <p className="text-[10px] text-wine-black/40 font-bold uppercase tracking-widest">{formatDate(claim.claimedAt)}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12 space-y-4">
                    <div className="w-16 h-16 bg-wine-cream rounded-full flex items-center justify-center mx-auto text-wine-black/20">
                      <History className="w-8 h-8" />
                    </div>
                    <p className="text-wine-black/40 text-sm font-bold uppercase tracking-widest">No claims yet</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
      {qrList.map(qr => (
        <div key={qr.id} className="hidden">
          <QRCodeCanvas id={`qr-canvas-${qr.id}`} value={qr.code} size={512} level="H" includeMargin />
        </div>
      ))}
    </div>
  );
}
