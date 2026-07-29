# KITE: An Agentic Post-Purchase Resolution Platform for E-commerce

**KITE** (Knowledge-guided Issue Triage and Execution) converts customer complaints into completed resolutions—not support tickets.

KITE is an autonomous after-sales agent that investigates customer complaints, analyses visual evidence, verifies order and policy data, and executes refunds, replacements, repairs, or escalations in minutes.

To demonstrate KITE in a realistic environment, we built **Aster Market**, a simulated e-commerce environment to demonstrate how KITE can integrate with any retailer and transform a customer complaint into a completed resolution. 

## The Problem
Post-purchase complaints require manual checks across orders, policies, images, inventory, and logistics. Slow and inconsistent resolutions increase support costs, refund leakage, and customer churn. Existing chatbots and return portals struggle with evidence-heavy exceptions such as damaged, defective, missing or incorrect items.

## The Solution
KITE sees the issue, checks the facts, and completes the resolution:
1. **Multimodal complaint and image investigation**: Understands the claim text and photos, then verifies the customer, order, and product.
2. **Policy, eligibility, inventory and risk decision engine**: Makes a policy-safe decision checking the return window, warranty, inventory, value, history, and risk rules.
3. **Automated actions with human approval**: Completes the action (initiates/simulates refund, replacement, repair, pickup) and escalates uncertain or high-value cases.

## Sustainable Development Goals (SDGs)

KITE aligns with and supports the following UN Sustainable Development Goals:

*   **Goal 9: Industry, Innovation and Infrastructure**
    By leveraging advanced LLMs and multimodal AI to automate complex after-sales workflows, KITE represents a significant innovation in enterprise customer service infrastructure. It upgrades technological capabilities for e-commerce businesses, making their operations more resilient and efficient.
*   **Goal 12: Responsible Consumption and Production**
    KITE promotes sustainable consumption by accurately triaging product issues. By correctly identifying whether a product needs a simple repair, a replacement part, or a full refund, it reduces unnecessary logistics, prevents usable items from being prematurely discarded, and optimizes the reverse supply chain.
*   **Goal 8: Decent Work and Economic Growth**
    By automating repetitive and emotionally taxing customer complaint resolution tasks, KITE frees human support agents to focus on complex, high-value problem solving. This improves the quality of work for customer service representatives while increasing economic productivity for businesses.

## Architecture

*   **Aster Market (Frontend):** A React-based e-commerce UI simulating a customer's shopping and order management experience.
*   **KITE Agent (Backend):** A FastAPI server orchestrating a LangGraph workflow that utilizes multimodal AI (Gemini/Groq) for evidence analysis, integrated with a local SQLite database for mock orders, inventory, and policies.

## Setup Instructions

*(Detailed setup instructions will be added here)*
