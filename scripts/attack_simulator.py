import json
import os
import time
import sys

def main():
    # Path to the reputation file on the primary node (5000)
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    rep_file = os.path.join(root_dir, "backend", "data_5000", "reputation.json")
    
    print("================================================")
    print("      🔥 POR-CHAIN ATTACK SIMULATOR 🔥         ")
    print("================================================")
    print(f"Targeting: {rep_file}")
    print("\nWaiting for nodes to initialize...")
    
    # Wait until the file exists
    while not os.path.exists(rep_file):
        time.sleep(1)
    
    print("\n[READY] The network is live.")
    print("This script will simulate a 'Reputation Pump' attack by")
    print("artificially inflating a guest node's reputation to 0.99.")
    
    input("\nPRESS [ENTER] TO LAUNCH THE ATTACK...")
    
    try:
        with open(rep_file, "r") as f:
            data = json.load(f)
        
        # Find a node that is NOT at 1.0 (the bootstrap nodes)
        target_node = None
        for node_id, score in data.items():
            if score < 0.5:
                target_node = node_id
                break
        
        if not target_node:
            print("❌ Error: No guest nodes found in the registry to attack.")
            return

        print(f"🚀 Attacking Node: {target_node[:16]}...")
        print(f"   Current Score: {data[target_node]}")
        
        # Perform the "Pump"
        data[target_node] = 0.99
        
        with open(rep_file, "w") as f:
            json.dump(data, f, indent=2)
            
        print("\n✅ ATTACK COMPLETE: Reputation pumped to 0.99")
        print("Watch the ML Oracle terminal to see the detection and ban!")
        
    except Exception as e:
        print(f"❌ Attack Failed: {e}")

    input("\nPress Enter to exit...")

if __name__ == "__main__":
    main()
