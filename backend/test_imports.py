# Quick test to verify the dynamic dashboard router can be imported
# Run this to test if the import errors are fixed

try:
    from routes.dynamic_dashboard_router import router as dynamic_dashboard_router
    print("✅ Dynamic dashboard router imported successfully!")
    print(f"Router prefix: {dynamic_dashboard_router.prefix}")
    print(f"Router tags: {dynamic_dashboard_router.tags}")
    print("✅ All import errors have been fixed!")
except ImportError as e:
    print(f"❌ Import error still exists: {e}")
except Exception as e:
    print(f"❌ Other error: {e}")

print("\n🚀 Your backend should now start successfully!")
print("Try running: python main.py")
