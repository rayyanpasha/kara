import React, { useState, useEffect, useRef } from 'react';

// --- Firebase Imports ---
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, query, onSnapshot, serverTimestamp, orderBy, doc, updateDoc, increment } from 'firebase/firestore';

// --- Third-party Libraries (Assumed loaded from CDN) ---
import * as THREE from 'three';
// Note: For the map, add Leaflet's CSS and JS to your index.html:
// <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
// <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>

// --- GSAP ---
// GSAP and ScrollTrigger are loaded from a script tag in the final HTML,
// so we access them from the window object.

// --- SVG Icons ---
const MapPinIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 mr-2 text-slate-400"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>;
const GeneratingSpinner = ({ text = "Generating..." }) => (<div className="flex flex-col items-center justify-center p-4 text-center"><svg className="animate-spin h-6 w-6 text-indigo-400 mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><span className="text-indigo-300 font-semibold">{text}</span></div>);
const ArrowUpIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 mr-1"><path d="m5 12 7-7 7 7"/><path d="M12 19V5"/></svg>;
const SparklesIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 mr-2"><path d="M12 3a6 6 0 0 0 9 9a6 6 0 0 0-9-9Z"/><path d="M12 3a6 6 0 0 1-9 9a6 6 0 0 1 9-9Z"/></svg>;
const CheckCircleIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 mr-2 text-green-400"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>;

// --- Helper Functions ---
const getAqiInfo = (aqi) => {
  if (aqi <= 50) return { level: 'Good', color: 'bg-green-500', textColor: 'text-green-500', pulseColor: 'shadow-green-500/50' };
  if (aqi <= 100) return { level: 'Moderate', color: 'bg-yellow-500', textColor: 'text-yellow-500', pulseColor: 'shadow-yellow-500/50' };
  if (aqi <= 150) return { level: 'Unhealthy for Sensitive Groups', color: 'bg-orange-500', textColor: 'text-orange-500', pulseColor: 'shadow-orange-500/50' };
  if (aqi <= 200) return { level: 'Unhealthy', color: 'bg-red-500', textColor: 'text-red-500', pulseColor: 'shadow-red-500/50' };
  if (aqi <= 300) return { level: 'Very Unhealthy', color: 'bg-purple-500', textColor: 'text-purple-500', pulseColor: 'shadow-purple-500/50' };
  return { level: 'Hazardous', color: 'bg-red-700', textColor: 'text-red-700', pulseColor: 'shadow-red-700/50' };
};

const getStatusColor = (status) => {
    switch (status) {
        case 'Received': return 'bg-blue-500/20 text-blue-300';
        case 'In Review': return 'bg-yellow-500/20 text-yellow-300';
        case 'Action Taken': return 'bg-green-500/20 text-green-300';
        default: return 'bg-slate-500/20 text-slate-300';
    }
};

// --- 3D Background Component ---
const ThreeBackground = () => {
    const mountRef = useRef(null);
    useEffect(() => {
        const mount = mountRef.current;
        let scene, camera, renderer, earthGroup, stars;
        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(75, mount.clientWidth / mount.clientHeight, 0.1, 1000);
        camera.position.z = 5;
        renderer = new THREE.WebGLRenderer({ canvas: mount, antialias: true, alpha: true });
        renderer.setSize(mount.clientWidth, mount.clientHeight);
        renderer.setPixelRatio(window.devicePixelRatio);

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        scene.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
        directionalLight.position.set(5, 3, 5);
        scene.add(directionalLight);

        earthGroup = new THREE.Group();
        scene.add(earthGroup);
        const textureLoader = new THREE.TextureLoader();
        // Increased globe size
        const earthGeometry = new THREE.SphereGeometry(1.8, 64, 64);

        const earthDayTexture = textureLoader.load('/assets/8k_earth_daymap-min-min 2.jpeg');
        const earthNormalMap = textureLoader.load('/assets/8k_earth_normal_map-min.jpeg');
        const cloudTexture = textureLoader.load('/assets/8k_earth_clouds-min-min-min.jpeg');

        const earthMaterial = new THREE.MeshPhongMaterial({ map: earthDayTexture, bumpMap: earthNormalMap, bumpScale: 0.1 });
        const earth = new THREE.Mesh(earthGeometry, earthMaterial);
        earthGroup.add(earth);

        const cloudGeometry = new THREE.SphereGeometry(1.83, 64, 64);
        const cloudMaterial = new THREE.MeshPhongMaterial({ map: cloudTexture, transparent: true, opacity: 0.5 });
        const clouds = new THREE.Mesh(cloudGeometry, cloudMaterial);
        earthGroup.add(clouds);

        const atmosphereGeometry = new THREE.SphereGeometry(1.9, 64, 64);
        const atmosphereMaterial = new THREE.ShaderMaterial({
            vertexShader: `varying vec3 vertexNormal; void main() { vertexNormal = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
            fragmentShader: `varying vec3 vertexNormal; void main() { float intensity = pow(0.6 - dot(vertexNormal, vec3(0, 0, 1.0)), 2.0); gl_FragColor = vec4(0.3, 0.6, 1.0, 0.5) * intensity; }`,
            blending: THREE.AdditiveBlending,
            side: THREE.BackSide
        });
        const atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
        earthGroup.add(atmosphere);

        const starVertices = [];
        for (let i = 0; i < 10000; i++) {
            const x = (Math.random() - 0.5) * 2000;
            const y = (Math.random() - 0.5) * 2000;
            const z = (Math.random() - 0.5) * 2000;
            if (Math.sqrt(x * x + y * y + z * z) > 100) starVertices.push(x, y, z);
        }
        const starGeometry = new THREE.BufferGeometry();
        starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
        const starMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 0.2, transparent: true, opacity: 0.8 });
        stars = new THREE.Points(starGeometry, starMaterial);
        scene.add(stars);

        const animate = () => {
            requestAnimationFrame(animate);
            earth.rotation.y += 0.0002;
            clouds.rotation.y += 0.0003;
            stars.rotation.y += 0.0001;
            renderer.render(scene, camera);
        };
        animate();

        if (window.gsap && window.ScrollTrigger) {
            const gsap = window.gsap;
            gsap.registerPlugin(window.ScrollTrigger);

            const tl = gsap.timeline({
                scrollTrigger: {
                    trigger: "main",
                    start: "top top",
                    end: "bottom+=500%",
                    scrub: 1.8,
                }
            });

            tl.set(earthGroup.position, { x: -3, y: 2, z: -5 });
            tl.set(earthGroup.scale, { x: 0.5, y: 0.5, z: 0.5 });

            tl.to(earthGroup.position, { x: 3.5, y: 0, z: 0, ease: "power2.inOut" }, 0)
              .to(earthGroup.scale, { x: 1, y: 1, z: 1, ease: "power2.inOut" }, 0)
              .to(earthGroup.rotation, { y: Math.PI * 1, ease: "power2.inOut" }, 0);

            tl.to(earthGroup.position, { x: -3.5, y: 0, z: -2, ease: "power2.inOut" }, 1)
              .to(earthGroup.rotation, { y: Math.PI * 2, z: 0.3, ease: "power2.inOut" }, 1);

            tl.to(earthGroup.position, { x: 0, y: -1, z: 1, ease: "power2.inOut" }, 2)
              .to(earthGroup.scale, { x: 1.5, y: 1.5, z: 1.5, ease: "power2.inOut" }, 2)
              .to(earthGroup.rotation, { y: Math.PI * 2.5, z: -0.2, ease: "power2.inOut" }, 2);
            
            // Final zoom is now larger
            tl.to(earthGroup.position, { x: 0, y: 0, z: 0, ease: "power2.inOut" }, 3)
              .to(earthGroup.scale, { x: 3, y: 3, z: 3, ease: "power2.inOut" }, 3)
              .to(earthGroup.rotation, { y: Math.PI * 3, z: 0, ease: "power2.inOut" }, 3)
              .to(camera.position, { z: 6, ease: "power2.inOut" }, 3);
        }

        const handleResize = () => {
            camera.aspect = mount.clientWidth / mount.clientHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(mount.clientWidth, mount.clientHeight);
        };
        window.addEventListener('resize', handleResize);
        return () => {
            window.removeEventListener('resize', handleResize);
            if (renderer.domElement.parentElement === mount) {
                mount.removeChild(renderer.domElement);
            }
        };
    }, []);
    return <canvas ref={mountRef} id="bg-canvas" style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100vh', zIndex: 0 }} />;
};

// --- UI Components ---
const Header = () => {
    const [time, setTime] = useState(new Date());

    useEffect(() => {
        const timerId = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timerId);
    }, []);

    return (
        <header className="bg-slate-900/70 backdrop-blur-lg sticky top-0 z-50 border-b border-slate-700">
            <nav className="container mx-auto px-6 py-4 flex justify-between items-center">
                <a href="#home" className="text-2xl font-bold text-white">Kara</a>
                <div className="hidden md:flex space-x-8 items-center">
                    <a href="#dashboard" className="text-slate-300 hover:text-blue-400 transition">Dashboard</a>
                    <a href="#kit" className="text-slate-300 hover:text-blue-400 transition">The Kit</a>
                    <a href="#about" className="text-slate-300 hover:text-blue-400 transition">About Us</a>
                </div>
                <div className="text-lg font-medium text-slate-300">
                    {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
            </nav>
        </header>
    );
};

const AQIDisplay = ({ apiKey }) => {
  const [aqiData, setAqiData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [healthTips, setHealthTips] = useState([]);
  const [tipsLoading, setTipsLoading] = useState(false);

  const calculateAqiFromPm25 = (pm25) => {
    if (pm25 > 350.5) return 401; if (pm25 > 250.5) return 301; if (pm25 > 150.5) return 201;
    if (pm25 > 55.5) return 151;  if (pm25 > 35.5) return 101;  if (pm25 > 12.1) return 51;
    return 25;
  };

  useEffect(() => {
    const fetchAqi = async () => {
      const lat = 12.9716, lon = 77.5946;
      const apiUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&hourly=pm10,pm2_5,ozone`;
      try {
        const response = await fetch(apiUrl);
        if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
        const data = await response.json();
        if (data && data.hourly && data.hourly.pm2_5) {
          const latestPm25 = data.hourly.pm2_5[0];
          const calculatedAqi = calculateAqiFromPm25(latestPm25);
          setAqiData({
            city: "Bengaluru", aqi: calculatedAqi,
            pollutants: {
              pm25: { value: latestPm25.toFixed(1), name: "PM2.5" },
              pm10: { value: data.hourly.pm10[0].toFixed(1), name: "PM10" },
              o3: { value: data.hourly.ozone[0].toFixed(1), name: "Ozone" },
            }
          });
        } else throw new Error("No AQI data found in the response.");
      } catch (err) {
        console.error("AQI fetch error:", err);
        setError('Could not fetch AQI data.');
      } finally { setLoading(false); }
    };
    fetchAqi();
  }, []);

  const handleGetHealthTips = async () => {
    if (!aqiData) return;
    setTipsLoading(true); setHealthTips([]);
    const aqiInfo = getAqiInfo(aqiData.aqi);
    const prompt = `The current Air Quality Index (AQI) in Bengaluru is ${aqiData.aqi}, which is considered '${aqiInfo.level}'. The main pollutants are PM2.5 at ${aqiData.pollutants.pm25.value} µg/m³ and PM10 at ${aqiData.pollutants.pm10.value} µg/m³. Provide 3 concise, actionable health tips for a teenager who travels daily in this city, considering these specific pollutants. Start each tip with a relevant emoji. Format as a simple list with each tip on a new line, like "- 😷 Wear a mask."`;
    try {
        let chatHistory = [{ role: "user", parts: [{ text: prompt }] }];
        const payload = { contents: chatHistory };
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;
        const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!response.ok) throw new Error(`API request failed with status ${response.status}`);
        const result = await response.json();
        if (result.candidates && result.candidates[0]?.content?.parts[0]?.text) {
            const tipsText = result.candidates[0].content.parts[0].text;
            const tipsArray = tipsText.split('\n').filter(tip => tip.trim().startsWith('-') || tip.trim().startsWith('•'));
            setHealthTips(tipsArray);
        } else { setHealthTips(["Could not generate tips due to an unexpected response."]); }
    } catch (error) {
        console.error("Gemini API call failed:", error);
        setHealthTips(["An error occurred while fetching health tips."]);
    } finally { setTipsLoading(false); }
  };

  if (loading) return <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700"><GeneratingSpinner text="Fetching AQI Data..."/></div>;
  if (error) return <div className="bg-slate-800/50 p-6 rounded-2xl border border-red-500/50 text-center text-red-400">{error}</div>;

  const aqiInfo = getAqiInfo(aqiData.aqi);
  return (<div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700 text-center transition-all duration-300 hover:border-slate-600 hover:shadow-2xl hover:shadow-slate-900/50"><div className="flex items-center justify-center text-slate-400 text-lg mb-4"><MapPinIcon /><span>{aqiData.city}</span></div><div className={`mx-auto w-32 h-32 rounded-full flex items-center justify-center text-white text-5xl font-bold mb-4 ${aqiInfo.color} shadow-lg ${aqiInfo.pulseColor} animate-pulse`}>{aqiData.aqi}</div><h3 className={`text-2xl font-bold ${aqiInfo.textColor}`}>{aqiInfo.level}</h3><div className="mt-6 pt-6 border-t border-slate-700 flex justify-around text-white">{Object.values(aqiData.pollutants).map(p => (<div key={p.name}><div className="text-2xl font-semibold">{p.value}</div><div className="text-xs text-slate-400">{p.name}</div></div>))}</div>
  <button onClick={handleGetHealthTips} disabled={tipsLoading} className="mt-6 w-full bg-indigo-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-indigo-700 transition-colors duration-300 flex items-center justify-center disabled:bg-slate-500">{tipsLoading ? <GeneratingSpinner text="Generating Tips..."/> : <><SparklesIcon /> Get Health Tips</>}</button>
  {healthTips.length > 0 && <div className="mt-4 text-left text-sm text-slate-300 bg-slate-700/50 p-4 rounded-lg"><h4 className="font-bold text-indigo-300 mb-2">Health Recommendations:</h4><ul className="space-y-2">{healthTips.map((tip, i) => <li key={i} className="flex items-start"><span className="mr-2 pt-1">{tip.match(/(\p{Emoji})/u)?.[0] || '💡'}</span><span>{tip.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]|-|•)/g, '').trim()}</span></li>)}</ul></div>}
  </div>);
};

const ComplaintForm = ({ db, auth, apiKey }) => {
  const [description, setDescription] = useState(''); const [location, setLocation] = useState(''); const [category, setCategory] = useState(''); const [isSubmitting, setIsSubmitting] = useState(false); const [message, setMessage] = useState('');
  const [aiContent, setAiContent] = useState({ summary: '', draft: '' });
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateAIDraft = async () => {
    if (!description || !location || !category) { setMessage("Please fill in all fields before generating."); return; }
    setIsGenerating(true); setAiContent({ summary: '', draft: '' });
    const prompt = `Based on the following pollution complaint, generate a short, one-sentence summary and a formal complaint draft. Format the output as a JSON object with two keys: "summary" and "draft".\n\nComplaint Category: ${category}\nLocation: ${location}\nDescription: ${description}`;
    try {
        let chatHistory = [{ role: "user", parts: [{ text: prompt }] }];
        const payload = { contents: chatHistory };
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;
        const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!response.ok) throw new Error(`API request failed with status ${response.status}`);
        const result = await response.json();
        if (result.candidates && result.candidates[0]?.content?.parts[0]?.text) {
            let textContent = result.candidates[0].content.parts[0].text;
            textContent = textContent.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsedResult = JSON.parse(textContent);
            setAiContent(parsedResult);
        } else { setMessage("Could not generate AI content due to an unexpected response."); }
    } catch (error) { console.error("Gemini API call failed:", error); setMessage("Failed to connect to the AI service."); }
    finally { setIsGenerating(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!description || !location || !category || !auth.currentUser) { setMessage('Please fill in all fields.'); return; }
    setIsSubmitting(true); setMessage('');
    try {
      await addDoc(collection(db, `complaints`), { userId: auth.currentUser.uid, description, location, category, status: 'Received', upvotes: 0, timestamp: serverTimestamp() });
      setDescription(''); setLocation(''); setCategory(''); setAiContent({ summary: '', draft: '' }); setMessage('Report submitted successfully!');
    } catch (error) { console.error("Error adding document: ", error); setMessage('Failed to submit report.'); } 
    finally { setIsSubmitting(false); setTimeout(() => setMessage(''), 3000); }
  };
  return (<div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700 transition-all duration-300 hover:border-slate-600 hover:shadow-2xl hover:shadow-slate-900/50"><h3 className="text-2xl font-bold text-white mb-4">Report an Issue</h3><form onSubmit={handleSubmit} className="space-y-4"><div><label htmlFor="location" className="block text-sm font-medium text-slate-300 mb-1">Location</label><input type="text" id="location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g., Near MG Road Metro Station" className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" /></div><div><label htmlFor="category" className="block text-sm font-medium text-slate-300 mb-1">Category</label><select id="category" value={category} onChange={(e) => setCategory(e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"><option value="">Select Category</option><option>Waste Burning</option><option>Industrial Emissions</option><option>Vehicular Smoke</option><option>Construction Dust</option></select></div><div><label htmlFor="description" className="block text-sm font-medium text-slate-300 mb-1">Description</label><textarea id="description" rows="3" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the issue..." className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"></textarea></div>
  {description && <button type="button" onClick={handleGenerateAIDraft} disabled={isGenerating} className="w-full bg-indigo-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-indigo-700 flex items-center justify-center disabled:bg-slate-500">{isGenerating ? <GeneratingSpinner text="Generating Draft..."/> : <><SparklesIcon /> Generate AI Summary & Draft</>}</button>}
  {aiContent.summary && <div className="bg-slate-700/50 p-3 rounded-lg mt-4"><h4 className="font-bold text-indigo-300 mb-1">AI Summary:</h4><p className="text-sm text-slate-300 italic">{aiContent.summary}</p></div>}
  {aiContent.draft && <div className="bg-slate-700/50 p-3 rounded-lg mt-2"><h4 className="font-bold text-indigo-300 mb-1">AI Drafted Complaint:</h4><p className="text-sm text-slate-300 whitespace-pre-wrap">{aiContent.draft}</p></div>}
  <button type="submit" disabled={isSubmitting} className="w-full bg-blue-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-blue-700 flex items-center justify-center disabled:bg-slate-500 mt-4">{isSubmitting ? <GeneratingSpinner text="Submitting..."/> : 'Submit Complaint'}</button>{message && <p className="text-sm text-center text-green-400 mt-2 flex items-center justify-center"><CheckCircleIcon/> {message}</p>} </form></div>);
};

const ComplaintFeed = ({ complaints, db }) => {
    const handleUpvote = async (id) => {
        const complaintRef = doc(db, `complaints`, id);
        try { await updateDoc(complaintRef, { upvotes: increment(1) }); } 
        catch (error) { console.error("Error upvoting: ", error); }
    };
    return (<div className="space-y-4">{complaints.length === 0 ? (<p className="text-slate-400 text-center py-8">No reports yet. Be the first!</p>) : (complaints.map(c => (<div key={c.id} className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 transition-all duration-300 hover:border-indigo-500/50 hover:scale-[1.02]"><div className="flex justify-between items-start"><p className="text-white flex-1 pr-4">{c.description}</p><div className="flex flex-col items-center"><button onClick={() => handleUpvote(c.id)} className="flex items-center text-slate-400 hover:text-white transition-colors group"><ArrowUpIcon className="group-hover:text-green-400"/><span>{c.upvotes}</span></button><span className={`mt-2 text-xs font-semibold px-2 py-1 rounded-full ${getStatusColor(c.status)}`}>{c.status}</span></div></div><div className="text-xs text-slate-400 mt-2 flex justify-between items-center"><span className="flex items-center"><MapPinIcon /> {c.location}</span><span>{c.timestamp?.toDate().toLocaleString() || 'Just now'}</span></div></div>)))}</div>);
};

const ComplaintMap = ({ complaints }) => {
    const mapRef = useRef(null);
    const bengaluruCenter = [12.9716, 77.5946];

    const getCategoryStyle = (category) => {
        switch (category) {
            case 'Waste Burning': return { color: '#ef4444', icon: '🔥' }; // red
            case 'Industrial Emissions': return { color: '#a855f7', icon: '🏭' }; // purple
            case 'Vehicular Smoke': return { color: '#f97316', icon: '🚗' }; // orange
            case 'Construction Dust': return { color: '#eab308', icon: '🏗️' }; // yellow
            default: return { color: '#64748b', icon: '❓' }; // slate
        }
    };

    useEffect(() => {
        if (typeof window.L === 'undefined' || !mapRef.current) return;

        const map = window.L.map(mapRef.current).setView(bengaluruCenter, 12);

        window.L.tileLayer(
            'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
            { attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>' }
        ).addTo(map);

        const generateCoords = (locationStr) => {
            let hash = 0;
            for (let i = 0; i < locationStr.length; i++) {
                const char = locationStr.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash |= 0;
            }
            const latOffset = (hash % 1000) / 20000;
            const lonOffset = ((hash >> 8) % 1000) / 20000;
            return [bengaluruCenter[0] + latOffset, bengaluruCenter[1] + lonOffset];
        };

        complaints.forEach(complaint => {
            const style = getCategoryStyle(complaint.category);
            const customIcon = window.L.divIcon({
                html: `<div style="background-color: ${style.color};" class="h-6 w-6 rounded-full flex items-center justify-center text-sm shadow-lg">${style.icon}</div>`,
                className: '',
                iconSize: [24, 24],
                iconAnchor: [12, 12]
            });

            const popupContent = `<div class="text-slate-800"><h4 class="font-bold">${complaint.category}</h4><p>${complaint.description}</p><p class="text-xs text-slate-500 mt-1">${complaint.location}</p></div>`;
            window.L.marker(generateCoords(complaint.location), { icon: customIcon })
                .addTo(map)
                .bindPopup(popupContent);
        });

        return () => { map.remove(); };
    }, [complaints]);

    if (typeof window.L === 'undefined') {
        return <div className="bg-slate-800/50 p-4 rounded-xl border border-yellow-500/50 text-center text-yellow-300">Map library is loading...</div>;
    }

    return (
        <div className="h-[500px] w-full bg-slate-800/50 p-2 rounded-xl border border-slate-700">
            <div ref={mapRef} style={{ height: "100%", width: "100%", borderRadius: '0.75rem' }}></div>
        </div>
    );
};

const DashboardTabs = ({ db, auth, complaints, userId }) => {
    const [activeTab, setActiveTab] = useState('feed');
    const myComplaints = complaints.filter(c => c.userId === userId);
    return (<div><div className="flex border-b border-slate-700 mb-6"><button onClick={() => setActiveTab('feed')} className={`py-2 px-4 font-semibold transition-colors ${activeTab === 'feed' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-slate-400 hover:text-white'}`}>Community Feed</button><button onClick={() => setActiveTab('my_reports')} className={`py-2 px-4 font-semibold transition-colors ${activeTab === 'my_reports' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-slate-400 hover:text-white'}`}>My Reports</button><button onClick={() => setActiveTab('map')} className={`py-2 px-4 font-semibold transition-colors ${activeTab === 'map' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-slate-400 hover:text-white'}`}>Contaminant Map</button></div><div>{activeTab === 'feed' && <ComplaintFeed complaints={complaints} db={db} />}{activeTab === 'my_reports' && <ComplaintFeed complaints={myComplaints} db={db} />}{activeTab === 'map' && <ComplaintMap complaints={complaints} />}</div></div>);
};

export default function App() {
  const [firebase, setFirebase] = useState({ db: null, auth: null });
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [complaints, setComplaints] = useState([]);
  const [welcomeMessage, setWelcomeMessage] = useState("Breathe Freely. Travel Safely.");

  const GEMINI_API_KEY = "AIzaSyDn7yWMATzanguLxkihirfqbKWnAPJgZVQ"; 

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setWelcomeMessage("Good Morning. Ready for a Clear Day?");
    else if (hour < 18) setWelcomeMessage("Good Afternoon. Stay Pollution Aware.");
    else setWelcomeMessage("Good Evening. How's the Air Out There?");
  }, []);

  useEffect(() => {
    const firebaseConfig = {
      apiKey: "AIzaSyCsLJrI1dJbmPyZ-HAFDFI6vh2Vhen4OD0",
      authDomain: "kara-ff66c.firebaseapp.com",
      projectId: "kara-ff66c",
      storageBucket: "kara-ff66c.appspot.com",
      messagingSenderId: "450627636310",
      appId: "1:450627636310:web:d6b21e85446eb55598bff7"
    };

    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const db = getFirestore(app);
    setFirebase({ db, auth });

    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        try { await signInAnonymously(auth); } catch (error) { console.error("Anonymous sign-in failed:", error); }
      }
      setIsAuthReady(true);
    });
  }, []);

  useEffect(() => {
    if (!firebase.db || !isAuthReady) return;
    const q = query(collection(firebase.db, `complaints`), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const complaintsData = querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      setComplaints(complaintsData);
    }, (error) => { console.error("Firestore snapshot error:", error); });
    return () => unsubscribe();
  }, [firebase.db, isAuthReady]);

  return (
    <div className="bg-slate-900 text-white min-h-screen font-sans bg-gradient-to-b from-slate-900 to-indigo-900/30">
      <ThreeBackground />
      <div className="relative z-10">
        <Header />
        <main>
          <section id="home" className="content-section text-center"><div className="content-wrapper"><h1 className="text-5xl md:text-7xl font-extrabold text-white">{welcomeMessage}</h1><p className="text-xl text-slate-300 mt-4 max-w-3xl mx-auto">Kara is your personal pollution protection system. Get real-time alerts, report issues, and take control of your health.</p><a href="#dashboard" className="mt-8 inline-block bg-blue-600 text-white font-bold py-3 px-8 rounded-full text-lg hover:bg-blue-700 transition-transform hover:scale-105">Go to Dashboard</a></div></section>
          <section id="dashboard" className="content-section"><div className="content-wrapper w-full max-w-6xl"><div className="grid grid-cols-1 lg:grid-cols-3 gap-8"><div className="lg:col-span-1 space-y-8"><AQIDisplay apiKey={GEMINI_API_KEY} /><ComplaintForm db={firebase.db} auth={firebase.auth} apiKey={GEMINI_API_KEY} /></div><div className="lg:col-span-2">{isAuthReady && firebase.db ? <DashboardTabs db={firebase.db} auth={firebase.auth} complaints={complaints} userId={firebase.auth.currentUser?.uid} /> : <div className="flex justify-center items-center h-full"><GeneratingSpinner text="Initializing Dashboard..."/></div>}</div></div></div></section>
          <section id="kit" className="content-section text-center"><div className="content-wrapper"><h2 className="text-4xl font-bold text-white mb-4">The Kara Protection Kit</h2><p className="text-lg text-slate-300 max-w-2xl mx-auto mb-8">Your first line of defense against urban pollution. The kit includes smart, reusable masks and a pocket-sized air quality sensor that syncs with the app.</p><div className="bg-slate-800/50 p-8 rounded-2xl border border-slate-700 inline-block"><img src="https://placehold.co/600x400/1e293b/ffffff?text=Kara+Kit+Components" alt="Kara Kit" className="rounded-lg" /></div></div></section>
          <section id="about" className="content-section text-center"><div className="content-wrapper"><h2 className="text-4xl font-bold text-white mb-4">Our Team</h2><p className="text-lg text-slate-300 max-w-2xl mx-auto mb-12">We are a passionate team dedicated to empowering urban youth to take control of their health and environment with Kara.</p><div className="flex justify-center gap-8"><div className="text-center"><img src="https://placehold.co/150x150/1e293b/ffffff?text=R" alt="Rayyan" className="w-24 h-24 rounded-full mx-auto mb-2 border-2 border-blue-400"/><h3 className="text-xl font-bold text-white">Rayyan</h3><p className="text-blue-400">Co-Founder</p></div><div className="text-center"><img src="https://placehold.co/150x150/1e293b/ffffff?text=K" alt="Kanishka" className="w-24 h-24 rounded-full mx-auto mb-2 border-2 border-blue-400"/><h3 className="text-xl font-bold text-white">Kanishka</h3><p className="text-blue-400">Co-Founder</p></div></div></div></section>
          <section id="contact" className="content-section"><div className="content-wrapper"><h2 className="text-4xl font-bold text-white text-center mb-8">Join Our Mission</h2><form action="#" method="POST" className="max-w-lg mx-auto"><div className="grid grid-cols-1 gap-y-4"><input type="text" placeholder="Full name" className="bg-slate-800/50 block w-full py-3 px-4 placeholder-slate-400 rounded-md border border-slate-600 focus:ring-blue-500 focus:border-blue-500" /><input type="email" placeholder="Email" className="bg-slate-800/50 block w-full py-3 px-4 placeholder-slate-400 rounded-md border border-slate-600 focus:ring-blue-500 focus:border-blue-500" /><textarea rows="4" placeholder="Your Message" className="bg-slate-800/50 block w-full py-3 px-4 placeholder-slate-400 rounded-md border border-slate-600 focus:ring-blue-500 focus:border-blue-500"></textarea><button type="submit" className="w-full cta-button bg-blue-600 text-white font-bold py-3 px-6 rounded-md hover:bg-blue-700">Send Message</button></div></form></div></section>
        </main>
        <footer className="relative z-20 text-center py-6 text-slate-500 text-sm">
          <p>&copy; 2025 Kara. An entry for the International Sastra Summit 2025.</p>
        </footer>
      </div>
    </div>
  );
}
