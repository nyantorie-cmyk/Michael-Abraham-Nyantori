import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { MapPin, Phone, Loader2 } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { StoreLocation } from '../types';

export default function Stores() {
  const [dynamicStores, setDynamicStores] = useState<StoreLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<string>('All');

  useEffect(() => {
    const storesRef = collection(db, 'stores');
    const q = query(storesRef, orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedStores = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as StoreLocation[];
      setDynamicStores(fetchedStores);
      setLoading(false);
    }, (error) => {
      setLoading(false);
      handleFirestoreError(error, OperationType.GET, 'stores');
    });
    return () => unsubscribe();
  }, []);

  const types = ['All', 'Liquor Store', 'Social Hall', 'Supermarket', 'Wholesale', 'Bar and Lounge', 'Hotel'];

  const filteredStores = selectedType === 'All' 
    ? dynamicStores 
    : dynamicStores.filter(s => s.type === selectedType);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pt-6">
      <div className="px-6 space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-serif font-bold text-wine-black">Store Locator</h2>
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            {types.map(type => (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className={`px-4 py-1.5 rounded-full text-[10px] font-bold whitespace-nowrap transition-all ${
                  selectedType === type 
                    ? 'bg-wine-black text-white' 
                    : 'bg-white text-wine-black/40 border border-wine-black/5'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {loading && dynamicStores.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 className="w-8 h-8 animate-spin text-wine-red" />
              <p className="text-wine-black/40 text-sm font-bold uppercase tracking-widest">Locating Stores...</p>
            </div>
          ) : filteredStores.length > 0 ? (
            filteredStores.map((store, i) => (
              <motion.div
                key={store.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="bg-white rounded-3xl p-5 shadow-sm border border-wine-black/5 flex justify-between items-center group hover:shadow-md transition-all"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-wine-gold">{store.type}</span>
                    <div className="w-1 h-1 bg-wine-black/10 rounded-full" />
                    <span className="text-[10px] text-wine-black/40">2.4 miles away</span>
                  </div>
                  <h3 className="font-serif font-bold text-lg">{store.name}</h3>
                  <p className="text-wine-black/40 text-xs">{store.address}</p>
                </div>
                
                <div className="flex flex-col gap-2">
                  <button 
                    onClick={() => window.location.href = `tel:${store.phone.replace(/\D/g, '')}`}
                    className="w-10 h-10 bg-wine-black/5 text-wine-black rounded-full flex items-center justify-center hover:bg-wine-black hover:text-white transition-all"
                    title="Call Store"
                  >
                    <Phone className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            ))
          ) : (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="py-16 text-center space-y-6 bg-white/50 rounded-[3rem] border border-dashed border-wine-black/10"
            >
              <div className="w-20 h-20 bg-wine-red/5 rounded-full flex items-center justify-center mx-auto">
                <MapPin className="w-10 h-10 text-wine-red/20" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-serif font-bold text-wine-black">No locations found</h3>
                <p className="text-wine-black/40 text-sm max-w-[200px] mx-auto">
                  We couldn't find any {selectedType !== 'All' ? selectedType.toLowerCase() + 's' : 'locations'} in this area.
                </p>
              </div>
              <button 
                onClick={() => setSelectedType('All')}
                className="px-8 py-3 bg-wine-black text-white rounded-2xl text-xs font-bold hover:bg-wine-red transition-all shadow-lg shadow-wine-black/10"
              >
                Show All Locations
              </button>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
