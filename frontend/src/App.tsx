import React, { useState, useEffect, useRef } from 'react';
import { Routes, Route, Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import { Menu, Search, ShoppingCart, User, Package, Moon, Sun, ArrowLeft, Send, Sparkles, X, MessageSquare, Plus, Trash2, Image as ImageIcon } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

type Product = {
  id: number;
  name: string;
  category: string;
  price: number;
  image_url: string;
  description: string;
};

type Order = {
  id: string;
  date: string;
  status: 'In Transit' | 'Delivered';
  product: Product;
};

type ChatMessage = {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  imageData?: string;
  isActionCard?: boolean;
  actionStatus?: 'approved' | 'rejected' | 'pending_human_review';
  actionDetails?: string;
};

const categories = ["All", "Electronics", "Home & Kitchen", "Furniture", "Fashion", "Books", "Sports"];

type ChatSession = {
  id: string;
  customer_email: string;
  title: string;
  created_at: string;
};



const USER_EMAIL = "user@example.com";

function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [cart, setCart] = useState<Product[]>([]);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Agent Chat Modal State
  const [kiteOpen, setKiteOpen] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [inputMsg, setInputMsg] = useState("");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    // Fetch Products
    fetch(`${API_URL}/api/products`)
      .then(res => res.json())
      .then(data => setProducts(data))
      .catch(err => console.error("Error fetching products:", err));

    // Fetch Orders
    fetch(`${API_URL}/api/orders/${USER_EMAIL}`)
      .then(res => res.json())
      .then(data => {
        // Map backend order structure to frontend Order type
        const formattedOrders: Order[] = data.map((o: any) => ({
          id: o.id,
          date: o.order_date,
          status: o.status,
          product: {
            id: o.product_id, // We need to assume it has id if we ever need it, but backend returns product_name, price, image_url
            name: o.product_name,
            price: o.price,
            image_url: o.image_url,
            category: "Unknown", // Backend doesn't return category in this query currently, but that's okay for UI
            description: ""
          }
        }));
        setOrders(formattedOrders);
      })
      .catch(err => console.error("Error fetching orders:", err));

    // Fetch Cart
    fetch(`${API_URL}/api/cart/${USER_EMAIL}`)
      .then(res => res.json())
      .then(data => setCart(data))
      .catch(err => console.error("Error fetching cart:", err));

    // Fetch Chat Sessions
    fetch(`${API_URL}/api/chat/sessions/${USER_EMAIL}`)
      .then(res => res.json())
      .then(data => setSessions(data))
      .catch(err => console.error("Error fetching sessions:", err));
  }, []);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isTyping]);

  useEffect(() => {
    setSidebarOpen(false); // Close sidebar on route change
  }, [location]);

  const addToCart = async (product: Product) => {
    try {
      await fetch(`${API_URL}/api/cart/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_email: USER_EMAIL, product_id: product.id })
      });
      // Optimistically update local state
      setCart([...cart, product]);
      navigate('/cart');
    } catch (err) {
      console.error("Error adding to cart:", err);
    }
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    try {
      // Create an order for each cart item
      for (const item of cart) {
        await fetch(`${API_URL}/api/orders/create`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ customer_email: USER_EMAIL, product_id: item.id })
        });
      }
      
      // Clear the cart on backend
      await fetch(`${API_URL}/api/cart/clear`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_email: USER_EMAIL })
      });
      
      setCart([]);
      
      // Refetch orders to get the real IDs from the backend
      const res = await fetch(`${API_URL}/api/orders/${USER_EMAIL}`);
      const data = await res.json();
      const formattedOrders: Order[] = data.map((o: any) => ({
        id: o.id,
        date: o.order_date,
        status: o.status,
        product: {
          id: o.product_id,
          name: o.product_name,
          price: o.price,
          image_url: o.image_url,
          category: "Unknown",
          description: ""
        }
      }));
      setOrders(formattedOrders);
      
      navigate('/orders');
    } catch (err) {
      console.error("Checkout failed", err);
    }
  };

  // --- Session management helpers ---
  const loadSession = async (sessionId: string) => {
    setActiveSessionId(sessionId);
    setShowHistory(false);
    try {
      const res = await fetch(`${API_URL}/api/chat/messages/${sessionId}`);
      const data = await res.json();
      const mapped: ChatMessage[] = data.map((m: any) => ({
        id: m.id.toString(),
        sender: m.sender,
        text: m.text,
        imageData: m.image_data,
        isActionCard: !!m.is_action_card,
        actionStatus: m.action_status,
        actionDetails: m.action_details
      }));
      setChatMessages(mapped);
    } catch (err) {
      console.error("Error loading session messages:", err);
    }
  };

  const createNewSession = async () => {
    try {
      const res = await fetch(`${API_URL}/api/chat/sessions/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_email: USER_EMAIL })
      });
      const data = await res.json();
      const newSession: ChatSession = { id: data.session_id, customer_email: USER_EMAIL, title: data.title, created_at: data.created_at };
      setSessions(prev => [newSession, ...prev]);
      await loadSession(data.session_id);
    } catch (err) {
      console.error("Error creating session:", err);
    }
  };

  const deleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(`${API_URL}/api/chat/sessions/${sessionId}`, { method: 'DELETE' });
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      if (activeSessionId === sessionId) {
        setActiveSessionId(null);
        setChatMessages([]);
      }
    } catch (err) {
      console.error("Error deleting session:", err);
    }
  };

  const openKite = async () => {
    setKiteOpen(true);
    if (!activeSessionId) {
      if (sessions.length > 0) {
        await loadSession(sessions[0].id);
      } else {
        await createNewSession();
      }
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!inputMsg.trim() && !selectedImage) || !activeSessionId) return;

    const userText = inputMsg;
    const base64Img = selectedImage ? selectedImage.split(',')[1] : undefined;
    setInputMsg("");
    setSelectedImage(null);
    setChatMessages(prev => [...prev, { id: Date.now().toString(), sender: 'user', text: userText, imageData: selectedImage || undefined }]);
    setIsTyping(true);

    try {
      const res = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: activeSessionId, message: userText, customer_email: USER_EMAIL, image_base64: base64Img })
      });
      const data = await res.json();
      setIsTyping(false);

      const agentMsg: ChatMessage = {
        id: Date.now().toString(),
        sender: 'agent',
        text: data.text,
        isActionCard: data.is_action_card,
        actionStatus: data.action_status,
        actionDetails: data.action_details
      };
      setChatMessages(prev => [...prev, agentMsg]);

      // Refresh sessions list to get updated title
      const sessRes = await fetch(`${API_URL}/api/chat/sessions/${USER_EMAIL}`);
      const sessData = await sessRes.json();
      setSessions(sessData);
    } catch (err) {
      setIsTyping(false);
      setChatMessages(prev => [...prev, { id: Date.now().toString(), sender: 'agent', text: "Sorry, I'm having trouble connecting. Please try again." }]);
    }
  };

  return (
    <>
      <nav className="navbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button onClick={() => setSidebarOpen(true)}><Menu size={24} color="var(--text-primary)" /></button>
          <Link to="/" className="logo">
            Aster<span>Market</span>
          </Link>
        </div>

        <div className="search-bar">
          <input 
            type="text" 
            placeholder="Search deep space for products..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') navigate('/');
            }}
          />
          <button className="search-btn" onClick={() => navigate('/')}>
            <Search size={20} />
          </button>
        </div>

        <div className="nav-links">
          <button className="nav-item" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <Link to="/orders" className="nav-item">
            <Package size={20} /> <span style={{ display: 'none', '@media (minWidth: 768px)': { display: 'inline' } } as any}>Orders</span>
          </Link>
          <Link to="/cart" className="nav-item" style={{ position: 'relative' }}>
            <ShoppingCart size={20} />
            {cart.length > 0 && <span className="cart-badge">{cart.length}</span>}
          </Link>
          <div className="nav-item">
            <User size={20} />
          </div>
        </div>
      </nav>

      <div className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`} onClick={() => setSidebarOpen(false)}></div>
      <div className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <button className="sidebar-close" onClick={() => setSidebarOpen(false)}><X size={24} /></button>
        <Link to="/" className="logo" style={{ marginBottom: '3rem' }}>
          Aster<span>Market</span>
        </Link>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h4 style={{ color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', fontSize: '0.8rem', marginBottom: '0.5rem' }}>System Tables</h4>
          <Link to="/policies" className="nav-item" style={{ padding: '0.75rem', fontSize: '1.1rem' }}>Policy Regulations</Link>
          <Link to="/inventory" className="nav-item" style={{ padding: '0.75rem', fontSize: '1.1rem' }}>Inventory Status</Link>
          <Link to="/claims" className="nav-item" style={{ padding: '0.75rem', fontSize: '1.1rem' }}>Resolution Records</Link>
          <Link to="/manager" className="nav-item" style={{ padding: '0.75rem', fontSize: '1.1rem', color: 'var(--danger-color)' }}>Human Manager</Link>
          <div style={{ margin: '2rem 0', height: '1px', background: 'var(--border-color)' }}></div>
          <Link to="/orders" className="nav-item" style={{ padding: '0.75rem', fontSize: '1.1rem' }}>My Orders</Link>
          <Link to="/cart" className="nav-item" style={{ padding: '0.75rem', fontSize: '1.1rem' }}>Shopping Cart</Link>
          <Link to="/about" className="nav-item" style={{ padding: '0.75rem', fontSize: '1.1rem' }}>About KITE Agent</Link>
        </div>
      </div>

      <main className="main-content">
        <Routes>
          <Route path="/" element={<ProductsPage products={products} searchQuery={searchQuery} addToCart={addToCart} />} />
          <Route path="/product/:id" element={<ProductDetailPage products={products} addToCart={addToCart} />} />
          <Route path="/cart" element={<CartPage cart={cart} handleCheckout={handleCheckout} navigate={navigate} />} />
          <Route path="/orders" element={<OrdersPage orders={orders} navigate={navigate} openKite={openKite} />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/policies" element={<PoliciesPage />} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/claims" element={<ClaimsPage />} />
          <Route path="/manager" element={<ManagerPage />} />
        </Routes>
      </main>

      {/* KITE Floating Button */}
      {!kiteOpen && (
        <button className="floating-chat-btn" onClick={() => openKite()}>
          <Sparkles size={24} />
        </button>
      )}

      {/* KITE Chat Overlay */}
      {kiteOpen && (
        <div className="agent-overlay">
          <div className="agent-container" style={{ position: 'relative' }}>
            <div className="agent-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <button className="history-toggle-btn" onClick={() => setShowHistory(!showHistory)} title="Chat History">
                  <MessageSquare size={20} />
                </button>
                <div>
                  <div className="kite-logo">KITE Agent</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    {sessions.find(s => s.id === activeSessionId)?.title || 'New Conversation'}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button className="history-toggle-btn" onClick={createNewSession} title="New Conversation">
                  <Plus size={18} />
                </button>
                <button onClick={() => setKiteOpen(false)} style={{ color: 'var(--text-secondary)', background: 'transparent', border: 'none', cursor: 'pointer' }}><X size={20}/></button>
              </div>
            </div>
            
            {/* Session History Panel */}
            {showHistory && (
              <div className="chat-sessions-panel">
                <div className="chat-sessions-header">
                  <h4 style={{ fontSize: '1rem' }}>Chat History</h4>
                  <button className="history-toggle-btn" onClick={() => setShowHistory(false)}><X size={18} /></button>
                </div>
                <div className="chat-sessions-list">
                  {sessions.length === 0 ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      <MessageSquare size={32} style={{ margin: '0 auto 0.75rem', opacity: 0.4 }} />
                      <p>No conversations yet</p>
                    </div>
                  ) : (
                    sessions.map(s => (
                      <div key={s.id} className={`session-item ${s.id === activeSessionId ? 'active' : ''}`} onClick={() => loadSession(s.id)}>
                        <MessageSquare size={16} style={{ flexShrink: 0, color: 'var(--text-secondary)' }} />
                        <span className="session-item-title">{s.title}</span>
                        <span className="session-item-date">{new Date(s.created_at).toLocaleDateString()}</span>
                        <button className="session-delete-btn" onClick={(e) => deleteSession(s.id, e)}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
                <button className="new-conversation-btn" onClick={createNewSession}>
                  <Plus size={18} /> New Conversation
                </button>
              </div>
            )}

            <div className="chat-messages">
              {chatMessages.map(msg => (
                <div key={msg.id} className={`chat-bubble ${msg.sender === 'user' ? 'chat-user' : 'chat-agent'}`}>
                  {msg.imageData && (
                    <img src={msg.imageData} alt="Uploaded evidence" style={{ width: '100%', borderRadius: '8px', marginBottom: '0.5rem' }} />
                  )}
                  <div style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</div>
                  {msg.isActionCard && (
                    <div className="action-card">
                      <strong style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Resolution Outcome:</strong>
                      <span style={{ color: msg.actionStatus === 'approved' ? 'var(--success-color)' : msg.actionStatus === 'rejected' ? 'var(--danger-color)' : 'var(--warning-color)' }}>
                        {msg.actionDetails}
                      </span>
                    </div>
                  )}
                </div>
              ))}
              {isTyping && (
                <div className="chat-bubble chat-agent" style={{ opacity: 0.7 }}>
                  <Sparkles size={16} style={{ display: 'inline-block', marginRight: '0.5rem' }} /> KITE is thinking...
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {selectedImage && (
              <div style={{ padding: '0.5rem 1rem', background: 'var(--bg-main)', borderTop: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <img src={selectedImage} alt="Preview" style={{ height: '40px', borderRadius: '4px' }} />
                <button onClick={() => setSelectedImage(null)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={16} /></button>
              </div>
            )}
            <form className="chat-input-area" onSubmit={handleSendMessage}>
              <input type="file" accept="image/*" ref={fileInputRef} style={{ display: 'none' }} onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = (ev) => setSelectedImage(ev.target?.result as string);
                  reader.readAsDataURL(file);
                }
              }} />
              <button type="button" className="chat-attach-btn" onClick={() => fileInputRef.current?.click()} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '0.5rem' }}>
                <ImageIcon size={20} />
              </button>
              <input 
                type="text" 
                placeholder="Message KITE..." 
                value={inputMsg}
                onChange={e => setInputMsg(e.target.value)}
                autoFocus
              />
              <button type="submit" className="chat-send-btn" disabled={(!inputMsg.trim() && !selectedImage) || isTyping}>
                <Send size={18} />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

// --- Page Components ---

function ProductsPage({ products, searchQuery, addToCart }: { products: Product[], searchQuery: string, addToCart: (p: Product) => void }) {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const selectedCategory = searchParams.get('category') || "All";
  const navigate = useNavigate();

  const filteredProducts = products.filter(p => 
    (selectedCategory === "All" || p.category === selectedCategory) &&
    (p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.category.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <>
      <h2 style={{ marginBottom: '1.5rem' }}>Discover Products</h2>
      
      <div style={{ display: 'flex', gap: '1rem', overflowX: 'auto', paddingBottom: '1rem', marginBottom: '1rem' }}>
        {categories.map(cat => (
          <button 
            key={cat} 
            className={`btn ${selectedCategory === cat ? 'btn-primary' : 'btn-secondary'}`}
            style={{ whiteSpace: 'nowrap' }}
            onClick={() => navigate(`/?category=${encodeURIComponent(cat)}`)}
          >
            {cat}
          </button>
        ))}
      </div>
      
      {filteredProducts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-secondary)' }}>
          <Search size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
          <h3>No items found</h3>
          <p>We couldn't find anything matching your criteria.</p>
        </div>
      ) : (
        <div className="products-grid">
          {filteredProducts.map(product => (
            <Link to={`/product/${product.id}`} key={product.id} className="surface-card product-card">
              <img src={product.image_url} alt={product.name} className="product-image" />
              <span style={{ fontSize: '0.8rem', color: 'var(--accent-color)', fontWeight: 600, textTransform: 'uppercase' }}>{product.category}</span>
              <h3 style={{ fontSize: '1.1rem', marginTop: '0.25rem' }}>{product.name}</h3>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
                <span className="product-price">${product.price.toFixed(2)}</span>
                <button className="btn btn-primary" onClick={(e) => { e.preventDefault(); addToCart(product); }}>Add to Cart</button>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

function ProductDetailPage({ products, addToCart }: { products: Product[], addToCart: (p: Product) => void }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const product = products.find(p => p.id === Number(id));
  
  const [reviews, setReviews] = useState([
    { id: 1, author: 'Alice Johnson', rating: 5, text: 'Absolutely phenomenal product. It exceeded all my expectations and arrived extremely quickly!' },
    { id: 2, author: 'Mark D.', rating: 4, text: 'Great quality for the price. Had a small scuff on the box, but the item itself was flawless.' }
  ]);
  const [newReviewText, setNewReviewText] = useState("");
  const [newRating, setNewRating] = useState(5);

  if (!product) return <div style={{ padding: '4rem', textAlign: 'center' }}>Loading product...</div>;

  const handleReviewSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReviewText.trim()) return;
    setReviews([{ id: Date.now(), author: 'You', rating: newRating, text: newReviewText }, ...reviews]);
    setNewReviewText("");
    setNewRating(5);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <button className="btn btn-secondary" style={{ width: 'fit-content' }} onClick={() => navigate(-1)}>
        <ArrowLeft size={18} /> Back
      </button>
      
      <div className="surface-card" style={{ display: 'flex', gap: '3rem', padding: '2rem', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 400px' }}>
          <img 
            src={product.image_url} 
            alt={product.name} 
            style={{ width: '100%', height: '400px', borderRadius: '16px', objectFit: 'cover' }} 
          />
        </div>
        <div style={{ flex: '1 1 400px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div>
            <span style={{ fontSize: '0.9rem', color: 'var(--accent-color)', fontWeight: 600, textTransform: 'uppercase' }}>{product.category}</span>
            <h2 style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>{product.name}</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#f59e0b' }}>
              {'★'.repeat(Math.round(reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length)) + '☆'.repeat(5 - Math.round(reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length))} 
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>({reviews.length} customer reviews)</span>
            </div>
          </div>
          
          <div style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            ${product.price.toFixed(2)}
          </div>
          
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, fontSize: '1.05rem' }}>
            {product.description}
          </p>
          
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            This {product.category.toLowerCase()} item is fully covered by Aster Market's 7-day hassle-free return policy, secured by our autonomous KITE agent.
          </p>
          
          <ul style={{ color: 'var(--text-secondary)', marginLeft: '1.25rem', lineHeight: 1.8 }}>
            <li>Premium materials and build quality</li>
            <li>In stock and ready to ship</li>
            <li>Free 2-day delivery on all orders</li>
          </ul>
          
          <div style={{ marginTop: 'auto', display: 'flex', gap: '1rem' }}>
            <button className="btn btn-primary" style={{ padding: '1rem 2rem', fontSize: '1.1rem', flex: 1 }} onClick={() => addToCart(product)}>
              <ShoppingCart size={20} /> Add to Cart
            </button>
          </div>
        </div>
      </div>
      
      <div className="surface-card" style={{ padding: '2rem' }}>
        <h3 style={{ marginBottom: '1.5rem' }}>Customer Reviews</h3>
        
        <form onSubmit={handleReviewSubmit} style={{ marginBottom: '2rem', padding: '1.5rem', background: 'var(--bg-main)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
          <h4 style={{ marginBottom: '1rem' }}>Write a Review</h4>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', color: '#f59e0b', cursor: 'pointer' }}>
            {[1,2,3,4,5].map(star => (
              <span key={star} onClick={() => setNewRating(star)} style={{ fontSize: '1.5rem', opacity: star <= newRating ? 1 : 0.3 }}>★</span>
            ))}
          </div>
          <textarea 
            className="review-textarea"
            rows={3} 
            placeholder="Share your thoughts about this product..."
            value={newReviewText}
            onChange={e => setNewReviewText(e.target.value)}
          ></textarea>
          <button type="submit" className="btn btn-primary">Submit Review</button>
        </form>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {reviews.map(review => (
            <div key={review.id} style={{ paddingBottom: '1.5rem', borderBottom: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
                <strong style={{ fontSize: '1.1rem' }}>{review.author}</strong>
                <span style={{ color: '#f59e0b' }}>{'★'.repeat(review.rating)}{'☆'.repeat(5-review.rating)}</span>
              </div>
              <p style={{ color: 'var(--text-secondary)' }}>{review.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CartPage({ cart, handleCheckout, navigate }: { cart: Product[], handleCheckout: () => void, navigate: any }) {
  const cartTotal = cart.reduce((sum, item) => sum + item.price, 0);
  
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
        <button className="btn btn-secondary" onClick={() => navigate('/')}><ArrowLeft size={18} /> Continue Shopping</button>
        <h2>Your Cart ({cart.length} items)</h2>
      </div>
      
      {cart.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>
          <ShoppingCart size={64} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
          <h3>Your cart is empty</h3>
          <p style={{ marginTop: '1rem' }}>Add some products to your cart to see them here.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
          <div style={{ flex: '2 1 600px' }} className="surface-card">
            {cart.map((item, index) => (
              <div key={index} style={{ display: 'flex', gap: '1.5rem', padding: '1.5rem 0', borderBottom: index < cart.length -1 ? '1px solid var(--border-color)' : 'none' }}>
                <img src={item.image_url} alt={item.name} style={{ width: '120px', height: '120px', objectFit: 'cover', borderRadius: '12px' }} />
                <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--accent-color)', fontWeight: 600, textTransform: 'uppercase' }}>{item.category}</span>
                  <h3 style={{ fontSize: '1.25rem' }}>{item.name}</h3>
                  <div style={{ fontSize: '1.25rem', fontWeight: 600, marginTop: '0.5rem' }}>${item.price.toFixed(2)}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ flex: '1 1 300px' }}>
            <div className="surface-card" style={{ position: 'sticky', top: '100px' }}>
              <h3 style={{ marginBottom: '1.5rem' }}>Order Summary</h3>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', color: 'var(--text-secondary)' }}>
                <span>Subtotal</span>
                <span>${cartTotal.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>
                <span>Shipping</span>
                <span>Free</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem', fontSize: '1.5rem', fontWeight: 700, borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
                <span>Total</span>
                <span>${cartTotal.toFixed(2)}</span>
              </div>
              <button className="btn btn-primary" style={{ width: '100%', padding: '1.25rem', fontSize: '1.1rem' }} onClick={handleCheckout}>
                Pay & Order securely
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function OrdersPage({ orders, navigate, openKite }: { orders: Order[], navigate: any, openKite: () => void }) {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
        <button className="btn btn-secondary" onClick={() => navigate('/')}><ArrowLeft size={18} /> Continue Shopping</button>
        <h2>Your Orders</h2>
      </div>
      
      {orders.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>
          <Package size={64} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
          <h3>No orders yet</h3>
          <p style={{ marginTop: '1rem' }}>When you buy something, it will appear here.</p>
        </div>
      ) : (
        <div className="surface-card orders-list">
          {orders.map((order, i) => (
            <div key={order.id} className="order-item" style={{ borderBottom: i < orders.length -1 ? '1px solid var(--border-color)' : 'none' }}>
              <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                <img src={order.product.image_url} alt={order.product.name} className="order-thumbnail" />
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.25rem' }}>
                    <h3 style={{ fontSize: '1.25rem' }}>{order.product.name}</h3>
                    <span className={`status-badge status-${order.status === 'Delivered' ? 'delivered' : 'transit'}`}>
                      {order.status}
                    </span>
                  </div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.75rem' }}>
                    Order: {order.id} • Placed on {order.date}
                  </div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>${order.product.price.toFixed(2)}</div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'flex-end' }}>
                <button className="btn btn-secondary">Track Package</button>
                <button className="btn btn-primary" style={{ background: 'var(--bg-surface)', color: 'var(--accent-color)', border: '1px solid var(--accent-color)' }} onClick={() => openKite()}>
                  <Sparkles size={16} /> Get Help (Ask KITE)
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export default App;

function PoliciesPage() {
  const [policies, setPolicies] = useState<any[]>([]);

  useEffect(() => {
    fetch(`${API_URL}/api/policies`)
      .then(res => res.json())
      .then(data => setPolicies(data));
  }, []);

  return (
    <div style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '2rem', marginBottom: '1.5rem' }}>System Database: Return Policies</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>This table shows the exact policy parameters KITE checks before approving any returns or replacements.</p>
      
      <div className="surface-card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--bg-color)', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
              <th style={{ padding: '1rem' }}>Category</th>
              <th style={{ padding: '1rem' }}>Return Window (Days)</th>
              <th style={{ padding: '1rem' }}>Warranty (Months)</th>
            </tr>
          </thead>
          <tbody>
            {policies.map(p => (
              <tr key={p.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '1rem', fontWeight: 500 }}>{p.category}</td>
                <td style={{ padding: '1rem' }}>{p.return_window_days}</td>
                <td style={{ padding: '1rem' }}>{p.warranty_months}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function InventoryPage() {
  const [inventory, setInventory] = useState<any[]>([]);

  useEffect(() => {
    fetch(`${API_URL}/api/inventory`)
      .then(res => res.json())
      .then(data => setInventory(data));
  }, []);

  return (
    <div style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '2rem', marginBottom: '1.5rem' }}>System Database: Inventory Status</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>KITE queries this database to check if a replacement is available. If stock is 0, it pivots to a refund.</p>
      
      <div className="surface-card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--bg-color)', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
              <th style={{ padding: '1rem' }}>ID</th>
              <th style={{ padding: '1rem' }}>Product Name</th>
              <th style={{ padding: '1rem' }}>Category</th>
              <th style={{ padding: '1rem' }}>Stock Available</th>
            </tr>
          </thead>
          <tbody>
            {inventory.slice(0, 20).map(p => (
              <tr key={p.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>{p.id}</td>
                <td style={{ padding: '1rem', fontWeight: 500 }}>{p.name}</td>
                <td style={{ padding: '1rem' }}>{p.category}</td>
                <td style={{ padding: '1rem' }}>
                  <span style={{ 
                    padding: '0.25rem 0.5rem', 
                    borderRadius: '4px', 
                    fontSize: '0.9rem',
                    background: p.inventory > 0 ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                    color: p.inventory > 0 ? 'rgb(34, 197, 94)' : 'rgb(239, 68, 68)'
                  }}>
                    {p.inventory > 0 ? p.inventory : 'Out of Stock'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ClaimsPage() {
  const [claims, setClaims] = useState<any[]>([]);

  useEffect(() => {
    // Poll for new claims every 3 seconds to feel "live"
    const fetchClaims = () => {
      fetch(`${API_URL}/api/claims`)
        .then(res => res.json())
        .then(data => setClaims(data));
    };
    fetchClaims();
    const interval = setInterval(fetchClaims, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '2rem', marginBottom: '1.5rem' }}>System Database: Resolution Records</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>A live view of all actions successfully executed by the KITE agent.</p>
      
      {claims.length === 0 ? (
        <div className="surface-card" style={{ textAlign: 'center', padding: '4rem' }}>
          <p style={{ color: 'var(--text-secondary)' }}>No claims have been resolved yet.</p>
          <p style={{ fontSize: '0.9rem', marginTop: '1rem' }}>Try using the KITE widget to process a return!</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '1rem' }}>
          {claims.map(c => (
            <div key={c.id} className="surface-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, fontSize: '1.1rem' }}>Order {c.order_id}</span>
                <span style={{ 
                  padding: '0.25rem 0.5rem', 
                  borderRadius: '4px', 
                  fontSize: '0.85rem',
                  textTransform: 'uppercase',
                  fontWeight: 600,
                  background: c.status === 'approved_refund' ? 'rgba(59, 130, 246, 0.1)' : 
                             c.status === 'approved_replacement' ? 'rgba(34, 197, 94, 0.1)' : 
                             'rgba(239, 68, 68, 0.1)',
                  color: c.status === 'approved_refund' ? 'rgb(59, 130, 246)' : 
                         c.status === 'approved_replacement' ? 'rgb(34, 197, 94)' : 
                         'rgb(239, 68, 68)'
                }}>
                  {c.status.replace('_', ' ')}
                </span>
              </div>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}><strong>Complaint:</strong> {c.complaint_text}</p>
              <p style={{ fontSize: '0.95rem' }}><strong>Resolution:</strong> {c.resolution}</p>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Processed at: {new Date(c.created_at).toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AboutPage() {
  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem' }}>
      <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>
        KITE <span style={{ color: 'var(--accent-color)' }}>(Knowledge-guided Issue Triage and Execution)</span>
      </h1>
      <p style={{ fontSize: '1.25rem', color: 'var(--text-secondary)', marginBottom: '3rem' }}>
        Agentic post-purchase resolution for e-commerce
      </p>

      <div style={{ display: 'grid', gap: '2rem' }}>
        <div className="surface-card">
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Sparkles size={24} color="var(--accent-color)" /> Unique Value Proposition
          </h2>
          <p style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem' }}>
            FROM COMPLAINT TO COMPLETED RESOLUTION
          </p>
          <p style={{ color: 'var(--text-secondary)' }}>
            KITE sees the evidence, verifies the order, checks the policy and completes the correct action while keeping humans in control of uncertain or high-value cases. Not just another support chatbot.
          </p>
        </div>

        <div className="surface-card">
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>The Problem</h2>
          <ul style={{ color: 'var(--text-secondary)', marginLeft: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <li><strong>Slow, fragmented handling:</strong> Teams manually check chats, orders, images, policies, stock and logistics before taking action.</li>
            <li><strong>Inconsistent decisions:</strong> Repeated verification and hand-offs increase resolution time, support cost and customer frustration.</li>
            <li><strong>Financial leakage:</strong> Unnecessary refunds, suspicious claims and poor return coordination reduce margins.</li>
          </ul>
        </div>

        <div className="surface-card">
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>The Solution</h2>
          <ul style={{ color: 'var(--text-secondary)', marginLeft: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <li><strong>Understand the claim:</strong> Analyse complaint text and photos, then verify the customer, order and product.</li>
            <li><strong>Make a policy-safe decision:</strong> Check the return window, warranty, inventory, value, history and risk rules.</li>
            <li><strong>Complete the action:</strong> Initiate or simulate a refund, replacement, repair or pickup; escalate uncertain cases.</li>
          </ul>
        </div>

        <div className="surface-card">
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Unfair Advantage</h2>
          <ul style={{ color: 'var(--text-secondary)', marginLeft: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <li><strong>Specialised workflow:</strong> Built for evidence-heavy post-purchase claims rather than general customer chat.</li>
            <li><strong>Retailer-specific policy graph:</strong> Learns each brand's rules, approvals, exceptions and integrations.</li>
            <li><strong>Data advantage over time:</strong> Claims, images, decisions, outcomes and human corrections improve the system.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
function ManagerPage() {
  const [claims, setClaims] = useState<any[]>([]);

  useEffect(() => {
    fetch(`${API_URL}/api/claims`)
      .then(res => res.json())
      .then(data => setClaims(data));
  }, []);

  const handleResolve = async (id: number, action: string) => {
    const details = prompt(`Enter resolution details for this ${action.replace('approved_', '')}:`);
    if (!details) return;

    await fetch(`${API_URL}/api/manager/claims/${id}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, details })
    });

    setClaims(claims.map(c => c.id === id ? { ...c, status: action, resolution: details } : c));
  };

  const pendingClaims = claims.filter(c => c.status === 'pending_human_review');

  return (
    <div style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '2rem', marginBottom: '1.5rem', color: 'var(--danger-color)' }}>Human Manager Dashboard</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>Review claims flagged by KITE's Fraud & Consistency tools.</p>
      
      {pendingClaims.length === 0 ? (
        <div className="surface-card" style={{ textAlign: 'center', padding: '4rem' }}>
          <p style={{ color: 'var(--text-secondary)' }}>Zero pending cases. Good job, KITE!</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '1rem' }}>
          {pendingClaims.map(c => (
            <div key={c.id} className="surface-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', borderLeft: '4px solid var(--danger-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, fontSize: '1.2rem' }}>Order {c.order_id}</span>
                <span style={{ padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.85rem', textTransform: 'uppercase', fontWeight: 600, background: 'rgba(239, 68, 68, 0.1)', color: 'rgb(239, 68, 68)' }}>
                  FLAGGED FOR REVIEW
                </span>
              </div>
              <p style={{ fontSize: '0.9rem' }}><strong>Complaint:</strong> {c.complaint_text}</p>
              <div style={{ background: 'var(--bg-color)', padding: '1rem', borderRadius: '8px', fontSize: '0.9rem' }}>
                <strong>KITE's Flags:</strong> {c.resolution}
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                <button className="btn btn-primary" style={{ background: 'var(--success-color)' }} onClick={() => handleResolve(c.id, 'approved_replacement')}>Approve Replacement</button>
                <button className="btn btn-primary" style={{ background: 'var(--info-color)' }} onClick={() => handleResolve(c.id, 'approved_refund')}>Approve Refund</button>
                <button className="btn btn-primary" style={{ background: 'var(--danger-color)' }} onClick={() => handleResolve(c.id, 'rejected')}>Reject Claim</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
