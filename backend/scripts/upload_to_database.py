"""
Hotel Contract Data - Bulk Upload to MySQL Database

This script reads Excel files generated from hotel contracts and uploads
the data to the MySQL database tables.

Usage:
    python upload_to_database.py <excel_files_folder>
    
Example:
    python upload_to_database.py ./output/session_123

Requirements:
    pip install pandas sqlalchemy pymysql openpyxl
"""

import pandas as pd
from sqlalchemy import create_engine
import time
import os
import sys

# Database Configuration
DB_CONFIG = {
    'host': '35.197.143.222',
    'port': 3306,
    'user': 'root',
    'password': "&l+>XV7=Q@iF&B9",
    'database': 'production_test5'
}

# Create database URL
database_url = f"mysql+pymysql://{DB_CONFIG['user']}:{DB_CONFIG['password']}@{DB_CONFIG['host']}:{DB_CONFIG['port']}/{DB_CONFIG['database']}"

# Table mapping: Excel filename -> Database table name
TABLE_MAPPING = {
    'hotels.xlsx': 'hotels',
    'hotel_details.xlsx': 'hotel_details',
    'hotel_room_categories.xlsx': 'hotel_room_categories',
    'hotel_room_types.xlsx': 'hotel_room_types',
    'hotel_room_rates.xlsx': 'hotel_room_rates',
    'hotel_terms_conditions.xlsx': 'hotel_terms_conditions',
    'hotel_room_inventories.xlsx': 'hotel_room_inventories',
    'hotel_room_daily_inventories.xlsx': 'hotel_room_daily_inventories'
}

# Upload order (respects foreign key relationships)
UPLOAD_ORDER = [
    'hotels.xlsx',
    'hotel_details.xlsx',
    'hotel_room_categories.xlsx',
    'hotel_room_types.xlsx',
    'hotel_room_rates.xlsx',
    'hotel_terms_conditions.xlsx',
    'hotel_room_inventories.xlsx',
    'hotel_room_daily_inventories.xlsx'
]


def upload_excel_to_database(folder_path):
    """
    Upload all Excel files from a folder to the database.
    
    Args:
        folder_path: Path to folder containing Excel files
    """
    
    # Connect to database
    print("Connecting to database...")
    try:
        engine = create_engine(database_url, connect_args={'ssl': {'ssl_disabled': True}})
        # Test connection
        with engine.connect() as conn:
            print("✅ Connected to database successfully!")
    except Exception as e:
        print(f"❌ Failed to connect to database: {e}")
        return
    
    start_time = time.time()
    print(f"\n{'='*60}")
    print("Starting bulk upload process...")
    print(f"{'='*60}\n")
    
    successful_uploads = 0
    failed_uploads = 0
    
    for excel_file in UPLOAD_ORDER:
        file_path = os.path.join(folder_path, excel_file)
        
        if not os.path.exists(file_path):
            print(f"⚠️  {excel_file} - File not found, skipping...")
            continue
        
        table_name = TABLE_MAPPING.get(excel_file)
        if not table_name:
            print(f"⚠️  {excel_file} - No table mapping found, skipping...")
            continue
        
        try:
            print(f"📊 Processing {excel_file}...")
            
            # Read Excel file
            df = pd.read_excel(file_path)
            
            # Remove 'id' column if it exists (let database auto-generate)
            if 'id' in df.columns:
                df = df.drop(columns=['id'])
            
            # Remove empty columns
            df = df.dropna(axis=1, how='all')
            
            # Replace NaN with None for proper NULL handling
            df = df.where(pd.notnull(df), None)
            
            print(f"   Found {len(df)} rows, {len(df.columns)} columns")
            
            # Upload to database
            df.to_sql(
                name=table_name, 
                con=engine, 
                if_exists='append', 
                index=False,
                method='multi'  # Use multi-row insert for better performance
            )
            
            print(f"   ✅ Successfully inserted {len(df)} rows into '{table_name}'")
            successful_uploads += 1
            
        except Exception as e:
            print(f"   ❌ Error uploading {excel_file}: {e}")
            failed_uploads += 1
    
    end_time = time.time()
    execution_time = end_time - start_time
    
    print(f"\n{'='*60}")
    print("UPLOAD SUMMARY")
    print(f"{'='*60}")
    print(f"✅ Successful uploads: {successful_uploads}")
    print(f"❌ Failed uploads: {failed_uploads}")
    print(f"⏱️  Total time: {execution_time:.2f} seconds")
    print(f"{'='*60}\n")


def upload_single_file(file_path, table_name):
    """
    Upload a single Excel file to a specific table.
    
    Args:
        file_path: Path to the Excel file
        table_name: Name of the database table
    """
    print(f"Connecting to database...")
    engine = create_engine(database_url, connect_args={'ssl': {'ssl_disabled': True}})
    
    print(f"Reading {file_path}...")
    df = pd.read_excel(file_path)
    
    # Remove 'id' column if it exists
    if 'id' in df.columns:
        df = df.drop(columns=['id'])
    
    # Replace NaN with None
    df = df.where(pd.notnull(df), None)
    
    print(f"Uploading {len(df)} rows to '{table_name}'...")
    df.to_sql(name=table_name, con=engine, if_exists='append', index=False)
    
    print(f"✅ Done!")


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python upload_to_database.py <excel_files_folder>")
        print("       python upload_to_database.py <excel_file> <table_name>")
        print("\nExample:")
        print("  python upload_to_database.py ./output/session_123")
        print("  python upload_to_database.py hotels.xlsx hotels")
        sys.exit(1)
    
    if len(sys.argv) == 2:
        # Upload all files from folder
        folder_path = sys.argv[1]
        if not os.path.isdir(folder_path):
            print(f"❌ Error: '{folder_path}' is not a valid directory")
            sys.exit(1)
        upload_excel_to_database(folder_path)
    
    elif len(sys.argv) == 3:
        # Upload single file
        file_path = sys.argv[1]
        table_name = sys.argv[2]
        if not os.path.isfile(file_path):
            print(f"❌ Error: '{file_path}' is not a valid file")
            sys.exit(1)
        upload_single_file(file_path, table_name)
