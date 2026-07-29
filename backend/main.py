from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import database
import datetime
import uuid
from agent import kite_agent
from langchain_core.messages import HumanMessage, AIMessage
from langchain_groq import ChatGroq
import json

app = FastAPI(title="KITE - Aster Market Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ClaimRequest(BaseModel):
    order_id: str
    complaint_text: str
    requested_resolution: str

class ClaimResponse(BaseModel):
    claim_id: int
    status: str
    resolution_plan: dict

class OrderCreateRequest(BaseModel):
    product_id: int
    customer_email: str

class CartAddRequest(BaseModel):
    customer_email: str
    product_id: int

class CartClearRequest(BaseModel):
    customer_email: str

class ChatRequest(BaseModel):
    session_id: str
    message: str
    customer_email: str
    image_base64: Optional[str] = None

class NewSessionRequest(BaseModel):
    customer_email: str
    title: Optional[str] = None

class DeleteSessionRequest(BaseModel):
    session_id: str


@app.on_event("startup")
def startup_event():
    database.init_db()

@app.get("/api/orders/{email}")
def get_orders(email: str):
    conn = database.get_db_connection()
    orders = conn.execute("""
        SELECT o.id, o.order_date, o.delivery_date, o.status, p.name as product_name, p.price, p.image_url 
        FROM orders o 
        JOIN products p ON o.product_id = p.id 
        WHERE o.customer_email = ?
        ORDER BY o.order_date DESC
    """, (email,)).fetchall()
    conn.close()
    return [dict(row) for row in orders]

@app.get("/api/products")
def get_products():
    conn = database.get_db_connection()
    products = conn.execute("SELECT * FROM products").fetchall()
    conn.close()
    return [dict(row) for row in products]

@app.get("/api/cart/{email}")
def get_cart(email: str):
    conn = database.get_db_connection()
    cart_items = conn.execute("""
        SELECT c.id as cart_item_id, p.*
        FROM cart c 
        JOIN products p ON c.product_id = p.id 
        WHERE c.customer_email = ?
    """, (email,)).fetchall()
    conn.close()
    return [dict(row) for row in cart_items]

@app.post("/api/cart/add")
def add_to_cart(request: CartAddRequest):
    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO cart (customer_email, product_id)
        VALUES (?, ?)
    """, (request.customer_email, request.product_id))
    conn.commit()
    conn.close()
    return {"status": "success"}

@app.post("/api/cart/clear")
def clear_cart(request: CartClearRequest):
    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM cart WHERE customer_email = ?", (request.customer_email,))
    conn.commit()
    conn.close()
    return {"status": "success"}

@app.post("/api/orders/create")
def create_order(request: OrderCreateRequest):
    conn = database.get_db_connection()
    cursor = conn.cursor()
    order_id = f"ORD-{1050 + cursor.execute('SELECT COUNT(*) FROM orders').fetchone()[0]}"
    today = datetime.date.today().strftime("%Y-%m-%d")
    delivery = (datetime.date.today() + datetime.timedelta(days=2)).strftime("%Y-%m-%d")
    
    cursor.execute("""
        INSERT INTO orders (id, customer_email, product_id, order_date, delivery_date, status)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (order_id, request.customer_email, request.product_id, today, delivery, "In Transit"))
    conn.commit()
    conn.close()
    return {"status": "success", "order_id": order_id}

# ===== CHAT SESSION & MESSAGE ENDPOINTS =====

@app.get("/api/chat/sessions/{email}")
def get_chat_sessions(email: str):
    conn = database.get_db_connection()
    sessions = conn.execute(
        "SELECT * FROM chat_sessions WHERE customer_email = ? ORDER BY created_at DESC",
        (email,)
    ).fetchall()
    conn.close()
    return [dict(s) for s in sessions]

@app.post("/api/chat/sessions/create")
def create_chat_session(request: NewSessionRequest):
    session_id = str(uuid.uuid4())
    now = datetime.datetime.now().isoformat()
    title = request.title or "New Conversation"
    conn = database.get_db_connection()
    conn.execute(
        "INSERT INTO chat_sessions (id, customer_email, title, created_at) VALUES (?, ?, ?, ?)",
        (session_id, request.customer_email, title, now)
    )
    # Insert the initial greeting message
    conn.execute(
        "INSERT INTO chat_messages (session_id, sender, text, created_at) VALUES (?, ?, ?, ?)",
        (session_id, "agent", "Hi there! I'm KITE, Aster Market's autonomous resolution agent. I can help you with returns, replacements, order tracking, and more. How can I help you today?", now)
    )
    conn.commit()
    conn.close()
    return {"session_id": session_id, "title": title, "created_at": now}

@app.delete("/api/chat/sessions/{session_id}")
def delete_chat_session(session_id: str):
    conn = database.get_db_connection()
    conn.execute("DELETE FROM chat_messages WHERE session_id = ?", (session_id,))
    conn.execute("DELETE FROM chat_sessions WHERE id = ?", (session_id,))
    conn.commit()
    conn.close()
    return {"status": "deleted"}

@app.get("/api/chat/messages/{session_id}")
def get_chat_messages(session_id: str):
    conn = database.get_db_connection()
    messages = conn.execute(
        "SELECT * FROM chat_messages WHERE session_id = ? ORDER BY id ASC",
        (session_id,)
    ).fetchall()
    conn.close()
    return [dict(m) for m in messages]

def analyze_image_with_vision(image_base64: str, complaint_text: str) -> str:
    llm = ChatGroq(model_name="llama-3.2-11b-vision-preview", temperature=0)
    msg = HumanMessage(
        content=[
            {"type": "text", "text": f"Analyze this image based on the user complaint: '{complaint_text}'. Does the image match the complaint? Is the damage visible? Provide a concise summary of what you see in the image."},
            {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_base64}"}}
        ]
    )
    try:
        res = llm.invoke([msg])
        return res.content
    except Exception as e:
        return f"Failed to analyze image: {str(e)}"

@app.post("/api/chat")
def chat(request: ChatRequest):
    conn = database.get_db_connection()
    now = datetime.datetime.now().isoformat()
    
    vision_analysis = None
    if request.image_base64:
        vision_analysis = analyze_image_with_vision(request.image_base64, request.message)

    # 1. Save the user's message
    conn.execute(
        "INSERT INTO chat_messages (session_id, sender, text, image_data, vision_analysis, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        (request.session_id, "user", request.message, request.image_base64, vision_analysis, now)
    )
    conn.commit()

    # 2. Load the FULL conversation history for this session
    rows = conn.execute(
        "SELECT sender, text, vision_analysis FROM chat_messages WHERE session_id = ? ORDER BY id ASC",
        (request.session_id,)
    ).fetchall()

    # 3. Convert to LangChain message objects for the agent
    lc_messages = []
    for row in rows:
        if row["sender"] == "user":
            content = row["text"]
            if row["vision_analysis"]:
                content += f"\n\n[SYSTEM: The user attached an image. Image Analysis Vision Model Result: {row['vision_analysis']}]"
            lc_messages.append(HumanMessage(content=content))
        elif row["sender"] == "agent":
            lc_messages.append(AIMessage(content=row["text"]))
        # skip tool messages – the agent will re-derive them

    # 4. Invoke LangGraph agent with the full conversation history
    try:
        result = kite_agent.invoke({"messages": lc_messages})
        final_messages = result["messages"]

        # The agent may have produced multiple messages (tool calls + final response).
        # We only want the last AIMessage that has actual text content.
        agent_text = ""
        is_action_card = False
        action_status = None
        action_details = None

        for msg in reversed(final_messages):
            if hasattr(msg, "content") and msg.content and not getattr(msg, "tool_calls", None):
                # Check if this is a tool response containing ACTION_CARD
                if hasattr(msg, "name") and msg.content.startswith("ACTION_CARD|"):
                    parts = msg.content.split("|", 2)
                    is_action_card = True
                    action_status = parts[1] if len(parts) > 1 else "approved"
                    action_details = parts[2] if len(parts) > 2 else ""
                    continue  # keep looking for the AI's text response
                agent_text = msg.content
                break

        # Also check tool messages for ACTION_CARD if we haven't found one yet
        if not is_action_card:
            for msg in final_messages:
                if hasattr(msg, "name") and hasattr(msg, "content") and isinstance(msg.content, str) and msg.content.startswith("ACTION_CARD|"):
                    parts = msg.content.split("|", 2)
                    is_action_card = True
                    action_status = parts[1] if len(parts) > 1 else "approved"
                    action_details = parts[2] if len(parts) > 2 else ""

        if not agent_text:
            agent_text = "I'm processing your request. Could you give me a moment?"

    except Exception as e:
        print(f"Agent error: {e}")
        agent_text = "I'm sorry, I encountered an issue processing your request. Please try again."
        is_action_card = False
        action_status = None
        action_details = None

    # 5. Save the agent's response
    now2 = datetime.datetime.now().isoformat()
    conn.execute(
        "INSERT INTO chat_messages (session_id, sender, text, is_action_card, action_status, action_details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (request.session_id, "agent", agent_text, is_action_card, action_status, action_details, now2)
    )
    conn.commit()

    # 6. Auto-update the session title from the first user message
    session = conn.execute("SELECT title FROM chat_sessions WHERE id = ?", (request.session_id,)).fetchone()
    if session and session["title"] == "New Conversation":
        title = request.message[:40] + ("..." if len(request.message) > 40 else "")
        conn.execute("UPDATE chat_sessions SET title = ? WHERE id = ?", (title, request.session_id))
        conn.commit()

    conn.close()

    return {
        "text": agent_text,
        "is_action_card": is_action_card,
        "action_status": action_status,
        "action_details": action_details
    }

@app.get("/api/policies")
def get_policies():
    conn = database.get_db_connection()
    policies = conn.execute("SELECT * FROM policies").fetchall()
    conn.close()
    return [dict(p) for p in policies]

@app.get("/api/inventory")
def get_inventory():
    conn = database.get_db_connection()
    inventory = conn.execute("SELECT id, name, category, price, inventory FROM products").fetchall()
    conn.close()
    return [dict(i) for i in inventory]

class ResolveClaimRequest(BaseModel):
    action: str
    details: str

@app.get("/api/claims")
def get_claims():
    conn = database.get_db_connection()
    claims = conn.execute("SELECT * FROM claims ORDER BY id DESC").fetchall()
    conn.close()
    return [dict(c) for c in claims]

@app.post("/api/manager/claims/{claim_id}/resolve")
def resolve_claim(claim_id: int, request: ResolveClaimRequest):
    conn = database.get_db_connection()
    conn.execute(
        "UPDATE claims SET status = ?, resolution = ? WHERE id = ?",
        (request.action, request.details, claim_id)
    )
    conn.commit()
    conn.close()
    return {"status": "success"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
