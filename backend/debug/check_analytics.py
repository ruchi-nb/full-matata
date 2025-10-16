#!/usr/bin/env python3
import requests
import json

def check_analytics():
    try:
        r = requests.get('http://localhost:8000/api/v1/analytics/comprehensive?hours=1')
        data = r.json()
        
        print("🔍 Current Analytics Data:")
        print("=" * 50)
        
        print(f"📊 Total Requests: {data['data']['summary']['total_requests']}")
        print(f"💰 Total Cost: ${data['data']['summary']['total_cost_usd']:.4f} USD (₹{data['data']['summary']['total_cost_inr']:.2f})")
        print(f"⚡ Avg Latency: {data['data']['summary']['avg_latency_ms']:.0f}ms")
        print(f"🎯 Avg Accuracy: {data['data']['summary']['avg_accuracy']:.3f}")
        print(f"🏥 Medical Terms: {data['data']['summary']['total_medical_terms']}")
        
        print("\n📈 API Breakdown:")
        for item in data['data']['api_breakdown']:
            print(f"  {item['api_type']} - {item['operation']}: {item['requests']} requests, ${item['cost_usd']:.4f} USD, {item['avg_latency_ms']:.0f}ms latency")
        
        print("\n🌍 Language Breakdown:")
        for item in data['data']['language_breakdown']:
            print(f"  {item['language']}: {item['requests']} requests, {item['avg_latency_ms']:.0f}ms latency, ${item['cost_usd']:.4f} USD")
        
        print("\n🔧 Operation Breakdown:")
        for item in data['data']['operation_breakdown']:
            print(f"  {item['api_type']} - {item['operation']}: {item['requests']} requests, ${item['cost_usd']:.4f} USD, {item['avg_latency_ms']:.0f}ms latency")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_analytics()
