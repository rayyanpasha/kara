# dashboard_app.py
import streamlit as st
import plotly.graph_objects as go
import pandas as pd
import requests
import json
import time

# ----------------------------------------------------------------------
# Page Configuration
# ----------------------------------------------------------------------
st.set_page_config(
    page_title="South India Tourism Intelligence Dashboard",
    layout="wide",
    initial_sidebar_state="collapsed"
)

# ----------------------------------------------------------------------
# Data Store (Extracted *only* from the provided document)
# ----------------------------------------------------------------------

# This dictionary holds all data extracted *verbatim* from the document.
# All citations refer to the source document provided.
DATA = {
    "Overview": {
        "Intro": """
        The South Indian hospitality market is undergoing a structural divergence. 
        Analysis indicates a shift where legacy luxury faces commoditization, while a new traveler 
        archetype drives demand for authenticity, exclusivity, and deep experiential engagement. 
        This validates a strategic focus on **"Destination-Based Signature Stays"**.
        """,
        "Market_Growth": [
            {"Metric": "Baseline India Boutique Hotel Market CAGR (2024-2030)", "Value": "9.6%", "Source": 5},
            {"Metric": "Eco-Wellness Lodges Niche CAGR", "Value": "21.62%", "Source": 6}
        ],
        "Traveler_Values": [
            {"Metric": "Affluent travelers preferring luxury travel over lavish weddings", "Value": "81%", "Source": 13},
            {"Metric": "Affluent travelers preferring luxury travel over designer goods", "Value": "74%", "Source": 13},
            {"Metric": "Primary motivation: 'Fun and adventure'", "Value": "48%", "Source": 13},
            {"Metric": "Primary motivation: 'Cultural discovery'", "Value": "47%", "Source": 13}
        ],
        "Comparative_Arrivals": {
            "States": ["Kerala", "Tamil Nadu", "Karnataka", "Goa", "Andhra Pradesh", "Telangana"],
            "Domestic": [22.2, 286.0, 283.5, 9.9, 254.7, 60.7],
            "Domestic_Source": [19, 39, 56, 75, 98, 117],
            "Domestic_Year": ["(2024)", "(2023)", "(2023)", "(2024)", "(2023)", "(2022)"],
            "Foreign": [0.74, 1.17, 0.401, 0.47, 0.06, 0.16],
            "Foreign_Source": [19, 39, 56, 75, 98, 117],
            "Foreign_Year": ["(2024)", "(2023)", "(2024)", "(2024)", "(2023)", "(2023)"]
        },
        "Hospitality_KPIs": {
            "headers": ["State", "Key City", "Occupancy (%)", "ADR (₹)", "Key Revenue / Metric"],
            "rows": [
                ["Kerala", "Kochi (Aug 2024)", "62-64%", "₹6,900 - ₹7,100", "₹43,621.22 Cr (Total Revenue 2023)"],
                ["Tamil Nadu", "Chennai (Jul 2024)", "76-79%", "₹6,900 - ₹7,100 (Aug 2024)", "₹243.31 Cr (TTDC Revenue FY24)"],
                ["Karnataka", "Bengaluru (Aug 2024)", "Strong (Data Not Available)", "₹6,900 - ₹7,100", "₹100 Cr (Mysore Dasara Turnover)"],
                ["Goa", "Overall (Jul 2024)", "Range-bound (Data Not Available)", "> ₹8,500", "16.43% (Tourism GSDP Contribution)"],
                ["Andhra Pradesh", "N/A", "Data Not Available", "Data Not Available", "₹161.45 Cr (APTDCL Income FY24)"],
                ["Telangana", "Hyderabad (FY 2023-24)", "Among highest in India", "High Growth (Data Not Available)", "+11.9% (RevPAR Growth Q2 2024)"]
            ]
        },
        "Archetype_Matrix": {
            "headers": ["State", "Primary Traveller Archetype(s)", "Dominant Motivations", "Key Sentiment Keywords", "Hospitality Maturity"],
            "rows": [
                ["Kerala", "Wellness Seeker, Nature/Adventure", "Rejuvenation, Transformation, Adventure", "'Tranquil,' 'Lush,' 'Serene,' 'Authentic'", "Mature (Wellness), Developing (Adventure)"],
                ["Tamil Nadu", "Cultural Purist, Spiritual", "Discovery, Authenticity, Culinary Immersion", "'Heritage,' 'Opulent,' 'Vintage,' 'Unspoiled'", "Niche/Mature (Heritage), Emerging (Eco)"],
                ["Karnataka", "Cultural/Spiritual, Nature/Adventure, Wellness", "Discovery, Thrill, Rejuvenation, Workation", "'Spiritual,' 'Tranquil,' 'Overcrowded' (Coorg)", "Mature (Coorg), Ascendant (Gokarna, Hampi)"],
                ["Goa", "Celebration/Event, Luxury/Escape", "Celebration, Relaxation, Seclusion", "'Crowded' (North), 'Peaceful,' 'Secluded' (South)", "Mature/Saturated (North), Mature/Premium (South)"],
                ["Andhra Pradesh", "Cultural/Spiritual", "Pilgrimage, Discovery", "'Well-managed' (tours), 'Poor food,' 'Bad service' (hotels)", "Developing/Nascent (Premium)"],
                ["Telangana", "Business/MICE, Cultural/Heritage, Celebration", "Business, Discovery, Celebration", "'Fairytale,' 'Breathtaking' (Weddings), 'Scheduling issues' (Tours)", "Mature (Hyderabad MICE), Developing (Leisure)"]
            ],
            "source": 136
        },
        "Sentiment_Radar": {
            "Categories": ['Cultural/Spiritual', 'Wellness/Rejuvenation', 'Nature/Escape', 'Adventure', 'Celebration/MICE'],
            "States": {
                "Kerala": [0, 3, 3, 2, 0],
                "Tamil Nadu": [2, 1, 2, 0, 0],
                "Karnataka": [2, 2, 3, 2, 1],
                "Goa": [1, 1, 3, 2, 1],
                "Andhra Pradesh": [2, 0, 3, 1, 0],
                "Telangana": [2, 0, 1, 1, 2]
            }
        }
    },
    "Kerala": {
        "Tagline": "The Wellness Epicenter",
        "Metrics": [
            {"label": "Domestic Arrivals (2024)", "value": "22.2 Million", "delta": "+1.72% YoY"},
            {"label": "Foreign Arrivals (2024)", "value": "0.74 Million", "delta": "+13.76% YoY"},
            {"label": "Total Tourism Revenue (2023)", "value": "₹43,621.22 Cr", "delta": "+24.03% YoY"},
        ],
        "Other_Metrics": [
            "**Kochi Hotel Occupancy (Aug 2024):** 62-64%",
            "**Kochi Hotel ADR (Aug 2024):** ₹6,900 - ₹7,100",
            "**Share of India's Wellness Market (2025):** 45.64%",
            "**Foreign Arrivals vs. 2019:** -37.9%"
        ],
        "Archetype": {
            "Name": "Wellness Seeker / Holistic Seeker",
            "Motivations": "A purposeful journey of rejuvenation, transformation, and a 'mental reset'.",
            "Keywords": "`magical land`, `lush green mountains`, `pristine`, `tranquil backwaters`, `peaceful environment`"
        },
        "Micro_Destinations": {
            "Varkala": "Rejuvenation/Wellness",
            "Wayanad": "Nature/Adventure & Rejuvenation/Wellness",
            "Vagamon": "Nature/Adventure",
            "Munroe Island": "Nature/Escape"
        },
        "Infrastructure": {
            "Airports": "4 International Airports: Trivandrum (TRV), Cochin (COK), Calicut (CCJ), Kannur (CNN)",
            "Highways": "NH-66 (coastal), NH-544 (Salem-Kochi), NH-766 (Wayanad access)"
        }
    },
    "Tamil Nadu": {
        "Tagline": "The Cultural Heartland",
        "Metrics": [
            {"label": "Domestic Arrivals (2023)", "value": "286 Million", "delta": "+30.8% vs 2022"},
            {"label": "Foreign Arrivals (2023)", "value": "1.17 Million", "delta": "+735% vs 2022"},
            {"label": "TTDC Revenue (FY 2023-24)", "value": "₹243.31 Cr", "delta": "Fivefold increase from FY 2020-21"},
        ],
        "Other_Metrics": [
            "**Chennai Hotel Occupancy (Jul 2024):** 76-79%",
            "**Chennai Hotel ADR (Aug 2024):** ₹6,900 - ₹7,100",
            "**Policy Target (GDP):** Increase tourism's GDP contribution to 12% by 2030",
            "**Policy Target (Avg. Spend):** Increase domestic spend from ₹1,700 to ₹25,000"
        ],
        "Archetype": {
            "Name": "Cultural Purist / Connoisseur",
            "Motivations": "Discovery, authenticity, and a deep connection to history, living culture, and architecture.",
            "Keywords": "`vintage luxury`, `rural charm`, `opulent mansions`, `feisty food`, `culturally rich`, `unspoiled by large crowds`"
        },
        "Micro_Destinations": {
            "Chettinad": "Cultural and Culinary Immersion",
            "Valparai": "Nature/Escape",
            "Kotagiri (Nilgiris)": "Rejuvenation/Nature"
        },
        "Infrastructure": {
            "Airports": "4 International Airports: Chennai (MAA), Coimbatore (CJB), Tiruchirappalli (TRZ), Madurai (IXM)",
            "Highways": "NH-32 (East Coast Road), NH-44 (North-South)"
        }
    },
    "Karnataka": {
        "Tagline": "The Diverse Powerhouse",
        "Metrics": [
            {"label": "Domestic Arrivals (2023)", "value": "283.5 Million", "delta": "+55.4% vs 2022"},
            {"label": "Foreign Arrivals (2024)", "value": ">401,000", "delta": "Data Not Available"},
            {"label": "Mysore Dasara (2025) Turnover", "value": "₹100 Crore", "delta": "from ~500,000 tourists"},
        ],
        "Other_Metrics": [
            "**Tourism Employment Share:** 10% of total state jobs",
            "**Mysore Hotel Occupancy (Dasara Peak):** 100%",
            "**Bengaluru Hotel ADR (Aug 2024):** ₹6,900 - ₹7,100"
        ],
        "Archetype": {
            "Name": "Cultural Purist, Adventure Capitalist, Wellness Seeker",
            "Motivations": "Discovery (Hampi), Thrill (Western Ghats), Rejuvenation (Coorg), 'Workations' (fueled by Bengaluru).",
            "Keywords": "**Coorg (Negative):** `overcrowded`, `traffic`, `overhyped`. **Gokarna (Positive):** `quieter`, `tranquil vibe`"
        },
        "Micro_Destinations": {
            "Hampi": "Cultural/Spiritual",
            "Coorg": "Nature/Wellness/Celebration",
            "Gokarna": "Spiritual/Wellness & Nature/Escape",
            "Chorla Ghats": "Nature/Adventure & Luxury/Escape"
        },
        "Infrastructure": {
            "Airports": "Major Airports: Bengaluru (BLR), Mangalore (IXE), Mysore (MYQ), Hubli (HBX)",
            "Highways": "NH-44, NH-48, NH-66. **Key Project:** NH-67 four-laning to Hampi (projected 60% travel time reduction)"
        }
    },
    "Goa": {
        "Tagline": "The Bifurcated Leisure Market",
        "Metrics": [
            {"label": "Domestic Arrivals (2024)", "value": "9.9 Million", "delta": "+22% YoY"},
            {"label": "Foreign Arrivals (2024)", "value": "0.47 Million", "delta": "+3% YoY"},
            {"label": "Tourism GSDP Contribution", "value": "16.43%", "delta": "Employs ~35% of population"},
        ],
        "Other_Metrics": [
            "**Overall ADR (Jul 2024):** > ₹8,500",
            "**Rate Correction (2025, North Goa):** -15% to -20%",
            "**Rate Correction (2025, South Goa):** -5% to -7%",
            "**Luxury Villa Rental Yield (North):** 6-10% per annum"
        ],
        "Archetype": {
            "Name": "Celebration/Event-driven (North), Luxury/Escape (South)",
            "Motivations": "Celebration, Relaxation, Seclusion.",
            "Keywords": "**North Goa (Negative):** `crowded`, `noisy`, `overtourism`. **South Goa (Positive):** `peaceful`, `secluded`, `tranquility`, `serenity`"
        },
        "Micro_Destinations": {
            "North Goa": "High-volume, mass-market (Negative Sentiment)",
            "South Goa": "Luxury/Escape (Positive Sentiment)",
            "Hinterlands (Chorla, Divar)": "Nature/Adventure, Luxury/Escape, Cultural/Heritage"
        },
        "Infrastructure": {
            "Airports": "2 International Airports: Dabolim (GOI) and Manohar (GOX) at Mopa",
            "Highways": "NH-66, NH-4A, NH-17A"
        }
    },
    "Andhra Pradesh": {
        "Tagline": "The Emerging Spiritual & Coastal Hub",
        "Metrics": [
            {"label": "Domestic Arrivals (2023)", "value": "254.7 Million", "delta": "+32.2% vs 2022"},
            {"label": "Foreign Arrivals (2023)", "value": "60,426", "delta": "-63.6% vs 2022"},
            {"label": "APTDCL Operating Income (FY24)", "value": "₹161.45 Crore", "delta": "Data Not Available"},
        ],
        "Other_Metrics": [
            "**Hospitality Metrics (ADR/Occupancy):** Data Not Available",
            "**Religious Tourism Share:** 78% of the state's sector",
            "**Policy Target (Avg. Stay):** Increase from 1-2 days to 5 days",
            "**Policy Target (Avg. Spend):** Increase domestic spend from ₹1,700 to ₹25,000"
        ],
        "Archetype": {
            "Name": "Cultural/Spiritual",
            "Motivations": "Pilgrimage (dominant), with state efforts to diversify into Nature/Adventure and Wellness.",
            "Keywords": "**Positive (Tours):** `well managed`, `flexible`. **Negative (Hotels):** `non-functional hotel amenities`, `poor food quality`"
        },
        "Micro_Destinations": {
            "Tirupati": "Spiritual",
            "Visakhapatnam (Vizag)": "Nature/Leisure",
            "Araku Valley": "Nature/Escape (hampered by service gaps)",
            "Gandikota": "Nature/Adventure"
        },
        "Infrastructure": {
            "Airports": "2 International (Visakhapatnam - VTZ, Tirupati - TIR), 2 Major Domestic (Vijayawada - VGA, Rajahmundry - RJA)",
            "Highways": "NH-16 (Golden Quadrilateral), NH-44 (North-South)"
        }
    },
    "Telangana": {
        "Tagline": "The Heritage & Business Hub",
        "Metrics": [
            {"label": "Domestic Arrivals (2022)", "value": "60.7 Million", "delta": "Data from 2022"},
            {"label": "Foreign Arrivals (2023)", "value": "160,912", "delta": "+135% vs 2022"},
            {"label": "Hyderabad RevPAR Growth (Q2 2024)", "value": "+11.9% YoY", "delta": "Led major Indian markets"},
        ],
        "Other_Metrics": [
            "**Hyderabad Occupancy (FY 2023-24):** Among the highest in India",
            "**Policy Target (Investment):** Attract ₹15,000 crore",
            "**Policy Target (GDP):** Increase tourism's GDP contribution to 10%",
            "**Avg. Meal Cost (Hyderabad):** ₹150 - ₹300 (Inexpensive Restaurant)"
        ],
        "Archetype": {
            "Name": "Business/MICE, Cultural/Heritage, Celebration",
            "Motivations": "Business, Discovery, Celebration. Policy targets Wellness and Destination Weddings.",
            "Keywords": "**Weddings (Positive):** `beautiful blend of nature and luxury`, `fairytale`, `breathtaking`. **Tours (Mixed):** `supportive staff`, `scheduling issues`"
        },
        "Micro_Destinations": {
            "Hyderabad": "Cultural/Heritage & Business/MICE",
            "Warangal": "Cultural/Heritage",
            "Ananthagiri Hills": "Nature/Adventure"
        },
        "Infrastructure": {
            "Airports": "1 International Airport: Rajiv Gandhi International Airport (HYD)",
            "Highways": "NH-44 (North-South), NH-65 (Pune-Vijayawada)"
        }
    }
}


# ----------------------------------------------------------------------
# Plotting Functions (Plotly)
# ----------------------------------------------------------------------

def plot_comparative_arrivals(data):
    """Generates a grouped bar chart for domestic vs. foreign arrivals."""
    df = pd.DataFrame(data)
    
    # Create text labels with years
    domestic_text = [f"{val}M {year}" for val, year in zip(data['Domestic'], data['Domestic_Year'])]
    foreign_text = [f"{val}M {year}" for val, year in zip(data['Foreign'], data['Foreign_Year'])]

    fig = go.Figure()
    
    fig.add_trace(go.Bar(
        name='Domestic Arrivals (Millions)',
        x=df['States'],
        y=df['Domestic'],
        text=domestic_text,
        textposition='auto',
        marker_color='#1f77b4',
        hovertemplate="<b>%{x}</b><br>Domestic Arrivals: %{y}M %{text.split(' ')[1]}<br>Source: %{customdata}<extra></extra>",
        customdata=data['Domestic_Source']
    ))
    
    fig.add_trace(go.Bar(
        name='Foreign Arrivals (Millions)',
        x=df['States'],
        y=df['Foreign'],
        text=foreign_text,
        textposition='auto',
        marker_color='#ff7f0e',
        hovertemplate="<b>%{x}</b><br>Foreign Arrivals: %{y}M %{text.split(' ')[1]}<br>Source: %{customdata}<extra></extra>",
        customdata=data['Foreign_Source']
    ))
    
    fig.update_layout(
        barmode='group',
        title_text='South India Tourist Arrivals (Millions) [Note: Data from 2022-2024]',
        xaxis_title='State',
        yaxis_title='Tourist Arrivals (Millions)',
        legend_title_text='Visitor Type',
        margin=dict(l=20, r=20, t=40, b=20),
        paper_bgcolor='rgba(0,0,0,0)',
        plot_bgcolor='rgba(0,0,0,0)',
    )
    fig.update_yaxes(gridcolor='#f0f0f0')
    
    return fig

def plot_sentiment_radar(data):
    """Generates a radar chart for dominant traveler motivations."""
    fig = go.Figure()
    
    categories = data['Categories']
    
    for state, scores in data['States'].items():
        fig.add_trace(go.Scatterpolar(
            r=scores,
            theta=categories,
            fill='toself',
            name=state,
            hovertemplate=f"<b>{state}</b><br>%{{theta}}: %{{r}}<extra></extra>"
        ))
        
    fig.update_layout(
        polar=dict(
            radialaxis=dict(
                visible=True,
                range=[0, max(max(s) for s in data['States'].values())]
            )
        ),
        title_text='Dominant Traveller Motivation Themes (by mention frequency)',
        legend_title_text='State',
        margin=dict(l=60, r=60, t=80, b=40),
        paper_bgcolor='rgba(0,0,0,0)',
    )
    return fig

# ----------------------------------------------------------------------
# Tab Creation Functions
# ----------------------------------------------------------------------

def create_overview_tab(data):
    """Populates the South India Overview tab."""
    
    st.title("South India Travel Intelligence Dashboard")
    st.markdown(f"**Source:** *!S - 2 - South India Travel Intelligence Report (Internal Research Only)*")
    st.markdown("---")
    
    # --- Executive Overview ---
    st.subheader("Executive Overview: The Structural Schism")
    st.markdown(data['Overview']['Intro'])
    
    cols = st.columns(len(data['Overview']['Market_Growth']))
    for i, item in enumerate(data['Overview']['Market_Growth']):
        cols[i].metric(label=item['Metric'], value=item['Value'], help=f"Source: [cite: {item['Source']}]")
        
    st.markdown("**The New Value Equation: Return on Experience (ROE)**")
    st.markdown(
        "Travel has evolved from a discretionary expense into a primary vehicle for self-expression. "
        "The ability to command premium pricing is now directly correlated to the 'Return on Experience' (ROE) "
        "— a property's ability to deliver a unique, non-commodifiable, and emotionally resonant journey."
    )
    
    value_cols = st.columns(len(data['Overview']['Traveler_Values']))
    for i, item in enumerate(data['Overview']['Traveler_Values']):
        value_cols[i].info(f"**{item['Value']}** {item['Metric']} [cite: {item['Source']}]")

    st.markdown("---")
    
    # --- Comparative Visuals ---
    st.subheader("Quantitative State Comparison")
    
    # Bar Chart
    fig_bar = plot_comparative_arrivals(data['Overview']['Comparative_Arrivals'])
    st.plotly_chart(fig_bar, use_container_width=True)
    
    # KPI Table
    st.markdown("**Comparative Hospitality KPIs (2023-2024)**")
    df_kpi = pd.DataFrame(data['Overview']['Hospitality_KPIs']['rows'], columns=data['Overview']['Hospitality_KPIs']['headers'])
    st.dataframe(df_kpi, use_container_width=True, hide_index=True)

    st.markdown("---")
    
    # --- Qualitative Visuals ---
    st.subheader("Qualitative State Comparison")
    
    col1, col2 = st.columns([1.2, 1])

    with col1:
        # Archetype Matrix
        st.markdown(f"**Cross-State Traveller Profile & Motivation Matrix [cite: {data['Overview']['Archetype_Matrix']['source']}]**")
        df_arch = pd.DataFrame(data['Overview']['Archetype_Matrix']['rows'], columns=data['Overview']['Archetype_Matrix']['headers'])
        st.dataframe(df_arch, use_container_width=True, hide_index=True, height=250)
        
    with col2:
        # Radar Chart
        fig_radar = plot_sentiment_radar(data['Overview']['Sentiment_Radar'])
        st.plotly_chart(fig_radar, use_container_width=True)


def create_state_tab(state_data):
    """Creates a standardized tab for a single state."""
    
    st.header(f"{state_data['Tagline']}")
    st.markdown("---")

    # --- Metrics ---
    st.subheader("Key Quantitative Indicators")
    cols = st.columns(len(state_data['Metrics']))
    for i, metric in enumerate(state_data['Metrics']):
        cols[i].metric(label=metric['label'], value=metric['value'], delta=metric['delta'])
    
    st.markdown("**Hospitality & Policy Metrics:**")
    for item in state_data['Other_Metrics']:
        st.markdown(f"- {item}")
        
    st.markdown("---")
    
    col1, col2 = st.columns(2)
    
    with col1:
        # --- Archetype & Sentiment ---
        st.subheader("Emotional & Behavioural Patterns")
        st.markdown(f"**Primary Archetype: {state_data['Archetype']['Name']}**")
        st.markdown(f"**Motivations:** {state_data['Archetype']['Motivations']}")
        st.markdown(f"**Key Sentiment Keywords:** {state_data['Archetype']['Keywords']}")

    with col2:
        # --- Micro-Destinations ---
        st.subheader("Emotional Tones by Micro-Destination")
        for dest, tone in state_data['Micro_Destinations'].items():
            st.markdown(f"**{dest}:** {tone}")
        
        st.markdown("---")
        
        # --- Infrastructure ---
        st.subheader("Accessibility & Infrastructure")
        st.markdown(f"**Airports:** {state_data['Infrastructure']['Airports']}")
        st.markdown(f"**Road Network:** {state_data['Infrastructure']['Highways']}")

# ----------------------------------------------------------------------
# Chatbot Functionality (NEW)
# ----------------------------------------------------------------------

def get_system_prompt(enable_search):
    """Returns the appropriate system prompt based on whether search is enabled."""
    rag_prompt = f"""
    You are a specialized travel analyst assistant. Your knowledge is strictly limited to the data within the 'South India Travel Intelligence Report'.
    Do not use any external information, personal opinions, or make assumptions.
    Your sole purpose is to answer questions based *only* on the data provided below.
    If a question cannot be answered using this data, you MUST respond with:
    "I do not have that information in the provided report."

    Here is the complete data from the report:
    {json.dumps(DATA, indent=2)}
    """
    
    agent_prompt = f"""
    You are a specialized travel analyst research agent. Your goal is to provide comprehensive answers to questions about South India tourism.
    
    You have two sources of information:
    1.  A private 'South India Travel Intelligence Report' (provided below).
    2.  The Google Search tool.
    
    Your process MUST be:
    1.  **First,** try to answer the user's question *only* using the 'South India Travel Intelligence Report' data.
    2.  **If the report contains the answer,** provide it and state that the information is from the report (e.g., "According to the report...").
    3.  **If the report *does not* contain the answer,** then and only then, use the Google Search tool to find the most up-to-date, relevant information.
    4.  **When you use Google Search,** you MUST cite your sources. For each piece of information from a search, append the source title and URL.
    5.  If you cannot find the answer in the report or with Google Search, state that the information is not available.
    
    Here is the complete data from the report:
    {json.dumps(DATA, indent=2)}
    """
    
    return agent_prompt if enable_search else rag_prompt

def call_gemini_chatbot(user_prompt, chat_history, enable_search):
    """
    Calls the Gemini API with the user prompt, chat history, and the system prompt.
    Conditionally enables Google Search.
    """
    # --- MODIFICATION START ---
    # Securely get the API key from Streamlit secrets
    apiKey = st.secrets.get("GEMINI_API_KEY")
    if not apiKey:
        return "Gemini API key not found. Please add it to your Streamlit secrets (`.streamlit/secrets.toml`) to enable the chatbot."
    # --- MODIFICATION END ---
        
    apiUrl = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={apiKey}"
    
    contents = []
    for message in chat_history:
        contents.append({"role": message["role"], "parts": [{"text": message["content"]}]})
    contents.append({"role": "user", "parts": [{"text": user_prompt}]})

    system_prompt = get_system_prompt(enable_search)

    payload = {
        "contents": contents,
        "systemInstruction": {"parts": [{"text": system_prompt}]},
        "generationConfig": {"temperature": 0.2, "topP": 0.8, "topK": 10}
    }
    
    if enable_search:
        payload["tools"] = [{"google_search": {}}]

    max_retries = 5
    delay = 1
    
    for attempt in range(max_retries):
        try:
            response = requests.post(apiUrl, headers={'Content-Type': 'application/json'}, data=json.dumps(payload), timeout=120)
            
            if response.status_code == 200:
                result = response.json()
                
                # Check for empty or blocked responses
                if 'candidates' not in result or not result['candidates']:
                     return "I'm sorry, I couldn't generate a response. The request may have been blocked due to safety settings."
                
                candidate = result['candidates'][0]
                text = candidate.get('content', {}).get('parts', [{}])[0].get('text', '')

                if not text:
                    return "I'm sorry, I received an empty response from the analyst service."

                # Handle grounding metadata for search results
                if enable_search and 'groundingMetadata' in candidate:
                    attributions = candidate['groundingMetadata'].get('groundingAttributions', [])
                    sources = [
                        {"title": attr['web']['title'], "uri": attr['web']['uri']}
                        for attr in attributions if attr.get('web')
                    ]
                    
                    # Remove duplicate sources
                    unique_sources = [dict(t) for t in {tuple(d.items()) for d in sources}]
                    
                    if unique_sources:
                        text += "\n\n**Sources:**\n"
                        for i, source in enumerate(unique_sources):
                            text += f"{i+1}. [{source['title']}]({source['uri']})\n"
                
                return text
            
        except requests.exceptions.RequestException as e:
            if attempt == max_retries - 1:
                return f"An error occurred while contacting the analyst service: {e}"
        
        time.sleep(delay)
        delay *= 2

    return "The analyst service is currently unavailable. Please try again later."


def create_chatbot_tab():
    """Populates the new Chatbot tab."""
    st.header("Research Agent Chatbot")
    
    # Check if API key is configured before showing the main info
    if not st.secrets.get("GEMINI_API_KEY"):
        st.error("The Research Agent is not configured. Please add your Gemini API key to the application's secrets.")
        st.code("""
# 1. Create a file: .streamlit/secrets.toml
# 2. Add your key inside:
GEMINI_API_KEY = "YOUR_API_KEY_HERE"
        """)
        return # Stop rendering the rest of the tab

    st.info("Ask me questions about the 'South India Travel Intelligence Report'. My knowledge is limited *only* to the data in this dashboard.")
    
    enable_search = st.toggle("Enable Live Internet Search (for data *outside* the report)", value=False)
    st.markdown("---")
    
    if "messages" not in st.session_state:
        st.session_state.messages = []

    for message in st.session_state.messages:
        with st.chat_message(message["role"]):
            st.markdown(message["content"])

    if prompt := st.chat_input("Which state had the most domestic arrivals?"):
        st.session_state.messages.append({"role": "user", "content": prompt})
        with st.chat_message("user"):
            st.markdown(prompt)

        with st.chat_message("assistant"):
            with st.spinner("Analyst is thinking..."):
                response = call_gemini_chatbot(prompt, st.session_state.messages, enable_search)
                st.markdown(response, unsafe_allow_html=True)
        
        st.session_state.messages.append({"role": "assistant", "content": response})

# ----------------------------------------------------------------------
# Main App (Tabs)
# ----------------------------------------------------------------------

tab_names = [
    "South India Overview", 
    "Kerala", 
    "Tamil Nadu", 
    "Karnataka", 
    "Goa", 
    "Andhra Pradesh", 
    "Telangana",
    "Chatbot"
]
tabs = st.tabs(tab_names)

with tabs[0]:
    create_overview_tab(DATA)
with tabs[1]:
    create_state_tab(DATA['Kerala'])
with tabs[2]:
    create_state_tab(DATA['Tamil Nadu'])
with tabs[3]:
    create_state_tab(DATA['Karnataka'])
with tabs[4]:
    create_state_tab(DATA['Goa'])
with tabs[5]:
    create_state_tab(DATA['Andhra Pradesh'])
with tabs[6]:
    create_state_tab(DATA['Telangana'])
with tabs[7]:
    create_chatbot_tab()