# KITE Agent: Advanced Capabilities Roadmap

This document outlines the step-by-step agentic capabilities we will build into the KITE LangGraph agent. We will tackle these one by one to transform KITE from a simple rule-based router into a fully autonomous, reasoning customer service representative. The architecture explicitly separates LLM reasoning from deterministic business logic, as outlined in the KITE Lean Canvas.

## Phase 1: Conversational Memory & Multi-turn Dialogue (✅ COMPLETED)
KITE previously acted in a single-shot manner. We have successfully implemented LangGraph's state memory so KITE can maintain a back-and-forth conversation, ask clarifying questions before deciding, and persist chat sessions.
- **Agentic Capability:** Asking clarifying questions and context retention.
- **Implementation:** Added a `messages` array to the LangGraph state and use SQLite to persist chat history.

## Phase 2: Deterministic Tool Execution (Inventory & Policies)
The LLM should not independently decide if 7 days have passed or if an item is in stock. We will build robust Python-based tools for these checks.
- **Agentic Capability:** Accurate environment interaction and deterministic business logic.
- **Implementation:** KITE will use tools like `check_inventory`, `verify_order`, and `check_policy_eligibility`. If a replacement is out of stock, KITE will pivot and offer a full refund. The LLM will strictly use the boolean/structured returns from these Python tools rather than attempting to calculate dates or stock itself.

## Phase 3: Vision LLM Integration (Multimodal Damage Analysis)
When a user claims an item arrived damaged, they must provide photographic evidence.
- **Agentic Capability:** Multimodal visual reasoning and structured data extraction.
- **Implementation:** Add an image upload button to the chat. KITE will use a Vision model (Gemini Flash/Flash-Lite) to analyze the image. It will return a structured JSON (e.g., `damage_visible: true`, `damage_type: "cracked screen"`, `confidence: 0.9`). If the image is blurry or irrelevant, KITE will ask for a better photo before proceeding.

## Phase 4: Complaint-Evidence Consistency & Fraud Checks
A customer might claim a TV is broken, but upload a photo of a toaster. We need a consistency layer.
- **Agentic Capability:** Cross-referencing evidence and logical deduction.
- **Implementation:** Add a LangGraph node that compares the original complaint text, the ordered product details, and the visual evidence from Phase 3. It will flag inconsistencies or suspicious patterns (e.g., 4 claims in a month) for human review.

## Phase 5: Risk-Aware Execution & Human-in-the-Loop Approval
Not all issues can be safely solved autonomously.
- **Agentic Capability:** Self-awareness, confidence calibration, and human-in-the-loop orchestration.
- **Implementation:** Add a LangGraph routing node. If the evidence confidence is low, the item value is very high (e.g., > ₹10,000), or there's a fraud flag, KITE will pause execution and route the case to a "Human Manager Dashboard" state. The manager will see the complaint, the image, KITE's reasoning, and can approve, modify, or reject the action.
