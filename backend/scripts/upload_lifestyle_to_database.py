"""
Lifestyle Product Data - Bulk Upload to MySQL Database with FK Mapping

This script reads Excel files generated from lifestyle/attraction documents and uploads
the data to the MySQL database tables with proper foreign key relationships.

Upload Order (respects FK relationships):
1. tbl_lifestyle -> Get lifestyle_id (auto-increment)
2. tbl_lifestyle_detail -> Uses lifestyle_id from step 1
3. tbl_lifestyle_rates -> Get lifestyle_rate_id (auto-increment), uses lifestyle_id from step 1
4. life_style_rates_packages -> Uses lifestyle_rate_id from step 3 (as rate_id)
5. tbl_lifestyle_inventory -> Uses lifestyle_id from step 1 and lifestyle_rate_id from step 3 (as rate_id)
6. tbl_lifestyle_terms_and_conditions -> Uses lifestyle_id from step 1

Usage:
    python upload_lifestyle_to_database.py <excel_files_folder>
    
Example:
    python upload_lifestyle_to_database.py ./lifestyle_output/session_123

Requirements:
    pip install pandas sqlalchemy pymysql openpyxl
"""

import pandas as pd
from sqlalchemy import create_engine, text
import time
import os
import sys
import urllib.parse

# Database Configuration
DB_CONFIG = {
    'host': '35.197.143.222',
    'port': 3306,
    'user': 'root',
    'password': "&l+>XV7=Q@iF&B9",
    'database': 'production_test5'
}

# URL encode the password to handle special characters
encoded_password = urllib.parse.quote_plus(DB_CONFIG['password'])

# Create database URL
database_url = f"mysql+pymysql://{DB_CONFIG['user']}:{encoded_password}@{DB_CONFIG['host']}:{DB_CONFIG['port']}/{DB_CONFIG['database']}"

# Table mapping: Excel filename -> Database table name
TABLE_MAPPING = {
    'tbl_lifestyle.xlsx': 'tbl_lifestyle',
    'tbl_lifestyle_detail.xlsx': 'tbl_lifestyle_detail',
    'tbl_lifestyle_rates.xlsx': 'tbl_lifestyle_rates',
    'life_style_rates_packages.xlsx': 'life_style_rates_packages',
    'tbl_lifestyle_inventory.xlsx': 'tbl_lifestyle_inventory',
    'tbl_lifestyle_terms_and_conditions.xlsx': 'tbl_lifestyle_terms_and_conditions'
}

# Auto-increment column names for each table
AUTO_INCREMENT_COLUMNS = {
    'tbl_lifestyle': 'lifestyle_id',
    'tbl_lifestyle_detail': 'lifestyle_detail_id',
    'tbl_lifestyle_rates': 'lifestyle_rate_id',
    'life_style_rates_packages': 'id',
    'tbl_lifestyle_inventory': 'lifestyle_inventory_id',
    'tbl_lifestyle_terms_and_conditions': 'termsncondition_id'
}

# Mapping columns (used for FK mapping, should be removed before insert)
MAPPING_COLUMNS = ['product_index', 'rate_index']


def remove_auto_increment_and_mapping_columns(df, table_name):
    """
    Remove auto-increment and mapping columns from DataFrame before database insert.
    
    Args:
        df: pandas DataFrame
        table_name: Name of the database table
    
    Returns:
        DataFrame with auto-increment and mapping columns removed
    """
    columns_to_remove = []
    
    # Remove auto-increment column if present
    auto_col = AUTO_INCREMENT_COLUMNS.get(table_name)
    if auto_col and auto_col in df.columns:
        columns_to_remove.append(auto_col)
    
    # Remove mapping columns (product_index, rate_index)
    for col in MAPPING_COLUMNS:
        if col in df.columns:
            columns_to_remove.append(col)
    
    if columns_to_remove:
        df = df.drop(columns=columns_to_remove)
    
    return df


def upload_lifestyle_data(folder_path):
    """
    Upload all lifestyle Excel files from a folder to the database with proper FK mapping.
    
    The upload follows these steps:
    1. Upload tbl_lifestyle -> get lifestyle_id for each product_index
    2. Upload tbl_lifestyle_detail with mapped lifestyle_id
    3. Upload tbl_lifestyle_rates -> get lifestyle_rate_id for each rate_index
    4. Upload life_style_rates_packages with mapped rate_id
    5. Upload tbl_lifestyle_inventory with mapped lifestyle_id and rate_id
    6. Upload tbl_lifestyle_terms_and_conditions with mapped lifestyle_id
    
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
    print(f"\n{'='*70}")
    print("Starting Lifestyle Data Bulk Upload with FK Mapping...")
    print(f"{'='*70}\n")
    
    # Mapping dictionaries to track auto-generated IDs
    # product_index -> lifestyle_id (from tbl_lifestyle)
    lifestyle_id_map = {}
    # rate_index -> lifestyle_rate_id (from tbl_lifestyle_rates)
    lifestyle_rate_id_map = {}
    
    successful_uploads = 0
    failed_uploads = 0
    
    # ========================================================================
    # STEP 1: Upload tbl_lifestyle and get lifestyle_id for each product
    # ========================================================================
    print("=" * 70)
    print("STEP 1: Uploading tbl_lifestyle (Main Table)")
    print("=" * 70)
    
    lifestyle_file = os.path.join(folder_path, 'tbl_lifestyle.xlsx')
    if os.path.exists(lifestyle_file):
        try:
            df_lifestyle = pd.read_excel(lifestyle_file)
            print(f"📊 Found {len(df_lifestyle)} lifestyle products")
            
            # Store product_index for mapping
            product_indices = df_lifestyle['product_index'].tolist() if 'product_index' in df_lifestyle.columns else list(range(len(df_lifestyle)))
            
            # Remove auto-increment and mapping columns
            df_lifestyle_clean = remove_auto_increment_and_mapping_columns(df_lifestyle.copy(), 'tbl_lifestyle')
            
            # Replace NaN with None
            df_lifestyle_clean = df_lifestyle_clean.where(pd.notnull(df_lifestyle_clean), None)
            
            # Insert each row individually to get the auto-generated ID
            for idx, (_, row) in enumerate(df_lifestyle_clean.iterrows()):
                row_dict = row.to_dict()
                # Remove None values for cleaner insert
                row_dict = {k: v for k, v in row_dict.items() if v is not None}
                
                columns = ', '.join(row_dict.keys())
                placeholders = ', '.join([f':{k}' for k in row_dict.keys()])
                insert_sql = f"INSERT INTO tbl_lifestyle ({columns}) VALUES ({placeholders})"
                
                with engine.connect() as conn:
                    result = conn.execute(text(insert_sql), row_dict)
                    conn.commit()
                    
                    # Get the auto-generated lifestyle_id
                    lifestyle_id = result.lastrowid
                    product_index = product_indices[idx]
                    lifestyle_id_map[product_index] = lifestyle_id
                    print(f"   ✅ Inserted product_index {product_index} -> lifestyle_id: {lifestyle_id}")
            
            print(f"   ✅ Successfully inserted {len(df_lifestyle)} rows into 'tbl_lifestyle'")
            print(f"   📋 Lifestyle ID Mapping: {lifestyle_id_map}")
            successful_uploads += 1
            
        except Exception as e:
            print(f"   ❌ Error uploading tbl_lifestyle: {e}")
            failed_uploads += 1
            return  # Cannot continue without lifestyle_id
    else:
        print(f"   ⚠️  tbl_lifestyle.xlsx not found!")
        return
    
    # ========================================================================
    # STEP 2: Upload tbl_lifestyle_detail with mapped lifestyle_id
    # ========================================================================
    print("\n" + "=" * 70)
    print("STEP 2: Uploading tbl_lifestyle_detail")
    print("=" * 70)
    
    detail_file = os.path.join(folder_path, 'tbl_lifestyle_detail.xlsx')
    if os.path.exists(detail_file):
        try:
            df_detail = pd.read_excel(detail_file)
            print(f"📊 Found {len(df_detail)} detail records")
            
            # Map lifestyle_id using product_index
            if 'product_index' in df_detail.columns:
                df_detail['lifestyle_id'] = df_detail['product_index'].map(lifestyle_id_map)
                print(f"   🔗 Mapped lifestyle_id for {len(df_detail)} records")
            
            # Remove auto-increment and mapping columns
            df_detail_clean = remove_auto_increment_and_mapping_columns(df_detail.copy(), 'tbl_lifestyle_detail')
            df_detail_clean = df_detail_clean.where(pd.notnull(df_detail_clean), None)
            
            # Bulk insert
            df_detail_clean.to_sql(
                name='tbl_lifestyle_detail',
                con=engine,
                if_exists='append',
                index=False,
                method='multi'
            )
            
            print(f"   ✅ Successfully inserted {len(df_detail)} rows into 'tbl_lifestyle_detail'")
            successful_uploads += 1
            
        except Exception as e:
            print(f"   ❌ Error uploading tbl_lifestyle_detail: {e}")
            failed_uploads += 1
    else:
        print(f"   ⚠️  tbl_lifestyle_detail.xlsx not found, skipping...")
    
    # ========================================================================
    # STEP 3: Upload tbl_lifestyle_rates and get lifestyle_rate_id
    # ========================================================================
    print("\n" + "=" * 70)
    print("STEP 3: Uploading tbl_lifestyle_rates")
    print("=" * 70)
    
    rates_file = os.path.join(folder_path, 'tbl_lifestyle_rates.xlsx')
    if os.path.exists(rates_file):
        try:
            df_rates = pd.read_excel(rates_file)
            print(f"📊 Found {len(df_rates)} rate records")
            
            # Map lifestyle_id using product_index
            if 'product_index' in df_rates.columns:
                df_rates['lifestyle_id'] = df_rates['product_index'].map(lifestyle_id_map)
                print(f"   🔗 Mapped lifestyle_id for {len(df_rates)} records")
            
            # Store rate_index for mapping
            rate_indices = df_rates['rate_index'].tolist() if 'rate_index' in df_rates.columns else list(range(len(df_rates)))
            
            # Remove auto-increment and mapping columns
            df_rates_clean = remove_auto_increment_and_mapping_columns(df_rates.copy(), 'tbl_lifestyle_rates')
            df_rates_clean = df_rates_clean.where(pd.notnull(df_rates_clean), None)
            
            # Insert each row individually to get the auto-generated ID
            for idx, (_, row) in enumerate(df_rates_clean.iterrows()):
                row_dict = row.to_dict()
                # Remove None values
                row_dict = {k: v for k, v in row_dict.items() if v is not None}
                
                columns = ', '.join(row_dict.keys())
                placeholders = ', '.join([f':{k}' for k in row_dict.keys()])
                insert_sql = f"INSERT INTO tbl_lifestyle_rates ({columns}) VALUES ({placeholders})"
                
                with engine.connect() as conn:
                    result = conn.execute(text(insert_sql), row_dict)
                    conn.commit()
                    
                    # Get the auto-generated lifestyle_rate_id
                    lifestyle_rate_id = result.lastrowid
                    rate_index = rate_indices[idx]
                    lifestyle_rate_id_map[rate_index] = lifestyle_rate_id
                    print(f"   ✅ Inserted rate_index {rate_index} -> lifestyle_rate_id: {lifestyle_rate_id}")
            
            print(f"   ✅ Successfully inserted {len(df_rates)} rows into 'tbl_lifestyle_rates'")
            print(f"   📋 Rate ID Mapping: {lifestyle_rate_id_map}")
            successful_uploads += 1
            
        except Exception as e:
            print(f"   ❌ Error uploading tbl_lifestyle_rates: {e}")
            failed_uploads += 1
    else:
        print(f"   ⚠️  tbl_lifestyle_rates.xlsx not found, skipping...")
    
    # ========================================================================
    # STEP 4: Upload life_style_rates_packages with mapped rate_id
    # ========================================================================
    print("\n" + "=" * 70)
    print("STEP 4: Uploading life_style_rates_packages")
    print("=" * 70)
    
    packages_file = os.path.join(folder_path, 'life_style_rates_packages.xlsx')
    if os.path.exists(packages_file):
        try:
            df_packages = pd.read_excel(packages_file)
            print(f"📊 Found {len(df_packages)} package records")
            
            # Map rate_id using rate_index (maps to lifestyle_rate_id)
            if 'rate_index' in df_packages.columns:
                df_packages['rate_id'] = df_packages['rate_index'].map(lifestyle_rate_id_map)
                print(f"   🔗 Mapped rate_id (lifestyle_rate_id) for {len(df_packages)} records")
            
            # Remove auto-increment and mapping columns
            df_packages_clean = remove_auto_increment_and_mapping_columns(df_packages.copy(), 'life_style_rates_packages')
            df_packages_clean = df_packages_clean.where(pd.notnull(df_packages_clean), None)
            
            # Bulk insert
            df_packages_clean.to_sql(
                name='life_style_rates_packages',
                con=engine,
                if_exists='append',
                index=False,
                method='multi'
            )
            
            print(f"   ✅ Successfully inserted {len(df_packages)} rows into 'life_style_rates_packages'")
            successful_uploads += 1
            
        except Exception as e:
            print(f"   ❌ Error uploading life_style_rates_packages: {e}")
            failed_uploads += 1
    else:
        print(f"   ⚠️  life_style_rates_packages.xlsx not found, skipping...")
    
    # ========================================================================
    # STEP 5: Upload tbl_lifestyle_inventory with mapped lifestyle_id and rate_id
    # ========================================================================
    print("\n" + "=" * 70)
    print("STEP 5: Uploading tbl_lifestyle_inventory")
    print("=" * 70)
    
    inventory_file = os.path.join(folder_path, 'tbl_lifestyle_inventory.xlsx')
    if os.path.exists(inventory_file):
        try:
            df_inventory = pd.read_excel(inventory_file)
            print(f"📊 Found {len(df_inventory)} inventory records")
            
            # Map lifestyle_id using product_index
            if 'product_index' in df_inventory.columns:
                df_inventory['lifestyle_id'] = df_inventory['product_index'].map(lifestyle_id_map)
                print(f"   🔗 Mapped lifestyle_id for {len(df_inventory)} records")
            
            # Map rate_id using rate_index (maps to lifestyle_rate_id)
            if 'rate_index' in df_inventory.columns:
                df_inventory['rate_id'] = df_inventory['rate_index'].map(lifestyle_rate_id_map)
                print(f"   🔗 Mapped rate_id (lifestyle_rate_id) for {len(df_inventory)} records")
            
            # Remove auto-increment and mapping columns
            df_inventory_clean = remove_auto_increment_and_mapping_columns(df_inventory.copy(), 'tbl_lifestyle_inventory')
            df_inventory_clean = df_inventory_clean.where(pd.notnull(df_inventory_clean), None)
            
            # Bulk insert in chunks (inventory can be large - 210 days per product)
            chunk_size = 1000
            total_rows = len(df_inventory_clean)
            
            for i in range(0, total_rows, chunk_size):
                chunk = df_inventory_clean.iloc[i:i+chunk_size]
                chunk.to_sql(
                    name='tbl_lifestyle_inventory',
                    con=engine,
                    if_exists='append',
                    index=False,
                    method='multi'
                )
                print(f"   📦 Inserted rows {i+1} to {min(i+chunk_size, total_rows)} of {total_rows}")
            
            print(f"   ✅ Successfully inserted {len(df_inventory)} rows into 'tbl_lifestyle_inventory'")
            successful_uploads += 1
            
        except Exception as e:
            print(f"   ❌ Error uploading tbl_lifestyle_inventory: {e}")
            failed_uploads += 1
    else:
        print(f"   ⚠️  tbl_lifestyle_inventory.xlsx not found, skipping...")
    
    # ========================================================================
    # STEP 6: Upload tbl_lifestyle_terms_and_conditions with mapped lifestyle_id
    # ========================================================================
    print("\n" + "=" * 70)
    print("STEP 6: Uploading tbl_lifestyle_terms_and_conditions")
    print("=" * 70)
    
    terms_file = os.path.join(folder_path, 'tbl_lifestyle_terms_and_conditions.xlsx')
    if os.path.exists(terms_file):
        try:
            df_terms = pd.read_excel(terms_file)
            print(f"📊 Found {len(df_terms)} terms records")
            
            # Map lifestyle_id using product_index
            if 'product_index' in df_terms.columns:
                df_terms['lifestyle_id'] = df_terms['product_index'].map(lifestyle_id_map)
                print(f"   🔗 Mapped lifestyle_id for {len(df_terms)} records")
            
            # Remove auto-increment and mapping columns
            df_terms_clean = remove_auto_increment_and_mapping_columns(df_terms.copy(), 'tbl_lifestyle_terms_and_conditions')
            df_terms_clean = df_terms_clean.where(pd.notnull(df_terms_clean), None)
            
            # Bulk insert
            df_terms_clean.to_sql(
                name='tbl_lifestyle_terms_and_conditions',
                con=engine,
                if_exists='append',
                index=False,
                method='multi'
            )
            
            print(f"   ✅ Successfully inserted {len(df_terms)} rows into 'tbl_lifestyle_terms_and_conditions'")
            successful_uploads += 1
            
        except Exception as e:
            print(f"   ❌ Error uploading tbl_lifestyle_terms_and_conditions: {e}")
            failed_uploads += 1
    else:
        print(f"   ⚠️  tbl_lifestyle_terms_and_conditions.xlsx not found, skipping...")
    
    # ========================================================================
    # SUMMARY
    # ========================================================================
    end_time = time.time()
    execution_time = end_time - start_time
    
    print(f"\n{'='*70}")
    print("UPLOAD SUMMARY")
    print(f"{'='*70}")
    print(f"✅ Successful uploads: {successful_uploads}")
    print(f"❌ Failed uploads: {failed_uploads}")
    print(f"⏱️  Total time: {execution_time:.2f} seconds")
    print(f"\n📋 ID Mappings Created:")
    print(f"   - Lifestyle IDs: {lifestyle_id_map}")
    print(f"   - Rate IDs: {lifestyle_rate_id_map}")
    print(f"{'='*70}\n")
    
    return {
        'success': failed_uploads == 0,
        'lifestyle_id_map': lifestyle_id_map,
        'lifestyle_rate_id_map': lifestyle_rate_id_map,
        'successful_uploads': successful_uploads,
        'failed_uploads': failed_uploads
    }


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python upload_lifestyle_to_database.py <excel_files_folder>")
        print("\nExample:")
        print("  python upload_lifestyle_to_database.py ./lifestyle_output/session_123")
        print("\nExpected files in folder:")
        for filename in TABLE_MAPPING.keys():
            print(f"  - {filename}")
        sys.exit(1)
    
    folder_path = sys.argv[1]
    if not os.path.isdir(folder_path):
        print(f"❌ Error: '{folder_path}' is not a valid directory")
        sys.exit(1)
    
    upload_lifestyle_data(folder_path)
