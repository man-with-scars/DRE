# app.py
#
# A Python/Streamlit version of the Data Reconciliation Engine.
# This script combines the data processing logic from `lib/data-service.ts`
# and the AI interaction from `services/geminiService.ts`.

import streamlit as st
import pandas as pd
import google.generativeai as genai
import os
import json
from io import StringIO
from dotenv import load_dotenv
import re

# --- Page and API Configuration ---

st.set_page_config(
    page_title="DRE-Py | Data Reconciliation Engine",
    layout="wide"
)

# Load environment variables and configure the Gemini API
load_dotenv()
api_key = os.getenv("API_KEY")

if not api_key:
    st.error("API_KEY not found in environment. Please create a .env file with your Gemini API key.")
    st.stop()

genai.configure(api_key=api_key)


# --- Core Data Processing Logic (Equivalent to lib/data-service.ts) ---

def parse_csv(file_uploader_content) -> pd.DataFrame:
    """Parses uploaded file content into a pandas DataFrame."""
    if file_uploader_content is None:
        return pd.DataFrame()
    try:
        content_str = file_uploader_content.getvalue().decode("utf-8")
        return pd.read_csv(StringIO(content_str))
    except Exception as e:
        st.error(f"Error parsing file {file_uploader_content.name}: {e}")
        return pd.DataFrame()

def clean_data(df: pd.DataFrame) -> pd.DataFrame:
    """Cleans the DataFrame by converting data types and trimming strings."""
    if df.empty:
        return df
    
    df = df.copy()
    qty_cols = [col for col in df.columns if 'qty' in col.lower()]
    text_cols = ['item_id', 'item_name', 'order_id', 'return_id', 'shipment_date', 'last_updated', 'return_date']

    for col in qty_cols:
        df[col] = pd.to_numeric(df[col], errors='coerce').astype('Int64')

    for col in text_cols:
        if col in df.columns:
            # Convert to string type first to ensure .str accessor is available
            df[col] = df[col].astype(str).str.strip().str.upper()
            # Standardize date-like columns after cleaning
            if 'date' in col:
                df[col] = pd.to_datetime(df[col], errors='coerce').dt.strftime('%Y-%m-%d')

    return df

def identify_inconsistencies(legacy_df, spreadsheet_df):
    """Identifies discrepancies between legacy and spreadsheet data."""
    inconsistencies = []
    
    # Inventory Quantity Discrepancy
    inv_merged = pd.merge(
        legacy_df[['item_id', 'inventory_qty']],
        spreadsheet_df[['item_id', 'inventory_qty']],
        on='item_id',
        how='outer',
        suffixes=('_legacy', '_spreadsheet')
    )
    inv_discrepancies = inv_merged[
        inv_merged['inventory_qty_legacy'].notna() &
        inv_merged['inventory_qty_spreadsheet'].notna() &
        (inv_merged['inventory_qty_legacy'] != inv_merged['inventory_qty_spreadsheet'])
    ]
    if not inv_discrepancies.empty:
        inconsistencies.append({
            'type': 'Inventory Quantity Discrepancy',
            'details': inv_discrepancies
        })

    # Order Quantity Discrepancy
    order_merged = pd.merge(
        legacy_df[['order_id', 'order_qty']],
        spreadsheet_df[['order_id', 'order_qty']],
        on='order_id',
        how='outer',
        suffixes=('_legacy', '_spreadsheet')
    )
    order_discrepancies = order_merged[
        order_merged['order_qty_legacy'].notna() &
        order_merged['order_qty_spreadsheet'].notna() &
        (order_merged['order_qty_legacy'] != order_merged['order_qty_spreadsheet'])
    ]
    if not order_discrepancies.empty:
        inconsistencies.append({
            'type': 'Order Quantity Discrepancy',
            'details': order_discrepancies
        })
        
    return inconsistencies

def consolidate_data(legacy, spreadsheet, supplier, returns):
    """Consolidates data from multiple sources into a single source of truth."""
    # Consolidate Inventory
    legacy_inv = legacy[['item_id', 'item_name', 'inventory_qty', 'last_updated']].assign(_source='Legacy')
    spreadsheet_inv = spreadsheet[['item_id', 'item_name', 'inventory_qty', 'last_updated']].assign(_source='Spreadsheet')
    supplier_inv = supplier.rename(columns={'shipment_qty': 'inventory_qty', 'shipment_date': 'last_updated'})
    supplier_inv = supplier_inv[['item_id', 'item_name', 'inventory_qty', 'last_updated']].assign(_source='Supplier')
    
    all_inventory = pd.concat([legacy_inv, spreadsheet_inv, supplier_inv], ignore_index=True)
    all_inventory['last_updated'] = pd.to_datetime(all_inventory['last_updated'], errors='coerce')
    all_inventory = all_inventory.dropna(subset=['item_id', 'last_updated'])
    all_inventory = all_inventory.sort_values(by='last_updated', ascending=False)
    consolidated_inventory = all_inventory.drop_duplicates(subset='item_id', keep='first')

    # Consolidate Orders
    legacy_orders = legacy[['order_id', 'order_qty', 'last_updated']].assign(_source='Legacy')
    spreadsheet_orders = spreadsheet[['order_id', 'order_qty', 'last_updated']].assign(_source='Spreadsheet')
    all_orders = pd.concat([legacy_orders, spreadsheet_orders], ignore_index=True)
    all_orders['last_updated'] = pd.to_datetime(all_orders['last_updated'], errors='coerce')
    all_orders = all_orders.dropna(subset=['order_id', 'last_updated'])
    all_orders = all_orders.sort_values(by='last_updated', ascending=False)
    consolidated_orders = all_orders.drop_duplicates(subset='order_id', keep='first')

    # Consolidate Returns
    consolidated_returns = returns.assign(_source='ReverseLogistics') if not returns.empty else pd.DataFrame()
    
    return consolidated_inventory, consolidated_orders, consolidated_returns

def process_all_files(files):
    """Main orchestration function to process uploaded files."""
    data = {key: parse_csv(file) for key, file in files.items()}
    
    source_data = {
        'legacy': clean_data(data.get('legacy', pd.DataFrame())),
        'spreadsheet': clean_data(data.get('spreadsheet', pd.DataFrame())),
        'supplier': clean_data(data.get('supplier', pd.DataFrame())),
        'reverseLogistics': clean_data(data.get('reverseLogistics', pd.DataFrame())),
        'historicalBackup': clean_data(data.get('historicalBackup', pd.DataFrame()))
    }

    inconsistencies = identify_inconsistencies(source_data['legacy'], source_data['spreadsheet'])
    
    inv, orders, returns_df = consolidate_data(
        source_data['legacy'], 
        source_data['spreadsheet'], 
        source_data['supplier'], 
        source_data['reverseLogistics']
    )

    return {
        'inconsistencies': inconsistencies,
        'consolidatedInventory': inv,
        'consolidatedOrders': orders,
        'consolidatedReturns': returns_df,
        'sourceData': source_data
    }

# --- Gemini API Service Logic (Equivalent to geminiService.ts) ---

def generate_fix_prompt(source_data, inconsistencies):
    """Generates the detailed prompt for the AI to fix data inconsistencies."""
    # This prompt is ported directly from your TypeScript code.
    inconsistencies_json = json.dumps([inc['details'].to_dict('records') for inc in inconsistencies], indent=2)
    prompt = f"""
You are a supply chain crisis management expert AI, acting as the core of a 'Data Reconciliation Supply Chain Visibility Engine (DRACVE)'. Our primary ERP/SCM system has failed. The provided datasets are fragmented exports and manual spreadsheets we are using to restore visibility. Your task is to perform a comprehensive audit, consolidate the data into a single source of truth, and provide a clear, actionable report.

**Input Datasets:**
*   **Legacy Data:** {source_data['legacy'].to_json(orient='records', indent=2)}
*   **Spreadsheet Data:** {source_data['spreadsheet'].to_json(orient='records', indent=2)}
*   **Supplier Data:** {source_data['supplier'].to_json(orient='records', indent=2)}
*   **Reverse Logistics Data:** {source_data['reverseLogistics'].to_json(orient='records', indent=2) if not source_data['reverseLogistics'].empty else "Not provided."}

**Potential Inconsistencies Detected:**
{inconsistencies_json if inconsistencies else "None automatically detected. A full audit is still required."}

**Your Required Tasks:**
1.  **Audit, Clean, and Consolidate Data:** Create authoritative 'consolidatedInventory', 'consolidatedOrders', and 'consolidatedReturns' lists by applying these rules universally to all data.
    *   **Standardize Dates:** Convert all date-like fields to 'YYYY-MM-DD'.
    *   **Resolve Gaps & Conflicts:** Prioritize data sources in this order for accuracy: Supplier > Spreadsheet > Legacy.
    *   **Use Recency:** For conflicts within the same priority level, use the record with the most recent 'last_updated' date.
    *   **Handle Returns:** If reverse logistics data exists, correctly subtract 'returned_qty' from 'inventory_qty'.
    *   **Add Source Tracking:** Add a '_source' field indicating its final origin ('Legacy', 'Spreadsheet', 'Supplier', 'AI-Corrected').
    *   **Add AI Explanation:** For any record in `consolidatedInventory` you significantly corrected, add a concise explanation in a new `_ai_explanation` field.

2.  **Generate a Detailed Executive Report:** Create a structured report object with three sections: `fixesApplied`, `rootCauseAnalysis`, `recommendations`.

**Output Format:**
You MUST return a single, valid JSON object with NO markdown fences. The JSON must strictly adhere to this structure:
{{
  "consolidatedInventory": [
    {{ "item_id": "string", "item_name": "string", "inventory_qty": "number", "last_updated": "string (YYYY-MM-DD)", "_source": "string", "_ai_explanation": "string (optional)" }}
  ],
  "consolidatedOrders": [
    {{ "order_id": "string", "order_qty": "number", "last_updated": "string (YYYY-MM-DD)", "_source": "string" }}
  ],
  "consolidatedReturns": [
    {{ "return_id": "string", "item_id": "string", "returned_qty": "number", "return_date": "string (YYYY-MM-DD)", "_source": "string" }}
  ],
  "report": {{
    "fixesApplied": ["string"],
    "rootCauseAnalysis": ["string"],
    "recommendations": ["string"]
  }}
}}
"""
    return prompt

def get_ai_fix_suggestions(source_data, inconsistencies):
    """Calls the Gemini API to get data fixes and a report."""
    prompt = generate_fix_prompt(source_data, inconsistencies)
    model = genai.GenerativeModel("gemini-2.5-flash-preview-04-17")
    
    try:
        response = model.generate_content(
            prompt,
            generation_config={"response_mime_type": "application/json"}
        )
        
        # Clean potential markdown fences
        text_content = response.text.strip()
        match = re.search(r"```(json)?(.*)```", text_content, re.S)
        if match:
            text_content = match.group(2).strip()

        # Parse the JSON response
        result_data = json.loads(text_content)

        # Convert lists of dicts to DataFrames
        for key in ['consolidatedInventory', 'consolidatedOrders', 'consolidatedReturns']:
            if key in result_data:
                result_data[key] = pd.DataFrame(result_data[key])
                
        return result_data
    
    except Exception as e:
        st.error(f"Error calling Gemini API or parsing response: {e}")
        st.error(f"Raw response from AI: \n\n{response.text if 'response' in locals() else 'No response object'}")
        return None

# --- Streamlit UI Layout ---

st.title("DRE-Py: Data Reconciliation Engine")
st.markdown("*A Python & Streamlit implementation of the DRE tool*")

if 'processed_data' not in st.session_state:
    st.session_state.processed_data = None
if 'ai_results' not in st.session_state:
    st.session_state.ai_results = None

with st.expander("1. Upload Data Sources", expanded=True):
    st.info("Please upload the mandatory CSV files to begin the reconciliation process.")
    
    cols = st.columns(3)
    with cols[0]:
        legacy_file = st.file_uploader("Legacy DB (.csv)", type="csv", key="legacy")
    with cols[1]:
        spreadsheet_file = st.file_uploader("Spreadsheet (.csv)", type="csv", key="spreadsheet")
    with cols[2]:
        supplier_file = st.file_uploader("Supplier Data (.csv)", type="csv", key="supplier")

    st.markdown("---")
    st.subheader("Optional Sources")
    cols_opt = st.columns(3)
    with cols_opt[0]:
        returns_file = st.file_uploader("Returns Data (.csv)", type="csv", key="reverseLogistics")
    with cols_opt[1]:
        historical_file = st.file_uploader("Historical Backup (.csv)", type="csv", key="historicalBackup")


if st.button("Reconcile & Analyze", type="primary", use_container_width=True,
             disabled=not(legacy_file and spreadsheet_file and supplier_file)):
    
    files_to_process = {
        'legacy': legacy_file,
        'spreadsheet': spreadsheet_file,
        'supplier': supplier_file,
        'reverseLogistics': returns_file,
        'historicalBackup': historical_file
    }
    
    with st.spinner("Processing files and performing initial reconciliation..."):
        st.session_state.processed_data = process_all_files(files_to_process)
        st.session_state.ai_results = None # Reset AI results on new reconciliation
    st.success("Initial reconciliation complete!")

if st.session_state.processed_data:
    data = st.session_state.processed_data
    
    st.header("2. Initial Reconciliation Summary")

    if data['inconsistencies']:
        st.warning(f"Found {len(data['inconsistencies'])} types of inconsistencies.")
        for issue in data['inconsistencies']:
            with st.expander(f"Inconsistency: {issue['type']}"):
                st.dataframe(issue['details'])
    else:
        st.success("No inconsistencies found between legacy and spreadsheet data.")

    st.subheader("Consolidated Data Preview")
    st.markdown("This data is consolidated based on the most recent entries from all sources.")
    
    tab1, tab2, tab3 = st.tabs(["Consolidated Inventory", "Consolidated Orders", "Consolidated Returns"])
    with tab1:
        st.dataframe(data['consolidatedInventory'])
    with tab2:
        st.dataframe(data['consolidatedOrders'])
    with tab3:
        if not data['consolidatedReturns'].empty:
            st.dataframe(data['consolidatedReturns'])
        else:
            st.info("No returns data provided.")
            
    st.header("3. AI-Powered Analysis & Fix")
    
    if st.button("Generate AI Analysis & Fixes", use_container_width=True):
        with st.spinner("Sending data to Gemini for deep analysis and correction... This may take a moment."):
            ai_results = get_ai_fix_suggestions(data['sourceData'], data['inconsistencies'])
            st.session_state.ai_results = ai_results
        if st.session_state.ai_results:
            st.success("AI analysis and correction complete!")
        else:
            st.error("AI analysis failed. Please check the logs.")

if st.session_state.ai_results:
    st.header("4. AI-Corrected Results")
    ai_data = st.session_state.ai_results
    
    tab1, tab2, tab3 = st.tabs(["AI Report", "AI-Corrected Inventory", "AI-Corrected Orders"])
    
    with tab1:
        st.subheader("Executive Report from AI")
        report = ai_data.get('report', {})
        st.markdown("#### Fixes Applied")
        for fix in report.get('fixesApplied', []): st.markdown(f"- {fix}")
        
        st.markdown("#### Root Cause Analysis")
        for cause in report.get('rootCauseAnalysis', []): st.markdown(f"- {cause}")

        st.markdown("#### Recommendations")
        for rec in report.get('recommendations', []): st.markdown(f"- {rec}")
        
    with tab2:
        st.subheader("AI-Corrected Inventory")
        st.dataframe(ai_data.get('consolidatedInventory', pd.DataFrame()))

    with tab3:
        st.subheader("AI-Corrected Orders")
        st.dataframe(ai_data.get('consolidatedOrders', pd.DataFrame()))