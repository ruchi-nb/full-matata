#!/usr/bin/env python3
import sqlite3
from service.analytics_service import analytics_aggregation as api_analyzer

def check_database_analytics():
    try:
        conn = sqlite3.connect(api_analyzer.db_path)
        cursor = conn.cursor()
        
        print("🔍 Database Analytics Check:")
        print("=" * 50)
        
        # Get all API types and operations
        cursor.execute('''
            SELECT api_type, operation, COUNT(*) as count, 
                   SUM(cost_usd) as total_cost_usd,
                   AVG(latency_ms) as avg_latency_ms,
                   AVG(accuracy_score) as avg_accuracy
            FROM api_metrics 
            WHERE timestamp >= datetime('now', '-1 hour')
            GROUP BY api_type, operation
            ORDER BY api_type, operation
        ''')
        
        results = cursor.fetchall()
        
        print("📊 API Usage Summary (Last 1 Hour):")
        for row in results:
            api_type, operation, count, cost_usd, latency_ms, accuracy = row
            print(f"  {api_type} - {operation}: {count} requests, ${cost_usd:.4f} USD, {latency_ms:.0f}ms latency, {accuracy:.3f} accuracy")
        
        # Get language breakdown
        cursor.execute('''
            SELECT language, COUNT(*) as count, 
                   AVG(latency_ms) as avg_latency_ms,
                   SUM(cost_usd) as total_cost_usd
            FROM api_metrics 
            WHERE timestamp >= datetime('now', '-1 hour')
            AND language IS NOT NULL
            GROUP BY language
            ORDER BY count DESC
        ''')
        
        lang_results = cursor.fetchall()
        
        print("\n🌍 Language Usage:")
        for row in lang_results:
            language, count, latency_ms, cost_usd = row
            print(f"  {language}: {count} requests, {latency_ms:.0f}ms latency, ${cost_usd:.4f} USD")
        
        # Get recent requests
        cursor.execute('''
            SELECT api_type, operation, language, latency_ms, cost_usd, accuracy_score, 
                   medical_terms_count, timestamp
            FROM api_metrics 
            WHERE timestamp >= datetime('now', '-1 hour')
            ORDER BY timestamp DESC
            LIMIT 10
        ''')
        
        recent_results = cursor.fetchall()
        
        print("\n📋 Recent Requests (Last 10):")
        for row in recent_results:
            api_type, operation, language, latency_ms, cost_usd, accuracy, medical_terms, timestamp = row
            print(f"  {timestamp} | {api_type} - {operation} | {language} | {latency_ms}ms | ${cost_usd:.4f} | {accuracy:.3f} acc | {medical_terms} med")
        
        conn.close()
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_database_analytics()
