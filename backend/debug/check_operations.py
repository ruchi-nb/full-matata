#!/usr/bin/env python3
from service.analytics_service import analytics_aggregation as api_analyzer

def check_operations():
    data = api_analyzer.get_comprehensive_analytics(hours=1)
    
    print("🔍 Operation Breakdown for Latency Chart:")
    print("=" * 50)
    
    for op in data['operation_breakdown']:
        print(f"  {op['api_type']} - {op['operation']}: {op['requests']} requests, {op['avg_latency_ms']:.0f}ms latency")
    
    print(f"\nTotal operations: {len(data['operation_breakdown'])}")
    
    # Check if we have all expected operations
    expected_ops = [
        ('openai', 'llm'),
        ('deepgram', 'stt'),
        ('deepgram', 'tts'),
        ('sarvam', 'stt'),
        ('sarvam', 'tts'),
        ('sarvam', 'translate')
    ]
    
    found_ops = [(op['api_type'], op['operation']) for op in data['operation_breakdown']]
    
    print("\n✅ Expected vs Found Operations:")
    for expected in expected_ops:
        if expected in found_ops:
            print(f"  ✅ {expected[0]} - {expected[1]}")
        else:
            print(f"  ❌ {expected[0]} - {expected[1]} (MISSING)")

if __name__ == "__main__":
    check_operations()
