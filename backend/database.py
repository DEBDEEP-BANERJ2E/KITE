import sqlite3
import os
import random

DB_NAME = "kite.db"

def init_db():
    if os.path.exists(DB_NAME):
        os.remove(DB_NAME)
        
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    
    cursor.execute('''
    CREATE TABLE products (
        id INTEGER PRIMARY KEY,
        name TEXT,
        category TEXT,
        price REAL,
        image_url TEXT,
        description TEXT,
        inventory INTEGER DEFAULT 10
    )
    ''')
    
    cursor.execute('''
    CREATE TABLE policies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category TEXT UNIQUE,
        return_window_days INTEGER,
        warranty_months INTEGER
    )
    ''')
    
    cursor.execute('''
    CREATE TABLE orders (
        id TEXT PRIMARY KEY,
        customer_email TEXT,
        product_id INTEGER,
        order_date TEXT,
        delivery_date TEXT,
        status TEXT,
        FOREIGN KEY(product_id) REFERENCES products(id)
    )
    ''')
    
    cursor.execute('''
    CREATE TABLE claims (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id TEXT,
        complaint_text TEXT,
        status TEXT,
        resolution TEXT,
        created_at TEXT
    )
    ''')
    
    cursor.execute('''
    CREATE TABLE cart (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_email TEXT,
        product_id INTEGER,
        FOREIGN KEY(product_id) REFERENCES products(id)
    )
    ''')

    cursor.execute('''
    CREATE TABLE chat_sessions (
        id TEXT PRIMARY KEY,
        customer_email TEXT,
        title TEXT,
        created_at TEXT
    )
    ''')
    
    cursor.execute('''
    CREATE TABLE chat_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT,
        sender TEXT,
        text TEXT,
        image_data TEXT,
        vision_analysis TEXT,
        is_action_card BOOLEAN DEFAULT 0,
        action_status TEXT,
        action_details TEXT,
        created_at TEXT,
        FOREIGN KEY(session_id) REFERENCES chat_sessions(id)
    )
    ''')
    
    # Hand-picked, reliable Unsplash images that perfectly match the products
    images = {
        "headphones": "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&q=80",
        "monitor": "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=600&q=80",
        "laptop": "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=600&q=80",
        "keyboard": "https://images.unsplash.com/photo-1595225476474-87563907a212?w=600&q=80",
        "mouse": "https://images.unsplash.com/photo-1563298723-dcfebaa392e3?w=600&q=80",
        "ipad": "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=600&q=80",
        "speaker": "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=600&q=80",
        "watch": "https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=600&q=80",
        "drone": "https://images.unsplash.com/photo-1507582020474-9a35b7d455d9?w=600&q=80",
        "earbuds": "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=600&q=80",
        "camera": "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=600&q=80",
        
        "coffee": "https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?w=600&q=80",
        "blender": "https://images.unsplash.com/photo-1570222094114-d054a817e56b?w=600&q=80",
        "knife": "https://images.unsplash.com/photo-1593618998160-e34014e67546?w=600&q=80",
        "skillet": "https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?w=600&q=80",
        "espresso": "https://images.unsplash.com/photo-1520206183501-b80df61043c2?w=600&q=80",
        
        "chair": "https://images.unsplash.com/photo-1505843490538-5133c6c7d0e1?w=600&q=80",
        "desk": "https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?w=600&q=80",
        "sofa": "https://images.unsplash.com/photo-1550254478-ead40cc54513?w=600&q=80",
        "bed": "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=600&q=80",
        
        "sneakers": "https://images.unsplash.com/photo-1549298916-b41d501d3772?w=600&q=80",
        "jacket": "https://images.unsplash.com/photo-1576995853123-5a10305d93c0?w=600&q=80",
        "sunglasses": "https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=600&q=80",
        "tshirt": "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600&q=80",
        
        "book": "https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=600&q=80",
        "book2": "https://images.unsplash.com/photo-1589829085413-56de8ae18c73?w=600&q=80",
        
        "yogamat": "https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?w=600&q=80",
        "dumbbells": "https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=600&q=80",
        "basketball": "https://images.unsplash.com/photo-1519861531473-9200262188bf?w=600&q=80",
        
        # Fallbacks per category
        "Electronics": "https://images.unsplash.com/photo-1498049794561-7780e7231661?w=600&q=80",
        "Home & Kitchen": "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=600&q=80",
        "Furniture": "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600&q=80",
        "Fashion": "https://images.unsplash.com/photo-1445205170230-053b83016050?w=600&q=80",
        "Books": "https://images.unsplash.com/photo-1512820790803-83ca734da794?w=600&q=80",
        "Sports": "https://images.unsplash.com/photo-1517649763962-0c623066013b?w=600&q=80"
    }

    product_names = [
        # Electronics
        ("Sony Noise Cancelling Headphones", "Electronics", 299.99, images["headphones"], "Industry-leading noise cancellation. Features a 30-hour battery life, touch sensor controls, and premium comfort for all-day listening."),
        ("Samsung 4K Monitor", "Electronics", 349.50, images["monitor"], "Stunning 4K UHD resolution. 60Hz refresh rate with AMD FreeSync. Perfect for productivity and casual gaming."),
        ("Apple MacBook Air", "Electronics", 999.00, images["laptop"], "Supercharged by the M-series chip. Features a gorgeous Liquid Retina display, all-day battery life, and a fanless, silent design."),
        ("Mechanical Keyboard", "Electronics", 120.00, images["keyboard"], "Tactile and clicky switches with full RGB backlighting. Hotswappable PCB and double-shot PBT keycaps."),
        ("Wireless Gaming Mouse", "Electronics", 59.99, images["mouse"], "Ultra-lightweight design at just 60g. Features a 20K DPI optical sensor and 70 hours of battery life."),
        ("iPad Pro 11-inch", "Electronics", 799.99, images["ipad"], "The ultimate iPad experience with the breakthrough M-chip. Features a ProMotion display and Apple Pencil hover."),
        ("Bluetooth Speaker Waterproof", "Electronics", 45.00, images["speaker"], "IPX7 waterproof rating. Delivers punchy bass and up to 12 hours of playtime. Perfect for the beach or pool."),
        ("Smart Watch Series 8", "Electronics", 399.00, images["watch"], "Advanced health sensors and apps. Track your blood oxygen, ECG, and sleep. Always-On Retina display."),
        ("Drone with 4K Camera", "Electronics", 450.00, images["drone"], "Capture stunning 4K aerial footage. Features a 3-axis gimbal, intelligent flight modes, and a 30-minute flight time."),
        ("Noise Cancelling Earbuds", "Electronics", 149.99, images["earbuds"], "True wireless freedom with active noise cancellation. Transparency mode lets you hear the world around you."),
        ("DSLR Camera Body", "Electronics", 1200.00, images["camera"], "Full-frame sensor for professional photography. Shoots 4K video and features advanced eye-autofocus tracking."),
        
        # Home & Kitchen
        ("Smart Coffee Maker", "Home & Kitchen", 89.99, images["coffee"], "Brew coffee from your phone. Set schedules, customize brew strength, and wake up to the smell of fresh coffee."),
        ("Blender High Speed", "Home & Kitchen", 95.00, images["blender"], "Crush sweep ice and blend smoothies in seconds. Powerful 1200W motor and large capacity BPA-free pitcher."),
        ("Chef Knife 8-inch", "Home & Kitchen", 65.50, images["knife"], "Forged from high-carbon stainless steel. Incredibly sharp edge and ergonomic handle for effortless chopping."),
        ("Cast Iron Skillet", "Home & Kitchen", 39.99, images["skillet"], "Pre-seasoned and ready to use. Exceptional heat retention and even heating. Perfect for searing and baking."),
        ("Espresso Machine", "Home & Kitchen", 450.00, images["espresso"], "Create cafe-quality espresso at home. Features a built-in burr grinder and a powerful steam wand for milk frothing."),
        
        # Furniture
        ("Ergonomic Office Chair", "Furniture", 199.99, images["chair"], "Breathable mesh back and adjustable lumbar support. Designed for all-day comfort and healthy posture."),
        ("Minimalist Wooden Desk", "Furniture", 149.00, images["desk"], "Clean, modern design. Constructed from solid wood with a durable finish. Perfect for home offices."),
        ("Velvet Sofa 3-Seater", "Furniture", 850.00, images["sofa"], "Luxurious velvet upholstery and high-density foam cushions. Adds a touch of mid-century modern elegance to any room."),
        ("Queen Size Bed Frame", "Furniture", 350.00, images["bed"], "Upholstered headboard with strong wooden slats. No box spring needed. Easy assembly."),
        
        # Fashion
        ("Classic White Sneakers", "Fashion", 75.00, images["sneakers"], "Timeless design that goes with everything. Features genuine leather and a comfortable cushioned insole."),
        ("Denim Jacket Vintage", "Fashion", 65.00, images["jacket"], "Classic vintage wash denim. Durable construction with button closures and multiple pockets."),
        ("Polarized Sunglasses", "Fashion", 45.00, images["sunglasses"], "100% UV protection and glare reduction. Lightweight, durable frames with a classic wayfarer style."),
        ("Cotton T-Shirt 3-Pack", "Fashion", 35.00, images["tshirt"], "Premium 100% organic cotton. Soft, breathable, and designed for a perfect everyday fit."),
        
        # Books
        ("The Great Gatsby", "Books", 14.99, images["book"], "F. Scott Fitzgerald's masterpiece. A timeless tale of wealth, love, and the American Dream in the 1920s."),
        ("Sapiens: A Brief History", "Books", 22.00, images["book2"], "Yuval Noah Harari's groundbreaking exploration of human history, from the Stone Age to the modern era."),
        
        # Sports
        ("Yoga Mat Extra Thick", "Sports", 29.99, images["yogamat"], "High-density foam provides excellent cushioning and joint support. Non-slip surface for stability during poses."),
        ("Dumbbell Set Adjustable", "Sports", 150.00, images["dumbbells"], "Easily adjust the weight from 5 to 50 lbs with a turn of a dial. Space-saving design for home gyms."),
        ("Basketball Official Size", "Sports", 35.00, images["basketball"], "Premium composite leather cover for superior grip and durability. Official size and weight.")
    ]
    
    # Generate remaining products to reach ~100
    for i in range(len(product_names) + 1, 101):
        cat = random.choice(["Electronics", "Home & Kitchen", "Fashion", "Furniture", "Books", "Sports"])
        name = f"Premium {cat} Item {i}"
        price = round(random.uniform(10.0, 500.0), 2)
        img = images[cat] # Use the category fallback image
        desc = f"Experience the exceptional quality of our {name}. Designed for maximum durability, beautiful aesthetics, and unparalleled performance. This {cat.lower()} item is a customer favorite."
        product_names.append((name, cat, price, img, desc))

    products = []
    for i, p in enumerate(product_names):
        inv = 0 if i == 1 else random.randint(5, 20) # Product 2 (Monitor) is out of stock
        products.append((i + 1, p[0], p[1], p[2], p[3], p[4], inv))
    
    orders = [
        ("ORD-1045", "user@example.com", 1, "2026-07-20", "2026-07-22", "Delivered"),
        ("ORD-1046", "user@example.com", 2, "2026-07-21", "2026-07-23", "Delivered"),
        ("ORD-1052", "user@example.com", 3, "2026-07-29", "2026-07-31", "In Transit"),
        ("ORD-8888", "user@example.com", 19, "2026-07-20", "2026-07-25", "Delivered"),
    ]
    
    policies = [
        ("Electronics", 7, 12),
        ("Home & Kitchen", 30, 24),
        ("Furniture", 14, 36),
        ("Fashion", 15, 0),
        ("Books", 30, 0),
        ("Sports", 30, 6)
    ]
    
    cursor.executemany("INSERT INTO products VALUES (?, ?, ?, ?, ?, ?, ?)", products)
    cursor.executemany("INSERT INTO orders VALUES (?, ?, ?, ?, ?, ?)", orders)
    cursor.executemany("INSERT INTO policies (category, return_window_days, warranty_months) VALUES (?, ?, ?)", policies)
    
    conn.commit()
    conn.close()

def get_db_connection():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    return conn

if __name__ == "__main__":
    init_db()
    print("Database initialized.")
