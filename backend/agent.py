import os
from typing import Annotated, Literal
from typing_extensions import TypedDict
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from langchain_groq import ChatGroq
from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage, ToolMessage
from langchain_core.tools import tool
import datetime
import database
import json
from dotenv import load_dotenv

load_dotenv()

class AgentState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]

@tool
def get_order_status(order_id: str) -> str:
    """Get the details and status of an order by its ID (e.g. ORD-1050)."""
    conn = database.get_db_connection()
    order = conn.execute("""
        SELECT o.delivery_date, o.status, p.price, p.name, p.id as product_id
        FROM orders o JOIN products p ON o.product_id = p.id 
        WHERE o.id = ?
    """, (order_id,)).fetchone()
    conn.close()
    
    if not order:
        return "Order not found. Ask the user to verify the order ID."
        
    return f"Product: {order['name']}, Product ID: {order['product_id']}, Price: ${order['price']}, Status: {order['status']}, Delivered Date: {order['delivery_date']}. Today's date is {datetime.date.today().strftime('%Y-%m-%d')}."

@tool
def check_inventory(product_id: int) -> str:
    """Check if a product is in stock by its Product ID."""
    conn = database.get_db_connection()
    product = conn.execute("SELECT inventory FROM products WHERE id = ?", (product_id,)).fetchone()
    conn.close()
    if not product:
        return "Product not found."
    if product['inventory'] > 0:
        return "In stock. A replacement can be offered."
    else:
        return "Out of stock. A replacement CANNOT be offered, you must offer a full refund or store credit instead."

@tool
def check_policy_eligibility(product_id: int, delivery_date_str: str) -> str:
    """Check if a claim is within the return policy based on the product category and delivery date. Pass product_id and delivery date (YYYY-MM-DD)."""
    try:
        conn = database.get_db_connection()
        policy_info = conn.execute("""
            SELECT po.return_window_days 
            FROM products pr
            JOIN policies po ON pr.category = po.category
            WHERE pr.id = ?
        """, (product_id,)).fetchone()
        conn.close()

        if not policy_info:
            return "Policy not found for this product category."

        return_window = policy_info['return_window_days']
        delivery_date = datetime.datetime.strptime(delivery_date_str, "%Y-%m-%d").date()
        today = datetime.date.today()
        days_passed = (today - delivery_date).days
        
        if days_passed <= return_window:
            return f"Eligible for return/replacement (delivered {days_passed} days ago, window is {return_window} days)."
        else:
            return f"NOT eligible for return/replacement (delivered {days_passed} days ago, window is {return_window} days). Must reject the claim."
    except Exception as e:
        return f"Error checking policy: {str(e)}"

@tool
def finalize_resolution(order_id: str, complaint_text: str, action: str, details: str) -> str:
    """Finalize the resolution for a claim. 
    'action' must be 'approved_refund', 'approved_replacement', 'rejected', or 'human_review'.
    'details' should be a friendly explanation of the outcome.
    'complaint_text' should be a short summary of what the user claimed was wrong.
    """
    conn = database.get_db_connection()
    conn.execute(
        "INSERT INTO claims (order_id, complaint_text, status, resolution, created_at) VALUES (?, ?, ?, ?, ?)",
        (order_id, complaint_text, action, details, datetime.datetime.now().isoformat())
    )
    conn.commit()
    conn.close()
    
    return f"ACTION_CARD|{action}|{details}"

@tool
def evaluate_fraud_and_consistency(order_id: str, complaint_text: str) -> str:
    """Evaluate if the claim is fraudulent, high-risk, or inconsistent. Must be called before finalizing any return or replacement.
    Pass the order_id and the full complaint_text (including any vision analysis from the user).
    Returns a JSON string indicating if it is safe to proceed autonomously."""
    conn = database.get_db_connection()
    
    order = conn.execute("SELECT o.customer_email, p.price, p.name FROM orders o JOIN products p ON o.product_id = p.id WHERE o.id = ?", (order_id,)).fetchone()
    if not order:
        conn.close()
        return json.dumps({"is_safe": False, "reason": "Order not found."})
        
    email = order['customer_email']
    price = order['price']
    product_name = order['name']
    
    claim_count = conn.execute("SELECT COUNT(*) FROM claims c JOIN orders o ON c.order_id = o.id WHERE o.customer_email = ?", (email,)).fetchone()[0]
    conn.close()
    
    flags = []
    if price > 500:
        flags.append("HIGH_VALUE_ITEM")
    if claim_count >= 2:
        flags.append("FREQUENT_CLAIMS")
        
    llm = ChatGroq(model_name="qwen/qwen3.8-27b", temperature=0, max_tokens=10, reasoning_effort="none")
    prompt = f"Does this complaint/evidence: '{complaint_text}' make sense for the product: '{product_name}'? Respond with only 'YES' or 'NO'."
    try:
        consistency = llm.invoke([HumanMessage(content=prompt)]).content.strip().upper()
        if 'NO' in consistency:
            flags.append("INCONSISTENT_EVIDENCE")
    except:
        pass
        
    if flags:
        return json.dumps({"is_safe": False, "flags": flags, "instruction": "You MUST use finalize_resolution with action='pending_human_review' and detail the flags in the details parameter."})
    else:
        return json.dumps({"is_safe": True, "instruction": "You may proceed with autonomous resolution."})

tools = [get_order_status, finalize_resolution, check_inventory, check_policy_eligibility, evaluate_fraud_and_consistency]

def call_model(state: AgentState):
    llm = ChatGroq(model_name="qwen/qwen3.8-27b", temperature=0, max_tokens=512, reasoning_effort="none")
    llm_with_tools = llm.bind_tools(tools)
    
    sys_msg = SystemMessage(content=(
        "You are KITE, the autonomous resolution agent for Aster Market. "
        "Your goal is to help customers with their orders, specifically returns and replacements. "
        "Rules:\n"
        "1. Be polite and concise. If you need an order ID, ask for it.\n"
        "2. Once you have an order ID, use get_order_status to check its details.\n"
        "3. CRITICAL: If get_order_status shows the status is 'In Transit', you MUST inform the user that they cannot request a return, refund, or replacement until the item is delivered. Do NOT call check_policy_eligibility or finalize_resolution in this case.\n"
        "4. You MUST use check_policy_eligibility (pass product_id and delivery_date) to determine if the order is within the policy window.\n"
        "5. If they request a replacement and are eligible, use check_inventory first. If out of stock, offer a refund instead.\n"
        "6. CRITICAL: Before using finalize_resolution for any return or replacement, you MUST use evaluate_fraud_and_consistency to check for risk flags. If it says is_safe=False, you MUST set action='pending_human_review'.\n"
        "7. Ask clarifying questions if you need to know why they are returning it.\n"
        "8. Once you have all info, verified eligibility, and passed the fraud check, use finalize_resolution to approve or reject the claim. 'action' must be 'approved_refund', 'approved_replacement', 'rejected', or 'pending_human_review'. Include a short complaint_text summary.\n"
        "9. NEVER output ACTION_CARD text directly in your message. ONLY use the finalize_resolution tool to do that.\n"
        "10. CRITICAL: Never explain your internal tool calls or reasoning to the user. Do not say things like 'I will use the get_order_status tool'. Just execute the tools silently and respond naturally."
    ))
    
    response = llm_with_tools.invoke([sys_msg] + state["messages"])
    return {"messages": [response]}

def tool_node(state: AgentState):
    """Executes the tools requested by the LLM."""
    last_message = state["messages"][-1]
    tool_responses = []
    
    for tool_call in last_message.tool_calls:
        tool_name = tool_call["name"]
        tool_args = tool_call["args"]
        
        if tool_name == "get_order_status":
            result = get_order_status.invoke(tool_args)
        elif tool_name == "finalize_resolution":
            result = finalize_resolution.invoke(tool_args)
        elif tool_name == "check_inventory":
            result = check_inventory.invoke(tool_args)
        elif tool_name == "check_policy_eligibility":
            result = check_policy_eligibility.invoke(tool_args)
        elif tool_name == "evaluate_fraud_and_consistency":
            result = evaluate_fraud_and_consistency.invoke(tool_args)
        else:
            result = "Unknown tool."
            
        tool_responses.append(
            ToolMessage(
                content=str(result),
                name=tool_name,
                tool_call_id=tool_call["id"]
            )
        )
        
    return {"messages": tool_responses}

def should_continue(state: AgentState) -> Literal["tools", END]:
    last_message = state["messages"][-1]
    if last_message.tool_calls:
        return "tools"
    return END

# Build the Graph
workflow = StateGraph(AgentState)

workflow.add_node("agent", call_model)
workflow.add_node("tools", tool_node)

workflow.add_edge(START, "agent")
workflow.add_conditional_edges("agent", should_continue)
workflow.add_edge("tools", "agent")

kite_agent = workflow.compile()
