#!/usr/bin/env python3
import sys
import json
import os

def validate_state(state_path):
    if not os.path.exists(state_path):
        print(f"Error: State file not found at {state_path}")
        return False

    try:
        with open(state_path, 'r', encoding='utf-8') as f:
            state = json.load(f)
    except json.JSONDecodeError as e:
        print(f"Error: Failed to parse JSON: {e}")
        return False

    required_keys = ["workflowId", "slug", "status", "currentStep", "completedSteps", "stepLlms", "stepHistory", "context", "localMemory", "checkpoints"]
    missing = [key for key in required_keys if key not in state]
    if missing:
        print(f"Error: Missing required keys: {missing}")
        return False

    status = state.get("status")
    if status not in ["active", "completed", "cancelled"]:
        print(f"Error: Invalid workflow status: {status}")
        return False

    current_step = state.get("currentStep")
    if not (0 <= current_step <= 6):
        print(f"Error: currentStep {current_step} out of bounds [0, 6]")
        return False

    completed_steps = state.get("completedSteps", [])
    for step in completed_steps:
        if not (0 <= step <= 6):
            print(f"Error: Invalid completed step: {step}")
            return False

    step_llms = state.get("stepLlms", {})
    valid_models = ["gemini-3.5-thinking", "gemini-3.5-coder", "gemini-3.5-flash"]
    for step, model in step_llms.items():
        if model not in valid_models:
            print(f"Warning: Model '{model}' for step {step} is not in standard list {valid_models}")

    print("Success: State schema and transitions are valid.")
    return True

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python validate_orchestration.py <path_to_state.json>")
        sys.exit(1)
    
    success = validate_state(sys.argv[1])
    sys.exit(0 if success else 1)
